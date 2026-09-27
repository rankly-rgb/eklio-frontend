/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES VARIABLES VERCEL — VÉRIFIÉES PAR UN SCRIPT, PAS PAR UN REGARD
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   vercel env pull --environment=production /tmp/eklio.production.env
 *   vercel env pull --environment=preview    /tmp/eklio.preview.env
 *   npx tsx scripts/production-path/vercel-env-check.ts production /tmp/eklio.production.env --phase=1
 *   npx tsx scripts/production-path/vercel-env-check.ts preview    /tmp/eklio.preview.env --prod=/tmp/eklio.production.env
 *   rm /tmp/eklio.*.env      # ⚠ ces fichiers portent les secrets en clair
 *
 * ⚠ AUCUNE VALEUR N'EST IMPRIMÉE, pas même tronquée. Le script dit « présente »,
 * « absente », « forme attendue sk_live_… » — jamais ce qu'elle contient.
 *
 * Ce qu'il tient, et que l'œil rate (B2) :
 *   · une portée trop LARGE ne donne aucune erreur, elle marche : le mode
 *     `preview` échoue si un secret de production y est ;
 *   · une clé de TEST en production marche aussi — jusqu'au premier paiement
 *     réel, qui n'arrive jamais : `sk_test_` en production est un échec ;
 *   · une variable posée TROP TÔT : `--phase=1` exige qu'`ANTHROPIC_API_KEY`
 *     soit absente, et `CONTENT_GENERATION_ARMED` l'est toujours (F58, route 501).
 *
 * La liste vient du code, relevée le 2026-09-27 (`grep process.env`, `requireEnv`,
 * `priceEnvVar`) : voir `docs/production/B2-les-secrets.md` §« La liste complète ».
 */
import { readFileSync } from "node:fs";

type Rule = {
  name: string;
  /** production : doit être là (avec cette forme) ; absent : ne doit pas y être. */
  production: "required" | "absent" | "optional";
  preview: "required" | "absent" | "optional";
  shape?: RegExp;
  shapeLabel?: string;
  /** En preview, la forme exigée si elle est posée (une clé de TEST). */
  previewShape?: RegExp;
  /** Absente en phase 1 (avant la mise sous tension de la génération). */
  phase2Only?: boolean;
};

const RULES: Rule[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", production: "required", preview: "optional", shape: /^https:\/\/[a-z0-9]{20}\.supabase\.co$/, shapeLabel: "https://<ref>.supabase.co" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", production: "required", preview: "optional", shape: /^(eyJ|sb_publishable_)/, shapeLabel: "eyJ… ou sb_publishable_…" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", production: "required", preview: "absent", shape: /^(eyJ|sb_secret_)/, shapeLabel: "eyJ… ou sb_secret_…" },
  { name: "NEXT_PUBLIC_SITE_URL", production: "required", preview: "absent", shape: /^https:\/\/[^/]+[^/]$/, shapeLabel: "https://<domaine>, sans / final" },
  { name: "STRIPE_SECRET_KEY", production: "required", preview: "optional", shape: /^(sk|rk)_live_/, shapeLabel: "sk_live_… (une clé de test en production ne lève rien)", previewShape: /^(sk|rk)_test_/ },
  { name: "STRIPE_WEBHOOK_SECRET", production: "required", preview: "absent", shape: /^whsec_/, shapeLabel: "whsec_… de l'endpoint de PRODUCTION" },
  { name: "STRIPE_PRICE_STARTER", production: "required", preview: "absent", shape: /^price_/, shapeLabel: "price_…" },
  { name: "STRIPE_PRICE_PRACTICE", production: "required", preview: "absent", shape: /^price_/, shapeLabel: "price_…" },
  { name: "STRIPE_PRICE_SIGNATURE", production: "required", preview: "absent", shape: /^price_/, shapeLabel: "price_…" },
  { name: "STRIPE_PRICE_MONTHLY_PRESENCE", production: "required", preview: "absent", shape: /^price_/, shapeLabel: "price_…" },
  { name: "CRON_SECRET", production: "required", preview: "absent", shape: /^.{32,}$/, shapeLabel: "32 caractères au moins" },
  { name: "RESEND_API_KEY", production: "required", preview: "absent", shape: /^re_/, shapeLabel: "re_…" },
  { name: "EMAIL_FROM", production: "required", preview: "optional", shape: /<[^@>]+@[^>]+>$|^[^@\s]+@[^@\s]+$/, shapeLabel: "Eklio <hello@<domaine vérifié chez Resend>>" },
  { name: "ANTHROPIC_API_KEY", production: "required", preview: "absent", shape: /^sk-ant-/, shapeLabel: "sk-ant-…", phase2Only: true },
  /* ── ce qui ne doit être nulle part aujourd'hui ─────────────────────── */
  { name: "CONTENT_GENERATION_ARMED", production: "absent", preview: "absent" },
  { name: "OPENAI_API_KEY", production: "absent", preview: "absent" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", production: "optional", preview: "optional" },
  /* Prix de catalogue mort (`lib/billing/offer.ts`, que rien n'importe) : les poser égare. */
  { name: "STRIPE_PRICE_FOUNDATION", production: "absent", preview: "absent" },
  { name: "STRIPE_PRICE_ROSTER", production: "absent", preview: "absent" },
];

function parseDotenv(text: string): Map<string, string> {
  const env = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env.set(line.slice(0, eq).trim(), value);
  }
  return env;
}

