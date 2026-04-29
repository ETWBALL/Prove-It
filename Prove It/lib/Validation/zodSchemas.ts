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


// Validation schema for environment variables
export const envSchema = z.object({
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_EXPIRES_IN: z.coerce.number().default(5),
    REFRESH_TOKEN_EXPIRES_IN: z.coerce.number().default(60),
    BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  })