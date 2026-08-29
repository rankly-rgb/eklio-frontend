"use client";

import type { ClampedField } from "@/lib/site/seed-clamped";

/*
 * La note de `seed_clamped` — discrète, posée SUR le champ concerné.
 *
 * ⚠ PAS DE BOUTON « RESTAURER ». L'original est au-dessus de la limite : c'est
 * pour ça qu'il a été coupé. Le réenregistrer échouerait avec `too_long` à tous
 * les coups. La note montre ce qui a été retiré et invite à réécrire — elle
 * n'offre pas un geste qui ne peut pas marcher.
 *
 * Elle se dissipe seule : écrire le champ retire son entrée, et seulement la
 * sienne.
 */
export function ClampNote({ field }: { field: ClampedField }) {
  return (
    <div className="rounded-check border-l border-line bg-card p-2.5">
      <p className="text-meta leading-body text-ink-2">
        {`We shortened this to fit — ${field.note.original_length} characters down to ${field.note.clamped_length}.`}
      </p>
      {field.original ? (
        <p className="mt-1.5 text-meta italic leading-body text-ink-3">
          &ldquo;{field.original}&rdquo;
        </p>
      ) : null}
      <p className="mt-1.5 text-meta leading-body text-ink-2">
        Rewrite it shorter if the cut lost something.
      </p>
    </div>
  );
}
