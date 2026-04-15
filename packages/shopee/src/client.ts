import type { ShopeeConfig } from './config.js';
import { signRequest, type SigningContext } from './signing.js';

/**
 * Cliente HTTP autenticado para endpoints shop/merchant da Shopee Open Platform.
 *
 * Formato de resposta padrão v2:
 *   { error: string, message: string, request_id: string, response: {...} }
 */

export interface ShopeeResponse<T> {
  error: string;
  message: string;
  request_id?: string;
  response?: T;
}

export class ShopeeApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public requestId: string | undefined,
    public apiPath: string,
  ) {
    super(message);
  }
}

function buildQuery(params: Record<string, string | number>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) s.append(k, String(v));
  return s.toString();
}

export interface ShopCallInput {
  config: ShopeeConfig;
  apiPath: string;
  accessToken: string;
  shopId: string | number;
  body?: Record<string, unknown>;
  method?: 'POST' | 'GET';
}

function handle<T>(apiPath: string, status: number, json: ShopeeResponse<T>): T {
  if (status >= 400 || json.error) {
    throw new ShopeeApiError(
      json.message || `Shopee ${apiPath} respondeu ${status}`,
      json.error || `http_${status}`,
      json.request_id,
      apiPath,
    );
  }
  if (!json.response) {
    throw new ShopeeApiError(
      'Resposta Shopee sem campo response',
      'empty_response',
      json.request_id,
      apiPath,
    );
  }
  return json.response;
}

export async function callShopJson<T>(input: ShopCallInput): Promise<T> {
  const { config } = input;
  const ctx: SigningContext = {
    type: 'shop',
    apiPath: input.apiPath,
    accessToken: input.accessToken,
    shopId: input.shopId,
  };
  const { sign, timestamp } = signRequest(config.partnerId, config.partnerKey, ctx);

  const query = buildQuery({
    partner_id: config.partnerId,
    timestamp,
    access_token: input.accessToken,
    shop_id: input.shopId,
    sign,
  });

  const url = `${config.apiBase}${input.apiPath}?${query}`;
  const res = await fetch(url, {
    method: input.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: input.method === 'GET' ? undefined : JSON.stringify(input.body ?? {}),
  });

  const json = (await res.json().catch(() => ({}))) as ShopeeResponse<T>;
  return handle<T>(input.apiPath, res.status, json);
}

export interface ShopMultipartInput {
  config: ShopeeConfig;
  apiPath: string;
  accessToken: string;
  shopId: string | number;
  form: FormData;
}

export async function callShopMultipart<T>(input: ShopMultipartInput): Promise<T> {
  const { config } = input;
  const { sign, timestamp } = signRequest(config.partnerId, config.partnerKey, {
    type: 'shop',
    apiPath: input.apiPath,
    accessToken: input.accessToken,
    shopId: input.shopId,
  });

  const query = buildQuery({
    partner_id: config.partnerId,
    timestamp,
    access_token: input.accessToken,
    shop_id: input.shopId,
    sign,
  });

  const url = `${config.apiBase}${input.apiPath}?${query}`;
  const res = await fetch(url, { method: 'POST', body: input.form });

  const json = (await res.json().catch(() => ({}))) as ShopeeResponse<T>;
  return handle<T>(input.apiPath, res.status, json);
}
