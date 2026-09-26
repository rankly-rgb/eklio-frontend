import { redundantAgainst } from "@/lib/content/dedup";
import { clampCardLine } from "@/lib/content/generate/copy-batch";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE TIRAGE D'UN MOIS — ÉTAGE C3 DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Choisir trente-six sujets dans la banque pour en écrire trente. C'était inline
 * dans `scripts/local-render/20-month.ts`, et l'exemption du recensement disait
 * « le chemin produit ne tire pas de sujets : il passe par `planMonth` ».
 *
 * ⚠ CETTE RAISON EST PÉRIMÉE DEPUIS F45, et c'est en la relisant qu'on le voit :
 * F45 a tranché que le générateur du harnais DEVIENT le chemin produit. Le
 * chemin produit tirera donc des sujets — l'exemption décrivait un état que la
 * décision avait déjà supprimé. Une exemption qui garde sa raison après que la
 * raison a changé est exactement ce que F48 cherche.
 *
 * ── ⚠ POURQUOI CELUI-CI EST DÉLÉGUÉ ET PAS L'ASSEMBLAGE ─────────────────
 *
 * L'assemblage garde deux implémentations pour une session, parce qu'un refactor
 * qu'on ne peut pas rejouer sur le seul pipeline mesuré est un risque qu'on ne
 * prend pas (F42, et §10 du plan de portage). Le tirage est un cas DIFFÉRENT, et
 * la différence est mesurable :
 *
 *   l'assemblage    réserve du crédit et écrit dans `content_items` — une erreur
 *                   débite la praticienne et publie
 *   le tirage       marque des sujets assignés, et
 *                   `release_stale_topic_assignments()` les rend au bout de trois
 *                   heures de grâce — une erreur se répare d'elle-même
 *
 * Le harnais appelle donc ce module : une seule implémentation, et le rayon
 * d'action d'une erreur de portage est borné par un mécanisme qui existe déjà.
 *
 * ── CE MODULE NE PARLE À RIEN ───────────────────────────────────────────
 *
 * Deux ports : assigner un sujet, et lire celui qu'on vient d'assigner. Aucun
 * appel de modèle, aucune dépense. Une doublure suffit à éprouver la ronde, les
 * plafonds et la pénurie.
 */

/** Ce qu'un sujet de banque porte, tel que le tirage le lit. */
export type DrawnTopic = {
  id: string;
  archetype_key: string;
  intent: string;
  title: string;
  hook?: string | null;
};

export type DrawPorts = {
  /**
   * `assign_topic_to_kit`. Sans archétype, il rend n'importe quel tirable.
   *
   * ⚠ IL ÉCRIT : il MARQUE le sujet assigné. Un sujet rendu ici est pris pour
   * tout le segment pendant quatre-vingt-dix jours (F13) jusqu'à ce que le balai
   * le rende. C'est pourquoi un refus doit dire lequel relâcher.
   */
  assign(archetype?: string): Promise<string | null>;
  /** Le sujet qu'on vient d'assigner, lu par son identifiant. */
  topic(id: string): Promise<DrawnTopic | null>;
};

export type DrawInput = {
  /** Les archétypes de chaque famille. */
  families: Record<string, string[]>;
  /** L'ordre dans lequel les familles passent. */
  drawOrder: string[];
  /** Combien de sujets par famille la ronde vise. */
  perFamily: number;
  /** Combien de candidats le mois demande en tout, rattrapage compris. */
  candidates: number;
  /** Le plafond de cartes praticiennes du mois. */
  practitionerCap: number;
  /**
   * Le brief porte-t-il de quoi composer une carte praticienne ?
   *
   * ⚠ FAUX ⇒ ELLE N'ENTRE PAS DANS LA RONDE. Tirer un sujet qu'on ne pourra pas
   * composer, c'est retirer un sujet au segment pour rien.
   */
  practitionerPayload: boolean;
};

export type DrawRefusal = { title: string; archetype: string; because: string };

