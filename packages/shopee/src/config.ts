/**
 * Configuração injetada para o cliente Shopee.
 * A fonte (env, vault, config service) é responsabilidade do chamador.
 */
export interface ShopeeConfig {
  partnerId: string;
  partnerKey: string;
  /** Base URL: https://partner.shopeemobile.com (prod) ou test-stable para sandbox */
  apiBase: string;
  /** URL registrada no portal Shopee para o callback OAuth */
  redirectUrl: string;
}
