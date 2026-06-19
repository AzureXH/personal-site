import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { existsSync } from "fs";
import { mkdir, writeFile, readFile, readdir, unlink, rmdir } from "fs/promises";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

/** Sanitise filename — strip path separators and keep only safe chars */
function safeName(name: string): string {
  // Get basename to drop any path components
  const base = name.replace(/^.*[/\\]/, "");
  // Remove null bytes and other dangerous chars
  return base.replace(/[^a-zA-Z0-9._\- ()]/g, "_").slice(0, 255);
}

/** Temp dir for a given upload session */
function tempDir(fileId: string): string {
  return join(UPLOAD_DIR, "temp", fileId);
}

/** Final file path */
function finalPath(fileId: string, fileName: string): string {
  const safe = safeName(fileName);
  return join(UPLOAD_DIR, `${fileId}_${safe}`);
}

/**
 * POST /api/upload
 * Receives a single chunk. FormData fields:
 *   fileId      — unique client-generated session id
 *   fileName    — original filename
 *   chunkIndex  — 0-based chunk number
 *   totalChunks — total chunk count
 *   chunk       — the Blob
 */
export async function POST(request: NextRequest) {
  try {
    const fd = await request.formData();

    const fileId = fd.get("fileId")?.toString() ?? "";
    const fileName = fd.get("fileName")?.toString() ?? "";
    const chunkIndex = parseInt(fd.get("chunkIndex")?.toString() ?? "", 10);
    const totalChunks = parseInt(fd.get("totalChunks")?.toString() ?? "", 10);
    const chunk = fd.get("chunk") as Blob | null;

    // Validate
    if (!fileId || !fileName || !chunk) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex < 0 || totalChunks <= 0) {
      return NextResponse.json({ error: "Invalid chunkIndex or totalChunks" }, { status: 400 });
    }
    // Prevent large fileId / totalChunks abuse
    if (fileId.length > 128 || totalChunks > 10000) {
      return NextResponse.json({ error: "Parameters out of range" }, { status: 400 });
    }

    // Ensure temp dir exists
    const dir = tempDir(fileId);
    await mkdir(dir, { recursive: true });

    // Write chunk to disk
    const chunkBuf = Buffer.from(await chunk.arrayBuffer());
    const chunkPath = join(dir, `chunk_${chunkIndex}`);
    await writeFile(chunkPath, chunkBuf);

    // Check if this was the last chunk
    const isLastChunk = chunkIndex === totalChunks - 1;

    if (isLastChunk) {
      // Merge all chunks into final file
      const final = finalPath(fileId, fileName);
      await mkdir(UPLOAD_DIR, { recursive: true });

      // Write chunks in order
      const chunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const p = join(dir, `chunk_${i}`);
        if (!existsSync(p)) {
          return NextResponse.json(
            { error: `Missing chunk ${i}, expected ${totalChunks} chunks` },
            { status: 409 },
          );
        }
        chunks.push(await readFile(p));
      }
      const merged = Buffer.concat(chunks);
      await writeFile(final, merged);

      // Clean up temp dir
      for (let i = 0; i < totalChunks; i++) {
        await unlink(join(dir, `chunk_${i}`)).catch(() => {});
      }
      await rmdir(dir).catch(() => {});

      return NextResponse.json({
        success: true,
        complete: true,
        fileName: safeName(fileName),
        size: merged.length,
      });
    }

    return NextResponse.json({
      success: true,
      complete: false,
      chunkIndex,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/upload?fileId=xxx
 * Returns how many chunks have been received so far.
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  const dir = tempDir(fileId);
  if (!existsSync(dir)) {
    return NextResponse.json({ received: 0 });
  }

  const files = await readdir(dir);
  const chunkNums = files
    .filter((f) => f.startsWith("chunk_"))
    .map((f) => parseInt(f.slice(6), 10))
    .filter((n) => !isNaN(n));

  return NextResponse.json({ received: chunkNums.length, chunks: chunkNums.sort((a, b) => a - b) });
}