export type DrawOutcome = {
  /** Les candidats retenus, dans l'ordre où ils ont été acceptés. */
  drawn: Array<{ topic: DrawnTopic; family: string }>;
  /** Ce qui a été refusé, et pourquoi — le rapport le publie. */
  rejected: DrawRefusal[];
  /**
   * Les sujets assignés puis refusés, à relâcher tout de suite.
   *
   * ⚠ NE PAS LES RELÂCHER LES BLOQUE TROIS HEURES POUR TOUT LE SEGMENT. Le
   * 2026-09-26 la banque locale portait 994 assignations orphelines, et deux
   * essais sur cinq étaient refusés avant la moindre dépense pour cette seule
   * raison.
   */
  releasedEarly: string[];
  /** Ce qui manque, famille par famille, dit et non deviné. */
  shortfall: string[];
};

const PRACTITIONER = "practitioner_card";

/**
 * Tire les candidats d'un mois : une ronde par famille, puis un rattrapage.
 *
 * ── ⚠ À TOUR DE RÔLE DANS LA FAMILLE, PAS « LE PREMIER JUSQU'À ÉPUISEMENT »
 *
 * La boucle interne était `while (taken < perFamily)` autour d'UN archétype : le
 * premier de la famille absorbait le quota entier, et les autres n'étaient
 * atteints que s'il manquait de stock. Le mélange d'un mois dépendait donc de la
 * PÉNURIE — et quand la banque a été remplie, il s'est effondré : le mois de
 * `perrin.vale` est sorti avec 5 archétypes sur 11, sans un seul `cycle`,
 * `numbered_strategies` ni `annotated_curve`, alors que la banque en portait 23,
 * 23 et 30. Six icebergs identiques et onze phrases seules.
 *
 * C'est l'inverse exact de ce qu'un lecteur doit voir, et c'est pourquoi le mois
 * PRÉCÉDENT, à court de stock, était plus varié que celui-là.
 */
