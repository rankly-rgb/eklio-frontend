import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  bankShortfall, bankTarget, CANDIDATES_PER_ATTEMPT, DEDUP_REFUSAL, drawnPerAttempt, fillTrigger,
  POSTS_PER_MONTH, retainedPerAttempt, WINDOW_ROUNDS,
} from "@/lib/content/bank";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";
import { PRACTITIONER_CARDS_PER_MONTH } from "@/lib/content/practitioner";

/*
 * ── ⚠ F13 DIMENSIONNE DIX MOIS QUI SE SUIVENT. LE CRON N'EN FERA PAS UN ─
 *
 * Le dimensionnement écrit jusqu'ici suppose une praticienne qui tire son
 * mois, puis la suivante le mois d'après. Le produit fera l'inverse : un
 * `cron` mensuel génère UN SEGMENT ENTIER LE MÊME JOUR, et la fenêtre
 * anti-collision de 90 jours interdit à chacune ce que ses consœurs viennent
 * de prendre — le même matin, pas trois mois plus tard.
 */

describe("ce que le tirage demande, archétype par archétype", () => {
  const drawn = drawnPerAttempt();

  /*
   * ⚠ LA TABLE ÉCRITE À LA MAIN AVAIT VIEILLI SANS LE DIRE. Elle datait de
   * `CANDIDATES = 54` et annonçait 9 `practitioner_card` par mois pour un
   * plafond de 2, et 5 `carousel` pour un format tiré deux fois par tour.
   * Trois chiffres faux sur onze, invisibles tant que personne ne refaisait le
   * calcul — donc le calcul est fait ici, sur la boucle elle-même.
   */
  it("la somme est exactement ce qu'un essai tire", () => {
    const total = Object.values(drawn).reduce((a, b) => a + b, 0);
    expect(total).toBe(CANDIDATES_PER_ATTEMPT);
  });

  it("la carte praticienne s'arrête à son plafond, pas à son tour", () => {
    expect(drawn.practitioner_card).toBe(PRACTITIONER_CARDS_PER_MONTH);
  });

  /*
   * ⚠ LA PHRASE SEULE RAMASSE CE QUE LA CARTE PRATICIENNE NE PREND PAS. Sa
   * famille n'a que deux formats : une fois le plafond atteint, elle tire
   * seule jusqu'au bout du quota de famille.
   */
  it("la phrase seule porte le reste de sa famille", () => {
    const perFamily = Math.ceil(CANDIDATES_PER_ATTEMPT / 3);
    expect(drawn.single_statement).toBe(perFamily - PRACTITIONER_CARDS_PER_MONTH);
  });

  /* ⚠ Et le carrousel pèse double au tirage, parce qu'il se perd double. */
  it("le carrousel est tiré deux fois par tour", () => {
    expect(drawn.carousel).toBeGreaterThan(drawn.quadrant_model);
    expect(drawn.carousel).toBeGreaterThanOrEqual(2 * drawn.annotated_curve - 1);
  });

  it("aucun archétype n'est oublié", () => {
    for (const key of Object.values(FORMAT_FAMILIES).flat()) {
      expect(Object.keys(drawn), key).toContain(key);
    }
  });
});

describe("ce qu'un essai garde pendant quatre-vingt-dix jours", () => {
  /*
   * ⚠ UN ESSAI TIRE 72 SUJETS ET N'EN GARDE QUE 30, MAIS LES 30 SONT PERDUS
   * POUR TOUT LE SEGMENT. Les sur-générés reviennent, livré ou refusé (F19) ;
   * les trente publiés restent assignés — et un mois REFUSÉ les garde aussi,
   * puisqu'il reste en `proposed` et qu'on le relit pour savoir ce qui cloche.
   */
  it("trente posts, quel que soit le verdict", () => {
    const retained = retainedPerAttempt();
    const total = Object.values(retained).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(POSTS_PER_MONTH, 6);
  });
});

