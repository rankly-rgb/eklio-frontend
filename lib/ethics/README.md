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
| 1 — pilotage | `ETHICS_SYSTEM_RULES` (`rules.ts`) | règles injectées dans le prompt de génération |
| 2 — vérification | `checkEthics` / `generateWithEthicsGuard` | contrôle côté code + régénération automatique |
| 3 — transparence | `EthicsDisclaimer` (`components/ethics-disclaimer.tsx`) | le praticien relit, adapte et reste responsable |

Le niveau 1 seul ne suffit pas : un modèle peut ignorer une consigne. Le niveau
2 est ce qui empêche du non-conforme d'être persisté.

## Comment l'utiliser

`lib/ai/directions.ts` est le câblage de référence : `ETHICS_SYSTEM_RULES` y est
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
