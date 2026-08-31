import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Client Supabase pour les Client Components. Utilise la clé anon (publique) :
 * la sécurité repose sur les policies RLS, jamais sur ce client.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
