"use client";

import type { ReactNode } from "react";
import { fieldItems, fieldText } from "@/lib/site/mockup";
import { CTA_LABEL_FLOOR_PX, CTA_LABEL_FLOOR_WEIGHT } from "@/lib/site/tokens";
import type { PreviewSection } from "@/lib/site/types";

/*
 * Une section de la maquette.
 *
 * Elle rend les `fields` que la base a mis dedans, et rien d'autre. Un type de
 * section inconnu — la base en ajoute — n'est pas ignoré : il tombe sur le
 * gabarit générique « titre, paragraphe, liste », qui couvre neuf des onze
 * types et ne fait disparaître aucune copy.
 *
 * LA RÈGLE DES COULEURS, appliquée ligne par ligne :
 *   titre de section  → `--s-primary-text`   (du texte)
 *   surtitre          → `--s-secondary-text` (du texte)
 *   corps             → `--s-dark`           (l'encre, qui ne bouge jamais)
 *   filet sous titre  → `--s-accent`         (un aplat)
 *   bouton            → fond `--s-primary`, libellé `--s-cta-ink`
 */

/** Les sections rendues sur une bande teintée plutôt que sur la page. */
const TINTED = new Set(["intro", "specialties", "credentials", "fees", "footer"]);

export function MockupSection({
  section,
  editable,
}: {
  section: PreviewSection;
  /** Enveloppe chaque texte — l'édition en place arrive au lot 5. */
  editable?: (node: ReactNode, field: string, value: string) => ReactNode;
}) {
  const wrap =
    editable ?? ((node: ReactNode) => node);
  const tinted = TINTED.has(section.type);

  return (
    <section
      data-section-key={section.key}
      data-section-type={section.type}
      style={{
        background: tinted ? "var(--s-light)" : "var(--s-paper)",
        padding: section.type === "footer" ? "26px 44px" : "40px 44px",
      }}
    >
      {section.type === "hero" ? (
        <Hero section={section} wrap={wrap} />
      ) : section.type === "intro" ? (
        <Intro section={section} wrap={wrap} />
      ) : section.type === "footer" ? (
        <Footer section={section} wrap={wrap} />
      ) : (
        <Block section={section} wrap={wrap} />
      )}
    </section>
  );
}

type Wrap = (node: ReactNode, field: string, value: string) => ReactNode;

function Heading({
  children,
  field,
  value,
  wrap,
}: {
  children: ReactNode;
  field: string;
  value: string;
  wrap: Wrap;
}) {
  return (
    <h3
      style={{
        fontFamily: "var(--s-heading)",
        fontWeight: 600,
        fontSize: 22,
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
        color: "var(--s-primary-text)",
      }}
    >
      {wrap(children, field, value)}
    </h3>
  );
}

/** Le filet sous un titre : un APLAT, donc la couleur d'accent elle-même. */
function AccentRule() {
  return (
    <div
      aria-hidden="true"
      className="mt-2.5 h-[2px] w-9 rounded-pill"
      style={{ background: "var(--s-accent)" }}
    />
  );
}

function Body({
  text,
  field,
  wrap,
  size = 15,
  max = 560,
}: {
  text: string;
  field: string;
  wrap: Wrap;
  size?: number;
  max?: number;
}) {
  return (
    <p
      style={{
        fontFamily: "var(--s-body)",
        fontSize: size,
        lineHeight: 1.65,
        color: "var(--s-dark)",
        maxWidth: max,
      }}
    >
      {wrap(text, field, text)}
    </p>
  );
}

