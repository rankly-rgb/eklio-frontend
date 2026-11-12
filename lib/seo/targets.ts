import type { SeoKind } from "@/lib/seo/kinds";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE CHOIX DES CIBLES DU MOIS — DÉTERMINISTE, SANS APPEL DE MODÈLE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1. GÉNÉRER   croiser ses modalités, ses personas, sa ville et son État avec
 *                la banque `seo_query_templates`. Rien n'est saisi en texte
 *                libre : les clés viennent du brief, les mots de recherche de
 *                `seo_modality_terms` / `seo_population_terms`.
 *   2. EXCLURE   toute intention déjà assignée ou retirée chez elle : deux pièces
 *                ne se cannibalisent pas sur son propre site.
 *   3. CLASSER   par volume (`seo_query_metrics`) quand il existe, sinon par la
 *                priorité fixe du gabarit — sa modalité principale en local
 *                d'abord, puis les populations, puis « what to expect », puis
 *                la psychoéducation.
 *   4. CHOISIR   autant que le quota du mois en donne, par genre — et deux
 *                articles d'un même mois viennent de deux gabarits différents
 *                quand c'est possible.
 *
 * La RÉSERVATION (`claim_seo_slot`) n'est pas ici : c'est la base qui décide.
 * Ce module dit seulement, dans l'ordre, ce qu'on essaierait d'écrire.
 */

export type QueryTemplate = {
  id: string;
  kind: SeoKind;
  queryPattern: string;
  intentPattern: string;
  priority: number;
  active: boolean;
};

/** Ce que le brief dit, en clés. La première modalité est la principale. */
export type BriefGrid = {
  modalityKeys: string[];
  populationKeys: string[];
  /** `project_briefs.state`, l'autorité (F76). */
  state: string | null;
  /** `project_briefs.city`, l'autorité. */
  city: string | null;
};

export type SearchTerms = {
  modality: ReadonlyMap<string, string>;
  population: ReadonlyMap<string, string>;
};

export type CandidateTarget = {
  kind: SeoKind;
  templateId: string;
  modalityKey: string | null;
  populationKey: string | null;
  state: string | null;
  city: string | null;
  primaryQuery: string;
  intentKey: string;
  /** Priorité du gabarit. */
  priority: number;
  /** Rang de la modalité dans le brief (0 = principale), puis de la persona. */
  modalityRank: number;
  populationRank: number;
};

/** Une cible déjà en base, telle que la sélection la relit. */
export type StoredTarget = CandidateTarget & {
  id: string;
  status: "available" | "assigned" | "retired";
};

/* ── Normalisations, écrites une fois ─────────────────────────────────── */

