import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { getContentItem } from "@/lib/data/content";
import { loadImageContext } from "@/lib/images/context";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";
import { ItemEditor } from "@/components/content/item-editor";
import { ReviewSurface, type LayoutChoice } from "@/components/content/review-surface";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { MonthFailedToLoad, MonthNotDeployed } from "@/components/content/month-states";
import { WritePanel, type WriteAvailability } from "@/components/content/write-panel";
import { suggestTopics } from "@/lib/data/on-demand";
import { contentGenerationArmed } from "@/lib/content/generate/armed";
import { getCreditMeter } from "@/lib/billing/credits";
import { contentMonthKey } from "@/lib/data/content";
import { writeScreen, type PostKind } from "@/lib/content/write-screen";
import { deployEnvName, showsTechnicalDetail } from "@/lib/env/deploy";
import { reviewCardFor } from "@/lib/content/review";
import { layoutAlternatives } from "@/lib/content/alternatives";
import { ethicsLineFor, payloadPublishedText } from "@/lib/content/ethics-line";

/*
 * /app/content/[id] — one item, edited in place.
 *
 * The refusal codes come from the database, in the order it decides them: an
 * item that is not hers is a 404 here, exactly as it is over HTTP, and an
 * unpaid kit is a trip to checkout rather than an empty screen.
 *
 * The photograph is READ, never requested. If `brand_images` already holds a
 * current, ready row for the slot this item names, its signed URL is handed to
 * `<PhotoSlot>`; otherwise the same component renders its gradient. Nothing on
 * this page can cause an image to be generated.
 *
 * ── CE QUE LA RELECTURE A AJOUTÉ ────────────────────────────────────────
 *
 * La carte composée, deux ou trois autres façons de la poser, la ligne
 * déontologique, et les deux gestes qui comptent — copier la légende,
 * télécharger l'image. L'éditeur de champs reste, EN DESSOUS : c'était
 * l'élément le plus visible de l'écran, et ce n'est pas ce qu'elle vient faire.
 *
 * ⚠ TOUT CE QUI EST COMPOSÉ ICI L'EST PENDANT CETTE REQUÊTE, PAR LE VRAI
 * MOTEUR. Aucune image exportée, aucune fixture : si `lib/compose/` refuse une
 * mise en page, la variante n'apparaît pas, et si elle a dû couper des gloses
 * pour tenir, la page le dit sous la carte.
 *
 * ⚠ ET RIEN ICI NE DÉPENSE. Composer est de l'arithmétique. Aucune
 * réservation de crédit n'est prise sur cette page ni sur la route PNG.
 */
export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

