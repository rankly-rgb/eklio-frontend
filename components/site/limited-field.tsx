"use client";

import { useId, useState, type ReactNode } from "react";
import { counterTone } from "@/lib/site/edit";

/*
 * Un champ du rail, avec sa limite.
 *
 * La limite est AFFICHÉE, jamais imposée : pas de `maxLength`. Un champ qui
 * refuse la 91e frappe fait croire au clavier cassé ; un compteur qui passe en
 * ambre dit ce qui se passe et laisse finir la phrase. Le refus, s'il vient,
 * vient de la base, avec sa propre phrase.
 *
 * L'écriture part à la SORTIE du champ ou après 600 ms de calme (`edit`), pas
 * à chaque frappe : c'est ce qui rend l'autosave invisible.
 */
export function LimitedField({
  label,
  hint,
  value,
  limit,
  multiline = false,
  error,
  note,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  limit: number;
  multiline?: boolean;
  error?: string | null;
  /** La note de `seed_clamped`, quand ce champ en porte une. */
  note?: ReactNode;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [confirmed, setConfirmed] = useState(value);

  /*
   * La valeur confirmée reprend la main quand elle change AILLEURS — une
   * annulation, une remise à zéro, une édition en place sur le même champ.
   * Sans ça, le rail garderait le texte d'avant l'annulation.
   *
   * L'ajustement se fait PENDANT LE RENDU, pas dans un effet : c'est le motif
   * documenté par React pour un état dérivé d'une prop. Un effet ferait un
   * rendu de plus, visible, à chaque réponse du serveur.
   */
  if (confirmed !== value) {
    setConfirmed(value);
    setDraft(value);
  }

  const tone = counterTone(draft.length, limit);
  const Control = multiline ? "textarea" : "input";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-3">
        <label htmlFor={id} className="flex-1 text-meta font-medium text-ink">
          {label}
        </label>
        <span
          className="flex-none font-mono text-mono-sm tracking-mono-hex"
          style={{
            color:
              tone === "over"
                ? "var(--danger)"
                : tone === "warning"
                  ? "var(--warning)"
                  : "var(--ink-3)",
          }}
        >
          {`${draft.length}/${limit}`}
        </span>
      </div>

      {hint ? <p className="text-meta leading-body text-ink-2">{hint}</p> : null}

      <Control
        id={id}
        value={draft}
        rows={multiline ? 4 : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event: { target: { value: string } }) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
        className="w-full rounded-card border border-line bg-bg px-3 py-2 text-ui leading-body text-ink placeholder:text-ink-3"
      />

      {note}

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="border-l border-[var(--danger)] pl-3 text-meta leading-body text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
