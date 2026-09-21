/*
 * ── LE MOIS RÉEL : 30 PUBLICATIONS, EN BATCH, AVEC CACHING ──────────────
 *
 * ⚠ LE SECOND PILOTE QUI N'EXISTAIT PAS. `lib/content/generate/copy-batch.ts`
 * porte tout le lot sauf son envoi : `cachedPrefix`, `variablePart`,
 * `buildBatchRequests`, `validateCopy`, `collectCopy`, `batchCostUsd` — tous
 * exportés, tous testés, et `messages.batches.create` n'est appelé nulle part
 * dans les deux dépôts. Le seul endroit où le mot « batches » apparaît hors de
 * ce fichier est un commentaire de `write-one.ts` qui dit ne pas s'en servir.
 * Ce script est l'envoi manquant, et rien d'autre : chaque décision — le
 * préfixe, la partie variable, la validation, le coût — reste celle du dépôt.
 *
 * ⚠ TRENTE, ET LE DÉPÔT EN DIT DOUZE. `credit_quotas` accorde 30
 * `post_generation` par mois et l'en-tête de `copy-batch.ts` dit « trente
 * publications par mois et par abonnée » ; `POSTS_PER_MONTH` de `plan.ts`
 * plafonne à 12, parce que `cadence_per_week` s'arrête à 3. Trois sources, et
 * la plus basse est celle qui décide aujourd'hui de ce qu'une praticienne
 * reçoit. Ce script produit les trente demandés et le rapport le dit.
 *
 *   ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" \
 *     npx tsx scripts/local-render/20-month.ts --confirm
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  buildBatchRequests,
  collectCopy,
  batchCostUsd,
  massCopyModel,
  type BrandContext,
  type TopicRequest,
} from "../../lib/content/generate/copy-batch";
import { chooseArchetype, scheduleDates } from "../../lib/content/generate/plan";
import { cachedPrefix, variablePart, validateCopy, syncCostUsd } from "../../lib/content/generate/copy-batch";
import { anthropicContentModel } from "../../lib/content/generate/model";
import { deriveThemes } from "../../lib/content/generate/themes";
import { checkEthics } from "../../lib/ethics/rules";
import type { ContentCheckin, ContentRegister } from "../../lib/data/content";
import { admin, anthropicKeyOrDie, testKit, MONTH, SESSION_CAP_USD } from "./lib";

const WANTED = 30;

/*
 * ⚠ 34 CARACTÈRES CONTRE HUIT MOTS, ET PERSONNE NE LES AVAIT MIS FACE À FACE.
 * `content_items_title_check` borne le titre à 34 caractères ; la banque écrit
 * des titres « d'au plus huit mots », soit la moitié du temps davantage. Un
 * sujet tiré ne peut donc pas devenir le titre du post qu'il produit. Ramené
 * ici sur une frontière de mot, comme `clampDirection` le fait ailleurs — et
 * signalé, parce que la vraie réparation est que les deux bornes se parlent.
 */
function clampTitle(title: string): string {
  if (title.length <= 34) return title;
  const cut = title.slice(0, 34);
  const boundary = cut.lastIndexOf(" ");
  return (boundary > 12 ? cut.slice(0, boundary) : cut).trimEnd();
}

