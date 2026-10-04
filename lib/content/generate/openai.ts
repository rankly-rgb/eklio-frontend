import { MODEL_RATES, rateFor } from "@/lib/content/generate/copy-batch";
import {
  CACHED_INPUT_PER_MTOK,
  PRICE_SOURCE,
  openAiText,
  openAiUsage,
  priceRefusal,
  type CopyUsage,
  type TextModel,
} from "@/lib/content/generate/provider";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE TRANSPORT OPENAI — LE SEUL ENDROIT QUI PARLE À `api.openai.com`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `provider.ts` traduit sans jamais appeler. Ce module appelle, et c'est tout ce
 * qu'il fait : un `POST /v1/responses`, le classement de ce qui revient, le coût
 * de ce qui a été consommé, et le compteur qui refuse avant d'envoyer.
 *
 * ⚠ PAS DE SDK. `openai` n'est pas une dépendance du dépôt, et l'ajouter pour un
 * seul point d'entrée aurait été une seconde décision. Le corps est celui que
 * `openAiBody` construit, donc celui que les déclarations du SDK décrivent ;
 * `fetch` suffit à le porter.
 *
 * ⚠ LA CLEF EST UN PARAMÈTRE, JAMAIS UNE LECTURE D'ENVIRONNEMENT ICI. L'appelant
 * la passe ; ce module ne la nomme dans aucun message, aucune erreur, aucune
 * trace. Une erreur réseau de `fetch` ne contient pas l'en-tête, et une erreur
 * d'API est relue champ par champ plutôt que recopiée.
 */

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

/** Ce que `/v1/responses` rend, dans la mesure où on le lit. */
export type OpenAiResponse = {
  id?: string;
  status?: string;
  model?: string;
  output_text?: string | null;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> | null;
  usage?: Parameters<typeof openAiUsage>[0];
  incomplete_details?: { reason?: string } | null;
};

export type OpenAiTransport = (body: Record<string, unknown>) => Promise<OpenAiResponse>;

/**
 * Le fournisseur n'a pas répondu. ⚠ RIEN N'A ÉTÉ ÉCRIT, et rien ne doit être
 * compté comme un essai refusé (la leçon des 216 « schema » du 2026-09-24).
 */
export class ProviderUnavailable extends Error {
  constructor(
    /** Le mot de `failureFamily` : `no_credit`, `rate_limited`, `overloaded`, `errored`. */
    readonly reason: "no_credit" | "rate_limited" | "overloaded" | "errored",
    detail: string
  ) {
    super(`openai: ${reason} — ${detail}`);
    this.name = "ProviderUnavailable";
  }
}

/** La requête était fautive de NOTRE côté : un 400 ne se relance pas. */
export class ProviderRejected extends Error {
  constructor(readonly status: number, detail: string) {
    super(`openai: ${status} — ${detail}`);
    this.name = "ProviderRejected";
  }
}

/**
 * Le transport réel.
 *
 * ⚠ IL RELANCE CE QUI EST PASSAGER, ET SEULEMENT CELA. Une limite de débit ou un
 * 5xx se relancent trois fois avec un délai croissant ; un solde épuisé
 * (`insufficient_quota`) ne se relance jamais — il ne se rétablit pas en deux
 * secondes, et le relancer ferait croire à une panne passagère.
 */
export function openAiTransport(
  apiKey: string,
  options: { fetchImpl?: typeof fetch; retries?: number; delayMs?: (attempt: number) => number } = {}
): OpenAiTransport {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? 3;
  const delayMs = options.delayMs ?? ((attempt: number) => 1000 * 2 ** attempt);

  return async (body) => {
    let last: ProviderUnavailable | null = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response: Response;
      try {
        response = await fetchImpl(OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });
      } catch (error) {
        last = new ProviderUnavailable("errored", `réseau : ${(error as Error).name}`);
        await new Promise((r) => setTimeout(r, delayMs(attempt)));
        continue;
      }

      if (response.ok) return (await response.json()) as OpenAiResponse;

      const detail = await apiErrorDetail(response);
      if (response.status === 429 && detail.code === "insufficient_quota") {
        throw new ProviderUnavailable("no_credit", detail.text);
      }
      if (response.status === 429) {
        last = new ProviderUnavailable("rate_limited", detail.text);
      } else if (response.status >= 500) {
        last = new ProviderUnavailable("overloaded", `${response.status} ${detail.text}`);
      } else {
        throw new ProviderRejected(response.status, detail.text);
      }
      await new Promise((r) => setTimeout(r, delayMs(attempt)));
    }
    throw last ?? new ProviderUnavailable("errored", "aucune réponse");
  };
}

/**
 * Le code et le message d'une erreur d'API, et rien d'autre.
 *
 * ⚠ RELUS CHAMP PAR CHAMP. Recopier le corps d'erreur entier dans une exception
 * qui finit dans un journal, c'est laisser le fournisseur décider de ce qu'on
 * journalise.
 */
