/*
 * ── LA CONSIGNE DE LA BANQUE, EXTRAITE DE `10-topic-bank.ts` (2026-10-04) ──
 *
 * Déplacée telle quelle, sans un mot changé, pour que le remplissage de banque
 * sur OpenAI (`scripts/production-path/openai-month/bank.ts`) lise la MÊME
 * consigne que celui d'Anthropic. Deux copies divergeraient, et la comparaison
 * entre les deux banques ne voudrait plus rien dire.
 *
 * ⚠ `prefix` rend toujours un bloc Anthropic marqué `cache_control` ; le texte
 * en est `prefix(...)[0].text`, et c'est lui que l'appelant OpenAI emploie.
 */
import { archetypeInstruction } from "../../lib/content/generate/copy-batch";

export const INTENTS = ["normalise", "educate", "correct_a_myth", "invite", "behind_the_practice"];

export type Seg = { id: string; modality_id: string; persona_id: string; state_code: string | null };

/**
 * ⚠ LE PRÉFIXE NE PORTE NI SEGMENT NI NUMÉRO. Il ne dépend que de
 * l'archétype et des six règles, triées. Tout ce qui varie — la modalité, la
 * population, l'intention, l'angle — vient APRÈS, dans le message.
 */
export function prefix(archetypeKey: string, rules: Array<{ id: string; short_label: string; description: string }>) {
  const ethics = [...rules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `- ${r.short_label}: ${r.description}`)
    .join("\n");

  const text = [
    `You are stocking a shared library of post ideas for licensed psychotherapists`,
    `in private practice in the United States. Each idea is later handed to ONE`,
    `practitioner and written up in her own voice, so write the IDEA, never her.`,
    ``,
    `ADVERTISING ETHICS (ACA / APA). A board reads what is published under a`,
    `licensee's name. A promise of outcome is the kind of sentence that costs a`,
    `licence rather than a client.`,
    ethics,
    ``,
    `NEVER: guarantee an outcome, diagnose, imply a cure, name or describe a`,
    `client (real, composite or anonymised), compare practitioners, promise`,
    `speed, or write in the first person about a specific practice.`,
    ``,
    `OUTPUT FORMAT. Reply with ONE JSON object and nothing else — no prose`,
    `before it, no code fence around it:`,
    `{"title": "...", "hook": "...", "payload": {...}, "caption_seed": "...", "rationale_template": "..."}`,
    ``,
    `- "title" names the idea for a practitioner browsing: at most 8 words.`,
    `- "hook" is the line that makes her stop: one sentence, at most 20 words.`,
    `- "payload" follows the archetype shape below, exactly.`,
    `- "caption_seed" is a publishable caption: 40 to 900 characters.`,
    `- "rationale_template" completes "Why this one:" in at most 20 words.`,
    ``,
    `⚠ WORD COUNTS ARE HARD LIMITS, AND THIS IS WHERE MOST ANSWERS DIE. A`,
    `database CHECK counts the words and refuses the whole idea; nothing is`,
    `repaired. In the first run of this prompt, 29 ideas out of 52 were thrown`,
    `away on this alone.`,
    ``,
    `A "label" is 1 to 3 words. A "gloss" is 1 to 6 words. Count articles,`,
    `prepositions and hyphenated halves as words. Write the shortest true`,
    `phrase, not a sentence.`,
    ``,
    `GOOD: {"label": "Sunday dread", "gloss": "starts before the alarm"}`,
    `      (label 2 words, gloss 4 words)`,
    `BAD:  {"label": "The Sunday evening dread", "gloss": "it starts long before`,
    `      the alarm goes off on Monday"}  (label 4, gloss 11 — both refused)`,
    ``,
    `Count every label and every gloss before you answer. If one is too long,`,
    `cut it rather than rephrase it.`,
    ``,
    /*
     * ── ⚠ UN SUJET N'EST PAS UN PAYLOAD ───────────────────────────────
     *
     * La banque écrit des SUJETS — un titre, une accroche, un angle. Le
     * payload vient plus tard, au mois. Pour dix archétypes les deux vont
     * ensemble et la forme aide le modèle à viser juste.
     *
     * `practitioner_card` fait exception depuis que ses lignes viennent du
     * brief : lui demander sa forme lève, et c'est voulu. Son sujet reste
     * légitime — « Where to start », « How I work » — donc on lui décrit la
     * carte en mots, sans schéma à remplir.
     */
    archetypeKey === "practitioner_card"
      ? [
          `Archetype "practitioner_card". Write ONLY the topic: a title and a`,
          `hook for a card that says, plainly, how she works.`,
          ``,
          `⚠ You do NOT write its content. The card's lines are filled from her`,
          `own brief at composition time — modality, city, availability — and`,
          `never by a model. Do not invent a practice name, an email, a phone`,
          `number, a website or a handle anywhere in your answer.`,
        ].join("\n")
      : archetypeInstruction(archetypeKey),
  ].join("\n");

  return [{ type: "text" as const, text, cache_control: { type: "ephemeral" as const } }];
}

export function variable(seg: Seg, modalityLabel: string, personaLabel: string, personaDesc: string, intent: string, angle: number) {
  return [
    `MODALITY: ${modalityLabel}`,
    `WHO IT IS FOR: ${personaLabel} — ${personaDesc}`,
    seg.state_code ? `STATE: ${seg.state_code}` : `STATE: any`,
    `INTENT: ${intent}`,
    `ANGLE ${angle}: give an idea no other angle in this set would produce.`,
  ].join("\n");
}
