import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-3xl">Check your email</h1>
      <p className="font-mono text-sm text-gris-fonce">
        We just sent you a confirmation link. Click it to activate your account.
      </p>
      <Link href="/login" className="mt-4 font-mono text-sm underline">
        Back to sign in
      </Link>
    </div>
  );
}
