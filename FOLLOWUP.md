# FOLLOWUP.md — hors périmètre du chantier Content

Ce fichier ne porte que ce qui a été **rencontré** pendant le chantier Content et
**laissé intact** parce qu'il ouvre un autre chantier. Rien ici n'a été modifié.

---

## F1 — ⚠ La production porte 14 migrations que le tronc n'a pas

**Rencontré en** PHASE 0. **Détail complet** : `eklio-backend/DIAGNOSTIC.md` §0.1.

`fobgdsupyfslxbswfuay` a 148 migrations appliquées. `claude/great-brahmagupta-za7qmx`
et `origin/main` en portent 133. Les 14 manquantes existent sur
`origin/claude/stoic-ritchie-1liqrz` (tête `46d4111`) et n'ont été mergées nulle part :

`20260917160202` → `20260920081641`, soit la Californie et la Floride comme premiers
États vérifiés, la quatrième licence BBS, la seconde famille de règles (positionnement),
les dix règles v1, et **deux ajouts à `banned_phrases`** (30 → 32).

**Pourquoi c'est un problème et pas une nuance.** Un CI qui rejoue les migrations depuis
zéro depuis cette branche produit un schéma qui n'est pas celui de la production. La
liste de phrases interdites contre laquelle le moteur de composition est testé ici a 30
entrées ; celle qui refuse en production en a 32.

**Atténuation tenue dans ce chantier** : aucune migration neuve ne référence un objet
introduit par ces 14, et tout contrôle de phrase passe par le RPC
`usp_banned_phrases_check` plutôt que par une copie de la liste.

**Ce qu'il faut faire** : merger `claude/stoic-ritchie-1liqrz` dans le tronc backend,
puis rejouer `scripts/verify-recovered-migrations.sh`. C'est de l'hygiène de branches,
explicitement hors périmètre ici.

---

## F2 — La branche de référence citée au prompt a divergé

**Rencontré en** PHASE 0. **Détail** : `DIAGNOSTIC.md` §0.2.

`claude/eklio-reveal-rebuild-28o625` existe des deux côtés mais sa tête frontend
(`e7d5855`, merge de la PR #15) n'est pas un ancêtre du tronc courant. Elle n'est plus
une référence utilisable. Le travail se fait sur `claude/great-brahmagupta-za7qmx`.

Rien à faire, sinon cesser de la citer. Sa suppression relèverait de l'hygiène de
branches, hors périmètre.

---

## F3 — `local-verify.sh` sort en 1 quand la dérive est grande, et cache son propre résumé

**Rencontré en** PHASE 6.3.

Le script termine par

```bash
python3 supabase/tests/helpers/schema_drift_report.py … | grep -E '…' | head -20
…
echo "Migrations replayed clean. Tests: $ran run, $failed failed."
```

Sous `set -euo pipefail`, `head -20` ferme le tuyau dès la vingtième ligne, le
processus amont reçoit SIGPIPE, et le script **s'arrête là** — avant la ligne
qui dit combien de tests ont tourné et combien ont échoué.

Tant que la dérive tient en vingt lignes, on ne le voit pas. Ce chantier ajoute
478 objets (tables, policies, contraintes, index, fonctions), le rapport en fait
plus de vingt, et le script est sorti en 1 avec **zéro test en échec** — un
signal rouge pour une raison qui n'est pas celle qu'on croit lire.

**Correctif** : capturer la sortie du rapport dans une variable avant de la
tronquer, ou remplacer `head -20` par `sed -n '1,20p'` qui lit jusqu'au bout.
Une ligne, mais dans un fichier que ce chantier n'avait pas à toucher.

**Ce que la dérive elle-même dit** : `ONLY IN PRODUCTION: 0`, `DIFFERENT: 0`,
et 478 objets que le rejeu produit et que l'empreinte enregistrée n'a pas.
C'est la forme attendue — les migrations produisent tout ce que la production a,
plus tout ce que ce chantier ajoute. L'empreinte
`supabase/tests/helpers/schema_fingerprint.production.txt` sera à réenregistrer
le jour où ces migrations seront appliquées.
