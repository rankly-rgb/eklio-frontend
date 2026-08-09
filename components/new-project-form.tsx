"use client";

import { useActionState, useState } from "react";
import { createProject, type ProjectFormState } from "@/app/app/actions";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";

export function NewProjectForm() {
  const [name, setName] = useState("");
  const [state, formAction, isPending] = useActionState<
    ProjectFormState,
    FormData
  >(createProject, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* useActionState soumet le FormData : on garde un input nommé. */}
      <input type="hidden" name="name" value={name} />
      <TextInput
        id="project-name"
        label="Nom du projet"
        help="Le nom de votre activité, ou un nom de travail."
        required
        value={name}
        onChange={setName}
        error={state?.error}
      />
      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Création…" : "Créer le projet"}
      </Button>
    </form>
  );
}
