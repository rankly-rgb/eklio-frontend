import type Anthropic from "@anthropic-ai/sdk";
import { budgetErrors, words, type BudgetError } from "@/lib/compose/budget";
import { massCopyModel } from "@/lib/content/generate/copy-batch";

/*
 * ── RÉÉCRIRE LE CHAMP QUI DÉPASSE, ET RIEN D'AUTRE ──────────────────────
 *
 * Mesuré le 2026-09-21 : sur trente cartes, treize tombaient sur le budget de
 * mots, et CHAQUE dépassement était de un à trois mots. Relancer la carte
 * entière pour deux mots de trop, c'est repayer la légende, le texte alternatif
 * et le diagramme pour corriger un `gloss`.
 *
 * ⚠ ET CE N'EST PAS UNE RÉPARATION À LA MAIN. Couper les mots en trop nous-mêmes
 * produirait une phrase que personne n'a écrite ni relue — c'est la règle que
 * `validateCopy` énonce : « rejetée, jamais réparée ». Ici c'est le modèle qui
 * réécrit, avec la borne citée et le reste du payload intact.
 *
 * Deux passes au plus, puis le post est abandonné. Une troisième passe sur un
 * champ qui a déjà refusé deux fois ne dit pas que la borne est dure ; elle dit
 * qu'on n'a pas su la formuler.
 */

export const MAX_REPAIR_PASSES = 2;

export type RepairUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type RepairOutcome = {
  payload: unknown;
  ok: boolean;
  passes: number;
  /** Les chemins réellement réécrits, dans l'ordre. */
  rewritten: string[];
  /** Ce qui dépasse encore, quand on abandonne. */
  remaining: BudgetError[];
  usage: RepairUsage;
  calls: number;
};

/* ── Lire et écrire une valeur par son chemin ──────────────────────────── */

/**
 * ⚠ LE MÊME VOCABULAIRE DE CHEMIN QUE `budgetErrors`, qui écrit
 * `items[0].gloss` ou `cards[1].left[0].label`. Les deux doivent rester
 * d'accord : un chemin qu'on ne sait pas suivre est un champ qu'on croit avoir
 * réparé.
 */
function steps(path: string): Array<string | number> {
  const out: Array<string | number> = [];
  for (const part of path.split(".")) {
    const match = /^([^[]*)((?:\[\d+\])*)$/.exec(part);
    if (!match) return [];
    if (match[1]) out.push(match[1]);
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) out.push(Number(index[1]));
  }
  return out;
}

export function readPath(root: unknown, path: string): string | null {
  let node: unknown = root;
  for (const step of steps(path)) {
    if (node === null || node === undefined) return null;
    node = (node as Record<string | number, unknown>)[step];
  }
  return typeof node === "string" ? node : null;
}

/** Rend une COPIE. Le payload d'origine reste lisible pour le rapport. */
export function writePath(root: unknown, path: string, value: string): unknown {
  const copy = structuredClone(root);
  const walk = steps(path);
  if (walk.length === 0) return copy;
  let node: unknown = copy;
  for (const step of walk.slice(0, -1)) {
    if (node === null || node === undefined) return copy;
    node = (node as Record<string | number, unknown>)[step];
  }
  if (node && typeof node === "object") {
    (node as Record<string | number, unknown>)[walk[walk.length - 1]] = value;
  }
  return copy;
}

/* ── L'appel ───────────────────────────────────────────────────────────── */

const SYSTEM =
  "You shorten one phrase to fit a hard word limit on a therapy practice's " +
  "social card. Reply with the phrase alone: no quotes, no explanation, no " +
  "label, no punctuation you were not given. Keep the meaning and the plain " +
  "voice. Shorter than the limit is better than at the limit. Never add a " +
  "word to reach it.";

/*
 * ⚠ LA CONSIGNE MONTRE LE COMPTE PLUTÔT QUE DE LE DIRE. Mesuré le
 * 2026-09-21 : « rewrite it in 3 words or fewer » rendait encore quatre mots
 * une fois sur deux. Un exemple compté à côté de la demande fait la
 * différence, comme il l'a faite dans le préfixe du mois.
 */
