import { redactSecret } from './redact.js'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function publicErrorPayload(error: unknown, secrets: Array<string | undefined | null> = []) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: redactSecret(error.message, secrets),
          details: error.details == null ? undefined : JSON.parse(redactSecret(JSON.stringify(error.details), secrets)),
        },
      },
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  const upstream = message.includes('Streamable HTTP error') || message.includes('Error POSTing to endpoint')
  return {
    status: upstream ? 502 : 500,
    body: {
      ok: false,
      error: {
        code: upstream ? 'UPSTREAM_MCP_ERROR' : 'INTERNAL_ERROR',
        message: redactSecret(message, secrets),
      },
    },
  }
}
