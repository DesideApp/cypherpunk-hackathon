// src/wallet-adapter/core/utils/useAvatarUpload.ts
export type AvatarUploadHandlers = {
  /** Devuelve URL de subida + clave + URL CDN final */
  getUploadUrl: (args: { mime: string; size: number }) =>
    Promise<{ putUrl: string; key: string; cdnUrl: string }>;
  /** (Opcional) callback para telemetry/audit en host */
  onUploaded?: (info: { key: string; cdnUrl: string }) => void | Promise<void>;
};

/** Reescala a 512x512, centra y exporta a WebP (fallback PNG). */
export async function optimizeAvatar(input: Blob, size = 512): Promise<Blob> {
  const url = URL.createObjectURL(input);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - s) / 2;
    const sy = (img.naturalHeight - s) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);

    const blob = await new Promise<Blob>((ok) =>
      canvas.toBlob((b) => ok(b || input), 'image/webp', 0.85)
    );
    return blob || input;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Helper agnóstico: optimiza y sube directo al storage, devuelve la URL CDN. */
export function useAvatarUpload(handlers: AvatarUploadHandlers) {
  return {
    async upload(file: File) {
      const optimized = await optimizeAvatar(file, 512);
      const { putUrl, key, cdnUrl } = await handlers.getUploadUrl({
        mime: optimized.type || 'image/webp',
        size: optimized.size,
      });
      await fetch(putUrl, {
        method: 'PUT',
        body: optimized,
        headers: { 'Content-Type': optimized.type || 'image/webp' },
      });
      await handlers.onUploaded?.({ key, cdnUrl });
      return cdnUrl; // Esto es lo que guardas en tu JSON on-chain
    },
  };
}
