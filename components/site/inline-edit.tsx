"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { counterTone } from "@/lib/site/edit";

/*
 * L'édition EN PLACE — le geste principal de cet écran.
 *
 * Un clic sur un texte de la maquette le remplace par un champ qui hérite du
 * MÊME dessin : même police, même corps, même interligne, même couleur. C'est
 * ce qui fait qu'on édite le site et non un formulaire à côté du site. D'où le
 * `contentEditable` plutôt qu'un `<input>` : un input impose sa propre boîte,
 * sa propre ligne de base, et casse la mise en page à la première frappe sur
 * un titre de 42px qui passe sur deux lignes.
 *
 * Échap annule. Entrée ou la perte du focus valident.
 *
 * Le compteur n'apparaît qu'À L'APPROCHE de la limite — le montrer d'emblée
 * ferait compter des caractères à quelqu'un qui écrit une phrase.
 */
export function InlineEdit({
  value,
  limit,
  label,
  onCommit,
  children,
  error,
  className = "",
}: {
  value: string;
  limit: number;
  /** Nom accessible : le texte visible ne dit pas de quel champ il s'agit. */
  label: string;
  onCommit: (next: string) => void;
  children: ReactNode;
  /** Le refus de la base pour CE champ, affiché dessous. */
  error?: string | null;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [length, setLength] = useState(value.length);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editing || !box.current) return;
    box.current.textContent = value;
    setLength(value.length);
    box.current.focus();

    // Curseur en fin de texte : elle vient de cliquer pour AJUSTER, pas pour
    // tout réécrire.
    const range = document.createRange();
    range.selectNodeContents(box.current);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing, value]);

  function commit() {
    const next = (box.current?.textContent ?? "").replace(/\s+/g, " ").trim();
    setEditing(false);
    if (next !== value) onCommit(next);
  }

  if (!editing) {
    return (
      <span className={`relative ${className}`}>
        <button
          type="button"
          aria-label={`Edit ${label}`}
          onClick={() => setEditing(true)}
          className="cursor-text rounded-check text-left hover:bg-[color-mix(in_srgb,var(--s-accent)_12%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--s-accent)_12%,transparent)]"
          /* Le bouton n'impose RIEN : il hérite de tout ce que le texte
             portait, sinon le clic changerait la maquette avant l'édition. */
          style={{ font: "inherit", color: "inherit", letterSpacing: "inherit" }}
        >
          {children}
        </button>
        {error ? <FieldError>{error}</FieldError> : null}
      </span>
    );
  }

  const tone = counterTone(length, limit);

  return (
    <span className={`relative ${className}`}>
      <span
        ref={box}
        role="textbox"
        aria-label={label}
        aria-multiline="false"
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => setLength((event.currentTarget.textContent ?? "").length)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            // Annule : on repose la valeur d'origine AVANT de sortir, sinon le
            // `onBlur` qui suit validerait le brouillon qu'on vient de rejeter.
            if (box.current) box.current.textContent = value;
            setEditing(false);
          }
        }}
        className="rounded-check outline-none"
        style={{
          font: "inherit",
          color: "inherit",
          letterSpacing: "inherit",
          background: "color-mix(in srgb, var(--s-accent) 14%, transparent)",
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--s-accent) 45%, transparent)",
        }}
      />
      {tone !== "quiet" ? <Counter length={length} limit={limit} tone={tone} /> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </span>
  );
}

function Counter({
  length,
  limit,
  tone,
}: {
  length: number;
  limit: number;
  tone: "warning" | "over";
}) {
  return (
    <span
      aria-live="polite"
      className="brand-preview-static absolute -top-5 right-0 rounded-pill border border-line bg-bg px-2 py-0.5 font-mono text-mono-sm tracking-mono-hex"
      style={{ color: tone === "over" ? "var(--danger)" : "var(--warning)" }}
    >
      {`${length}/${limit}`}
    </span>
  );
}

/**
 * L'erreur, SUR le champ fautif — jamais en toast.
 *
 * Elle dit une phrase et ce qu'il faut faire (« This is 91 characters. The
 * limit is 90. »). En `--danger` sur le fond de l'application, pas sur la
 * maquette : elle appartient à l'éditeur, pas au site.
 */
function FieldError({ children }: { children: ReactNode }) {
  return (
    <span
      role="alert"
      className="brand-preview-static absolute left-0 top-full z-10 mt-1 block whitespace-normal rounded-check border border-line bg-bg px-2.5 py-1.5 font-sans text-meta font-normal leading-body text-[var(--danger)]"
      style={{ letterSpacing: "normal", minWidth: 200 }}
    >
      {children}
    </span>
  );
}
