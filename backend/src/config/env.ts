import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default("/api/v1"),

  // Database
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().default(5433),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().default("pantone_fam"),
  DB_SSL: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(20),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Seed Passwords (Dev / initial setup)
  SEED_COMMON_ADMIN_PASSWORD: z.string().min(8).default("pantone123"),
  SEED_APPARELS_ADMIN_PASSWORD: z.string().min(8).default("pantone123"),
  SEED_GARMENTS_ADMIN_PASSWORD: z.string().min(8).default("pantone123"),

  // Network & Binding
  HOST: z.string().default("0.0.0.0"),

  // Storage
  STORAGE_PATH: z.string().default("./uploads"),

  // Reverse Proxy Trust
  TRUST_PROXY: z.preprocess((val) => val === "true" || val === true || val === "1", z.boolean()).default(true),

  // CORS
  CORS_ORIGIN: z.string().default("*")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 2));
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;