/*
 * ── LE MOIS, VISÉ À TRENTE VISUELS SUR TRENTE ───────────────────────────
 *
 * La version du matin rendait 16 posts sur 30, dont 11 arrivaient en visuel.
 * Ce qui a changé, dans l'ordre où ça agit :
 *
 *   1. LE PRÉFIXE DIT LES COMPTES ET MONTRE UN EXEMPLE conforme par
 *      archétype, et demande une ligne de carte d'au plus 30 caractères —
 *      mesuré : au-delà, le titre se pose sous 102px et tout libellé de
 *      diagramme tombe sous 11px dans une vignette de 350.
 *   2. UN CHAMP QUI DÉPASSE EST RÉÉCRIT SEUL (`repair.ts`), deux passes au
 *      plus. Les dépassements mesurés étaient tous de 1 à 3 mots.
 *   3. ON EN DEMANDE PLUS QUE TRENTE, et les sujets non retenus sont rendus
 *      à la banque.
 *   4. UNE CARTE QUI NE TIENT PAS SE REPLIE (`fallback.ts`) au lieu d'être
 *      jetée : moins de libellés, puis carrousel, puis une phrase.
 *   5. LE PREMIER MOIS D'UN COMPTE EST ÉCRIT EN SYNCHRONE. Le Batch met 25 à
 *      30 minutes ; une nouvelle abonnée ne les attend pas.
 *   6. CHAQUE APPEL PAYANT ENTRE AU LEDGER, abouti ou non.
 *
 *   ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" \
 *     npx tsx scripts/local-render/20-month.ts --confirm [--email <compte>]
 */
import { spawnSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import {
  cachedPrefix,
  variablePart,
  validateCopy,
  buildBatchRequests,
  collectCopy,
  prefixBaselineMode,
  batchCostUsd,
  clampCardLine,
  copyEffort,
  typographicQuotes,
  deepTypographic,
  syncCostUsd,
  massCopyModel,
  type BrandContext,
  type TopicRequest,
} from "../../lib/content/generate/copy-batch";
import { repairPayload } from "../../lib/content/generate/repair";
import { reviseMonth, revisionOn } from "../../lib/content/generate/revise";
import { chooseArchetype, scheduleDates } from "../../lib/content/generate/plan";
import { anthropicContentModel } from "../../lib/content/generate/model";
import { deriveThemes } from "../../lib/content/generate/themes";
import { composeWithFallback } from "../../lib/compose/fallback";
import { cardPalette } from "../../lib/compose/palette";
import { checkEthics } from "../../lib/ethics/rules";
import { checkinLeaks } from "../../lib/content/leakage";
import { capitaliseTitle, eyebrowFor } from "../../lib/content/bands";
import { licenceMention, licenceMissingMessage } from "../../lib/content/licence";
import type { ContentCheckin, ContentRegister } from "../../lib/data/content";
import { redundantAgainst } from "../../lib/content/dedup";
import { guardBank } from "../../lib/content/bank-guard";
import {
  asMonthPost, selectDeliverable, type Deliverable,
} from "../../lib/content/month/select";
import {
  CANDIDATES_PER_ATTEMPT, POSTS_PER_MONTH, SPARE_POOL, USABLE_TARGET,
  WINDOW_ROUNDS, type BankDemand,
} from "../../lib/content/bank";
import { drawMonth } from "@/lib/content/month/draw";
import { serverBankGuardPort, serverDrawPort, type DrawRpcClient } from "@/lib/content/month/draw-port";
import {
  checkMonth, checkPostAlone, writtenLinesIn, FORMAT_FAMILIES, familyOf,
  type Finding, type PostUnderCheck,
} from "../../lib/content/month-checks";
import { undecidedIn, type CompletenessVerdicts } from "../../lib/content/writing-checks";
import { judgeCompleteness } from "../../lib/content/generate/completeness-judge";
import {
  practitionerLines, identityAllowList, PRACTITIONER_CARDS_PER_MONTH,
  type PractitionerFacts,
} from "../../lib/content/practitioner";
import { loadJournal, rememberBatch, rememberResult, clearJournal } from "./journal";
import type { DirectionPalette } from "../../lib/compose/palette";
import {
  admin, anthropicKeyOrDie, accountFor, untypedTable, MONTH, SESSION_CAP_USD,
  noteSpend, runSpendUsd,
} from "./lib";
import {
  aPurchaseWouldHelp, reserveRefusal, withOverhead, type CreditPort,
} from "../../lib/credits/paid-call";

/*
 * ⚠ LE MÊME 30 QUE `bank.ts`, PAS UN SECOND. Il était écrit ici en littéral et
 * là-bas sous le nom `POSTS_PER_MONTH` ; deux 30 qui se trouvent égaux ne sont
 * pas une garantie qu'ils le resteront.
 */
const WANTED = POSTS_PER_MONTH;

const ZERO = (): { input: number; output: number; cacheRead: number; cacheWrite: number } =>
  ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
/*
 * ⚠ QUARANTE-QUATRE POUR TRENTE. Le quota est de trente crédits ; un essai
 * refusé rend le sien tout de suite, donc la sur-génération n'est bornée que
 * par la banque et par le plafond de dépense. Mesuré : il faut environ 1,2
 * essai par post écrit.
 */
/*
 * ⚠ ASSEZ POUR QUE LA RÉSERVE EXISTE VRAIMENT. À 44, le rendement réel
 * (~75 % des candidats donnent un post utilisable) laissait 33 utilisables
 * pour 30 voulus : le sélecteur trouvait un banc VIDE et ne pouvait échanger
 * aucun post refusé. Un mois refusé sans remplaçant n'est pas une correction,
 * c'est un abandon.
 */
/*
 * ⚠ SOIXANTE-DOUZE, ET C EST MESURÉ SUR DIX ESSAIS GELÉS. À 54, la préparation
 * rendait entre 26 et 30 posts utilisables pour 30 voulus : le banc était
 * NÉGATIF dans huit essais sur dix, donc le sélecteur ne pouvait échanger
 * aucun post refusé et chaque constat survivait jusqu au verdict.
 *
 * La perte mesurée entre le tirage et la préparation est d environ 45 %
 * — budget de mots, schéma, déontologie depuis qu une violation écarte le
 * candidat. Soixante-douze en rend une quarantaine : trente posés, dix au
 * banc.
 */
const CANDIDATES = CANDIDATES_PER_ATTEMPT;

/*
 * ── ⚠ LE REMPLISSAGE PART AVANT LA GÉNÉRATION, PAS APRÈS L'ÉCHEC ────────
 *
 * Le 2026-09-23, le quatrième essai n'a tiré que 18 candidats sur 54. Rien ne
 * l'avait annoncé : la banque portait 88 sujets libres, et le total n'est pas
 * la grandeur qui décide. `cycle` et `numbered_strategies` en avaient cinq
 * chacun, et un mois ne se compose pas avec ça.
 *
 * La banque était donc remplie APRÈS l'échec — c'est-à-dire après avoir payé
 * l'écriture d'un mois qui ne pouvait pas sortir. Le stock tirable est
 * maintenant compté AVANT le tirage, par archétype, avec la requête qui tire
 * (`drawable_count_for_kit`), et le remplissage part de lui-même s'il manque.
 *
 * ⚠ `--no-fill` REFUSE AU LIEU DE REMPLIR, en nommant ce qui manque et la
 * commande qui le corrige. Un remplissage est un appel payant : il doit
 * pouvoir se déclencher tout seul dans un `cron`, et jamais par surprise sous
 * la main de quelqu'un qui regardait ailleurs.
 */
const BANK_DEMAND: BankDemand = {
  practitioners: numberFlag("--practitioners", 1),
  attempts: numberFlag("--attempts", 4),
  rounds: numberFlag("--rounds", WINDOW_ROUNDS),
};

function numberFlag(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  const n = i === -1 ? fallback : Number(process.argv[i + 1]);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/*
 * ── LE GARDE-FOU DE BANQUE — LA DÉCISION EST AILLEURS ────────────────────
 *
 * Elle vivait ici, et nulle part ailleurs. `lib/content/bank-guard.ts` la
 * porte désormais, pure et éprouvable hors ligne ; ce qui reste ici est ce qui
 * est PROPRE AU HARNAIS : lancer le remplissage en sous-processus, ce qu'une
 * route serveur ne peut pas et ne doit pas faire.
 *
 * ⚠ ET LE TROU N'EST PAS COMBLÉ POUR AUTANT. Le chemin produit ne tire pas de
 * la banque de sujets — il passe par `planMonth` et n'appelle jamais
 * `next_topic_for_kit`. Voir F45 : ce ne sont pas deux mécanismes qui manquent
 * au produit, c'est le générateur entier qui n'est pas le même.
 */
async function guardTheBank(db: ReturnType<typeof admin>, kitId: string): Promise<void> {
  const rpc = db.rpc as unknown as (
    n: string, a: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  /*
   * ⚠ LA COUTURE EST PARTAGÉE, ET C'EST TOUT L'INTÉRÊT. Ces deux appels étaient
   * écrits ici ; le chemin produit aurait dû les réécrire, avec sa propre idée de
   * la forme des arguments. `serverBankGuardPort` les nomme une seule fois —
   * comme `serverCreditPort` pour le crédit.
   */
  const verdict = await guardBank(
    serverBankGuardPort(db as unknown as DrawRpcClient),
    kitId,
    BANK_DEMAND
  );

  if (verdict.released > 0) {
    console.error(`▸ ${verdict.released} assignations rendues — des exécutions qui n'ont rien livré`);
  }
  if (verdict.ok) {
    console.error(`▸ banque : ${verdict.said}`);
    return;
  }

  /*
   * ⚠ `--confirm` EN FAIT PARTIE, ET SON ABSENCE A FAIT ÉCHOUER LE PREMIER
   * DÉCLENCHEMENT RÉEL. Le garde-fou a bien vu le manque, bien lancé le
   * remplissage — et le remplissage a répondu « Refusing without --confirm »,
   * puis le mois est tombé. Une commande construite dans une chaîne que
   * personne n'a lancée est une commande qui ne marche pas.
   */
  const fill = [
    "npx tsx scripts/local-render/10-topic-bank.ts --sync --confirm",
    `--practitioners ${BANK_DEMAND.practitioners}`,
    `--attempts ${BANK_DEMAND.attempts}`,
    `--rounds ${BANK_DEMAND.rounds}`,
  ].join(" ");

  if (process.argv.includes("--no-fill")) {
    throw new Error(
      `la banque ne porte pas de quoi composer ce mois — ${verdict.said}. Remplir d'abord : ${fill}`
    );
  }

  console.error(`▸ banque sous le seuil (${verdict.said}) — remplissage AVANT la génération`);
  const [command, ...args] = fill.split(" ");
  const filled = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (filled.status !== 0) {
    throw new Error(`le remplissage a échoué (code ${filled.status}) — ${verdict.said}`);
  }
}

/*
 * ── LE MÉLANGE DU MOIS ──────────────────────────────────────────────────
 *
 * Un tiers de cartes à une phrase, un tiers de diagrammes simples, un tiers de
 * carrousels et de formes larges. Mesuré le 2026-09-21 : à 350px — la largeur
 * d'une vignette dans un fil — une phrase se lit et un diagramme à quatre
 * cases ne se lit pas. Un mois composé à neuf dixièmes de diagrammes est un
 * mois que personne ne lit sur un téléphone.
 *
 * ⚠ LES FAMILLES SONT DÉFINIES PAR LE NOMBRE DE LIBELLÉS QU'ELLES PORTENT,
 * pas par leur nom. C'est le nombre de libellés qui décide de la taille du
 * texte, et la taille du texte décide de la lisibilité.
 */
/*
 * ── ⚠ L'ORDRE DES FAMILLES DÉCIDE QUELS FORMATS UN MOIS PEUT PORTER ─────
 *
 * Mesuré le 2026-09-23 sur deux mois livrés : **zéro carrousel sur soixante
 * posts**, alors que la banque en portait vingt-trois de libres. Le rapport de
 * rejet, une fois qu'il a nommé l'archétype, dit pourquoi : les CINQ
 * carrousels tirés ont été refusés comme redondants, au tirage.
 *
 * `redundantAgainst` compare un titre à TOUS ceux déjà acceptés, sans regarder
 * le format. La famille tirée en dernier affronte donc les trente-six titres
 * des deux premières, et perd. Les rejets suivent exactement l'ordre de
 * tirage :
 *
 *   statement (tiré 1er) :  7 rejets
 *   simple    (tiré 2e)  : 15 rejets
 *   varied    (tiré 3e)  : 23 rejets
 *
 * ⚠ CE N'ÉTAIT PAS UN MANQUE DE STOCK, C'ÉTAIT UN ORDRE DE PASSAGE. Les
 * formats larges — ceux que les références utilisent le plus — étaient
 * éliminés par construction.
 *
 * Ils passent donc en premier. `single_statement` a la forme la plus souple
 * et le plus gros stock : c'est lui qui peut absorber les rejets, pas le
 * carrousel. L'objet garde son ordre d'écriture pour que la lecture reste
 * celle du mélange publié ; c'est `DRAW_ORDER` qui décide du tirage.
 */
/*
 * ⚠ LES FAMILLES VIENNENT DU CONTRÔLE, PAS L'INVERSE. Le plancher par format
 * se calcule sur la part visée par CE tirage : deux listes tenues à la main
 * auraient divergé au premier archétype ajouté, et le plancher aurait alors
 * mesuré une composition que personne ne vise.
 *
 * ⚠ CE QUI RESTE PROPRE AU TIRAGE EST LE POIDS. `carousel` figure deux fois,
 * et c'est mesuré : le mélange en exige au moins deux par mois (F22) ; sur
 * huit essais gelés, trois n'en ont livré qu'UN. Le carrousel empile trois à
 * six payloads, il se perd à la validation plus souvent que les autres, et un
 * tirage à égalité n'en laisse pas deux debout. Deux tours sur quatre, donc —
 * un poids de tirage, jamais une composition.
 */
const FAMILIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(FORMAT_FAMILIES).map(([family, keys]) => [
    family,
    family === "varied" ? [keys[0], keys[1], keys[0], ...keys.slice(2)] : [...keys],
  ])
);

/** Du format le plus large au plus souple : qui affronte le moins de titres déjà pris. */
const DRAW_ORDER = ["varied", "simple", "statement"] as const;

type Topic = { id: string; archetype_key: string; intent: string; title: string; hook: string };
type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

type Candidate = {
  topic: Topic;
  family: string;
  reservationId: string | null;
  result: ReturnType<typeof validateCopy> | null;
  /**
   * Ce que CE candidat a coûté.
   *
   * ⚠ IL MANQUAIT, ET LE LIVRE MENTAIT EN GRAND. `validateCopy` ne rend pas
   * d'`usage` ; le règlement retombait donc sur le cumul du mois, et chacun
   * des vingt-neuf succès inscrivait au ledger la dépense de tout le mois.
   * Un livre qui multiplie par trente est pire qu'un livre vide : le premier
   * a l'air d'un chiffre.
   */
  usage: Usage;
};

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This spends money.\n");
    process.exit(1);
  }
  const started = Date.now();
  const key = anthropicKeyOrDie();
  const db = admin();
  const client = new Anthropic({ apiKey: key });
  const { userId, projectId, kitId } = await accountFor(db, arg("email"));

  /*
   * ── ⚠ LA SEULE PORTE D'UN APPEL PAYANT, ET ELLE EST OUVERTE ICI ───────
   *
   * Mesuré : dix mois, trois cents posts, `credit_ledger` inchangé (F25). Le
   * port est défini AVANT le premier appel du script — la dérivation des
   * thèmes — parce que les helpers `reserve`/`settle` d'avant étaient déclarés
   * quatre cents lignes plus bas, après elle. Un appel payant écrit au-dessus
   * de sa comptabilité est un appel qu'aucune comptabilité ne voit.
   */
  const credits: CreditPort = {
    async reserve(spec) {
      const { data } = await db.rpc("reserve_credit", {
        p_user: spec.userId, p_kind: spec.kind, p_reason: spec.reason,
        p_provider: spec.provider ?? "anthropic", p_model: spec.model ?? massCopyModel(),
        p_month: spec.month ?? MONTH,
      } as never);
      /*
       * ⚠ LE MOTIF EST LU, PLUS ÉCRASÉ (F47). Cette ligne rendait `null` pour
       * les sept motifs de `reserve_credit`, et l'appelant annonçait « quota »
       * pour cinq causes qui n'en sont pas — ce que le commentaire de la RPC
       * elle-même avertit de ne pas faire.
       */
      const row = data as unknown as { ok?: boolean; reservation_id?: string; reason?: string } | null;
      if (row?.ok === true && row.reservation_id) {
        return { ok: true as const, reservationId: row.reservation_id };
      }
      return { ok: false as const, reason: reserveRefusal(row?.reason) };
    },
    async settle(reservationId, costUsd, succeeded) {
      /*
       * ⚠ LE SEUL GOULOT OÙ PASSE CHAQUE DOLLAR. Frais généraux et crédits de
       * post se soldent ici, tous les deux : compter ailleurs aurait compté la
       * moitié, ce qui est la façon dont un plafond devient décoratif.
       */
      noteSpend(costUsd, `${MONTH} · ${succeeded ? "réglé" : "relâché"}`);
      await db.rpc("settle_credit", {
        p_reservation_id: reservationId,
        p_actual_cost_usd: Number(costUsd.toFixed(6)),
        p_succeeded: succeeded,
      } as never);
    },
  };

  /** Un appel de frais généraux : au livre, sans prendre de crédit. */
  const overhead = <T>(reason: string, run: () => Promise<{ value: T; usage: Usage }>) =>
    withOverhead(credits, { userId, reason, model: massCopyModel(), month: MONTH }, async () => {
      const { value, usage: u } = await run();
      return { value, usage: u, costUsd: syncCostUsd(u) };
    });

  const { data: already } = await db
    .from("content_months").select("id, status").eq("brand_kit_id", kitId).eq("month", MONTH).maybeSingle();
  if (already) {
    console.error(`\n✗ Kit ${kitId} already has a ${MONTH} month (${already.status}).\n`);
    process.exit(1);
  }

  /*
   * ⚠ LE PREMIER MOIS EST SYNCHRONE, ET C'EST UNE PROMESSE PRODUIT. Aucun
   * `content_months` pour ce kit veut dire qu'elle vient de s'abonner et
   * qu'elle regarde l'écran. La Batch API met 25 à 30 minutes, quelle que
   * soit la taille du lot — mesuré quatre fois. Les mois suivants, eux,
   * tombent dans la nuit et le lot est le bon outil.
   */
  const { count: priorMonths } = await db
    .from("content_months").select("id", { count: "exact", head: true }).eq("brand_kit_id", kitId);
  const firstMonth = (priorMonths ?? 0) === 0;
  const useBatch = process.argv.includes("--batch") || (!firstMonth && !process.argv.includes("--sync"));

  /* ── Ce à partir de quoi le mois est écrit ─────────────────────────── */
  const { data: kit } = await db
    .from("brand_kits").select("voice_guide, directions, selected_direction_id").eq("id", kitId).single();
  const { data: preferences } = await db
    .from("content_preferences").select("cadence_per_week, accepted_registers, off_limits")
    .eq("brand_kit_id", kitId).single();
  const { data: checkinRow } = await db
    .from("content_checkins").select("brand_kit_id, month, sessions_theme, taking_clients, happening")
    .eq("brand_kit_id", kitId).eq("month", MONTH).maybeSingle();
  const { data: rules } = await db.from("ethics_rules").select("*");
  /*
   * ── ⚠ LE BRIEF DE CE PROJET-LÀ, ET LA CLAUSE QUI MANQUAIT ─────────────
   *
   * Cette lecture était `.limit(1).single()` SANS `.eq("project_id", …)`.
   * Elle rendait donc la PREMIÈRE ligne de `project_briefs`, quel que soit le
   * compte dont on écrivait le mois. Avec quinze praticiennes en base, chaque
   * mois généré depuis le 2026-09-21 a été écrit à partir du brief de
   * « Rowan Mercier Therapy » : son nom de cabinet, sa ville, son État, ses
   * modalités — et sa liste d'autorisation.
   *
   * ⚠ C'EST LA VRAIE CAUSE DE F16. « Rowan Mercier Therapy » sur le mois
   * d'Isla Thornbury n'était pas une identité inventée par le modèle : c'était
   * l'identité D'UNE AUTRE PRATICIENNE, servie par une clause `where`
   * manquante. Le modèle n'a fabriqué que l'adresse e-mail, dérivée du nom
   * qu'on venait de lui tendre.
   *
   * ⚠ ET LE CONTRÔLE ÉTAIT AVEUGLE PAR CONSTRUCTION. `checkInventedIdentity`
   * reçoit `practiceName` et `allowList` de cette même lecture : il AUTORISAIT
   * donc « Rowan Mercier Therapy » sur les quinze comptes, et aurait signalé
   * le vrai nom de chacune. Un filet nourri par la source qu'il surveille ne
   * surveille rien.
   *
   * Le produit, lui, lit ses briefs par `project_id` partout
   * (`lib/app/header-context.ts`, `lib/images/context.ts`) : le défaut était
   * dans ce harnais seul. Il reste la spécification du chemin serveur, qui
   * n'écrit pas encore de mois.
   */
  const { data: brief } = await db
    .from("project_briefs")
    .select("practice_name, positioning, usp_statement, city, state, modality_ids, license_type_id, license_number, license_state_code")
    .eq("project_id", projectId)
    .single();
  if (!preferences || !rules?.length || !brief) throw new Error("the account is not complete");

  const directions = (kit?.directions ?? []) as Array<{ id: string; palette: never }>;
  const direction = directions.find((d) => d.id === kit?.selected_direction_id) ?? directions[0];
  const practiceName = brief.practice_name ?? "the practice";

  /*
   * ── ⚠ UN MOIS NE PART PAS SANS LA MENTION DE LICENCE ──────────────────
   *
   * Quatre cents posts ont été produits sans une seule (F35). Californie B&P
   * §4980.44, §4996.2 et §4999.80 l'exigent dans TOUTE publicité, et d'autres
   * États imposent l'équivalent : c'étaient quatre cents infractions
   * publicitaires, pas un défaut de style.
   *
   * ⚠ ET LE REFUS EST ICI, PAS DANS LE CONTRÔLE DE MOIS. Un contrôle qui
   * refuserait le mois à la fin aurait laissé payer soixante-douze appels pour
   * un mois qu'on savait irrecevable avant de commencer. Ce qui manque est un
   * champ de brief : on le dit avant de dépenser, et on nomme le champ.
   */
  const { data: abbreviationRow } = await untypedTable<{ abbreviation: string | null }>(
    db, "license_type_states"
  )
    .select("abbreviation")
    .eq("license_type_id", brief.license_type_id ?? "")
    .eq("state_code", (brief.license_state_code ?? brief.state ?? "").toUpperCase())
    .maybeSingle();

  const licence = {
    licenseTypeId: brief.license_type_id,
    licenseNumber: brief.license_number,
    abbreviation: abbreviationRow?.abbreviation ?? null,
  };
  const licenceRefusal = licenceMissingMessage(licence);
  if (licenceRefusal) {
    console.error(`\n✗ ${licenceRefusal}\n`);
    process.exit(1);
  }
  const mention = licenceMention(licence)!;
  console.error(`▸ mention de licence : ${mention}`);
  /*
   * ── ⚠ LE MODE TÉMOIN SE CRIE, IL NE SE DEVINE PAS ─────────────────────
   *
   * `CONTENT_PREFIX_BASELINE=1` retire les trois consignes du 2026-09-26 pour
   * séparer leur effet de celui du portillon. Un run fait dans ce mode n'est PAS
   * comparable aux autres, et son rapport le porte (`prefixBaseline`). Sans ce
   * cri, une variable oubliée dans un shell ferait passer un mois témoin pour un
   * mois de référence, et la mesure suivante partirait d'un chiffre faux.
   */
  if (prefixBaselineMode()) {
    console.error(
      "\n⚠⚠ MODE TÉMOIN — les trois consignes de classes sont RETIRÉES du préfixe.\n" +
      "   Ce mois sert à séparer l'effet du portillon de celui des consignes.\n" +
      "   Aucun contrôle n'est relâché : il sera refusé plus souvent, jamais moins.\n"
    );
  }

  /*
   * ── ⚠ « CORRECTAMYTH » A ÉTÉ IMPRIMÉ SUR UNE CARTE PUBLIABLE ──────────
   *
   * Le champ s'appelle `angleLabel` et attend un LIBELLÉ. Cette ligne lui
   * passait `topic.intent`, qui est un IDENTIFIANT : `correct_a_myth`,
   * `behind_the_practice`. Le rendu met en capitales et retire la ponctuation,
   * donc le tiret bas disparaissait et les mots se collaient — un code interne
   * publié en haut d'une carte de clinicienne, en gras, en mono.
   *
   * Le chemin produit (`lib/content/review.ts`) lisait déjà `angle_label`. Le
   * harnais, non. C'était la MÊME fonction de rendu avec deux appelants, dont
   * un seul juste, et c'est le harnais qui fabrique les planches qu'on note.
   *
   * ⚠ LE CATALOGUE EST LU UNE FOIS, PAS PAR CARTE. Cinq lignes, trente
   * cartes : une jointure par carte serait trente allers-retours pour une
   * table qui ne bouge pas pendant un mois.
   */
  const { data: intentRows } = await db.from("content_intents").select("id, label");
  const intentLabels = new Map(
    (intentRows ?? []).map((r) => [r.id as string, r.label as string])
  );
  /*
   * La ville et l'État viennent du brief, pas du bilan — mais ils fuitaient
   * sur les cartes de la même façon (« Oakland, California » en libellé de
   * diagramme), et c'est le même contrôle qui les arrête.
   */
  const briefLocation = [brief.city, brief.state].filter(Boolean).join(", ") || null;

  /*
   * ── ⚠ LA CARTE PRATICIENNE SE REMPLIT, ELLE NE S'ÉCRIT PAS ────────────
   *
   * Ses lignes viennent du brief que la praticienne a saisi. Si le brief n'en
   * porte pas assez, `practitionerLines` rend `null` et l'archétype n'est PAS
   * TIRÉ du tout — le mélange se rééquilibre sur les dix autres plutôt que de
   * livrer une carte à moitié vide, ou pire, une carte inventée.
   */
  const facts: PractitionerFacts = {
    practiceName: brief.practice_name ?? null,
    city: brief.city ?? null,
    state: brief.state ?? null,
    // ⚠ Le libellé tel qu'il est en base, sinon l'identifiant en capitales :
    // « emdr » devient « EMDR », qui est ce qu'une carte doit porter.
    modalities: ((brief.modality_ids ?? []) as string[]).map((id) => id.toUpperCase()),
    takingClients: (checkinRow?.taking_clients ?? null) as PractitionerFacts["takingClients"],
  };
  const practitionerPayload = (() => {
    const lines = practitionerLines(facts);
    return lines ? { lines } : null;
  })();
  const allowList = identityAllowList(facts);
  if (!practitionerPayload) {
    console.error("▸ practitioner_card écarté : le brief ne porte pas assez de faits");
  }

  const voice = (() => {
    const guide = kit?.voice_guide as { tone?: string; sounds_like?: string[] } | null;
    return [guide?.tone, ...(guide?.sounds_like ?? [])].filter(Boolean).join(" · ") || "plain, warm, unhurried";
  })();
  const brand: BrandContext = {
    practiceName, voice, offLimits: preferences.off_limits ?? "", ethicsRules: rules,
  };

  const checkin = (checkinRow ?? null) as ContentCheckin | null;
  /*
   * ⚠ LA DÉRIVATION DES THÈMES EST UN APPEL PAYANT, ET ELLE N'ÉTAIT DANS
   * AUCUN COMPTEUR. `oneLine` jetait `response.usage` : son coût n'était pas
   * seulement absent du livre, il était inconnu. Le puits le rend maintenant,
   * et `overhead` l'inscrit sans prendre de crédit à la praticienne — un mois
   * n'a pas à lui coûter un post pour choisir ses trois thèmes.
   */
  const themesUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const themes = (await overhead("month themes", async () => {
    const model = anthropicContentModel(rules, (u) => {
      themesUsage.input += u.input;
      themesUsage.output += u.output;
    });
    const value = await deriveThemes(model, {
      month: MONTH,
      checkin,
      briefContext: [brief.positioning, brief.usp_statement].filter(Boolean).join("\n"),
      offLimits: preferences.off_limits ?? null,
    });
    return { value, usage: themesUsage };
  })).value;
  console.error(`▸ themes (${themes.source}): ${themes.themes.join(" · ")}`);
  console.error(`▸ ${firstMonth ? "FIRST month → synchronous" : "a later month"} · ${useBatch ? "Batch API" : "sync calls"}`);

  await guardTheBank(db, kitId);

  /* ── Les candidats, tirés par famille — DÉLÉGUÉ À `lib/content/month/draw.ts` ──
   *
   * ⚠ CENT SOIXANTE-DIX LIGNES SONT SORTIES D'ICI, ET LE HARNAIS LES APPELLE.
   *
   * Le tirage était inline, et le chemin produit n'en avait rien : le recensement
   * du 2026-09-26 exemptait `assign_topic_to_kit` et `drawable_count_for_kit` au
   * motif que « le chemin produit ne tire pas de sujets ». F45 avait pourtant déjà
   * tranché que ce générateur DEVIENT le chemin produit — la raison de l'exemption
   * décrivait un état que la décision avait supprimé.
   *
   * ⚠ ET C'EST UNE DÉLÉGATION, PAS UNE COPIE. L'assemblage garde deux
   * implémentations pour une session, faute de pouvoir rejouer un mois ; le
   * tirage, lui, ne dépense rien et `release_stale_topic_assignments()` répare une
   * assignation fautive au bout de trois heures. Le rayon d'action d'une erreur de
   * portage est borné par un mécanisme qui existe déjà, donc une seule
   * implémentation.
   *
   * Le module est FIDÈLE, y compris là où le comportement est discutable : la
   * ronde vide la banque de sa famille quand les doublons refusent tout. Cf. F51.
   */
  const perFamily = Math.ceil(CANDIDATES / 3);
  const draw = await drawMonth(
    serverDrawPort(db as unknown as DrawRpcClient, { kitId, month: MONTH }),
    {
      families: FAMILIES,
      drawOrder: [...DRAW_ORDER],
      perFamily,
      candidates: CANDIDATES,
      practitionerCap: PRACTITIONER_CARDS_PER_MONTH,
      practitionerPayload: practitionerPayload !== null,
    }
  );

  /*
   * ⚠ LA FORME DU HARNAIS EST RECONSTRUITE ICI, PAS DANS LE MODULE. `Candidate`
   * porte `reservationId`, `result` et `usage` — trois champs qui n'ont rien à
   * faire dans un tirage. Les y mettre aurait fait dépendre le module de ce que
   * l'écriture en fait ensuite.
   */
  const candidates: Candidate[] = draw.drawn.map(({ topic, family }) => ({
    topic: topic as Topic,
    family,
    reservationId: null,
    result: null,
    usage: ZERO(),
  }));
  const drawnIds = draw.drawn.map((c) => c.topic.id);
  const shortfall = draw.shortfall;
  const rejected = draw.rejected;
  const releasedEarly = draw.releasedEarly;

  /*
   * ── ⚠ EN ALTERNANCE, PAS PAR PAQUETS ──────────────────────────────────
   *
   * Les candidats sont tirés famille par famille, ce qui est commode pour le
   * tirage et catastrophique pour l'écriture : si la génération s'arrête tôt —
   * quota atteint, plafond de dépense, panne — les premiers écrits sont tous
   * de la même famille. Mesuré : un arrêt à 11 posts a rendu 11 cartes à une
   * phrase et zéro diagramme.
   *
   * Alterner met le mélange à l'abri de l'arrêt : les onze premiers posts
   * d'un mois interrompu ressemblent au mois entier.
   */
  const byFamily = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = byFamily.get(candidate.family) ?? [];
    list.push(candidate);
    byFamily.set(candidate.family, list);
  }
  const interleaved: Candidate[] = [];
  for (let round = 0; interleaved.length < candidates.length; round += 1) {
    for (const family of Object.keys(FAMILIES)) {
      const item = byFamily.get(family)?.[round];
      if (item) interleaved.push(item);
    }
    if (round > candidates.length) break;
  }
  candidates.length = 0;
  candidates.push(...interleaved);

  console.error(`▸ ${candidates.length} candidates drawn for ${WANTED} posts`);

  /* ── L'écriture ────────────────────────────────────────────────────── */
  const checkinLine = [checkin?.sessions_theme, checkin?.happening].filter(Boolean).join(" ");
  const asRequest = (c: Candidate): TopicRequest => ({
    topicId: c.topic.id, archetypeKey: c.topic.archetype_key,
    title: c.topic.title, hook: c.topic.hook, intent: c.topic.intent, checkin: checkinLine,
  });

  /*
   * ── ⚠ « REFUSÉ » ET « JAMAIS TENTÉ » NE SONT PAS LE MÊME CHIFFRE ──────
   *
   * L'entonnoir comptait `generated` — « les candidats qui ont un résultat » —
   * et un résultat d'échec en est un. Le 2026-09-24, trois lots sont revenus
   * `{"succeeded":0,"errored":72}` faute de solde chez le fournisseur, et
   * l'entonnoir a annoncé **72 générés, 0 conformes** : un taux de conformité
   * de zéro pour cent, sur une écriture qui n'avait pas eu lieu.
   *
   * ⚠ C'EST LE CHIFFRE QUE CETTE SESSION MESURE, et il était faux dans le
   * sens qui fait conclure au défaut d'écriture. Une réponse qui n'existe pas
   * ne se compare à rien : `answered` est le dénominateur, et
   * `neverAnswered` sort de la mesure.
   */
  const funnel = {
    candidates: candidates.length,
    /** Ceux pour qui le modèle a rendu du texte. ⚠ Le seul dénominateur juste. */
    answered: 0,
    /** Ceux pour qui le fournisseur n'a rien rendu — solde, quota, lot expiré. */
    neverAnswered: 0,
    /** Ceux dont la réponse est arrivée et qu'on n'a pas su lire. */
    technicalFailures: 0,
    /*
     * ── ⚠ LE DÉNOMINATEUR DE LA CONFORMITÉ N'EST PAS `candidates` ─────────
     *
     * La boucle d'examen s'arrête dès qu'elle tient `WANTED + SPARE_POOL`
     * utilisables : sur 102 tirés, elle en regarde une cinquantaine et laisse
     * les autres intacts. Lire `conformantFirstCall / candidates` donnait donc
     * « 46 sur 102 = 45 % » là où la mesure vraie est « 46 sur 48 = 96 % », et
     * c'est sur ce 45 % qu'on a conclu que la première écriture était le
     * problème.
     *
     * ⚠ UN TAUX SANS SON DÉNOMINATEUR EST UNE OPINION. Le compteur d'examens
     * est donc tenu ici, à côté de celui qu'il divise.
     */
    examined: 0,
    conformantFirstCall: 0,
    repaired: 0,
    refusedAfterRepair: 0,
    quotaRefusals: 0,
  };
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let settlesWithoutReservation = 0;
  const repairUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  /*
   * ⚠ LE JUGE DE COMPLÉTUDE EST UN APPEL PAYANT, DONC IL A SA LIGNE. Un appel
   * qui ne figure dans aucun compteur est un appel qu'on croit gratuit — c'est
   * la classe de défauts de F18 à F25, et elle ne recommence pas ici.
   */
  const judgeUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const reviseUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const failures: Array<{ topic: string; kind: string; because: string }> = [];

  /*
   * ⚠ UN SEUL CHEMIN VERS LE LIVRE, ET C'EST `credits`. Ces deux helpers ne
   * refont pas l'appel RPC : ils délèguent au port défini en tête, pour qu'il
   * n'existe pas deux façons de réserver un crédit — c'était le cas, et l'une
   * des deux n'était branchée que sur le chemin synchrone (F25).
   */
  async function reserve(reason: string): Promise<string | null> {
    const outcome = await credits.reserve({ userId, kind: "post_generation", reason });
    if (!outcome.ok) {
      funnel.quotaRefusals += 1;
      /*
       * ⚠ LE MOTIF EST DIT, PAS DEVINÉ (F47). Il était perdu : un abonnement
       * expiré (`not_entitled`) et un plan mal configuré
       * (`no_quota_configured`) se lisaient tous les deux « quota épuisé », et
       * le rapport comptait un refus de quota pour une cause qui n'en est pas
       * une.
       */
      failures.push({
        topic: reason.slice(0, 60),
        kind: aPurchaseWouldHelp(outcome.reason) ? "quota" : "crédit",
        because: outcome.reason,
      });
      return null;
    }
    return outcome.reservationId;
  }

  /** Règle : succès (le crédit est consommé) ou release AVEC son coût. */
  async function settle(reservationId: string | null, costUsd: number, succeeded: boolean) {
    /*
     * ── ⚠ F49 : SIX DE CES APPELS SUR SEPT PORTENT UNE RÉSERVATION NULLE ───
     *
     * `candidate.reservationId` n'est posé qu'APRÈS un insert réussi (un seul
     * endroit, dans la boucle d'écriture). Les six `settle` placés avant —
     * échec de collecte, échec de réparation, refus déontologique, panne du
     * moteur, refus du portillon, candidats écartés — opèrent donc tous sur
     * `null` et ne font RIEN.
     *
     * ⚠ ET LE COÛT N'EST PAS PERDU POUR AUTANT. La sur-génération est un frais
     * général : une seule réservation de phase porte le coût du lot entier, et
     * elle est soldée au coût réel qu'il aboutisse ou non. Le livre est complet ;
     * ce sont ces six lignes qui prétendent une comptabilité qu'elles ne font pas.
     *
     * ⚠ J'EN AI MÊME ÉLABORÉ UNE EN Y CROYANT. La session du 2026-09-26 a changé
     * le refus du portillon de « solder à zéro » à « solder au coût réel », au
     * nom de F40 — sur une réservation toujours nulle. C'est la règle de F48
     * retournée contre moi : la correction allait dans le sens espéré, et je n'ai
     * pas cherché ce qu'elle comptait de travers.
     *
     * Elles ne sont pas retirées mais COMPTÉES : le rapport porte le nombre, et
     * un nombre non nul dit « cette comptabilité-là est décorative ». Les
     * retirer sans pouvoir rejouer un mois réel serait échanger un mensonge
     * visible contre un trou invisible.
     */
    if (!reservationId) {
      settlesWithoutReservation += 1;
      return;
    }
    await credits.settle(reservationId, costUsd, succeeded);
  }

  /** Les candidats retenus, dans l'ordre où ils se sont avérés utilisables. */