export async function drawMonth(ports: DrawPorts, input: DrawInput): Promise<DrawOutcome> {
  const drawn: DrawOutcome["drawn"] = [];
  const rejected: DrawRefusal[] = [];
  const releasedEarly: string[] = [];
  const shortfall: string[] = [];

  /*
   * ⚠ LA SEULE PORTE PAR OÙ LES DEUX TIRAGES PASSENT, et c'est pour ça que les
   * plafonds sont ICI. Posé dans la ronde par famille, le plafond de cartes
   * praticiennes ne tenait que sur le PREMIER des deux tirages : le rattrapage
   * demande un sujet sans nommer d'archétype, et il en a repris huit. Un plafond
   * posé sur une seule des deux portes n'est pas un plafond.
   */
  const accept = (topic: DrawnTopic, family: string): boolean => {
    const refuse = (because: string) => {
      rejected.push({ title: topic.title, archetype: topic.archetype_key, because });
      releasedEarly.push(topic.id);
      return false;
    };

    /*
     * ⚠ MESURÉ LE 2026-09-23 : dès que la banque a porté des cartes
     * praticiennes libres, le tirage en a pris NEUF sur trente. Toutes
     * identiques — mêmes trois lignes venues du brief, même dessin de porte,
     * seul le titre changeait — et le mois a passé tous les contrôles, parce que
     * 9 sur 30 font exactement 30,0 %, le plafond au centième près.
     */
    if (
      topic.archetype_key === PRACTITIONER &&
      drawn.filter((c) => c.topic.archetype_key === PRACTITIONER).length >= input.practitionerCap
    ) {
      return refuse(
        `déjà ${input.practitionerCap} cartes praticiennes, et leurs lignes sont identiques`
      );
    }

    /*
     * ⚠ SUR LE TITRE COMPLET **ET** SUR CE QUI SERA IMPRIMÉ. Le dédoublonnage
     * lisait `topic.title`, la forme longue en banque. Mais la carte porte
     * `clampCardLine(title)` — trente caractères — et deux titres distincts en
     * banque peuvent s'y réduire au MÊME texte. Le mois de `marlow.quint` est
     * sorti avec deux cartes titrées « When the body disagrees », l'une en
     * quadrant, l'autre en courbe : aucune des deux règles lexicales n'avait de
     * raison de les rapprocher, puisqu'en banque elles ne se ressemblaient pas.
     */
    const line = clampCardLine(topic.title).toLowerCase();
    if (drawn.some((c) => clampCardLine(c.topic.title).toLowerCase() === line)) {
      return refuse(`même ligne de carte une fois coupée : « ${line} »`);
    }

    const clash = redundantAgainst(
      topic.title,
      drawn.map((c) => c.topic.title)
    );
    if (clash) return refuse(clash);

    drawn.push({ topic, family });
    return true;
  };

  /** Assigne puis lit ; rend `null` quand l'un des deux ne rend rien. */
  const pull = async (archetype?: string): Promise<DrawnTopic | null> => {
    const id = await ports.assign(archetype);
    if (!id) return null;
    return await ports.topic(id);
  };

  for (const family of input.drawOrder) {
    const archetypes = input.families[family] ?? [];
    let taken = 0;
    const live = archetypes.filter((a) => a !== PRACTITIONER || input.practitionerPayload);

    /*
     * ── ⚠ CETTE RONDE SE TERMINE EN VIDANT LA BANQUE, ET C'EST UN CONSTAT ─
     *
     * Quand un sujet est refusé par le dédoublonnage — ni pénurie, ni plafond
     * praticienne — rien ne sort de `live` et `taken` ne monte pas : le tour
     * recommence. `assign_topic_to_kit` rend un sujet DIFFÉRENT à chaque appel,
     * puisqu'il vient de marquer le précédent assigné, donc la boucle finit bien
     * — mais elle finit en ASSIGNANT PUIS REFUSANT tout le reste de la famille.
     *
     * C'est une source plausible des 994 assignations orphelines mesurées le
     * 2026-09-26 : chaque refus part dans `releasedEarly`, donc tout se répare
     * SI l'appelant relâche. Un run tué au milieu ne relâche rien, et le segment
     * entier reste bloqué trois heures.
     *
     * ⚠ ET LE GARDE-FOU N'EST PAS POSÉ ICI, DÉLIBÉRÉMENT. S'arrêter après un tour
     * infructueux changerait le nombre de candidats d'un mois, donc son mélange,
     * donc les chiffres mesurés — et cette extraction est une DÉLÉGATION : le
     * harnais l'appelle, et un portage qui modifie le comportement du seul
     * pipeline mesuré n'est pas un portage. Consigné en F51 ; un mois réel
     * tranchera.
     */
    while (taken < input.perFamily && live.length > 0) {
      for (let k = 0; k < live.length && taken < input.perFamily; ) {
        const topic = await pull(live[k]);
        if (!topic) {
          live.splice(k, 1);
          continue;
        }
        if (accept(topic, family)) taken += 1;
        else if (live[k] === PRACTITIONER) {
          live.splice(k, 1);
          continue;
        }
        k += 1;
      }
    }
    if (taken < input.perFamily) {
      shortfall.push(`${family}: ${taken} of ${input.perFamily} (the bank had no more)`);
    }
  }

  /*
   * ── ⚠ CE QUI MANQUE DANS UNE FAMILLE EST PRIS AILLEURS ────────────────
   *
   * Mesuré le 2026-09-21 : le second compte de test n'a pu tirer que 28
   * candidats sur 36, parce que l'anti-collision lui refuse tout ce que la
   * première praticienne a pris dans les quatre-vingt-dix jours — même État,
   * même modalité, utilisatrice différente. C'est la fenêtre qui fait son
   * travail.
   *
   * Un mélange visé n'est pas un mélange garanti : mieux vaut trente posts dont
   * le mélange penche que vingt-deux posts bien répartis. Le rapport publie le
   * mélange OBTENU, jamais celui qui était visé.
   */
  while (drawn.length < input.candidates) {
    const topic = await pull();
    if (!topic) break;
    const family =
      Object.entries(input.families).find(([, keys]) => keys.includes(topic.archetype_key))?.[0] ??
      "varied";
    /*
     * ⚠ UN REFUS N'ARRÊTE PAS LE RATTRAPAGE, MAIS IL NE DOIT PAS LE FAIRE
     * TOURNER SANS FIN NON PLUS. `assign_topic_to_kit` rend un sujet DIFFÉRENT à
     * chaque appel — il vient de marquer le précédent assigné — donc la banque
     * s'épuise et `pull` finira par rendre `null`. C'est la banque qui borne
     * cette boucle, pas un compteur.
     */
    accept(topic, family);
  }

  return { drawn, rejected, releasedEarly, shortfall };
}
