/*
 * ── LE PROFIL D'ANNUAIRE — L'ASSEMBLAGE, ET CE QU'IL REFUSE DE FAIRE ────
 *
 * The Foundation livre « son profil Psychology Today intégral rédigé ». Ce
 * n'est pas un texte : c'est un FORMULAIRE plus une prose, et le premier
 * paragraphe de cette prose est le seul morceau que les résultats de recherche
 * de l'annuaire affichent.
 *
 * ⚠ LA RAISON D'ÊTRE DE CE MODULE EST UN DÉFAUT QUI A DÉJÀ COÛTÉ.
 *
 * `site_spec_token_lines` lisait `p_spec->>'primary_text_hex'` à nu.
 * `'libellé' || ': ' || NULL` vaut NULL, et TROIS LIGNES ONT DISPARU d'un
 * livrable payant sans la moindre erreur — trouvées en lisant la sortie
 * rendue, pas en lisant le code (backend `README.md`, « Discipline NULL »).
 *
 * Un profil d'annuaire est *exactement* le terrain de ce défaut : un numéro de
 * licence, un état, un tarif, une assurance, une modalité — tous optionnels,
 * tous absents chez quelqu'un. D'où trois règles, appliquées ici et vérifiées
 * par `profile.test.ts` :
 *
 *   1. AUCUNE CONCATÉNATION D'UN CHAMP OPTIONNEL. Un champ absent ne produit
 *      PAS de ligne — il ne produit pas non plus une ligne vide, ni un
 *      libellé suivi de rien.
 *   2. RIEN N'EST JAMAIS `undefined` DANS UNE SORTIE. Ce qui est absent est
 *      absent de la structure, pas présent et vide.
 *   3. LE CAS « TOUS LES OPTIONNELS VIDES » EST UN CAS NORMAL, pas une panne.
 *      Il a son test, et il produit un profil valide.
 */

/** Une valeur qui vaut la peine d'être écrite : ni nulle, ni vide. */
function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Une liste de libellés, purgée de ses trous.
 *
 * ⚠ `array_to_string` ÉCARTE LES NULL EN SILENCE — c'est le troisième des
 * quatre défauts permissifs du backend, et c'est ce qui a rendu le défaut de
 * concaténation invisible. Ici, un identifiant dont le libellé de catalogue a
 * disparu (retiré, désactivé, renommé) ne laisse pas un trou muet : il ne
 * produit rien, et la liste est plus courte, ce qui se voit.
 */
export function labelList(values: readonly (string | null | undefined)[]): string[] {
  return values.filter(present).map((value) => value.trim());
}

/* ── Les champs du formulaire ────────────────────────────────────────────── */

/**
 * Les champs structurés, tels que `directory_profiles.structured` les stocke.
 *
 * ⚠ CHAQUE CLÉ EST OPTIONNELLE, ET UNE CLÉ ABSENTE EST UNE ABSENCE — pas une
 * liste vide. La base l'impose dans l'autre sens : `directory_structured_valid`
 * refuse une chaîne vide DANS une liste, parce que c'est la forme que prend un
 * champ optionnel tombé sans que personne ne l'ait traité.
 */
export type StructuredFields = {
  licensed_state?: string[];
  issues?: string[];
  therapy_types?: string[];
  client_focus?: string[];
  insurance?: string[];
};

export type StructuredInput = {
  state: string | null;
  /** Libellés déjà résolus depuis le catalogue. Jamais des identifiants. */
  specialties: readonly (string | null | undefined)[];
  modalities: readonly (string | null | undefined)[];
  personas: readonly (string | null | undefined)[];
  insurances: readonly (string | null | undefined)[];
};

/**
 * Assemble les champs du formulaire.
 *
 * Une clé n'apparaît QUE si elle a au moins une valeur. Le résultat d'une
 * praticienne qui n'a rien rempli est `{}` — un objet valide, la valeur par
 * défaut de la colonne, et pas une panne.
 */
export function buildStructuredFields(input: StructuredInput): StructuredFields {
  const fields: StructuredFields = {};

  const put = (
    key: keyof StructuredFields,
    values: readonly (string | null | undefined)[]
  ) => {
    const list = labelList(values);
    // ⚠ PAS DE CLÉ VIDE. `{issues: []}` et l'absence de `issues` disent la
    // même chose à un humain et deux choses différentes à du code : la
    // première invite à écrire « Issues: » suivi de rien.
    if (list.length > 0) fields[key] = list;
  };

  put("licensed_state", [input.state]);
  put("issues", input.specialties);
  put("therapy_types", input.modalities);
  put("client_focus", input.personas);
  put("insurance", input.insurances);

  return fields;
}

