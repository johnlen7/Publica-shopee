import { createHmac } from 'node:crypto';

/**
 * Assinatura HMAC-SHA256 conforme documentação da Shopee Open Platform v2.
 *
 * String base varia por contexto:
 * - Public endpoints (ex.: auth/token/get):
 *     partner_id + api_path + timestamp
 * - Shop-level endpoints:
 *     partner_id + api_path + timestamp + access_token + shop_id
 * - Merchant-level endpoints:
 *     partner_id + api_path + timestamp + access_token + merchant_id
 *
 * Referência: https://open.shopee.com/documents/v2/OpenAPI%202.0%20Overview
 */

export type SigningContext =
  | { type: 'public'; apiPath: string }
  | { type: 'shop'; apiPath: string; accessToken: string; shopId: string | number }
  | { type: 'merchant'; apiPath: string; accessToken: string; merchantId: string | number };

export interface SignedRequest {
  sign: string;
  timestamp: number;
}

export function signRequest(
  partnerId: string | number,
  partnerKey: string,
  ctx: SigningContext,
): SignedRequest {
  const timestamp = Math.floor(Date.now() / 1000);
  let baseString = `${partnerId}${ctx.apiPath}${timestamp}`;

  if (ctx.type === 'shop') {
    baseString += `${ctx.accessToken}${ctx.shopId}`;
  } else if (ctx.type === 'merchant') {
    baseString += `${ctx.accessToken}${ctx.merchantId}`;
  }

  const sign = createHmac('sha256', partnerKey).update(baseString).digest('hex');
  return { sign, timestamp };
}
