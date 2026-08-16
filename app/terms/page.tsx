import Link from "next/link";

import { EthicsDisclaimer } from "@/components/ethics-disclaimer";

export const metadata = {
  title: "Terms — Eklio",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
          Eklio
        </Link>
        <h1 className="font-display text-3xl">Terms</h1>
      </div>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-gris-fonce">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em]">
          What Eklio is
        </h2>
        <p>
          Eklio turns a guided brief into brand and website copy for
          independent mental-health practices. Everything it produces is a draft
          for you to review, edit, and decide whether to publish.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-gris-fonce">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em]">
          Advertising ethics
        </h2>
        <p>
          Generated copy is written against a strict common baseline drawn from
          ACA and APA advertising principles: psychoeducation rather than
          outcome promises, no client testimonials, credentials stated exactly
          as you supply them, and no urgency or superlative claims. Copy that
          fails those checks is regenerated or withheld — it is never saved to
          your account.
        </p>
        <p>
          State licensing boards differ, and they change. You remain the
          professional responsible for what you publish under your license.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-gris-fonce">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em]">
          Payment
        </h2>
        <p>
          Brand kits are a one-time purchase in US dollars. Monthly Presence is
          a recurring subscription you can cancel at any time; cancelling stops
          future charges and leaves everything already delivered in your
          account.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-gris-fonce">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em]">
          Your content
        </h2>
        <p>
          Your brief answers and generated deliverables belong to you. We store
          them so you can come back to them, and we do not publish them
          anywhere on your behalf.
        </p>
      </section>

      <EthicsDisclaimer />

      <Link href="/" className="font-mono text-sm underline hover:opacity-60">
        Back to home
      </Link>
    </div>
  );
}
