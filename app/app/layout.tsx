import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-beige">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/app" className="font-display text-xl">
            Eklio
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-xs uppercase tracking-widest text-gris-fonce underline-offset-4 hover:underline"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
