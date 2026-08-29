"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { RailSection } from "@/components/site/rail-section";
import {
  addSection,
  addableSectionTypes,
  moveSection,
  removeSection,
  reorderSection,
  sectionLabel,
  sortSections,
  toggleSection,
  togglePage,
} from "@/lib/site/pages";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { SiteCatalog, SpecPage } from "@/lib/site/types";

/*
 * Pages et sections.
 *
 * Un interrupteur par page, une liste triable par section, et un sélecteur
 * d'ajout filtré par `allowed_pages` — une section posée hors de ses pages
 * autorisées est refusée par la base, et le refus arriverait sur un contrôle
 * qui n'a rien fait de mal.
 *
 * DÉSACTIVÉ N'EST PAS SUPPRIMÉ. Une section éteinte reste à sa place, en
 * grisé, avec sa copy : c'est la seule façon de la rallumer sans la
 * réécrire. Elle disparaît de `preview` et de la sortie, et son `order`
 * reste — d'où les trous, qui sont normaux.
 *
 * TOUT GLISSER A SON ÉQUIVALENT CLAVIER : les deux boutons « ↑ » et « ↓ » de
 * chaque ligne font exactement ce que le glisser fait.
 */
export function PagesSection({
  editor,
  catalog,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
}) {
  const { pages } = editor.envelope.spec;

  return (
    <RailSection
      id="site-pages"
      title="Pages &amp; sections"
      hint="Switch off what you don't need. Nothing is deleted."
    >
      <div className="flex flex-col gap-5">
        {pages.map((page) => (
          <PageBlock
            key={page.key}
            page={page}
            catalog={catalog}
            editor={editor}
          />
        ))}
      </div>
    </RailSection>
  );
}

function PageBlock({
  page,
  catalog,
  editor,
}: {
  page: SpecPage;
  catalog: SiteCatalog;
  editor: SiteEditorState;
}) {
  const { pages } = editor.envelope.spec;
  const [dragging, setDragging] = useState<string | null>(null);
  const sections = sortSections(page.sections);
  const addable = addableSectionTypes(catalog, page);

  return (
    <div className={page.enabled ? "" : "opacity-60"}>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2.5">
          <input
            type="checkbox"
            checked={page.enabled}
            onChange={(event) =>
              editor.commit({ pages: togglePage(pages, page.key, event.target.checked) })
            }
            className="size-4 accent-[var(--accent)]"
          />
          <span className="text-ui font-medium text-ink">{page.label}</span>
        </label>
        <MonoLabel tracking="14" tone="ink-3">
          {`${sections.filter((section) => section.enabled).length} on`}
        </MonoLabel>
      </div>

      <ul className="mt-2.5 flex flex-col gap-1">
        {sections.map((section, index) => (
          <li
            key={section.key}
            draggable
            onDragStart={(event) => {
              setDragging(section.key);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", section.key);
            }}
            onDragEnd={() => setDragging(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const from = event.dataTransfer.getData("text/plain");
              setDragging(null);
              if (from && from !== section.key) {
                editor.commit({
                  pages: reorderSection(pages, page.key, from, section.key),
                });
              }
            }}
            className={`flex items-center gap-2 rounded-check border border-transparent py-1 pl-1 pr-0.5 hover:border-line ${
              dragging === section.key ? "opacity-50" : ""
            } ${section.enabled ? "" : "opacity-55"}`}
          >
            <span aria-hidden="true" className="cursor-grab select-none text-ink-3">
              ⠿
            </span>

            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={section.enabled}
                onChange={(event) =>
                  editor.commit({
                    pages: toggleSection(
                      pages,
                      page.key,
                      section.key,
                      event.target.checked
                    ),
                  })
                }
                className="size-3.5 accent-[var(--accent)]"
              />
              <span
                className={`truncate text-meta ${
                  section.enabled ? "text-ink" : "text-ink-3 line-through decoration-[var(--ink-3)]"
                }`}
              >
                {sectionLabel(catalog, section)}
              </span>
            </label>

            {/* L'équivalent clavier du glisser. */}
            <button
              type="button"
              aria-label={`Move ${sectionLabel(catalog, section)} up`}
              disabled={index === 0}
              onClick={() =>
                editor.commit({
                  pages: moveSection(pages, page.key, section.key, -1),
                })
              }
              className="size-6 flex-none rounded-check text-ink-2 hover:bg-card disabled:opacity-25"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${sectionLabel(catalog, section)} down`}
              disabled={index === sections.length - 1}
              onClick={() =>
                editor.commit({
                  pages: moveSection(pages, page.key, section.key, 1),
                })
              }
              className="size-6 flex-none rounded-check text-ink-2 hover:bg-card disabled:opacity-25"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Remove ${sectionLabel(catalog, section)}`}
              onClick={() =>
                editor.commit({
                  pages: removeSection(pages, page.key, section.key),
                })
              }
              className="size-6 flex-none rounded-check text-ink-3 hover:bg-card hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {addable.length > 0 ? (
        <label className="mt-2 flex items-center gap-2">
          <span className="sr-only">{`Add a section to ${page.label}`}</span>
          <select
            value=""
            onChange={(event) => {
              const type = addable.find((entry) => entry.type === event.target.value);
              if (type) editor.commit({ pages: addSection(pages, page.key, type) });
            }}
            className="w-full rounded-check border border-line bg-bg px-2 py-1 text-meta text-ink-2"
          >
            <option value="">Add a section…</option>
            {addable.map((type) => (
              <option key={type.type} value={type.type}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
