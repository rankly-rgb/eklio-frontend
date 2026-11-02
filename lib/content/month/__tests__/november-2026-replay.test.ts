import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { placeByDrawing } from "@/lib/content/month/select";
import { illustrateMonth } from "@/lib/visual-library/illustrate";
import { composeCard } from "@/lib/content/month/compose-card";
import { assembleMonth, shortfallDetail, type AssemblePorts, type InsertRefusal } from "@/lib/content/month/assemble";
import { asMonthPost } from "@/lib/content/month/select";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import { checkVariety } from "@/lib/content/variety";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  F77 REJOUÉ SUR LES DONNÉES ENREGISTRÉES DE NOVEMBRE 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Les 57 réponses du run dd5e0066 (kit 45de0dac), relues dans
 * `content_generation_results` ; chacune est recomposée par le vrai moteur, avec
 * la palette du kit et le pied « Ember consulting · LMFT 123456 ».
 *
 * ⚠ L'ÉCRITURE REJOUE L'ISSUE ENREGISTRÉE. En production, la base a accepté les
 * 24 posts publiés et refusé les autres par `null value in column "archetype"`
 * (journaux Postgres, 28 fois). L'ordre de composition d'alors — qui décidait quel
 * post recevait une mise en page nulle — n'est pas retrouvable : les lignes du
 * journal sont insérées ensemble et départagées par un identifiant aléatoire. On
 * rejoue donc l'issue de chaque post, pas sa cause (corrigée par `monthLayouts`).
 *
 * ⚠ LE CHIFFRE ENREGISTRÉ, ET CELUI DU REJEU. Les journaux Postgres de
 * production portent 24 écritures acceptées et 28 refusées : le premier bloc
 * reconstitue le constat À PARTIR DE CES COMPTES et vérifie qu'il nomme « 28
 * écritures refusées par la base ». Le rejeu par le code d'aujourd'hui ne
 * retombe pas sur 28, pour deux raisons dites : le juge de complétude de ce
 * jour-là a écarté 2 posts dont les verdicts ne sont journalisés nulle part
 * (F78) ; et un remplaçant n'est plus pris que s'il garde le mois sans constat
 * transversal (il ramenait sinon une tournure déjà vue). Le rejeu fige donc ses
 * propres chiffres, pas un nombre arrangé pour ressembler au journal.
 */

type JournalPost = {
  published: boolean;
  topicId: string;
  archetype: string;
  title: string;
  hook: string;
  cardLine: string;
  eyebrow: string;
  payload: unknown;
  caption: string;
  altText: string;
  rationale: string;
};
const J = JSON.parse(
  readFileSync("lib/content/__tests__/fixtures/november-2026-journal.json", "utf8")
) as {
  kit: {
    practiceName: string;
    licenceMention: string;
    modalities: string[];
    direction: DirectionPalette;
    intents: Array<{ id: string; label: string }>;
  };
  recordedInsertError: { code: string; message: string };
  posts: JournalPost[];
};

const footer = `${J.kit.practiceName} · ${J.kit.licenceMention}`;
/*
 * Les dessins du produit, attribués comme l'orchestrateur les attribue à la
 * réserve (`placeByDrawing` + `illustrateMonth`). Un dessin fixe pour les trente
 * (jusqu'au 2026-11-02) donnait trente cartes de même parité — toutes sur papier
 * — et le contrôle de structure (F102) y voyait, à raison, dix fois la même
 * image. Un post qu'aucun dessin ne dit garde le dessin fixe : ce rejeu éprouve
 * F77 (l'écriture), pas l'appariement.
 */
const DRAWN = (() => {
  const signals = J.posts.map((p) => ({ title: p.title, hook: p.hook, cardLine: p.cardLine, payload: p.payload, caption: p.caption }));
  const placed = placeByDrawing(signals, (posts) => illustrateMonth(posts));
  const at = new Map(placed.posts.map((s, i) => [s, placed.drawings[i]]));
  return signals.map((s) => at.get(s) ?? "ground-anchor");
})();

const prepared = () =>
  J.posts.map((p, i) => {
    const card = composeCard({
      illustration: DRAWN[i] ?? "ground-anchor",
      archetype: p.archetype,
      payload: p.payload,
      palette: cardPalette(`2026-11-01-${i}`, J.kit.direction, false),
      eyebrow: p.eyebrow,
      headline: p.cardLine,
      footer,
      licenceMention: J.kit.licenceMention,
    });
    return {
      cardLine: p.cardLine,
      layout: "notes",
      composeArchetype: card.archetype,
      payload: card.payload,
      svg: card.svg,
      eyebrow: p.eyebrow,
      footer,
      caption: p.caption,
      altText: p.altText,
      candidate: {
        topic: { id: p.topicId, title: p.title, hook: p.hook },
        result: { caption: p.caption, altText: p.altText, rationale: p.rationale },
        reservationId: null as string | null,
      },
    };
  });

