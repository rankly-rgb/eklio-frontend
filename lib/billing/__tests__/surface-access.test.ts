import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { surfaceAccess } from "@/lib/billing/surface-access";
import {
  SURFACES,
  SURFACE_LABEL,
  SURFACE_MIN_TIER,
  SURFACE_VERB,
  isSurface,
  surfaceVerb,
  type Surface,
} from "@/lib/billing/surfaces";
import { KIT_TIERS, type KitTier } from "@/lib/kit/tiers";
import { SOLD_TIER_NAME } from "@/lib/billing/tier-names";

/*
 * Le garde de tier — un seul, et toutes les surfaces passent par lui.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────
 *
 * `min_tier` est semé dans le schéma depuis le 3 septembre et appliqué nulle
 * part : les 35 lignes d'`asset_catalog` disent `starter`, et un acheteur à
 * 79 USD reçoit tout. Ce lot construit le MÉCANISME et écrit le défaut
 * permissif là où on peut le lire — il n'invente pas la distribution.
 *
 * Ce que ces tests tiennent :
 *   - chaque surface a une ligne dans la carte (et l'inverse) ;
 *   - le garde répond 404 AVANT `payment_required` ;
 *   - un tier illisible échoue FERMÉ ;
 *   - et le défaut permissif est bien un défaut EXPLICITE, ligne par ligne.
 */

const ROOT = resolve(__dirname, "../../..");

describe("l'énumération elle-même", () => {
  it("il y a bien des surfaces à garder", () => {
    // Sans cette garde, une liste vidée rendrait tout le fichier vacuously
    // vrai — sur un sujet où le faux vert est une porte ouverte.
    expect(SURFACES.length).toBeGreaterThanOrEqual(15);
  });

  it("⚠ chaque surface a une ligne de tier, et chaque ligne une surface", () => {
    /*
     * C'est LE test que demande le brief : une surface ajoutée sans ligne
     * n'est pas « permissive par défaut », elle est absente de la politique.
     * Le typage `Record<Surface, KitTier>` l'attrape à la compilation ; ceci
     * l'attrape aussi quand quelqu'un élargit le type sans remplir la carte.
     */
    expect(Object.keys(SURFACE_MIN_TIER).sort()).toEqual([...SURFACES].sort());
    expect(Object.keys(SURFACE_LABEL).sort()).toEqual([...SURFACES].sort());
  });

  it("chaque libellé est écrit pour elle, pas pour nous", () => {
    for (const surface of SURFACES) {
      const label = SURFACE_LABEL[surface];
      expect(label.length).toBeGreaterThan(3);
      // Pas de nom de clé recopié : « kit_assets » n'est pas une phrase.
      expect(label).not.toContain("_");
    }
  });
});

/*
 * ⚠ LA DISTRIBUTION, ÉPINGLÉE LIGNE PAR LIGNE.
 *
 * Ce bloc est une COPIE de la décision, écrite ici à la main, et c'est le
 * point : la carte ne peut pas bouger sans que ce fichier le dise. Une
 * surface montée d'un tier est un changement de prix pour quelqu'un qui a
 * déjà payé ; une surface descendue est un revenu abandonné. Ni l'un ni
 * l'autre ne doit pouvoir arriver dans un diff qui parlait d'autre chose.
 *
 * Et l'inverse compte autant : une surface AJOUTÉE sans ligne ici fait
 * échouer la suite, parce que « on décidera plus tard » est comment
 * `min_tier` a passé six jours semé et appliqué nulle part.
 */
const EXPECTED_MIN_TIER: Record<Surface, KitTier> = {
  kit_overview: "starter",
  kit_identity: "starter",
  kit_colors: "starter",
  kit_type: "starter",
  kit_site: "starter",
  kit_words: "starter",
  kit_assets: "starter",
  assets_download: "starter",
  brand_kit_pdf: "starter",
  brand_kit_zip: "starter",
  ethics_check: "starter",
  image_regeneration: "starter",
  own_uploads: "starter",

  site_editor: "practice",
  assets_sizes_and_formats: "practice",
  assets_in_situ: "practice",
  ethics_rewrite: "practice",

  assets_version_history: "signature",
  designer_handoff: "signature",
};

