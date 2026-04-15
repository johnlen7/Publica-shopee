// Limites oficiais do fluxo de upload Shopee Video consultado (PRD §5.3)
export const SHOPEE_VIDEO_LIMITS = {
  MIN_DURATION_SECONDS: 10,
  MAX_DURATION_SECONDS: 60,
  MAX_FILE_SIZE_BYTES: 30 * 1024 * 1024, // 30 MB
  PART_SIZE_BYTES: 4 * 1024 * 1024, // 4 MB (exceto a última)
  ALLOWED_MIME_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo'] as const,
} as const;

// Filas BullMQ
export const QUEUE_NAMES = {
  UPLOAD: 'upload',
  PUBLISH: 'publish',
  TOKEN_REFRESH: 'token-refresh',
} as const;

// Jobs
export const JOB_NAMES = {
  INIT_UPLOAD: 'init-upload',
  UPLOAD_PART: 'upload-part',
  COMPLETE_UPLOAD: 'complete-upload',
  POLL_TRANSCODING: 'poll-transcoding',
  PUBLISH_VIDEO: 'publish-video',
  REFRESH_TOKEN: 'refresh-token',
  ECHO: 'echo',
} as const;