/* ── La prose ────────────────────────────────────────────────────────────── */

/**
 * Ce que l'annuaire accepte.
 *
 * ⚠ LES DEUX BORNES SONT CELLES DE LA BASE, et elles y sont aussi
 * (`directory_profiles_first_paragraph_check`, `_body_check`). La duplication
 * est voulue : ici, elle évite un aller-retour vers une contrainte qui va
 * refuser ; là-bas, elle est l'autorité. `profile.test.ts` les épingle.
 */
export const FIRST_PARAGRAPH_MAX = 1200;
export const BODY_MAX = 6000;

export type DirectoryProse = {
  /** Le seul morceau que les résultats de recherche montrent. */
  firstParagraph: string;
  /** Le reste. NE RÉPÈTE PAS le premier paragraphe. */
  body: string;
};

export type ProseProblem =
  | "first_paragraph_missing"
  | "body_missing"
  | "first_paragraph_too_long"
  | "body_too_long"
  | "body_repeats_first_paragraph";

export type ProseVerdict =
  | { ok: true; prose: DirectoryProse }
  | { ok: false; problems: ProseProblem[] };

/**
 * Vérifie la prose produite par le modèle, sans jamais la réparer en silence.
 *
 * ⚠ ON NE TRONQUE PAS. Une prose trop longue est renvoyée en échec, pas coupée
 * à la bonne longueur : une coupure silencieuse produit une phrase qui
 * s'arrête au milieu, sur un profil public, et personne ne l'a décidée. C'est
 * la règle commune du dépôt — « quand un choix existe entre refuser bruyamment
 * et rendre quelque chose d'incomplet, prendre le refus ».
 *
 * ⚠ ET ON REFUSE LA RÉPÉTITION. Un modèle à qui on demande « le premier
 * paragraphe, puis le reste » recopie très souvent le premier paragraphe en
 * tête du reste. Le profil affiché montrerait alors deux fois la même phrase.
 */
export function checkProse(
  firstParagraph: string | null | undefined,
  body: string | null | undefined
): ProseVerdict {
  const problems: ProseProblem[] = [];

  const first = present(firstParagraph) ? firstParagraph.trim() : "";
  const rest = present(body) ? body.trim() : "";

  if (first === "") problems.push("first_paragraph_missing");
  if (rest === "") problems.push("body_missing");
  if (first.length > FIRST_PARAGRAPH_MAX) problems.push("first_paragraph_too_long");
  if (rest.length > BODY_MAX) problems.push("body_too_long");

  if (first !== "" && rest !== "" && rest.startsWith(first)) {
    problems.push("body_repeats_first_paragraph");
  }

  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, prose: { firstParagraph: first, body: rest } };
}

/* ── Ce qui part en base ─────────────────────────────────────────────────── */

export type DirectoryProfileDraft = {
  platform: "psychology_today" | "google_business";
  prose: DirectoryProse;
  structured: StructuredFields;
};

/**
 * Le profil, prêt à ranger.
 *
 * ⚠ LES CHAMPS STRUCTURÉS NE SONT PAS FONDUS DANS LA PROSE, et c'est une
 * décision, pas une commodité. Une fonctionnalité ultérieure les relira — pour
 * remplir le formulaire, pour mesurer, pour comparer — et une phrase dont il
 * faut réextraire « LCSW, Oregon, trauma » est une phrase qu'on relira mal.
 *
 * Cette fonction ne fabrique donc AUCUNE chaîne. Elle ne joint rien, elle
 * n'insère aucun séparateur, elle ne met aucun libellé devant une valeur. Tout
 * ce qu'elle fait est de refuser ce qui n'est pas complet.
 */
export function buildDirectoryProfile(input: {
  platform: DirectoryProfileDraft["platform"];
  firstParagraph: string | null | undefined;
  body: string | null | undefined;
  structured: StructuredInput;
}): { ok: true; draft: DirectoryProfileDraft } | { ok: false; problems: ProseProblem[] } {
  const verdict = checkProse(input.firstParagraph, input.body);
  if (!verdict.ok) return { ok: false, problems: verdict.problems };

  return {
    ok: true,
    draft: {
      platform: input.platform,
      prose: verdict.prose,
      structured: buildStructuredFields(input.structured),
    },
  };
}
