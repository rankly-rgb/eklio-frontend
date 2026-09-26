# Quelle branche devient `main` — l'analyse, et la preuve

## ⚠ DEUX CORRECTIONS À L'ENTRÉE « MISE EN PRODUCTION »

**1. `main` EXISTE.** L'entrée affirme « `main` n'existe pas : les seules
branches distantes sont `claude/gallant-lamport-mt20i0` et
`claude/great-brahmagupta-za7qmx` ». Le distant porte **vingt-sept branches**,
dont `main` à `60f7708`, dernier commit le **2026-09-17**. L'étape 6 n'est donc
pas « créer `main` » mais « **faire avancer `main`** », ce qui n'est pas le même
geste : un `push` sur une branche existante, pas une création.

**2. `vercel.json` porte SIX `crons`, pas quatre.** L'entrée liste
`anon-briefs`, `nudges`, `purge-deleted-kits`, `purge-events` et oublie
`trial-ending` (15:00) et `trial-guard` (17:00). Les deux oubliées touchent la
facturation des essais.

## La généalogie, mesurée

| branche | tête | dernier commit | migrations |
|---|---|---|---|
| `main` | `60f7708` | 2026-09-17 | 133 |
| **`claude/gallant-lamport-mt20i0`** | `26b55a9` | **2026-09-24** | **154** |
| `claude/great-brahmagupta-za7qmx` | `12b1807` | 2026-09-21 | 148 |
| `claude/eklio-reveal-rebuild-28o625` | `e7d5855` | 2026-09-02 | 50 |

Les inclusions, comptées en commits (`git rev-list --count A..B`) :

| commits présents dans → et absents de ↓ | `gallant-lamport` |
|---|---|
| `main` | **0** |
| `great-brahmagupta` | **0** |
| `eklio-reveal-rebuild` | 115 |

Et dans l'autre sens : `gallant-lamport` ajoute **99** commits à `main` et
**73** à `great-brahmagupta`.

## ⚠ `eklio-reveal-rebuild-28o625` N'A AUCUN ANCÊTRE COMMUN

`git merge-base origin/claude/gallant-lamport-mt20i0
origin/claude/eklio-reveal-rebuild-28o625` ne rend **rien**. Ce sont deux
histoires indépendantes — la seconde est la reconstruction, faite sur une racine
neuve. La fusionner demanderait `--allow-unrelated-histories` et ramènerait un
frontend du 2 septembre.

⚠ **Et son travail n'est pas perdu** : ses cinquante migrations existent toutes,
par nom, dans les cent cinquante-quatre de `gallant-lamport`, et ses
fonctionnalités s'y retrouvent réimplémentées — `Comp access` (2 fichiers de
part et d'autre), le repli sur `VERCEL_URL` (1 fichier de part et d'autre). La
divergence est d'histoire, pas de contenu.

## Recommandation

**`claude/gallant-lamport-mt20i0`**, et la preuve tient en trois lignes :

1. elle contient **tout** `main` — zéro commit de `main` lui manque ;
2. elle contient **tout** `great-brahmagupta` — zéro commit lui manque ;
3. **aucune migration** d'aucune autre branche ne lui manque. Les 154 qu'elle
   porte sont un sur-ensemble strict des 133 de `main`, des 148 de
   `great-brahmagupta` et des 50 de `eklio-reveal-rebuild`.

⚠ **Ce que cette analyse NE dit pas** : elle ne dit pas que les 154 migrations
s'appliquent sans erreur sur la base de production — c'est l'étape 3, et c'est
la répétition à blanc de la phase C qui l'établit. Elle ne dit pas non plus
laquelle Naima a validée : c'est sa décision, et elle est nommée dans la demande,
jamais « la dernière ».

## Le geste, si la réponse est oui

```bash
git fetch origin claude/gallant-lamport-mt20i0
git push origin origin/claude/gallant-lamport-mt20i0:refs/heads/main
```

⚠ **Un `push` en avance rapide, pas une force.** `gallant-lamport` contient
`main` en entier : le `push` est un fast-forward et rien n'est réécrit. Si Git
le refuse, c'est que `main` a bougé depuis cette analyse — **s'arrêter et
refaire le comptage**, ne pas forcer.

---

## ⚠ Mise à jour du 2026-09-26 — le compte de migrations

L'analyse citait **154** migrations sur la branche source. Elle en porte
désormais **157**. Les trois ajoutées depuis, dans l'ordre :

| migration | ce qu'elle fait |
|---|---|
| `20260924150000_a_backup_that_does_not_restore_is_not_a_backup` | remplace la `CHECK` inter-tables de `section_types` par un trigger de contrainte différé — sans elle, la sauvegarde restaure onze lignes de moins, en silence |
| `20260924160000_a_licence_number_is_required_in_every_advertisement` | `license_type_id`, `license_number`, `license_state_code` sur `project_briefs`, avec leurs contraintes de forme |
| `20260926090000_ethics_immediate_negation` | F38 — un terme interdit immédiatement nié est conforme ; `ethics_prohibitive_lead()` et le dépouillement dans `ethics_scan` |

⚠ **Le raisonnement de la fiche ne change pas.** Ce qui change est un compte, et
c'est précisément pourquoi la répétition à blanc ne l'écrit plus en littéral :
elle le **dérive** du dépôt (`ls $MIG/*.sql | wc -l`). Le cliché avait pris deux
migrations de retard sans que l'étape le dise — le compte attendu et le compte
réel étaient tous les deux faux, d'accord entre eux.
