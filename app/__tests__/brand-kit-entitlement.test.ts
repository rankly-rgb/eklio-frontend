import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * TOUTE surface de `brand-kits` est gardée, ou l'est explicitement pas.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * Ajouter une route et oublier la vérification EST le mode de défaillance que
 * tout ce lot corrige. Le PDF et la page de kit ont passé des semaines
 * ouverts, non pas parce que quelqu'un avait décidé qu'ils le soient, mais
 * parce qu'ils étaient gardés par un EFFET DE BORD — une praticienne non
 * payante ne pouvait plus écrire `selected_direction_id`, donc elle n'arrivait
 * pas jusqu'à eux. Personne n'a rien décidé, et personne n'a rien vu.
 *
 * Une convention n'empêche pas ça. Une énumération, si : une route nouvelle
 * est soit gardée, soit inscrite ci-dessous avec sa raison, soit rouge.
 *
 * ── Les deux mécanismes de garde, et ils sont tous les deux réels ────────
 *
 *   1. LA VÉRIFICATION EXPLICITE — la route appelle `isBrandKitEntitled`, qui
 *      pose la question à `brand_kit_entitled` en base.
 *   2. LE REFUS DE LA BASE — la route appelle une fonction dont la base
 *      refuse l'appel pour un kit non déverrouillé (`payment_required` sur les
 *      RPC de l'éditeur de site, refus d'écriture sur `selectDirection`). La
 *      route n'a alors rien à décider : elle SURFACE le refus.
 *
 * Le second est le plus sûr des deux — une route qui oublie ne reçoit rien
 * plutôt que tout — mais il n'existe que là où la base porte déjà la garde.
 * D'où les deux.
 */

const ROOT = resolve(__dirname, "../..");
const ROUTES_DIR = join(ROOT, "app/api/brand-kits");

/**
 * Ce qui est GRATUIT, et pourquoi.
 *
 * C'est ici que la décision de produit se prend, à la main, une ligne par
 * surface. Elle est vide aujourd'hui : rien sous `brand-kits` n'est gratuit.
 * La révélation, elle, est gratuite et entière — mais elle est une page, pas
 * une route d'API, et elle ne sert pas de livrable.
 */
const FREE: Record<string, string> = {
  "app/api/brand-kits/[id]/delete/route.ts":
    "Deletion is account housekeeping, not a paid feature -- an unpaid or reversed kit must still be deletable.",
  "app/api/brand-kits/[id]/restore/route.ts":
    "Restoring undoes a free housekeeping action, not a paid one -- gating it on entitlement would be inconsistent.",
};

