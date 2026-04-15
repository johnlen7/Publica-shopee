import type { ShopeeConfig } from './config.js';
import { callShopJson } from './client.js';

/**
 * Wrappers de /api/v2/product/*  (ver AUDIT.md §3)
 *
 * Usamos apenas:
 *   - get_item_list: listar produtos para o seller
 *   - update_item: vincular video_upload_id a um produto existente
 */

interface AuthCtx {
  config: ShopeeConfig;
  accessToken: string;
  shopId: string | number;
}

export interface GetItemListInput extends AuthCtx {
  offset?: number;
  pageSize?: number; // máx 100
  itemStatus?: Array<'NORMAL' | 'BANNED' | 'DELETED' | 'UNLIST'>;
}

export interface ItemListEntry {
  item_id: number;
  item_status: string;
  update_time: number;
}

export interface GetItemListResponse {
  item: ItemListEntry[];
  total_count: number;
  has_next_page: boolean;
  next_offset: number;
}

export function getItemList(input: GetItemListInput): Promise<GetItemListResponse> {
  return callShopJson<GetItemListResponse>({
    config: input.config,
    apiPath: '/api/v2/product/get_item_list',
    accessToken: input.accessToken,
    shopId: input.shopId,
    method: 'GET',
    body: {
      offset: input.offset ?? 0,
      page_size: input.pageSize ?? 50,
      item_status: input.itemStatus ?? ['NORMAL'],
    },
  });
}

export interface UpdateItemVideoInput extends AuthCtx {
  itemId: number;
  videoUploadId: string;
  title?: string;
  description?: string;
}

export interface UpdateItemResponse {
  item_id: number;
  update_time: number;
}

export function updateItemVideo(input: UpdateItemVideoInput): Promise<UpdateItemResponse> {
  const body: Record<string, unknown> = {
    item_id: input.itemId,
    video_upload_id_list: [input.videoUploadId],
  };
  if (input.title) body.item_name = input.title;
  if (input.description) body.description = input.description;

  return callShopJson<UpdateItemResponse>({
    config: input.config,
    apiPath: '/api/v2/product/update_item',
    accessToken: input.accessToken,
    shopId: input.shopId,
    body,
  });
}
