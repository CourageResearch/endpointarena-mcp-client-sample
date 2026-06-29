const API_KEY_PATTERN = /ea_s[0-9a-z_]*[a-z0-9]/gi

export function redactSecret(text: string, secrets: Array<string | undefined | null> = []): string {
  let redacted = text.replace(API_KEY_PATTERN, '[REDACTED_API_KEY]')
  for (const secret of secrets) {
    if (!secret) continue
    const trimmed = secret.trim()
    if (trimmed.length < 6) continue
    redacted = redacted.split(trimmed).join('[REDACTED_SECRET]')
  }
  return redacted
}

export function redactForJson<T>(value: T, secrets: Array<string | undefined | null> = []): T {
  return JSON.parse(redactSecret(JSON.stringify(value), secrets)) as T
}

export function keyConfiguredSummary(apiKey: string): string {
  if (!apiKey) return 'not configured'
  return `configured (${apiKey.slice(0, 6)}...[redacted])`
}
