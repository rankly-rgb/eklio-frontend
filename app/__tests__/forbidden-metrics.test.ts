import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * LES MÉTRIQUES QU'EKLIO NE PEUT PAS CALCULER N'EXISTENT PAS DANS L'INTERFACE.
 *
 * ── Pourquoi ce test existe, alors qu'il n'a jamais rien trouvé ──────────
 *
 * Aucune de ces chaînes n'est jamais entrée dans ce dépôt : elles vivaient
 * dans les maquettes, et le lot 1 de post-purchase-v2 a constaté qu'il n'y
 * avait rien à purger. Ce test n'est donc PAS un nettoyage — c'est une
 * GARDE. Il empêche qu'une session future les réintroduise en croyant bien
 * faire, parce qu'une maquette les montre encore.
 *
 * Chacune est un score, une note, un pourcentage de qualité, ou un compte
 * qu'aucune requête de ce produit ne sait produire. Les afficher serait
 * inventer un chiffre et le présenter comme mesuré.
 *
 * ── Ce qui reste permis, et pourquoi ────────────────────────────────────
 *
 * Le niveau de lecture (`lib/ethics/readability.ts`) est calculé de manière
 * déterministe à partir du texte lui-même — Flesch-Kincaid, affiché comme
 * « 8th grade », jamais comme un pourcentage, jamais coloré en bon/mauvais.
 * Ce n'est pas un score : c'est une mesure, et elle est reproductible.
 */

const ROOT = resolve(__dirname, "../..");
const SCANNED_DIRS = ["app", "components"];

/**
 * Les cinq interdites, telles que le brief les nomme. Insensible à la
 * casse : « brand clarity » réintroduit en minuscules est le même chiffre
 * inventé que « Brand clarity ».
 */
const FORBIDDEN = [
  "Brand clarity",
  "Average rating",
  "Voice match",
  "Clients this month",
  "Authentic approach",
  /*
   * ── AJOUTÉES PAR LE CHANTIER home-v3 ─────────────────────────────────
   *
   * Les deux suivantes ne sont pas des chiffres inventés : ce sont des
   * REGISTRES que le produit n'emploie pas, et la maquette home-v3 les a
   * proposés tous les deux.
   *
   * « Welcome back » est le registre publicitaire que l'accueil évite : le
   * nom de la practice dit à qui est cette marque, la date dit quand, et
   * aucune des deux n'a besoin d'être accueillie. « Your mantra » attribue
   * une phrase à quelqu'un — la maquette la signait du nom de sa practice,
   * sous un texte qu'elle n'a pas écrit.
   */
  "Welcome back",
  "Your mantra",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") return [];
      return sourceFiles(full);
    }
    // Ce fichier-ci porte les chaînes par nécessité — c'est lui qui les
    // interdit. Il est le seul endroit du dépôt où elles ont le droit
    // d'apparaître.
    if (full === __filename) return [];
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const FILES = SCANNED_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));

describe("l'énumération elle-même", () => {
  it("balaye bien des fichiers", () => {
    // Sans cette garde, un balayage cassé rendrait tout le reste vacuously
    // true — exactement le faux vert que ce test doit rendre impossible.
    expect(FILES.length).toBeGreaterThan(50);
  });
});

describe("aucune métrique inventée n'est affichée", () => {
  it.each(FORBIDDEN)("« %s » n'apparaît nulle part dans app/ ni components/", (phrase) => {
    const needle = phrase.toLowerCase();
    const offenders = FILES.filter((file) =>
      readFileSync(file, "utf8").toLowerCase().includes(needle)
    ).map((file) => file.slice(ROOT.length + 1).replace(/\\/g, "/"));

    expect(
      offenders,
      `« ${phrase} » est un chiffre qu'Eklio ne calcule à partir d'aucune de ses lignes.\n` +
        "Ce n'est pas une question de formulation : il n'y a pas de version plus\n" +
        "douce d'un score inventé. Si le besoin derrière est réel, il faut d'abord\n" +
        "la requête qui le produit — puis le libellé qui la nomme.\n" +
        `Trouvé dans : ${offenders.join(", ")}`
    ).toEqual([]);
  });
});


