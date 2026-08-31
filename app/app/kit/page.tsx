import Link from "next/link";
import { redirect } from "next/navigation";

import { KitView, type BuilderTarget } from "@/components/kit/kit-view";
import type { Direction } from "@/components/directions/direction-card";
import { loadOutput } from "@/lib/actions/kit";
import { brandKitEntitled } from "@/lib/eklio/rpc";
import { getOrCreateWorkspace } from "@/lib/eklio/project";
import { createClient } from "@/lib/supabase/server";

export default async function KitPage() {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");
  if (!workspace.brandKitId) redirect("/app/directions");

  const supabase = await createClient();

  const { data: kit } = await supabase
    .from("brand_kits")
    .select("id,directions,selected_direction_id,voice_guide,practitioner_line,site_prompt_target")
    .eq("id", workspace.brandKitId)
    .maybeSingle();

  if (!kit) redirect("/app/directions");
  if (!kit.selected_direction_id) redirect("/app/directions");

  // Cette page lit `brand_kits` par PostgREST plutôt que par une RPC gardée,
  // donc c'est à elle d'appeler brand_kit_entitled — l'unique définition de
  // « elle a payé ». On s'en sert pour décider quoi RENDRE, jamais pour
  // autoriser quoi que ce soit : les RPC gardées tiennent déjà la ligne.
  const entitled = await brandKitEntitled(kit.id);
  if (!entitled) redirect("/app/checkout");

  const directions = (kit.directions as unknown as Direction[]) ?? [];
  const direction = directions.find((d) => d.id === kit.selected_direction_id);

  if (!direction) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-20">
        <h1 className="font-display text-[32px]">We can&apos;t find that direction.</h1>
        <p className="mt-3 text-[15px] text-muted">
          Sorry — that one is on us. <Link href="/app/directions" className="underline">Back to your three.</Link>
        </p>
      </div>
    );
  }

  const { data: targets } = await supabase
    .from("builder_targets")
    .select("id,label,accepts_prompt,sort_order")
    .eq("active", true)
    .order("sort_order");

  const target = kit.site_prompt_target ?? targets?.[0]?.id ?? "generic";
  const output = await loadOutput(kit.id, target);

  return (
    <KitView
      brandKitId={kit.id}
      direction={direction}
      voiceGuide={
        (kit.voice_guide as unknown as { sounds_like: string[]; never_write: string[] } | null) ??
        null
      }
      practitionerLine={kit.practitioner_line}
      targets={(targets ?? []) as BuilderTarget[]}
      initialTarget={output.ok ? output.target : target}
      initialText={
        output.ok
          ? output.text
          : "Your prompt is being prepared. Refresh in a moment — nothing is lost."
      }
    />
  );
}
