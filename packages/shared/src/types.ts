// Tipos compartilhados não derivados diretamente de Zod

export type ShopeeUploadStatus =
  | 'INITIATED'
  | 'TRANSCODING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface HealthcheckResponse {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  version: string;
  checks: {
    db: 'ok' | 'fail';
    redis: 'ok' | 'fail';
  };
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
}
