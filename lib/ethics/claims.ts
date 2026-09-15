import type { EthicsViolation } from "@/lib/ethics/rules";

/*
 * ── UN CREDENTIAL QUE LE BRIEF NE PORTE PAS ─────────────────────────────
 *
 * ⚠ LA RÈGLE EXISTAIT DÉJÀ, ET ELLE N'A RIEN ARRÊTÉ. `ETHICS_SYSTEM_RULES`
 * porte depuis le début sa règle 4 — « CREDENTIALS EXACTLY AS PROVIDED […]
 * Never infer, upgrade or invent a credential ». C'est du NIVEAU 1 : du
 * pilotage de modèle. Le commentaire en tête de `rules.ts` dit lui-même
 * pourquoi ça ne suffit jamais et pourquoi il existe un niveau 2.
 *
 * Or le niveau 2 — `checkEthics(text)` — ne PEUT pas répondre à cette
 * question-là. Il reçoit un texte et une liste de regex, rien d'autre. « Ce
 * titre figure-t-il dans le brief ? » demande le brief, qu'il n'a pas. Les
 * patterns `credential` existants n'attrapent donc que des credentials
 * GONFLÉS par leur forme (« certified after a weekend »), jamais un credential
 * simplement ABSENT de la saisie.
 *
 * Ce module est le troisième terme : le même scan, avec en plus ce que le
 * brief AUTORISE. Il ne remplace pas `checkEthics`, il l'accompagne — et rend
 * la même forme de violation, sous le même `ruleId` (`credential`), pour que
 * `ethics_check.flagged[].rule_id` continue de référencer `ethics_rules` en
 * base sans qu'une quatrième liste apparaisse.
 *
 * ── CE QU'IL REFUSE ─────────────────────────────────────────────────────
 *
 *   un TITRE        (LMHC, LPC, PsyD…) absent du brief
 *   un DIPLÔME      (PhD, PsyD, MSW, MA…) absent du brief
 *   une CERTIFICATION revendiquée (« certified in EMDR », « board certified »)
 *   une ANCIENNETÉ  (« 15 years of experience »)
 *
 * ⚠ L'ANCIENNETÉ EST TOUJOURS REFUSÉE, sans exception et sans liste blanche :
 * le brief NE PORTE AUCUN CHAMP d'années d'expérience. Il n'existe donc aucune
 * valeur que le modèle pourrait légitimement écrire — toute année qu'il produit
 * est inventée par construction. C'est le cas le plus net des quatre, et celui
 * qu'une règle de prompt seule ne pourra jamais tenir.
 */

/** Ce que le brief autorise à écrire. Tout le reste est inventé. */
export type AllowedClaims = {
  /** Sigles tels qu'ils figurent au catalogue : « LPC », « PsyD »… */
  licenseLabels: string[];
  /** Intitulés complets : « Licensed Professional Counselor »… */
  licenseNames: string[];
};

/**
 * Le vocabulaire des sigles que ce produit sait reconnaître.
 *
 * ⚠ CE N'EST PAS LE CATALOGUE, et la différence est le tout. Le catalogue dit
 * ce qu'elle PEUT choisir ; cette liste dit ce qu'on sait LIRE dans une prose.
 * Elle est donc plus large que les dix titres : un modèle qui écrirait « LMHC »
 * pour une LPC choisirait un sigle réel, et c'est précisément celui-là qu'il
 * faut savoir repérer. Un sigle absent des deux listes passe — on préfère un
 * trou nommé à une garde qui refuse des mots ordinaires.
 */
const KNOWN_CREDENTIALS = [
  // Conseil
  "LPC", "LPCC", "LMHC", "LCPC", "LPCMH", "LCMHC", "LMHP",
  // Travail social
  "LCSW", "LICSW", "LMSW", "LSW", "LCSW-C", "LISW",
  // Couple et famille
  "LMFT", "LCMFT", "MFT",
  // Psychologie et diplômes
  "PsyD", "PhD", "EdD", "MD", "MSW", "MSEd", "MEd", "MA", "MS", "MSc",
  // Addiction / divers
  "LADC", "CADC", "LCDC", "LPCA", "NCC", "ACS", "RN", "PMHNP", "APRN",
] as const;

