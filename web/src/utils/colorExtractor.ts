import { resolveAssetUrl } from '../api/client';

/**
 * Extracts a dominant, vibrant accent color from an image URL using offscreen canvas.
 * Falls back to deterministic hash colors if canvas is blocked by CORS.
 */

const FALLBACK_PALETTES = [
  '#1e3a5f', // Deep Indigo / Blue (like Linkin Park A Thousand Suns)
  '#3b224c', // Deep Purple / Violet
  '#1c4332', // Emerald Forest
  '#4a2810', // Warm Amber
  '#4a1525', // Crimson Dusk
  '#2a3b4c', // Slate Teal
];

export async function extractDominantColor(imageUrl: string | null | undefined): Promise<string> {
  const resolved = resolveAssetUrl(imageUrl);
  if (!resolved) {
    return '#1e3a5f';
  }

  // If local seed / storage URL or accessible image, try canvas sampling
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    const fallback = () => {
      // Deterministic fallback based on string hash
      let hash = 0;
      for (let i = 0; i < resolved.length; i++) {
        hash = (hash << 5) - hash + resolved.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % FALLBACK_PALETTES.length;
      resolve(FALLBACK_PALETTES[idx]);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return fallback();

        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const data = ctx.getImageData(0, 0, 40, 40).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 16) {
          const red = data[i];
          const green = data[i + 1];
          const blue = data[i + 2];
          // Skip pure black, pure white, and low-saturation grays
          const max = Math.max(red, green, blue);
          const min = Math.min(red, green, blue);
          const sat = max === 0 ? 0 : (max - min) / max;
          const brightness = (red + green + blue) / 3;

          if (brightness > 20 && brightness < 235 && sat > 0.15) {
            r += red;
            g += green;
            b += blue;
            count++;
          }
        }

        // Clean up canvas memory immediately for low-end mobile devices
        canvas.width = 0;
        canvas.height = 0;

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          const toHex = (n: number) => n.toString(16).padStart(2, '0');
          resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
        } else {
          fallback();
        }
      } catch (err) {
        fallback();
      }
    };

    img.onerror = fallback;
    img.src = resolved;
  });
}
