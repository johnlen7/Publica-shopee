import type { ShopeeConfig } from './config.js';
import { callShopJson, callShopMultipart } from './client.js';

/**
 * Wrappers de /api/v2/media_space/*  (ver AUDIT.md §2)
 */

export type VideoUploadStatus =
  | 'INITIATED'
  | 'TRANSCODING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

interface AuthCtx {
  config: ShopeeConfig;
  accessToken: string;
  shopId: string | number;
}

export interface InitVideoUploadInput extends AuthCtx {
  fileMd5: string; // hex lowercase do arquivo inteiro
  fileSize: number;
}

export interface InitVideoUploadResponse {
  video_upload_id: string;
}

export function initVideoUpload(input: InitVideoUploadInput): Promise<InitVideoUploadResponse> {
  return callShopJson<InitVideoUploadResponse>({
    config: input.config,
    apiPath: '/api/v2/media_space/init_video_upload',
    accessToken: input.accessToken,
    shopId: input.shopId,
    body: { file_md5: input.fileMd5, file_size: input.fileSize },
  });
}

export interface UploadVideoPartInput extends AuthCtx {
  videoUploadId: string;
  partSeq: number; // 0-based
  contentMd5: string;
  part: Buffer; // 4 MB, exceto última
}

export function uploadVideoPart(input: UploadVideoPartInput): Promise<Record<string, never>> {
  const form = new FormData();
  form.append('video_upload_id', input.videoUploadId);
  form.append('part_seq', String(input.partSeq));
  form.append('content_md5', input.contentMd5);
  form.append('part_content', new Blob([new Uint8Array(input.part)]));

  return callShopMultipart<Record<string, never>>({
    config: input.config,
    apiPath: '/api/v2/media_space/upload_video_part',
    accessToken: input.accessToken,
    shopId: input.shopId,
    form,
  });
}

export interface CompleteVideoUploadInput extends AuthCtx {
  videoUploadId: string;
  partSeqList: number[];
  reportData?: {
    upload_cost?: number;
    upload_size?: number;
    client_network_type?: string;
  };
}

export function completeVideoUpload(
  input: CompleteVideoUploadInput,
): Promise<Record<string, never>> {
  return callShopJson<Record<string, never>>({
    config: input.config,
    apiPath: '/api/v2/media_space/complete_video_upload',
    accessToken: input.accessToken,
    shopId: input.shopId,
    body: {
      video_upload_id: input.videoUploadId,
      part_seq_list: input.partSeqList,
      report_data: input.reportData ?? {},
    },
  });
}

export interface GetVideoUploadResultInput extends AuthCtx {
  videoUploadId: string;
}

export interface VideoUploadResult {
  video_upload_id: string;
  status: VideoUploadStatus;
  message?: string;
  video_info?: {
    video_url_list?: Array<{ image_url_region: string; resource_url: string }>;
    thumbnail_url_list?: Array<{ image_url_region: string; resource_url: string }>;
    duration?: number;
    width?: number;
    height?: number;
  };
}

export function getVideoUploadResult(
  input: GetVideoUploadResultInput,
): Promise<VideoUploadResult> {
  return callShopJson<VideoUploadResult>({
    config: input.config,
    apiPath: '/api/v2/media_space/get_video_upload_result',
    accessToken: input.accessToken,
    shopId: input.shopId,
    body: { video_upload_id: input.videoUploadId },
  });
}

export interface CancelVideoUploadInput extends AuthCtx {
  videoUploadId: string;
}

export function cancelVideoUpload(
  input: CancelVideoUploadInput,
): Promise<Record<string, never>> {
  return callShopJson<Record<string, never>>({
    config: input.config,
    apiPath: '/api/v2/media_space/cancel_video_upload',
    accessToken: input.accessToken,
    shopId: input.shopId,
    body: { video_upload_id: input.videoUploadId },
  });
}
