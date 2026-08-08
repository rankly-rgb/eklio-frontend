import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Client Supabase pour Server Components, route handlers et server actions.
 * Utilise la clé anon + les cookies de session — s'exécute toujours côté serveur.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll appelé depuis un Server Component : ignorable si le
            // middleware rafraîchit déjà les sessions.
          }
        },
      },
    }
  );
}

/**
 * Client "admin" avec la service_role key — bypass RLS.
 * STRICTEMENT réservé aux route handlers serveur qui en ont explicitement
 * besoin (ex. opérations de fond, webhooks). Ne jamais importer côté client.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Le client admin n'a pas de session utilisateur à persister.
        },
      },
    }
  );
}
