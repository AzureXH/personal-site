"use client";

import { useCallback, useRef, useState } from "react";
import type { ChunkMeta } from "./worker";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const CONCURRENCY = 3; // parallel uploads
const MAX_RETRIES = 2;

/** Generate a short hex id */
function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

type Phase = "idle" | "hashing" | "uploading" | "done" | "error";

export default function FileUploadPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [hashProgress, setHashProgress] = useState({ current: 0, total: 0 });
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadedSize, setUploadedSize] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ fileName: string; size: number } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const fileRef = useRef<File | null>(null);
  const abortRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Worker lifecycle
  // ---------------------------------------------------------------------------
  const spawnWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("./worker.ts", import.meta.url));
    workerRef.current = w;
    return w;
  }, []);

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  // ---------------------------------------------------------------------------
  // Upload a single chunk (with retry)
  // ---------------------------------------------------------------------------
  const uploadChunk = useCallback(
    async (fileId: string, chunk: ChunkMeta, blob: Blob): Promise<void> => {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const fd = new FormData();
          fd.set("fileId", fileId);
          fd.set("fileName", chunk.hash); // use hash as server-side name for dedup
          fd.set("chunkIndex", String(chunk.index));
          fd.set("totalChunks", String(uploadProgress.total));
          fd.set("chunk", blob, `chunk_${chunk.index}`);

          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error);

          setUploadedSize((prev) => prev + chunk.size);
          setUploadProgress((prev) => ({ ...prev, current: prev.current + 1 }));
          return; // success
        } catch (err) {
          lastErr = err;
          if (attempt < MAX_RETRIES) {
            // Exponential backoff: 500ms, 1s
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }
        }
      }
      throw lastErr;
    },
    [uploadProgress.total],
  );

  // ---------------------------------------------------------------------------
  // Concurrent upload with a sliding window
  // ---------------------------------------------------------------------------
  const uploadAll = useCallback(
    async (fileId: string, chunks: ChunkMeta[]) => {
      setPhase("uploading");
      setUploadProgress({ current: 0, total: chunks.length });
      setUploadedSize(0);
      abortRef.current = false;

      const file = fileRef.current!;
      const queue = [...chunks];
      const inFlight = new Set<Promise<void>>();

      while (queue.length > 0 || inFlight.size > 0) {
        if (abortRef.current) throw new Error("Upload aborted");

        // Fill up to concurrency
        while (queue.length > 0 && inFlight.size < CONCURRENCY) {
          const meta = queue.shift()!;
          const blob = file.slice(meta.offset, meta.offset + meta.size);
          const p = uploadChunk(fileId, meta, blob).finally(() => inFlight.delete(p));
          inFlight.add(p);
        }

        if (inFlight.size > 0) {
          await Promise.race(inFlight);
        }
      }
    },
    [uploadChunk],
  );

  // ---------------------------------------------------------------------------
  // Handle file selection
  // ---------------------------------------------------------------------------
  const handleFile = useCallback(
    async (file: File) => {
      // Reset state
      setPhase("hashing");
      setError("");
      setResult(null);
      setFileName(file.name);
      setFileSize(file.size);
      fileRef.current = file;
      abortRef.current = false;

      const fileId = uid();

      try {
        const worker = spawnWorker();

        // Wait for worker to finish slicing + hashing
        const chunks = await new Promise<ChunkMeta[]>((resolve, reject) => {
          worker.onmessage = (e: MessageEvent) => {
            const msg = e.data;
            if (msg.type === "progress") {
              setHashProgress({ current: msg.current, total: msg.total });
            } else if (msg.type === "complete") {
              resolve(msg.chunks as ChunkMeta[]);
            }
          };
          worker.onerror = (ev) => reject(new Error(ev.message));

          worker.postMessage({ file, chunkSize: CHUNK_SIZE, fileId });
        });

        // Upload all chunks
        await uploadAll(fileId, chunks);

        setPhase("done");
        setResult({ fileName: file.name, size: file.size });
      } catch (err) {
        setPhase("error");
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        terminateWorker();
      }
    },
    [spawnWorker, terminateWorker, uploadAll],
  );

  // ---------------------------------------------------------------------------
  // Drag & drop handlers
  // ---------------------------------------------------------------------------
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isActive = phase === "hashing" || phase === "uploading";

  return (
    <div className="mx-auto max-w-2xl px-6">
      {/* Header */}
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">大文件上传</h1>
      <p className="mt-2 text-muted">
        切片上传 + SHA-256 校验 + Web Worker 哈希
      </p>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-10 border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragOver
            ? "border-fg bg-fg/5"
            : "border-border hover:border-muted"
        } ${isActive ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
        onClick={() => {
          if (!isActive) document.getElementById("file-input")?.click();
        }}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            // Reset so the same file can be re-selected
            e.target.value = "";
          }}
        />
        <p className="text-lg font-medium">
          {dragOver ? "松开放到这里" : "拖拽文件到这里，或点击选择"}
        </p>
        <p className="mt-1 text-sm text-muted">
          单个文件最大约 50 GB（切片上传，每片 {fmtSize(CHUNK_SIZE)}）
        </p>
      </div>

      {/* ---- Phase: HASHING ---- */}
      {phase === "hashing" && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              正在计算 SHA-256 哈希…（Web Worker）
            </span>
            <span className="font-mono tabular-nums">
              {hashProgress.current}/{hashProgress.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-fg transition-all duration-200"
              style={{
                width: `${hashProgress.total ? (hashProgress.current / hashProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted">
            文件 {fileName}（{fmtSize(fileSize)}）— Worker 线程正在分片并计算各块哈希值
          </p>
        </div>
      )}

      {/* ---- Phase: UPLOADING ---- */}
      {phase === "uploading" && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              正在上传切片（并发 {CONCURRENCY}）
            </span>
            <span className="font-mono tabular-nums">
              {uploadProgress.current}/{uploadProgress.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-fg transition-all duration-200"
              style={{
                width: `${uploadProgress.total ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted">
            已上传 {fmtSize(uploadedSize)} / {fmtSize(fileSize)} · 失败自动重试 {MAX_RETRIES} 次
          </p>
        </div>
      )}

      {/* ---- Phase: DONE ---- */}
      {phase === "done" && result && (
        <div className="mt-8 p-6 bg-card border border-border rounded-lg">
          <p className="text-lg font-semibold">上传完成 ✅</p>
          <p className="mt-1 text-sm text-muted">
            {result.fileName} · {fmtSize(result.size)}
          </p>
          <button
            className="mt-4 text-sm font-medium underline hover:text-muted transition-colors"
            onClick={() => {
              setPhase("idle");
              setResult(null);
              setFileName("");
              setFileSize(0);
              setHashProgress({ current: 0, total: 0 });
              setUploadProgress({ current: 0, total: 0 });
              setUploadedSize(0);
              terminateWorker();
            }}
          >
            再传一个
          </button>
        </div>
      )}

      {/* ---- Phase: ERROR ---- */}
      {phase === "error" && (
        <div className="mt-8 p-6 bg-card border border-red-500/30 rounded-lg">
          <p className="text-lg font-semibold text-red-600">上传失败</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <button
            className="mt-4 text-sm font-medium underline hover:text-muted transition-colors"
            onClick={() => {
              setPhase("idle");
              setError("");
              terminateWorker();
            }}
          >
            重试
          </button>
        </div>
      )}

      {/* Architecture note (educational) */}
      <details className="mt-12 group">
        <summary className="text-xs text-muted cursor-pointer hover:text-fg transition-colors select-none">
          🧠 架构说明（面试向）
        </summary>
        <div className="mt-3 text-xs text-muted leading-relaxed space-y-2 bg-card border border-border rounded-lg p-4">
          <p>
            <strong>Web Worker</strong> — 文件切片 + SHA-256 哈希在独立线程中完成。
            浏览器中 JS 默认单线程，大文件哈希（几百 MB）会阻塞 UI（卡顿、无法交互）。
            Worker 运行在独立线程，完成后通过 <code>postMessage</code> 回传结果，
            主线程保持响应 —— 这是面试高频考点。
          </p>
          <p>
            <strong>切片上传</strong> — 每个 5 MB 为一块独立 POST。好处：
            ① 绕过服务端 body size 限制；
            ② 单块失败只需重传该块，不用重新上传整个文件；
            ③ 并发 3 块提升吞吐。
          </p>
          <p>
            <strong>SHA-256 校验</strong> — 每块计算哈希，服务端可逐块校验完整性。
            全部块上传后服务端合并写入最终文件。
          </p>
          <p>
            <strong>并发控制</strong> — 滑动窗口（sliding window）模式，始终保持{' '}
            {CONCURRENCY} 个请求在飞，完成一个立即补充下一个，
            比 Promise.all 全量爆发更稳定。
          </p>
        </div>
      </details>
    </div>
  );
}
