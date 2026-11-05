# Mode d'emploi : une praticienne, sa banque, son mois (production)

Ces scripts écrivent en production avec **vos** identifiants. Par défaut, chacun se contente
de **simuler** : il affiche ce qu'il ferait et n'écrit rien. Il n'écrit qu'avec `--write`.
Le constat, lui, n'écrit jamais.

## 0. Une fois : préparer la machine

Dans `eklio-frontend`, sur la branche à jour :

```bash
npm ci
```

Il faut aussi `bun` (https://bun.sh) et, pour la planche, `python3` avec Pillow
(`pip install pillow`).

## 1. Les variables d'environnement

Elles se mettent dans le terminal, juste pour la séance. Ne les écrivez dans aucun fichier
du dépôt.

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Tableau de bord Supabase → projet de production → **Project Settings → Data API** → *Project URL* (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Même projet → **Project Settings → API Keys** → clé `service_role` (onglet *Legacy API keys* si le tableau de bord en a deux) |
| `OPENAI_API_KEY` | Tableau de bord OpenAI → *API keys*. N'est demandée que par `--write` (remplissage et mois) |

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
```

```bash
export SUPABASE_SERVICE_ROLE_KEY="<clé service_role>"
```

```bash
export OPENAI_API_KEY="<clé OpenAI>"
```

Un script refuse de partir s'il manque une variable, et il dit laquelle. Il refuse aussi
une URL locale (`127.0.0.1`, `localhost`), sauf avec `--allow-local`.

## 2. Les commandes, dans l'ordre

**1. Le constat.** Il lit la production et n'écrit rien. Pour chaque kit, il affiche le
cabinet, l'État, un verdict « réelle / test / indéterminée » avec ses signaux, le banc
tirable, la marge de posts à phrase et les mois déjà produits.

```bash
bun scripts/production-path/eklio-ops/constat.ts
```

Le critère « test » :
- un e-mail d'exemple ou de test ;
- ou un numéro de licence de fixture (chiffres répétés, `1234…`) ou absent.

Une fiche est « réelle » si elle n'a aucun de ces deux signaux **et** un abonnement actif.
Si le verdict se trompe, dites-le : le critère est dans `constat.ts`.

**2. Le remplissage de la banque, en simulation, sur une fiche.** Prenez le `kit` affiché
par le constat.

```bash
bun scripts/production-path/eklio-ops/bank-fill.ts --kit <kit>
```

Le script affiche :
- ce qui serait écrit dans `content_topics`, segment par segment et archétype par archétype
  (en banque, cible, à écrire) ;
- les planchers avant, et projetés après remplissage : au moins 55 tirables, marge de posts
  à phrase au moins +2 ;
- la couverture thématique, c'est-à-dire la part des sujets tirables qui trouvent un dessin.

Si un plancher mord même après le remplissage projeté, il s'arrête sur cette fiche et dit
lequel.

**3. Le remplissage pour de vrai,** si la simulation est propre :

```bash
bun scripts/production-path/eklio-ops/bank-fill.ts --kit <kit> --write
```

Il imprime le coût mesuré, les planchers et la couverture après. Plafond par défaut :
1,5 $, réglable avec `--cap`. Relancé, il n'a plus rien à écrire et ne coûte rien.

**4. Le mois, en simulation, puis pour de vrai.** `--month` vaut par défaut le mois
suivant.

```bash
bun scripts/production-path/eklio-ops/month.ts --kit <kit> --month 2026-12-01
```

```bash
bun scripts/production-path/eklio-ops/month.ts --kit <kit> --month 2026-12-01 --write
```

Le contrôle préalable refuse de partir dans six cas : un identifiant manque, les migrations
manquent, la fiche est introuvable, le mois est déjà livré, la licence est absente, ou le
banc est sous ses planchers. Il refuse aussi si le kit n'est pas « dû » pour ce mois.

Avec `--write`, le script affiche :
- le coût mesuré ;
- le **tableau d'acceptation** : 30 écrites, 30 stockées, 0 vide, licence 30/30, contrôles
  verts, 0 sous le plancher de remplissage, 3 formats par fenêtre de neuf, série ≤ 3,
  coût < 1 $ ;
- l'entonnoir ;
- le chemin de la **planche à 390 px**, avec un dossier `planche-<kit>-<mois>/` qui contient
  `planche-390.jpg`, `mesures.json` et `cartes/`.

**5. Le constat de nouveau,** pour comparer :

```bash
bun scripts/production-path/eklio-ops/constat.ts
```

Pour refaire la planche d'un mois déjà en production, sans rien écrire :

```bash
bun scripts/production-path/eklio-ops/measure.ts --kit <kit> --month 2026-12-01
```

## 3. Si une commande s'arrête à mi-chemin

- **Remplissage interrompu.** Les sujets déjà écrits sont valides et restent. Il n'y a rien
  à défaire : relancez la même commande, elle complète jusqu'aux cibles.
- **Mois refusé** (le script l'affiche avec sa cause). Le run passe `abandoned`, le mois
  `failed`, les sujets sont relâchés, et aucune publication n'est visible. Ce qui a été
  dépensé reste compté dans le **plafond du mois (3 $)**. Relancer le même mois est permis
  tant que ce plafond n'est pas atteint, soit environ trois tentatives. Envoyez-moi le
  rapport avant de relancer.
- **Mois interrompu** (coupure, Ctrl-C). Le mois reste `generating` et les réponses déjà
  payées sont au journal. Relancez la même commande : l'orchestrateur **reprend** par le
  journal sans repayer. Les sujets tirés restent réservés quelques heures, puis le cron
  `release-topics` les relâche. Ne lancez jamais deux fois en même temps sur le même kit.
- **Planche non produite** (Pillow absent). Les mesures et les cartes sont dans le dossier.
  Installez Pillow et relancez `measure.ts`.

## 4. Ce qu'il faut me renvoyer

La sortie complète de chaque commande, telle quelle. Chacune se suffit à elle-même.
