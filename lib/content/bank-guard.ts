import { bankShortfall, type BankDemand } from "@/lib/content/bank";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE GARDE-FOU DE BANQUE — UNE SEULE IMPLÉMENTATION, DEUX APPELANTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Il ne vivait que dans `scripts/local-render/20-month.ts`. Le recensement du
 * 2026-09-26 a montré que le chemin produit n'en portait aucune trace — et
 * qu'il ne portait non plus aucun des dix-neuf autres mécanismes du harnais.
 *
 * ⚠ CE MODULE NE PEUT PAS À LUI SEUL COMBLER CE TROU, et il faut le dire ici
 * plutôt que de laisser croire le contraire. Le chemin produit
 * (`generateMonth`, `lib/content/generate/pipeline.ts`) NE TIRE PAS de la
 * banque de sujets : il passe par `planMonth`, écrit une ligne et une légende
 * par post, et dessine des fonds photographiques. Il n'appelle jamais
 * `next_topic_for_kit`. Un garde-fou de banque y serait un garde-fou sur une
 * banque que ce chemin ne consulte pas.
 *
 * Ce que ce module fait donc : porter la DÉCISION en un seul endroit, pur et
 * éprouvable hors ligne, prêt pour le jour où un chemin produit tirera de la
 * banque. Ce qu'il ne fait pas : prétendre que le trou est comblé.
 *
 * ── CE QUI RESTE À L'APPELANT, ET POURQUOI ──────────────────────────────
 *
 * Le remplissage. Le harnais lance `10-topic-bank.ts` en sous-processus ; une
 * route serveur ne peut pas et ne doit pas. La décision — « ce tour peut-il se
 * composer ? » — est la même des deux côtés ; la réponse au manque ne l'est
 * pas. Mélanger les deux aurait obligé ce module à connaître `spawnSync`.
 */

/** Ce que l'appelant fournit. Aucun accès réseau n'est construit ici. */
export type BankGuardPort = {
  /**
   * Rend les assignations que rien ne retient plus, et dit combien.
   *
   * ⚠ AVANT DE COMPTER, PAS APRÈS. Mesuré le 2026-09-26 : 994 sujets assignés à
   * des exécutions tuées, retirés à tout le segment pendant quatre-vingt-dix
   * jours. Compter d'abord aurait vu une banque courte et déclenché un
   * remplissage payant pour racheter ce qu'on possédait déjà.
   */
  releaseStale(): Promise<number>;
  /** Le tirable par archétype, lu par la requête QUI TIRE. */
  drawableCounts(kitId: string): Promise<Record<string, number>>;
};

export type BankShort = { archetype: string; drawable: number; needed: number };

export type BankVerdict = {
  /** Faux quand le tour ne peut pas se composer. */
  ok: boolean;
  /** Combien d'assignations orphelines ont été rendues au passage. */
  released: number;
  /** Ce qui manque, archétype par archétype. Vide quand `ok`. */
  short: BankShort[];
  /** L'archétype au plus bas, pour le dire même quand le tour passe. */
  thinnest: { archetype: string; drawable: number } | null;
  /** Une phrase prête à mettre dans un log ou une réponse HTTP. */
  said: string;
};

/**
 * Le tour peut-il se composer ?
 *
 * ⚠ `attempts: 1, rounds: 1` — ON GARDE LE SEUIL D'UN TOUR, PAS LA CIBLE. La
 * cible de banque dimensionne un segment sur trois mois ; ce qu'on demande ici
 * est « ce tirage-ci peut-il se faire maintenant ». Exiger la cible refuserait
 * des mois qu'on sait composer.
 */
export async function guardBank(
  port: BankGuardPort,
  kitId: string,
  demand: BankDemand
): Promise<BankVerdict> {
  const released = await port.releaseStale();
  const drawable = await port.drawableCounts(kitId);
  const short = bankShortfall(drawable, { ...demand, attempts: 1, rounds: 1 });

  const entries = Object.entries(drawable).sort((a, b) => a[1] - b[1]);
  const thinnest = entries.length > 0 ? { archetype: entries[0][0], drawable: entries[0][1] } : null;

  if (short.length === 0) {
    return {
      ok: true,
      released,
      short: [],
      thinnest,
      said: thinnest
        ? `${thinnest.archetype} au plus bas avec ${thinnest.drawable} tirables — le tour passe`
        : "aucun archétype tirable connu",
    };
  }

  return {
    ok: false,
    released,
    short,
    thinnest,
    /*
     * ⚠ LA PHRASE NOMME L'ARCHÉTYPE ET LES DEUX NOMBRES. « La banque est
     * courte » envoie chercher dans onze archétypes ; « cycle 5/12 » se règle
     * en une commande. C'est la même règle que `licenceMissingMessage`.
     */
    said: short.map((s) => `${s.archetype} ${s.drawable}/${s.needed}`).join(", "),
  };
}