/*
 * ⚠ ON EN GÉNÈRE PLUS QUE TRENTE, ET C'EST CE QUI REND LA CORRECTION
 * POSSIBLE. Les contrôles de mois peuvent refuser un post — titre en double,
 * archétype trop représenté, champ qui recopie le titre — et un pipeline sans
 * remplaçant n'a alors que deux réponses : livrer quand même, ou livrer
 * vingt-neuf posts. Six de rab coûtent un cinquième du mois et donnent au
 * sélecteur de quoi échanger.
 */
/*
 * ── ⚠ LE BANC ET LE TIRAGE VIENNENT DU MÊME ENDROIT (F41) ───────────────
 *
 * `SPARE_POOL` était déclaré ici, à 18, et le tirage était déclaré dans
 * `bank.ts`, à 102. Deux fichiers, aucune expression commune : la boucle
 * d'examen s'arrêtait à 48 utilisables pendant que le lot en payait 101, et rien
 * ne pouvait le voir. Les deux lisent désormais `USABLE_TARGET`, et le tirage
 * s'en déduit — voir `candidatesToSubmit`.
 *
 * ⚠ ET LE COMMENTAIRE QUI AURAIT DÛ L'ATTRAPER DISAIT LE CONTRAIRE : « les
 * candidats du banc sont déjà payés, le lot facture ses cent réponses à la
 * soumission, donc en collecter quarante-huit au lieu de trente-six ne coûte
 * que les réparations ». Juste sur le mécanisme, et il acceptait les cent comme
 * un donné au lieu de demander pourquoi cent.
 */

  /*
   * ── ⚠ LA CARTE PRATICIENNE NE PASSE PAR AUCUN MODÈLE ──────────────────
   *
   * Ses lignes viennent du brief. L'appeler coûterait un appel pour rien —
   * et c'est exactement l'appel dont « Rowan Mercier Therapy » est sortie.
   *
   * ⚠ CE HELPER EXISTE PARCE QUE LA RÈGLE N'ÉTAIT ÉCRITE QUE SUR UN CHEMIN.
   * Le chemin synchrone l'appliquait ; le chemin Batch envoyait la carte au
   * modèle comme les autres. Tant que la banque n'avait AUCUNE carte
   * praticienne libre, le tirage n'en sortait jamais et rien ne le montrait :
   * le premier mois tiré sur une banque remplie est mort sur
   * « no shape written for practitioner_card ». Une règle qui ne vit que sur
   * une branche est une règle qu'on croit avoir.
   */
  const fromBrief = (candidate: Candidate) => ({
    topicId: candidate.topic.id, ok: true,
    payload: practitionerPayload,
    cardLine: clampCardLine(candidate.topic.title),
    caption: candidate.topic.hook ?? "",
    altText: (practitionerPayload?.lines ?? []).join(". "),
    rationale: "Assembled from the brief, not written.",
    usage: ZERO(),
  }) as never;

  const writtenByModel = (candidate: Candidate) =>
    candidate.topic.archetype_key !== "practitioner_card";

  const usable: Candidate[] = [];

  /*
   * ⚠ LE JOURNAL S'OUVRE AVANT LE PREMIER APPEL PAYANT. S'il porte déjà des
   * résultats, ils ont été payés lors d'un passage précédent : on les reprend
   * au lieu de les racheter.
   */
  let journal = loadJournal(MONTH, arg("email") ?? "default");
  const resumed = Object.keys(journal.entries).length;
  if (resumed > 0) console.error(`▸ journal : ${resumed} résultats déjà payés repris`);

  /*
   * ── ⚠ LA PHASE DE CANDIDATURE EST RÉSERVÉE AVANT, SOLDÉE APRÈS ────────
   *
   * Un lot Batch est facturé À LA SOUMISSION : la réservation doit précéder
   * `batches.create`, sinon elle réserve pour une dépense déjà faite. Elle est
   * prise pour la PHASE entière plutôt que par appel — un lot est un acte
   * payant, pas soixante-douze — et soldée au coût réel quand les réponses
   * sont là.
   *
   * En `overhead` : ces appels coûtent et ne prennent aucun crédit. Le quota
   * se tient plus bas, un crédit par post ÉCRIT.
   */
  /*
   * ── ⚠ UN TIRAGE VIDE EST UN REFUS, PAS UNE ERREUR 400 ────────────────
   *
   * Mesuré le 2026-09-24 : sur dix essais lancés en parallèle, les DEUX
   * derniers ont tiré zéro candidat — la banque était prise par les huit
   * premiers, et la fenêtre anti-collision retire à chaque praticienne ce que
   * les autres du même segment viennent d'assigner. Le script est alors mort
   * sur « requests: List should have at least 1 item », une erreur du
   * fournisseur, sans rapport, sans coût et sans motif lisible.
   *
   * C'est un refus ordinaire — le mois ne peut pas être composé — et il doit
   * se lire comme les autres.
   */
  if (candidates.length === 0) {
    console.log(JSON.stringify({
      step: "month", refused: true, monthId: null,
      prepared: 0, wanted: WANTED, bench: -WANTED, costUsd: 0,
      findings: [{
        check: "month.short",
        detail: `0 candidat tiré pour ${WANTED} promis — la banque n'avait plus rien de tirable pour ce segment`,
      }],
      dropped: [],
    }, null, 2));
    throw new Error("le mois ne passe pas ses contrôles : month.short");
  }

  const phaseReservation = await credits.reserve({
    userId, kind: "overhead", reason: `month ${MONTH}: candidate generation`,
  });

  if (useBatch) {
    /*
     * ⚠ UN LOT DÉJÀ SOUMIS SE RATTACHE, IL NE SE RE-SOUMET PAS. Le lot est
     * facturé à la soumission : si un passage précédent l'a créé puis est
     * mort pendant les vingt-cinq minutes d'attente, re-soumettre paierait
     * une seconde fois le même travail. L'identifiant est dans le journal.
     */
    /*
     * ⚠ LE LOT NE PORTE QUE CE QUE LE MODÈLE ÉCRIT. Les cartes praticiennes
     * sont remplies ici, sans appel : les envoyer coûterait un appel chacune
     * et rouvrirait le chemin de F16.
     */
    const asked = candidates.filter(writtenByModel);
    for (const candidate of candidates) {
      if (writtenByModel(candidate)) continue;
      // ⚠ Elle n'appelle aucun modèle : rien à réserver, rien à facturer tant
      // qu'elle n'est pas livrée. Son crédit se prend plus bas, à l'écriture.
      candidate.reservationId = null;
      candidate.result = fromBrief(candidate);
      funnel.answered += 1;
      if (await settleCandidate(candidate)) usable.push(candidate);
    }

    /*
     * ── ⚠ LA SUR-GÉNÉRATION EST UN FRAIS GÉNÉRAL, PAS UN POST ACHETÉ ────
     *
     * Elle réservait un crédit `post_generation` par candidat. Mesuré : sur
     * soixante-douze candidats, le lot n'en portait que VINGT-NEUF — le quota
     * accorde trente posts par mois, donc quarante-deux réservations étaient
     * refusées d'entrée, et le banc ne pouvait pas exister.
     *
     * Le raisonnement était faux, pas le quota. La praticienne a acheté
     * TRENTE POSTS ; qu'il en faille soixante-douze pour en obtenir trente
     * conformes est le coût de la qualité, et c'est le nôtre. Les appels de
     * candidature entrent donc en `overhead` : ils coûtent, ils ne prennent
     * aucun crédit.
     *
     * Le quota reste tenu, et au bon endroit — sur ce qui est LIVRÉ, plus bas,
     * une réservation par post écrit.
     */
    for (const candidate of asked) {
      candidate.reservationId = null;
    }

    const requests = asked.map(asRequest);
    const built = buildBatchRequests(brand, requests);
    let batch;
    if (journal.batchId) {
      /*
       * ── ⚠ ON REPREND LE LOT ET SES SUJETS, PAS LE LOT SEUL ────────────
       *
       * Rencontré en vrai le 2026-09-23 : une reprise a rattaché le bon lot
       * — déjà payé — puis a refait son tirage. Les deux ensembles se sont
       * trouvés identiques et le mois est passé, parce que
       * `next_topic_for_kit` trie par `created_at desc, id` : deux tirages
       * consécutifs sur la même banque rendent la même chose.
       *
       * ⚠ C'EST UNE COÏNCIDENCE D'ORDONNANCEMENT, PAS UNE GARANTIE. Un sujet
       * ajouté, expiré, ou pris par une autre praticienne entre les deux, et
       * la reprise aurait payé un lot dont elle ne savait plus lire les
       * réponses. Les sujets du lot font foi ; le tirage frais est rendu.
       */
      const ofBatch = new Set(journal.topicIds);
      if (ofBatch.size > 0) {
        const stale = candidates.filter((c) => !ofBatch.has(c.topic.id)).map((c) => c.topic.id);
        if (stale.length > 0) {
          await untypedTable(db, "topic_assignments")
            .delete().eq("brand_kit_id", kitId).in("topic_id", stale);
          console.error(`▸ reprise : ${stale.length} sujets du tirage frais rendus`);
        }
        const missing = journal.topicIds.filter((id) => !candidates.some((c) => c.topic.id === id));
        if (missing.length > 0) {
          throw new Error(
            `reprise impossible : ${missing.length} sujets du lot ${journal.batchId} ne sont plus tirables. ` +
            `Effacer .eklio-journal/ abandonne ce lot déjà payé — c'est une décision, pas un nettoyage.`
          );
        }
      }
      console.error(`▸ reprise du lot ${journal.batchId}`);
      batch = await client.messages.batches.retrieve(journal.batchId);
    } else {
      batch = await client.messages.batches.create({ requests: built });
      // ⚠ ÉCRIT AVANT D'ATTENDRE. C'est la seule fenêtre où ça change quelque
      // chose — et AVEC ses sujets : un identifiant sans sa liste est un lot
      // payé dont une reprise ne sait plus lire les réponses.
      journal = rememberBatch(journal, batch.id, asked.map((c) => c.topic.id));
      console.error(`▸ batch ${batch.id} · ${requests.length} candidates`);
    }

    /*
     * ── ⚠ L'ATTENTE N'AVAIT AUCUNE BORNE ─────────────────────────────────
     *
     * `while (status !== "ended")` toutes les quinze secondes, sans fin. Un lot
     * qui n'aboutit jamais — compte suspendu, lot expiré côté fournisseur,
     * identifiant rejoué qui n'existe plus — laissait le run tourner
     * indéfiniment sans qu'aucune ligne ne le dise. Mesuré six fois : un lot
     * met vingt-cinq à trente minutes ; quatre-vingt-dix est donc trois fois
     * la durée observée, et ce qui dépasse n'est plus une attente.
     *
     * ⚠ ET LE JOURNAL PORTE L'IDENTIFIANT AVEC SES SUJETS, donc abandonner
     * l'attente ne perd pas le lot : une reprise le relit (F23).
     */
    const BATCH_DEADLINE_MS = 90 * 60 * 1000;
    const waitingSince = Date.now();
    let status = batch;
    while (status.processing_status !== "ended") {
      if (Date.now() - waitingSince > BATCH_DEADLINE_MS) {
        throw new Error(
          `le lot ${batch.id} n'a pas abouti en 90 minutes (${status.processing_status}, ` +
          `${JSON.stringify(status.request_counts)}) — il est payé et le journal le garde : reprendre avec --batch-id`
        );
      }
      await new Promise((r) => setTimeout(r, 15000));
      status = await client.messages.batches.retrieve(batch.id);
      console.error(`  … ${status.processing_status} ${JSON.stringify(status.request_counts)}`);
    }

    /*
     * ── ⚠ UN LOT QUI SE TERMINE TOUT EN ERREUR N'EST PAS UN LOT DE RÉPONSES ──
     *
     * Mesuré : `{"succeeded":0,"errored":72}`, trois fois de suite, parce que
     * le solde du compte fournisseur était épuisé. Le run a continué comme si
     * de rien n'était, a écrit « le mois ne passe pas ses contrôles :
     * month.short », et c'est ce qu'on a lu d'abord — un mois court, donc un
     * défaut de génération. Il n'y avait pas eu de génération.
     */
    const counts = status.request_counts;
    if (counts.succeeded === 0 && counts.errored > 0) {
      /*
       * ⚠ ET ON S'ARRÊTE LÀ, plutôt que de continuer et d'être refusé sur
       * `month.short`. Poursuivre produisait un verdict de CONTENU — « un
       * mois court, donc un défaut de génération » — pour une écriture qui
       * n'avait pas eu lieu, et c'est ce verdict-là qu'on lit en premier.
       * Un essai sans réponse du modèle n'est pas un essai refusé : il ne
       * compte dans aucun taux, et il ne se relit pas.
       */
      console.log(JSON.stringify({
        step: "month", refused: false, neverRan: true,
        batchId: batch.id, requestCounts: counts,
        note: "aucune réponse du modèle — ce n'est pas un défaut d'écriture",
      }, null, 2));
      throw new Error(
        `le lot ${batch.id} s'est terminé SANS AUCUNE RÉPONSE (${counts.errored} en erreur) — ` +
        `vérifier le compte fournisseur (solde, limites). Aucun essai n'a eu lieu : rien à relire.`
      );
    }

    /*
     * ⚠ CHAQUE RÉSULTAT EST ÉCRIT DÈS QU'IL ARRIVE. Le flux rendait tout en
     * mémoire avant qu'une seule ligne ne soit persistée : une panne à la
     * dernière réponse jetait les trente précédentes, toutes payées.
     */
    const entries: Array<{ custom_id: string; result: { type: string; message?: Anthropic.Message } }> = [];
    const byCustom = new Map(built.map((b, i) => [b.custom_id, asked[i]]));
    for await (const entry of await client.messages.batches.results(batch.id)) {
      entries.push(entry as never);
      const candidate = byCustom.get((entry as { custom_id: string }).custom_id);
      const message = (entry as { result?: { message?: Anthropic.Message } }).result?.message;
      if (candidate && message) {
        journal = rememberResult(journal, candidate.topic.id, {
          result: null,
          usage: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
            cacheRead: message.usage.cache_read_input_tokens ?? 0,
            cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
          },
          settled: false,
        });
      }
    }
    const byTopic = new Map(asked.map((c) => [c.topic.id, c.topic.archetype_key]));
    for (const result of collectCopy(entries, byTopic)) {
      const candidate = asked.find((c) => c.topic.id === result.topicId);
      if (candidate) candidate.result = result;
    }
    /*
     * ⚠ COMPTÉ PAR FAMILLE, PAS PAR PRÉSENCE D'UN RÉSULTAT. Un candidat dont
     * le lot a erré porte un résultat — d'échec — et le compter comme
     * « généré » est exactement ce qui a fait lire une panne de facturation
     * comme un taux de conformité nul.
     */
    for (const c of candidates) {
      if (!c.result) continue;
      if (c.result.family === "unavailable") funnel.neverAnswered += 1;
      else if (c.result.family === "technical") funnel.technicalFailures += 1;
      else funnel.answered += 1;
    }
    for (const candidate of asked) {
      if (candidate.result?.usage) candidate.usage = candidate.result.usage;
      if (usable.length >= USABLE_TARGET) break;
      if (await settleCandidate(candidate)) {
        usable.push(candidate);
      } else {
        await settle(candidate.reservationId, batchCostUsd([candidate.usage]), false);
        candidate.reservationId = null;
      }
    }
    for (const u of asked.map((c) => c.result?.usage).filter(Boolean)) {
      usage.input += u!.input; usage.output += u!.output;
      usage.cacheRead += u!.cacheRead; usage.cacheWrite += u!.cacheWrite;
    }
  } else {
    /*
     * ⚠ SÉQUENTIEL, ET C'EST CE QUI REND LE CACHE UTILE. Le préfixe d'un
     * archétype est identique d'un candidat au suivant ; les envoyer l'un
     * après l'autre laisse le cache se remplir puis servir. En parallèle, les
     * premiers partent tous avant que le premier soit revenu, et chacun paie
     * l'écriture du cache.
     */
    for (const candidate of candidates) {
      if (usable.length >= USABLE_TARGET) break;
      funnel.examined += 1;

      /*
       * ── ⚠ LE QUOTA SE TIENT SUR CE QUI EST LIVRÉ, PAS SUR CE QU'ON TENTE ─
       *
       * Il était réservé ici, un crédit par candidat. Mesuré sur le chemin
       * Batch, où la règle est la même : sur soixante-douze candidats, vingt-
       * neuf seulement passaient — trente crédits par mois, donc quarante-deux
       * refus d'entrée, et aucun banc possible.
       *
       * La praticienne a acheté TRENTE POSTS ; qu'il en faille soixante-douze
       * pour en obtenir trente conformes est le coût de la qualité, et c'est
       * le nôtre. Les candidatures sont donc des frais généraux, et le crédit
       * se prend à l'écriture.
       */
      candidate.reservationId = null;

      /*
       * ── ⚠ LA CARTE PRATICIENNE NE PASSE PAS PAR LE MODÈLE ──────────────
       *
       * Ses lignes sont déjà assemblées depuis le brief. L'appeler ici ne
       * coûterait pas seulement un appel pour rien : c'est exactement
       * l'appel qui a fabriqué « Rowan Mercier Therapy ». On garde la
       * légende et le texte alternatif, qui eux sont du contenu — mais le
       * payload, jamais.
       */
      if (!writtenByModel(candidate)) {
        candidate.result = fromBrief(candidate);
        funnel.answered += 1;
        funnel.conformantFirstCall += 1;
        if (await settleCandidate(candidate)) usable.push(candidate);
        continue;
      }

      /*
       * ⚠ UN RÉSULTAT DÉJÀ PAYÉ NE SE RACHÈTE PAS. Le journal porte la sortie
       * du modèle et le fait qu'un crédit ait été soldé pour elle ; une
       * reprise saute l'appel ET le règlement, sinon le second passage
       * facturerait un crédit de plus pour le même post.
       */
      const already = journal.entries[candidate.topic.id];
      if (already?.result) {
        candidate.result = already.result as typeof candidate.result;
        candidate.usage = already.usage;
        funnel.answered += 1;
        if (already.settled) {
          usable.push(candidate);
        } else if (await settleCandidate(candidate)) {
          journal = rememberResult(journal, candidate.topic.id, { ...already, settled: true });
          usable.push(candidate);
        }
        continue;
      }

      const request = asRequest(candidate);
      const message = await client.messages.create({
        model: massCopyModel(),
        max_tokens: 2000,
        system: cachedPrefix(brand, candidate.topic.archetype_key),
        output_config: { effort: copyEffort() },
        messages: [{ role: "user", content: variablePart(request) }],
      });
      funnel.answered += 1;
      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      candidate.result = { ...validateCopy(candidate.topic.archetype_key, text), topicId: candidate.topic.id };

      /*
       * ⚠ ÉCRIT ICI, PAS À LA FIN DE LA BOUCLE. L'appel est payé : à partir de
       * cet instant, une panne ne doit plus pouvoir effacer ce qu'il a rendu.
       */
      journal = rememberResult(journal, candidate.topic.id, {
        result: candidate.result,
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens ?? 0,
          cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
        },
        settled: false,
      });

      /*
       * ⚠ LE VERDICT TOMBE ICI, ET LE CRÉDIT AVEC. Un candidat refusé rend sa
       * réservation tout de suite — avec son coût — et la place se libère
       * pour l'essai suivant. C'est ce qui rend la sur-génération possible
       * sous un quota de trente.
       */
      candidate.usage = {
        input: message.usage.input_tokens, output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
        cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      };
      const cost = syncCostUsd(candidate.usage);
      if (await settleCandidate(candidate)) {
        // Le crédit est réglé : le journal le dit, pour qu'une reprise ne le règle pas deux fois.
        const entry = journal.entries[candidate.topic.id];
        if (entry) journal = rememberResult(journal, candidate.topic.id, { ...entry, settled: true });
        usable.push(candidate);
      } else {
        await settle(candidate.reservationId, cost, false);
        candidate.reservationId = null;
      }
    }
  }

  /* ── La réparation, champ par champ ────────────────────────────────── */

  /**
   * Rend `true` quand le candidat est utilisable après réparation.
   *
   * ⚠ APPELÉE DANS LA BOUCLE, PAS APRÈS. Tant que la réparation tournait en
   * seconde passe, la réservation d'un candidat raté restait ouverte jusqu'à
   * la fin ; trente essais suffisaient à remplir un quota de trente, échecs
   * compris, et le trente-et-unième était refusé. Mesuré : 26 posts écrits,
   * 4 crédits immobilisés par des essais qui avaient déjà échoué.
   */
  async function settleCandidate(candidate: Candidate): Promise<boolean> {
    const result = candidate.result;
    if (!result) return false;
    if (result.ok) { funnel.conformantFirstCall += 1; return true; }

    if (result.reason !== "over_budget" || !result.budget?.length || result.payload === undefined) {
      /*
       * ── ⚠ LE MOTIF VIENT DE LA SOURCE, IL NE SE DEVINE PAS ICI ────────
       *
       * « schema » était le motif par défaut, et il a menti 216 fois : trois
       * lots revenus `{"succeeded":0,"errored":72}` faute de solde chez le
       * fournisseur ont été rapportés comme « le modèle a rendu une forme
       * invalide ». Il n'avait rien rendu du tout.
       *
       * ⚠ UN « sinon, schema » RANGE SOUS LE SEUL MOTIF QU'ON SAIT NOMMER
       * tout ce qu'on ne sait pas nommer — y compris ce qui n'est pas de
       * notre côté. La famille est posée par `collectCopy` et `validateCopy`,
       * qui sont les seuls endroits à savoir si une réponse est arrivée.
       */
      const family = result.family ?? "refused";
      const kind =
        family === "unavailable" ? "fournisseur"
        : family === "technical" ? "technique"
        : result.reason === "over_budget" ? "word budget"
        : "schema";
      failures.push({
        topic: candidate.topic.title, kind,
        because: result.reason ?? "unknown",
      });
      return false;
    }

    /*
     * ⚠ LA RÉPARATION EST UN APPEL PAYANT DE PLUS, ET ELLE NE FACTURE PAS.
     * Le crédit du post a déjà été réservé ; réparer son payload ne doit pas
     * en prendre un second. Mais la dépense, elle, entre au livre.
     */
    const repair = (await overhead(`repair ${candidate.topic.archetype_key}`, async () => {
      const value = await repairPayload(
        (params) => client.messages.create(params),
        candidate.topic.archetype_key,
        result.payload
      );
      return { value, usage: value.usage };
    })).value;
    repairUsage.input += repair.usage.input; repairUsage.output += repair.usage.output;
    repairUsage.cacheRead += repair.usage.cacheRead; repairUsage.cacheWrite += repair.usage.cacheWrite;

    if (repair.ok) {
      funnel.repaired += 1;
      candidate.result = { ...result, ok: true, payload: repair.payload, reason: undefined, budget: undefined };
      return true;
    }
    funnel.refusedAfterRepair += 1;
    failures.push({
      topic: candidate.topic.title, kind: "word budget",
      because: repair.remaining.map((b) => `${b.path} said ${b.said}, allowed ${b.allowed}`).join("; "),
    });
    return false;
  }

  
