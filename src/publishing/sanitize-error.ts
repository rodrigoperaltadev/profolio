// The leak-prevention guarantee — see design.md's Interfaces/Contracts.
// Literal substring redaction catches the token wherever it appears in the
// message text, including a GitHub error body that unexpectedly echoes it
// back, without depending on knowing which JSON field it might surface in.
export function sanitizeError(err: unknown, secrets: readonly string[]): string {
  const raw = err instanceof Error ? err.message : String(err);
  return secrets.reduce(
    (msg, secret) => (secret.length > 0 ? msg.split(secret).join("[REDACTED]") : msg),
    raw,
  );
}
