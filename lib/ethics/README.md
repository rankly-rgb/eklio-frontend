# `lib/ethics` — couche de conformité déontologique

Socle commun **ACA / APA / boards d'État**, lu de la façon la plus restrictive,
pour ne pas maintenir 50 jeux de règles. Tout contenu généré par Eklio qu'un
praticien pourrait publier passe par ici : descriptions de directions (câblé au
Lot 2, cf. `lib/ai/directions.ts`), kit de marque (câblé au Lot 3, cf.
`lib/ai/kit.ts`), Monthly Presence.

Une seule exception, documentée et testée : les **contre-exemples du guide de
voix** du kit (`voice_and_tone.dont_examples`). Ils nomment la faute à éviter,
sont affichés sous « never write this », et ne sont jamais de la copy à
publier — les vérifier ferait échouer la génération sur sa propre pédagogie.
Tout le reste du kit, y compris chaque titre et chaque corps de chaque page,
passe par `checkEthics`.

Couche autonome : elle n'importe rien de `lib/ai`. C'est `lib/ai` qui l'importe.

## Trois garde-fous, les trois requis

| Niveau | Où | Quoi |
| --- | --- | --- |
| 1 — pilotage | `ETHICS_SYSTEM_RULES` (`rules.ts`) + `rulesBlock()` (`guard.ts`) | règles injectées dans le prompt de génération |
| 2 — vérification | `checkEthics` (`rules.ts`), `enforceEthics` (`guard.ts`) | contrôle côté code + réécriture ciblée |
| 3 — transparence | `EthicsDisclaimer` (`components/ethics-disclaimer.tsx`) | le praticien relit, adapte et reste responsable |

Le niveau 1 seul ne suffit pas : un modèle peut ignorer une consigne. Le niveau
2 est ce qui empêche du non-conforme d'être persisté.

### Ce que `guard.ts` AJOUTE au niveau 2

Il l'étend, il ne le double pas. Trois ajouts, et rien d'autre :

1. **Les règles viennent de la base.** La table `ethics_rules` porte le texte
   des six règles ; chaque pattern de `rules.ts` porte le `ruleId` de celle
   qu'il fait respecter. L'infobulle du badge BOARD-SAFE COPY et le chemin
   d'application lisent la même source et ne peuvent pas diverger.

2. **Réécriture CIBLÉE** au lieu de régénération complète.
   `generateWithEthicsGuard` rejoue toute la génération quand une phrase
   dérape — une à deux minutes perdues pour un mot. `enforceEthics` ne réécrit
   que le champ fautif, en citant l'extrait et le texte de la règle.

3. **Le verdict est persisté** dans `brand_kits.ethics_check`, sous la forme
   qu'impose `brand_kit_ethics_check_valid` :
   `{ passed, flagged: [{ field, excerpt, rule_id }], checked_at }`.

`generateWithEthicsGuard` reste en place : c'est le bon outil quand la reprise
doit porter sur le RÉSULTAT ENTIER plutôt que sur une ligne.

## Comment l'utiliser

`lib/generation/pipeline.ts` est le câblage de référence : `ETHICS_SYSTEM_RULES` y est
injecté dans le prompt **système** (`DIRECTIONS_SYSTEM_PROMPT`) et le `feedback`
de reprise est concaténé au message utilisateur — les règles de niveau 1 restent
ainsi hors de portée des consignes de style. Le squelette ci-dessous concatène
tout dans un seul prompt ; les deux formes conviennent.

```ts
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { generateWithEthicsGuard } from "@/lib/ethics/enforce";

const result = await generateWithEthicsGuard(
  async (feedback) => {
    // 1. Injecter les règles dans le prompt.
    // 2. Concaténer `feedback` quand il n'est pas null (c'est une reprise).
    const prompt = [buildPrompt(brief), ETHICS_SYSTEM_RULES, feedback ?? ""]
      .filter(Boolean)
      .join("\n\n");
    const raw = await callTheModel(prompt);
    return resultSchema.parse(raw); // validation structurelle avant la déontologie
  },
  {
    // Uniquement ce que le praticien pourrait publier — pas les ids ni les hex.
    publishableText: (r) => r.directions.map((d) => d.description),
    label: "directions",
  }
);
```

Points à respecter côté appelant :

- **valider la structure dans `callModel`** (zod) avant que le garde ne
  vérifie la déontologie : on ne vérifie pas un résultat malformé ;
- **ne lister dans `publishableText` que de la copy** destinée à être publiée ;
- **laisser remonter `EthicsComplianceError`** et échouer proprement côté UI —
  ne jamais persister un résultat partiellement conforme, et ne jamais renvoyer
  `error.violations` au client (les extraits fautifs restent côté serveur) ;
- **appeler cette couche depuis le serveur uniquement** (Server Action / route).

## Faire évoluer les règles

`lib/ethics/__tests__/rules.test.ts` est le contrat de la couche. Si une chaîne
légitime est bloquée, **ne pas affaiblir le pattern** : ajouter un cas explicite
dans `FALSE_POSITIVES` et resserrer le pattern autour de ce cas. Chaque pattern
porte en commentaire sa base déontologique (ACA C.3.a, APA 5.05…) — c'est ce qui
permet de distinguer une obligation d'une préférence de style.

## Traçage

Les violations sont journalisées côté serveur (`console.warn` / `console.error`,
préfixe `[ethics]`) dans `enforce.ts`. Aucune table Supabase dans ce lot : un
`TODO(post-MVP)` marque l'endroit exact où brancher une table
`ethics_violations` le jour où l'on voudra des statistiques.
