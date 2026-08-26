import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseStoredBriefDraft } from "@/lib/brief/schemas";
import { practiceName } from "@/lib/ai/brief-context";
import { paletteFromStored } from "@/lib/ai/directions";
import { parseStoredKit } from "@/lib/kit/content";
import { FALLBACK_KIT_TIER, parseKitTier } from "@/lib/kit/tiers";
import { BrandKitView } from "@/components/kit/brand-kit-view";
import { GenerateKitButton } from "@/components/kit/generate-kit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { MONTHLY_PRESENCE } from "@/lib/billing/plans";

/*
 * Même raison qu'à la page directions : cette page porte `generateKit` via
 * `GenerateKitButton`, et le `maxDuration` d'un segment couvre les Server
 * Actions qui y sont utilisées.
 *
 * Ici, c'est la REgénération (« Rebuild my brand kit ») — la première
 * génération, elle, part de la page directions, qui porte donc la même valeur.
 * Les deux segments doivent l'avoir : équiper un seul laisserait la moitié des
 * générations sans plafond relevé.
 *
 * 300 s, aligné sur directions et presence.
 */
export const maxDuration = 300;

/*
 * Page de kit. Elle rend le livrable enregistré — elle ne génère rien.
 *
 * Trois états, aucun écran vide :
 * - pas encore de kit → retour aux directions, d'où part la génération ;
 * - kit enregistré mais illisible (forme inattendue en jsonb) → invitation
 *   explicite à régénérer ;
 * - kit lisible → le livrable.
 */
export default async function KitPage({
  params,
}: PageProps<"/app/projets/[id]/kit">) {
  const { id } = await params;
  const supabase = await createClient();

  // La RLS filtre par propriétaire : le projet d'un autre utilisateur est
  // simplement absent du résultat → 404.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: kitRow } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("project_id", id)
    .maybeSingle();

  if (!kitRow) {
    redirect(`/app/projets/${id}/directions`);
  }

  const [{ data: briefRow }, { data: direction }] = await Promise.all([
    supabase.from("project_briefs").select("data").eq("project_id", id).maybeSingle(),
    supabase.from("directions").select("*").eq("id", kitRow.direction_id).maybeSingle(),
  ]);

  const draft = parseStoredBriefDraft(briefRow?.data);
  const kit = parseStoredKit(kitRow.content);

  /*
   * Le tier LIVRÉ vient de la colonne, pas du jsonb. `brand_kits.tier` est
   * contrainte par un CHECK en base mais rendue en `string` par le générateur
   * de types, d'où la relecture. Repli sur le tier des kits d'avant le Lot 4
   * (`content.tier`) puis, à défaut, sur le plus petit : une valeur inattendue
   * ne doit jamais afficher un périmètre plus large que ce qui a été payé.
   */
  const deliveredTier =
    parseKitTier(kitRow.tier) ?? kit?.tier ?? FALLBACK_KIT_TIER;

  const header = (
    <header className="flex items-center justify-between gap-4">
      <Link
        href={`/app/projets/${project.id}/directions`}
        className="font-mono text-sm underline hover:opacity-60"
      >
        ← Directions
      </Link>
      <span className="truncate font-mono text-xs text-ink-muted">
        {project.name}
      </span>
    </header>
  );

  if (!kit) {
    // Contenu stocké illisible : on le dit et on propose la sortie, plutôt que
    // de rendre un livrable à trous.
    return (
      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-10 px-6 py-10">
        {header}
        <EmptyState
          title="We couldn't read this brand kit."
          text="Something about the saved kit doesn't match what we expect. Building it again will replace it."
        >
          <GenerateKitButton projectId={project.id} label="Rebuild my brand kit" />
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-10 px-6 py-10">
      {header}

      <BrandKitView
        practiceName={practiceName(project.name, draft)}
        directionName={direction?.name ?? "your chosen direction"}
        palette={paletteFromStored(direction?.palette)}
        headingFont={direction?.typographie_titre ?? "not specified"}
        bodyFont={direction?.typographie_corps ?? "not specified"}
        kit={kit}
        tier={deliveredTier}
        websitePrompt={kitRow.multi_builder_prompt ?? ""}
      />

      {/*
        La suite du parcours après le kit : le contenu du mois, écrit depuis ce
        kit. Le lien est montré à tout le monde — la page dit elle-même ce
        qu'est l'abonnement quand il n'est pas actif, plutôt que de laisser
        deviner qu'une porte existe.
      */}
      <div className="flex flex-col gap-3 border-t border-rule pt-8">
        <h2 className="font-display text-2xl leading-tight">
          Next: {MONTHLY_PRESENCE.label}.
        </h2>
        <p className="max-w-[55ch] text-sm text-ink-muted">
          {MONTHLY_PRESENCE.tagline}
        </p>
        <Link
          href={`/app/projets/${project.id}/presence`}
          className="w-fit rounded border border-rule px-5 py-2.5 font-mono text-sm transition-colors hover:bg-paper-raised"
        >
          Open {MONTHLY_PRESENCE.label}
        </Link>
      </div>

      <div className="flex flex-col gap-3 border-t border-rule pt-8">
        <p className="text-sm text-ink-muted">
          Want a different take? Rebuilding replaces this kit — your directions
          stay as they are.
        </p>
        <GenerateKitButton
          projectId={project.id}
          label="Rebuild my brand kit"
          variant="secondary"
        />
      </div>
    </div>
  );
}
