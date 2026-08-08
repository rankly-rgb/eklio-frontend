import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

// Le middleware garantit déjà qu'un user authentifié arrive ici, mais on
// relit la session pour afficher ses infos (défense en profondeur).
export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Espace Eklio</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="font-mono text-sm underline hover:opacity-60"
          >
            Se déconnecter
          </button>
        </form>
      </div>

      <p className="font-mono text-sm text-gris-fonce">
        Connecté en tant que {user?.email}.
      </p>

      <div className="rounded-lg border border-dashed border-noir/30 bg-cream-light p-8 font-mono text-sm text-gris-fonce">
        TODO — guided flow (Brief → Positionnement → Audience → Ton → Palette
        → Typographies → Site), génération des 3 directions créatives via
        Claude, kit de marque, export PDF, prompt multi-constructeurs, Stripe.
      </div>
    </div>
  );
}
