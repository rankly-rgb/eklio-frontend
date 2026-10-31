import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { composeCard } from "@/lib/content/month/compose-card";
import { assembleMonth, type AssemblePorts } from "@/lib/content/month/assemble";
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
 * ⚠ 30 ET NON 28, ET POURQUOI. Le portillon d'aujourd'hui écarte 3 posts (deux
 * sigles, un écho) ; le juge de complétude de ce jour-là en a écarté 2 de plus,
 * et ses verdicts ne sont journalisés nulle part (F78). 54 écritures sont donc
 * tentées au lieu de 52, et 30 refusées au lieu de 28 — les 28 enregistrées en
 * font partie. Le test fige ce que le rejeu reproduit, pas un chiffre arrangé.
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
const prepared = () =>
  J.posts.map((p, i) => {
    const card = composeCard({
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
    expect(out.shortfall?.detail).toContain("24 posts écrits sur 30 attendus");
    expect(out.shortfall?.detail).toContain(
      "30 écritures refusées par la base (erreur technique — « null value in column \"archetype\" of relation \"content_items\" violates not-null constraint » ×30)"
    );
    /* ⚠ Et jamais confondus avec un refus de contenu. */
    expect(out.shortfall?.detail).toContain("aucune refusée pour son contenu");
    expect(out.inserts).toMatchObject({ technical: 30, content: 0, attempted: 54 });

    /* L'entonnoir dit où les posts se sont perdus. */
    expect(out.funnel).toEqual({ arrived: 57, passedAlone: 54, selected: 30, attempted: 54, written: 0 });

    /* Les 24 écrits sont retirés, leurs 24 réservations libérées — aucune réglée. */
    expect(new Set(removed)).toEqual(published);
    expect(settled).toHaveLength(24);
    expect(settled.every(([, ok]) => ok === false)).toBe(true);
  });

  it("les 28 refus enregistrés sont dans les 30 du rejeu : le portillon d'aujourd'hui en écarte 3 sur les 5 de ce jour-là", async () => {
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
});