/* ── LES ÉMOJIS ─────────────────────────────────────────────────────────
 *
 * Aucun émoji dans la copie de `/app`. La maquette home-v3 en posait un sur
 * la ligne de titre ; les règles de voix l'excluent, et c'est la seule chose
 * de cet écran qu'aucune donnée ne produit.
 *
 * ⚠ LE MOTIF VISE LA PRÉSENTATION ÉMOJI, PAS « TOUT CARACTÈRE EXOTIQUE ». Un
 * premier jet balayait les blocs Flèches et Dingbats et attrapait vingt
 * fichiers innocents : « → » dans « View all → », « ✓ » dans une étiquette.
 * Ce sont des signes typographiques, pas des émojis. Ne restent donc que les
 * plans supplémentaires (U+1F000–U+1FAFF), où vivent les vrais pictogrammes,
 * et U+FE0F, le sélecteur qui force la présentation émoji sur une base texte
 * — ce qui distingue « ⚠ » (ponctuation, partout dans ce dépôt) de « ⚠️ ».
 */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{FE0F}]/u;

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("aucun émoji dans la copie de l'espace connecté", () => {
  it("le balayage couvre bien des fichiers", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("aucun fichier de app/ ni components/ n'en porte", () => {
    const offenders = FILES.filter((file) => EMOJI.test(readFileSync(file, "utf8"))).map((file) =>
      file.slice(ROOT.length + 1).replace(/\\/g, "/")
    );

    expect(
      offenders,
      "Un émoji dans la copie de l'app.\n" +
        "Les règles de voix l'excluent, et il ne vient d'aucune donnée.\n" +
        `Trouvé dans : ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("⚠ le canari : le motif attrape bien un émoji de copie", () => {
    expect(EMOJI.test("Bonjour \u{1F44B}")).toBe(true);
    expect(EMOJI.test("⚠️")).toBe(true);
  });

  it("⚠ mais il laisse passer la typographie que ce dépôt emploie", () => {
    expect(EMOJI.test("View all →")).toBe(false);
    expect(EMOJI.test("⚠ un en-tête")).toBe(false);
    expect(EMOJI.test("✓ READY")).toBe(false);
  });
});

/* ── L'ATTRIBUTION D'UNE CITATION ───────────────────────────────────────
 *
 * Une citation sur cet écran porte la PROVENANCE de la phrase — de quelle
 * réponse de son brief elle sort — et jamais le nom de sa practice.
 *
 * La maquette home-v3 signait ses deux emplacements de citation du nom du
 * cabinet, sous des phrases écrites par le produit. Signer ainsi, c'est
 * attribuer ; attribuer une phrase qu'elle n'a pas écrite à son propre
 * cabinet est le seul mensonge que cet écran ne pouvait pas se permettre.
 *
 * ⚠ LA GARDE PORTE SUR LA LÉGENDE, PAS SUR LE FICHIER. L'en-tête rend la
 * citation ET le nom de la practice — c'est son travail, ce sont deux
 * éléments distincts. Interdire le champ dans tout le fichier rendait la
 * garde rouge sur du code correct. Ce qui compte est ce que porte le
 * `<figcaption>` : la provenance, et rien qui nomme le cabinet.
 *
 * ⚠ ET TOUTE CITATION N'A PAS DE LÉGENDE. `components/content/month-plan.tsx`
 * cite le texte du check-in en posant sa provenance dans la phrase d'amorce,
 * au-dessus — « Written around what you told us… ». C'est correct : la
 * provenance est dite, simplement pas en légende. Exiger un `<figcaption>`
 * partout rendait la garde rouge sur cette citation-là. La règle générale
 * est donc « aucune légende ne nomme le cabinet » ; les deux emplacements de
 * l'accueil, eux, sont tenus nommément de porter leur provenance.
 */
const PRACTICE_NAME = /\bpracticeName\b|\bpractice_name\b/;
const FIGCAPTION = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/g;

describe("aucune citation n'est signée du nom de la practice", () => {
  const quoting = FILES.filter((file) => readFileSync(file, "utf8").includes("<blockquote"));

  it("il y a bien des citations à surveiller", () => {
    // Sans ça, supprimer les deux emplacements rendrait la garde vacuously
    // true et la règle disparaîtrait avec eux.
    expect(quoting.length).toBeGreaterThan(0);
  });

  it.each(quoting.map((file) => [file.slice(ROOT.length + 1).replace(/\\/g, "/"), file] as const))(
    "%s signe ses citations de leur provenance",
    (path, file) => {
      const source = withoutComments(readFileSync(file, "utf8"));
      const captions = [...source.matchAll(FIGCAPTION)].map((match) => match[1]);

      for (const caption of captions) {
        expect(
          PRACTICE_NAME.test(caption),
          `${path} signe une citation du nom du cabinet.\n` +
            "Une citation porte sa provenance (« FROM YOUR POSITIONING »),\n" +
            "jamais le nom du cabinet : ce serait une attribution, et fausse."
        ).toBe(false);
      }
    }
  );

  /*
   * Les deux emplacements de l'accueil, nommément. La règle au-dessus
   * interdit une mauvaise légende ; celle-ci exige qu'ils en aient une —
   * sans quoi les supprimer tous les deux ferait disparaître la règle avec
   * eux, et une citation anonyme reviendrait sans rien de rouge.
   */
  it.each([
    ["components/home/practice-header.tsx", "components/home/practice-header.tsx"],
    ["components/home/rail.tsx", "components/home/rail.tsx"],
  ])("%s porte la provenance en légende", (_path, file) => {
    const source = withoutComments(readFileSync(join(ROOT, file), "utf8"));
    const captions = [...source.matchAll(FIGCAPTION)].map((match) => match[1]);
    expect(captions.length).toBeGreaterThan(0);
    expect(captions.every((caption) => caption.includes("provenance"))).toBe(true);
  });

  it("⚠ le canari : la garde attraperait bien une signature au nom du cabinet", () => {
    const offending = "<figcaption>{practiceName}</figcaption>";
    const caption = [...offending.matchAll(FIGCAPTION)][0][1];
    expect(PRACTICE_NAME.test(caption)).toBe(true);
  });
});
