import { redirect } from "next/navigation";

import { PlanPicker, type PlanCard } from "@/components/checkout/plan-picker";
import { getOrCreateWorkspace } from "@/lib/eklio/project";
import { stripeConfigured } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage() {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("tier,label,price_cents,regenerations_limit,directions_limit,sort_order")
    .gt("price_cents", 0)
    .order("sort_order");

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
      <div className="overline text-muted">Your kit</div>
      <h1 className="mt-4 max-w-[640px] font-display text-[40px] leading-[1.12] tracking-[-0.015em] text-balance">
        Looking was free. Keeping it is not.
      </h1>
      <p className="mt-3 max-w-[520px] text-[15px] leading-[1.6] text-muted">
        One payment. The direction you chose becomes a full brand kit, with the prompt that builds
        your site.
      </p>

      <div className="mt-10">
        <PlanPicker plans={(plans ?? []) as PlanCard[]} configured={stripeConfigured()} />
      </div>
    </div>
  );
}
