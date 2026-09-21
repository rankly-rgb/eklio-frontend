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
import { admin } from "./lib";

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

  const { data: kit } = await db.from("brand_kits").select("id").eq("project_id", projectId).single();
  console.error(`▸ brand kit    ${kit?.id ?? "—"}`);

  await browser.close();
  console.log(`\n✓ kit ready for ${email}. Next: 10-topic-bank.ts, then 20-month.ts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
