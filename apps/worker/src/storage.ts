import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Abstração de leitura do vídeo do staging para o worker.
 *
 * Em produção isto leria do S3/MinIO via SDK. Para o MVP local, lemos
 * do filesystem (STORAGE_ROOT apontando para um volume montado igual ao
 * usado pelo componente de upload da API). A interface é a mesma para
 * facilitar o swap por um cliente S3 real no futuro.
 */

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? '/tmp/publica-storage';

export async function readStaged(storagePath: string): Promise<Buffer> {
  return readFile(join(STORAGE_ROOT, storagePath));
}

export function md5Hex(data: Buffer): string {
  return createHash('md5').update(data).digest('hex');
}

/**
 * Divide o arquivo em partes de 4 MB (a última pode ser menor).
 * Retorna [partIndex, partBuffer, partMd5] para consumo sequencial.
 */
export function splitIntoParts(
  data: Buffer,
  partSize = 4 * 1024 * 1024,
): Array<{ seq: number; buffer: Buffer; md5: string }> {
  const parts: Array<{ seq: number; buffer: Buffer; md5: string }> = [];
  let seq = 0;
  for (let offset = 0; offset < data.length; offset += partSize) {
    const chunk = data.subarray(offset, Math.min(offset + partSize, data.length));
    parts.push({ seq, buffer: chunk, md5: md5Hex(chunk) });
    seq++;
  }
  return parts;
}
