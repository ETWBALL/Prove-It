import ms from 'ms'

const parseMs = ms as (v: string) => number | undefined

/** Absolute expiry; same vercel/ms strings as jose `setExpirationTime`. */
export function expiresAtFromSpan(span: string): Date {
  const n = parseMs(span)
  if (typeof n !== 'number') {
    throw new Error(`Invalid time span: ${span}`)
  }
  return new Date(Date.now() + n)
}

/** Next.js cookie `maxAge` is in seconds. */
export function cookieMaxAgeSeconds(span: string): number {
  const n = parseMs(span)
  if (typeof n !== 'number') {
    throw new Error(`Invalid time span: ${span}`)
  }
  return Math.floor(n / 1000)
}
