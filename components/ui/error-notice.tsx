export function ErrorNotice({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded border border-danger px-4 py-3 text-sm text-danger"
    >
      {message}
    </p>
  );
}