function Hero({ section, wrap }: { section: PreviewSection; wrap: Wrap }) {
  const overline = fieldText(section.fields, "overline");
  const headline = fieldText(section.fields, "headline") ?? "";
  const subhead = fieldText(section.fields, "subhead");
  const ctaLabel = fieldText(section.fields, "cta_label");

  return (
    <div className="py-4">
      {overline ? (
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 11,
            letterSpacing: "var(--tracking-mono-18)",
            color: "var(--s-secondary-text)",
          }}
        >
          {wrap(overline, "hero.overline", overline)}
        </div>
      ) : null}

      <h2
        className="text-pretty"
        style={{
          fontFamily: "var(--s-heading)",
          fontWeight: 500,
          fontSize: 42,
          lineHeight: 1.06,
          letterSpacing: "-0.02em",
          color: "var(--s-dark)",
          marginTop: overline ? 16 : 0,
        }}
      >
        {wrap(headline, "hero.headline", headline)}
      </h2>

      {subhead ? (
        <p
          className="mt-3.5"
          style={{
            fontFamily: "var(--s-body)",
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--s-dark)",
            maxWidth: 460,
            opacity: 0.86,
          }}
        >
          {wrap(subhead, "hero.subhead", subhead)}
        </p>
      ) : null}

      {ctaLabel ? (
        <div
          className="mt-7 inline-flex items-center rounded-pill"
          style={{
            /*
             * 18px gras : le PLANCHER du contrat, pas une taille choisie. Les
             * deux couleurs du bouton ont été vérifiées pour du texte à cette
             * taille ; en dessous, la même paire cesse d'être lisible. Un
             * aperçu plus petit montrerait ce qu'elle n'a pas le droit de
             * reproduire.
             */
            fontFamily: "var(--s-body)",
            fontWeight: CTA_LABEL_FLOOR_WEIGHT,
            fontSize: CTA_LABEL_FLOOR_PX,
            height: 52,
            paddingInline: 28,
            background: "var(--s-primary)",
            color: "var(--s-cta-ink)",
          }}
        >
          {wrap(ctaLabel, "hero.cta_label", ctaLabel)}
        </div>
      ) : null}
    </div>
  );
}

/*
 * L'introduction. Elle est autorisée sur DEUX pages et lit UN champ
 * (`spec.about_excerpt`) : le même paragraphe s'affiche sur Home et sur About
 * parce qu'il n'y a qu'une valeur, rendue deux fois. Ce n'est pas une
 * limitation à contourner, c'est le dessin.
 */
function Intro({ section, wrap }: { section: PreviewSection; wrap: Wrap }) {
  const body = fieldText(section.fields, "body");
  if (!body) return null;

  return (
    <p
      style={{
        fontFamily: "var(--s-body)",
        fontSize: 17,
        lineHeight: 1.7,
        color: "var(--s-dark)",
        maxWidth: 620,
      }}
    >
      {wrap(body, "about_excerpt", body)}
    </p>
  );
}

function Footer({ section, wrap }: { section: PreviewSection; wrap: Wrap }) {
  const body = fieldText(section.fields, "body");
  if (!body) return null;

  return (
    <p
      style={{
        fontFamily: "var(--s-body)",
        fontSize: 13,
        lineHeight: 1.6,
        color: "var(--s-dark)",
        opacity: 0.7,
      }}
    >
      {wrap(body, `pages.${section.key}.body`, body)}
    </p>
  );
}

/** Le gabarit générique : titre, filet, paragraphe, liste. */
function Block({ section, wrap }: { section: PreviewSection; wrap: Wrap }) {
  const heading = fieldText(section.fields, "heading");
  const body = fieldText(section.fields, "body");
  const items = fieldItems(section.fields, "items");
  const asChips = section.type === "specialties";

  return (
    <div>
      {heading ? (
        <>
          <Heading field={`${section.key}.heading`} value={heading} wrap={wrap}>
            {heading}
          </Heading>
          <AccentRule />
        </>
      ) : null}

      {body ? (
        <div className="mt-4">
          <Body text={body} field={`${section.key}.body`} wrap={wrap} />
        </div>
      ) : null}

      {items.length > 0 ? (
        asChips ? (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {items.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="inline-flex items-center rounded-pill"
                style={{
                  fontFamily: "var(--s-body)",
                  fontSize: 13,
                  fontWeight: 600,
                  height: 32,
                  paddingInline: 16,
                  /* Une pastille est un APLAT : bordure en couleur de marque,
                     texte en variante. */
                  border: "1px solid var(--s-secondary)",
                  color: "var(--s-primary-text)",
                }}
              >
                {wrap(item, `${section.key}.items.${index}`, item)}
              </span>
            ))}
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {items.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex items-baseline gap-3"
                style={{
                  fontFamily: "var(--s-body)",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "var(--s-dark)",
                  maxWidth: 620,
                }}
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 flex-none rounded-pill"
                  style={{ background: "var(--s-accent)" }}
                />
                <span>{wrap(item, `${section.key}.items.${index}`, item)}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
