import { describe, expect, it } from "vitest";
import {
  EMPTY_CLINICIAN_DRAFT,
  STEP_COUNT,
  STEPS,
  resumeStep,
  stepIssue,
  type ClinicianStepDraft,
} from "@/lib/tenancy/clinician-brief/flow";

function draft(overrides: Partial<ClinicianStepDraft> = {}): ClinicianStepDraft {
  return { ...EMPTY_CLINICIAN_DRAFT, ...overrides };
}

describe("STEPS", () => {
  it("holds exactly 7 screens, numbered 1 through 7 in order", () => {
    expect(STEPS).toHaveLength(STEP_COUNT);
    STEPS.forEach((step, index) => expect(step.number).toBe(index + 1));
  });

  it("keeps populations and modalities as two separate screens", () => {
    const ids = STEPS.map((s) => s.id);
    expect(ids).toContain("modalities");
    expect(ids).toContain("populations");
    expect(ids.indexOf("modalities")).not.toBe(ids.indexOf("populations"));
  });

  it("marks only practicalities as optional", () => {
    const optional = STEPS.filter((s) => s.optional).map((s) => s.id);
    expect(optional).toEqual(["practicalities"]);
  });
});

describe("stepIssue — identity", () => {
  it("requires a name", () => {
    expect(stepIssue("identity", draft({ credentials: "LPC" }), true)).toBeTruthy();
  });

  it("requires credentials", () => {
    expect(stepIssue("identity", draft({ fullName: "Jane Doe" }), true)).toBeTruthy();
  });

  it("passes for a licensed clinician with a name and credentials", () => {
    expect(
      stepIssue("identity", draft({ fullName: "Jane Doe", credentials: "LPC" }), true)
    ).toBeNull();
  });

  it("requires a supervisor for a supervised_intern when the org has no default", () => {
    const d = draft({
      fullName: "Jane Doe",
      credentials: "Intern",
      status: "supervised_intern",
    });
    expect(stepIssue("identity", d, false)).toBeTruthy();
    expect(stepIssue("identity", d, true)).toBeNull();
  });

  it("passes a supervised_intern who names her own supervisor even with no org default", () => {
    const d = draft({
      fullName: "Jane Doe",
      credentials: "Intern",
      status: "supervised_intern",
      supervisorName: "Dr. Smith",
    });
    expect(stepIssue("identity", d, false)).toBeNull();
  });
});

describe("stepIssue — the rest", () => {
  it("requires at least one licensed state", () => {
    expect(stepIssue("licensed_states", draft(), true)).toBeTruthy();
    expect(stepIssue("licensed_states", draft({ stateCodes: ["OR"] }), true)).toBeNull();
  });

  it("requires at least one modality", () => {
    expect(stepIssue("modalities", draft(), true)).toBeTruthy();
    expect(
      stepIssue(
        "modalities",
        draft({ modalities: [{ modalityId: "emdr", prominence: null }] }),
        true
      )
    ).toBeNull();
  });

  it("requires at least one population, independently of modalities", () => {
    expect(stepIssue("populations", draft(), true)).toBeTruthy();
    expect(stepIssue("populations", draft({ populationIds: ["couples"] }), true)).toBeNull();
  });

  it("requires a philosophy quote", () => {
    expect(stepIssue("philosophy", draft(), true)).toBeTruthy();
    expect(
      stepIssue("philosophy", draft({ philosophyQuote: "I work collaboratively." }), true)
    ).toBeNull();
  });

  it("never blocks on practicalities — it is optional", () => {
    expect(stepIssue("practicalities", draft(), true)).toBeNull();
  });

  it("never blocks on review", () => {
    expect(stepIssue("review", draft(), true)).toBeNull();
  });
});

describe("resumeStep", () => {
  it("resumes at the first screen for a brand-new draft", () => {
    expect(resumeStep(draft(), true)).toBe(1);
  });

  it("resumes past identity once it's answered", () => {
    const d = draft({ fullName: "Jane Doe", credentials: "LPC" });
    expect(resumeStep(d, true)).toBe(2);
  });

  it("resumes at review once every prior screen passes", () => {
    const d = draft({
      fullName: "Jane Doe",
      credentials: "LPC",
      stateCodes: ["OR"],
      modalities: [{ modalityId: "emdr", prominence: null }],
      populationIds: ["couples"],
      philosophyQuote: "I work collaboratively.",
    });
    expect(resumeStep(d, true)).toBe(STEP_COUNT);
  });
});