describe("⚠ la distribution est celle-ci, et rien d'autre", () => {
  it("l'énumération épinglée couvre exactement les surfaces réelles", () => {
    // Sans ça, une surface ajoutée sans ligne passerait inaperçue et le
    // `it.each` ci-dessous ne la testerait simplement pas.
    expect(Object.keys(EXPECTED_MIN_TIER).sort()).toEqual([...SURFACES].sort());
  });

  it.each([...SURFACES])("%s", (surface) => {
    expect(
      SURFACE_MIN_TIER[surface],
      `${surface} a changé de tier.\n` +
        "C'est une décision de prix. Si elle est voulue, change la ligne\n" +
        "correspondante dans EXPECTED_MIN_TIER en même temps — jamais l'une\n" +
        "sans l'autre."
    ).toBe(EXPECTED_MIN_TIER[surface]);
  });

  it("les trois tiers portent chacun quelque chose", () => {
    /*
     * Garde anti-vacuité de la distribution elle-même : si tout retombait à
     * `starter`, chaque assertion ci-dessus resterait verte une fois
     * EXPECTED_MIN_TIER aplati avec — et le paywall ne vendrait plus rien
     * sans qu'un seul test rougisse.
     */
    const counts = KIT_TIERS.map(
      (tier) => Object.values(SURFACE_MIN_TIER).filter((value) => value === tier).length
    );
    expect(counts).toEqual([13, 4, 2]);
  });

  it("et le tier le plus bas est bien celui qui est vendu le moins cher", () => {
    expect(KIT_TIERS[0]).toBe("starter");
  });
});

describe("surfaceAccess — 404 avant payment_required", () => {
  it("⚠ une surface inconnue est not_found, jamais « au-dessus de ton tier »", () => {
    /*
     * Même ordre que `requireKitPage`. Répondre `payment_required` à un nom
     * qui n'existe pas dirait à l'appelant qu'une surface existe — la même
     * fuite que répondre 402 pour le kit de quelqu'un d'autre.
     */
    const refusal = surfaceAccess("kit_secret_lab", "starter");
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.reason).toBe("not_found");
  });

  it("et l'inconnu reste inconnu même sans tier du tout", () => {
    const refusal = surfaceAccess("kit_secret_lab", null);
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.reason).toBe("not_found");
  });

  it("une surface `starter` passe pour les trois tiers", () => {
    for (const tier of KIT_TIERS) {
      expect(surfaceAccess("kit_colors", tier).ok).toBe(true);
    }
  });

  it("⚠ une surface `practice` refuse `starter` et passe au-dessus", () => {
    expect(surfaceAccess("site_editor", "starter").ok).toBe(false);
    expect(surfaceAccess("site_editor", "practice").ok).toBe(true);
    expect(surfaceAccess("site_editor", "signature").ok).toBe(true);
  });

  it("⚠ une surface `signature` ne passe qu'au sommet", () => {
    expect(surfaceAccess("designer_handoff", "starter").ok).toBe(false);
    expect(surfaceAccess("designer_handoff", "practice").ok).toBe(false);
    expect(surfaceAccess("designer_handoff", "signature").ok).toBe(true);
  });

  it("un refus nomme le tier requis, jamais celui qu'elle a", () => {
    const refusal = surfaceAccess("assets_version_history", "practice");
    expect(refusal.ok).toBe(false);
    if (refusal.ok || refusal.reason !== "payment_required") return;
    expect(refusal.requiredTier).toBe("signature");
    expect(refusal.currentTier).toBe("practice");
  });

  it("⚠ un tier illisible échoue FERMÉ", () => {
    /*
     * `null` veut dire « on n'a pas pu lire », pas « le tier le plus bas ».
     * Le pire d'un refus injustifié est une carte d'upgrade montrée à
     * quelqu'un qui a payé : visible, signalé, réparé. Le pire d'une
     * autorisation injustifiée est silencieux, permanent et gratuit.
     */
    // Y compris pour une surface `starter`, que tout le monde a payée.
    for (const surface of SURFACES) {
      const refusal = surfaceAccess(surface, null);
      expect(refusal.ok).toBe(false);
      if (!refusal.ok) expect(refusal.reason).toBe("payment_required");
    }
  });
});

