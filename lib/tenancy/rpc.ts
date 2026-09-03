import { z } from "zod";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * La couche d'appel des quatre RPC d'invitation (lot tenancy, backend
 * `20260903102500_org_invite_rpcs.sql`). Même client, même convention que
 * `lib/site/rpc.ts` : le client est TOUJOURS celui de `lib/supabase/server.ts`
 * — clé anon + cookies de session — jamais un client admin, jamais construit
 * ici.
 *
 * ── UNE FORME D'ERREUR DIFFÉRENTE DE `lib/site/rpc.ts` ───────────────────
 *
 * Les fonctions de site_spec renvoient un refus comme une VALEUR (une
 * enveloppe `{"error":{...}}` dans le corps). Les quatre RPC ici font
 * l'inverse : elles `raise exception` en PL/pgSQL sur tout refus (mauvais
 * owner, jeton invalide, email qui ne correspond pas…), ce qui remonte comme
 * une vraie `PostgrestError` transportée par `{ data, error }`. Pas
 * d'enveloppe à déballer ici — l'erreur EST l'erreur PostgREST, telle quelle.
 *
 * ── ZOD AUX DEUX BOUTS ────────────────────────────────────────────────────
 *
 * Contrairement à site_spec (une enveloppe qu'on caste sans reparser, pour ne
 * rien perdre d'un ajout futur en base), ces quatre RPC ont une forme de
 * sortie fixe et étroite — un jeton, un uuid, une ligne ou zéro. Valider en
 * entrée ET en sortie a du sens ici : ça détecte un appelant qui construit un
 * uuid à la main aussi bien qu'une réponse qui ne serait plus celle que ce
 * module attend.
 */

type Client = SupabaseClient<Database>;

export type TenancyRpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PostgrestError };

const uuid = z.string().uuid();
const nonEmptyToken = z.string().min(1);

/* ── create_org_invite ─────────────────────────────────────────────────── */

const createOrgInviteInput = z.object({
  orgId: uuid,
  email: z.string().email(),
  projectId: uuid.optional(),
});

const createOrgInviteOutput = nonEmptyToken;

export type CreateOrgInviteInput = z.infer<typeof createOrgInviteInput>;

/**
 * Owner uniquement (refusé en base sinon). Renvoie le jeton BRUT — une seule
 * fois, jamais stocké en base au-delà de son sha256. L'appelant doit le
 * remettre au mécanisme d'envoi de l'invitation (hors périmètre de ce lot :
 * pas d'e-mail ici) et ne JAMAIS l'écrire dans le localStorage, un cookie, ou
 * toute autre persistance côté client — le perdre après ce retour, c'est
 * devoir régénérer une invitation, pas une fuite.
 */
export async function createOrgInvite(
  supabase: Client,
  input: CreateOrgInviteInput
): Promise<TenancyRpcResult<string>> {
  const parsed = createOrgInviteInput.parse(input);

  const { data, error } = await supabase.rpc("create_org_invite", {
    p_org_id: parsed.orgId,
    p_email: parsed.email,
    ...(parsed.projectId !== undefined ? { p_project_id: parsed.projectId } : {}),
  });

  if (error) return { ok: false, error };
  return { ok: true, data: createOrgInviteOutput.parse(data) };
}

/* ── preview_org_invite ────────────────────────────────────────────────── */

const previewOrgInviteRow = z.object({
  organizationName: z.string(),
  invitedEmail: z.string(),
});

export type PreviewOrgInvite = z.infer<typeof previewOrgInviteRow>;

/**
 * Anon-callable : c'est la page d'invitation, avant tout compte. Zéro ligne
 * est le chemin NORMAL pour un jeton mauvais, expiré ou déjà utilisé — la
 * fonction en base ne lève jamais sur un jeton invalide, elle rend une table
 * vide. `data: null` ici veut dire exactement ça, ce n'est pas une erreur.
 */
export async function previewOrgInvite(
  supabase: Client,
  input: { token: string }
): Promise<TenancyRpcResult<PreviewOrgInvite | null>> {
  const { token } = z.object({ token: nonEmptyToken }).parse(input);

  const { data, error } = await supabase.rpc("preview_org_invite", {
    p_token: token,
  });

  if (error) return { ok: false, error };

  const row = Array.isArray(data) ? data[0] : undefined;
  if (!row) return { ok: true, data: null };

  return {
    ok: true,
    data: previewOrgInviteRow.parse({
      organizationName: row.organization_name,
      invitedEmail: row.invited_email,
    }),
  };
}

/* ── accept_org_invite ─────────────────────────────────────────────────── */

/**
 * Authentifié uniquement, et l'e-mail du compte doit correspondre à celui
 * invité (vérifié en base, pas ici). Renvoie l'id de l'organisation rejointe.
 */
export async function acceptOrgInvite(
  supabase: Client,
  input: { token: string }
): Promise<TenancyRpcResult<string>> {
  const { token } = z.object({ token: nonEmptyToken }).parse(input);

  const { data, error } = await supabase.rpc("accept_org_invite", {
    p_token: token,
  });

  if (error) return { ok: false, error };
  return { ok: true, data: uuid.parse(data) };
}

/* ── remove_org_member ─────────────────────────────────────────────────── */

/**
 * Owner uniquement, et refusé en base si la cible est elle-même owner. Ne
 * supprime pas la ligne — `status` passe à `removed`. Pas de valeur de
 * retour utile (`void` côté SQL) : `data` vaut toujours `null` au succès.
 */
export async function removeOrgMember(
  supabase: Client,
  input: { memberId: string }
): Promise<TenancyRpcResult<null>> {
  const { memberId } = z.object({ memberId: uuid }).parse(input);

  const { error } = await supabase.rpc("remove_org_member", {
    p_member_id: memberId,
  });

  if (error) return { ok: false, error };
  return { ok: true, data: null };
}
