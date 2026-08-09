import Link from "next/link";
import { NewProjectForm } from "@/components/new-project-form";

export default function NewProjectPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="font-mono text-sm underline hover:opacity-60">
          ← Retour à vos projets
        </Link>
        <h1 className="font-display text-[40px] leading-tight">
          Nouveau projet
        </h1>
        <p className="text-base text-ink-soft">
          Donnez-lui un nom, vous pourrez le changer plus tard.
        </p>
      </div>
      <NewProjectForm />
    </div>
  );
}
