import type { FILE_SIZE_BUCKETS } from "./schema";

type FileSizeBucket = (typeof FILE_SIZE_BUCKETS)[number];

const KB = 1024;
const MB = 1024 * 1024;

/**
 * Map an exact file size in bytes to a coarse bucket. We never log the
 * exact size — buckets are wide enough to prevent the value from being
 * a fingerprinting signal, but tight enough to inform sizing decisions.
 */
export function fileSizeBucket(bytes: number | null | undefined): FileSizeBucket | undefined {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return undefined;
  if (bytes < 100 * KB) return "<100KB";
  if (bytes < 1 * MB) return "100KB-1MB";
  if (bytes < 5 * MB) return "1-5MB";
  if (bytes < 20 * MB) return "5-20MB";
  return ">20MB";
}
