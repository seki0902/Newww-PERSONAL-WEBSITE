import { useEffect, useState } from "react";

const masks = new Map<string, string>();

// Mask only the near-white area connected to the image border, preserving
// enclosed white details (shirt, notebook) and the original image file.
export function usePortraitMask(source: string | undefined) {
  const [mask, setMask] = useState<{ source: string; url: string | null }>();
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    if (masks.has(source)) { setMask({ source, url: masks.get(source)! }); return; }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas masking is unavailable");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = pixels, width = canvas.width, count = width * canvas.height;
        const seen = new Uint8Array(count), queue = new Uint32Array(count);
        let head = 0, tail = 0;
        const visit = (index: number) => {
          if (seen[index]) return;
          seen[index] = 1;
          const offset = index * 4;
          if (Math.min(data[offset], data[offset + 1], data[offset + 2]) < 235) return;
          queue[tail++] = index;
        };
        for (let x = 0; x < width; x++) { visit(x); visit(count - width + x); }
        for (let y = 0; y < canvas.height; y++) { visit(y * width); visit(y * width + width - 1); }
        while (head < tail) {
          const index = queue[head++];
          data[index * 4 + 3] = 0;
          if (index % width) visit(index - 1);
          if (index % width < width - 1) visit(index + 1);
          if (index >= width) visit(index - width);
          if (index < count - width) visit(index + width);
        }
        context.putImageData(pixels, 0, 0);
        const url = canvas.toDataURL();
        masks.set(source, url);
        if (!cancelled) setMask({ source, url });
      } catch {
        if (!cancelled) setMask({ source, url: null });
      }
    };
    image.onerror = () => { if (!cancelled) setMask({ source, url: null }); };
    image.src = source;
    return () => { cancelled = true; };
  }, [source]);
  return mask && mask.source === source ? mask.url : undefined;
}
