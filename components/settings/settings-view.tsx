"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { TextField } from "@/components/ui/text-field";
import { signOut } from "@/lib/actions/auth";
import type { PracticeDetails } from "@/lib/site/types";

type Field = keyof PracticeDetails;

const FIELDS: Array<{ key: Field; label: string; hint?: string }> = [
  { key: "practitioner_name", label: "Your name" },
  { key: "practice_name", label: "Practice name" },
  { key: "license_label", label: "Credential", hint: "LCSW, LMFT, and so on." },
  { key: "city", label: "City" },
  { key: "state", label: "State", hint: "Two letters." },
  { key: "email", label: "Email" },
];

export function SettingsView({
  brandKitId,
  practiceDetails,
  bookingUrl,
  email,
  subscribed,
}: {
  brandKitId: string | null;
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
  email: string;
  subscribed: boolean;
}) {
  return (
    <div className="flex flex-col gap-10">
      <PracticeDetailsSection
        brandKitId={brandKitId}
        practiceDetails={practiceDetails}
        bookingUrl={bookingUrl}
      />
      <EmailPreferencesSection email={email} subscribed={subscribed} />
      <AccountActionsSection />
    </div>
  );
}

function PracticeDetailsSection({
  brandKitId,
  practiceDetails,
  bookingUrl,
}: {
  brandKitId: string | null;
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>(() => {
    const initial = {} as Record<Field, string>;
    for (const field of FIELDS) initial[field.key] = practiceDetails?.[field.key] ?? "";
    return initial;
  });
  const [booking, setBooking] = useState(bookingUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!brandKitId || !practiceDetails) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader title="Practice details" />
        <p className="max-w-[560px] text-helper leading-prose text-ink-2">
          These appear here once you have a brand kit — they feed your signature and your handoff
          note, and you can also edit them from the site editor.
        </p>
      </section>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/site-spec`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice_details: values,
          hero: { cta_target_url: booking },
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("That didn't go through. Your previous values are unchanged.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Practice details" />
      <p className="max-w-[560px] text-helper leading-prose text-ink-2">
        The name, credential and location on your signature and your handoff note.
      </p>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {FIELDS.map((field) => (
          <TextField
            key={field.key}
            id={`practice-${field.key}`}
            label={field.label}
            hint={field.hint}
            value={values[field.key]}
            maxLength={field.key === "state" ? 2 : undefined}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.key]: event.target.value }))
            }
          />
        ))}
        <TextField
          id="practice-booking-url"
          label="Booking URL"
          className="col-span-2 max-md:col-span-1"
          value={booking}
          onChange={(event) => setBooking(event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper text-ink">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button variant="primary" className="self-start" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved ? <span className="text-ui text-ink-2">Saved</span> : null}
      </div>
    </section>
  );
}

function EmailPreferencesSection({
  email,
  subscribed,
}: {
  email: string;
  subscribed: boolean;
}) {
  const [current, setCurrent] = useState(subscribed);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !current;
    setSaving(true);
    setCurrent(next);
    try {
      await fetch("/api/settings/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscribed: next }),
      });
    } catch {
      setCurrent(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Email preferences" />
      <p className="max-w-[560px] text-helper leading-prose text-ink-2">{email}</p>
      <label className="flex max-w-[420px] items-center justify-between gap-4 rounded-card border border-line p-4">
        <span className="text-ui text-ink">Emails about your brief, directions, and monthly content</span>
        <input
          type="checkbox"
          checked={current}
          disabled={saving}
          onChange={toggle}
          className="size-4"
        />
      </label>
    </section>
  );
}

function AccountActionsSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Account" />
      <form action={signOut}>
        <Button variant="secondary" type="submit" className="self-start">
          Sign out
        </Button>
      </form>
    </section>
  );
}
