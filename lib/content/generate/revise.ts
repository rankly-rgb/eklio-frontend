import type Anthropic from "@anthropic-ai/sdk";
import {
  massCopyModel, copyEffort, validateCopy, CARD_LINE_MAX, type CopyResult,
} from "@/lib/content/generate/copy-batch";
import { repeatedAcross } from "@/lib/content/month-checks";

/*
 * ── LA PASSE DE RÉVISION ────────────────────────────────────────────────
 *
 * ⚠ ELLE NE JUGE PAS LA CONFORMITÉ. Vingt-trois contrôles le font déjà, et
 * ils le font mieux : ils comptent des caractères, des mots, des archétypes.
 * Ce qu'ils ne savent pas faire, c'est dire qu'une phrase ne veut rien dire.
 *
 * La notation indépendante met l'écriture à 1,6 sur 5 et nomme ce qu'aucun
 * contrôle ne voit :
 *
 *   « Looking stable. Burning »   complète pour le juge, vide pour un lecteur
 *   « Competence can trap »       verbe transitif sans objet, jugé complet
 *   « Body says no » × 7          le même libellé sur sept cartes du mois
 *   trois posts sur la même idée  titres différents, phrase identique
 *
 * Les trois derniers ont un point commun : ils ne se voient QUE sur le mois
 * entier. Un contrôle par post ne peut pas les trouver, et c'est pour ça
 * qu'elle relit les trente ensemble.
 *
 * ── ⚠ ET ELLE DOIT POUVOIR ÊTRE ÉTEINTE ────────────────────────────────
 *
 * `CONTENT_REVISION=off`. Sans ça, son effet se confond avec celui de Sonnet
 * et celui des exemples, et « trois changements ont fait monter la note » ne
 * dit pas lequel a payé. Si elle n'apporte rien, elle se retire.
 */

export function revisionOn(): boolean {
  return process.env.CONTENT_REVISION !== "off";
}

const PROMPT = [
  `You are rereading a month of social posts for one psychotherapist before`,
  `anyone sees them. Thirty posts, written separately, read together for the`,
  `first time.`,
  ``,
  `⚠ YOU ARE NOT CHECKING COMPLIANCE. Character counts, word budgets, ethics`,
  `and shape are checked by code, exactly, and your opinion on them is noise.`,
  `Change only what code cannot see.`,
  ``,
  `REWRITE A POST WHEN:`,
  `- a line is grammatical but says nothing: "Looking stable. Burning",`,
  `  "Competence can trap", "Exhaustion that reads" — a reader finishes it and`,
  `  has been told nothing;`,
  `- a line stops before its meaning: a transitive verb with no object, a`,
  `  comparison with nothing compared;`,
  `- a string listed under REPEATED BELOW appears on more than one post. ⚠ THAT`,
  `  LIST IS COMPUTED, NOT GUESSED: each entry is a label or gloss that really`,
  `  does sit on two or more different cards of this month. Rewrite all but one`,
  `  occurrence of each. One month had "Body says no" on seven cards;`,
  `- two posts serve the same idea under different titles: one month had three`,
  `  posts built on "X is not failure, it's information";`,
  `- a title is empty of its post: it could sit on any of the thirty.`,
  ``,
  `LEAVE A POST ALONE OTHERWISE. A month where you rewrite everything is a`,
  `month written by you, and you have read it once. Most posts are fine.`,
  ``,
  `WHEN YOU REWRITE, keep the post's shape exactly — same fields, same number`,
  `of items, same archetype. Keep "card_line" at most ${CARD_LINE_MAX} characters,`,
  `counted. Keep every label and gloss inside the word budget it already`,
  `respects: if the original label is three words, yours is at most three.`,
  `Change words, never structure.`,
  ``,
  `Reply with ONE JSON object and nothing else:`,
  `{"revisions": [{"index": 3, "why": "…", "card_line": "…", "payload": {…}}]}`,
  ``,
  `"index" is the post's number as given. "why" is at most eight words, for a`,
  `human reading the log. Include ONLY the posts you changed; an empty list is`,
  `a valid and common answer.`,
].join("\n");

export type Revisable = {
  archetype: string;
  cardLine: string;
  payload: unknown;
  /**
   * La légende et l'alternatif, tels qu'ils ont été écrits.
   *
   * ⚠ ILS NE SONT PAS RÉVISÉS, ILS SONT REPASSÉS. `validateCopy` valide
   * l'objet ENTIER — elle refuse « missing_fields » si la légende manque — et
   * une révision qui les omettrait ferait donc écarter chacune de ses
   * réécritures, en silence, pour une raison qui n'a rien à voir avec elles.
   *
   * La légende est ce que la praticienne publie sous l'image : elle se tient
   * seule, et la réécrire serait une autre décision que celle-ci.
   */
  caption: string;
  altText: string;
};

export type Revision = {
  index: number;
  why: string;
  cardLine: string;
  payload: unknown;
};

export type RevisionOutcome = {
  revisions: Revision[];
  /** Ce que la passe a proposé et qui n'a pas tenu la validation. */
  refused: Array<{ index: number; why: string; because: string }>;
  usage: { input: number; output: number };
};

