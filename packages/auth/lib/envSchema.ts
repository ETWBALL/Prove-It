
import * as z from "zod";
import ms from "ms";

/** Runtime check matching jose's use of vercel/ms for string expirations. */
function isValidMsTimeSpan(s: string): boolean {
    const parse = ms as (value: string) => number | undefined
    return typeof parse(s) === "number"
}

/** Same time-span syntax as jose `setExpirationTime` (vercel/ms). Validated at env parse. */
const joseCompatibleTimeSpan = z.string().trim().min(1, "Value is required").refine(isValidMsTimeSpan, {message: "Must be a valid time span (e.g. 15m, 7d, 60 days). See https://github.com/vercel/ms"});

export const authEnvSchema = z.object({
    APP_URL: z.string(),
    NEXT_PUBLIC_APP_URL: z.string(),
    REFRESH_TOKEN_JWT_SECRET: z.string().min(32, 'REFRESH_TOKEN_JWT_SECRET must be at least 32 characters'),
    REFRESH_TOKEN_EXPIRES_IN: joseCompatibleTimeSpan,
    ACCESS_TOKEN_JWT_SECRET: z.string().min(32, 'ACCESS_TOKEN_JWT_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_EXPIRES_IN: joseCompatibleTimeSpan,
    BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
})

export const authEnv = authEnvSchema.parse(process.env)

/** Validates user id on verified JWT payloads; allows standard claims (iat, exp, iss, aud, …). */
export const TokenPayloadSchema = z
    .object({
        publicId: z.string({ error: 'Public ID is required' }).cuid('Invalid public ID'),
        sessionPublicId: z.string({ error: 'Session public ID is required' }).cuid('Invalid session public ID'),
    })
    .passthrough()
    .transform((p) => ({ publicId: p.publicId, sessionPublicId: p.sessionPublicId }))