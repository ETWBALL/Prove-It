import * as z from "zod"; 

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
    ACCESS_TOKEN_EXPIRES_IN: z.string(),
    REFRESH_TOKEN_JWT_SECRET: z.string().min(32, 'REFRESH_TOKEN_JWT_SECRET must be at least 32 characters'),
    REFRESH_TOKEN_EXPIRES_IN: z.string(),
    UPSTASH_REDIS_REST_URL: z.string(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    NEXT_PUBLIC_APP_URL: z.string(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string(),
    TURNSTILE_SECRET_KEY: z.string(),
    RESEND_API_KEY: z.string(),
  })

export const env = envSchema.parse(process.env)