export default async function ContentItemPage({ params }: PageProps<"/app/content/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/content/${id}`);

  const result = await getContentItem(supabase, id);
  if (!result.ok) {
    if (result.code === "payment_required") redirect("/app/checkout");
    /*
     * ⚠ UNE PANNE N'EST PAS UN 404, ET C'EST LE DÉFAUT QUI A FAIT LE PLUS DE
     * DÉGÂTS EN PREVIEW.
     *
     * `notFound()` était appelé pour TOUT refus non payant. Quand la base
     * déployée est en retard sur le schéma, chaque post existant répondait
     * donc « cette page n'existe pas » — le seul message qui garantisse que
     * personne n'ira chercher la vraie cause.
     *
     * `not_found` reste un 404, parce qu'il en est un : la base a décidé que
     * cet identifiant n'était pas à elle, et lui dire autre chose
     * confirmerait qu'il existe.
     */
    if (result.code === "not_found") notFound();

    const detail = showsTechnicalDetail() ? (result.detail ?? null) : null;
    const env = showsTechnicalDetail() ? deployEnvName() : null;
    return (
      <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
        <Breadcrumb items={[{ label: "Content", href: "/app/content" }, { label: "This post" }]} />
        {result.code === "not_deployed" || result.code === "schema_mismatch" ? (
          <MonthNotDeployed detail={detail} env={env} />
        ) : (
          <MonthFailedToLoad message={result.message} detail={detail} env={env} />
        )}
      </main>
    );
  }

  const item = result.data;
  const kit = await loadBrandKit(supabase, item.brand_kit_id, user.id);
  if (!kit) notFound();

  const palette = kit.selectedDirection?.palette ?? kit.directions?.[0]?.palette ?? null;
  const tokens = {
    primary: palette?.primary ?? "#2B2724",
    dark_neutral: palette?.dark ?? "#2B2724",
  };

  const photoUrl = await currentPhotoUrl(supabase, kit, item.image_slot);

  /*
   * ⚠ LA CARTE D'ABORD, PARCE QUE LE SCAN DÉONTOLOGIQUE EN DÉPEND. Les
   * libellés du diagramme font partie du texte publié, et ils sont dans le
   * payload du sujet — que seul `reviewCardFor` est allé chercher. Lancer les
   * deux ensemble scannerait la légende sans la carte, ce qui est exactement
   * l'angle mort que la base a fermé.
   */
  const card = await reviewCardFor(supabase, item, palette, kit.practiceName);

  const [labels, ethics] = await Promise.all([
    archetypeLabels(supabase),
    /*
     * ⚠ LE DIAGRAMME EST SCANNÉ AUSSI. Un mot posé sur la carte est publié
     * aussi fort qu'une phrase de légende — c'est l'écart que
     * `20260920160000_a_diagram_label_is_published_text` a fermé côté base, et
     * une ligne d'écran qui ne regarderait que la légende dirait « rien à
     * signaler » d'un texte que la base, elle, regarde.
     */
    ethicsLineFor(supabase, [
      item.title,
      item.caption,
      item.on_image_text,
      item.alt_text,
      ...(card ? payloadPublishedText(card.payload) : []),
    ]),
  ]);

  /*
   * ── CE POST A-T-IL BESOIN D'ÊTRE ÉCRIT ? ──────────────────────────────
   *
   * Pas de légende ET pas de carte composable. Un post avec l'une des deux
   * est un post en cours, pas un post vide : le panneau ne s'impose pas
   * dessus.
   */
  const hasCaption = (item.caption ?? "").trim() !== "";
  const hasTitle = (item.title ?? "").trim() !== "";
  const postKind: PostKind =
    hasCaption || card !== null ? "generated" : hasTitle ? "manual_partial" : "manual_empty";
  const hasHerWords = hasCaption || hasTitle;
  /*
   * ⚠ SA DATE, SINON CELLE DE SA CRÉATION — JAMAIS L'HORLOGE. `Date.now()`
   * pendant un rendu est impur (ESLint le refuse), et c'est un bon refus : un
   * post sans date appartient au mois où il a été créé, pas au mois où elle
   * regarde l'écran. Sinon son quota de janvier se lirait sur septembre.
   */
  const month = contentMonthKey(new Date(item.scheduled_for ?? item.created_at));

  /*
   * ⚠ LES SUGGESTIONS SONT LUES ICI, PAS DANS LE COMPOSANT. `suggest_topics_for_kit`
   * est scopée `auth.uid()` et demande le client de session ; un composant
   * client ferait un second aller-retour pour ce que cette page a déjà le
   * droit de lire. Elles sont gratuites : rien n'est assigné, rien n'est
   * consommé.
   */
  const suggested = postKind !== "generated"
    ? await suggestTopics(supabase, item.brand_kit_id, { month, limit: 3 })
    : null;
  const suggestions = suggested?.ok ? suggested.data : [];

  /*
   * ⚠ LE PANNEAU RESTE VISIBLE QUAND L'ÉCRITURE N'EST PAS ACTIVÉE. Il le dit
   * au lieu de disparaître : sinon la seule chose qu'elle apprend est que ce
   * produit lui demande d'écrire elle-même.
   */
  const meter = postKind !== "generated" ? await getCreditMeter(supabase, month) : null;
  const regenerations = meter?.regeneration ?? null;
  const creditsLeft = regenerations?.remaining ?? null;

  /*
   * ⚠ LA DÉCISION EST DANS `lib/content/write-screen.ts`, PAS ICI. Sa matrice
   * (3 types de post × 3 états) est éprouvée cas par cas ; une cascade de
   * ternaires dans ce fichier ne le serait pas, faute de rendu React dans ce
   * dépôt.
   */
  const screen = writeScreen({
    kind: postKind,
    state: !contentGenerationArmed()
      ? "not_switched_on"
      : creditsLeft !== null && creditsLeft <= 0
        ? "quota_exhausted"
        : "armed",
  });

  const availability: WriteAvailability =
    screen.notice === "not_switched_on"
      ? { kind: "not_switched_on" }
      : screen.notice === "quota_exhausted"
        ? { kind: "quota_exhausted", renewsOn: nextRenewal(month) }
        : { kind: "ready" };

  const layouts: LayoutChoice[] = card
    ? layoutAlternatives({
        archetypeKey: card.archetypeKey,
        payload: card.payload,
        palette: card.palette,
        eyebrow: card.eyebrow,
        headline: card.headline,
        footer: card.footer,
      }).map((alternative) => ({
        ...alternative,
        label: labels[alternative.archetypeKey] ?? alternative.archetypeKey.replace(/_/g, " "),
      }))
    : [];

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb
        items={[
          { label: "Content", href: "/app/content" },
          { label: item.title ?? "Untitled" },
        ]}
      />

      <h1 className="mt-4 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
        {item.title ?? "Untitled"}
      </h1>

      {/*
       * ⚠ LE PANNEAU D'ÉCRITURE PASSE AVANT LA RELECTURE QUAND IL N'Y A RIEN
       * À RELIRE. C'est le cœur du correctif : un post inachevé ouvrait sur
       * un formulaire vide, ce qui est exactement ce que ce produit promet de
       * ne jamais lui montrer.
       *
       * Sur un post déjà écrit, le panneau n'apparaît pas : elle vient le
       * relire, pas le refaire. « Regenerate » est ailleurs et porte son coût.
       */}
      {screen.panel ? (
        <div className="mt-6">
          <WritePanel
            itemId={item.id}
            brandKitId={item.brand_kit_id}
            month={month}
            initialTopics={suggestions}
            availability={availability}
            creditsLeft={creditsLeft}
            hasHerWords={hasHerWords}
          />
        </div>
      ) : null}

      <ReviewSurface
        itemId={item.id}
        caption={item.caption}
        rationale={item.rationale}
        angleLabel={item.topic?.angle_label ?? null}
        ethics={ethics}
        layouts={layouts}
        chosen={item.compose_archetype}
      />

      {/*
       * ⚠ L'ÉDITEUR RESTE, ET IL PASSE DESSOUS. Il porte encore la seule façon
       * de corriger un mot, de dater un post, de cocher « I posted this » et
       * d'alimenter le journal de publication. Ce qui change est son rang :
       * il était le premier élément de l'écran, il est maintenant le second.
       */}
      <div className="mt-10 border-t border-line pt-8">
        <ItemEditor item={item} tokens={tokens} photoUrl={photoUrl} />
      </div>
    </main>
  );
}

