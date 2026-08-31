/**
 * L'enveloppe d'erreur des RPC Eklio.
 *
 * Toutes les entrées de FRONTEND_CONTRACT.md §1 rendent la même forme quand
 * elles refusent : `{"error":{"code","message","field"?}}`. Une erreur veut
 * dire que RIEN n'a été écrit — la validation précède toujours l'écriture.
 */

export type EklioErrorCode =
  | "unauthenticated"
  | "not_found"
  | "payment_required"
  | "invalid_body"
  | "invalid_field"
  | "invalid_scope"
  | "invalid_format"
  | "invalid_target"
  | "unknown_field"
  | "no_fix_needed"
  | "no_direction"
  | "too_long";

export type EklioError = {
  code: EklioErrorCode;
  message: string;
  field?: string;
};

type Enveloped = { error?: unknown };

/**
 * Extrait l'erreur d'une enveloppe RPC, ou null si l'appel a réussi.
 *
 * ⚠ `payment_required` et `not_found` sont deux phrases différentes et le
 * contrat interdit de les confondre : sur `payment_required` on ouvre le
 * checkout (elle a un kit, elle ne l'a pas acheté), sur `not_found` on
 * s'excuse. Les fondre dans un « une erreur est survenue » est le moyen le
 * plus sûr de perdre la vente.
 */
export function envelopeError(payload: unknown): EklioError | null {
  if (payload === null || typeof payload !== "object") return null;
  const raw = (payload as Enveloped).error;
  if (raw === null || typeof raw !== "object") return null;

  const { code, message, field } = raw as Record<string, unknown>;
  if (typeof code !== "string") return null;

  return {
    code: code as EklioErrorCode,
    message: typeof message === "string" ? message : "",
    ...(typeof field === "string" ? { field } : {}),
  };
}

export function isPaymentRequired(error: EklioError | null): boolean {
  return error?.code === "payment_required";
}
