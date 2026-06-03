import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI est requis'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit faire au moins 32 caractères'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_ROUNDS: z.string().default('12'),

  PAYDUNYA_MASTER_KEY: z.string().min(1, 'PAYDUNYA_MASTER_KEY est requis'),
  PAYDUNYA_PRIVATE_KEY: z.string().min(1, 'PAYDUNYA_PRIVATE_KEY est requis'),
  PAYDUNYA_TOKEN: z.string().min(1, 'PAYDUNYA_TOKEN est requis'),
  PAYDUNYA_MODE: z.enum(['test', 'live']).default('test'),
  PAYDUNYA_BASE_URL: z.string().url(),

  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY est requis'),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('Touba Mbacké Santé'),

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY est requis'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  PRODUCTION_URL: z.string().url().default('https://membre.tms.sn'),

  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().min(1),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Variables d\'environnement invalides :');
  parseResult.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parseResult.data;
export type Env = typeof env;
