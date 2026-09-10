import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SOLD_TIER_NAME } from "@/lib/billing/tier-names";
import { KIT_TIERS } from "@/lib/kit/tiers";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * AUCUN NOM DE PALIER ÉCRIT À LA MAIN DANS CE QUE LE MONDE EXTÉRIEUR LIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le défaut qui a motivé ce fichier : `app/pricing/page.tsx` a servi pendant
 * des semaines une `metadata.description` disant « Starter $79, Practice $149,
 * Signature $249 » — les valeurs d'enum de `purchases.tier`, jamais les noms
 * vendus. C'est la chaîne que Google affiche en extrait et que tout aperçu de
 * lien rend : trois noms de produits qui n'existent pas, en tête d'entonnoir.
 *
 * Même classe que le jour où `tier-names.ts` a expédié les enums capitalisés :
 * une chaîne PLAUSIBLE, que personne ne rattrape en relisant, et qu'aucun test
 * de comportement ne peut distinguer d'une bonne. La seule parade est
 * structurelle — interdire de l'écrire — d'où ce fichier.
 *
 * ⚠ L'ÉNUMÉRATION EST DÉCOUVERTE, PAS TENUE À LA MAIN. On marche dans `app/`
 * ET dans `lib/`, et on ramasse tout fichier qui déclare des métadonnées ou
 * qui porte de la copy vendue. Une nouvelle page ne peut donc pas échapper à
 * la règle en n'étant ajoutée nulle part.
 *
 * ── POURQUOI `lib/` A ÉTÉ AJOUTÉ, ET CE QUI EST PASSÉ SANS ────────────────
 *
 * La marche d'acquisition (`ACQUISITION_WALK.md` §5.1) a trouvé, sur la page
 * de tarifs EN PRODUCTION, deux puces visibles :
 *
 *     « Everything in Starter »      sur la carte « Brand Kit Plus »
 *     « Everything in Practice »     sur la carte « Practice Suite »
 *
 * Ce fichier ne les a pas vues, pour deux raisons cumulées, et aucune n'était
 * un accident de code :
 *
 *   1. il ne marchait que dans `app/`, et `lib/billing/plans.ts` n'y est pas ;
 *   2. il ne regardait que les MÉTADONNÉES, et une puce de fonctionnalité
 *      n'en est pas — alors que c'est du texte qu'une prospect LIT, ce qui
 *      était précisément l'objet de la consigne.
 *
 * La garde était donc plus étroite que la phrase qui l'avait demandée. Elle
 * couvre maintenant les deux : les métadonnées où qu'elles soient, et toute
 * copy de facturation dans `lib/billing/`.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Le source sans commentaires : on lit du CODE, pas de la prose. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const APP_FILES = walk(join(ROOT, "app"));
const LIB_FILES = walk(join(ROOT, "lib"));

const METADATA_FILES = [...APP_FILES, ...LIB_FILES].filter((file) => {
  const source = code(file);
  return /export\s+(const|async\s+function)\s+(metadata|generateMetadata)/.test(source);
});

/*
 * La copy de facturation : ce qu'une prospect lit sur `/pricing` et sur le
 * checkout, quel que soit le fichier d'où il vient. C'est le périmètre que la
 * consigne demandait depuis le début — « chaque surface qui nomme un palier »
 * — et pas seulement les balises `<head>`.
 */
const BILLING_COPY_FILES = LIB_FILES.filter((file) =>
  file.startsWith(join(ROOT, "lib", "billing"))
);

/*
 * Les valeurs d'enum, capitalisées comme un nom de produit le serait.
 *
 * `Practice` est traité à part : il a un usage LÉGITIME et fréquent dans ce
 * produit (« your practice », « Practice details »), et « Practice Suite » est
 * un vrai nom vendu qui le contient. On ne l'interdit donc que collé à un
 * prix — la forme exacte qu'avait la description fautive.
 */
const BANNED = [/\bStarter\b/, /\bSignature\b/, /\bPractice \$/];

/** Le texte d'un fichier, sold names retirés, pour ne pas s'auto-déclencher. */
function withoutSoldNames(source: string): string {
  let out = source;
  // Du plus long au plus court : retirer « Brand Kit » avant « Brand Kit Plus »
  // laisserait un « Plus » orphelin et, pire, garderait « Practice Suite ».
  for (const name of Object.values(SOLD_TIER_NAME).sort((a, b) => b.length - a.length)) {
    out = out.split(name).join("");
  }
  return out;
}

