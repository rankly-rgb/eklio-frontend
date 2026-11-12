/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PLAFOND DE SESSION DU HARNAIS SEO — LU DANS `credit_ledger`, TENU À L'APPEL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ HARNAIS, PAS DU PRODUIT.
 *
 * La dépense d'une session est la somme des RÈGLEMENTS SEO du livre
 * (`credit_ledger`, raison « settled: seo_piece_write ») écrits DEPUIS son début
 * (`--since`, ou la variable `SEO_SESSION_SINCE`) — le journal de coûts du
 * produit, pas un compteur du harnais.
 *
 * ⚠ POURQUOI UN GARDE SUR `fetch`. Un déclenchement de la route sert TOUTES les
 * abonnées dues, chacune avec son propre plafond (1,50 $) : vérifier « dépensé +
 * un plafond » avant de lancer ne borne rien quand cinq abonnées passent. Le garde
 * intercepte CHAQUE appel à api.openai.com, relit le livre, et refuse l'appel qui
 * franchirait l'arrêt. Le transport du produit voit une panne réseau : il rend
 * l'emplacement et s'arrête proprement (`WriterStopped`), sans quarantaine.
 */

export const SESSION_STOP_USD = 2.5;
/** Le pire coût d'un appel SEO (`worstCaseCallUsd`, ≈ 0,15 $), arrondi au-dessus. */
const WORST_CALL_USD = 0.2;
export const LOCAL = "http://127.0.0.1:54321";

/*
 * ⚠ LA SEULE PORTE VERS LA PRODUCTION, ET ELLE SE DIT DEUX FOIS.
 *
 * Par défaut, tout ce harnais parle à la façade LOCALE. Pour l'étape 7 du runbook
 * (SEO_PAGES_ARMING.md : un premier mois sur le compte de contrôle, à la main),
 * `run-user-month.ts` accepte `--production-url https://<ref>.supabase.co` ET le
 * drapeau `--i-write-production`. L'un sans l'autre : refus. La clé est celle que
 * la personne qui lance la commande pose dans son propre shell ; ce dépôt n'en
 * porte aucune.
 */
export function supabaseBase(): string {
  const url = arg("--production-url");
  const confirmed = process.argv.includes("--i-write-production");
  if (!url && !confirmed) return LOCAL;
  if (!url || !confirmed) throw new Error("--production-url et --i-write-production vont ensemble ; rien n'a été appelé");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) throw new Error(`URL de production inattendue : ${url}`);
  return url;
}

export function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

export function sessionSince(): string {
  const since = arg("--since") ?? process.env.SEO_SESSION_SINCE;
  if (!since) throw new Error("--since <horodatage ISO du début de session> manquant");
  return since;
}

export async function spentSince(since: string, nativeFetch: typeof fetch = fetch): Promise<{ usd: number; calls: number }> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const url =
    `${supabaseBase()}/rest/v1/credit_ledger?select=actual_cost_usd` +
    `&reason=eq.settled:%20seo_piece_write&entry_type=eq.settlement&created_at=gte.${encodeURIComponent(since)}`;
  const res = await nativeFetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`credit_ledger: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ actual_cost_usd: number | null }>;
  return { usd: rows.reduce((s, r) => s + Number(r.actual_cost_usd ?? 0), 0), calls: rows.length };
}

/** Prépare l'environnement local, vérifie l'arrêt, et pose le garde sur chaque appel OpenAI. */
export async function prepareSession(): Promise<{ since: string; before: number }> {
  if (!process.argv.includes("--confirm")) throw new Error("--confirm manquant : ce script dépense de l'argent réel");
  if (!process.env.EKLIO_OPENAI_API_KEY) throw new Error("EKLIO_OPENAI_API_KEY absente — rien n'a été appelé");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY (façade locale) absente");
  const since = sessionSince();
  const before = (await spentSince(since)).usd;
  if (before + WORST_CALL_USD > SESSION_STOP_USD) {
    throw new Error(`arrêt de session : ${before.toFixed(4)} $ depuis ${since} — plus de place pour un appel`);
  }

  const native = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://api.openai.com/")) {
      const spent = (await spentSince(since, native)).usd;
      if (spent + WORST_CALL_USD > SESSION_STOP_USD) {
        throw new TypeError(`arrêt de session : ${spent.toFixed(4)} $ + ${WORST_CALL_USD} $ au pire > ${SESSION_STOP_USD} $`);
      }
    }
    return native(input, init);
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseBase();
  process.env.OPENAI_API_KEY = process.env.EKLIO_OPENAI_API_KEY;
  return { since, before };
}
