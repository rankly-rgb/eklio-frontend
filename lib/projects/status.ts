import type { ProjectStatus } from "@/types/database";

/**
 * One place that knows what each project status is called and where Resume
 * should land. The dashboard badge and the Resume link both read from here, so
 * they can never drift apart.
 */

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  brief: "Draft",
  brief_complete: "Brief complete",
  directions: "Directions ready",
  kit: "Brand kit",
};

export const PROJECT_STATUS_HINT: Record<ProjectStatus, string> = {
  brief: "Pick up where you left off.",
  brief_complete: "Ready to generate three creative directions.",
  directions: "Choose a direction to build your brand kit.",
  kit: "Your brand kit is ready.",
};

/**
 * Where Resume sends the user. `brief_complete` deliberately lands on the
 * directions screen rather than the last brief step — the brief is done, the
 * next thing to do is generate.
 */
export function resumeHref(
  projectId: string,
  status: ProjectStatus,
  /** First brief step still missing a required answer, when status is `brief`. */
  firstIncompleteStepId?: string | null
): string {
  switch (status) {
    case "brief":
      return firstIncompleteStepId
        ? `/app/projects/${projectId}/brief/${firstIncompleteStepId}`
        : `/app/projects/${projectId}/brief/review`;
    case "brief_complete":
      return `/app/projects/${projectId}/directions`;
    case "directions":
      return `/app/projects/${projectId}/directions`;
    case "kit":
      return `/app/projects/${projectId}/kit`;
  }
}