describe("le stock d'un segment généré d'un seul coup", () => {
  /*
   * ⚠ DEUX TERMES, ET LE SECOND EST CELUI QU'ON OUBLIE. Le bloqué (trois tours
   * de fenêtre) et le pic (ce que le tirage simultané exige en plus). Sans le
   * second, la banque a « assez de sujets » et le tirage n'en trouve pas :
   * c'est le quatrième essai du 2026-09-23, 88 libres et 18 candidats tirés.
   */
  it("le bloqué et le pic s'additionnent", () => {
    const N = 5;
    const A = 4;
    const target = bankTarget({ practitioners: N, attempts: A });
    const drawn = drawnPerAttempt();
    const retained = retainedPerAttempt();
    for (const key of Object.keys(drawn)) {
      const peak = (N * drawn[key]) / (1 - DEDUP_REFUSAL);
      const expected = Math.ceil(WINDOW_ROUNDS * N * A * retained[key] + peak);
      expect(target[key], key).toBe(expected);
    }
  });

  /*
   * ⚠ ET LE NOMBRE DE TOURS SIMULTANÉS N'EST PAS TOUJOURS TROIS. Dix mois
   * générés dans la même journée — ce que fait la mesure — en bloquent dix :
   * la fenêtre ne s'ouvre pas entre deux essais lancés à dix minutes
   * d'intervalle. Le même modèle sert les deux cas, et seul ce nombre change.
   */
  it("dix mois le même jour ne coûtent pas comme dix mois consécutifs", () => {
    const sameDay = bankTarget({ practitioners: 1, attempts: 4, rounds: 10 });
    const overTime = bankTarget({ practitioners: 1, attempts: 4, rounds: WINDOW_ROUNDS });
    const sum = (t: Record<string, number>) => Object.values(t).reduce((a, b) => a + b, 0);
    expect(sum(sameDay)).toBeGreaterThan(sum(overTime));
  });

  it("le stock croît avec le segment, pas avec le mois", () => {
    const sum = (n: number) =>
      Object.values(bankTarget({ practitioners: n, attempts: 4 })).reduce((a, b) => a + b, 0);
    expect(sum(10)).toBeCloseTo(2 * sum(5), -1);
  });
});

describe("le seuil qui déclenche un remplissage", () => {
  /*
   * ⚠ UN TOUR DE SEGMENT, PAS UNE MARGE DE CONFORT. Sous ce chiffre, le tirage
   * ne peut pas se composer : ce n'est pas « la banque est basse », c'est « le
   * mois va sortir court ».
   */
  it("il vaut ce qu'un tour simultané tire, refus du dédoublonnage compris", () => {
    const trigger = fillTrigger({ practitioners: 3, attempts: 4 });
    const drawn = drawnPerAttempt();
    for (const key of Object.keys(drawn)) {
      expect(trigger[key], key).toBe(Math.ceil((3 * drawn[key]) / (1 - DEDUP_REFUSAL)));
    }
  });

  /*
   * \u26a0 CINQ SUJETS LIBRES POUR UN TIRAGE DE CINQ N'EN FONT ACCEPTER AUCUN.
   * C'est littéralement le quatrième essai du 2026-09-23 : `cycle` et
   * `numbered_strategies` étaient à cinq, le seuil naïf disait « ça passe », et
   * l'essai n'a tiré que 18 candidats sur 54.
   */
  it("il laisse la place aux sujets que le dédoublonnage refusera", () => {
    const drawn = drawnPerAttempt();
    const trigger = fillTrigger({ practitioners: 1, attempts: 4 });
    expect(trigger.cycle).toBeGreaterThan(drawn.cycle);
  });

  /*
   * ⚠ ET IL SE MESURE PAR ARCHÉTYPE, PARCE QUE LE TOTAL A MENTI. Au quatrième
   * essai du 2026-09-23 la banque portait 88 sujets libres — assez, en
   * apparence — et `cycle` en avait cinq.
   */
  it("un total confortable ne sauve pas un archétype à sec", () => {
    const drawable = Object.fromEntries(
      Object.entries(drawnPerAttempt()).map(([k, n]) => [k, n * 40])
    );
    expect(bankShortfall(drawable, { practitioners: 1, attempts: 4 })).toEqual([]);

    drawable.cycle = 5;
    const short = bankShortfall(drawable, { practitioners: 1, attempts: 4 });
    expect(short.map((s) => s.archetype)).toEqual(["cycle"]);
    expect(short[0].drawable).toBe(5);
    expect(short[0].needed).toBeGreaterThan(5);
  });

  it("un archétype absent du compte est un archétype à zéro", () => {
    const short = bankShortfall({}, { practitioners: 1, attempts: 4 });
    expect(short.length).toBeGreaterThan(0);
    for (const s of short) expect(s.drawable).toBe(0);
  });

  /* Le plus bas d'abord : c'est celui qui décide si le mois sort. */
  it("le plus affamé est nommé en premier", () => {
    const drawable = Object.fromEntries(
      Object.entries(drawnPerAttempt()).map(([k, n]) => [k, n * 40])
    );
    drawable.cycle = 3;
    drawable.carousel = 1;
    expect(bankShortfall(drawable, { practitioners: 1, attempts: 4 })[0].archetype).toBe("carousel");
  });
});

