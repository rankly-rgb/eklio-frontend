import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ANON_TOKEN_DAYS,
  anonCookieOptions,
  anonExpiryFrom,
  clientIp,
  hashAnonToken,
  ipBucket,
  isPlausibleAnonToken,
  mintAnonToken,
} from "@/lib/anon/token";

/*
 * ── LE JETON EST LA SEULE CHOSE QUI TIENT UN BRIEF ANONYME ──────────────
 *
 * Ce qu'une inconnue a répondu sur sa pratique, ses clients et sa façon de
 * travailler est dans une table sans compte attaché. Ce fichier garde les
 * propriétés qui rendent ça acceptable.
 */

afterEach(() => vi.unstubAllEnvs());

describe("le jeton", () => {
  it("porte 32 octets d'aléa, et jamais deux fois le même", () => {
    const many = new Set(Array.from({ length: 200 }, () => mintAnonToken()));
    expect(many.size).toBe(200);
    // 32 octets en base64url = 43 caractères.
    expect([...many][0].split(".")[0]).toHaveLength(43);
  });

  it("⚠ la base ne voit QUE son empreinte", () => {
    const token = mintAnonToken();
    const hash = hashAnonToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    // Déterministe : c'est ce qui permet de retrouver la ligne.
    expect(hashAnonToken(token)).toBe(hash);
  });

  it("le cookie est httpOnly, et vit aussi longtemps que la ligne", () => {
    const options = anonCookieOptions();
    // Aucun script à nous n'a besoin de le lire, et celui de quelqu'un
    // d'autre ne doit pas le pouvoir.
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.maxAge).toBe(ANON_TOKEN_DAYS * 24 * 60 * 60);
  });

  it("la date d'expiration est celle du cookie, à la seconde près", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    expect(anonExpiryFrom(now)).toBe("2026-10-31T00:00:00.000Z");
  });
});

describe("la signature, et pourquoi elle n'est qu'un portier", () => {
  it("signe quand un secret existe", () => {
    vi.stubEnv("ANON_TOKEN_SECRET", "a-secret");
    const token = mintAnonToken();
    expect(token).toContain(".");
    expect(isPlausibleAnonToken(token)).toBe(true);
  });

  it("refuse une signature fausse sans toucher la base", () => {
    vi.stubEnv("ANON_TOKEN_SECRET", "a-secret");
    const [random] = mintAnonToken().split(".");
    expect(isPlausibleAnonToken(`${random}.AAAAAAAAAAAAAAAAAAAAAA`)).toBe(false);
  });

  it("refuse un jeton signé avec un AUTRE secret", () => {
    vi.stubEnv("ANON_TOKEN_SECRET", "first");
    const token = mintAnonToken();
    vi.stubEnv("ANON_TOKEN_SECRET", "second");
    expect(isPlausibleAnonToken(token)).toBe(false);
  });

  it("⚠ accepte tout de même un jeton NON SIGNÉ quand un secret apparaît", () => {
    /*
     * Le cas de la rotation, et il n'est pas théorique : sans ça, poser le
     * secret un matin invaliderait tous les cookies en circulation et
     * effacerait, du point de vue de chaque visiteuse, le brief qu'elle était
     * en train d'écrire. La base reste l'autorité — un jeton qui ne
     * correspond à aucune empreinte ne lit rien.
     */
    const unsigned = mintAnonToken();
    vi.stubEnv("ANON_TOKEN_SECRET", "arrived-later");
    expect(isPlausibleAnonToken(unsigned)).toBe(true);
  });

  it("⚠ et sans secret, il vérifie sans refuser", () => {
    // Un déploiement d'aperçu, un run local, une variable oubliée : la
    // signature disparaît, le produit continue.
    vi.stubEnv("ANON_TOKEN_SECRET", "");
    expect(isPlausibleAnonToken(mintAnonToken())).toBe(true);
  });

  it("mais rien d'implausible ne passe, avec ou sans secret", () => {
    for (const bad of [undefined, null, "", "short", "x".repeat(201)]) {
      expect(isPlausibleAnonToken(bad)).toBe(false);
    }
  });

  it("la borne de longueur est la MÊME qu'en base", () => {
    // `public.anon_token_hash()` refuse hors [20, 200]. Les deux doivent
    // s'accorder sur ce qui vaut la peine d'être haché.
    expect(isPlausibleAnonToken("x".repeat(19))).toBe(false);
    expect(isPlausibleAnonToken("x".repeat(20))).toBe(true);
    expect(isPlausibleAnonToken("x".repeat(200))).toBe(true);
    expect(isPlausibleAnonToken("x".repeat(201))).toBe(false);
  });
});

describe("compter une visiteuse sans garder son adresse", () => {
  it("⚠ l'adresse n'apparaît nulle part dans le seau", () => {
    const bucket = ipBucket("203.0.113.7", new Date("2026-10-01T12:00:00Z"));
    expect(bucket).not.toContain("203.0.113.7");
    expect(bucket).toMatch(/^[0-9a-f]{32}$/);
  });

  it("stable dans la journée, différent le lendemain", () => {
    const ip = "203.0.113.7";
    const morning = ipBucket(ip, new Date("2026-10-01T06:00:00Z"));
    const evening = ipBucket(ip, new Date("2026-10-01T23:00:00Z"));
    const tomorrow = ipBucket(ip, new Date("2026-10-02T06:00:00Z"));

    expect(morning).toBe(evening);      // le plafond reconnaît un retour
    expect(tomorrow).not.toBe(morning); // et l'oublie le jour d'après
  });

  it("deux adresses ne partagent pas un seau", () => {
    const day = new Date("2026-10-01T12:00:00Z");
    expect(ipBucket("203.0.113.7", day)).not.toBe(ipBucket("203.0.113.8", day));
  });

  it("⚠ une adresse absente partage UN seau, elle n'a pas de laissez-passer", () => {
    const day = new Date("2026-10-01T12:00:00Z");
    expect(ipBucket(null, day)).toBe(ipBucket(null, day));
    expect(ipBucket(null, day)).not.toBe(ipBucket("203.0.113.7", day));
  });

  it("lit l'adresse derrière un proxy, première valeur", () => {
    const request = new Request("https://eklio.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.1" },
    });
    expect(clientIp(request)).toBe("203.0.113.7");
    expect(clientIp(new Request("https://eklio.test"))).toBeNull();
  });
});
