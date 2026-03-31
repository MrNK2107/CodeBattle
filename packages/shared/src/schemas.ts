import { z } from 'zod';

export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const queueDifficultySchema = z.union([difficultySchema, z.literal('ANY')]);

export const queueJoinSchema = z.object({
  userId: z.string().min(1),
  difficulty: queueDifficultySchema
});

export const queueLeaveSchema = z.object({
  userId: z.string().min(1)
});

export const runSchema = z.object({
  matchId: z.string().min(1),
  userId: z.string().min(1),
  code: z.string().min(1),
  language: z.string().min(1)
});

export const submitSchema = runSchema;

export const forfeitSchema = z.object({
  matchId: z.string().min(1),
  userId: z.string().min(1)
});

export const readySchema = z.object({
  matchId: z.string().min(1),
  userId: z.string().min(1)
});

export const keystrokeSchema = z.object({
  matchId: z.string().min(1),
  userId: z.string().min(1),
  key: z.string().min(1),
  timestamp: z.number().int(),
  type: z.enum(['keydown', 'keyup'])
});

export const webrtcSignalSchema = z.object({
  matchId: z.string().min(1),
  to: z.string().min(1),
  sdp: z.string().optional(),
  candidate: z.unknown().optional()
});