/*
 * ── L'ASSEMBLAGE A DÉMÉNAGÉ (F45, étage D6) ─────────────────────────────
 *
 * `selectDeliverable`, `asMonthPost` et le type `Deliverable` vivaient ici, et
 * c'était la seule chose du dépôt qui savait échanger un post refusé contre un
 * remplaçant du banc. Ils sont dans `lib/content/month/select.ts` : purs, donc
 * portables tels quels, et désormais lisibles par une route.
 *
 * ⚠ LE HARNAIS LES IMPORTE, IL N'EN GARDE PAS DE COPIE. Deux implémentations de
 * l'échange seraient deux façons de décider quel post part — et celle des deux
 * qu'on oublie de corriger est celle qui décide.
 */

/* ── Le mois, puis les posts ───────────────────────────────────────── */
  const prepared = usable;

  const { data: monthRow, error: monthError } = await db
    .from("content_months").insert({
      brand_kit_id: kitId, month: MONTH, themes: themes.themes, status: "proposed",
      theme_source: themes.source, theme_source_text: themes.sourceText,
    }).select("id").single();
  if (monthError || !monthRow) throw new Error(`could not write the month: ${monthError?.message}`);

  /*
   * ── ⚠ LA PASSE DE RÉVISION, AVANT LA COMPOSITION ──────────────────────
   *
   * Elle ne juge pas la conformité — vingt-trois contrôles le font, et mieux :
   * ils comptent des caractères, des mots, des archétypes. Elle relit les
   * candidats ENSEMBLE, ce qu'aucun contrôle par post ne peut faire, et
   * réécrit ce qu'un lecteur verrait : une phrase qui ne dit rien, un libellé
   * qui revient sur sept cartes, deux posts sur la même idée.
   *
   * ⚠ AVANT LA COMPOSITION, PAS APRÈS. Une réécriture appliquée après aurait
   * laissé sur la carte le texte d'avant : le SVG est dessiné une fois, et
   * c'est lui qu'on publie.
   *
   * ⚠ ET C'EST UN FRAIS GÉNÉRAL. La praticienne a acheté trente posts ; qu'il
   * faille les relire est notre affaire, pas un post de moins pour elle.
   */
  const revision = (await overhead("revision pass", async () => {
    const value = await reviseMonth(client, prepared.map((c) => ({
      archetype: c.topic.archetype_key,
      cardLine: c.result!.cardLine ?? c.topic.title,
      payload: c.result!.payload,
      caption: c.result!.caption ?? "",
      altText: c.result!.altText ?? "",
    })));
    return { value, usage: { ...value.usage, cacheRead: 0, cacheWrite: 0 } };
  })).value;
  reviseUsage.input += revision.usage.input;
  reviseUsage.output += revision.usage.output;
  for (const r of revision.revisions) {
    const result = prepared[r.index].result!;
    result.cardLine = r.cardLine;
    result.payload = r.payload;
  }
  console.error(
    revisionOn()
      ? `▸ révision : ${revision.revisions.length} réécrits, ${revision.refused.length} écartés sur ${prepared.length}`
      : "▸ révision : ÉTEINTE (CONTENT_REVISION=off)"
  );
  for (const r of revision.revisions) console.error(`    #${r.index} — ${r.why}`);
  for (const r of revision.refused) console.error(`    #${r.index} ÉCARTÉ — ${r.because}`);

  const registers = preferences.accepted_registers as ContentRegister[];
  const dates = scheduleDates(MONTH.slice(0, 7), [1, 2, 3, 4, 5, 6, 7], WANTED);
  const fallbacks: Array<{ topic: string; from: string; to: string; steps: string }> = [];
  const ethicsFlags: Array<{ topic: string; rule: string; excerpt: string }> = [];
  const checkinLeakFlags: Array<{ topic: string; quoted: string[] }> = [];
  let written = 0;
  /** Les posts entrés en base : leur crédit attend le verdict du mois. */
  const delivered: Candidate[] = [];
  let previousArchetype: Parameters<typeof chooseArchetype>[1] = null;

  /*
   * ── ON PRÉPARE TOUT, ON CONTRÔLE, PUIS ON ÉCRIT ──────────────────────
   *
   * ⚠ L'ORDRE COMPTE. Écrire au fil de la boucle rendait les contrôles de mois
   * inapplicables : quand le trentième post révèle que l'archétype dominant
   * dépasse 30 %, les vingt-neuf premiers sont déjà en base. Rien n'est inséré
   * avant que `checkMonth` se taise.
   */
  type Prepared = {
    candidate: Candidate;
    cardLine: string;
    composeArchetype: string;
    payload: unknown;
    svg: string | null;
    /** La bande de surtitre, telle qu'elle a été composée. */
    eyebrow: string;
    /** Le pied composé, mention de licence comprise. */
    footer: string;
    register: ContentRegister;
    layout: Parameters<typeof chooseArchetype>[1];
    theme: string;
  };
  const readyPosts: Prepared[] = [];

  for (const [index, candidate] of prepared.entries()) {
    const result = candidate.result!;
    const register = registers[index % registers.length];
    const layout = chooseArchetype(register, previousArchetype);
    previousArchetype = layout;

    // ⚠ La majuscule est posée ici comme elle l'est sur l'écran de relecture :
    // par `capitaliseTitle`, qui ne touche pas à un mot portant déjà une
    // capitale. Les titres du mois précédent sortaient tout en minuscules.
    // ⚠ `clampCardLine`, PAS UN `slice(0, 34)`. Une seconde borne, à un autre
    // nombre, dans un autre fichier : celle-ci coupait en plein mot ce que
    // l'autre avait déjà coupé proprement.
    /*
     * ── ⚠ LA PONCTUATION SE NORMALISE ICI, AU SEUL POINT D'ASSEMBLAGE ───
     *
     * Elle l'était dans `validateCopy`, et vingt-sept apostrophes droites
     * sont quand même sorties sur huit essais gelés. Trois chemins la
     * contournaient :
     *
     *   * `result.cardLine ?? candidate.topic.title` — quand le modèle omet
     *     sa ligne, c'est le TITRE DE BANQUE qui sert, et il n'est jamais
     *     passé par là ;
     *   * la réparation, qui remplace le payload normalisé par le sien ;
     *   * `fromBrief`, dont les lignes viennent du brief.
     *
     * ⚠ NORMALISER À TROIS ENDROITS EN AURAIT LAISSÉ UN QUATRIÈME. Le point
     * d'assemblage est le seul par où tout passe.
     */
    const cardLine = typographicQuotes(
      capitaliseTitle(clampCardLine(result.cardLine ?? candidate.topic.title))
    );
    /*
     * ── ⚠ LA LIGNE DE CARTE ÉTAIT HORS DU SCAN DÉONTOLOGIQUE ────────────
     *
     * `scanned` valait `caption + altText + payload`. Le TITRE n'était lu par
     * aucune règle — et « Efficiency can become trauma », signée par une
     * clinicienne EMDR, est un titre (F26). Il entre dans le scan.
     */
    /*
     * ── ⚠ CE SCAN LIT MAINTENANT CE QUE LA GÂCHETTE LIT, ET COMME ELLE ──
     *
     * Il manquait deux choses, et chacune a coûté un mois :
     *
     *   `on_image_text`  la gâchette `content_items_ethics_gate` lit quatre
     *                    colonnes ; ce scan n'en voyait que trois. Le texte
     *                    d'image vient du crochet de banque — contrôlé à son
     *                    insertion, donc propre en principe, et « en principe »
     *                    n'est pas un contrôle.
     *
     *   la lecture       `checkEthics` exempte par défaut les mentions
     *                    prohibitives (« there is no guarantee ») ; la base ne
     *                    les exempte pas. Quatre sondes sur vingt-une passaient
     *                    ici et étaient refusées là-bas.
     *
     * ⚠ ET CE N'EST PLUS LE SEUL POINT DE CONTRÔLE. `checkMonth` porte
     * désormais `checkAdvertisingEthics`, qui voit les mêmes règles sur toutes
     * les surfaces AVANT la sélection — un post fautif y est échangé, au lieu
     * d'être écarté ici et de laisser le mois à vingt-neuf.
     */
    const scanned = [
      cardLine,
      result.caption,
      result.altText,
      candidate.topic.hook,
      JSON.stringify(result.payload),
    ].join("\n");
    const violations = checkEthics(scanned).violations;
    for (const violation of violations) {
      ethicsFlags.push({ topic: candidate.topic.title, rule: violation.ruleId, excerpt: violation.excerpt.slice(0, 80) });
    }
    /*
     * ── ⚠ UNE VIOLATION DÉONTOLOGIQUE ÉCARTE LE POST, ELLE NE LE SIGNALE PAS
     *
     * `ethicsFlags` était une ligne de RAPPORT : le post partait quand même
     * en base. Un catalogue de règles qu'une clinicienne est tenue de
     * respecter, consulté puis ignoré, ne vaut pas mieux que pas de
     * catalogue — et c'est la classe de défauts de F18 à F25, appliquée cette
     * fois à de la déontologie plutôt qu'à un compteur.
     *
     * Le candidat est écarté comme un dépassement de budget : son crédit est
     * rendu, son sujet retourne à la banque, un remplaçant prend sa place.
     */
    if (violations.length > 0) {
      failures.push({
        topic: candidate.topic.title, kind: "ethics",
        because: violations.map((v) => `${v.ruleId}: ${v.excerpt.slice(0, 60)}`).join("; "),
      });
      // ⚠ AU COÛT RÉEL : voir le portillon plus bas. Solder à zéro efface du
      // registre des jetons réellement dépensés.
      await settle(
        candidate.reservationId,
        useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage),
        false
      );
      continue;
    }

    /*
     * ⚠ CE QUE LE BILAN A DIT NE SE RECOPIE PAS SUR LA CARTE. « Oakland,
     * California » et « Evening slots opening October » sont sortis comme
     * libellés de diagramme le mois dernier : le bilan oriente le CHOIX des
     * sujets, il n'est pas du contenu de carte. Seule `practitioner_card` a le
     * droit de le citer, et `checkinLeaks` la nomme.
     */
    const leaks = checkinLeaks(candidate.topic.archetype_key, JSON.stringify(result.payload), {
      sessionsTheme: checkin?.sessions_theme,
      happening: checkin?.happening,
      location: briefLocation,
    });
    if (leaks.length > 0) {
      checkinLeakFlags.push({ topic: candidate.topic.title, quoted: leaks });
    }

    /*
     * ⚠ ON COMPOSE AVANT D'ÉCRIRE, et on enregistre la forme qui a vraiment
     * tenu. Écrire l'archétype demandé sur un post que le moteur a replié
     * donnerait une carte que l'écran de relecture ne saurait pas redessiner.
     */
    let composeArchetype = candidate.topic.archetype_key;
    let payload = result.payload;
    let composedSvg: string | null = null;
    /*
     * ⚠ CALCULÉ ICI, PAS DANS L'APPEL. La valeur composée est celle que le
     * contrôle doit lire : un contrôle qui relirait les ENTRÉES de
     * `eyebrowFor` ne verrait jamais « CORRECTAMYTH », qui est ce que la
     * clinicienne, elle, a vu.
     */
    const eyebrow = eyebrowFor(
      {
        angleLabel: intentLabels.get(candidate.topic.intent) ?? null,
        title: cardLine,
        theme: themes.themes[index % themes.themes.length],
      },
      practiceName
    );
    try {
      const composed = composeWithFallback({
        archetype: candidate.topic.archetype_key,
        payload: result.payload,
        palette: cardPalette(`${monthRow.id}-${index}`, direction.palette, false),
        /*
         * ⚠ LE THÈME EN CAPITALES N'EST PAS UN SURTITRE, ET C'ÉTAIT ÇA LA
         * LIGNE. Un thème dérivé est une PHRASE : les dix cartes d'un même
         * thème portaient les mêmes quatorze mots dans la bande mono. C'est
         * maintenant la règle partagée avec l'écran de relecture — une
         * étiquette d'un à quatre mots, tirée d'abord de ce qui est propre à
         * cette carte.
         */
        eyebrow,
        headline: cardLine,
        // ⚠ La mention y est, sur les onze archétypes : c'est la seule bande partagée.
        footer: `${practiceName} · ${mention}`,
      }, cardLine);
      composeArchetype = composed.archetype;
      payload = composed.payload;
      composedSvg = composed.kind === "carousel" ? composed.slides[0].svg : composed.result.svg;
      if (composed.steps.length > 0) {
        fallbacks.push({
          topic: candidate.topic.title, from: candidate.topic.archetype_key,
          to: composed.kind === "carousel" ? `carousel×${composed.slides.length}` : composed.archetype,
          steps: composed.steps.join("; "),
        });
      }
    } catch (error) {
      failures.push({
        topic: candidate.topic.title, kind: "engine",
        because: error instanceof Error ? error.message.slice(0, 140) : String(error),
      });
      // ⚠ AU COÛT RÉEL : voir le portillon plus bas. Solder à zéro efface du
      // registre des jetons réellement dépensés.
      await settle(
        candidate.reservationId,
        useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage),
        false
      );
      continue;
    }

    readyPosts.push({
      candidate, cardLine, composeArchetype, payload: deepTypographic(payload), svg: composedSvg,
      eyebrow, footer: `${practiceName} · ${mention}`,
      register, layout, theme: themes.themes[index % themes.themes.length],
    });
  }

  /*
   * ⚠ LA PHASE EST SOLDÉE ICI, AU COÛT RÉEL, QU'ELLE AIT ABOUTI OU NON. Les
   * jetons ont été dépensés chez le fournisseur : ils doivent apparaître même
   * si le mois est refusé plus bas.
   */
  if (phaseReservation.ok) {
    await credits.settle(
      phaseReservation.reservationId,
      useBatch ? batchCostUsd([usage]) : syncCostUsd(usage),
      true
    );
  }

  /* ── Les contrôles de mois, et la correction ───────────────────────── */

  /*
   * ── ⚠ LE JUGE DE COMPLÉTUDE, UN APPEL POUR TOUT LE MOIS ───────────────
   *
   * Quatre titres du mois précédent se sont arrêtés avant leur sens, et un
   * seul était lexical : « When life changes without » finit sur une
   * préposition qui ne strande pas. Les trois autres — « The thing that works
   * costs », « High performance masks held », « Success masks an overdriven »
   * — finissent sur des mots ordinaires, et ce qui manque est ce qui vient
   * APRÈS. Aucune liste de mots ne le dit ; trois tours de faux positifs l'ont
   * établi.
   *
   * On demande donc, une fois, sur les seules lignes que le lexique n'a pas
   * tranchées. ⚠ Et un juge muet ne refuse rien : `judgeCompleteness` ne lève
   * jamais et rend un verdict vide en cas de panne.
   */
  const allWritten = writtenLinesIn(readyPosts.map((p) => ({
    archetype: p.composeArchetype, title: p.candidate.topic.title,
    cardLine: p.cardLine, payload: p.payload,
  })));
  const toJudge = undecidedIn(allWritten);
  const judged = (await overhead("completeness judge", async () => {
    const value = await judgeCompleteness(client, toJudge);
    return { value, usage: { ...value.usage, cacheRead: 0, cacheWrite: 0 } };
  })).value;
  judgeUsage.input += judged.usage.input;
  judgeUsage.output += judged.usage.output;
  console.error(`▸ complétude : ${toJudge.length} lignes indécises jugées, ${
    Object.values(judged.verdicts).filter((v) => v === false).length} refusées`);

  /*
   * ── ⚠ CHAQUE POST EST CONTRÔLÉ SEUL, AVANT L'ASSEMBLAGE ───────────────
   *
   * Tous les contrôles tombaient à l'assemblage, sur les trente posts retenus.
   * Un post fautif n'était donc découvert qu'une fois les vingt-neuf autres
   * choisis, et il fallait un ÉCHANGE pour le remplacer : un tour de sélection,
   * un remplaçant pris au banc, et le banc s'épuisait sur des défauts qui
   * n'avaient jamais besoin d'entrer dans le mois.
   *
   * Mesuré : `sable.ingram`, le 2026-09-24, a réussi DIX échanges — tous ses
   * constats de contenu levés — puis est mort sur `month.short`. Les dix
   * défauts se lisaient chacun sur un post seul.
   *
   * ⚠ ICI ET PAS DANS LA BOUCLE DE COMPOSITION, pour une seule raison : le
   * juge de complétude. `text.unfinished` est la classe la plus fournie (62
   * constats sur seize essais) et son verdict vient d'un appel — un par mois,
   * pas un par post. Contrôler plus tôt coûterait trente appels pour gagner
   * quelques secondes.
   *
   * Ce qui est gagné n'est pas du temps, c'est du BANC : un post écarté ici ne
   * consomme aucun échange, et `checkMonth` dans le sélecteur ne voit plus que
   * des constats transversaux — le compte, le mélange, les doublons.
   */
  const postContext = {
    direction: direction.palette as DirectionPalette,
    practiceName,
    identityAllowList: allowList,
    modalities: facts.modalities,
    completeness: judged.verdicts,
    eyebrowCatalogue: [...intentLabels].map(([id, label]) => ({ id, label })),
    licenceMention: mention,
  };
  const clean: typeof readyPosts = [];
  const gateRefusals: Array<{ topic: string; checks: string[] }> = [];
  for (const post of readyPosts) {
    const findings = checkPostAlone(asMonthPost(post), postContext);
    if (findings.length === 0) {
      clean.push(post);
      continue;
    }
    gateRefusals.push({
      topic: post.candidate.topic.title,
      checks: [...new Set(findings.map((f) => f.check))],
    });
    failures.push({
      topic: post.candidate.topic.title, kind: "post gate",
      because: findings.map((f) => f.detail).join("; ").slice(0, 200),
    });
    /*
     * ⚠ AU COÛT RÉEL, PAS À ZÉRO. Les jetons de ce post ont été dépensés chez
     * le fournisseur ; le solder à zéro les efface du registre. `settle_credit`
     * rend `already_settled` sans lever, donc la boucle des écartés plus bas
     * ne peut pas corriger le chiffre — la PREMIÈRE issue est celle qui compte,
     * et c'est celle-ci.
     */
    await settle(
      post.candidate.reservationId,
      useBatch ? batchCostUsd([post.candidate.usage]) : syncCostUsd(post.candidate.usage),
      false
    );
  }
  const gateByCheck = new Map<string, number>();
  for (const r of gateRefusals) for (const c of r.checks) gateByCheck.set(c, (gateByCheck.get(c) ?? 0) + 1);
  console.error(
    `▸ portillon : ${clean.length}/${readyPosts.length} posts passent seuls` +
    (gateByCheck.size > 0
      ? ` — écartés : ${[...gateByCheck].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(", ")}`
      : "")
  );

  /*
   * ⚠ ET SI LE BANC EST ÉPUISÉ, ON LE DIT AVANT D'ÉCRIRE. Le compte est déjà
   * un contrôle (`checkCount`), mais il tombait au bout de la sélection, après
   * des tours d'échange impossibles. Ici la réponse est arithmétique et
   * gratuite : moins de trente posts propres, aucun échange ne peut les
   * inventer.
   */
  if (clean.length < WANTED) {
    console.error(
      `▸ ⚠ ${clean.length} posts propres pour ${WANTED} demandés — aucun échange ne peut combler ` +
      `l'écart. Le mois sera refusé sur month.short ; la cause est en amont, ` +
      `pas dans la sélection.`
    );
  }

  const selection = selectDeliverable(
    clean, direction.palette as DirectionPalette, WANTED, practiceName, allowList,
    [...intentLabels].map(([id, label]) => ({ id, label })), mention,
    facts.modalities, judged.verdicts
  );

  /*
   * ── ⚠ UN `insert` REFUSÉ NE LAISSE PLUS LE MOIS COURT ─────────────────
   *
   * Le 2026-09-24, `sable.ingram` a écrit 29 posts pour 30 : la gâchette
   * déontologique de la base a refusé le trentième, et le mois est tombé sur
   * `month.short` — après trente contrôles verts et dix échanges réussis. Le
   * banc était plein, et personne n'y est allé.
   *
   * La cause de CE refus-là est corrigée ailleurs (F38, et le portillon
   * ci-dessus qui fait passer le socle déontologique avant la dépense). Mais
   * la base porte des contraintes que le code ne réplique pas toutes — un
   * budget de mots, une contrainte de forme — et la bonne réponse à un refus
   * d'écriture n'est pas de rendre le mois court : c'est de prendre le suivant.
   *
   * ⚠ LE REMPLAÇANT VIENT DES POSTS PROPRES NON RETENUS, donc déjà passés par
   * le portillon : il ne peut pas être refusé pour ce qu'un contrôle sait voir.
   * S'il n'y en a plus, le mois sort court et `checkCount` le refuse — ce qui
   * est le bon verdict, et il est alors dit pour la bonne raison.
   */
  const spare = clean.filter((p) => !selection.chosen.includes(p));
  let spareUsed = 0;
  const insertRefusals: string[] = [];

  /*
   * ⚠ UNE FILE, PAS UN TABLEAU FIGÉ. Le remplaçant doit être VISITÉ, et sur le
   * créneau du refusé : itérer une copie l'aurait ignoré, et l'insérer au rang
   * suivant lui aurait donné la date du post d'après — un mois de trente posts
   * sur vingt-neuf jours.
   */
  const queue = [...selection.chosen];
  const insertedPosts: typeof clean = [];

  for (let index = 0; index < queue.length; index += 1) {
    const post = queue[index];
    const { candidate } = post;
    const { error } = await db.from("content_items").insert({
      brand_kit_id: kitId, month_id: monthRow.id, topic_id: candidate.topic.id,
      theme: post.theme,
      register: post.register, archetype: post.layout ?? "statement", compose_archetype: post.composeArchetype,
      payload: post.payload as never, status: "proposed",
      title: post.cardLine, on_image_text: candidate.topic.hook,
      caption: candidate.result!.caption ?? "", alt_text: candidate.result!.altText ?? "",
      rationale: candidate.result!.rationale ?? "",
      scheduled_for: dates[index] ?? dates[dates.length - 1],
    });
    if (error) {
      failures.push({ topic: candidate.topic.title, kind: "database", because: error.message.slice(0, 160) });
      insertRefusals.push(`${candidate.topic.title.slice(0, 34)} — ${error.message.slice(0, 80)}`);
      await settle(candidate.reservationId, 0, false);

      /*
       * ⚠ ON PREND LE SUIVANT, ET ON RÉESSAIE LA MÊME DATE. Le remplaçant
       * occupe le créneau du refusé : décaler les dates ferait sortir un mois
       * de trente posts sur vingt-neuf jours.
       */
      const replacement = spare.shift();
      if (!replacement) {
        console.error("▸ ⚠ insert refusé et plus aucun remplaçant propre — le mois sortira court");
        continue;
      }
      spareUsed += 1;
      // ⚠ MÊME CRÉNEAU, MÊME DATE : on rejoue ce rang avec le remplaçant.
      queue[index] = replacement;
      index -= 1;
      continue;
    }
    insertedPosts.push(post);
    written += 1;
    /*
     * ── ⚠ LE CRÉDIT SE PREND ICI, UN PAR POST ÉCRIT ────────────────────
     *
     * C'est le seul endroit où le quota a un sens : la praticienne a acheté
     * trente POSTS, pas soixante-douze tentatives. Un refus de quota ici
     * arrête l'écriture — elle n'en a pas acheté plus — et le mois sortira
     * court, ce que `checkCount` refusera.
     */
    const reservationId = await reserve(`month ${MONTH}: ${candidate.topic.title.slice(0, 40)}`);
    if (!reservationId) {
      funnel.quotaRefusals += 1;
      failures.push({ topic: candidate.topic.title, kind: "quota", because: "quota_exhausted" });
      break;
    }
    candidate.reservationId = reservationId;

    /*
     * ── ⚠ ET IL SE CONSOMME À LA LIVRAISON, PAS À L'INSERTION ──────────
     *
     * Il était soldé à `true` ICI, dans la boucle d'écriture, donc AVANT le
     * verdict. Un mois refusé consommait ainsi ses trente crédits pour des
     * posts qui restent en `proposed` et que personne ne recevra jamais.
     *
     * ⚠ MESURÉ : LE DEUXIÈME ESSAI D'UN COMPTE N'A PU TIRER QUE 2 POSTS SUR
     * 72. Dix mois refusés, dix mois abandonnés — sujets rendus, posts
     * supprimés — et `credit_balances` disait encore `consumed = 29` sur 30.
     * En production, une praticienne dont le mois échoue ses contrôles
     * paierait deux fois pour en obtenir un, et après deux refus son mois ne
     * serait plus achetable du tout.
     *
     * ⚠ ET CE N'EST PAS UN REMBOURSEMENT. Le livre impose une seule issue par
     * réservation — un règlement OU une restitution, jamais les deux — et
     * cette contrainte est juste. La bonne réponse n'est pas de la contourner
     * mais de ne consommer qu'à la livraison, comme le journal n'efface qu'une
     * fois le mois en base. Même règle, même raison.
     */
    delivered.push(candidate);
  }

  /*
   * ⚠ LE JOURNAL S'EFFACE QUAND LE MOIS EST EN BASE, PAS AVANT. Tant que
   * `content_items` ne porte pas les trente posts, le travail payé n'existe
   * que là.
   */
  clearJournal(journal);

  // Les préparés non retenus n'ont rien publié : leur réservation se solde.
  for (const post of readyPosts) {
    if (!selection.chosen.includes(post)) await settle(post.candidate.reservationId, 0, false);
  }

  /*
   * ── ⚠ ON REND AVANT DE REFUSER, ET L'ORDRE EST LE DÉFAUT ──────────────
   *
   * Ce bloc était APRÈS le refus, donc après un `throw`. Un mois refusé
   * gardait alors pour quatre-vingt-dix jours les sujets sur-générés qu'il
   * n'avait pas publiés — environ vingt-quatre par essai — et leurs crédits
   * n'étaient jamais soldés.
   *
   * ⚠ CHAQUE ESSAI REFUSÉ RENDAIT DONC LE SUIVANT PLUS PAUVRE. C'est le
   * mécanisme de F13 vu de l'intérieur : la banque s'asséchait à mesure qu'on
   * réessayait, et le mois d'après sortait plus court — 23 posts, puis 16 —
   * sans que rien ne dise pourquoi. On cherchait le défaut dans le tirage ; il
   * était dans l'ordre de deux blocs.
   *
   * La restitution ne dépend pas du verdict : ce qui n'a pas été publié n'a
   * rien coûté à la praticienne, qu'on livre ou qu'on refuse.
   */
  /*
   * ── LES CANDIDATS NON RETENUS ─────────────────────────────────────────
   *
   * ⚠ LEUR SUJET RETOURNE À LA BANQUE. Un sujet tiré et non écrit n'a rien
   * coûté à personne et ne doit pas être perdu pour elle : la règle « jamais
   * deux fois » vaut sur ce qui a été PUBLIÉ, pas sur ce qui a été envisagé.
   *
   * ⚠ ET LEUR CRÉDIT REVIENT, AVEC LE COÛT ÉCRIT. Un appel refusé a dépensé
   * des jetons chez le fournisseur et ne doit rien à la praticienne.
   */
  /*
   * ⚠ LES SUJETS GARDÉS SONT CEUX DONT LE POST EST EN BASE, pas ceux qui
   * avaient été retenus. Un `insert` refusé laissait son sujet assigné pour un
   * post qui n'existe nulle part — c'est la classe de F13, appliquée cette
   * fois au refus d'écriture.
   */
  const succeeded = insertedPosts.map((p) => p.candidate);
  const keptTopicIds = new Set(succeeded.map((c: Candidate) => c.topic.id));
  const discarded = candidates.filter((c) => !succeeded.includes(c));
  /*
   * ⚠ LES DOUBLONS ÉCARTÉS AU TIRAGE SONT RELÂCHÉS AVEC LE RESTE. Ils ne sont
   * jamais entrés dans `drawnIds` — `accept` les refuse avant — mais
   * `assign_topic_to_kit` les a bel et bien marqués assignés avant qu'on
   * lise leur titre. Sans cette ligne, chaque doublon refusé retirerait un
   * sujet de la banque pour 90 jours en échange de rien.
   */
  const released = [...releasedEarly, ...drawnIds.filter((id) => !keptTopicIds.has(id))];
  if (released.length > 0) {
    await untypedTable(db, "topic_assignments").delete().eq("brand_kit_id", kitId).in("topic_id", released);
  }
  for (const candidate of discarded) {
    await settle(candidate.reservationId, useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage), false);
  }

  /*
   * ⚠ UN MOIS QUI ÉCHOUE N'EST JAMAIS LIVRÉ. S'il reste un constat après la
   * correction, le mois reste en `proposed` et le script SORT EN ERREUR : la
   * preuve doit s'arrêter là plutôt que de produire une planche qu'on
   * commenterait comme si elle était bonne.
   */
  /*
   * ── ⚠ ET CE QUI A ÉTÉ ÉCRIT, PAS CE QUI A ÉTÉ CHOISI ──────────────────
   *
   * Mesuré le 2026-09-23 : un mois de **29 posts** est sorti sans refus.
   * `checkCount` (F21) avait bien vu trente — mais il regardait la SÉLECTION.
   * Entre la sélection et la base, un insert a échoué, `failures` a gagné une
   * ligne « database », et la boucle a continué. Personne ne recomptait après.
   *
   * ⚠ C'EST F21 UN CRAN PLUS LOIN : contrôler une grandeur en amont de
   * l'écriture ne dit rien de ce qui a été écrit. Le seul nombre qui compte
   * est celui des lignes en base.
   */
  /*
   * ⚠ CONTRE LA SÉLECTION, PAS CONTRE LA CIBLE. Un mois court parce que la
   * banque était vide est DÉJÀ signalé par `checkCount` ; le redire ici avec
   * « des insert(s) ont échoué » nommerait une cause fausse et enverrait
   * chercher le défaut du mauvais côté. Ce constat-ci ne parle que de ce qui
   * s'est perdu ENTRE la sélection et la base.
   */
  /*
   * ⚠ ET IL NE FAUT PAS NOMMER L'INSERT QUAND C'EST LA QUOTA QUI A ROMPU.
   * Mesuré : « 28 insert(s) ont échoué » sur un essai où AUCUN insert n'avait
   * été tenté — la boucle s'était arrêtée au deuxième post, faute de crédit,
   * et les vingt-huit suivants n'ont jamais existé. Le constat envoyait
   * chercher un défaut de base de données là où il y avait un compte à sec,
   * ce que le commentaire juste au-dessus interdit explicitement de faire.
   */
  const missing = selection.chosen.length - written;
  const why = funnel.quotaRefusals > 0
    ? `la quota s'est épuisée après ${written}`
    : `${missing} insert(s) ont échoué`;
  const shortOnWrite: Finding[] = written < selection.chosen.length
    ? [{
        check: "month.short",
        detail:
          `${written} posts écrits pour ${selection.chosen.length} retenus — ${why}`,
      }]
    : [];
  selection.remaining.push(...shortOnWrite);

  /*
   * ⚠ ET LE VERDICT DÉCIDE DES CRÉDITS. Livré : consommés, au coût réel.
   * Refusé : rendus, le coût écrit — les jetons ont bien été dépensés chez le
   * fournisseur, et ils ne doivent rien à la praticienne.
   */
  const monthPasses = selection.remaining.length === 0;
  for (const candidate of delivered) {
    await settle(
      candidate.reservationId,
      useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage),
      monthPasses
    );
  }

  if (selection.remaining.length > 0) {
    console.log(JSON.stringify({
      step: "month", refused: true, monthId: monthRow.id,
      // ⚠ La taille du banc est dans le rapport : sans elle, « aucun post
      // échangé » et « aucun remplaçant disponible » se ressemblent, et on
      // cherche le défaut dans le sélecteur au lieu de la sur-génération.
      prepared: readyPosts.length, wanted: WANTED, bench: readyPosts.length - WANTED,
      /*
       * ⚠ UN ESSAI REFUSÉ A COÛTÉ, ET IL LE DIT. Le coût n'était imprimé que
       * sur le chemin livré : un mois refusé sortait en erreur sans qu'on
       * sache ce qu'il avait dépensé, et compter les essais d'un pipeline
       * revient à compter ce que chacun coûte.
       */
      costUsd: Number(
        (
          (useBatch ? batchCostUsd([usage]) : syncCostUsd(usage)) +
          syncCostUsd(repairUsage) + syncCostUsd(judgeUsage) + syncCostUsd(themesUsage) +
          syncCostUsd(reviseUsage)
        ).toFixed(5)
      ),
      revision: { on: revisionOn(), rewritten: revision.revisions.length, refused: revision.refused.length },
      /*
       * ── ⚠ UN ESSAI REFUSÉ QUI NE DIT PAS SON ENTONNOIR N'APPREND RIEN ──
       *
       * Mesuré en mesurant : deux essais ont été refusés sur `month.short`, et
       * le rapport ne portait ni `funnel` ni `failures` — donc ni la conformité
       * au premier appel, qui est LE chiffre que la session mesure, ni la
       * raison des vingt-huit posts manquants. Il a fallu lire la base pour
       * apprendre que la quota du mois était déjà consommée par une session
       * précédente, sur un compte qui n'avait pourtant aucun `content_months`.
       *
       * ⚠ C'EST ENCORE UNE GRANDEUR JUSTE, CALCULÉE, ET NON PUBLIÉE. Le
       * chemin livré imprimait les deux ; le chemin refusé, qui est le plus
       * fréquent, ne les imprimait pas.
       */
      funnel, failures,
      findings: selection.remaining, dropped: selection.dropped,
    }, null, 2));
    throw new Error(
      `le mois ne passe pas ses contrôles : ${selection.remaining.map((f: Finding) => f.check).join(", ")}`
    );
  }

  const batchCost = useBatch ? batchCostUsd([usage]) : 0;
  const syncCost = useBatch ? 0 : syncCostUsd(usage);
  // ⚠ Le juge de complétude compris : un appel payant entre dans le total.
  const costUsd =
    batchCost + syncCost +
    syncCostUsd(repairUsage) + syncCostUsd(judgeUsage) + syncCostUsd(themesUsage) +
    syncCostUsd(reviseUsage);
  const elapsedSeconds = Math.round((Date.now() - started) / 1000);

  console.log(JSON.stringify({
    step: "month",
    mode: useBatch ? "batch" : "sync",
    firstMonth,
    monthId: monthRow.id,
    elapsedSeconds,
    funnel: {
      ...funnel,
      keptForWriting: succeeded.length,
      written,
      fallbacks: fallbacks.length,
      visualsOnThirty: written,
    },
    mix: Object.fromEntries(
      Object.keys(FAMILIES).map((f) => [f, succeeded.filter((c) => c.family === f).length])
    ),
    shortfall,
    fallbacks,
    failures,
    /*
     * ⚠ LE PORTILLON EST UNE MESURE, PAS UNE TRACE. C'est lui qui dit la
     * conformité au premier appel PAR CLASSE — la seule grandeur qui répond à
     * « est-ce que la consigne a marché ».
     */
    /*
     * ⚠ UN RUN TÉMOIN S'IDENTIFIE DANS SON RAPPORT. C'est ce qui permet à un
     * dépouillement de refuser de le mélanger avec les autres.
     */
    prefixBaseline: prefixBaselineMode(),
    gate: {
      arrived: readyPosts.length,
      passedAlone: clean.length,
      refused: gateRefusals.length,
      byCheck: Object.fromEntries([...gateByCheck].sort((a, b) => b[1] - a[1])),
    },
    inserts: { replacements: spareUsed, refused: insertRefusals },
    /*
     * ⚠ F49 : LE NOMBRE DE RÈGLEMENTS SANS RÉSERVATION. Non nul veut dire que
     * cette comptabilité-là ne fait rien — le coût est porté par la réservation
     * de phase, et ces appels-là sont décoratifs.
     */
    settlesWithoutReservation,
    ethicsFlags,
    releasedTopics: released.length,
    rejectedAsRedundant: rejected,
    themes: { source: themes.source, themes: themes.themes },
    usage, repairUsage, judgeUsage, themesUsage, reviseUsage,
    revision: {
      on: revisionOn(),
      rewritten: revision.revisions.map((r) => ({ index: r.index, why: r.why })),
      refused: revision.refused,
    },
    costUsd: Number(costUsd.toFixed(5)),
    capUsd: SESSION_CAP_USD,
    spentThisRunUsd: Number(runSpendUsd().toFixed(5)),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
