import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app"];

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes
 * listées dans PROTECTED_PREFIXES en redirigeant vers /login si non connecté.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    /*
     * Le chemin ET sa query string.
     *
     * N'emporter que le `pathname` perdait tout ce qui portait l'INTENTION :
     * `/app/checkout?plan=signature` revenait en `/app/checkout`, et le
     * praticien se retrouvait sur le tier recommandé par défaut au lieu de
     * celui qu'il venait de choisir — un Signature à $249 dégradé en Practice
     * à $149, sans que rien ne le signale. La redirection marchait, l'achat
     * non.
     *
     * `searchParams.set` encode la valeur, donc une query string qui
     * contiendrait elle-même un `next` ne peut pas s'échapper du paramètre.
     * Ce que le proxy écrit ici reste de toute façon repassé au contrôle
     * anti-open-redirect à la connexion (`lib/auth/next-url.ts`).
     */
    redirectUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