async function apiErrorDetail(response: Response): Promise<{ code: string | null; text: string }> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; type?: unknown; message?: unknown } };
    const code = typeof body.error?.code === "string" ? body.error.code : null;
    const message = typeof body.error?.message === "string" ? body.error.message.slice(0, 300) : "";
    return { code, text: [code ?? body.error?.type, message].filter(Boolean).join(" : ") };
  } catch {
    return { code: null, text: `HTTP ${response.status}` };
  }
}

/* ── Le coût ───────────────────────────────────────────────────────────── */

/**
 * Ce qu'un appel OpenAI a coûté, en dollars, depuis son `usage`.
 *
 * ── ⚠ `input_tokens` CONTIENT LE CACHE, ET C'EST TOUTE LA DIFFÉRENCE ─────
 *
 * Chez Anthropic, `input_tokens` est ce qui n'a été ni lu ni écrit en cache ; les
 * deux autres s'y AJOUTENT. Chez OpenAI, `cached_tokens` et `cache_write_tokens`
 * sont des sous-ensembles de `input_tokens` (`input_tokens_details`). La sonde du
 * 2026-10-04 le montre : 1 972 tokens d'entrée, dont 1 969 écrits au premier appel
 * puis 1 969 lus au second, et `input_tokens` vaut 1 972 les deux fois.
 *
 * Appliquer la formule d'Anthropic facturerait donc le préfixe deux fois. C'est
 * la classe de F27 — deux moitiés justes, la jonction fausse — et
 * `syncCostUsd` refuse désormais un modèle OpenAI pour que la jonction ne puisse
 * pas se faire par distraction.
 *
 * ── ⚠ LE CACHE EST FACTURÉ PLEIN, FAUTE DE TARIF LU ─────────────────────
 *
 * Le tarif de l'entrée mise en cache n'a pas été transmis avec les deux autres.
 * Tant qu'il ne l'est pas, un token lu en cache coûte ici un token d'entrée :
 * le chiffre rendu est une BORNE HAUTE, et `cacheDiscountApplied` le dit à
 * l'appelant pour qu'il le dise à son tour.
 *
 * ⚠ ET IL REFUSE UN MODÈLE DONT LE TARIF N'A PAS ÉTÉ LU. `rateFor` retombe sur le
 * tarif le plus cher connu, ce qui est juste pour un plafond et faux pour une
 * mesure : c'est `priceRefusal` qui parle alors, pas un chiffre.
 */
export function openAiCostUsd(model: string, usage: CopyUsage): number {
  const refusal = priceRefusal(model);
  if (refusal) throw new Error(refusal);
  const rate = MODEL_RATES[model];
  const cachedRate = CACHED_INPUT_PER_MTOK[model] ?? rate.inputPerMTok;
  const cached = Math.min(usage.cacheRead, usage.input);
  return (
    ((usage.input - cached) * rate.inputPerMTok + cached * cachedRate + usage.output * rate.outputPerMTok) / 1e6
  );
}

/** Vrai quand le coût rendu applique une remise de cache LUE, faux quand il la tait. */
export function cacheDiscountApplied(model: string): boolean {
  return model in CACHED_INPUT_PER_MTOK;
}

/**
 * Le pire coût possible d'un appel, AVANT de l'envoyer.
 *
 * ⚠ TROIS CARACTÈRES PAR TOKEN, PAS QUATRE. L'anglais courant en fait environ
 * quatre ; compter trois surestime l'entrée d'un tiers, et c'est le sens qu'on
 * veut pour une borne qui refuse. La sortie est bornée par `max_output_tokens`,
 * raisonnement compris — c'est le plafond que le fournisseur applique lui-même.
 *
 * ⚠ ET LE TARIF EST CELUI DE `rateFor`, donc le plus cher connu pour un modèle
 * non lu : prudent pour une borne, ce qui est exactement son usage ici.
 */
export function worstCaseCallUsd(model: string, body: Record<string, unknown>): number {
  const rate = rateFor(model);
  const chars =
    String(body.instructions ?? "").length +
    (typeof body.input === "string" ? body.input.length : JSON.stringify(body.input ?? "").length) +
    JSON.stringify((body.text as { format?: unknown } | undefined)?.format ?? "").length;
  const inputTokens = Math.ceil(chars / 3);
  const outputTokens = Number(body.max_output_tokens ?? 4000);
  return (inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok) / 1e6;
}

/* ── Le compteur ──────────────────────────────────────────────────────── */

/**
 * Le plafond de la session, tenu depuis les `usage` de chaque réponse.
 *
 * ── ⚠ IL EXISTE PARCE QUE PERSONNE D'AUTRE NE LE TIENDRAIT ──────────────
 *
 * La clef ne lit pas l'usage côté fournisseur (`api.usage.read` manque, F69) :
 * aucun tableau de bord, aucune alerte ne dira que la dépense approche du plafond.
 * Le seul compte est celui-ci, fait réponse par réponse.
 *
 * ⚠ IL REFUSE AVANT D'ENVOYER, COMME LE PLAFOND DE F58. Chaque appel RÉSERVE son
 * pire coût ; il n'est envoyé que si le déjà-dépensé, plus ce qui est en vol, plus
 * cette réserve, tient sous le plafond. À la réponse, la réserve est remplacée par
 * le coût réel. Des appels concurrents ne peuvent donc pas franchir le plafond à
 * eux tous en le respectant chacun.
 */