/**
 * Sigles qu'on ne signale JAMAIS, parce qu'ils ne revendiquent rien.
 *
 * `EMDR`, `CBT`, `DBT`, `IFS` sont des MODALITÉS. Elles sont au catalogue de
 * l'étape 4 et elles s'écrivent librement : décrire le travail est le sujet.
 * Ce qui est interdit est de les présenter comme une certification — et ça,
 * c'est le pattern `credential` existant de `rules.ts` qui l'attrape.
 */
const NEVER_A_CLAIM = new Set(["EMDR", "CBT", "DBT", "IFS", "ACT", "EFT", "ERP"]);

/* Les intitulés complets, appariés à leur sigle pour les nommer tous les deux. */
const FULL_NAMES: readonly { name: RegExp; label: string }[] = [
  { name: /\bLicensed\s+Mental\s+Health\s+Counselors?\b/i, label: "LMHC" },
  { name: /\bLicensed\s+Professional\s+Clinical\s+Counselors?\b/i, label: "LPCC" },
  { name: /\bLicensed\s+Clinical\s+Professional\s+Counselors?\b/i, label: "LCPC" },
  { name: /\bLicensed\s+Professional\s+Counselors?\b/i, label: "LPC" },
  { name: /\bLicensed\s+Independent\s+Clinical\s+Social\s+Workers?\b/i, label: "LICSW" },
  { name: /\bLicensed\s+Clinical\s+Social\s+Workers?\b/i, label: "LCSW" },
  { name: /\bLicensed\s+Master\s+Social\s+Workers?\b/i, label: "LMSW" },
  { name: /\bLicensed\s+Marriage\s+and\s+Family\s+Therapists?\b/i, label: "LMFT" },
  { name: /\bDoctor\s+of\s+Psychology\b/i, label: "PsyD" },
  { name: /\bLicensed\s+Psychologists?\b/i, label: "PsyD" },
];

/* « certified in X », « board certified », « certification in X ». */
const CERTIFICATION =
  /\b(?:board[-\s]?certified|certified\s+(?:in|as)\s+[A-Za-z][\w-]*(?:\s+[A-Za-z][\w-]*){0,3}|certification\s+in\s+[A-Za-z][\w-]*(?:\s+[A-Za-z][\w-]*){0,3})\b/i;

/*
 * ⚠ « over a decade », « fifteen years », « 15+ years ». Les nombres écrits en
 * toutes lettres comptent : un modèle à qui on interdit « 15 years » écrit
 * « fifteen years », et la garde qui ne lirait que les chiffres serait une
 * garde qu'on contourne en changeant de graphie.
 */
const WRITTEN_NUMBER =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|" +
  "thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|" +
  "thirty|forty|fifty";
const TENURE = new RegExp(
  `\\b(?:(?:\\d{1,2}\\+?|${WRITTEN_NUMBER})\\s+years?|` +
    `(?:over|more\\s+than|nearly|almost)\\s+(?:a\\s+)?(?:decade|\\d{1,2}\\s+years?)|` +
    `a\\s+decade)\\b[^.!?]{0,40}\\b(?:experience|practice|practicing|practising|` +
    `working|clinical|in\\s+the\\s+field|as\\s+a\\s+(?:therapist|counselor|clinician))\\b`,
  "i"
);

function violation(reason: string, excerpt: string): EthicsViolation {
  return { ruleId: "credential", reason, severity: "block", excerpt: excerpt.trim() };
}

/**
 * Les credentials que le texte revendique et que le brief ne porte pas.
 *
 * ⚠ `block`, PAS `warn`. Un `warn` est journalisé et persiste : ce serait un
 * titre d'exercice faux publié avec une note dans un log. Ce que ça coûte à la
 * praticienne n'est pas une relecture, c'est son board.
 *
 * ⚠ ET LA CASSE DES SIGLES COMPTE. « PhD » et « MA » ne sont cherchés qu'en
 * capitales exactes : sans ça, « ma » et « ms » de la prose ordinaire se
 * déclencheraient à chaque phrase. Les intitulés complets, eux, sont
 * insensibles à la casse — personne n'écrit « licensed professional counselor »
 * par accident.
 */
