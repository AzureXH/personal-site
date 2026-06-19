/// <reference lib="webworker" />

/**
 * Web Worker — offloads CPU-heavy file slicing + SHA-256 hashing
 * so the main thread stays responsive (UI progress, drag UX).
 *
 * In:
 *   { file: File, chunkSize: number }
 *
 * Out (per message):
 *   { type: "progress", current, total }
 *   { type: "complete", chunks: ChunkMeta[], fileName, fileSize, fileId }
 */

export interface ChunkMeta {
  index: number;
  offset: number;
  size: number;
  hash: string; // hex-encoded SHA-256
}

interface WorkerInput {
  file: File;
  chunkSize: number;
  fileId: string;
}

// The callback is self.onmessage for the Worker scope.
// We use `self` which is available in both dedicated & shared workers.
self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { file, chunkSize, fileId } = e.data;
  const totalChunks = Math.ceil(file.size / chunkSize);
  const chunks: ChunkMeta[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * chunkSize;
    const end = Math.min(offset + chunkSize, file.size);
    const blob = file.slice(offset, end);

    // Read chunk into ArrayBuffer
    const arrayBuf = await blob.arrayBuffer();

    // SHA-256 via Web Crypto — CPU-bound work offloaded from UI thread
    const hashBuf = await crypto.subtle.digest("SHA-256", arrayBuf);
    const hash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    chunks.push({ index: i, offset, size: blob.size, hash });

    // Emit progress so the main thread can update the UI
    self.postMessage({ type: "progress" as const, current: i + 1, total: totalChunks });
  }

  self.postMessage({
    type: "complete" as const,
    chunks,
    fileName: file.name,
    fileSize: file.size,
    fileId,
  });
};
