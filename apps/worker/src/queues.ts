import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@publica/shared';
import { connection } from './connection.js';

export const uploadQueue = new Queue(QUEUE_NAMES.UPLOAD, { connection });
export const publishQueue = new Queue(QUEUE_NAMES.PUBLISH, { connection });
export const tokenRefreshQueue = new Queue(QUEUE_NAMES.TOKEN_REFRESH, { connection });