/*
 * ── ⚠ LE REMPLISSAGE PART AVANT LA GÉNÉRATION, PAS APRÈS L'ÉCHEC ────────
 *
 * La banque était remplie après l'échec — c'est-à-dire après avoir payé
 * l'écriture d'un mois qui ne pouvait pas sortir.
 */
describe("le harnais compte la banque avant de tirer", () => {
  const SOURCE = readFileSync("scripts/local-render/20-month.ts", "utf8");

  it("le garde-fou passe avant le tirage", () => {
    const guard = SOURCE.indexOf("await guardTheBank(db, kitId);");
    const draw = SOURCE.indexOf("const perFamily = Math.ceil(CANDIDATES");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(draw);
  });

  /*
   * ⚠ AVEC LA REQUÊTE QUI TIRE, pas avec un décompte qui lui ressemble.
   *
   * La décision vit désormais dans `lib/content/bank-guard.ts` — ce test
   * cherchait `bankShortfall(drawable,` en toutes lettres dans le harnais et est
   * tombé à l'extraction, sans qu'une garantie ait bougé. Ce qui reste à
   * vérifier ICI est la DÉLÉGATION ; la décision elle-même est éprouvée par le
   * comportement dans `the-bank-guard-decides-once.test.ts`, ce qui est mieux
   * qu'un grep.
   */
  it("il compte ce que le tirage verra, via le module partagé", () => {
    /*
     * ⚠ DEUXIÈME DÉMÉNAGEMENT, ET LA MÊME LEÇON. L'appel RPC lui-même est sorti du
     * harnais le 2026-09-26 dans `lib/content/month/draw-port.ts` : la décision
     * était déjà partagée, l'APPEL l'est maintenant aussi, et le chemin produit
     * n'a donc plus à le réécrire avec sa propre idée des arguments.
     *
     * Ce qui reste à vérifier ici est la double délégation : le harnais passe par
     * la couture, et il ne réimplémente ni la décision ni l'appel.
     */
    const seam = readFileSync("lib/content/month/draw-port.ts", "utf8");
    expect(seam).toContain('"drawable_count_for_kit"');
    expect(SOURCE).toContain("serverBankGuardPort(");
    expect(SOURCE, "le harnais réimplémente la décision au lieu de la déléguer")
      .not.toContain("bankShortfall(");
    expect(SOURCE, "le harnais nomme encore le RPC : il y a deux coutures")
      .not.toContain('"drawable_count_for_kit"');
  });

  /*
   * ⚠ ET IL NE REND PAS LA MAIN TANT QUE LE REMPLISSAGE N'A PAS FINI. Tirer
   * pendant que le lot de sujets tourne, c'est tirer dans la banque d'avant.
   */
  it("le remplissage est attendu, et son échec arrête tout", () => {
    expect(SOURCE).toContain("const filled = spawnSync(command, args,");
    expect(SOURCE).toContain("throw new Error(`le remplissage a échoué");
  });

  /*
   * ⚠ LA COMMANDE CONSTRUITE DOIT ÊTRE UNE COMMANDE QUI MARCHE. Au premier
   * déclenchement réel, le garde-fou a bien vu le manque, bien lancé le
   * remplissage — et le remplissage a répondu « Refusing without --confirm »,
   * puis le mois est tombé. Une commande écrite dans une chaîne que personne
   * n'a lancée est une commande qui ne marche pas.
   */
  it("la commande de remplissage emporte `--confirm`", () => {
    const at = SOURCE.indexOf("const fill = [");
    expect(SOURCE.slice(at, at + 260)).toContain("--sync --confirm");
  });

  /*
   * ⚠ ET LA BANQUE ÉCRIT SUR HAIKU. Elle n'écrit pas de posts mais des
   * graines, et le dimensionnement pour un segment simultané en demande des
   * milliers. Ce n'est pas « mesuré, aucun gain » : c'est « pas mesuré ».
   */
  it("le remplissage n'écrit pas sur le modèle de rédaction", () => {
    const bank = readFileSync("scripts/local-render/10-topic-bank.ts", "utf8");
    expect(bank).toContain("const BANK_MODEL = MASS_COPY_MODEL_FALLBACK;");
    expect(bank).not.toContain("massCopyModel()");
  });

  it("`--no-fill` refuse en nommant ce qui manque et la commande", () => {
    expect(SOURCE).toContain('process.argv.includes("--no-fill")');
    expect(SOURCE).toContain("Remplir d'abord : ${fill}");
  });

  /* ⚠ Et le tirage du harnais lit la même constante que le dimensionnement. */
  it("le nombre de candidats vient du modèle de banque", () => {
    expect(SOURCE).toContain("const CANDIDATES = CANDIDATES_PER_ATTEMPT;");
  });
});
