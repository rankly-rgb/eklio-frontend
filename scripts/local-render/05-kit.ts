/*
 * Le kit de marque, la direction, les préférences de contenu et le bilan —
 * par les routes du produit, dans une vraie session.
 *
 * ⚠ CETTE ÉTAPE N'AVAIT PAS DE SCRIPT, ET C'EST POUR ÇA QU'ELLE A COÛTÉ UNE
 * HEURE À CHAQUE PREUVE. `00-account.ts` s'arrêtait sur « Next: the kit,
 * through /api/briefs/[id]/generate », et la suite se faisait à la main. Or
 * `/api/briefs/[id]/generate` ne s'authentifie PAS par un jeton porteur : le
 * produit lit une session `@supabase/ssr` dans les cookies, et un `Bearer`
 * reçoit un 401 dont le message parle de brief introuvable — ce qui envoie
 * chercher le défaut à l'autre bout.
 *
 * On ouvre donc une vraie session, par l'écran de connexion, et les appels
 * partent du contexte de la page : mêmes cookies, mêmes gardes, même RLS.
 */
import { chromium, type BrowserContext } from "@playwright/test";
import { admin, MONTH } from "./lib";

const BASE = "http://127.0.0.1:3000";
const CHROMIUM = "/opt/pw-browsers/chromium";

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

/** Un appel JSON depuis la session ouverte. */
async function call(
  context: BrowserContext,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown
): Promise<{ status: number; json: unknown }> {
  const res = await context.request.fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = await res.text();
  }
  return { status: res.status(), json };
}

async function main() {
  const email = arg("email");
  if (!email) throw new Error("--email is required: this script never guesses which account to fill.");

  const db = admin();
  // ⚠ Ces trois tables sont dans `types/supabase.ts` : pas besoin de
  // `untypedTable`, qui n'existe que pour les tables absentes des types
  // générés et qui rendrait ces trois lectures silencieusement non vérifiées.
  const { data: user } = await db.from("profiles").select("id").eq("email", email).single();
  if (!user) throw new Error(`No profile for ${email}. Run 00-account.sql and 00-account.ts first.`);
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!project) throw new Error(`No project for ${email}.`);
  const projectId = project.id;

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "local-harness-only");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
  console.error(`▸ session      ${email}`);

  const gen = await call(context, "POST", `/api/briefs/${projectId}/generate`, {});
  console.error(`▸ kit          POST /api/briefs/${projectId}/generate → ${gen.status}`);
  if (gen.status >= 400) {
    console.error(JSON.stringify(gen.json).slice(0, 500));
    throw new Error("kit generation refused");
  }

  /*
   * ── ⚠ LE 200 VEUT DIRE « COMMENCÉ », PAS « FAIT » ─────────────────────
   *
   * La route lance `runGenerationPipeline` dans un `after()` : elle répond
   * 200 dès que le travail est PARTI. Lire le kit tout de suite renvoie donc
   * une ligne qui existe, qui a du contenu, et qui n'a aucune direction — ce
   * qui se présente plus loin comme « the kit carries no directions », à
   * trois scripts de distance de sa cause.
   *
   * Pire : c'est aussi la forme qu'a un kit dont le pipeline a ÉCHOUÉ. Sans
   * attente explicite, « pas encore » et « raté » sont le même état.
   */
  const deadline = Date.now() + 180_000;
  const kit = await (async () => {
    for (;;) {
      const { data } = await db
        .from("brand_kits")
        .select("id, directions, selected_direction_id")
        .eq("project_id", projectId)
        .single();
      const count = Array.isArray(data?.directions) ? data.directions.length : 0;
      if (data && count > 0) {
        console.error(`▸ brand kit    ${data.id} · ${count} directions`);
        return data;
      }
      if (Date.now() > deadline) {
        throw new Error(
          "the kit still has no directions after three minutes — check the dev server's log: " +
            "the pipeline runs server-side and needs ANTHROPIC_API_KEY in ITS environment, " +
            "not in this script's"
        );
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  })();

  /*
   * ── ⚠ UN KIT NE SUFFIT PAS À FAIRE UN COMPTE COMPLET ──────────────────
   *
   * `20-month.ts` refusait avec « the account is not complete », et le compte
   * avait pourtant son projet, son brief, ses segments et son kit. Ce qui
   * manquait, ce sont les TROIS CHOIX que la praticienne fait après le kit —
   * la direction visuelle, les préférences de contenu, le bilan du mois — et
   * ils n'étaient scriptés nulle part : chaque preuve les refaisait à la main,
   * donc chaque preuve partait d'un compte légèrement différent.
   *
   * Ils passent par leurs vraies routes, dans la même session.
   */
  const directions = (kit.directions ?? []) as Array<{ id: string; name?: string }>;
  if (directions.length === 0) throw new Error("the kit carries no directions to choose from");
  const chosen = kit.selected_direction_id ?? directions[0].id;
  const dir = await call(context, "POST", `/api/brand-kits/${kit.id}/direction`, {
    directionId: chosen,
  });
  console.error(`▸ direction    ${chosen} → ${dir.status}`);

  const prefs = await call(context, "POST", `/api/brand-kits/${kit.id}/content-preferences`, {
    cadence_per_week: 3,
    accepted_registers: [
      "named_feeling",
      "reflective_question",
      "how_the_work_works",
      "permission",
      "practical_note",
      "seasonal_note",
    ],
    off_limits: "No clinical claims, no client stories, no before-and-after.",
  });
  console.error(`▸ preferences  cadence 3/week, six registers → ${prefs.status}`);

  /*
   * ⚠ LE BILAN EST REMPLI, PAS LAISSÉ VIDE. Un bilan vide fait passer la
   * dérivation des thèmes par `derived_brief` — un chemin qui marche et qui
   * n'est pas celui qu'on veut prouver ici. Ce que ces réponses disent doit
   * ORIENTER le choix des sujets et ne jamais se retrouver recopié sur une
   * carte : c'est exactement ce que `checkinLeaks` vérifie au mois.
   */
  // ⚠ Le mois est dans la QUERY, pas dans le corps : la route le lit sur l'URL
  // et refuse « A month is required, as YYYY-MM-DD » sans lui.
  const checkin = await call(context, "POST", `/api/brand-kits/${kit.id}/check-in?month=${MONTH}`, {
    sessions_theme:
      "a lot of returning-to-work burnout this month — people who went back after leave and " +
      "found their body had not agreed to it, and who read that as failure",
    taking_clients: "yes",
    happening: "Evening slots opening in October",
  });
  console.error(`▸ check-in     filled → ${checkin.status}`);

  for (const [what, res] of [["direction", dir], ["preferences", prefs], ["check-in", checkin]] as const) {
    if (res.status >= 400) {
      console.error(JSON.stringify(res.json).slice(0, 300));
      throw new Error(`${what} refused`);
    }
  }

  await browser.close();
  console.log(`\n✓ account complete for ${email}. Next: 10-topic-bank.ts, then 20-month.ts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
