import { redirect } from "next/navigation";

import { loadBriefAnswers } from "@/lib/actions/brief";
import { firstIncompleteStep } from "@/lib/brief/steps";

/** Bare /brief lands on the first step still missing a required answer. */
export default async function BriefIndex(
  props: PageProps<"/app/projects/[id]/brief">
) {
  const { id } = await props.params;
  const answers = await loadBriefAnswers(id);
  const next = firstIncompleteStep(answers);

  redirect(
    next
      ? `/app/projects/${id}/brief/${next}`
      : `/app/projects/${id}/brief/review`
  );
}
