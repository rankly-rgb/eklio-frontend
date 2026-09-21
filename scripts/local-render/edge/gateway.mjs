/*
 * A local stand-in for the Supabase edge, for this sandbox only.
 *
 *   /rest/v1/*     -> PostgREST 12.2.3 (the real thing Supabase runs)
 *   /auth/v1/*     -> the four GoTrue endpoints @supabase/ssr actually calls
 *   /storage/v1/*  -> 501, so a caller that needs it fails loudly
 *
 * The auth half is a stand-in, not GoTrue: it mints the same HS256 session
 * shape against rows that already exist in auth.users. It is here so the
 * app's own login screen and its RLS reads can run unchanged; it grants
 * nothing RLS would not grant on its own.
 */
import http from "node:http";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const WORK = process.env.WORK ?? "/tmp/eklio-edge";
const DB = process.env.DB ?? "eklio_local_verify";
const SECRET = readFileSync(`${WORK}/jwt.secret`, "utf8").trim();
const PGRST = "http://127.0.0.1:3001";
const PORT = 54321;

const db = new Client({ connectionString: `postgres://edge_auth:eklio_local@127.0.0.1:5432/${DB}` });
await db.connect();

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function sign(payload) {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64(payload);
  const s = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
function verify(token) {
  try {
    const [h, p, s] = token.split(".");
    const expect = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
    if (s !== expect) return null;
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}

function userObject(row) {
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email,
    email_confirmed_at: row.created_at,
    phone: "",
    confirmed_at: row.created_at,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: row.created_at,
    updated_at: row.created_at,
    is_anonymous: false,
  };
}

function session(row) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  return {
    access_token: sign({ sub: row.id, email: row.email, role: "authenticated", aud: "authenticated", iss: "supabase-local", iat, exp }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "local-" + row.id,
    user: userObject(row),
  };
}

const json = (res, code, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(payload);
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function auth(req, res, url, raw) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  const body = raw.length ? JSON.parse(raw.toString()) : {};

  if (path === "/token") {
    const grant = url.searchParams.get("grant_type");
    let row;
    if (grant === "refresh_token") {
      const id = String(body.refresh_token || "").replace(/^local-/, "");
      ({ rows: [row] } = await db.query("select id, email, created_at from auth.users where id = $1", [id]));
    } else {
      ({ rows: [row] } = await db.query("select id, email, created_at from auth.users where lower(email) = lower($1)", [body.email ?? ""]));
    }
    if (!row) return json(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
    return json(res, 200, session(row));
  }

  if (path === "/user") {
    const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
    const claims = verify(token);
    if (!claims?.sub) return json(res, 401, { message: "invalid claim: missing sub claim" });
    const { rows: [row] } = await db.query("select id, email, created_at from auth.users where id = $1", [claims.sub]);
    if (!row) return json(res, 401, { message: "User from sub claim in JWT does not exist" });
    return json(res, 200, userObject(row));
  }

  if (path === "/logout") { res.writeHead(204).end(); return; }
  if (path === "/settings") return json(res, 200, { external: {}, disable_signup: false, mailer_autoconfirm: true });
  return json(res, 404, { message: `local edge: ${path} not implemented` });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const raw = await readBody(req);
  try {
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url, raw);
    if (url.pathname.startsWith("/storage/v1")) return json(res, 501, { message: "local edge: storage is not stood up" });
    if (url.pathname.startsWith("/rest/v1")) {
      const target = PGRST + url.pathname.replace(/^\/rest\/v1/, "") + url.search;
      const headers = { ...req.headers };
      delete headers.host; delete headers["content-length"]; delete headers.connection;
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : raw,
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      const out = {};
      upstream.headers.forEach((v, k) => { if (!["content-encoding", "transfer-encoding", "content-length"].includes(k)) out[k] = v; });
      res.writeHead(upstream.status, out);
      return res.end(buf);
    }
    return json(res, 404, { message: "local edge: unknown route" });
  } catch (error) {
    return json(res, 500, { message: String(error?.message ?? error) });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`local edge on http://127.0.0.1:${PORT}`));