export class SpendCapReached extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "SpendCapReached";
  }
}

export type SpendMeter = {
  readonly capUsd: number;
  spentUsd(): number;
  /** Les appels envoyés, réponses reçues ou non. */
  calls(): number;
  /** Les tokens consommés, pour que le rapport les montre à côté des dollars. */
  usage(): CopyUsage;
  reserve(worstUsd: number, label: string): () => void;
  settle(release: () => void, actualUsd: number, usage: CopyUsage): void;
};

export function spendMeter(capUsd: number, alreadySpentUsd = 0): SpendMeter {
  let spent = alreadySpentUsd;
  let inFlight = 0;
  let calls = 0;
  const total: CopyUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  return {
    capUsd,
    spentUsd: () => spent,
    calls: () => calls,
    usage: () => ({ ...total }),
    reserve(worstUsd, label) {
      if (spent + inFlight + worstUsd > capUsd) {
        throw new SpendCapReached(
          `plafond de session : ${spent.toFixed(4)} $ dépensés + ${inFlight.toFixed(4)} $ en vol + ` +
            `${worstUsd.toFixed(4)} $ au pire pour « ${label} » franchiraient ${capUsd.toFixed(2)} $. ` +
            `Appel non envoyé.`
        );
      }
      inFlight += worstUsd;
      calls += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        inFlight -= worstUsd;
      };
    },
    settle(release, actualUsd, usage) {
      release();
      spent += actualUsd;
      total.input += usage.input;
      total.output += usage.output;
      total.cacheRead += usage.cacheRead;
      total.cacheWrite += usage.cacheWrite;
    },
  };
}

/**
 * Un appel, compté. Le seul chemin par lequel ce dépôt dépense chez OpenAI.
 *
 * ⚠ UN APPEL QUI ÉCHOUE APRÈS ENVOI EST COMPTÉ À SON PIRE COÛT. Une coupure
 * réseau après que la requête est partie peut avoir été facturée ; sans `usage`,
 * on ne sait pas combien, et compter zéro serait la seule erreur qui laisse le
 * plafond se franchir en silence. Un refus franc du fournisseur (4xx, solde
 * épuisé) n'est, lui, pas facturé.
 */
export async function meteredCall(
  transport: OpenAiTransport,
  meter: SpendMeter,
  model: string,
  body: Record<string, unknown>,
  label: string
): Promise<{ response: OpenAiResponse; usage: CopyUsage; costUsd: number }> {
  const worst = worstCaseCallUsd(model, body);
  const release = meter.reserve(worst, label);
  let response: OpenAiResponse;
  try {
    response = await transport(body);
  } catch (error) {
    const refusedBeforeWork = error instanceof ProviderRejected ||
      (error instanceof ProviderUnavailable && error.reason !== "errored");
    meter.settle(release, refusedBeforeWork ? 0 : worst, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    throw error;
  }
  const usage = openAiUsage(response.usage);
  const costUsd = openAiCostUsd(model, usage);
  meter.settle(release, costUsd, usage);
  return { response, usage, costUsd };
}

/** Le refus du modèle en sortie stricte, quand il refuse plutôt que d'écrire. */
export function openAiRefusal(response: OpenAiResponse): string | null {
  for (const block of response.output ?? []) {
    for (const c of block.content ?? []) {
      if (c?.type === "refusal") return c.refusal ?? "refus";
    }
  }
  return null;
}

/**
 * Le port de texte court, sur OpenAI : le juge, la révision, la réparation.
 *
 * ⚠ SANS SCHÉMA DE SORTIE. Le juge rend un objet dont les CLEFS sont les lignes
 * jugées, ce qu'un schéma strict ne peut pas déclarer ; la révision rend des
 * payloads de onze formes, déjà validés un par un par `validateCopy`. Les deux
 * relisent du JSON et ne lèvent jamais sur un JSON illisible — c'est leur
 * contrat d'avant, et il ne change pas avec le fournisseur.
 */
export function openAiTextModel(
  transport: OpenAiTransport,
  meter: SpendMeter,
  model: string,
  label = "texte"
): TextModel {
  return {
    async ask({ system, user, maxTokens, effort }) {
      const { response, usage, costUsd } = await meteredCall(
        transport,
        meter,
        model,
        {
          model,
          instructions: system,
          input: user,
          max_output_tokens: maxTokens,
          ...(effort ? { reasoning: { effort } } : {}),
          store: false,
        },
        label
      );
      return { text: openAiText(response), usage, costUsd };
    },
  };
}

export { PRICE_SOURCE };
