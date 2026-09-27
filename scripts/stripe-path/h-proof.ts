/*
 * L'épreuve de docs/production/H-achat-controle.sql : un achat Starter puis son
 * remboursement, par la vraie route et la vraie signature, sur la base locale ;
 * la requête H est lue après chaque étape.
 *
 *   WHSEC=… npx tsx scripts/stripe-path/h-proof.ts
 *
 * Attendu : après l'achat, contrôles 1 à 5 OK et 6-7 PAS OK ; après le
 * remboursement, 7/7 OK. Sinon la requête ment, dans un sens ou dans l'autre.
 */
import Stripe from "stripe";
import pg from "pg";
import { readFileSync } from "node:fs";

const ROUTE = process.env.ROUTE ?? "http://localhost:3000/api/stripe/webhook";
const WHSEC = process.env.WHSEC!;
const sql = new pg.Client({ host: "127.0.0.1", user: "stripe_path", password: "eklio_local", database: process.env.DB ?? "eklio_local_verify" });
const signer = new Stripe("sk_test_signing_only");
const run = `h${Date.now().toString(36)}`;
const email = `${run}@eklio-test.invalid`;

async function send(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${run}_${type}`, object: "event", created: Math.floor(Date.now() / 1000), type, data: { object } });
  const res = await fetch(ROUTE, {
    method: "POST",
    headers: { "stripe-signature": signer.webhooks.generateTestHeaderString({ payload, secret: WHSEC }) },
    body: payload,
  });
  if (res.status !== 200) throw new Error(`${type} → ${res.status} ${await res.text()}`);
}

async function h(): Promise<Array<{ statut: string; "contrôle": string; "détail": string }>> {
  const q = readFileSync("docs/production/H-achat-controle.sql", "utf8").replace("ADRESSE@DU.COMPTE.DE.TEST", email);
  return (await sql.query(q)).rows;
}

async function main() {
  await sql.connect();
  const user = (await sql.query("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id;
  const project = (await sql.query("insert into public.projects (user_id, name) values ($1, 'h') returning id", [user])).rows[0].id;
  await sql.query("insert into public.brand_kits (project_id) values ($1)", [project]);
  const pi = `pi_${run}`;
  await send("checkout.session.completed", {
    id: `cs_${run}`, object: "checkout.session", mode: "payment", customer: `cus_${run}`, client_reference_id: user,
    metadata: { eklio_user_id: user, eklio_project_id: project, eklio_tier: "starter" },
    payment_status: "paid", status: "complete", currency: "usd", payment_intent: pi, subscription: null,
  });
  const afterBuy = await h();
  afterBuy.forEach((r) => console.log(`achat   ${r.statut.padEnd(6)} ${r["contrôle"]} — ${r["détail"]}`));
  await send("charge.refunded", { id: `ch_${run}`, object: "charge", payment_intent: pi, amount: 7900, amount_refunded: 7900 });
  const afterRefund = await h();
  afterRefund.forEach((r) => console.log(`rembt   ${r.statut.padEnd(6)} ${r["contrôle"]} — ${r["détail"]}`));
  const okBuy = afterBuy.map((r) => r.statut === "OK");
  const expectBuy = [true, true, true, true, true, false, false];
  const good = JSON.stringify(okBuy) === JSON.stringify(expectBuy) && afterRefund.every((r) => r.statut === "OK");
  console.log(good ? "\n✓ H dit vrai dans les deux états" : "\n✗ H ne dit pas ce qui s'est passé");
  await sql.end();
  process.exit(good ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
