import { redirect } from "next/navigation";

import { DirectionsView } from "@/components/directions/directions-view";
import type { Direction } from "@/components/directions/direction-card";
import { getOrCreateWorkspace } from "@/lib/eklio/project";
import { createClient } from "@/lib/supabase/server";

export default async function DirectionsPage() {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();

  const [{ data: kit }, { data: credits }, { data: plans }] = await Promise.all([
    workspace.brandKitId
      ? supabase
          .from("brand_kits")
          .select("id,directions,selected_direction_id")
          .eq("id", workspace.brandKitId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("generation_credits")
      .select("plan_tier,directions_generated,regenerations_used")
      .eq("project_id", workspace.projectId)
      .maybeSingle(),
    supabase.from("plans").select("tier,label,regenerations_limit"),
  ]);

  // Les compteurs sont lisibles pour AFFICHER ce qui reste. La décision de
  // laisser passer un run appartient à `consume_generation_credit`, qui prend
  // le verrou — jamais à ce calcul.
  const plan = plans?.find((p) => p.tier === (credits?.plan_tier ?? "free"));
  const totalRuns = 1 + (plan?.regenerations_limit ?? 1);
  const used = (credits?.directions_generated ?? 0) > 0 ? 1 + (credits?.regenerations_used ?? 0) : 0;

  return (
    <DirectionsView
      brandKitId={kit?.id ?? workspace.brandKitId}
      directions={((kit?.directions as unknown as Direction[]) ?? []) ?? []}
      selectedId={kit?.selected_direction_id ?? null}
      runsLeft={Math.max(totalRuns - used, 0)}
      planLabel={plan?.label ?? "Free"}
    />
  );
}
