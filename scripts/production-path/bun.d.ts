/*
 * ── LE CLIENT SQL DE BUN, DÉCLARÉ POUR LE SEUL USAGE DE `local-db.ts` ────
 *
 * Même raison que `pg.d.ts` à côté : le dépôt ne dépend pas de `bun-types`, et
 * `npm run typecheck` lit `scripts/`. Ces quatre signatures sont celles que
 * `local-db.ts` emploie, et rien de plus — un lanceur local, jamais du produit.
 */
declare module "bun" {
  export class SQL {
    constructor(url: string);
    unsafe(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
    begin<T>(fn: (tx: SQL) => Promise<T>): Promise<T>;
    close(): Promise<void>;
  }
}