const input = (posts: ReturnType<typeof prepared>) => ({
  prepared: posts,
  wanted: 30,
  dates: Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`),
  context: {
    direction: J.kit.direction,
    practiceName: J.kit.practiceName,
    identityAllowList: [],
    modalities: J.kit.modalities,
    eyebrowCatalogue: J.kit.intents,
    licenceMention: J.kit.licenceMention,
    completeness: {},
  } as never,
  direction: J.kit.direction,
  practiceName: J.kit.practiceName,
  identityAllowList: [],
  intentCatalogue: J.kit.intents,
  licenceMention: J.kit.licenceMention,
  licenceStateCode: "CA",
  modalities: J.kit.modalities,
  completeness: {},
  userId: "user",
  month: "2026-11-01",
});

function ports(accept: (topicId: string) => boolean) {
  const settled: Array<[string, boolean]> = [];
  const removed: string[] = [];
  let n = 0;
  const p: AssemblePorts = {
    insert: vi.fn(async (row) => (accept(row.topicId) ? null : J.recordedInsertError)),
    remove: vi.fn(async (ids: string[]) => {
      removed.push(...ids);
    }),
    credits: {
      reserve: vi.fn(async () => ({ ok: true as const, reservationId: `res-${++n}` })),
      settle: vi.fn(async (id: string, _cost: number, ok: boolean) => {
        settled.push([id, ok]);
      }),
    },
  };
  return { ports: p, settled, removed };
}

describe("novembre 2026, sur ses comptes enregistrés : le constat nomme 28 écritures refusées par la base", () => {
  it("24 écrites, 28 refusées pour `archetype` nul (journaux Postgres) → refusé, et dit technique", () => {
    const recorded: InsertRefusal[] = Array.from({ length: 28 }, (_, i) => ({
      topic: `t${i}`,
      kind: "technical",
      code: J.recordedInsertError.code,
      message: J.recordedInsertError.message,
    }));
    const detail = shortfallDetail(24, 30, recorded, null);
    expect(detail).toBe(
      "24 posts écrits sur 30 attendus : 28 écritures refusées par la base (erreur technique — « null value in column \"archetype\" of relation \"content_items\" violates not-null constraint » ×28) ; aucune refusée pour son contenu"
    );
  });
});

describe("novembre 2026, rejoué : la base garde 24 posts, le mois est REFUSÉ (F77)", () => {
  const published = new Set(J.posts.filter((p) => p.published).map((p) => p.topicId));

  it("les données enregistrées sont celles du mois : 57 rédigés, 24 publiés", () => {
    expect(J.posts).toHaveLength(57);
    expect(published.size).toBe(24);
  });

  it("le mois n'est pas publié : un constat de compte, qui nomme les refus de la base comme techniques", async () => {
    const { ports: p, settled, removed } = ports((id) => published.has(id));
    const out = await assembleMonth(p, input(prepared()));

    /* Le contenu passait : la sélection a retenu trente posts sans constat restant. */
    expect(out.selection.remaining).toEqual([]);
    expect(out.selection.chosen).toHaveLength(30);

    /* ⚠ Ce qui était un `ok: true` à 24 posts est un refus. */
    expect(out.written).toBe(0);
    expect(out.inserted).toEqual([]);
    expect(out.shortfall?.check).toBe("count.written");
    expect(out.shortfall?.detail).toContain("19 posts écrits sur 30 attendus");
    expect(out.shortfall?.detail).toContain(
      "25 écritures refusées par la base (erreur technique — « null value in column \"archetype\" of relation \"content_items\" violates not-null constraint » ×25)"
    );
    /* ⚠ Et jamais confondus avec un refus de contenu. */
    expect(out.shortfall?.detail).toContain("aucune refusée pour son contenu");
    expect(out.inserts).toMatchObject({ technical: 25, content: 0 });

    /* L'entonnoir dit où les posts se sont perdus. */
    expect(out.funnel).toMatchObject({ arrived: 57, passedAlone: 54, selected: 30, written: 0 });

    /* Les 19 écrits sont retirés, leurs 19 réservations libérées — aucune réglée. */
    expect(removed).toHaveLength(19);
    for (const id of removed) expect(published.has(id)).toBe(true);
    expect(settled).toHaveLength(19);
    expect(settled.every(([, ok]) => ok === false)).toBe(true);
  });

  it("le portillon d'aujourd'hui écarte 3 des 5 posts que ce jour-là a écartés avant l'écriture", async () => {
    const { ports: p } = ports((id) => published.has(id));
    const out = await assembleMonth(p, input(prepared()));
    expect(out.gate.refused.map((r) => r.checks.join("+")).sort()).toEqual(["text.acronym", "text.acronym", "text.echo"]);
    /* Aucun de ces trois n'avait été publié : ils étaient dans les cinq écartés avant l'écriture. */
    const gated = new Set(out.gate.refused.map((r) => r.topic));
    for (const p of J.posts.filter((x) => gated.has(x.title))) expect(p.published).toBe(false);
  });

  it("avec des mises en page valides, les mêmes réponses font un mois de 30, sans constat de variété", async () => {
    const { ports: p } = ports(() => true);
    const out = await assembleMonth(p, input(prepared()));
    expect(out.shortfall).toBeNull();
    expect(out.written).toBe(30);
    expect(checkVariety(out.inserted.map(asMonthPost))).toEqual([]);
  });

  /*
   * ⚠ LE TROU TROUVÉ EN RÉPÉTITION (2026-10-31) : une écriture refusée, et le
   * premier du banc pris sans repasser les contrôles du mois — il a ramené
   * « You do not have to… » une seconde fois dans un mois livré.
   */
  it("après un refus d'écriture, le remplaçant garde le mois sans constat de variété", async () => {
    let first = true;
    const { ports: p } = ports(() => {
      if (first) {
        first = false;
        return false;
      }
      return true;
    });
    const out = await assembleMonth(p, input(prepared()));
    expect(out.inserts.replacements).toBe(1);
    expect(out.written).toBe(30);
    expect(checkVariety(out.inserted.map(asMonthPost))).toEqual([]);
  });
});
