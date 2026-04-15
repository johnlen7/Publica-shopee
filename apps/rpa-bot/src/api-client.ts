import { config } from './config.js';

interface ApiOpts {
  method?: 'GET' | 'POST';
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, opts: ApiOpts = {}): Promise<T | null> {
  const res = await fetch(`${config.API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.API_TOKEN}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`API ${path} ${res.status}: ${text}`, res.status);
  }
  return text ? (JSON.parse(text) as T) : null;
}

export interface RpaJobDto {
  id: string;
  workspaceId: string;
  videoId: string | null;
  videoLocalPath: string | null;
  caption: string;
  hashtags: string[];
  scheduledFor: string | null;
  status: string;
}

export const api = {
  claimJob: (agentId: string) =>
    call<RpaJobDto>('/rpa/jobs/claim', { method: 'POST', body: { agentId } }),
  startJob: (id: string) => call(`/rpa/jobs/${id}/start`, { method: 'POST' }),
  reportResult: (
    id: string,
    payload: {
      status: 'COMPLETED' | 'FAILED';
      lastError?: string;
      result?: Record<string, unknown>;
    },
  ) => call(`/rpa/jobs/${id}/result`, { method: 'POST', body: payload }),
};