describe("l'énumération elle-même", () => {
  it("trouve les pages à métadonnées, et il y en a", () => {
    // Garde anti-vacuité : sans ça, une regex cassée ferait passer ce fichier
    // entier en ne trouvant aucun fichier à vérifier.
    expect(METADATA_FILES.length).toBeGreaterThanOrEqual(5);
  });

  it("et la page de tarifs en fait partie", () => {
    expect(METADATA_FILES.some((file) => file.endsWith("app/pricing/page.tsx"))).toBe(true);
  });

  it("la copy de facturation est balayée, et le catalogue en fait partie", () => {
    // Anti-vacuité : c'est le fichier qui a laissé passer les deux puces.
    expect(BILLING_COPY_FILES.length).toBeGreaterThanOrEqual(2);
    expect(BILLING_COPY_FILES.some((f) => f.endsWith("lib/billing/plans.ts"))).toBe(true);
  });
});

describe("la copy de facturation ne nomme aucun palier à la main", () => {
  it.each(BILLING_COPY_FILES.map((file) => [file.slice(ROOT.length + 1), file]))(
    "%s",
    (_label, file) => {
      const source = withoutSoldNames(code(file as string));
      for (const pattern of BANNED) {
        expect(source, `${_label} contient ${pattern}`).not.toMatch(pattern);
      }
    }
  );

  /*
   * ── LA RENVOI D'UN PALIER VERS UN AUTRE ─────────────────────────────────
   *
   * `BANNED` seul ne suffisait pas ici, et il ne le POUVAIT pas : « Practice »
   * n'y est interdit que collé à un prix, parce que « your practice » et
   * « Practice details » sont de l'anglais légitime partout dans ce produit.
   * « Everything in Practice » n'a donc été attrapé par rien.
   *
   * La forme du défaut est plus précise que le mot : c'est une carte qui
   * RENVOIE à un autre palier, et qui le nomme. On lit donc la phrase entière
   * et on vérifie que ce qu'elle nomme est un nom vendu — ce qui interdit
   * l'enum sans interdire le mot.
   */
  const CROSS_REFERENCE = /Everything in ([^"`\n]+)/g;

  it.each(BILLING_COPY_FILES.map((file) => [file.slice(ROOT.length + 1), file]))(
    "%s ne renvoie qu'à des paliers réellement vendus",
    (_label, file) => {
      const source = code(file as string);
      for (const match of source.matchAll(CROSS_REFERENCE)) {
        const named = match[1].trim();
        // Construit depuis le catalogue : c'est la bonne façon, et elle passe.
        if (named.startsWith("${")) continue;
        expect(
          Object.values(SOLD_TIER_NAME),
          `${_label} renvoie à « ${named} », qui n'est pas un palier vendu`
        ).toContain(named);
      }
    }
  );

  /*
   * ⚠ LE CANARI DE CETTE RÈGLE-CI : les deux puces EXACTES qui étaient en
   * production. Sans lui, élargir le balayage puis casser la regex repasserait
   * au vert sans que rien ne le dise.
   */
  it("et elle mord : les deux puces qui étaient en production sont refusées", () => {
    for (const bullet of ["Everything in Starter", "Everything in Practice"]) {
      const named = [...bullet.matchAll(CROSS_REFERENCE)][0][1].trim();
      expect(
        Object.values(SOLD_TIER_NAME).includes(named),
        `« ${bullet} » devrait être refusée`
      ).toBe(false);
    }
  });

  it("tandis que la version construite depuis le catalogue passe", () => {
    const now = "Everything in ${SOLD_TIER_NAME.starter}";
    const named = [...now.matchAll(CROSS_REFERENCE)][0][1].trim();
    expect(named.startsWith("${")).toBe(true);
  });
});

describe("les métadonnées ne nomment aucun palier à la main", () => {
  it.each(METADATA_FILES.map((file) => [file.slice(ROOT.length + 1), file]))(
    "%s",
    (_label, file) => {
      const source = withoutSoldNames(code(file as string));
      for (const pattern of BANNED) {
        expect(source, `${_label} contient ${pattern}`).not.toMatch(pattern);
      }
    }
  );

  /*
   * ⚠ LE CANARI. Sans lui, les assertions ci-dessus passeraient tout aussi
   * bien si `BANNED` était vide ou si `withoutSoldNames` mangeait tout. On
   * repasse la chaîne EXACTE qui était en production, et elle doit être prise.
   */
  it("et la règle mord : l'ancienne description est refusée", () => {
    const wasInProduction =
      "One-time pricing for a complete brand kit, plus an optional monthly " +
      "content subscription. Starter $79, Practice $149, Signature $249.";

    const stripped = withoutSoldNames(wasInProduction);
    expect(BANNED.some((pattern) => pattern.test(stripped))).toBe(true);
  });

  it("tandis que les vrais noms vendus passent", () => {
    const current =
      "One-time pricing for a complete brand kit, plus an optional monthly " +
      "content subscription. Brand Kit $79, Brand Kit Plus $149, Practice Suite $249.";

    const stripped = withoutSoldNames(current);
    expect(BANNED.some((pattern) => pattern.test(stripped))).toBe(false);
  });
});

describe("la description de la page de tarifs est construite", () => {
  const source = code(join(ROOT, "app/pricing/page.tsx"));

  it("depuis le catalogue, pas écrite en dur", () => {
    expect(source).toMatch(/description:\s*`/); // un gabarit, pas un littéral
    expect(source).toContain("ORDERED_PLANS");
    expect(source).toContain("formatUsd");
  });

  it("et aucun prix n'y est écrit à la main", () => {
    // Les trois prix du catalogue ne doivent apparaître nulle part en dur.
    for (const amount of ["$79", "$149", "$249"]) {
      expect(source, `${amount} écrit en dur`).not.toContain(amount);
    }
  });
});

/*
 * ── LES SUJETS D'E-MAIL ──────────────────────────────────────────────────
 *
 * Aucun ne nomme de palier aujourd'hui. La règle est écrite quand même : un
 * sujet est ce qui s'affiche dans une boîte de réception, au même titre qu'un
 * extrait Google, et c'est exactement l'endroit où un nom d'enum passerait
 * inaperçu à la relecture.
 */
describe("les sujets d'e-mail", () => {
  const source = code(join(ROOT, "lib/email/templates.ts"));
  const subjects = [...source.matchAll(/subject:\s*(`[^`]*`|"[^"]*")/g)].map(
    (match) => match[1]
  );

  it("sont trouvés, et il y en a plusieurs", () => {
    expect(subjects.length).toBeGreaterThanOrEqual(4);
  });

  it("n'en nomment aucun à la main", () => {
    for (const subject of subjects) {
      const stripped = withoutSoldNames(subject);
      for (const pattern of BANNED) {
        expect(stripped, `sujet ${subject}`).not.toMatch(pattern);
      }
    }
  });
});

/*
 * ── OPEN GRAPH ET JSON-LD : IL N'Y EN A PAS ──────────────────────────────
 *
 * ⚠ CE TEST EXISTE POUR ÊTRE CASSÉ. Le balayage demandé couvrait aussi les
 * balises Open Graph et les offres JSON-LD ; il n'en existe AUCUNE dans ce
 * dépôt aujourd'hui. Plutôt que de conclure « rien à faire » et de laisser le
 * prochain qui en ajoutera repartir d'une page blanche, on fige l'absence :
 * le jour où quelqu'un pose un `openGraph` ou un `application/ld+json`, ce
 * test échoue et l'oblige à venir l'inscrire dans le balayage ci-dessus.
 *
 * Un aperçu de lien qui annonce « Signature $249 » sur LinkedIn est
 * exactement le même défaut que l'extrait Google, en plus difficile à voir.
 */
describe("Open Graph et JSON-LD", () => {
  const ALL = [...APP_FILES, join(ROOT, "lib/email/templates.ts")];

  it("n'existent pas encore — et leur apparition doit repasser par ici", () => {
    const withOg = ALL.filter((file) => /openGraph\s*:/.test(code(file)));
    const withLd = ALL.filter((file) => /ld\+json|schema\.org/.test(code(file)));

    expect(
      [...withOg, ...withLd].map((file) => file.slice(ROOT.length + 1)),
      "Une balise Open Graph ou un bloc JSON-LD est apparu. Ajoute-le à " +
        "BANNED/METADATA_FILES ci-dessus : c'est du texte que le monde " +
        "extérieur lit, et il doit lire SOLD_TIER_NAME."
    ).toEqual([]);
  });
});

describe("la source des noms", () => {
  it("les trois noms vendus ne sont pas leurs valeurs d'enum", () => {
    for (const tier of KIT_TIERS) {
      expect(SOLD_TIER_NAME[tier].toLowerCase()).not.toBe(tier);
    }
  });
});
