import type { ShopeeConfig } from '@publica/shopee';
import { env } from './env.js';

export function getShopeeConfig(): ShopeeConfig | null {
  if (!env.SHOPEE_PARTNER_ID || !env.SHOPEE_PARTNER_KEY || !env.SHOPEE_REDIRECT_URL) {
    return null;
  }
  return {
    partnerId: env.SHOPEE_PARTNER_ID,
    partnerKey: env.SHOPEE_PARTNER_KEY,
    apiBase: env.SHOPEE_API_BASE,
    redirectUrl: env.SHOPEE_REDIRECT_URL,
  };
}

export function requireShopeeConfig(): ShopeeConfig {
  const cfg = getShopeeConfig();
  if (!cfg) {
    throw new Error('Shopee não configurada (SHOPEE_PARTNER_ID/KEY/REDIRECT_URL ausentes)');
  }
  return cfg;
}