export function checkEnv(
  target: "production" | "preview",
  env: Map<string, string>,
  phase: 1 | 2,
  production?: Map<string, string>
): string[] {
  const problems: string[] = [];
  /*
   * ⚠ UNE PREVIEW SUR LA BASE DE PRODUCTION. Les variables publiques de Supabase
   * y sont permises — une preview sans base ne sert aucune page — mais PAS avec
   * les valeurs de production : chaque branche poussée ouvrirait alors une URL
   * publique d'inscription sur la vraie base.
   */
  if (target === "preview" && production) {
    for (const [name, value] of env) {
      if (value && name !== "EMAIL_FROM" && production.get(name) === value) {
        problems.push(`${name} : la MÊME valeur qu'en production`);
      }
    }
  }
  for (const rule of RULES) {
    const want = rule[target];
    const value = env.get(rule.name) ?? "";
    const present = value !== "";
    if (want === "required" && rule.phase2Only && phase === 1) {
      if (present) problems.push(`${rule.name} : posée TROP TÔT — elle vient en dernier, après F58 et la sortie du 501 (B2)`);
      continue;
    }
    if (want === "required" && !present) problems.push(`${rule.name} : absente`);
    if (want === "absent" && present) {
      problems.push(
        target === "preview"
          ? `${rule.name} : présente en PREVIEW — une portée trop large ne donne aucune erreur, elle marche`
          : `${rule.name} : présente en production, et ne doit pas l'être`
      );
    }
    if (target === "preview" && present && rule.previewShape) {
      if (!rule.previewShape.test(value)) problems.push(`${rule.name} : en preview, seulement une clé de TEST`);
      continue;
    }
    if (target === "preview" && present && rule.name.startsWith("NEXT_PUBLIC_SUPABASE")) continue;
    if (present && rule.shape && want !== "absent" && !rule.shape.test(value)) {
      problems.push(`${rule.name} : forme inattendue, attendu ${rule.shapeLabel}`);
    }
  }
  /* Une clé de test en production, par une autre porte : le prix. */
  if (target === "production" && /^sk_test_/.test(env.get("STRIPE_SECRET_KEY") ?? "")) {
    problems.push("STRIPE_SECRET_KEY : clé de TEST en production — les prix `price_…` de test la suivront");
  }
  return problems;
}

if (process.argv[1]?.endsWith("vercel-env-check.ts")) {
  const target = process.argv[2];
  const file = process.argv[3];
  const phase = process.argv.includes("--phase=2") ? 2 : 1;
  const prodArg = process.argv.find((a) => a.startsWith("--prod="));
  const production = prodArg ? parseDotenv(readFileSync(prodArg.slice(7), "utf8")) : undefined;
  if ((target !== "production" && target !== "preview") || !file) {
    console.error("usage : vercel-env-check.ts <production|preview> <fichier .env> [--phase=1|2]");
    process.exit(2);
  }
  if (target === "preview" && !production) {
    console.error("⚠ preview sans --prod=<fichier production> : la comparaison des valeurs n'est pas faite.");
  }
  const problems = checkEnv(target, parseDotenv(readFileSync(file, "utf8")), phase, production);
  const checked = RULES.length;
  if (problems.length === 0) {
    console.log(`✓ ${target}, phase ${phase} : ${checked} règles tenues. Aucune valeur n'a été imprimée.`);
    process.exit(0);
  }
  console.log(`✗ ${target}, phase ${phase} : ${problems.length} problème(s) sur ${checked} règles\n  ` + problems.join("\n  "));
  process.exit(1);
}
