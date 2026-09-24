import type Anthropic from "@anthropic-ai/sdk";
import { massCopyModel } from "@/lib/content/generate/copy-batch";
import type { CompletenessVerdicts } from "@/lib/content/writing-checks";

/*
 * ── LE JUGE DE COMPLÉTUDE ───────────────────────────────────────────────
 *
 * ⚠ QUATRE TITRES SE SONT ARRÊTÉS AVANT LEUR SENS, ET UN SEUL ÉTAIT LEXICAL.
 *
 * « When life changes without » finit sur une préposition qui ne strande pas :
 * une liste le voit. « The thing that works costs », « High performance masks
 * held », « Success masks an overdriven », « The block may be choice » finissent
 * sur des mots parfaitement ordinaires. Ce qui manque est ce qui vient APRÈS,
 * et aucun lexique ne le dit — trois tours de faux positifs l'ont établi.
 *
 * Plutôt que de renoncer ou de deviner, on demande. Un appel, une fois par
 * mois, sur les seules lignes que le lexique n'a pas tranchées.
 *
 * ── CE QUE ÇA COÛTE ────────────────────────────────────────────────────
 *
 * Mesuré : une trentaine de lignes de moins de trente caractères, une réponse
 * d'un mot par ligne. En Haiku 4.5 c'est de l'ordre du millième de dollar —
 * moins qu'un seul des cinquante-quatre appels du mois qu'il protège.
 *
 * ── ET CE QU'IL NE FAIT PAS ────────────────────────────────────────────
 *
 * Il ne réécrit rien. Il répond fini / pas fini, et c'est `checkUnfinished`
 * qui refuse. Un juge qui proposerait une correction fabriquerait une carte
 * que personne n'a écrite, ce qui est précisément le défaut qu'on répare.
 */

/**
 * ⚠ IL NE JUGE QUE LA SYNTAXE, JAMAIS LE GOÛT.
 *
 * Un fragment est ce qu'une glose EST : « nothing left by Friday » n'est pas
 * une phrase et ne doit pas être refusée. La consigne le dit deux fois parce
 * que c'est là que seize refus à tort ont été perdus la première fois.
 */
const PROMPT = [
  `You are checking whether short lines of copy are SYNTACTICALLY COMPLETE.`,
  ``,
  `A line is COMPLETE when it can be read on its own without the reader`,
  `waiting for a word that never comes. A line is INCOMPLETE when it stops`,
  `mid-construction: a transitive verb with no object, a determiner or`,
  `adjective with no noun, a comparison with nothing compared.`,
  ``,
  `⚠ A FRAGMENT IS NOT INCOMPLETE. These lines are labels and glosses, not`,
  `sentences. "Nothing left by Friday", "Body says no", "Back at work",`,
  `"Rest is not a reward", "After that" are all COMPLETE. Noun phrases,`,
  `prepositional phrases and bare clauses are complete.`,
  ``,
  `⚠ ENGLISH STRANDS ITS PREPOSITIONS. "information to work with", "where it`,
  `comes from", "what she is good at" are all COMPLETE.`,
  ``,
  `These are INCOMPLETE: "Success masks an overdriven" (adjective, no noun),`,
  `"The thing that works costs" (transitive verb, no object), "High`,
  `performance masks held" (participle with nothing to attach to),`,
  `"Efficiency can mask what" (interrogative with no clause).`,
  ``,
  `⚠ WHEN IN DOUBT, ANSWER "complete". A wrongly refused line costs a good`,
  `post; a wrongly accepted one is caught by a human reading the board.`,
  ``,
  `Reply with ONE JSON object and nothing else, mapping each line to true`,
  `(complete) or false (incomplete):`,
  `{"the line exactly as given": true, "another line": false}`,
].join("\n");


/**
 * Demande à un modèle court si chaque ligne se tient.
 *
 * ⚠ IL NE LÈVE JAMAIS. Une panne du juge, un dépassement de budget ou un JSON
 * illisible rendent un verdict VIDE, et un verdict vide ne refuse rien :
 * l'absence de verdict n'est pas un verdict. Un mois entier ne doit pas
 * tomber parce qu'un appel de contrôle a échoué.
 */
export async function judgeCompleteness(
  client: Pick<Anthropic, "messages">,
  lines: string[]
): Promise<{ verdicts: CompletenessVerdicts; usage: { input: number; output: number } }> {
  const empty = { verdicts: {} as CompletenessVerdicts, usage: { input: 0, output: 0 } };
  if (lines.length === 0) return empty;

  try {
    const message = await client.messages.create({
      model: massCopyModel(),
      /*
       * ⚠ 1500 ÉTAIT UNE CONSTANTE, ET ELLE A FAIT TAIRE LE JUGE. Mesuré en
       * choisissant les exemples : sur des lots de quarante lignes, la réponse
       * dépassait le plafond, le JSON arrivait tronqué, `JSON.parse` levait, et
       * le juge rendait un verdict VIDE — qui ne refuse rien. Trois lots sur
       * quatre sont passés sans être jugés, en silence.
       *
       * ⚠ LE SILENCE EST LE COMPORTEMENT VOULU (un juge en panne ne doit pas
       * faire tomber un mois), ET C'EST CE QUI REND LE DÉFAUT INVISIBLE. Le
       * plafond suit donc le nombre de lignes : une ligne rendue coûte une
       * clé et un booléen, soit une soixantaine de jetons avec sa ponctuation.
       */
      max_tokens: Math.min(16000, 400 + lines.length * 60),
      system: PROMPT,
      messages: [{ role: "user", content: lines.map((l) => `- ${l}`).join("\n") }],
    });
    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, ""));
    const verdicts: CompletenessVerdicts = {};
    for (const [line, verdict] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof verdict === "boolean") verdicts[line] = verdict;
    }
    return {
      verdicts,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  } catch {
    return empty;
  }
}