/** Le code d'État tel que la base le porte : deux lettres majuscules, ou null. */
export function normalizeState(state: string | null | undefined): string | null {
  const s = (state ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

/** La ville telle qu'elle est écrite dans le brief, sans blanc en bordure. */
export function normalizeCity(city: string | null | undefined): string | null {
  const c = (city ?? "").trim().replace(/\s+/g, " ");
  return c.length > 0 && c.length <= 80 ? c : null;
}

/** Un fragment d'intention : `Oakland` → `oakland`, `San José` → `san-jose`. */
export function intentFragment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * La forme normalisée d'une requête — EXACTEMENT celle que le CHECK de
 * `seo_query_metrics.query_norm` exige : minuscules, sans blanc en bordure, un
 * seul espace entre les mots.
 */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/* ── 1. Générer ───────────────────────────────────────────────────────── */

function slotsOf(pattern: string): Set<string> {
  return new Set([...pattern.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]));
}

function fill(pattern: string, values: Record<string, string>): string {
  return pattern.replace(/\{([a-z]+)\}/g, (_, slot: string) => values[slot] ?? `{${slot}}`);
}

/**
 * Toutes les cibles que sa grille permet, une par (gabarit × modalité ×
 * persona) pertinente. Déterministe : même brief, même banque → même liste,
 * dans le même ordre.
 *
 * ⚠ UNE CLÉ SANS TERME DE RECHERCHE EST ÉCARTÉE, PAS DEVINÉE. Écrire « reiki
 * therapy » faute de terme curé serait exactement le texte libre que la grille
 * interdit.
 */
export function deriveTargets(
  grid: BriefGrid,
  templates: readonly QueryTemplate[],
  terms: SearchTerms
): CandidateTarget[] {
  const state = normalizeState(grid.state);
  const city = normalizeCity(grid.city);
  const modalities = dedupe(grid.modalityKeys).filter((k) => terms.modality.has(k));
  const populations = dedupe(grid.populationKeys).filter((k) => terms.population.has(k));

  const out: CandidateTarget[] = [];
  const seen = new Set<string>();

  for (const template of templates) {
    if (!template.active) continue;
    const slots = slotsOf(template.queryPattern);
    const needsPlace = slots.has("city") || slots.has("state");
    if (needsPlace && (!city || !state)) continue;

    const modalityChoices: Array<[string | null, number]> = slots.has("modality")
      ? modalities.map((k, i) => [k, i])
      : [[null, 0]];
    const populationChoices: Array<[string | null, number]> = slots.has("population")
      ? populations.map((k, i) => [k, i])
      : [[null, 0]];

    for (const [modalityKey, modalityRank] of modalityChoices) {
      for (const [populationKey, populationRank] of populationChoices) {
        const words: Record<string, string> = {
          ...(modalityKey ? { modality: terms.modality.get(modalityKey)! } : {}),
          ...(populationKey ? { population: terms.population.get(populationKey)! } : {}),
          ...(needsPlace ? { city: city!, state: state! } : {}),
        };
        const keys: Record<string, string> = {
          ...(modalityKey ? { modality: modalityKey } : {}),
          ...(populationKey ? { population: populationKey } : {}),
          ...(needsPlace ? { city: intentFragment(city!), state: state!.toLowerCase() } : {}),
        };
        const intentKey = fill(template.intentPattern, keys);
        if (seen.has(intentKey)) continue;
        seen.add(intentKey);
        out.push({
          kind: template.kind,
          templateId: template.id,
          modalityKey,
          populationKey,
          state: needsPlace ? state : null,
          city: needsPlace ? city : null,
          primaryQuery: fill(template.queryPattern, words),
          intentKey,
          priority: template.priority,
          modalityRank,
          populationRank,
        });
      }
    }
  }
  return out;
}

/* ── 2 et 3. Exclure, classer ─────────────────────────────────────────── */

/**
 * Une cible enregistrée vise-t-elle ENCORE ce que dit le brief ? Une praticienne
 * qui a déménagé ou retiré une modalité ne doit pas recevoir une page sur
 * l'ancienne. `project_briefs.state`/`city` font autorité (F76) : la cible n'en
 * est qu'un cachet, comparé ici à chaque sélection.
 */
export function targetMatchesBrief(target: CandidateTarget, grid: BriefGrid): boolean {
  if (target.modalityKey && !grid.modalityKeys.includes(target.modalityKey)) return false;
  if (target.populationKey && !grid.populationKeys.includes(target.populationKey)) return false;
  if (target.kind === "local_page") {
    return (
      target.state === normalizeState(grid.state) &&
      (target.city ?? "").toLowerCase() === (normalizeCity(grid.city) ?? "").toLowerCase()
    );
  }
  return true;
}

export type Metrics = ReadonlyMap<string, number>;

/** La clé d'une métrique : requête normalisée + État (`US` pour un article). */
export function metricKey(target: Pick<CandidateTarget, "primaryQuery" | "state">): string {
  return `${normalizeQuery(target.primaryQuery)}|${target.state ?? "US"}`;
}

/**
 * Le classement. Une cible qui a un volume mesuré passe devant celles qui n'en
 * ont pas, et entre elles le plus gros volume d'abord. Sans volume (le cas de
 * toute la v1 : la table est vide), l'ordre fixe : priorité du gabarit, puis
 * rang de la modalité, puis rang de la persona, puis l'intention (stable).
 */
export function rankTargets<T extends CandidateTarget>(candidates: readonly T[], metrics: Metrics): T[] {
  return [...candidates].sort((a, b) => {
    const va = metrics.get(metricKey(a));
    const vb = metrics.get(metricKey(b));
    if ((va !== undefined) !== (vb !== undefined)) return va !== undefined ? -1 : 1;
    if (va !== undefined && vb !== undefined && va !== vb) return vb - va;
    return (
      a.priority - b.priority ||
      a.modalityRank - b.modalityRank ||
      a.populationRank - b.populationRank ||
      a.intentKey.localeCompare(b.intentKey)
    );
  });
}

/* ── 4. Choisir ───────────────────────────────────────────────────────── */

/**
 * Les cibles du mois, par genre, dans l'ordre où on les essaiera.
 *
 * `taken` : les intentions déjà assignées ou retirées chez elle — exclues.
 * `quota` : ce que `seo_quota_for` a rendu. Zéro partout → aucune cible.
 *
 * ⚠ DEUX ARTICLES D'UN MÊME MOIS, DEUX GABARITS. « EMDR for new parents » et
 * « EMDR for couples » le même mois se ressemblent trop pour qu'elle les publie
 * côte à côte. Un même gabarit n'est repris que s'il n'y a rien d'autre.
 *
 * Une cible mise en quarantaine est RETIRÉE (elle ne revient pas) et son
 * emplacement rendu : le déclenchement suivant, s'il reste des tentatives
 * (`seo_quota_config.monthly_attempts`), choisit la suivante de la liste.
 */
export function chooseMonthTargets<T extends CandidateTarget>(
  ranked: readonly T[],
  taken: ReadonlySet<string>,
  quota: Readonly<Record<SeoKind, number>>
): Record<SeoKind, T[]> {
  const out: Record<SeoKind, T[]> = { local_page: [], article: [] };
  for (const kind of ["local_page", "article"] as const) {
    const want = Math.max(0, Math.floor(quota[kind] ?? 0));
    if (want === 0) continue;
    const pool = ranked.filter((t) => t.kind === kind && !taken.has(t.intentKey));
    const chosen: T[] = [];
    const usedTemplates = new Set<string>();
    for (const t of pool) {
      if (chosen.length === want) break;
      if (usedTemplates.has(t.templateId)) continue;
      chosen.push(t);
      usedTemplates.add(t.templateId);
    }
    for (const t of pool) {
      if (chosen.length === want) break;
      if (!chosen.includes(t)) chosen.push(t);
    }
    out[kind] = chosen;
  }
  return out;
}

function dedupe(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    const key = (k ?? "").trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}
