"use client";

/**
 * image-downscale.ts — shrink an image in the browser before it goes near
 * POST /api/v1/upload (backend note 2026-09-11 §4).
 *
 * Why: a phone photo is 2–8MB, and the API is fronted by nginx whose
 * `client_max_body_size` currently rejects the body before the application
 * ever sees it. That fix is a server change, but a 26MB logo should not reach
 * the wire even once the limit is raised — the stored asset is displayed at a
 * few hundred pixels either way.
 *
 * Deliberately forgiving: anything that goes wrong (an exotic codec, no canvas,
 * a decode failure) returns the ORIGINAL file rather than throwing, so this can
 * never be the reason an upload fails.
 *
 * Not applied to SVG (vector, already tiny), GIF (re-encoding drops the
 * animation), or print-resolution artwork such as certificate templates, where
 * throwing away pixels is the wrong trade.
 */

const RESIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface DownscaleOptions {
  /** Longest edge of the result, in pixels. */
  maxDimension?: number;
  /** JPEG/WebP quality, 0–1. Ignored for PNG (lossless). */
  quality?: number;
  /** Files at or below this size are left alone when already small enough. */
  skipUnderBytes?: number;
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap, release: () => bitmap.close?.() };
  }
  // Safari fallback
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload  = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return {
      width:  img.naturalWidth,
      height: img.naturalHeight,
      draw:   img,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Returns a downscaled copy of `file`, or the original when it is already small
 * enough, is not a raster type worth re-encoding, or anything fails.
 */
export async function downscaleImage(file: File, opts: DownscaleOptions = {}): Promise<File> {
  const maxDimension   = opts.maxDimension   ?? 1024;
  const quality        = opts.quality        ?? 0.8;
  const skipUnderBytes = opts.skipUnderBytes ?? 512 * 1024;

  if (typeof window === "undefined") return file;
  if (!RESIZABLE_TYPES.has(file.type)) return file;

  let bitmap: Awaited<ReturnType<typeof loadBitmap>> | null = null;
  try {
    bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height) return file;

    const longest = Math.max(width, height);
    // Already within budget on both axes and not heavy — leave it untouched
    // rather than re-encoding (which can make a small PNG bigger).
    if (longest <= maxDimension && file.size <= skipUnderBytes) return file;

    const scale = Math.min(1, maxDimension / longest);
    const targetW = Math.max(1, Math.round(width  * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width  = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap.draw, 0, 0, targetW, targetH);

    // PNG stays PNG so logo transparency survives; everything else goes out as
    // JPEG, which is where the real size win is.
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, outType === "image/png" ? undefined : quality)
    );
    if (!blob) return file;

    // A re-encode that didn't actually help is not worth shipping.
    if (blob.size >= file.size) return file;

    const ext  = outType === "image/png" ? "png" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
    return new File([blob], name, { type: outType, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap?.release();
  }
}
