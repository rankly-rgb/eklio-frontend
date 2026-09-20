import { describe, expect, it } from "vitest";
import {
  ETHICS_PATTERN_IDS,
  FORBIDDEN_PATTERNS,
  type EthicsRuleId,
} from "@/lib/ethics/rules";

/*
 * ── LA PARITÉ, ET CE QU'ELLE ATTRAPE QUE LE CORPUS NE VOIT PAS ──────────
 *
 * La garde déontologique a deux implémentations depuis L13 :
 *
 *   ici        `FORBIDDEN_PATTERNS`, des expressions régulières JavaScript
 *   en base    `public.ethics_patterns`, les mêmes traduites en POSIX
 *
 * ⚠ CE FICHIER NE LES FUSIONNE PAS, et la fusion n'est pas ce qu'il prépare :
 * elle reste consignée dans OUT_OF_SCOPE.md §17 comme un lot à part entière.
 * Les motifs restent écrits deux fois, en deux dialectes.
 *
 * `shared-corpus.test.ts` tient déjà les deux côtés sur le COMPORTEMENT : les
 * mêmes phrases bloquées, les mêmes reformulations laissées passer. Il a une
 * limite, et c'est la raison d'être de ce fichier-ci — un corpus ne voit que
 * les phrases qu'il contient. Un motif AJOUTÉ d'un seul côté attrape du texte
 * que l'autre laisse passer, et le produit se comporte alors différemment
 * selon le chemin d'écriture emprunté : une génération passée par
 * l'application, ou un texte écrit directement par une RPC. Aucun test de
 * phrase ne le remarque tant que personne n'écrit la phrase.
 *
 * Ce qui est vérifié ici est donc le RECENSEMENT : même nombre, mêmes noms.
 *
 * Son jumeau SQL, qui écrit la MÊME liste en toutes lettres :
 *   eklio-backend/supabase/tests/20260914200000_ethics_parity.test.sql
 *
 * ⚠ LA LISTE CI-DESSOUS EST RECOPIÉE, ET C'EST VOULU. Elle ne peut pas être
 * importée : le fichier qu'elle doit contrôler est dans l'autre dépôt, et une
 * liste qui se lit elle-même ne contrôle rien. C'est la forme qu'a déjà prise
 * `entitling_statuses_single_source` au lot 1 — la valeur écrite en toutes
 * lettres des deux côtés, pour qu'un lecteur des deux dépôts puisse comparer
 * sans rien exécuter. Ce n'est PAS une quatrième liste d'autorité : personne
 * ne la lit à l'exécution, seul un test la compare.
 */

/**
 * ⚠ RECOPIÉ DE `public.ethics_patterns`, VÉRIFIÉ CONTRE LE PROJET VIVANT LE
 * 14 SEPTEMBRE 2026, PUIS LE 20 : `select id, rule_id from public.ethics_patterns`.
 *
 * VINGT lignes, `active` toutes les vingt. La vingtième, `third_party_says`,
 * est sortie du chemin réel — deux profils sur trois relevés portaient
 * « A colleague once described me as… ».
 */
const WHAT_THE_DATABASE_CARRIES: readonly (readonly [string, EthicsRuleId])[] = [
  ["resolution_verb", "proven"],
  ["free_you_from", "proven"],
  ["is_gone", "proven"],
  ["dated_promise", "timeframe"],
  ["guarantee", "proven"],
  ["clinically_proven", "proven"],
  ["success_rate", "proven"],
  ["lasting_relief", "proven"],
  ["therapy_that_works", "proven"],
  ["testimonial_word", "client_voice"],
  ["clients_say", "client_voice"],
  ["third_party_says", "client_voice"],
  ["client_reviews", "client_voice"],
  ["star_rating", "client_voice"],
  ["success_story", "client_voice"],
  ["best_therapist", "scarcity"],
  ["award_winning", "credential"],
  ["weekend_certification", "credential"],
  ["you_have_condition", "diagnosis"],
  ["scarcity_urgency", "scarcity"],
];

describe("⚠ les deux gardes recensent les mêmes motifs", () => {
  it("même NOMBRE de motifs des deux côtés", () => {
    expect(
      FORBIDDEN_PATTERNS.length,
      `Le scanner TypeScript porte ${FORBIDDEN_PATTERNS.length} motifs et ` +
        `ethics_patterns en porte ${WHAT_THE_DATABASE_CARRIES.length}. Celui ` +
        `qui en a un de plus attrape du texte que l'autre laisse passer : la ` +
        `même phrase serait alors bloquée ou non selon qu'elle est écrite par ` +
        `l'application ou par une RPC.`
    ).toBe(WHAT_THE_DATABASE_CARRIES.length);
  });

  it("mêmes IDENTIFIANTS, à l'unité près", () => {
    const here = [...FORBIDDEN_PATTERNS.map((p) => p.id)].sort();
    const there = [...WHAT_THE_DATABASE_CARRIES.map(([id]) => id)].sort();
    expect(here).toEqual(there);
  });

  it("chaque motif fait respecter la MÊME règle des deux côtés", () => {
    /*
     * Un identifiant partagé qui pointe vers deux règles différentes serait
     * pire qu'une divergence de nombre : les deux côtés sembleraient recenser
     * la même chose, et une violation serait rapportée sous deux motifs.
     */
    /*
     * ⚠ `Map<string, …>` À DESSEIN. La liste recopiée est typée `string` et
     * non `EthicsPatternId` : si elle portait l'union, un identifiant renommé
     * dans `rules.ts` ferait échouer la COMPILATION de ce test au lieu de le
     * faire échouer avec le message qui dit lequel a bougé. Une divergence
     * doit se lire, pas seulement empêcher de bâtir.
     */
    const here = new Map<string, EthicsRuleId>(
      FORBIDDEN_PATTERNS.map((p) => [p.id, p.ruleId])
    );
    for (const [id, ruleId] of WHAT_THE_DATABASE_CARRIES) {
      expect(here.get(id), `le motif « ${id} » ne fait pas respecter la même règle`).toBe(
        ruleId
      );
    }
  });

  it("aucun identifiant n'est employé deux fois", () => {
    const ids = FORBIDDEN_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("⚠ ETHICS_PATTERN_IDS ne dérive pas de la base non plus", () => {
    /*
     * L'union de types est le troisième endroit où ces noms sont écrits. Sans
     * ce contrôle, ajouter un nom à `ETHICS_PATTERN_IDS` sans ajouter le motif
     * — ou l'inverse — laisserait la porte ouverte à un identifiant qui
     * compile et ne garde rien.
     */
    expect([...ETHICS_PATTERN_IDS].sort()).toEqual(
      [...WHAT_THE_DATABASE_CARRIES.map(([id]) => id)].sort()
    );
    expect(
      [...ETHICS_PATTERN_IDS].sort(),
      "un identifiant est déclaré et aucun motif ne le porte"
    ).toEqual([...FORBIDDEN_PATTERNS.map((p) => p.id)].sort());
  });

  it("le recensement lui-même ne se vide pas", () => {
    // ⚠ Garde anti-vacuité : deux listes vides sont égales.
    expect(WHAT_THE_DATABASE_CARRIES.length).toBe(20);
    expect(FORBIDDEN_PATTERNS.length).toBeGreaterThan(0);
  });
});