/** Les appels qui posent la question du droit, explicitement. */
const EXPLICIT_CHECK = /\bisBrandKitEntitled\s*\(/;

/**
 * Les appels que la BASE refuse pour un kit non déverrouillé.
 *
 * Repérés par leur nom d'appel dans le fichier de route, pas par un import :
 * `lib/data/brand-kit.ts` est atteint par presque tout le monde pour
 * `loadBrandKit`, et remonter la chaîne d'imports classerait comme gardée
 * n'importe quelle route qui lit un kit.
 */
const DB_REFUSED = [
  /\bselectDirection\s*\(/,
  /* LOT 6, 7 et 9 : toutes passent par `kit_paid_access` en base, qui répond
     `not_found` avant `payment_required`. La route ne décide rien, elle rend
     le refus — d'où l'exigence de `SURFACES_REFUSAL` juste en dessous. */
  /\bgetContentMonth\s*\(/,
  /\bgetContentItem\s*\(/,
  /\bcreateContentItem\s*\(/,
  /\bupdateContentItem\s*\(/,
  /\bdeleteContentItem\s*\(/,
  /\bmarkContentPosted\s*\(/,
  /* La check-in mensuelle : `set_content_checkin` appelle `content_kit_access`
     en base, comme les autres. La route ne décide rien, elle rend le refus. */
  /\bsetContentCheckin\s*\(/,
  /* Prendre le mois : `approve_content_month` résout le kit du mois puis
     appelle `content_kit_access`, qui répond `not_found` avant
     `payment_required` — un 402 à un inconnu confirmerait que le mois existe.
     Un second contrôle dans la route serait un second endroit où se tromper
     d'ordre. */
  /\bapproveContentMonth\s*\(/,
  /\bgetPublishingLog\s*\(/,
  /\blistUserUploads\s*\(/,
  /\brequestUserUpload\s*\(/,
  /\brecordUserUpload\s*\(/,
  /\bdeleteUserUpload\s*\(/,
  /\bsiteSpecGet\s*\(/,
  /\bsiteSpecPatch\s*\(/,
  /\bsiteSpecReset\s*\(/,
  /\bsiteSpecSetTarget\s*\(/,
  /\bsiteSpecFixContrast\s*\(/,
  /\bsiteOutputGet\s*\(/,
  /\bsiteOutputMarkCopied\s*\(/,
];

/**
 * Ce qui prouve qu'un refus de la base est bien RENDU à l'appelante.
 *
 * `siteResponse` traduit `payment_required` en 402 ; une route qui compose sa
 * réponse elle-même doit écrire le code. Sans cette seconde assertion, une
 * route pourrait se réclamer du refus de la base et l'avaler en 500.
 */
const SURFACES_REFUSAL = [
  /\bsiteResponse\s*\(/,
  /* `contentResponse` traduit le code en statut (404, 402, 400) en un seul
     endroit ; `refusal` fait la même chose pour les uploads. */
  /\bcontentResponse\s*\(/,
  /\brefusal\s*\(/,
  /\b402\b/,
];

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

/** On lit du CODE, pas de la prose : un commentaire ne garde rien. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

const ROUTES = routeFiles(ROUTES_DIR);

describe("l'énumération elle-même", () => {
  it("trouve bien les routes", () => {
    // Sans cette garde, un balayage cassé rendrait tout le reste vacuously
    // true — le pire des faux verts, et sur exactement le sujet où il coûte
    // le plus cher.
    expect(ROUTES.length).toBeGreaterThanOrEqual(9);
  });

  it("l'allowlist ne contient que des routes qui existent", () => {
    // Une entrée périmée est une exemption qui survit à la route qu'elle
    // exemptait, et qui couvrira la prochaine à porter ce nom.
    const known = new Set(ROUTES.map(relative));
    for (const path of Object.keys(FREE)) expect(known).toContain(path);
  });
});

describe("chaque route de brand-kits est gardée", () => {
  it.each(ROUTES.map((file) => [relative(file), file] as const))(
    "%s",
    (path, file) => {
      if (path in FREE) {
        // Décision explicite : elle doit porter sa raison, pas juste son nom.
        expect(FREE[path].length).toBeGreaterThan(20);
        return;
      }

      const source = code(file);
      const checked = EXPLICIT_CHECK.test(source);
      const refused = DB_REFUSED.some((pattern) => pattern.test(source));

      expect(
        checked || refused,
        `${path} ne vérifie pas le droit.\n` +
          "Trois issues, et il faut en choisir une :\n" +
          "  - appeler `isBrandKitEntitled(supabase, brandKitId)` ;\n" +
          "  - passer par une fonction que la base refuse elle-même ;\n" +
          "  - l'inscrire dans FREE, avec la raison pour laquelle elle est gratuite."
      ).toBe(true);

      if (refused && !checked) {
        expect(
          SURFACES_REFUSAL.some((pattern) => pattern.test(source)),
          `${path} s'appuie sur le refus de la base mais ne le rend pas.\n` +
            "Un refus avalé en 500 est un cul-de-sac ; en 402 c'est une offre."
        ).toBe(true);
      }
    }
  );
});

/*
 * Les PAGES qui rendent le kit. Même mode de défaillance, même énumération —
 * une page qui rend le livrable est une surface comme une autre.
 */
const KIT_PAGES = [
  "app/app/brand-kits/[id]/(sections)/page.tsx",
  "app/app/brand-kits/[id]/(sections)/identity/page.tsx",
  "app/app/brand-kits/[id]/(sections)/colors/page.tsx",
  "app/app/brand-kits/[id]/(sections)/type/page.tsx",
  "app/app/brand-kits/[id]/(sections)/site/page.tsx",
  "app/app/brand-kits/[id]/(sections)/words/page.tsx",
  "app/app/brand-kits/[id]/(sections)/assets/page.tsx",
  "app/app/brand-kits/[id]/site-editor/page.tsx",
  "app/app/brand-kits/[id]/delivered/page.tsx",
  "app/app/brand-kits/[id]/handoff/page.tsx",
  "app/app/brand-kits/[id]/uploads/page.tsx",
];

/**
 * Le TROISIÈME mécanisme de garde, et il n'existe que pour les sections.
 *
 * Les sept routes de section partagent `requireKitPage`, qui pose la question
 * du droit UNE fois : 404 avant `payment_required`, puis redirection vers le
 * checkout. Sept pages qui re-dérivent cet ordre, c'est sept occasions de
 * l'inverser — et l'inverser confirme à un inconnu qu'un kit existe.
 *
 * Une garde partagée ne vaut que si l'énumération la vérifie AUSSI : le bloc
 * ci-dessous exige donc que `lib/data/kit-page.ts` porte lui-même la
 * vérification explicite et la redirection. Sans ça, ce motif dirait « gardée »
 * dès qu'une page appelle une fonction au bon nom.
 */
const SHARED_GUARD = /\brequireKitPage\s*\(/;
const SHARED_GUARD_FILE = "lib/data/kit-page.ts";

describe("la garde partagée des sections est une vraie garde", () => {
  const source = code(join(ROOT, SHARED_GUARD_FILE));

  it("elle pose la question du droit", () => {
    expect(EXPLICIT_CHECK.test(source)).toBe(true);
  });

  it("elle emmène au checkout plutôt que de rendre un refus", () => {
    expect(source).toMatch(/\bredirect\(/);
    expect(source).toContain("/app/checkout");
  });

  it("elle répond 404 AVANT de parler d'argent", () => {
    // L'ordre est la garde : un 402 rendu à un inconnu confirmerait que le kit
    // existe et que sa propriétaire n'a pas payé.
    const notFoundAt = source.indexOf("notFound()");
    const entitledAt = source.search(EXPLICIT_CHECK);
    expect(notFoundAt).toBeGreaterThan(-1);
    expect(entitledAt).toBeGreaterThan(-1);
    expect(notFoundAt).toBeLessThan(entitledAt);
  });
});

/**
 * `KIT_PAGES` above is hand-maintained, unlike `ROUTES` — and a hand-
 * maintained list is a guard that can silently stop guarding the moment
 * someone adds a page and forgets the line (decided 2026-09-03,
 * `POST_PURCHASE_INVENTORY.md` §6, acted on with this chantier's first new
 * page route). This walks the same subtree `KIT_PAGES` is meant to cover
 * and fails if a real `page.tsx` is missing from it — `reveal` is the one
 * deliberate, asserted exemption above, not an oversight here.
 */
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

describe("les pages du kit sont gardées", () => {
  it.each(KIT_PAGES)("%s", (path) => {
    const source = code(join(ROOT, path));
    const checked = EXPLICIT_CHECK.test(source);
    const refused = DB_REFUSED.some((pattern) => pattern.test(source));
    const shared = SHARED_GUARD.test(source);

    expect(checked || refused || shared).toBe(true);

    // Une page ne rend pas un 402 : elle EMMÈNE au checkout. Un écran vide se
    // lirait comme une panne plutôt que comme une offre. L'adresse est parfois
    // composée dans une variable, d'où les deux assertions plutôt qu'un motif
    // qui exigerait de l'écrire en toutes lettres dans l'appel.
    //
    // Une page qui délègue à `requireKitPage` ne les écrit pas elle-même : la
    // redirection est dans la garde partagée, vérifiée par le bloc au-dessus.
    if (!shared) {
      expect(source).toMatch(/\bredirect\(/);
      expect(source).toContain("/app/checkout");
    }
  });

  it("la révélation, elle, reste libre — et c'est le point de vente", () => {
    const source = code(join(ROOT, "app/app/brand-kits/[id]/reveal/page.tsx"));
    expect(EXPLICIT_CHECK.test(source)).toBe(false);
    expect(source).not.toContain("/app/checkout");
  });

  it("aucune page réelle du kit n'est absente de KIT_PAGES", () => {
    const known = new Set([...KIT_PAGES, "app/app/brand-kits/[id]/reveal/page.tsx"]);
    const real = pageFiles(join(ROOT, "app/app/brand-kits/[id]")).map(relative);

    for (const path of real) {
      expect(
        known.has(path),
        `${path} existe mais n'est ni dans KIT_PAGES ni exempté comme la révélation.\n` +
          "Ajoute-le à l'une des deux listes, explicitement."
      ).toBe(true);
    }
  });
});

/*
 * ── LOT 11 : L'ÉNUMÉRATION S'ÉTEND À TOUT CE QUE CE CHANTIER A AJOUTÉ ────
 *
 * Les deux blocs ci-dessus ne couvrent que `app/api/brand-kits/**` et
 * `app/app/brand-kits/[id]/**`. Ce chantier a ajouté des surfaces AILLEURS —
 * le contenu, le lancement guidé, Check, les uploads — et une surface payante
 * hors de l'arbre balayé est exactement le trou que ce fichier existe pour
 * fermer. Le mode de défaillance est identique : personne ne décide rien,
 * personne ne voit rien.
 *
 * Trois exigences, et la troisième est celle qui tient dans le temps :
 *
 *   1. Chaque route et chaque page sous ces racines est gardée.
 *   2. Une page EMMÈNE au checkout ; elle ne rend pas un écran vide.
 *   3. La LISTE DES RACINES elle-même est vérifiée contre l'arborescence
 *      réelle : un nouveau répertoire sous `app/api` ou `app/app` fait échouer
 *      la suite tant que quelqu'un n'a pas dit à quelle catégorie il appartient.
 */

/** Les surfaces payantes ajoutées par ce chantier, hors des deux arbres déjà couverts. */
const CHANTIER_ROOTS = [
  "app/api/check",
  "app/api/content-items",
  /* Le mois généré : une seule route, `approve`, et elle est dans l'espace
     payant au même titre que les items qu'elle déplace. */
  "app/api/content-months",
  "app/app/check",
  "app/app/content",
  "app/app/launch",
];

function entryPoints(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entryPoints(full);
    return entry.name === "route.ts" || entry.name === "page.tsx" ? [full] : [];
  });
}

const CHANTIER_FILES = CHANTIER_ROOTS.flatMap((root) => entryPoints(join(ROOT, root)));

describe("les surfaces ajoutées hors de brand-kits sont gardées aussi", () => {
  it("l'énumération trouve bien quelque chose", () => {
    // Sans cette garde, une racine renommée rendrait tout le bloc vacuously
    // true — et c'est un bloc sur le paiement.
    expect(CHANTIER_FILES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(CHANTIER_FILES.map((file) => [relative(file), file] as const))(
    "%s",
    (path, file) => {
      const source = code(file);
      const checked = EXPLICIT_CHECK.test(source);
      const refused = DB_REFUSED.some((pattern) => pattern.test(source));

      expect(
        checked || refused,
        `${path} ne vérifie pas le droit.\n` +
          "Cette surface est dans l'espace payant : soit elle appelle\n" +
          "`isBrandKitEntitled`, soit elle passe par une RPC que la base refuse\n" +
          "elle-même via `kit_paid_access`."
      ).toBe(true);

      if (path.endsWith("page.tsx")) {
        /*
         * Une PAGE ne rend pas un 402 : elle emmène au checkout. Lui demander
         * `SURFACES_REFUSAL` serait exiger un code HTTP d'une chose qui n'en
         * rend pas — la garde équivalente pour une page est la redirection.
         */
        expect(source).toMatch(/\bredirect\(/);
        expect(source).toContain("/app/checkout");
      } else if (refused && !checked) {
        expect(
          SURFACES_REFUSAL.some((pattern) => pattern.test(source)),
          `${path} s'appuie sur le refus de la base mais ne le rend pas.\n` +
            "Un refus avalé en 500 est un cul-de-sac ; en 402 c'est une offre."
        ).toBe(true);
      }
    }
  );
});

/*
 * La liste des racines est écrite à la main, comme `KIT_PAGES` l'était — et
 * comme elle, elle cesserait de garder le jour où quelqu'un ajoute un
 * répertoire sans y penser. On vérifie donc l'arborescence RÉELLE contre trois
 * listes exhaustives : payant, gardé autrement, public. Un répertoire qui
 * n'est dans aucune des trois fait échouer la suite.
 */
const OTHER_GATE: Record<string, string> = {
  "app/api/cron": "Signed cron secret via authorizeCron, not a user session at all.",
  "app/api/stripe": "Stripe signature verification; the caller is Stripe, not a practitioner.",
  "app/api/unsubscribe": "A signed one-click link from an email, by design reachable without a session.",
  "app/api/briefs": "The pre-purchase funnel: the brief is free and is what gets bought.",
  "app/api/jobs": "Generation job status for the pre-purchase funnel, user-scoped by loadBrief.",
  "app/api/catalog": "Public reference data -- palettes, fonts, specialties. Nothing kit-specific.",
  "app/api/home": "The home aggregate, user-scoped; it shows a kit's existence, never its deliverables.",
  "app/api/search": "Searches only rows the caller's own RLS already returns.",
  "app/api/settings": "Account settings, user-scoped and unrelated to any kit.",
  "app/api/notifications": "The caller's own notifications, RLS-scoped.",
  "app/api/monthly-presence": "Opens a subscription checkout; refusing it to an unpaid user would refuse the sale.",
  "app/api/billing":
    "Opens the Stripe billing portal for the signed-in user's OWN customer. " +
    "It grants nothing and reads no kit: the portal is how someone cancels, " +
    "and gating the exit behind an entitlement is the one thing a subscription " +
    "must never do.",
  "app/api/checklist": "set_launch_step resolves ownership through brand_kits itself.",
  "app/app/briefs": "The pre-purchase brief. Free on purpose: it is the thing being sold.",
  "app/app/checkout": "The checkout itself. Gating it on having paid would be a closed loop.",
  "app/app/settings": "Account settings, user-scoped and unrelated to any kit.",
};

describe("aucune surface n'échappe au classement", () => {
  const directoriesUnder = (parent: string) =>
    readdirSync(join(ROOT, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}`);

  it("chaque répertoire de `app/api` et `app/app` est classé", () => {
    const real = [...directoriesUnder("app/api"), ...directoriesUnder("app/app")];
    const classified = new Set([
      ...CHANTIER_ROOTS,
      ...Object.keys(OTHER_GATE),
      // Déjà couverts par les deux blocs du haut de ce fichier.
      "app/api/brand-kits",
      "app/app/brand-kits",
    ]);

    for (const dir of real) {
      expect(
        classified.has(dir),
        `${dir} n'est classé nulle part.\n` +
          "Ajoute-le à CHANTIER_ROOTS s'il est dans l'espace payant, ou à\n" +
          "OTHER_GATE avec la raison pour laquelle il est gardé autrement.\n" +
          "Une surface payante hors de l'énumération est exactement le trou que\n" +
          "ce fichier existe pour fermer."
      ).toBe(true);
    }
  });

  it("chaque exemption porte une vraie raison, pas un nom", () => {
    for (const [dir, reason] of Object.entries(OTHER_GATE)) {
      expect(reason.length, `${dir} : la raison est trop courte`).toBeGreaterThan(30);
    }
  });

  it("aucune exemption ne survit au répertoire qu'elle exemptait", () => {
    // Une entrée périmée couvrira le prochain répertoire à porter ce nom.
    const real = new Set([...directoriesUnder("app/api"), ...directoriesUnder("app/app")]);
    for (const dir of Object.keys(OTHER_GATE)) expect(real).toContain(dir);
  });
});

/*
 * ── L'ORDRE DANS LA ROUTE DE GÉNÉRATION ──────────────────────────────────
 *
 * `consume_generation_credit` résout le projet À TRAVERS le kit : sans ligne
 * `brand_kits`, elle rend `false`. Appelée avant la création de la ligne, elle
 * refuserait TOUTE génération — payante comprise — et le ferait en SILENCE :
 * l'utilisatrice lirait « allocation épuisée » sur un compte tout neuf, et
 * rien dans les logs ne ressemblerait à une panne.
 *
 * L'ordre est correct aujourd'hui. Ce test existe parce que rien, en lisant
 * l'appel, ne dit qu'il dépend de ce qui le précède — c'est une précondition
 * de la fonction en base, invisible d'ici.
 */
describe("la ligne de kit précède le crédit", () => {
  const GENERATE = join(ROOT, "app/api/briefs/[id]/generate/route.ts");

  it("l'insert de `brand_kits` vient avant `consume_generation_credit`", () => {
    const source = code(GENERATE);
    const insert = source.indexOf("project_id: projectId,");
    const credit = source.indexOf("consume_generation_credit");

    expect(insert).toBeGreaterThan(-1);
    expect(credit).toBeGreaterThan(-1);
    expect(
      insert < credit,
      "Le crédit est consommé avant que la ligne `brand_kits` n'existe.\n" +
        "`consume_generation_credit` rendrait `false` pour tout le monde, et\n" +
        "la refus se lirait « allocation épuisée » plutôt que comme une panne."
    ).toBe(true);
  });

  it("le kit passé au crédit sort d'une ligne rendue par la base", () => {
    // `kit.id`, pas `existing?.id` ni un id composé : la ligne est donc
    // committée et visible quand la fonction la relit.
    expect(code(GENERATE)).toContain("p_brand_kit_id: kit.id");
  });

  it("rien d'autre dans le dépôt ne crée de `brand_kits`", () => {
    // Si la pipeline créait le kit à partir du résultat, l'ordre serait
    // inversé sans que cette route change d'une ligne.
    const inserts: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next") continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !full.includes("__tests__")) {
          const source = code(full);
          if (/from\("brand_kits"\)[\s\S]{0,80}?\.insert\(/.test(source)) {
            inserts.push(full.slice(ROOT.length + 1).replace(/\\/g, "/"));
          }
        }
      }
    };
    for (const dir of ["lib", "app", "components"]) walk(join(ROOT, dir));

    expect(inserts).toEqual(["app/api/briefs/[id]/generate/route.ts"]);
  });
});

/*
 * Monthly Presence's own paywall (Lot 8) is a DIFFERENT question from a kit
 * purchase — `isEntitledToMonthlyPresence`, a subscription, not
 * `isBrandKitEntitled` — and its one route lives outside `ROUTES_DIR`, so it
 * is invisible to the enumeration above. A second, small, parallel check
 * rather than folding it into machinery built for a different guard.
 */
describe("le paywall de Monthly Presence est gardé séparément", () => {
  it("app/api/monthly-presence/checkout/route.ts appelle isEntitledToMonthlyPresence", () => {
    const source = code(join(ROOT, "app/api/monthly-presence/checkout/route.ts"));
    expect(source).toMatch(/\bisEntitledToMonthlyPresence\s*\(/);
  });
});
