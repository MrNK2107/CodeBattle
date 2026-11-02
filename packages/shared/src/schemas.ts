import { z } from 'zod';
import { LANGUAGES } from './problem';

export const MAX_CODE_LENGTH = 64_000;

export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const queueDifficultySchema = z.union([difficultySchema, z.literal('ANY')]);
export const languageSchema = z.enum(LANGUAGES);

const id = z.string().min(1).max(64);
const code = z.string().min(1).max(MAX_CODE_LENGTH);

export const queueJoinSchema = z.object({ difficulty: queueDifficultySchema });

export const matchRefSchema = z.object({ matchId: id });

export const runSchema = z.object({ matchId: id, code, language: languageSchema });
export const submitSchema = runSchema;
export const snapshotSchema = z.object({ matchId: id, code: z.string().max(MAX_CODE_LENGTH), language: languageSchema });

export const typingBatchSchema = z.object({
  matchId: id,
  events: z
    .array(z.object({ t: z.number().finite(), k: z.enum(['char', 'backspace', 'other']) }))
    .max(2000),
  pastedChars: z.number().int().min(0).max(MAX_CODE_LENGTH),
});

export const practiceSchema = z.object({ slug: z.string().min(1).max(120), code, language: languageSchema });

export const roomCreateSchema = z.object({ difficulty: queueDifficultySchema });
export const roomJoinSchema = z.object({ code: z.string().trim().min(4).max(12) });

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Use letters, numbers, - and _ only'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
