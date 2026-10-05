// Respuestas de error JSON uniformes para los route handlers:
// { error: { code, message } } + headers opcionales (Retry-After)

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  retryAfterSeconds?: number,
): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
  return Response.json({ error: { code, message, retryAfterSeconds } }, { status, headers });
}

export function httpErrorResponse(err: HttpError): Response {
  return errorResponse(err.status, err.code, err.message, err.retryAfterSeconds);
}