describe("le garde compare sur l'échelle, dans le bon sens", () => {
  it.each(
    KIT_TIERS.flatMap((tier) => SURFACES.map((surface) => [tier, surface] as const))
  )("un client %s face à %s", (tier, surface) => {
    const allowed =
      KIT_TIERS.indexOf(tier) >= KIT_TIERS.indexOf(SURFACE_MIN_TIER[surface]);
    expect(surfaceAccess(surface, tier).ok).toBe(allowed);
  });

  it("un refus porte tout ce que la carte d'upgrade doit dire", () => {
    const refusal = surfaceAccess("assets_version_history", "starter");
    expect(refusal.ok).toBe(false);
    if (refusal.ok || refusal.reason !== "payment_required") return;
    expect(refusal.requiredTier).toBe("signature");
    expect(refusal.label).toBe(SURFACE_LABEL.assets_version_history);
    expect(refusal.currentTier).toBe("starter");
  });
});

describe("isSurface", () => {
  it("reconnaît toutes les vraies", () => {
    for (const surface of SURFACES) expect(isSurface(surface)).toBe(true);
  });

  it("et rien d'autre", () => {
    expect(isSurface("")).toBe(false);
    expect(isSurface("kit_assets ")).toBe(false);
    expect(isSurface("toString")).toBe(false);
  });
});

/*
 * ── LE MÉCANISME EST UN SEUL ────────────────────────────────────────────
 * Dix-neuf surfaces qui redérivent chacune la règle, c'est dix-neuf chances
 * d'inverser la comparaison — et une comparaison inversée sur un paywall
 * échoue OUVERT.
 */
describe("rien ne redérive la règle à côté du garde", () => {
  function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "__tests__" ? [] : filesUnder(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  const FILES = [...filesUnder(join(ROOT, "lib")), ...filesUnder(join(ROOT, "app")), ...filesUnder(join(ROOT, "components"))];

  it("le balayage trouve bien des fichiers", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(100);
  });

  it("⚠ `SURFACE_MIN_TIER` n'est lu que par le garde", () => {
    const readers = FILES.filter((file) =>
      readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .includes("SURFACE_MIN_TIER")
    ).map((file) => file.slice(ROOT.length + 1).replace(/\\/g, "/"));

    expect(readers).toEqual(["lib/billing/surface-access.ts", "lib/billing/surfaces.ts"]);
  });
});

/*
 * ── LES DIX-NEUF CONSULTENT, Y COMPRIS CELLES QUI PASSENT TOUJOURS ──────
 *
 * Treize surfaces sont `starter` et ne peuvent donc rien refuser aujourd'hui.
 * Elles consultent quand même, et c'est le point : une surface qui ne consulte
 * rien est celle qu'on oublie le jour où sa ligne monte. Le coût est une ligne
 * par surface ; l'oubli coûte un paywall qui fuit sans que rien ne rougisse.
 */
