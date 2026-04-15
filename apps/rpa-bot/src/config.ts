import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';

const envSchema = z.object({
  /** URL da API principal (onde o bot reivindica jobs) */
  API_URL: z.string().url(),
  /** JWT de operador com permissão RPA (gerado uma vez pelo setup) */
  API_TOKEN: z.string().min(16),
  /** Identificador único deste agente (ex.: nome da máquina) */
  AGENT_ID: z.string().default(os.hostname()),
  /** Pasta para persistência de sessão do navegador */
  USER_DATA_DIR: z
    .string()
    .default(path.join(os.homedir(), '.publica-shopee', 'browser-profile')),
  /** Região Shopee — muda URLs (br, my, id, ph, sg, th, tw, vn) */
  SHOPEE_REGION: z.string().default('br'),
  /** Intervalo entre polls, em ms */
  POLL_INTERVAL_MS: z.coerce.number().int().min(5_000).default(10_000),
  /** headless false por padrão — seller vê o que acontece */
  HEADLESS: z.enum(['true', 'false']).default('false'),
  /** diretório raiz onde os vídeos referenciados por videoLocalPath estão */
  VIDEOS_ROOT: z.string().default(path.join(os.homedir(), 'Videos', 'publica-shopee')),
});

export const config = envSchema.parse(process.env);

export const SELLER_CENTER_URL = (() => {
  const map: Record<string, string> = {
    br: 'https://seller.shopee.com.br',
    my: 'https://seller.shopee.com.my',
    id: 'https://seller.shopee.co.id',
    ph: 'https://seller.shopee.ph',
    sg: 'https://seller.shopee.sg',
    th: 'https://seller.shopee.co.th',
    tw: 'https://seller.shopee.tw',
    vn: 'https://banhang.shopee.vn',
  };
  return map[config.SHOPEE_REGION] ?? map.br;
})();
