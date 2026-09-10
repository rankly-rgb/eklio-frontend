import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app"];

/*
 * ── WHAT A STRANGER MAY REACH WITHOUT AN ACCOUNT ────────────────────────
 *
 * The brief, its review, its positioning screen and the reveal. Everything
 * else under `/app` still needs a session.
 *
 * ⚠ THIS DOES NOT GRANT ANYTHING. It only stops the proxy from bouncing her to
 * `/login` before the page runs. Every one of these surfaces then resolves its
 * caller (`lib/anon/session.ts`) and reads through RLS, where an anonymous
 * request without a matching token reads nothing at all. Letting the request
 * through and letting it see something are two different decisions, made in
 * two different places, and only the second one is a permission.
 *
 * ⚠ THE KIT SECTIONS ARE NOT HERE, deliberately. `/app/brand-kits/[id]/reveal`
 * is the free reveal — the thing being sold — and it is the last screen before
 * the checkout. The paid sections underneath it (`/assets`, `/site-editor`,
 * `/handoff`…) stay behind the session, because an account is the only place a
 * purchase can attach to.
 */
const ANONYMOUS_PATTERNS: RegExp[] = [
  /^\/app\/briefs\/[^/]+(\/(review|positioning))?\/?$/,
  /^\/app\/brand-kits\/[^/]+\/reveal\/?$/,
];

export function reachableWithoutAccount(pathname: string): boolean {
  return ANONYMOUS_PATTERNS.some((pattern) => pattern.test(pathname));
}

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

  if (isProtected && !user && !reachableWithoutAccount(request.nextUrl.pathname)) {
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