describe("chaque surface consulte le garde quelque part", () => {
  function walk(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(child);
      return /\.tsx?$/.test(entry.name) ? [child] : [];
    });
  }

  const PRODUCT = [...walk("app"), ...walk("components"), ...walk("lib")].filter(
    (path) =>
      path !== "lib/billing/surfaces.ts" &&
      path !== "lib/billing/surface-access.ts"
  );

  const consulted = new Map<string, string[]>();
  for (const path of PRODUCT) {
    const body = readFileSync(join(ROOT, path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    if (!/surfaceAccess\(|surfaceRefusal\(/.test(body)) continue;
    for (const match of body.matchAll(/surface(?:Access|Refusal)\(\s*\n?\s*"([a-z_]+)"/g)) {
      consulted.set(match[1], [...(consulted.get(match[1]) ?? []), path]);
    }
  }

  it("le balayage trouve bien des consultations", () => {
    // Sans cette garde, un motif cassé rendrait tout le bloc vacuously vrai.
    expect(PRODUCT.length).toBeGreaterThanOrEqual(100);
    expect(consulted.size).toBeGreaterThanOrEqual(15);
  });

  it.each([...SURFACES])("%s est consultée", (surface) => {
    expect(
      consulted.get(surface) ?? [],
      `${surface} n'est consultée nulle part.\n` +
        "Une surface qui ne demande rien au garde ne refusera rien le jour où\n" +
        "sa ligne monte — et personne ne le remarquera."
    ).not.toHaveLength(0);
  });

  /**
   * La seule surface payante gardée UNIQUEMENT dans un composant, et pourquoi
   * c'est correct.
   *
   * `assets_in_situ` ne va chercher rien : `in-situ-panel.tsx` compose des
   * cadres autour d'une vignette que `useAssetUrl` a déjà obtenue par la
   * route des assets — laquelle est gardée par `assets_download`. Il n'existe
   * donc aucune requête serveur propre à cette surface à refuser. Le jour où
   * elle en gagne une (un rendu composité côté serveur, par exemple), cette
   * exemption doit sauter avec.
   */
  const CLIENT_ONLY: Record<string, string> = {
    assets_in_situ:
      "Purely presentational: it frames a thumbnail the assets route already " +
      "served under `assets_download`, and fetches nothing of its own.",
  };

  it("⚠ chaque surface qui PEUT refuser est gardée côté serveur aussi", () => {
    /*
     * Un contrôle caché n'est pas une porte fermée : ces surfaces sont des
     * requêtes ordinaires contre son propre kit, et l'URL est visible. Garder
     * seulement l'écran ferait de la distribution une suggestion.
     */
    for (const surface of SURFACES) {
      if (SURFACE_MIN_TIER[surface] === KIT_TIERS[0]) continue;
      if (surface in CLIENT_ONLY) {
        expect(CLIENT_ONLY[surface].length).toBeGreaterThan(40);
        continue;
      }
      const paths = consulted.get(surface) ?? [];
      expect(
        paths.some((path) => path.startsWith("app/api/") || path.startsWith("app/app/")),
        `${surface} n'est gardée que dans un composant.\n` +
          "Ajoute la garde à sa route, ou inscris-la dans CLIENT_ONLY avec la\n" +
          "raison pour laquelle elle n'a aucune requête à elle."
      ).toBe(true);
    }
  });

  it("aucune exemption ne survit à la surface qu'elle exemptait", () => {
    for (const surface of Object.keys(CLIENT_ONLY)) {
      expect(SURFACES as readonly string[]).toContain(surface);
    }
  });
});

/*
 * ── UN REFUS NE REMPLACE JAMAIS CE QU'ELLE A PAYÉ ───────────────────────
 *
 * Deux surfaces refusent À CÔTÉ de quelque chose qu'elle est en train
 * d'utiliser, pas à sa place — et ce sont exactement celles où un refus
 * maladroit ferait le plus de dégâts.
 *
 * Check alarme au sujet de son ordre professionnel. Une cliente Brand Kit
 * garde le scan, la règle nommée et sa justification pour CHAQUE constat :
 * elle repart toujours en sachant quoi changer. Une analyse qui alarme sans
 * enseigner est une vitrine commerciale, pas un produit.
 */
describe("les refus qui vivent à l'intérieur, pas à la place", () => {
  const check = readFileSync(join(ROOT, "components/check/check-view.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("⚠ le constat entier est rendu quel que soit le tier", () => {
    /*
     * La règle, sa justification et ses propres mots : rien de tout ça n'est
     * derrière une condition de tier. Si `FindingRow` devenait conditionnel,
     * ce test rougirait.
     */
    // Le CORPS rendu, pas la signature — `rewriteAccess` y est une prop.
    const component = check.slice(check.indexOf("function FindingRow"));
    const body = component.slice(component.indexOf("return ("));

    for (const part of ["finding.label", "finding.description", "finding.excerpt"]) {
      const at = body.indexOf(part);
      expect(at, `${part} n'est plus rendu`).toBeGreaterThan(-1);
      // Aucune condition de tier avant ces trois-là.
      expect(body.slice(0, at)).not.toContain("rewriteAccess");
    }
  });

  it("le refus est DANS le constat, sous la justification", () => {
    const component = check.slice(check.indexOf("function FindingRow"));
    const body = component.slice(component.indexOf("return ("));
    expect(body).toContain("<TierLine");
    // Après les trois parties auxquelles elle a droit, jamais avant.
    expect(body.indexOf("<TierLine")).toBeGreaterThan(body.indexOf("finding.excerpt"));
  });

  it("⚠ et il ne s'affiche que là où une alternative aurait été proposée", () => {
    // Seulement sur un bloqueur : le répéter sous six avertissements serait
    // un mur plutôt qu'une note.
    expect(check).toContain('const blocker = finding.severity !== "warn";');
    expect(check).toMatch(/\{blocker && rewriteAccess/);
  });

  it("le bouton de réécriture disparaît plutôt que de refuser au clic", () => {
    // Un contrôle qui répond 402 est pire que pas de contrôle.
    expect(check).toContain("blocking.length > 0 && rewriteAccess.ok");
  });

  it("la ligne du panneau d'asset est une LIGNE, pas une carte", () => {
    const panel = readFileSync(join(ROOT, "components/kit/asset-detail-panel.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    // Le téléchargement simple reste, et la ligne se pose sous lui.
    expect(panel).toContain("<AssetDownloadButton");
    expect(panel).toContain("<TierLine");
    expect(panel.indexOf("<TierLine")).toBeGreaterThan(panel.indexOf("<AssetDownloadButton"));
    // Elle ne s'affiche que si d'autres tailles ou formats existent vraiment.
    expect(panel).toContain("entry.available_sizes.length > 0");
  });

  it("⚠ `TierLine` ne porte ni prix, ni argumentaire, ni bouton", () => {
    /*
     * C'est ce qui la distingue de `TierUpgradePrompt`, qui remplace une
     * surface entière et a la place pour tout ça. Celle-ci apparaît à côté de
     * ce qu'elle est en train de lire.
     */
    const line = readFileSync(join(ROOT, "components/billing/tier-line.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(line).not.toContain("amountCents");
    expect(line).not.toContain("tagline");
    expect(line).not.toContain("Upgrade to");
  });
});

/*
 * ── LES NOMS VENDUS ─────────────────────────────────────────────────────
 * « Practice » a vécu une journée dans ce fichier, faux et l'air juste. Rien
 * d'autre dans le dépôt ne l'aurait attrapé : une valeur d'enum capitalisée
 * est toujours plausible.
 */
describe("les trois noms sont ceux de la page de tarifs", () => {
  it("et ce ne sont pas les valeurs de l'enum", () => {
    expect(SOLD_TIER_NAME).toEqual({
      starter: "Brand Kit",
      practice: "Brand Kit Plus",
      signature: "Practice Suite",
    });
    for (const tier of KIT_TIERS) {
      expect(SOLD_TIER_NAME[tier].toLowerCase()).not.toBe(tier);
    }
  });

  it("⚠ la phrase se lit, une fois le nom substitué", () => {
    /*
     * « The site editor is part of Brand Kit Plus » se lit comme une ligne de
     * tableau comparatif. « comes with » se lit comme une phrase.
     */
    for (const file of SENTENCE_BUILDERS) {
      const body = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(body, `${file} construit encore « is part of »`).not.toContain("is part of");
    }
  });

  it("aucun écran ne montre une valeur d'enum à une cliente", () => {
    const prompt = readFileSync(join(ROOT, "components/billing/tier-upgrade-prompt.tsx"), "utf8");
    expect(prompt).toContain("soldTierName(access.requiredTier)");
    expect(prompt).toContain("soldTierName(access.currentTier)");
    expect(prompt).not.toMatch(/\{access\.(required|current)Tier\}/);
  });
});

/*
 * ── LE VERBE SUIT L'ÉTIQUETTE, PAS L'INVERSE ────────────────────────────
 *
 * « Other sizes and formats comes with Brand Kit Plus » est faux. Deux
 * sorties existaient : rendre l'étiquette singulière pour que le verbe unique
 * tienne, ou laisser le verbe suivre l'étiquette. C'est l'étiquette qui gagne —
 * une étiquette est le nom que le produit donne à une chose, et la tordre pour
 * qu'elle entre dans un gabarit déforme le nom plutôt que la phrase.
 */
const SENTENCE_BUILDERS = [
  "components/billing/tier-upgrade-prompt.tsx",
  "components/billing/tier-line.tsx",
  "lib/api/surface-guard.ts",
];

describe("l'accord du verbe", () => {
  /*
   * Les étiquettes dont le sujet est un NOM PLURIEL, écrites à la main. Un
   * gérondif ou un impératif reste singulier — « Downloading your files comes
   * with… », « Rewriting what Check found comes with… » — et c'est pour ça
   * qu'on ne peut pas déduire ça d'un `s` final.
   */
  const PLURAL_SUBJECTS: readonly Surface[] = [
    "kit_colors",              // "Colors"
    "kit_words",               // "Your words"
    "kit_assets",              // "Your assets"
    "assets_sizes_and_formats", // "Other sizes and formats"
    "own_uploads",             // "Your own files"
    "image_regeneration",      // "New photographs"
  ];

  it("⚠ chaque étiquette au pluriel prend « come », les autres « comes »", () => {
    /*
     * Cinq de ces six sont à `starter` et ne peuvent donc rien refuser
     * aujourd'hui : elles ne construisent aucune phrase, et c'est précisément
     * pourquoi elles seraient fausses pendant tout le temps qu'il faudrait
     * pour s'en apercevoir après un changement de ligne. Le verbe appartient
     * à l'ÉTIQUETTE, pas au tier.
     */
    for (const surface of SURFACES) {
      expect(surfaceVerb(surface), `${surface}: ${SURFACE_LABEL[surface]}`).toBe(
        PLURAL_SUBJECTS.includes(surface) ? "come" : "comes"
      );
    }
  });

  it("la liste des pluriels n'est pas vide, et n'est pas tout", () => {
    // Garde anti-vacuité : les deux moitiés de l'assertion ci-dessus doivent
    // avoir de quoi mordre.
    expect(PLURAL_SUBJECTS.length).toBeGreaterThan(0);
    expect(PLURAL_SUBJECTS.length).toBeLessThan(SURFACES.length);
  });

  it("le refus PORTE son verbe, comme il porte son étiquette", () => {
    const refusal = surfaceAccess("assets_sizes_and_formats", "starter");
    expect(refusal.ok).toBe(false);
    if (refusal.ok || refusal.reason !== "payment_required") return;
    expect(refusal.verb).toBe("come");
    expect(`${refusal.label} ${refusal.verb} with`).toBe("Other sizes and formats come with");
  });

  it("et la phrase se lit, pour chacune des dix-neuf", () => {
    for (const surface of SURFACES) {
      const refusal = surfaceAccess(surface, null);
      if (refusal.ok || refusal.reason !== "payment_required") continue;
      /*
       * L'accord lui-même est déjà cloué, surface par surface, dans
       * `PLURAL_SUBJECTS` ci-dessus — une liste écrite à la main parce
       * qu'aucune règle sur la CHAÎNE ne le donne : « Downloading your files
       * comes with… » est correct et se termine par un `s`. Ici on vérifie
       * seulement que la phrase se compose : une majuscule, le verbe au
       * milieu, le nom vendu à la fin.
       */
      const sentence = `${refusal.label} ${refusal.verb} with Brand Kit Plus.`;
      expect(sentence).toMatch(/^[A-Z].+ (come|comes) with Brand Kit Plus\.$/);
    }
  });

  it("⚠ les trois constructeurs de phrase lisent le verbe du refus", () => {
    /*
     * Trois endroits bâtissent la même phrase. Deux qui s'accordent ne
     * suffisent pas : c'est exactement comme ça qu'un « comes » en dur
     * survivrait dans le troisième.
     */
    for (const file of SENTENCE_BUILDERS) {
      const body = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(body, `${file} n'utilise pas access.verb`).toContain("access.verb");
      expect(body, `${file} garde un verbe en dur`).not.toMatch(/\bcomes with\b/);
    }
  });

  it("une exemption périmée ne survit pas à sa surface", () => {
    for (const surface of Object.keys(SURFACE_VERB)) {
      expect(SURFACES as readonly string[]).toContain(surface);
    }
  });
});
