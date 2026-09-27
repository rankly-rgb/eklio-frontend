/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PARCOURS STRIPE, JOUÉ CONTRE LA VRAIE ROUTE ET LA VRAIE BASE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ÉTIQUETTE, ET C'EST LA PREMIÈRE CHOSE QUE CE FICHIER DIT :
 *
 *   route réelle, signature réelle, base réelle — ÉVÉNEMENTS FORGÉS ICI.
 *
 * Ce qui est réel : `next dev` sert `app/api/stripe/webhook/route.ts` tel quel ;
 * la signature est vérifiée par `constructEventAsync` du SDK contre
 * `STRIPE_WEBHOOK_SECRET` — exactement ce que fait `stripe listen`, dont le
 * `whsec_` n'est lui aussi qu'un secret HMAC local ; les écritures passent par
 * PostgREST et les RPC du produit, sur la base rejouée des migrations.
 *
 * Ce qui ne l'est pas : les événements sont construits ici, pas émis par Stripe.
 * Le 2026-09-27, `api.stripe.com` était refusé par la politique réseau du bac à
 * sable ; les trois appels sortants du webhook (`subscriptions.retrieve`,
 * `paymentIntents.retrieve`, `subscriptions.create` des mois inclus) ont donc
 * ÉCHOUÉ, et ce parcours dit ce que le code fait quand ils échouent. Ce qu'ils
 * font quand ils réussissent reste à voir en §2 de `B5-stripe.md`.
 *
 *   # 1. base + façade :  bash ../eklio-backend/scripts/local-verify.sh
 *   #                     bash scripts/local-render/edge/up.sh
 *   # 2. next dev avec STRIPE_WEBHOOK_SECRET=$WHSEC et CONTENT_GENERATION_ARMED=true
 *   #    (ce drapeau n'ouvre ici QUE la mise en file : aucune clé de modèle posée)
 *   WHSEC=… npx tsx scripts/stripe-path/play.ts
 *
 * Aucun appel de modèle. Aucune clé écrite. Chaque exécution crée des comptes
 * neufs, préfixés du numéro d'exécution, et ne touche à rien d'autre.
 */
import Stripe from "stripe";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { selectDueMonths } from "@/lib/content/month/due";
import { serverDuePort } from "@/lib/content/month/server-ports";
import { nextMonthKey } from "@/lib/content/generate/queue";
import { POSTS_PER_MONTH } from "@/lib/content/bank";
import { KIT_PLANS } from "@/lib/billing/plans";

const ROUTE = process.env.ROUTE ?? "http://localhost:3000/api/stripe/webhook";
const WHSEC = process.env.WHSEC;
if (!WHSEC) throw new Error("WHSEC manquant : le secret HMAC que next dev a reçu.");
const DB = process.env.DB ?? "eklio_local_verify";
const RUN = `r${Date.now().toString(36)}`;

/* Le SDK ne sert qu'à SIGNER : aucune requête ne part avec cette clé factice. */
const signer = new Stripe("sk_test_signing_only");
/* Rôle local du harnais, créé par `setup.sql` : lecture et amorce des comptes. */
const sql = new pg.Client({ host: "127.0.0.1", user: "stripe_path", password: "eklio_local", database: DB });

let failures = 0;
const lines: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  const line = `  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`;
  lines.push(line);
  console.log(line);
}
/* Un défaut établi et NON corrigé : imprimé, pas compté — la fiche le porte. */
function open(label: string, holds: boolean, detail = "") {
  const line = `  ${holds ? "✓" : "⚠ OUVERT"} ${label}${detail ? ` — ${detail}` : ""}`;
  lines.push(line);
  console.log(line);
}
function section(title: string) {
  const line = `\n═══ ${title} ═══`;
  lines.push(line);
  console.log(line);
}

const now = () => Math.floor(Date.now() / 1000);

