import type { ShopeeConfig } from './config.js';
import { signRequest } from './signing.js';

/**
 * Cliente OAuth da Shopee Open Platform.
 *
 * Fluxo documentado (ver AUDIT.md §1):
 *   1. Redirecionar seller para:
 *      {apiBase}/api/v2/shop/auth_partner?partner_id=...&redirect=...&sign=...&timestamp=...
 *   2. Seller autoriza; Shopee redireciona para `redirect` com ?code=...&shop_id=...
 *      (ou main_account_id= em casos de merchant/CBSC).
 *   3. Trocar code por tokens em /api/v2/auth/token/get
 *   4. Renovar com /api/v2/auth/access_token/get
 */

const AUTH_PATH = '/api/v2/shop/auth_partner';
const TOKEN_GET_PATH = '/api/v2/auth/token/get';
const TOKEN_REFRESH_PATH = '/api/v2/auth/access_token/get';

export interface ShopeeToken {
  accessToken: string;
  refreshToken: string;
  /** Segundos até expirar — Shopee documenta access_token com vida ≈ 4h. */
  expireIn: number;
  shopIdList?: number[];
  merchantIdList?: number[];
}

export function buildAuthorizationUrl(
  config: ShopeeConfig,
  options: { state?: string } = {},
): string {
  const { sign, timestamp } = signRequest(config.partnerId, config.partnerKey, {
    type: 'public',
    apiPath: AUTH_PATH,
  });

  const params = new URLSearchParams({
    partner_id: config.partnerId,
    redirect: config.redirectUrl,
    sign,
    timestamp: String(timestamp),
  });
  if (options.state) params.set('state', options.state);

  return `${config.apiBase}${AUTH_PATH}?${params.toString()}`;
}

interface TokenGetResponse {
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
  shop_id_list?: number[];
  merchant_id_list?: number[];
  error?: string;
  message?: string;
}

async function callPublic(
  config: ShopeeConfig,
  apiPath: string,
  body: Record<string, unknown>,
): Promise<TokenGetResponse> {
  const { sign, timestamp } = signRequest(config.partnerId, config.partnerKey, {
    type: 'public',
    apiPath,
  });
  const url = `${config.apiBase}${apiPath}?partner_id=${config.partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partner_id: Number(config.partnerId), ...body }),
  });

  const json = (await res.json().catch(() => ({}))) as TokenGetResponse;
  if (!res.ok || json.error) {
    throw new Error(`Shopee ${apiPath} falhou: ${json.error ?? res.status} ${json.message ?? ''}`);
  }
  return json;
}

export async function exchangeCodeForToken(
  config: ShopeeConfig,
  params: { code: string; shopId?: string; merchantId?: string },
): Promise<ShopeeToken> {
  const body: Record<string, unknown> = { code: params.code };
  if (params.shopId) body.shop_id = Number(params.shopId);
  if (params.merchantId) body.merchant_id = Number(params.merchantId);

  const json = await callPublic(config, TOKEN_GET_PATH, body);

  if (!json.access_token || !json.refresh_token || !json.expire_in) {
    throw new Error('Resposta da Shopee sem tokens esperados');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expireIn: json.expire_in,
    shopIdList: json.shop_id_list,
    merchantIdList: json.merchant_id_list,
  };
}

export async function refreshAccessToken(
  config: ShopeeConfig,
  params: { refreshToken: string; shopId?: string; merchantId?: string },
): Promise<ShopeeToken> {
  const body: Record<string, unknown> = { refresh_token: params.refreshToken };
  if (params.shopId) body.shop_id = Number(params.shopId);
  if (params.merchantId) body.merchant_id = Number(params.merchantId);

  const json = await callPublic(config, TOKEN_REFRESH_PATH, body);

  if (!json.access_token || !json.refresh_token || !json.expire_in) {
    throw new Error('Resposta de refresh sem tokens esperados');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expireIn: json.expire_in,
  };
}