export function checkUnbackedClaims(
  text: string,
  allowed: AllowedClaims
): EthicsViolation[] {
  const found: EthicsViolation[] = [];
  if (!text) return found;

  const okLabels = new Set(allowed.licenseLabels.map((l) => l.toUpperCase()));
  /*
   * Les intitulés complets autorisés, comparés en minuscules. Le passage 2 s'en
   * sert pour laisser passer l'intitulé du brief même quand `FULL_NAMES`
   * l'apparie à un sigle voisin — « Licensed Professional Counselor » pour une
   * LPC est le titre saisi, pas une invention.
   */
  const okNames = allowed.licenseNames.map((n) => n.toLowerCase());

  /* 1. Les sigles. */
  for (const acronym of KNOWN_CREDENTIALS) {
    if (NEVER_A_CLAIM.has(acronym)) continue;
    if (okLabels.has(acronym.toUpperCase())) continue;

    const pattern = new RegExp(`\\b${acronym.replace("-", "\\-")}\\b`);
    const match = pattern.exec(text);
    if (match) {
      found.push(
        violation(
          `« ${match[0]} » n'est pas dans le brief. Un credential ne s'écrit que s'il a été saisi.`,
          match[0]
        )
      );
      // Un sigle suffit à nommer le problème ; l'inventaire n'aide pas le modèle.
      break;
    }
  }

  /* 2. Les intitulés complets — le cas exact du 15 septembre. */
  for (const { name, label } of FULL_NAMES) {
    if (okLabels.has(label)) continue;
    const match = name.exec(text);
    if (match) {
      // L'intitulé exact que le brief porte n'est jamais une invention, même
      // si `FULL_NAMES` le range sous un autre sigle.
      if (okNames.includes(match[0].toLowerCase())) continue;
      found.push(
        violation(
          `« ${match[0]} » n'est pas le titre saisi dans le brief. Un titre d'exercice faux est un problème devant le board.`,
          match[0]
        )
      );
      break;
    }
  }

  /* 3. Les certifications — le brief n'en porte aucune, donc aucune n'est due. */
  const cert = CERTIFICATION.exec(text);
  if (cert) {
    found.push(
      violation(
        "Revendique une certification que le brief ne porte pas. Le brief n'a aucun champ de certification : elle est donc inventée.",
        cert[0]
      )
    );
  }

  /* 4. L'ancienneté — toujours inventée, faute de champ pour la porter. */
  const tenure = TENURE.exec(text);
  if (tenure) {
    found.push(
      violation(
        "Annonce une ancienneté. Le brief ne porte AUCUN champ d'années d'expérience : toute valeur ici est inventée.",
        tenure[0]
      )
    );
  }

  return found;
}

/**
 * Ce que CE brief autorise.
 *
 * ⚠ UNE SEULE SOURCE, ET C'EST LE BRIEF. Ni le catalogue entier (qui dit ce
 * qu'elle aurait pu choisir), ni la prose déjà écrite (qui dirait ce qu'on a
 * déjà laissé passer). `licenseLabels` est vide quand elle n'a pas choisi de
 * licence — et une liste vide refuse alors TOUS les sigles, ce qui est la
 * bonne réponse : un brief sans titre n'autorise aucun titre.
 */
export function allowedClaimsFrom(
  licenseTypeId: string | null | undefined,
  licenseTypes: readonly { id: string; label: string; description: string }[]
): AllowedClaims {
  const entry = licenseTypeId
    ? licenseTypes.find((row) => row.id === licenseTypeId)
    : undefined;

  if (!entry) return { licenseLabels: [], licenseNames: [] };
  return { licenseLabels: [entry.label], licenseNames: [entry.description] };
}