function event(type: string, object: Record<string, unknown>, created = now()): Stripe.Event {
  return {
    id: `evt_${RUN}_${Math.random().toString(36).slice(2, 10)}`,
    object: "event",
    api_version: "2025-09-30.clover",
    created,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

async function send(
  evt: Stripe.Event,
  opts: { signature?: string } = {}
): Promise<{ status: number; body: string }> {
  const payload = JSON.stringify(evt);
  const signature =
    opts.signature ?? signer.webhooks.generateTestHeaderString({ payload, secret: WHSEC! });
  const res = await fetch(ROUTE, {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
  return { status: res.status, body: await res.text() };
}

async function one<T = Record<string, unknown>>(q: string, params: unknown[] = []): Promise<T | null> {
  const r = await sql.query(q, params);
  return (r.rows[0] as T) ?? null;
}
async function count(q: string, params: unknown[] = []): Promise<number> {
  const r = await sql.query(q, params);
  return Number(Object.values(r.rows[0] ?? { n: 0 })[0]);
}

type Account = { userId: string; projectId: string; brandKitId: string; customerId: string };

/* auth.users est la seule ligne hors produit : GoTrue n'existe pas ici. */
async function account(label: string): Promise<Account> {
  const email = `${RUN}-${label}@eklio-test.invalid`;
  const user = await one<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email]
  );
  const project = await one<{ id: string }>(
    "insert into public.projects (user_id, name) values ($1, $2) returning id",
    [user!.id, `stripe path ${label}`]
  );
  const kit = await one<{ id: string }>(
    "insert into public.brand_kits (project_id) values ($1) returning id",
    [project!.id]
  );
  return {
    userId: user!.id,
    projectId: project!.id,
    brandKitId: kit!.id,
    customerId: `cus_${RUN}_${label}`,
  };
}

function metadata(a: Account, tier?: string): Record<string, string> {
  return tier
    ? { eklio_user_id: a.userId, eklio_project_id: a.projectId, eklio_tier: tier }
    : { eklio_user_id: a.userId };
}

function checkoutSession(
  a: Account,
  opts: { tier?: string; mode: "payment" | "subscription"; subscription?: string; pi?: string | null }
) {
  return {
    id: `cs_test_${RUN}_${Math.random().toString(36).slice(2, 10)}`,
    object: "checkout.session",
    mode: opts.mode,
    customer: a.customerId,
    client_reference_id: a.userId,
    metadata: metadata(a, opts.tier),
    payment_status: "paid",
    status: "complete",
    currency: "usd",
    /* ⚠ En mode `subscription`, Stripe rend `payment_intent: null` : l'argent est sur la facture. */
    payment_intent:
      opts.pi !== undefined ? opts.pi : opts.mode === "payment" ? `pi_${RUN}_${Math.random().toString(36).slice(2, 8)}` : null,
    subscription: opts.subscription ?? null,
    invoice: opts.mode === "subscription" ? `in_${RUN}` : null,
  };
}

function subscription(
  a: Account,
  opts: { id: string; status: string; trialDays?: number; periodDays?: number; cancelAtPeriodEnd?: boolean; meta?: Record<string, string> }
) {
  const end = now() + (opts.periodDays ?? 30) * 86400;
  return {
    id: opts.id,
    object: "subscription",
    customer: a.customerId,
    status: opts.status,
    metadata: opts.meta ?? metadata(a),
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    trial_end: opts.trialDays ? now() + opts.trialDays * 86400 : null,
    items: { data: [{ id: `si_${opts.id}`, current_period_end: end, price: { id: "price_local_mp" } }] },
  };
}

/* Les sept objets d'un achat, avec les requêtes de la fiche. */
async function sevenObjects(a: Account, tier: string, eventId: string, sessionId: string) {
  check(
    "stripe_events porte l'event",
    (await count("select count(*) from stripe_events where stripe_event_id = $1", [eventId])) === 1
  );
  const profile = await one<{ stripe_customer_id: string | null }>(
    "select stripe_customer_id from profiles where id = $1",
    [a.userId]
  );
  check("profiles.stripe_customer_id relié", profile?.stripe_customer_id === a.customerId, String(profile?.stripe_customer_id));
  const purchase = await one<{ id: string; tier: string; kind: string; amount_cents: number; status: string; paid_at: string | null }>(
    "select id, tier, kind, amount_cents, status, paid_at from purchases where stripe_checkout_session_id = $1",
    [sessionId]
  );
  const cents = KIT_PLANS[tier as keyof typeof KIT_PLANS].amountCents;
  check(
    `purchases : ${tier}, ${cents} cents, paid`,
    purchase?.tier === tier && purchase.amount_cents === cents && purchase.status === "paid" && purchase.paid_at !== null,
    JSON.stringify(purchase && { tier: purchase.tier, kind: purchase.kind, amount: purchase.amount_cents, status: purchase.status })
  );
  /*
   * ⚠ LA FICHE ATTENDAIT « AU MOINS UNE LIGNE » ICI, ET C'ÉTAIT FAUX. Le journal
   * ne trace que les transitions APRÈS l'achat (remboursement, litige) : l'achat
   * lui-même est `purchases`. Zéro ligne à ce stade est le comportement correct.
   */
  const transitions = await count("select count(*) from purchase_status_events where purchase_id = $1", [purchase?.id]);
  check("purchase_status_events : vide à l'achat (le journal commence au remboursement)", transitions === 0, `${transitions} ligne(s)`);
  const grants = await count("select count(*) from plan_grants where project_id = $1 and tier = $2", [a.projectId, tier]);
  check("plan_grants : une allocation au palier", grants === 1, `${grants}`);
  const credits = await one<{ plan_tier: string; has_paid: boolean }>(
    "select plan_tier, has_paid from generation_credits where project_id = $1",
    [a.projectId]
  );
  check(`generation_credits.plan_tier = ${tier}`, credits?.plan_tier === tier, JSON.stringify(credits));
  return { purchase, credits };
}

async function main() {
  await sql.connect();
  console.log(`exécution ${RUN} → ${ROUTE}`);

  /* ─────────────────────────────────────────────────────────────────── */
  section("1 · UN ACHAT PAR PALIER VENDABLE — mode payment");
  const sellable = (await sql.query("select tier from plans where sellable and tier in ('starter','practice','signature') order by tier")).rows.map((r: { tier: string }) => r.tier);
  check("trois paliers de kit vendables en base", sellable.length === 3, sellable.join(", "));

  const bought: Record<string, { a: Account; evt: Stripe.Event; session: ReturnType<typeof checkoutSession> }> = {};
  for (const tier of ["starter", "practice", "signature"]) {
    const a = await account(tier);
    const session = checkoutSession(a, { tier, mode: "payment" });
    const evt = event("checkout.session.completed", session);
    const res = await send(evt);
    lines.push(`  [${tier}] route → ${res.status} ${res.body.slice(0, 120)}`);
    check(`[${tier}] la route rend 200`, res.status === 200, res.body.slice(0, 80));
    const { credits } = await sevenObjects(a, tier, evt.id, session.id);
    lines.push(`  [${tier}] has_paid = ${credits?.has_paid} (la fiche attendait true)`);
    bought[tier] = { a, evt, session };
  }

  /* Signature inclut trois mois : le webhook crée l'abonnement chez Stripe. */
  section("1b · SIGNATURE — les trois mois inclus");
  {
    const { a } = bought.signature;
    const subs = await count("select count(*) from subscriptions where user_id = $1", [a.userId]);
    check(
      "sans API Stripe joignable, AUCUN abonnement n'est écrit par le checkout",
      subs === 0,
      `${subs} ligne(s) — le webhook a rendu 200 et journalisé « à poser à la main »`
    );
    const created = event(
      "customer.subscription.created",
      subscription(a, { id: `sub_${RUN}_sig`, status: "trialing", trialDays: 90, periodDays: 90, meta: metadata(a, "signature") })
    );
    const res = await send(created);
    check("customer.subscription.created (trialing) → 200", res.status === 200, res.body.slice(0, 80));
    const sub = await one<{ status: string; active: boolean; trial_end: string | null }>(
      "select status, active, trial_end from subscriptions where user_id = $1",
      [a.userId]
    );
    check("subscriptions : trialing, active, trial_end posé", sub?.status === "trialing" && sub.active === true && sub.trial_end !== null, JSON.stringify(sub));
  }

  /* ─────────────────────────────────────────────────────────────────── */
  section("2 · MONTHLY PRESENCE SEUL — abonnement, et dans le DÉSORDRE");
  const mp = await account("mp");
  const mpSubId = `sub_${RUN}_mp`;
  {
    /* Désordre réaliste : l'abonnement arrive avant la session qui l'a créé. */
    const created = event("customer.subscription.created", subscription(mp, { id: mpSubId, status: "active" }));
    const r1 = await send(created);
    check("subscription.created AVANT checkout.session.completed → 200", r1.status === 200, r1.body.slice(0, 80));
    const session = checkoutSession(mp, { mode: "subscription", subscription: mpSubId });
    const r2 = await send(event("checkout.session.completed", session));
    check("checkout.session.completed ensuite → 200", r2.status === 200, r2.body.slice(0, 120));
    const sub = await one<{ status: string; active: boolean; current_period_end: string | null }>(
      "select status, active, current_period_end from subscriptions where user_id = $1",
      [mp.userId]
    );
    check("subscriptions : active, période future", sub?.status === "active" && sub.active === true && sub.current_period_end !== null, JSON.stringify(sub));
    const profile = await one<{ stripe_customer_id: string | null }>("select stripe_customer_id from profiles where id = $1", [mp.userId]);
    check("customer relié par l'abonnement", profile?.stripe_customer_id === mp.customerId);
    const purchases = await count("select count(*) from purchases where user_id = $1", [mp.userId]);
    lines.push(`  [mp] purchases : ${purchases} — une session sans palier n'écrit pas d'achat (« métadonnées illisibles »)`);
  }

  /* ─────────────────────────────────────────────────────────────────── */
  section("3 · F54 — LE WEBHOOK POSE generating, L'ÉNUMÉRATION LE VOIT DÛ");
  const month = nextMonthKey();
  {
    for (const [label, a] of [["signature", bought.signature.a], ["mp", mp]] as const) {
      const row = await one<{ status: string }>(
        "select status from content_months where brand_kit_id = $1 and month = $2",
        [a.brandKitId, month]
      );
      check(`[${label}] le webhook a posé ${month} en generating`, row?.status === "generating", JSON.stringify(row));
    }
    const keys = readFileSync("/tmp/eklio-edge/keys.env", "utf8");
    const service = /^SERVICE=(.*)$/m.exec(keys)![1];
    const db = createClient("http://127.0.0.1:54321", service, { auth: { persistSession: false } });
    const outcome = await selectDueMonths(serverDuePort(db as never), { month, posts: POSTS_PER_MONTH });
    const dueKits = new Set(outcome.due.map((d) => d.brandKitId));
    for (const [label, a] of [["signature", bought.signature.a], ["mp", mp]] as const) {
      const skip = outcome.skipped.find((s) => s.brandKitId === a.brandKitId);
      check(`[${label}] l'énumération réelle le rend DÛ`, dueKits.has(a.brandKitId), skip ? `${skip.reason} ${skip.detail ?? ""}` : "");
    }
    const starterSkip = outcome.skipped.find((s) => s.brandKitId === bought.starter.a.brandKitId);
    check("[starter sans abonnement] absent des dus", !dueKits.has(bought.starter.a.brandKitId), starterSkip?.reason ?? "pas candidat");

    /* L'autre bout : un mois livré n'est plus dû. */
    await sql.query("update content_months set status = 'proposed' where brand_kit_id = $1 and month = $2", [mp.brandKitId, month]);
    const again = await selectDueMonths(serverDuePort(db as never), { month, posts: POSTS_PER_MONTH });
    const served = again.skipped.find((s) => s.brandKitId === mp.brandKitId);
    check("[mp] passé en proposed → already_served", served?.reason === "already_served", JSON.stringify(served));
    await sql.query("update content_months set status = 'generating' where brand_kit_id = $1 and month = $2", [mp.brandKitId, month]);
  }

  /* ─────────────────────────────────────────────────────────────────── */
  section("4 · LE REJEU — même event, nouvelle signature");
  {
    const { a, evt } = bought.starter;
    const before = {
      purchases: await count("select count(*) from purchases where user_id = $1", [a.userId]),
      grants: await count("select count(*) from plan_grants where project_id = $1", [a.projectId]),
      transitions: await count("select count(*) from purchase_status_events pse join purchases p on p.id = pse.purchase_id where p.user_id = $1", [a.userId]),
    };
    /* ⚠ « inchangé » entre deux zéros ne prouve rien : on exige d'abord l'achat. */
    check("avant le rejeu : un achat et une allocation existent", before.purchases === 1 && before.grants === 1, JSON.stringify(before));
    const res = await send(evt);
    check("rejeu → 200 duplicate", res.status === 200 && res.body.includes("duplicate"), res.body.slice(0, 80));
    check("stripe_events : une seule ligne", (await count("select count(*) from stripe_events where stripe_event_id = $1", [evt.id])) === 1);
    check("purchases inchangé", (await count("select count(*) from purchases where user_id = $1", [a.userId])) === before.purchases);
    check("plan_grants inchangé", (await count("select count(*) from plan_grants where project_id = $1", [a.projectId])) === before.grants);
    check(
      "purchase_status_events inchangé",
      (await count("select count(*) from purchase_status_events pse join purchases p on p.id = pse.purchase_id where p.user_id = $1", [a.userId])) === before.transitions
    );
  }

  section("4b · LE MÊME EVENT DEUX FOIS, EN MÊME TEMPS");
  {
    const a = await account("twice");
    const session = checkoutSession(a, { tier: "starter", mode: "payment" });
    const evt = event("checkout.session.completed", session);
    const [r1, r2] = await Promise.all([send(evt), send(evt)]);
    const bodies = [r1.body, r2.body].map((b) => (b.includes("duplicate") ? "duplicate" : b.includes("processed") ? "processed" : b.slice(0, 40)));
    check("deux 200, un processed et un duplicate", r1.status === 200 && r2.status === 200 && bodies.sort().join() === "duplicate,processed", bodies.join(" / "));
    check("une ligne purchases", (await count("select count(*) from purchases where user_id = $1", [a.userId])) === 1);
    check("une ligne plan_grants", (await count("select count(*) from plan_grants where project_id = $1", [a.projectId])) === 1);
  }

  section("4c · DEUX EVENTS DIFFÉRENTS POUR LA MÊME SESSION");
  {
    /* completed (pending) puis async_payment_succeeded : un paiement différé. */
    const a = await account("async");
    const session = { ...checkoutSession(a, { tier: "practice", mode: "payment" }), payment_status: "unpaid" };
    const r1 = await send(event("checkout.session.completed", session));
    const pending = await one<{ status: string }>("select status from purchases where stripe_checkout_session_id = $1", [session.id]);
    check("completed non payé → purchases pending, aucun droit", r1.status === 200 && pending?.status === "pending" && (await count("select count(*) from plan_grants where project_id = $1", [a.projectId])) === 0, JSON.stringify(pending));
    const r2 = await send(event("checkout.session.async_payment_succeeded", { ...session, payment_status: "paid" }));
    const paid = await one<{ status: string }>("select status from purchases where stripe_checkout_session_id = $1", [session.id]);
    check("async_payment_succeeded → paid, une allocation", r2.status === 200 && paid?.status === "paid" && (await count("select count(*) from plan_grants where project_id = $1", [a.projectId])) === 1, JSON.stringify(paid));
    const r3 = await send(event("checkout.session.async_payment_succeeded", { ...session, payment_status: "paid" }));
    const grants = await count("select count(*) from plan_grants where project_id = $1", [a.projectId]);
    check(
      "Stripe émet le même succès sous un SECOND id d'event → toujours UNE allocation",
      r3.status === 200 && grants === 1,
      `${grants} allocation(s)`
    );
    const credits = await one<{ directions_generated: number }>("select directions_generated from generation_credits where project_id = $1", [a.projectId]);
    lines.push(`  [async] directions_generated après les deux succès : ${credits?.directions_generated}`);
  }

  /* ─────────────────────────────────────────────────────────────────── */
  section("5 · LA SIGNATURE FORGÉE");
  {
    const forged = event("checkout.session.completed", checkoutSession(await account("forged"), { tier: "signature", mode: "payment" }));
    const res = await send(forged, { signature: "t=1,v1=deadbeef" });
    check("signature inventée → 400", res.status === 400, `${res.status}`);
    const wrongKey = signer.webhooks.generateTestHeaderString({ payload: JSON.stringify(forged), secret: "whsec_not_the_secret" });
    const res2 = await send(forged, { signature: wrongKey });
    check("signature bien formée, mauvais secret → 400", res2.status === 400, `${res2.status}`);
    const stale = signer.webhooks.generateTestHeaderString({ payload: JSON.stringify(forged), secret: WHSEC!, timestamp: now() - 3600 });
    const res3 = await send(forged, { signature: stale });
    check("bonne signature, horodatage d'il y a une heure → 400", res3.status === 400, `${res3.status}`);
    const tampered = JSON.stringify({ ...forged, id: forged.id + "x" });
    const sig = signer.webhooks.generateTestHeaderString({ payload: JSON.stringify(forged), secret: WHSEC! });
    const res4 = await fetch(ROUTE, { method: "POST", headers: { "stripe-signature": sig }, body: tampered });
    check("corps modifié après signature → 400", res4.status === 400, `${res4.status}`);
    check("aucune trace en base", (await count("select count(*) from stripe_events where stripe_event_id like $1", [forged.id + "%"])) === 0);
  }

  /* ─────────────────────────────────────────────────────────────────── */
  section("6 · LE DÉSORDRE QUI COÛTE — un abonnement annulé qui revient");
  {
    const a = await account("disorder");
    const id = `sub_${RUN}_disorder`;
    const t = now();
    await send(event("customer.subscription.created", subscription(a, { id, status: "active" }), t));
    /* Annulé, puis un `updated` ANTÉRIEUR arrive en retard (Stripe ne garantit pas l'ordre). */
    const r1 = await send(event("customer.subscription.deleted", subscription(a, { id, status: "canceled" }), t + 20));
    const r2 = await send(event("customer.subscription.updated", subscription(a, { id, status: "active" }), t + 10));
    const sub = await one<{ status: string; active: boolean }>("select status, active from subscriptions where user_id = $1", [a.userId]);
    check(
      "un updated plus ancien, arrivé après le deleted, ne rouvre pas l'abonnement",
      sub?.status === "canceled" && sub.active === false,
      `${r1.status}/${r2.status} → ${JSON.stringify(sub)}`
    );
  }
  {
    const a = await account("disorder2");
    const id = `sub_${RUN}_disorder2`;
    const t = now();
    /* L'ordre qu'on voit à chaque checkout : created (incomplete) et updated (active), même seconde, inversés. */
    await send(event("customer.subscription.updated", subscription(a, { id, status: "active" }), t + 1));
    await send(event("customer.subscription.created", subscription(a, { id, status: "incomplete" }), t));
    const sub = await one<{ status: string }>("select status from subscriptions where user_id = $1", [a.userId]);
    check("un created (incomplete) arrivé après l'updated (active) ne rétrograde pas", sub?.status === "active", JSON.stringify(sub));
  }

  /* ─────────────────────────────────────────────────────────────────── */
  section("7 · REMBOURSEMENT");
  {
    const { session } = bought.practice;
    const r = await send(
      event("charge.refunded", { id: `ch_${RUN}`, object: "charge", payment_intent: session.payment_intent, amount: 14900, amount_refunded: 14900 })
    );
    const p = await one<{ status: string }>("select status from purchases where stripe_checkout_session_id = $1", [session.id]);
    const last = await one<{ previous_status: string; new_status: string; event_type: string }>(
      "select pse.previous_status, pse.new_status, pse.event_type from purchase_status_events pse join purchases p on p.id = pse.purchase_id where p.stripe_checkout_session_id = $1 order by pse.occurred_at desc limit 1",
      [session.id]
    );
    check("charge.refunded → purchases refunded, trace paid→refunded", r.status === 200 && p?.status === "refunded" && last?.previous_status === "paid" && last.new_status === "refunded", `${JSON.stringify(p)} ${JSON.stringify(last)}`);
  }
  {
    /* Starter + Monthly Presence dans le même panier : checkout en mode subscription. */
    const a = await account("combo");
    const session = checkoutSession(a, { tier: "starter", mode: "subscription", subscription: `sub_${RUN}_combo` });
    await send(event("checkout.session.completed", session));
    const p = await one<{ status: string; stripe_payment_intent_id: string | null }>("select status, stripe_payment_intent_id from purchases where stripe_checkout_session_id = $1", [session.id]);
    lines.push(`  [combo] achat Starter+MP : ${JSON.stringify(p)}`);
    const r = await send(
      event("charge.refunded", { id: `ch_${RUN}_combo`, object: "charge", payment_intent: `pi_${RUN}_invoice`, amount: 11800, amount_refunded: 11800 })
    );
    const after = await one<{ status: string }>("select status from purchases where stripe_checkout_session_id = $1", [session.id]);
    /*
     * F62 : ce panier n'est plus vendu (`KIT_AND_MONTHLY_PRESENCE_IN_ONE_CHECKOUT`),
     * le serveur le refuse avant Stripe. La ligne reste pour dire ce que le webhook
     * ferait si on le rouvrait sans corriger `handleChargeRefunded`.
     */
    open(
      "Starter + Monthly Presence (panier FERMÉ par F62), remboursé → l'accès se ferme",
      after?.status === "refunded",
      `${r.body.slice(0, 90)} → ${JSON.stringify(after)}`
    );
  }

  await sql.end();
  console.log(`\n${failures === 0 ? "✓ AUCUN ÉCHEC" : `✗ ${failures} ÉCHEC(S)`} — exécution ${RUN}`);
  if (process.env.OUT) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.OUT, [`exécution ${RUN}`, ...lines, `\n${failures} échec(s)`].join("\n") + "\n");
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