/**
 * Relit le mois, et rend les seules réécritures qui tiennent.
 *
 * ⚠ ELLE NE LÈVE JAMAIS, comme le juge de complétude : une panne de la passe
 * ne doit pas faire tomber un mois. Un mois non révisé est un mois que les
 * contrôles jugeront comme avant.
 *
 * ⚠ ET CHAQUE RÉÉCRITURE REPASSE `validateCopy`. Une passe qui rendrait un
 * payload d'une autre forme, ou une ligne de trente-cinq caractères, ferait
 * refuser un post qui passait — elle aurait dégradé le mois en croyant
 * l'améliorer. Ce qui ne valide pas est ÉCARTÉ, et l'original est gardé.
 */
export async function reviseMonth(
  client: Pick<Anthropic, "messages">,
  posts: Revisable[]
): Promise<RevisionOutcome> {
  const empty: RevisionOutcome = { revisions: [], refused: [], usage: { input: 0, output: 0 } };
  if (posts.length === 0 || !revisionOn()) return empty;

  const listing = posts
    .map((p, i) => `#${i} (${p.archetype})\n${JSON.stringify({ card_line: p.cardLine, payload: p.payload })}`)
    .join("\n\n");

  /*
   * ── ⚠ CE QUI SE COMPTE SE COMPTE ───────────────────────────────────────
   *
   * Les deux notations indépendantes de F34 désignent la répétition d'une
   * carte à l'autre comme le premier défaut d'écriture du mois, et la passe
   * n'en attrapait que deux à cinq. Lui demander de REPÉRER les répétitions
   * est un problème de recherche sur quarante payloads ; lui donner la liste
   * exacte est un problème de réécriture.
   *
   * ⚠ ET ON NE LUI DEMANDE PAS DE TOUT RÉÉCRIRE : une occurrence reste. Ce
   * qu'on veut n'est pas que la phrase disparaisse, c'est qu'elle ne revienne
   * pas.
   */
  const repeats = repeatedAcross(
    posts.map((p) => ({ archetype: p.archetype, title: "", cardLine: p.cardLine, payload: p.payload }))
  );
  const repeated = repeats.length === 0
    ? ["", "REPEATED: nothing repeats across posts this month. Leave them alone."]
    : [
        "",
        `REPEATED — ${repeats.length} string(s) sit on more than one card of this month.`,
        `Keep ONE occurrence of each and rewrite the others:`,
        ...repeats.slice(0, 30).map((r) => `  "${r.text}" — on posts ${r.posts.map((n) => `#${n}`).join(", ")}`),
      ];

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: massCopyModel(),
      max_tokens: Math.min(16000, 2000 + posts.length * 200),
      output_config: { effort: copyEffort() },
      system: PROMPT,
      messages: [{ role: "user", content: [listing, ...repeated].join("\n") }],
    });
  } catch {
    return empty;
  }

  const usage = { input: message.usage.input_tokens, output: message.usage.output_tokens };
  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: { revisions?: unknown };
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, ""));
  } catch {
    return { ...empty, usage };
  }
  if (!Array.isArray(parsed.revisions)) return { ...empty, usage };

  const revisions: Revision[] = [];
  const refused: RevisionOutcome["refused"] = [];

  for (const entry of parsed.revisions as Array<Record<string, unknown>>) {
    const index = typeof entry.index === "number" ? entry.index : -1;
    const why = typeof entry.why === "string" ? entry.why : "";
    const post = posts[index];
    if (!post) {
      refused.push({ index, why, because: "aucun post à cet index" });
      continue;
    }
    const cardLine = typeof entry.card_line === "string" ? entry.card_line.trim() : post.cardLine;

    /*
     * ⚠ UNE RÉÉCRITURE TROP LONGUE EST ÉCARTÉE, PAS ROGNÉE. `clampCardLine`
     * coupe ce que le modèle écrit trop long, et c'est le bon comportement à
     * l'ÉCRITURE : mieux vaut une ligne coupée à une frontière de proposition
     * que rien. Ici, non — l'original tenait entier, et la passe est censée
     * l'améliorer. Rogner sa proposition, c'est remplacer une phrase finie par
     * une phrase coupée en croyant faire mieux.
     */
    if (cardLine.length > CARD_LINE_MAX) {
      refused.push({ index, why, because: `${cardLine.length} caractères (${CARD_LINE_MAX} au plus)` });
      continue;
    }

    /*
     * ⚠ LA MÊME VALIDATION QUE L'ÉCRITURE, PAS UNE VÉRIFICATION AU RABAIS.
     * Une réécriture est une réponse de modèle comme une autre : elle passe
     * par où les autres passent, ou elle est écartée.
     */
    const verdict: CopyResult = validateCopy(
      post.archetype,
      JSON.stringify({
        payload: entry.payload ?? post.payload,
        card_line: cardLine,
        caption: post.caption,
        alt_text: post.altText,
      })
    );
    if (!verdict.ok) {
      refused.push({ index, why, because: verdict.reason ?? "non conforme" });
      continue;
    }
    revisions.push({ index, why, cardLine: verdict.cardLine ?? cardLine, payload: verdict.payload });
  }

  return { revisions, refused, usage };
}
