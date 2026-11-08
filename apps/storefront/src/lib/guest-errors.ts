export function guestError(error: unknown): Error {
  if (error instanceof SyntaxError) return new Error('No pudimos recuperar tus productos guardados. Conservamos sus datos en este dispositivo.');
  return error instanceof Error ? error : new Error('No pudimos recuperar tus productos guardados. Inténtalo de nuevo.');
}