function ask(path: string, text: string, allowed: number, said: number): string {
  const kind = path.endsWith("gloss") ? "gloss" : path.endsWith("label") ? "label" : "phrase";
  const example =
    kind === "label"
      ? `Examples of ${allowed}-word labels: "Sunday dread" (2), "Still bracing" (2), "Rest fails" (2).`
      : kind === "gloss"
        ? `Examples of ${allowed}-word glosses: "starts before the alarm" (4), "the body stays braced" (4).`
        : `Count every word, including "a", "the" and "of".`;

  return [
    `One field on a therapy post's card: "${path}".`,
    ``,
    `It currently says: ${text}`,
    `That is ${said} words. The limit is ${allowed}.`,
    ``,
    example,
    ``,
    `Rewrite it in ${allowed} words or fewer. Count your words before answering.`,
  ].join("\n");
}

export type RepairPort = (
  params: Anthropic.Messages.MessageCreateParamsNonStreaming
) => Promise<Anthropic.Message>;

export async function repairPayload(
  port: RepairPort,
  archetypeKey: string,
  payload: unknown,
  maxPasses: number = MAX_REPAIR_PASSES
): Promise<RepairOutcome> {
  const usage: RepairUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const rewritten: string[] = [];
  let current = payload;
  let passes = 0;
  let calls = 0;

  while (passes < maxPasses) {
    const errors = budgetErrors(archetypeKey, current);
    if (errors.length === 0) {
      return { payload: current, ok: true, passes, rewritten, remaining: [], usage, calls };
    }
    passes += 1;

    /*
     * ⚠ EN PARALLÈLE, ET CHACUN SUR SON SEUL CHAMP. Les champs d'un payload
     * ne se parlent pas : raccourcir un `gloss` ne change rien au `label` d'à
     * côté. Les séquencer n'achèterait qu'un délai.
     */
    const fixes = await Promise.all(
      errors.map(async (error) => {
        const text = readPath(current, error.path);
        if (text === null) return null;
        const message = await port({
          model: massCopyModel(),
          max_tokens: 80,
          system: SYSTEM,
          messages: [{ role: "user", content: ask(error.path, text, error.allowed, error.said) }],
        });
        usage.input += message.usage.input_tokens;
        usage.output += message.usage.output_tokens;
        usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
        usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
        /*
         * ⚠ LA PREMIÈRE LIGNE, ET SANS LE DÉCOMPTE QU'IL AJOUTE.
         *
         * Mesuré : à « rewrite it in 3 words or fewer. Count your words », le
         * modèle rend « Looks fine outside\n\n(3 words) ». La phrase est
         * juste — trois mots — et le décompte qu'il a écrit pour obéir à la
         * consigne la faisait recompter à cinq, donc refuser. Zéro libellé
         * réparé sur huit cas, pour ça.
         *
         * On lit sa réponse, on ne la répare pas : la première ligne EST la
         * phrase, et la parenthèse finale est un commentaire sur elle.
         */
        const reply = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim()
          .split("\n")[0]
          .trim()
          .replace(/\s*\((?:about\s*)?\d+\s*words?\)\s*$/i, "")
          .replace(/^["'`]|["'`]$/g, "")
          .trim();
        /*
         * ⚠ ON GARDE UNE RÉPONSE PLUS COURTE MÊME SI ELLE DÉPASSE ENCORE.
         *
         * La version d'avant jetait tout ce qui n'était pas conforme du
         * premier coup. Comme rien ne changeait, la boucle s'arrêtait après
         * une passe : la seconde passe n'existait que sur le papier. Mesuré :
         * un post réparé sur huit.
         *
         * Un progrès monotone rend les deux passes réelles — cinq mots
         * deviennent quatre, puis trois — et une réponse qui n'a rien
         * raccourci est toujours refusée, donc la boucle ne peut pas tourner
         * en rond.
         */
        if (!reply) return null;
        const got = words(reply);
        if (got > error.allowed && got >= error.said) return null;
        return { path: error.path, text: reply, fits: got <= error.allowed };
      })
    );
    calls += errors.length;

    let changed = false;
    for (const fix of fixes) {
      if (!fix) continue;
      current = writePath(current, fix.path, fix.text);
      rewritten.push(fix.path);
      changed = true;
    }
    /* Rien n'a bougé : une passe de plus dirait la même chose. */
    if (!changed) break;
  }

  const remaining = budgetErrors(archetypeKey, current);
  return { payload: current, ok: remaining.length === 0, passes, rewritten, remaining, usage, calls };
}
