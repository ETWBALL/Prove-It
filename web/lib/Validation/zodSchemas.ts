import * as z from "zod";
import ms from "ms";

/** Runtime check matching jose's use of vercel/ms for string expirations. */
function isValidMsTimeSpan(s: string): boolean {
  const parse = ms as (value: string) => number | undefined
  return typeof parse(s) === "number"
}

/** Same time-span syntax as jose `setExpirationTime` (vercel/ms). Validated at env parse. */
const joseCompatibleTimeSpan = z
  .string()
  .trim()
  .min(1, "Value is required")
  .refine(isValidMsTimeSpan, {
    message:
      "Must be a valid time span (e.g. 15m, 7d, 60 days). See https://github.com/vercel/ms",
  });

/** Trim and strip trailing slashes so issuer/audience match between sign and verify. */
const canonicalAppUrl = z
  .string()
  .transform((s) => s.trim().replace(/\/+$/, ""))
  .pipe(z.string().min(1).url({ message: "NEXT_PUBLIC_APP_URL must be a valid URL" }));

// Validation schema for new password. 
export const PasswordSchema = z.string()
    .min(8, "Must be at least 8 characters")
    .max(64, "Password is too long")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[0-9]/, "Include a number")
    .regex(/[!@#$%^&*]/, "Include a special character"); 

// Validation schema for normal user signup
export const SignupSchema = z.object({
    email: z.string().email("Invalid email address").trim().toLowerCase(),
    password: PasswordSchema,
    confirmPassword: z.string(),
    universityId: z.coerce.string({ error: 'University ID must be a string' }).optional(),
}).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
});

// Validation schema for login
export const LoginSchema = z.object({
    email: z.string().email("Invalid email address").trim().toLowerCase(),
    password: z.string({ error: "Password is required" }).min(1, "Password cannot be empty").max(128, "Password is too long"),
});


// Validation schema for environment variables
export const envSchema = z.object({
    DATABASE_URL: z.string(),
    BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
    ACCESS_TOKEN_JWT_SECRET: z.string().min(32, 'ACCESS_TOKEN_JWT_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_EXPIRES_IN: joseCompatibleTimeSpan,
    REFRESH_TOKEN_JWT_SECRET: z.string().min(32, 'REFRESH_TOKEN_JWT_SECRET must be at least 32 characters'),
    REFRESH_TOKEN_EXPIRES_IN: joseCompatibleTimeSpan,
    UPSTASH_REDIS_REST_URL: z.string(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    NEXT_PUBLIC_APP_URL: z.string(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string(),
    TURNSTILE_SECRET_KEY: z.string(),
    RESEND_API_KEY: z.string(),
    APP_URL: z.string(),
  })

export const env = envSchema.parse(process.env)


/** Validates user id on verified JWT payloads; allows standard claims (iat, exp, iss, aud, …). */
export const TokenPayloadSchema = z
    .object({
        publicId: z.string({ error: 'Public ID is required' }).cuid('Invalid public ID'),
        sessionPublicId: z.string({ error: 'Session public ID is required' }).cuid('Invalid session public ID'),
    })
    .passthrough()
    .transform((p) => ({ publicId: p.publicId, sessionPublicId: p.sessionPublicId }))