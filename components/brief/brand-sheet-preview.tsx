import {
  BRIEF_STEPS,
  optionLabel,
  optionLabels,
  optionSwatch,
  type BriefAnswers,
} from "@/lib/brief/steps";

/**
 * A live read of the brief, shown on the recap screen so the practitioner can
 * see the shape of what they have described before anything is generated.
 *
 * This is a preview, not a deliverable — no generated copy appears here, so it
 * needs no ethics disclaimer.
 */
export function BrandSheetPreview({ answers }: { answers: BriefAnswers }) {
  const practice = answers.practice ?? {};
  const positioning = answers.positioning ?? {};
  const ideal = answers.ideal_client ?? {};
  const voice = answers.voice ?? {};
  const palette = answers.palette ?? {};
  const typography = answers.typography ?? {};
  const website = answers.website ?? {};

  const licenseValue = str(practice.licenseType);
  const license =
    licenseValue === "other"
      ? str(practice.licenseTypeOther) || "Other"
      : licenseValue
        ? optionLabel("licenseType", licenseValue)
        : "—";

  const colorFamilies = arr(palette.colorFamilies);
  const sliderField = BRIEF_STEPS.find((s) => s.id === "voice")?.fields.find(
    (f) => f.kind === "sliders"
  );
  const sliderValues = numbers(voice.toneSliders);

  return (
    <section className="rounded-lg border border-noir/15 bg-cream-light p-6 md:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
        Brand sheet — preview
      </p>

      <h2 className="mt-3 font-display text-3xl leading-tight">
        {str(practice.practiceName) || "Your practice"}
      </h2>
      <p className="mt-1 font-mono text-sm text-gris-fonce">
        {license}
        {arr(practice.specialties).length > 0 && (
          <> · {optionLabels("specialties", practice.specialties).join(" · ")}</>
        )}
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Block label="Who you help">{str(ideal.idealClient)}</Block>
        <Block label="The situation">{str(positioning.problem)}</Block>
        <Block label="Direction of the work">{str(positioning.clientGain)}</Block>
        <Block label="What sets you apart">{str(positioning.differentiator)}</Block>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <Label>Feelings to convey</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {optionLabels("feelings", voice.feelings).map((label) => (
              <span
                key={label}
                className="rounded-full border border-noir/25 px-3 py-1 font-mono text-xs"
              >
                {label}
              </span>
            ))}
            {optionLabels("feelings", voice.feelings).length === 0 && (
              <Empty />
            )}
          </div>
        </div>

        <div>
          <Label>Color families</Label>
          <div className="mt-2 flex flex-wrap gap-3">
            {colorFamilies.map((value) => (
              <span key={value} className="flex flex-col gap-1">
                <span
                  aria-hidden="true"
                  className="block h-10 w-16 rounded border border-noir/10"
                  style={{ backgroundColor: optionSwatch("colorFamilies", value) }}
                />
                <span className="font-mono text-[0.65rem] text-gris-fonce">
                  {optionLabel("colorFamilies", value)}
                </span>
              </span>
            ))}
            {colorFamilies.length === 0 && <Empty />}
          </div>
        </div>
      </div>

      {sliderField?.kind === "sliders" && (
        <div className="mt-8">
          <Label>Register</Label>
          <div className="mt-3 flex flex-col gap-3">
            {sliderField.sliders.map((slider) => {
              const value = sliderValues[slider.name] ?? 50;
              return (
                <div key={slider.name} className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[0.65rem] uppercase tracking-[0.15em] text-gris-fonce">
                    <span>{slider.leftLabel}</span>
                    <span>{slider.rightLabel}</span>
                  </div>
                  <div className="relative h-[2px] w-full bg-noir/15">
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-noir"
                      style={{ left: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Block label="Type style">
          {optionLabels("typeStyle", typography.typeStyle).join(", ")}
          {str(typography.characterLevel) &&
            ` · ${optionLabel("characterLevel", str(typography.characterLevel))}`}
        </Block>
        <Block label="Site goal">
          {str(website.siteGoal)
            ? optionLabel("siteGoal", str(website.siteGoal))
            : ""}
          {str(website.primaryAction) && ` · “${str(website.primaryAction)}”`}
        </Block>
        <Block label="Pages">
          {optionLabels("pages", website.pages).join(" · ")}
        </Block>
        <Block label="Proof you can show">
          {optionLabels("proof", website.proof).join(" · ")}
        </Block>
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
      {children}
    </span>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const hasContent = typeof children === "string" ? children.trim() : children;
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {hasContent ? (
        <p className="text-sm leading-relaxed">{children}</p>
      ) : (
        <Empty />
      )}
    </div>
  );
}

function Empty() {
  return <span className="font-mono text-xs text-gris-fonce/60">Not yet answered</span>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function arr(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function numbers(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number"
    )
  );
}
