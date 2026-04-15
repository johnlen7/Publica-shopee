import { z } from 'zod';
import type { ShopeeConfig } from '@publica/shopee';

const envSchema = z.object({
  SHOPEE_PARTNER_ID: z.string().min(1),
  SHOPEE_PARTNER_KEY: z.string().min(1),
  SHOPEE_API_BASE: z.string().url().default('https://partner.shopeemobile.com'),
  SHOPEE_REDIRECT_URL: z.string().url(),
});

export function getShopeeConfig(): ShopeeConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Worker requer Shopee env vars: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  return {
    partnerId: parsed.data.SHOPEE_PARTNER_ID,
    partnerKey: parsed.data.SHOPEE_PARTNER_KEY,
    apiBase: parsed.data.SHOPEE_API_BASE,
    redirectUrl: parsed.data.SHOPEE_REDIRECT_URL,
  };
}
