import { z } from 'zod';
import { SHOPEE_VIDEO_LIMITS } from './constants.js';

// Autenticação
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  workspaceName: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Validação local de vídeo conforme PRD §6.2
export const videoValidationSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(SHOPEE_VIDEO_LIMITS.ALLOWED_MIME_TYPES),
  fileSizeBytes: z.number().int().positive().max(SHOPEE_VIDEO_LIMITS.MAX_FILE_SIZE_BYTES),
  durationSeconds: z
    .number()
    .int()
    .min(SHOPEE_VIDEO_LIMITS.MIN_DURATION_SECONDS)
    .max(SHOPEE_VIDEO_LIMITS.MAX_DURATION_SECONDS),
});
export type VideoValidationInput = z.infer<typeof videoValidationSchema>;

// Metadados
export const metadataSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  hashtags: z.array(z.string()).max(30).default([]),
  category: z.string().optional(),
});
export type MetadataInput = z.infer<typeof metadataSchema>;

// Agendamento
export const schedulePublishSchema = z.object({
  videoId: z.string().uuid(),
  shopeeAccountId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
  timezone: z.string().default('America/Sao_Paulo'),
});
export type SchedulePublishInput = z.infer<typeof schedulePublishSchema>;

// Ecos de job para teste de pipeline
export const echoJobSchema = z.object({
  message: z.string(),
  delayMs: z.number().int().min(0).default(0),
});
export type EchoJobPayload = z.infer<typeof echoJobSchema>;
