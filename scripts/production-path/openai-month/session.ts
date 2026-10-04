/*
 * ── CE QUE LES LANCEURS DE CETTE SESSION PARTAGENT ──────────────────────
 *
 * ⚠ LE PLAFOND EST CELUI DE LA SESSION, PAS CELUI D'UN LANCEMENT. Quatre lanceurs
 * (banque, mois, reprise, quota) dépensent sur le même compte ; un compteur par
 * processus laisserait chacun dépenser 5 $. Le compte est donc tenu dans un
 * journal JSONL, un appel par ligne, relu au démarrage de chaque lanceur.
 *
 * ⚠ ET IL N'Y A PAS D'AUTRE COMPTE. La clef ne lit pas l'usage côté fournisseur
 * (`api.usage.read` manque, F69) : ce fichier est la seule chose qui dise ce qui
 * a été dépensé, et il ne contient que des tokens et des dollars — ni clef, ni
 * texte de prompt.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  openAiTransport,
  spendMeter,
  type OpenAiTransport,
  type SpendMeter,
} from "@/lib/content/generate/openai";

export const SESSION_CAP_USD = 5;
export const SPEND_LOG = "design/production-first-month/openai-calls.jsonl";

type Line = { at: string; label: string; usd: number; input: number; output: number; cacheRead: number; cacheWrite: number };

export function spentSoFar(path = SPEND_LOG): number {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .reduce((sum, l) => sum + (JSON.parse(l) as Line).usd, 0);
}

/** Le compteur de la session : il repart de ce que le journal dit déjà dépensé. */
export function sessionMeter(path = SPEND_LOG, capUsd = SESSION_CAP_USD): SpendMeter {
  mkdirSync(dirname(path), { recursive: true });
  const inner = spendMeter(capUsd, spentSoFar(path));
  const labels = new Map<() => void, string>();
  return {
    ...inner,
    capUsd,
    reserve(worstUsd, label) {
      const release = inner.reserve(worstUsd, label);
      labels.set(release, label);
      return release;
    },
    settle(release, actualUsd, usage) {
      inner.settle(release, actualUsd, usage);
      const line: Line = { at: new Date().toISOString(), label: labels.get(release) ?? "?", usd: actualUsd, ...usage };
      labels.delete(release);
      appendFileSync(path, JSON.stringify(line) + "\n");
    },
  };
}

/**
 * Le transport, avec la clef de l'environnement.
 *
 * ⚠ LA CLEF NE QUITTE JAMAIS CETTE FONCTION : elle n'est ni imprimée, ni écrite,
 * ni passée à un message d'erreur. Son absence est dite par son NOM.
 */
export function transportFromEnv(): OpenAiTransport {
  const key = process.env.EKLIO_OPENAI_API_KEY;
  if (!key) throw new Error("EKLIO_OPENAI_API_KEY absente de l'environnement — rien n'a été appelé");
  return openAiTransport(key);
}

/** Refuse de tourner sans `--confirm` : ces lanceurs dépensent. */
export function confirmOrDie(what: string): void {
  if (!process.argv.includes("--confirm")) {
    console.error(`Refus sans --confirm : ${what} dépense de l'argent.`);
    process.exit(1);
  }
}

export function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}
