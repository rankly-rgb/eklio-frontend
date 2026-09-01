import { NextResponse } from "next/server";
import type { SiteRpcResult } from "@/lib/site/rpc";

/*
 * La traduction d'un résultat RPC en réponse HTTP, écrite UNE fois.
 *
 * Les six routes de l'éditeur renvoient la même chose : l'enveloppe telle
 * qu'elle arrive, ou l'enveloppe d'erreur du contrat avec le code d'état qui
 * lui correspond. Le corps n'est jamais réécrit — `{"error":{"code","message",
 * "field"?}}` est ce que le client sait afficher en ligne, sur le champ fautif.
 */

/** `no-store` : une enveloppe périmée ferait mentir la maquette. */
const HEADERS = { "cache-control": "no-store" } as const;

export function siteResponse<T>(
  result: SiteRpcResult<T>,
  init?: { etag?: string }
): NextResponse {
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: HEADERS }
    );
  }

  return NextResponse.json(result.data, {
    headers: init?.etag ? { ...HEADERS, etag: `"${init.etag}"` } : HEADERS,
  });
}

/**
 * L'`If-None-Match` de la requête, dépouillé de ses guillemets et du préfixe
 * faible que certains intermédiaires ajoutent. Renvoie `null` si l'en-tête est
 * absent ou porte plusieurs valeurs — l'etag du contrat est un md5 unique, une
 * liste ne peut venir que d'un cache qu'on ne contrôle pas.
 */
export function ifNoneMatch(request: Request): string | null {
  const raw = request.headers.get("if-none-match");
  if (!raw || raw.includes(",")) return null;
  return raw.trim().replace(/^W\//, "").replace(/^"|"$/g, "") || null;
}

/** 304 : le client garde ce qu'il a. Sans corps, comme le veut la spec HTTP. */
export function notModified(etag: string): NextResponse {
  return new NextResponse(null, {
    status: 304,
    headers: { ...HEADERS, etag: `"${etag}"` },
  });
}
