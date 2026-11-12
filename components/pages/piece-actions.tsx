"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyBlockRow, CopyButton } from "@/components/site/copy-chip";

/*
 * Les gestes de la praticienne sur une pièce. Chacun appelle
 * `POST /api/seo-pieces/[id]` ; la base décide (RLS, transitions, garde
 * éthique), l'écran se rafraîchit ensuite.
 */

type Finding = { check: string; detail: string };

async function post(id: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; findings?: Finding[]; filename?: string; content?: string }> {
  const res = await fetch(`/api/seo-pieces/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; findings?: Finding[]; filename?: string; content?: string };
  return { ok: res.ok, ...data };
}

function Problems({ error, findings }: { error: string | null; findings: Finding[] }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-card border border-line bg-card p-4 text-helper leading-prose text-ink">
      <p>{error}</p>
      {findings.length > 0 ? (
        <ul className="mt-2 ml-5 list-disc text-ink-2">
          {findings.map((f, i) => (
            <li key={i}>{f.detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── Relire, modifier, approuver ──────────────────────────────────────── */

export function ReviewPanel({ id, body }: { id: string; body: string }) {
  const router = useRouter();
  const [reviewed, setReviewed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  async function run(payload: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    setFindings([]);
    const r = await post(id, payload);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "That did not go through.");
      setFindings(r.findings ?? []);
      return;
    }
    after?.();
    router.refresh();
  }

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-4 rounded-card border border-line p-6">
      <h2 id="review-heading" className="font-display text-h3 font-medium text-ink">
        Read it as its author
      </h2>
      <p className="text-helper leading-prose text-ink-2">
        This page goes out under your name and license. Read all of it. Change anything that does not
        sound like you or does not match how you work. The text, the title and the description can be
        copied once you confirm.
      </p>

      {editing ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="body-editor" className="text-helper text-ink-2">
            The text of the page (Markdown: <code>##</code> for a heading, <code>-</code> for a list)
          </label>
          <textarea
            id="body-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={24}
            className="w-full rounded-card border border-line bg-bg p-4 font-mono text-mono leading-body text-ink"
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={() => run({ action: "edit", body_md: draft }, () => setEditing(false))}>
              Save changes
            </Button>
            <Button type="button" variant="tertiary" disabled={busy} onClick={() => { setDraft(body); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" className="self-start" onClick={() => setEditing(true)}>
          Edit the text
        </Button>
      )}

      <Problems error={error} findings={findings} />

      <label className="flex items-start gap-3 text-body text-ink">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
          className="mt-1 size-4 accent-[var(--ink)]"
        />
        <span>I have read this page as its author, and it says what I mean.</span>
      </label>
      <Button
        type="button"
        className="self-start"
        disabled={!reviewed || busy || editing}
        onClick={() => run({ action: "approve", reviewed: true })}
      >
        Confirm my review
      </Button>
    </section>
  );
}

/* ── Copier, exporter ─────────────────────────────────────────────────── */

export type CopyBlocks = {
  title: string;
  meta: string;
  slug: string;
  body: string;
  faq: string;
  jsonLd: string;
};

export function CopyPanel({ id, blocks, markExported }: { id: string; blocks: CopyBlocks; markExported: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function marked() {
    if (!markExported) return;
    const r = await post(id, { action: "export", format: "copy" });
    if (r.ok) router.refresh();
  }

  async function download(format: "markdown" | "html") {
    setError(null);
    const r = await post(id, { action: "export", format });
    if (!r.ok || !r.content || !r.filename) {
      setError(r.error ?? "The file could not be prepared.");
      return;
    }
    const url = URL.createObjectURL(new Blob([r.content], { type: format === "html" ? "text/html" : "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename;
    a.click();
    URL.revokeObjectURL(url);
    if (markExported) router.refresh();
  }

  return (
    <section aria-labelledby="copy-heading" className="flex flex-col gap-4 rounded-card border border-line p-6">
      <h2 id="copy-heading" className="font-display text-h3 font-medium text-ink">
        Copy it to your site
      </h2>
      <div>
        <CopyBlockRow label="Page title" text={blocks.title} onCopied={marked} />
        <CopyBlockRow label="Description" text={blocks.meta} onCopied={marked} />
        <CopyBlockRow label="Address" text={`/${blocks.slug}`} onCopied={marked} />
      </div>
      <div className="flex flex-wrap gap-3">
        <CopyButton text={blocks.body} onCopied={marked}>Copy the text</CopyButton>
        <CopyButton text={blocks.faq} onCopied={marked} variant="secondary">Copy the questions</CopyButton>
        <CopyButton text={blocks.jsonLd} onCopied={marked} variant="secondary">Copy the structured data</CopyButton>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => download("markdown")}>
          Download Markdown
        </Button>
        <Button type="button" variant="secondary" onClick={() => download("html")}>
          Download HTML
        </Button>
      </div>
      <p className="text-meta leading-body text-ink-3">
        The structured data helps search engines and AI assistants read the page and its questions. Paste it
        where your site builder accepts code for the page head.
      </p>
      {error ? (
        <p role="alert" className="text-helper text-ink">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/* ── Déclarer où elle l'a publiée ─────────────────────────────────────── */

export function PublishForm({ id, current, primary = true }: { id: string; current: string | null; primary?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await post(id, { action: "publish", url });
        setBusy(false);
        if (!r.ok) setError(r.error ?? "That address could not be saved.");
        else router.refresh();
      }}
    >
      <label htmlFor="published-url" className="text-body font-medium text-ink">
        Where did you publish it?
      </label>
      <p className="text-helper leading-prose text-ink-2">
        Paste the address of the page on your site. Your next pages will link to it.
      </p>
      <input
        id="published-url"
        type="url"
        inputMode="url"
        placeholder="https://yoursite.com/emdr-therapy"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full max-w-[520px] rounded-card border border-line bg-bg px-4 py-3 text-body text-ink"
      />
      <Button type="submit" variant={primary ? "primary" : "secondary"} className="self-start" disabled={busy || url.trim() === ""}>
        {current ? "Update the address" : "Mark as published"}
      </Button>
      {error ? (
        <p role="alert" className="text-helper text-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}
