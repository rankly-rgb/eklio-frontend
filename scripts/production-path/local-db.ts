/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA BASE LOCALE SANS POSTGREST — CE QUE CE FICHIER REMPLACE, ET CE QU'IL NE
 *  REMPLACE PAS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ÉTIQUETTE : ce fichier est un TRANSPORT DE SUBSTITUTION, pas du produit.
 *
 * Le 2026-10-04, l'environnement de la session refuse le registre npm
 * (`x-deny-reason: host_not_allowed`), Docker Hub, ghcr et ECR. Ni
 * `@supabase/supabase-js`, ni PostgREST, ni la pile Supabase locale ne peuvent
 * être installés. Le vrai PostgreSQL 16, lui, est là, et les 177 migrations du
 * backend s'y appliquent sans erreur sur une amorce minimale des schémas que la
 * plateforme fournit (`auth`, `storage`, rôles).
 *
 * Ce module parle donc au vrai PostgreSQL avec le client intégré de Bun, et
 * présente aux ports du produit le SOUS-ENSEMBLE du client Supabase qu'ils
 * emploient : `from().select/insert/update/delete/upsert` avec `eq`, `in`, `is`,
 * `order`, `limit`, `single`, `maybeSingle`, et `rpc()`.
 *
 * ── ⚠ CE QU'IL GARDE DE POSTGREST, EXPRÈS ───────────────────────────────
 *
 *   le rôle        chaque requête tourne dans une transaction en
 *                  `set local role service_role`, comme PostgREST avec la clef
 *                  de service : un GRANT manquant échoue ici comme là-bas. Le
 *                  superutilisateur n'exécute RIEN au nom du produit.
 *   la forme JSON  les lignes sortent par `json_agg`, comme chez PostgREST : les
 *                  dates en chaîne ISO, les numériques en nombre, le jsonb en
 *                  objet.
 *   les types      chaque paramètre est casté au type déclaré de sa colonne ou de
 *                  son argument (lu dans `pg_attribute` / `pg_proc`), comme
 *                  PostgREST le fait — un texte passé pour un uuid échoue.
 *   les erreurs    `{ message, code }`, avec le SQLSTATE en `code` (`EK010`).
 *
 * ── ⚠ CE QU'IL NE REPRODUIT PAS ─────────────────────────────────────────
 *
 *   la RLS côté navigateur (clef anon, JWT d'utilisateur) : aucun port de ce
 *   chemin ne s'en sert ; les ressources imbriquées (`projects!inner(...)`) :
 *   il LÈVE plutôt que de les ignorer ; le tri de PostgREST sur les nuls.
 *
 * Le rapport le dit sur la planche : « transport : client SQL de Bun à la place
 * de PostgREST ».
 */
import { SQL } from "bun";

export type DbError = { message: string; code: string | null };
type Result<T> = { data: T; error: DbError | null };

const ROLE = "service_role";

export function localDb(
  url = "postgres://postgres@127.0.0.1:54322/postgres?sslmode=disable",
  /**
   * ⚠ LIRE COMME ELLE LIT. Avec un identifiant, chaque requête tourne en rôle
   * `authenticated` avec `sub` = cet identifiant — ce que PostgREST fait avec le
   * JWT de la praticienne. `get_content_month` vérifie l'accès par `auth.uid()` :
   * le lire en `service_role` aurait éprouvé un chemin qu'aucune cliente ne prend.
   */
  asUser: string | null = null
) {
  if (asUser !== null && !/^[0-9a-f-]{36}$/.test(asUser)) throw new Error("localDb: identifiant d'utilisatrice invalide");
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error("localDb: refus — ce transport n'écrit que sur une base locale");
  }
  const sql = new SQL(url);
  const columnTypes = new Map<string, Map<string, string>>();
  const procs = new Map<string, { args: Array<{ name: string; type: string }>; set: boolean }>();

  async function run<T>(text: string, params: unknown[]): Promise<Result<T>> {
    try {
      const rows = await sql.begin(async (tx: SQL) => {
        const role = asUser ? "authenticated" : ROLE;
        const claims = asUser ? `{"role":"authenticated","sub":"${asUser}"}` : `{"role":"${ROLE}"}`;
        await tx.unsafe(`set local role ${role}`);
        await tx.unsafe(`select set_config('request.jwt.claims', '${claims}', true)`);
        return await tx.unsafe(text, params);
      });
      return { data: (rows[0]?.data ?? null) as T, error: null };
    } catch (error) {
      const e = error as { message?: string; errno?: string };
      return { data: null as T, error: { message: e.message ?? String(error), code: e.errno ?? null } };
    }
  }

  async function typesOf(table: string): Promise<Map<string, string>> {
    const known = columnTypes.get(table);
    if (known) return known;
    const rows = await sql.unsafe(
      `select attname, format_type(atttypid, atttypmod) as type from pg_attribute
        where attrelid = $1::regclass and attnum > 0 and not attisdropped`,
      [`public.${table}`]
    );
    const map = new Map<string, string>((rows as Array<{ attname: string; type: string }>).map((r) => [r.attname, r.type]));
    if (map.size === 0) throw new Error(`localDb: table inconnue public.${table}`);
    columnTypes.set(table, map);
    return map;
  }

  /** Un paramètre, casté au type de sa colonne. */
  function bind(params: unknown[], value: unknown, type: string): string {
    if (value === null || value === undefined) {
      params.push(null);
      return `$${params.length}::${type}`;
    }
    /*
     * ⚠ LA VALEUR BRUTE, PAS SA SÉRIALISATION. Le client de Bun encode lui-même
     * en JSON un paramètre typé `jsonb` : lui passer `JSON.stringify(x)` faisait
     * arriver une CHAÎNE JSON (« "[1,2]" ») là où la colonne attend un tableau.
     */
    if (type.endsWith("[]")) {
      params.push(value);
      return `coalesce(array(select jsonb_array_elements_text($${params.length}::jsonb)), '{}')::${type}`;
    }
    if (type === "jsonb" || type === "json") {
      params.push(value);
      return `$${params.length}::jsonb::${type}`;
    }
    params.push(value instanceof Date ? value.toISOString() : String(value));
    return `$${params.length}::${type}`;
  }

  function ident(name: string): string {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`localDb: identifiant refusé « ${name} »`);
    return `"${name}"`;
  }

  function columnsOf(list: string): string {
    if (list.trim() === "*") return "*";
    if (/[!()]/.test(list)) {
      throw new Error(`localDb: ressource imbriquée non reproduite (« ${list} ») — PostgREST seul sait la lire`);
    }
    return list.split(",").map((c) => ident(c.trim())).join(", ");
  }

  type Filter = { column: string; op: string; value: unknown };

  function where(filters: Filter[], types: Map<string, string>, params: unknown[]): string {
    if (filters.length === 0) return "";
    const parts = filters.map(({ column, op, value }) => {
      const type = types.get(column);
      if (!type) throw new Error(`localDb: colonne inconnue « ${column} »`);
      const c = ident(column);
      switch (op) {
        case "eq": return `${c} = ${bind(params, value, type)}`;
        case "neq": return `${c} <> ${bind(params, value, type)}`;
        case "gt": return `${c} > ${bind(params, value, type)}`;
        case "gte": return `${c} >= ${bind(params, value, type)}`;
        case "lt": return `${c} < ${bind(params, value, type)}`;
        case "lte": return `${c} <= ${bind(params, value, type)}`;
        case "in": return `${c} = any(${bind(params, value, `${type}[]`)})`;
        case "is":
          if (value === null || value === "null") return `${c} is null`;
          if (value === true || value === "true") return `${c} is true`;
          if (value === false || value === "false") return `${c} is false`;
          throw new Error(`localDb: is(${String(value)}) non reproduit`);
        default: throw new Error(`localDb: opérateur « ${op} » non reproduit`);
      }
    });
    return ` where ${parts.join(" and ")}`;
  }

  function query(table: string, mode: "select" | "insert" | "update" | "delete" | "upsert", payload?: unknown, options?: { onConflict?: string }) {
    const filters: Filter[] = [];
    let columns: string | null = mode === "select" ? "*" : null;
    let order: { column: string; ascending: boolean } | null = null;
    let limit: number | null = null;

    async function execute(single: "many" | "one" | "maybe"): Promise<Result<unknown>> {
      const types = await typesOf(table);
      const params: unknown[] = [];
      let body: string;
      const t = ident(table);
      const returning = columns ? ` returning ${columnsOf(columns)}` : "";

      if (mode === "select") {
        body = `select ${columnsOf(columns ?? "*")} from public.${t}${where(filters, types, params)}` +
          (order ? ` order by ${ident(order.column)} ${order.ascending ? "asc" : "desc"}` : "") +
          (limit !== null ? ` limit ${Math.floor(limit)}` : "");
      } else if (mode === "insert" || mode === "upsert") {
        const rows = (Array.isArray(payload) ? payload : [payload]) as Array<Record<string, unknown>>;
        const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
        const values = rows
          .map((r) => `(${keys.map((k) => (k in r ? bind(params, r[k], types.get(k) ?? "text") : "default")).join(", ")})`)
          .join(", ");
        let conflict = "";
        if (mode === "upsert") {
          const target = options?.onConflict
            ? options.onConflict.split(",").map((k) => ident(k.trim())).join(", ")
            : await primaryKey(table);
          const set = keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ");
          conflict = ` on conflict (${target}) do update set ${set}`;
        }
        body = `insert into public.${t} (${keys.map(ident).join(", ")}) values ${values}${conflict}${returning || " returning 1 as ok"}`;
      } else if (mode === "update") {
        const patch = payload as Record<string, unknown>;
        const set = Object.entries(patch).map(([k, v]) => `${ident(k)} = ${bind(params, v, types.get(k) ?? "text")}`).join(", ");
        body = `update public.${t} set ${set}${where(filters, types, params)}${returning || " returning 1 as ok"}`;
      } else {
        body = `delete from public.${t}${where(filters, types, params)}${returning || " returning 1 as ok"}`;
      }

      const text = `with q as (${body}) select coalesce(json_agg(q), '[]'::json) as data from q`;
      const out = await run<unknown[]>(text, params);
      if (out.error) return { data: null, error: out.error };
      const rows = out.data ?? [];
      if (mode !== "select" && !columns) return { data: null, error: null };
      if (single === "many") return { data: rows, error: null };
      if (rows.length > 1) {
        return { data: null, error: { message: `JSON object requested, multiple (${rows.length}) rows returned`, code: "PGRST116" } };
      }
      if (rows.length === 0 && single === "one") {
        return { data: null, error: { message: "JSON object requested, 0 rows returned", code: "PGRST116" } };
      }
      return { data: rows[0] ?? null, error: null };
    }

    const builder = {
      select(list = "*") { columns = list; return builder; },
      eq(column: string, value: unknown) { filters.push({ column, op: "eq", value }); return builder; },
      neq(column: string, value: unknown) { filters.push({ column, op: "neq", value }); return builder; },
      gt(column: string, value: unknown) { filters.push({ column, op: "gt", value }); return builder; },
      gte(column: string, value: unknown) { filters.push({ column, op: "gte", value }); return builder; },
      lt(column: string, value: unknown) { filters.push({ column, op: "lt", value }); return builder; },
      lte(column: string, value: unknown) { filters.push({ column, op: "lte", value }); return builder; },
      in(column: string, values: unknown[]) { filters.push({ column, op: "in", value: values }); return builder; },
      is(column: string, value: unknown) { filters.push({ column, op: "is", value }); return builder; },
      filter(column: string, op: string, value: unknown) { filters.push({ column, op, value }); return builder; },
      order(column: string, opts: { ascending?: boolean } = {}) { order = { column, ascending: opts.ascending !== false }; return builder; },
      limit(n: number) { limit = n; return builder; },
      single() { return execute("one"); },
      maybeSingle() { return execute("maybe"); },
      then<R1 = Result<unknown>, R2 = never>(
        onfulfilled?: ((v: Result<unknown>) => R1 | PromiseLike<R1>) | null,
        onrejected?: ((e: unknown) => R2 | PromiseLike<R2>) | null
      ): Promise<R1 | R2> {
        return execute("many").then(onfulfilled, onrejected);
      },
    };
    return builder;
  }

  async function primaryKey(table: string): Promise<string> {
    const rows = await sql.unsafe(
      `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = $1::regclass and i.indisprimary`,
      [`public.${table}`]
    );
    return (rows as Array<{ attname: string }>).map((r) => ident(r.attname)).join(", ");
  }

  async function procOf(name: string) {
    const known = procs.get(name);
    if (known) return known;
    const rows = await sql.unsafe(
      `select p.proretset as set, coalesce(p.proargnames, '{}') as names,
              array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
              p.pronargs as n
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'public' and p.proname = $1`,
      [name]
    );
    if (rows.length !== 1) throw new Error(`localDb: rpc « ${name} » : ${rows.length} surcharge(s)`);
    const r = rows[0] as unknown as { set: boolean; names: string[]; types: string[]; n: number };
    const info = { set: r.set, args: r.types.map((type, i) => ({ name: r.names[i], type })) };
    procs.set(name, info);
    return info;
  }

  async function rpc(name: string, args: Record<string, unknown> = {}): Promise<Result<unknown>> {
    const proc = await procOf(ident(name).slice(1, -1));
    const params: unknown[] = [];
    const named = Object.entries(args).map(([k, v]) => {
      const arg = proc.args.find((a) => a.name === k);
      if (!arg) throw new Error(`localDb: rpc ${name} n'a pas d'argument « ${k} »`);
      return `${ident(k)} => ${bind(params, v, arg.type)}`;
    });
    const call = `public.${ident(name)}(${named.join(", ")})`;
    /*
     * ⚠ LA FORME DE POSTGREST : un ensemble rend un tableau, un scalaire rend sa
     * valeur, un `void` rend null. Un ensemble de scalaires sort en objets d'une
     * colonne nommée comme la fonction, et PostgREST les déballe ; ici aussi.
     */
    if (proc.set) {
      const out = await run<Array<Record<string, unknown>>>(
        `select coalesce(json_agg(r), '[]'::json) as data from ${call} r`, params
      );
      if (out.error) return out;
      const rows = out.data ?? [];
      const unwrap = rows.length > 0 && Object.keys(rows[0]).length === 1 && name in rows[0];
      return { data: unwrap ? rows.map((r) => r[name]) : rows, error: null };
    }
    return run(`select to_json(${call}) as data`, params);
  }

  return {
    from(table: string) {
      return {
        select: (list = "*") => query(table, "select").select(list),
        insert: (rows: unknown) => query(table, "insert", rows),
        upsert: (rows: unknown, options?: { onConflict?: string }) => query(table, "upsert", rows, options),
        update: (patch: Record<string, unknown>) => query(table, "update", patch),
        delete: () => query(table, "delete"),
      };
    },
    rpc,
    /** Pour les relectures du rapport : du SQL en clair, en superutilisateur, LECTURE SEULE. */
    async read<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      if (!/^\s*(select|with)\b/i.test(text)) throw new Error("localDb.read : lecture seule");
      return (await sql.unsafe(text, params)) as unknown as T[];
    },
    close: () => sql.close(),
  };
}

export type LocalDb = ReturnType<typeof localDb>;
