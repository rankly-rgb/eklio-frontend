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
  | "body_repeats_first_paragraph"
  | "has_section_heading";

/*
 * ⚠ UNE LIGNE EN CAPITALES EST UN INTERTITRE, ET UN PROFIL N'EST PAS UNE
 * BROCHURE. Relevé sur le chemin réel le 20 septembre : WHAT THE WORK LOOKS
 * LIKE, et ses voisines.
 *
 * La prohibition est aussi écrite dans le prompt, et c'est le niveau 1. Celle-
 * ci est le niveau 2, parce qu'un format est exactement le genre de consigne
 * qu'un modèle laisse tomber sans le dire — et parce que ce défaut-là se
 * mesure sans jugement : ou bien la ligne est en capitales, ou bien elle ne
 * l'est pas.
 *
 * ⚠ DEUX MOTS AU MOINS, ET C'EST LA CONDITION QUI ÉVITE LE FAUX POSITIF. Un
 * sigle seul sur sa ligne — EMDR, LCSW — est en capitales sans être un
 * intertitre. La règle ne vise que ce qui se lit comme un titre de section.
 *
 * ⚠ ET LA BASE NE LA PORTE PAS. Les deux bornes de longueur sont dupliquées en
 * base parce qu'elles y sont l'autorité ; celle-ci ne l'est pas — comme
 * `body_repeats_first_paragraph`, qui vit déjà ici seule. C'est une porte de
 * QUALITÉ qui offre une reprise, pas une garantie d'intégrité.
 */
function looksLikeAHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "") return false;
  // Au moins deux mots : un sigle isolé n'est pas un intertitre.
  if (trimmed.split(/\s+/).length < 2) return false;
  // Au moins deux lettres, sinon « 12 34 » compterait.
  const lettres = trimmed.replace(/[^\p{L}]/gu, "");
  if (lettres.length < 2) return false;
  return lettres === lettres.toUpperCase() && lettres !== lettres.toLowerCase();
}

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

  /*
   * Les deux champs : rien n'empêche un intertitre d'ouvrir le premier
   * paragraphe.
   *
   * ⚠ PAS DE LITTÉRAL DE GABARIT ICI, et ce n'est pas du style. `profile.test.ts`
   * refuse tout `${` dans ce fichier — c'est la garde qui tient la discipline de
   * L9 : ce module n'ASSEMBLE aucune chaîne. La première version de cette
   * ligne joignait les deux champs avec un gabarit et le test l'a refusée, à
   * juste titre : concaténer pour analyser, c'est déjà concaténer.
   */
  const lignes = [...first.split("\n"), ...rest.split("\n")];
  if (lignes.some(looksLikeAHeading)) {
    problems.push("has_section_heading");
  }

  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, prose: { firstParagraph: first, body: rest } };
}

/* ── Le bloc de credential ───────────────────────────────────────────────── */

/**
 * Le nom et le titre d'exercice, COMPOSÉS PAR LE CODE et jamais par le modèle.
 *
 * ⚠ DÉCISION DU 18 SEPTEMBRE, CONSTRUITE LE 20. La prose n'écrit plus aucun
 * titre ; le titre vit dans un bloc à part, que rien n'imbrique dans une
 * phrase. Trois sorties du chemin réel annonçaient toutes une licence en
 * plein texte, et un titre à l'intérieur d'une phrase est un titre que le
 * modèle a choisi d'écrire — donc qu'il peut choisir d'inventer.
 *
 * ⚠ ET LE TITRE NE VIENT PAS DE `practitioner_line`. Mesuré le 20 septembre
 * sur les trois briefs réels : l'un porte « Gary Whitfiled, PSYCH » alors que
 * son brief dit `lcsw`. Recopier la ligne imprimerait le titre d'un AUTRE
 * board. Le nom vient de la ligne, le titre vient du CATALOGUE — c'est-à-dire
 * de `license_types.description` et de la matrice État, le miroir applicatif
 * de `title_abbreviation()`.
 *
 * ⚠ RIEN N'EST ASSEMBLÉ ICI. On rend trois champs ; c'est l'écran qui met la
 * virgule. C'est la règle du module (aucun `${` dans ce fichier) et elle vaut
 * ici plus qu'ailleurs : une chaîne composée en amont est une chaîne qu'on ne
 * peut plus recouper.
 */
export type CredentialBlock = {
  /** Son nom, sans le titre qui suivait la virgule. */
  name: string;
  /** L'intitulé complet, toujours imprimable : « Licensed Clinical Social Worker ». */
  title: string;
  /**
   * Le sigle de SON État, ou `null` quand le board n'en publie pas — la
   * Californie pour une psychologue, l'Oregon tant que le couple n'est pas
   * relevé. `null` n'est pas une absence de titre : c'est `title` qui s'écrit.
   */
  abbreviation: string | null;
};

/**
 * ⚠ LE NOM S'ARRÊTE À LA PREMIÈRE VIRGULE, et c'est la seule coupe faite ici.
 * `practitioner_line` est saisie par la cliente sous la forme « Nom, TITRE » ;
 * ce qui suit la virgule est un titre qu'elle a écrit elle-même et que nous ne
 * réimprimons pas — nous imprimons celui que le catalogue atteste.
 */
export function buildCredentialBlock(
  practitionerLine: string | null | undefined,
  title: { full: string; abbreviation: string | null } | null
): CredentialBlock | null {
  if (!present(practitionerLine) || title === null) return null;
  const name = practitionerLine.split(",")[0].trim();
  if (name === "") return null;
  return { name, title: title.full, abbreviation: title.abbreviation };
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
