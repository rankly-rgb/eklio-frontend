import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * L'état d'envoi par utilisateur — quand on lui a écrit, et s'il s'est
 * désinscrit.
 *
 * OÙ IL VIT — dans les métadonnées de l'utilisateur Supabase
 * (`auth.users.raw_user_meta_data.eklio_emails`), écrites par l'API admin.
 *
 * POURQUOI LÀ — le schéma ne porte aucune table de journal d'envoi, et ce
 * dépôt n'écrit pas de migration (§8). C'est le seul stockage durable,
 * par utilisateur, accessible au serveur. C'est un pis-aller assumé.
 *
 * DEMANDE AU DÉPÔT DE SCHÉMA — une table
 * `email_log (user_id, kind, sent_at, unsubscribed_at)` avec un index sur
 * `(user_id, sent_at desc)`. Elle donnerait : la déduplication par TYPE
 * d'e-mail, le plafond des 72 h par une simple requête, un historique
 * consultable, et la désinscription comme donnée de premier ordre plutôt que
 * comme clé de métadonnée.
 */

type Client = SupabaseClient<Database>;

export const EMAIL_COOLDOWN_HOURS = 72;
const COOLDOWN_MS = EMAIL_COOLDOWN_HOURS * 60 * 60 * 1000;

export type EmailKind =
  | "brief_abandoned"
  | "direction_unchosen"
  | "month_ready";

export type EmailState = {
  /** Dernier envoi par type, en ISO. */
  sent: Partial<Record<EmailKind, string>>;
  unsubscribed: boolean;
};

const EMPTY: EmailState = { sent: {}, unsubscribed: false };

export function parseEmailState(metadata: unknown): EmailState {
  if (!metadata || typeof metadata !== "object") return EMPTY;
  const raw = (metadata as Record<string, unknown>).eklio_emails;
  if (!raw || typeof raw !== "object") return EMPTY;

  const record = raw as Record<string, unknown>;
  const sent =
    record.sent && typeof record.sent === "object"
      ? (record.sent as Partial<Record<EmailKind, string>>)
      : {};

  return { sent, unsubscribed: record.unsubscribed === true };
}

/**
 * Peut-on écrire à cet utilisateur, maintenant ?
 *
 * DEUX RÈGLES, et la seconde est celle qui compte :
 *   - jamais si désinscrit ;
 *   - AU PLUS UN e-mail par utilisateur toutes les 72 heures, TOUS TYPES
 *     CONFONDUS. Un praticien qui abandonne son brief, revient, génère, puis
 *     ne choisit pas, déclenche trois raisons d'écrire en deux jours. Le
 *     plafond est ce qui l'empêche de recevoir trois e-mails.
 */
export function canSend(
  state: EmailState,
  kind: EmailKind,
  now: Date = new Date()
): boolean {
  if (state.unsubscribed) return false;

  // Déjà envoyé CE type : on ne le répète jamais.
  if (state.sent[kind]) return false;

  for (const iso of Object.values(state.sent)) {
    const at = Date.parse(iso);
    if (Number.isNaN(at)) continue;
    if (now.getTime() - at < COOLDOWN_MS) return false;
  }

  return true;
}

/** Note l'envoi. `admin` doit porter la service_role : l'API admin l'exige. */
export async function recordSend(
  admin: Client,
  userId: string,
  metadata: unknown,
  kind: EmailKind,
  now: Date = new Date()
): Promise<void> {
  const state = parseEmailState(metadata);
  const next: EmailState = {
    ...state,
    sent: { ...state.sent, [kind]: now.toISOString() },
  };

  const base =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : {};

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...base, eklio_emails: next },
  });

  if (error) console.error("[email] note d'envoi", error);
}

export async function setUnsubscribed(
  admin: Client,
  userId: string,
  metadata: unknown
): Promise<void> {
  const state = parseEmailState(metadata);
  const base =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : {};

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...base,
      eklio_emails: { ...state, unsubscribed: true },
    },
  });
}

/*
 * Le lien de désinscription porte un identifiant utilisateur : sans signature,
 * n'importe qui pourrait désinscrire n'importe qui en changeant un chiffre.
 * Le secret est la service_role key — strictement serveur, et déjà requise
 * pour écrire la désinscription elle-même.
 */
function secret(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante.");
  return value;
}

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret())
    .update(`unsubscribe:${userId}`)
    .digest("hex");
}

export function unsubscribeTokenValid(userId: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId), "utf8");
  const given = Buffer.from(token, "utf8");
  // `timingSafeEqual` exige des longueurs égales : on compare d'abord.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(userId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/api/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}