/**
 * The signed URL for this item's slot, or `null`.
 *
 * `null` covers every honest case at once: no slot chosen, no photograph
 * generated, a photograph that is stale against the kit's current fingerprint,
 * or one that failed. `<PhotoSlot>` renders the same gradient for all of them,
 * which is what it is for.
 */
async function currentPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kit: NonNullable<Awaited<ReturnType<typeof loadBrandKit>>>,
  slot: string | null
): Promise<string | null> {
  if (!slot) return null;

  const context = await loadImageContext(supabase, kit);
  if (!context.ok) return null;

  const rows = await getBrandImages(supabase, kit.row.id, computeImageFingerprint(context.input));
  const row = rows.find((entry) => entry.slot === slot);
  if (!row?.current || !row.storage_path) return null;

  const signed = await supabase.storage
    .from("brand-assets")
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return signed.data?.signedUrl ?? null;
}

/**
 * Les libellés des mises en page, DEPUIS LA BASE.
 *
 * ⚠ PAS UNE TABLE DE CORRESPONDANCE EN TYPESCRIPT. `content_archetypes.label`
 * est le catalogue ; une seconde copie ici voudrait dire qu'une douzième mise
 * en page arrive à l'écran sans mots. Le repli sur la clef déguisée en mots
 * couvre le cas où la lecture échoue, et il est visiblement moins bon — ce qui
 * est le bon comportement pour un repli.
 */
async function archetypeLabels(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("content_archetypes").select("id, label");
  if (error) {
    /*
     * ⚠ LA TABLE PEUT NE PAS EXISTER ICI, et la page doit s'en remettre. Le
     * repli plus bas déguise la clef en mots — visiblement moins bon qu'un
     * libellé, ce qui est le bon comportement pour un repli. Mais l'échec est
     * dit, sinon « cycle » au lieu de « A cycle » passe pour un choix.
     */
    console.error("[content] archetypeLabels: content_archetypes", {
      code: error.code ?? null,
      message: error.message,
    });
    return {};
  }
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.label]));
}

/**
 * Le 1er du mois suivant, en toutes lettres.
 *
 * ⚠ UNE DATE, PAS « next month ». « Il revient le 1er octobre » se planifie ;
 * « le mois prochain » demande de calculer, et c'est nous qui avons
 * l'information.
 */
function nextRenewal(month: string): string {
  const start = new Date(`${month}T00:00:00Z`);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}