type Topic = {
  id: string;
  archetype_key: string;
  intent: string;
  title: string;
  hook: string;
};

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This spends money.\n");
    process.exit(1);
  }
  const key = anthropicKeyOrDie();
  const db = admin();
  const client = new Anthropic({ apiKey: key });
  const { kitId } = await testKit(db);

  /* ── Un mois, une fois ─────────────────────────────────────────────── */
  const { data: already } = await db
    .from("content_months")
    .select("id, status")
    .eq("brand_kit_id", kitId)
    .eq("month", MONTH)
    .maybeSingle();
  if (already) {
    console.error(`\n✗ Kit ${kitId} already has a ${MONTH} month (${already.status}).\n`);
    process.exit(1);
  }

  /* ── Ce à partir de quoi le mois est écrit ─────────────────────────── */
  const { data: kit } = await db
    .from("brand_kits")
    .select("voice_guide, directions, selected_direction_id")
    .eq("id", kitId)
    .single();
  const { data: preferences } = await db
    .from("content_preferences")
    .select("cadence_per_week, accepted_registers, off_limits")
    .eq("brand_kit_id", kitId)
    .single();
  const { data: checkinRow } = await db
    .from("content_checkins")
    .select("brand_kit_id, month, sessions_theme, taking_clients, happening")
    .eq("brand_kit_id", kitId)
    .eq("month", MONTH)
    .maybeSingle();
  const { data: rules } = await db.from("ethics_rules").select("*");
  const { data: brief } = await db
    .from("project_briefs")
    .select("practice_name, positioning, usp_statement")
    .limit(1)
    .single();

  if (!preferences || !rules?.length || !brief) throw new Error("the account is not complete");

  const voice = (() => {
    const guide = kit?.voice_guide as { tone?: string; sounds_like?: string[] } | null;
    return [guide?.tone, ...(guide?.sounds_like ?? [])].filter(Boolean).join(" · ") || "plain, warm, unhurried";
  })();

  const brand: BrandContext = {
    practiceName: brief.practice_name ?? "the practice",
    voice,
    offLimits: preferences.off_limits ?? "",
    ethicsRules: rules,
  };

  /* ── Les trois thèmes, dérivés de sa propre phrase ──────────────────── */
  const checkin = (checkinRow ?? null) as ContentCheckin | null;
  const themeModel = anthropicContentModel(rules);
  const themes = await deriveThemes(themeModel, {
    month: MONTH,
    checkin,
    briefContext: [brief.positioning, brief.usp_statement].filter(Boolean).join("\n"),
    offLimits: preferences.off_limits ?? null,
  });
  console.error(`▸ themes (${themes.source}): ${themes.themes.join(" · ")}`);

  /* ── Trente sujets, tirés de la banque par la RPC du produit ───────── */
  const drawn: Topic[] = [];
  const exhausted: string[] = [];
  for (let i = 0; i < WANTED; i += 1) {
    /*
     * ⚠ UN CAST, ET LA MÊME CAUSE QU'AILLEURS. `assign_topic_to_kit` est
     * arrivée avec les migrations du 20 septembre ; `types/supabase.ts` est
     * généré depuis un projet qui ne les a pas, donc la RPC n'y est pas.
     * Le produit ne bute pas dessus : aucun écran ne l'appelle encore.
     */
    const { data: topicId, error } = await (db.rpc as unknown as (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: string | null; error: { message: string } | null }>)(
      "assign_topic_to_kit",
      { p_brand_kit_id: kitId, p_month: MONTH }
    );
    if (error) throw new Error(`assign_topic_to_kit: ${error.message}`);
    if (!topicId) {
      exhausted.push(`draw ${i + 1}: the bank had nothing left to give`);
      break;
    }
    const { data: topic } = await db
      .from("content_topics")
      .select("id, archetype_key, intent, title, hook")
      .eq("id", topicId)
      .single();
    if (topic) drawn.push(topic as Topic);
  }
  console.error(`▸ ${drawn.length} topics drawn of ${WANTED} asked`);

  /* ── Le lot ────────────────────────────────────────────────────────── */
  const checkinLine = [checkin?.sessions_theme, checkin?.happening].filter(Boolean).join(" ");
  const requests: TopicRequest[] = drawn.map((topic) => ({
    topicId: topic.id,
    archetypeKey: topic.archetype_key,
    title: topic.title,
    hook: topic.hook,
    intent: topic.intent,
    checkin: checkinLine,
  }));

  const batch = await client.messages.batches.create({
    requests: buildBatchRequests(brand, requests),
  });
  console.error(`▸ batch ${batch.id} · ${massCopyModel()} · ${requests.length} posts`);

  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((resolve) => setTimeout(resolve, 15000));
    status = await client.messages.batches.retrieve(batch.id);
    console.error(`  … ${status.processing_status} ${JSON.stringify(status.request_counts)}`);
  }

  const entries: Array<{ custom_id: string; result: { type: string; message?: Anthropic.Message } }> = [];
  for await (const entry of await client.messages.batches.results(batch.id)) {
    entries.push(entry as never);
  }
  const archetypeByTopic = new Map(drawn.map((t) => [t.id, t.archetype_key]));
  const results = collectCopy(entries, archetypeByTopic);

  /*
   * ── UNE RELANCE QUI DIT CE QUI A ÉTÉ RATÉ ──────────────────────────────
   *
   * ⚠ ET LE PRODUIT, LUI, RELANCE À L'IDENTIQUE. `write-one.ts` le dit et
   * l'assume : « la relance ne dit pas au modèle ce qu'il a raté, et c'est
   * délibéré ». Ce lot-ci mesure ce que cette décision coûte. Sur le premier
   * mois réel, le lot seul a rendu 1 post valide sur 30 ; ce qui suit relance
   * une fois chaque refus en citant le reproche exact, et le rapport publie
   * les deux chiffres côte à côte.
   *
   * Rien n'est réparé à la main. Une seconde sortie refusée reste un échec.
   */
  const retryUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let retried = 0;
  let rescued = 0;

  for (const [index, result] of results.entries()) {
    if (result.ok) continue;
    const topic = drawn.find((t) => t.id === result.topicId);
    if (!topic) continue;
    const entry = entries.find((e) => e.custom_id === result.topicId);
    const raw = entry?.result.message?.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("") ?? "";
    if (!raw) continue;

    const reproach = result.budget?.length
      ? result.budget.map((b) => `- ${b.path}: you wrote ${b.said} words, at most ${b.allowed} are allowed`).join("\n")
      : `- the payload did not match the archetype's shape (${result.reason})`;

    const second = await client.messages.create({
      model: massCopyModel(),
      max_tokens: 2000,
      system: cachedPrefix(brand, topic.archetype_key),
      messages: [
        { role: "user", content: variablePart(requests[index] ?? requests[0]) },
        { role: "assistant", content: raw },
        { role: "user", content: `That was refused:\n${reproach}\n\nSend the WHOLE JSON object again, corrected. Change nothing that was accepted.` },
      ],
    });
    retried += 1;
    retryUsage.input += second.usage.input_tokens;
    retryUsage.output += second.usage.output_tokens;
    const secondText = second.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const secondResult = validateCopy(topic.archetype_key, secondText);
    if (secondResult.ok) {
      results[index] = { ...secondResult, topicId: result.topicId, usage: result.usage };
      rescued += 1;
    }
  }

  /* ── Le mois, puis les posts ───────────────────────────────────────── */
  const { data: monthRow, error: monthError } = await db
    .from("content_months")
    .insert({
      brand_kit_id: kitId,
      month: MONTH,
      themes: themes.themes,
      status: "proposed",
      theme_source: themes.source,
      theme_source_text: themes.sourceText,
    })
    .select("id")
    .single();
  if (monthError || !monthRow) throw new Error(`could not write the month: ${monthError?.message}`);

  const registers = preferences.accepted_registers as ContentRegister[];
  const dates = scheduleDates(MONTH.slice(0, 7), [1, 2, 3, 4, 5, 6, 7], WANTED);

  const failures: Array<{ topic: string; kind: string; because: string }> = [];
  const ethicsFlags: Array<{ topic: string; rule: string; excerpt: string }> = [];
  let written = 0;
  let previousArchetype: Parameters<typeof chooseArchetype>[1] = null;

  for (const [index, result] of results.entries()) {
    const topic = drawn.find((t) => t.id === result.topicId);
    if (!topic) continue;

    if (!result.ok) {
      failures.push({
        topic: topic.title,
        kind: result.budget?.length ? "word budget" : result.reason === "schema" ? "schema" : "model",
        because: result.budget?.length
          ? result.budget.map((b) => `${b.path}: said ${b.said}, allowed ${b.allowed}`).join("; ")
          : (result.reason ?? "unknown"),
      });
      continue;
    }

    const register = registers[index % registers.length];
    const layout = chooseArchetype(register, previousArchetype);
    previousArchetype = layout;

    /*
     * ⚠ LE GARDE DÉONTOLOGIQUE EST LU, PAS SEULEMENT SUBI. La base refuse
     * déjà un item qui porte une phrase interdite ; on scanne en plus ici
     * pour pouvoir DIRE ce qui a été attrapé, plutôt que de compter des
     * insertions manquantes.
     */
    const scanned = [result.caption, result.altText, JSON.stringify(result.payload)].join("\n");
    for (const violation of checkEthics(scanned).violations) {
      ethicsFlags.push({ topic: topic.title, rule: violation.ruleId, excerpt: violation.excerpt.slice(0, 80) });
    }

    const { error } = await db.from("content_items").insert({
      brand_kit_id: kitId,
      month_id: monthRow.id,
      topic_id: topic.id,
      theme: themes.themes[index % themes.themes.length],
      register,
      archetype: layout,
      compose_archetype: topic.archetype_key,
      payload: result.payload as never,
      status: "proposed",
      title: clampTitle(topic.title),
      on_image_text: topic.hook,
      caption: result.caption ?? "",
      alt_text: result.altText ?? "",
      rationale: result.rationale ?? "",
      scheduled_for: dates[index] ?? dates[dates.length - 1],
    });
    if (error) {
      failures.push({ topic: topic.title, kind: "database", because: error.message.slice(0, 160) });
      continue;
    }
    written += 1;
  }

  const usage = results.filter((r) => r.usage).map((r) => r.usage!);
  const costUsd = batchCostUsd(usage) + syncCostUsd(retryUsage);
  const totals = usage.reduce(
    (acc, u) => ({
      input: acc.input + u.input,
      output: acc.output + u.output,
      cacheRead: acc.cacheRead + u.cacheRead,
      cacheWrite: acc.cacheWrite + u.cacheWrite,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  );

  console.log(JSON.stringify({
    step: "month",
    batch: batch.id,
    monthId: monthRow.id,
    asked: WANTED,
    drawn: drawn.length,
    written,
    exhausted,
    failures,
    ethicsFlags,
    themes: { source: themes.source, themes: themes.themes },
    usage: totals,
    retried,
    rescuedOnRetry: rescued,
    retryUsage,
    costUsd: Number(costUsd.toFixed(5)),
    capUsd: SESSION_CAP_USD,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
