/**
 * High-performance, pure TypeScript audio metadata extractor.
 * Extracts ID3v2 (MP3), Vorbis/FLAC, and iTunes/MP4 (M4A) metadata and embedded cover art.
 * Generates unique, aesthetic album cover art if none is embedded.
 */

export interface ExtractedAudioMetadata {
  title: string;
  artist: string;
  album: string;
  trackNumber?: number;
  year?: number;
  genre?: string;
  coverBlob?: Blob;
  coverUrl: string;
  codec: string;
  duration: number;
}

// 12 Gorgeous Modern Album Art Gradients for tracks without embedded art
const AESTHETIC_GRADIENTS = [
  { from: '#4f46e5', to: '#7c3aed', accent: '#a855f7', name: 'Cosmic Indigo' },
  { from: '#0284c7', to: '#0d9488', accent: '#38bdf8', name: 'Cyan Glacier' },
  { from: '#059669', to: '#10b981', accent: '#34d399', name: 'Emerald Wave' },
  { from: '#ea580c', to: '#e11d48', accent: '#fb7185', name: 'Sunset Glow' },
  { from: '#9333ea', to: '#db2777', accent: '#f472b6', name: 'Neon Synth' },
  { from: '#b91c1c', to: '#7f1d1d', accent: '#f87171', name: 'Crimson Velvet' },
  { from: '#d97706', to: '#b45309', accent: '#fbbf24', name: 'Warm Amber' },
  { from: '#2563eb', to: '#1d4ed8', accent: '#60a5fa', name: 'Cobalt Night' },
  { from: '#0f766e', to: '#115e59', accent: '#2dd4bf', name: 'Deep Teal' },
  { from: '#6366f1', to: '#4338ca', accent: '#818cf8', name: 'Electric Purple' },
  { from: '#be185d', to: '#831843', accent: '#fb7185', name: 'Magenta Dusk' },
  { from: '#334155', to: '#1e293b', accent: '#94a3b8', name: 'Slate Obsidian' },
];

function stringHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generates an SVG data URL album cover with gradient, vinyl grooves, and clean typography.
 */
export function generateAlbumCover(title: string, artist: string, album: string): string {
  const hash = stringHashCode(`${album || title}_${artist}`);
  const palette = AESTHETIC_GRADIENTS[hash % AESTHETIC_GRADIENTS.length];

  const albumName = album || title || 'Music';
  const artistName = artist || 'Artist';

  // Get monogram initials
  const initials = albumName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'M';

  const cleanAlbum = albumName.length > 22 ? albumName.slice(0, 20) + '...' : albumName;
  const cleanArtist = artistName.length > 25 ? artistName.slice(0, 23) + '...' : artistName;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.from}" />
        <stop offset="100%" stop-color="${palette.to}" />
      </linearGradient>
      <radialGradient id="vinyl" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#000" stop-opacity="0" />
        <stop offset="60%" stop-color="#000" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#000" stop-opacity="0.45" />
      </radialGradient>
    </defs>
    <rect width="500" height="500" fill="url(#grad)" rx="24" />
    <rect width="500" height="500" fill="url(#vinyl)" rx="24" />

    <!-- Vinyl concentric subtle rings -->
    <circle cx="250" cy="210" r="160" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2" />
    <circle cx="250" cy="210" r="120" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
    <circle cx="250" cy="210" r="80" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
    <circle cx="250" cy="210" r="42" fill="rgba(0,0,0,0.35)" stroke="${palette.accent}" stroke-width="3" />
    <circle cx="250" cy="210" r="14" fill="#0b0f19" />

    <!-- Monogram Header -->
    <text x="250" y="222" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="${palette.accent}" text-anchor="middle" letter-spacing="2">
      ${initials}
    </text>

    <!-- Bottom Typography Card -->
    <rect x="28" y="385" width="444" height="88" rx="14" fill="rgba(0,0,0,0.4)" backdrop-filter="blur(10px)" />
    <text x="48" y="425" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="22" fill="#ffffff">
      ${cleanAlbum.replace(/&/g, '&amp;').replace(/</g, '&lt;')}
    </text>
    <text x="48" y="452" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="15" fill="rgba(255,255,255,0.75)">
      ${cleanArtist.replace(/&/g, '&amp;').replace(/</g, '&lt;')}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function decodeText(data: Uint8Array): string {
  if (data.length <= 1) return '';
  const encoding = data[0];
  const bytes = data.subarray(1);

  try {
    if (encoding === 0) {
      let end = bytes.indexOf(0);
      const slice = end === -1 ? bytes : bytes.subarray(0, end);
      return new TextDecoder('iso-8859-1').decode(slice).trim();
    } else if (encoding === 1) {
      return new TextDecoder('utf-16').decode(bytes).replace(/\0.*$/, '').trim();
    } else if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/\0.*$/, '').trim();
    } else if (encoding === 3) {
      let end = bytes.indexOf(0);
      const slice = end === -1 ? bytes : bytes.subarray(0, end);
      return new TextDecoder('utf-8').decode(slice).trim();
    }
  } catch {
    return new TextDecoder('utf-8').decode(bytes).replace(/\0.*$/, '').trim();
  }
  return '';
}

// Parse ID3v2 Tags (MP3)
function parseID3v2(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> {
  const view = new DataView(buffer);
  if (buffer.byteLength < 10) return {};

  if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
    return {};
  }

  const version = view.getUint8(3);
  const flags = view.getUint8(5);
  const tagSize =
    ((view.getUint8(6) & 0x7f) << 21) |
    ((view.getUint8(7) & 0x7f) << 14) |
    ((view.getUint8(8) & 0x7f) << 7) |
    (view.getUint8(9) & 0x7f);

  let offset = 10;
  if ((flags & 0x40) !== 0 && offset + 4 <= buffer.byteLength) {
    const extSize =
      version === 4
        ? ((view.getUint8(10) & 0x7f) << 21) |
          ((view.getUint8(11) & 0x7f) << 14) |
          ((view.getUint8(12) & 0x7f) << 7) |
          (view.getUint8(13) & 0x7f)
        : view.getUint32(10);
    offset += extSize;
  }

  const result: Partial<ExtractedAudioMetadata> = {};
  const maxOffset = Math.min(buffer.byteLength, 10 + tagSize);

  while (offset + 10 < maxOffset) {
    const frameId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );

    if (view.getUint8(offset) === 0) break;

    let frameSize = 0;
    if (version === 4) {
      frameSize =
        ((view.getUint8(offset + 4) & 0x7f) << 21) |
        ((view.getUint8(offset + 5) & 0x7f) << 14) |
        ((view.getUint8(offset + 6) & 0x7f) << 7) |
        (view.getUint8(offset + 7) & 0x7f);
    } else {
      frameSize = view.getUint32(offset + 4);
    }

    if (frameSize <= 0 || offset + 10 + frameSize > buffer.byteLength) {
      break;
    }

    const frameData = new Uint8Array(buffer, offset + 10, frameSize);
    offset += 10 + frameSize;

    if (frameId.startsWith('T') && frameId !== 'TXXX') {
      const text = decodeText(frameData);
      if (text) {
        if (frameId === 'TIT2') result.title = text;
        else if (frameId === 'TPE1' || frameId === 'TPE2') {
          if (!result.artist) result.artist = text;
        } else if (frameId === 'TALB') result.album = text;
        else if (frameId === 'TYER' || frameId === 'TDRC') {
          const yr = parseInt(text.substring(0, 4), 10);
          if (!isNaN(yr)) result.year = yr;
        } else if (frameId === 'TRCK') {
          const trk = parseInt(text.split('/')[0], 10);
          if (!isNaN(trk)) result.trackNumber = trk;
        } else if (frameId === 'TCON') result.genre = text;
      }
    } else if (frameId === 'APIC') {
      try {
        const encoding = frameData[0];
        let mimeEnd = 1;
        while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0) {
          mimeEnd++;
        }
        const mimeType =
          new TextDecoder('ascii').decode(frameData.subarray(1, mimeEnd)) || 'image/jpeg';
        let pos = mimeEnd + 1;
        pos++; // Skip picture type byte

        if (encoding === 0 || encoding === 3) {
          while (pos < frameData.length && frameData[pos] !== 0) pos++;
          pos++;
        } else if (encoding === 1 || encoding === 2) {
          while (pos + 1 < frameData.length && (frameData[pos] !== 0 || frameData[pos + 1] !== 0)) {
            pos += 2;
          }
          pos += 2;
        }

        if (pos < frameData.length) {
          const imgBytes = frameData.subarray(pos);
          if (imgBytes.length > 32) {
            result.coverBlob = new Blob([imgBytes], {
              type: mimeType.includes('/') ? mimeType : 'image/jpeg',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to parse APIC frame:', err);
      }
    }
  }

  return result;
}

// Parse FLAC Metadata
function parseFLAC(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> {
  const view = new DataView(buffer);
  if (buffer.byteLength < 4) return {};

  if (
    view.getUint8(0) !== 0x66 ||
    view.getUint8(1) !== 0x4c ||
    view.getUint8(2) !== 0x61 ||
    view.getUint8(3) !== 0x43
  ) {
    return {};
  }

  const result: Partial<ExtractedAudioMetadata> = {};
  let offset = 4;

  while (offset + 4 <= buffer.byteLength) {
    const header = view.getUint8(offset);
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const length = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
    offset += 4;

    if (offset + length > buffer.byteLength) break;

    if (blockType === 4) {
      // VORBIS_COMMENT
      try {
        let p = offset;
        const vendorLen = view.getUint32(p, true);
        p += 4 + vendorLen;
        const commentCount = view.getUint32(p, true);
        p += 4;

        for (let i = 0; i < commentCount && p + 4 <= offset + length; i++) {
          const cLen = view.getUint32(p, true);
          p += 4;
          if (p + cLen > offset + length) break;
          const comment = new TextDecoder('utf-8').decode(new Uint8Array(buffer, p, cLen));
          p += cLen;

          const eqIdx = comment.indexOf('=');
          if (eqIdx !== -1) {
            const key = comment.substring(0, eqIdx).toUpperCase();
            const val = comment.substring(eqIdx + 1).trim();
            if (key === 'TITLE') result.title = val;
            else if (key === 'ARTIST') result.artist = val;
            else if (key === 'ALBUM') result.album = val;
            else if (key === 'TRACKNUMBER') result.trackNumber = parseInt(val, 10) || undefined;
            else if (key === 'DATE') result.year = parseInt(val.substring(0, 4), 10) || undefined;
            else if (key === 'GENRE') result.genre = val;
          }
        }
      } catch (err) {
        console.warn('Error reading FLAC Vorbis comment:', err);
      }
    } else if (blockType === 6) {
      // PICTURE
      try {
        let p = offset;
        p += 4; // Skip picture type
        const mimeLen = view.getUint32(p, false);
        p += 4;
        const mimeType = new TextDecoder('ascii').decode(new Uint8Array(buffer, p, mimeLen)) || 'image/jpeg';
        p += mimeLen;
        const descLen = view.getUint32(p, false);
        p += 4 + descLen;
        p += 16; // Skip width, height, depth, colors
        const dataLen = view.getUint32(p, false);
        p += 4;

        if (p + dataLen <= offset + length) {
          const imgBytes = new Uint8Array(buffer, p, dataLen);
          result.coverBlob = new Blob([imgBytes], { type: mimeType });
        }
      } catch (err) {
        console.warn('Error reading FLAC picture block:', err);
      }
    }

    if (isLast) break;
    offset += length;
  }

  return result;
}

// Parse M4A / MP4 (AAC / ALAC)
function parseM4A(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8) return {};

  const result: Partial<ExtractedAudioMetadata> = {};

  function searchAtoms(start: number, end: number) {
    let p = start;
    while (p + 8 <= end) {
      const size = view.getUint32(p);
      const name = String.fromCharCode(
        view.getUint8(p + 4),
        view.getUint8(p + 5),
        view.getUint8(p + 6),
        view.getUint8(p + 7)
      );

      if (size < 8 || p + size > end) break;

      if (['moov', 'udta', 'meta', 'ilst'].includes(name)) {
        const subStart = name === 'meta' ? p + 12 : p + 8;
        searchAtoms(subStart, p + size);
      } else if (name === '©nam') {
        const val = readDataAtomText(p + 8, p + size);
        if (val) result.title = val;
      } else if (name === '©ART' || name === 'aART') {
        const val = readDataAtomText(p + 8, p + size);
        if (val && !result.artist) result.artist = val;
      } else if (name === '©alb') {
        const val = readDataAtomText(p + 8, p + size);
        if (val) result.album = val;
      } else if (name === 'trkn') {
        if (p + 16 <= p + size) {
          const trk = view.getUint16(p + 16 + 2);
          if (trk) result.trackNumber = trk;
        }
      } else if (name === 'covr') {
        // Picture data atom
        let dp = p + 8;
        if (dp + 8 <= p + size) {
          const dSize = view.getUint32(dp);
          const dName = String.fromCharCode(
            view.getUint8(dp + 4),
            view.getUint8(dp + 5),
            view.getUint8(dp + 6),
            view.getUint8(dp + 7)
          );
          if (dName === 'data' && dSize > 16) {
            const flag = view.getUint32(dp + 8);
            const mime = flag === 14 ? 'image/png' : 'image/jpeg';
            const imgBytes = new Uint8Array(buffer, dp + 16, dSize - 16);
            result.coverBlob = new Blob([imgBytes], { type: mime });
          }
        }
      }

      p += size;
    }
  }

  function readDataAtomText(start: number, end: number): string | null {
    let p = start;
    if (p + 8 <= end) {
      const dSize = view.getUint32(p);
      const dName = String.fromCharCode(
        view.getUint8(p + 4),
        view.getUint8(p + 5),
        view.getUint8(p + 6),
        view.getUint8(p + 7)
      );
      if (dName === 'data' && dSize > 16 && p + dSize <= end) {
        return new TextDecoder('utf-8').decode(new Uint8Array(buffer, p + 16, dSize - 16)).trim();
      }
    }
    return null;
  }

  try {
    searchAtoms(0, buffer.byteLength);
  } catch (err) {
    console.warn('Error reading M4A atoms:', err);
  }

  return result;
}

export function parseFilenameFallback(filename: string): { title: string; artist: string; album: string } {
  let base = filename.replace(/\.[^/.]+$/, '').trim();
  base = base.replace(/^[0-9]+[\s._\-–—]+/, '').trim();
  base = base.replace(
    /\s*[\(\[](official\s*(audio|video|music video)|audio|lyrics?|320\s*kbps|1080p|720p|hq|hd)[\)\]]/gi,
    ''
  ).trim();

  const separatorMatch = base.match(/\s+[-–—]\s+/);
  if (separatorMatch && separatorMatch.index) {
    const artist = base.substring(0, separatorMatch.index).trim();
    const title = base.substring(separatorMatch.index + separatorMatch[0].length).trim();
    if (artist && title) {
      return {
        artist: artist.replace(/_/g, ' '),
        title: title.replace(/_/g, ' '),
        album: 'Single',
      };
    }
  }

  return {
    title: base.replace(/_/g, ' ').trim() || 'Unknown Track',
    artist: 'Device Audio',
    album: 'Device Music',
  };
}

export function detectCodec(filename: string, mimeType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'flac':
      return 'FLAC (Lossless)';
    case 'wav':
      return 'WAV (Lossless)';
    case 'm4a':
    case 'aac':
      return 'AAC / M4A';
    case 'mp3':
      return 'MP3 (320kbps)';
    case 'ogg':
      return 'OGG Vorbis';
    case 'opus':
      return 'Opus';
    default:
      return ext ? ext.toUpperCase() : 'Audio';
  }
}

export function probeAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;

      let resolved = false;
      const done = (dur: number) => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
          resolve(dur);
        }
      };

      audio.onloadedmetadata = () => {
        const d = Math.round(audio.duration);
        done(isNaN(d) ? 0 : d);
      };

      audio.onerror = () => done(0);
      setTimeout(() => done(0), 3000);
    } catch {
      resolve(0);
    }
  });
}

/**
 * Main extractor: reads header tags (first 512KB for speed) and returns complete metadata and cover art.
 */
export async function extractFullAudioMetadata(file: File): Promise<ExtractedAudioMetadata> {
  // Read first 512KB to parse ID3/FLAC/MP4 header tags without reading 50MB into memory
  const headerSlice = file.slice(0, Math.min(file.size, 512 * 1024));
  const buffer = await headerSlice.arrayBuffer();

  let parsed: Partial<ExtractedAudioMetadata> = {};
  const filename = file.name;
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.mp3')) {
    parsed = parseID3v2(buffer);
  } else if (lowerName.endsWith('.flac')) {
    parsed = parseFLAC(buffer);
  } else if (lowerName.endsWith('.m4a') || lowerName.endsWith('.aac') || lowerName.endsWith('.mp4')) {
    parsed = parseM4A(buffer);
  } else {
    // Try ID3 first, then FLAC, then M4A
    parsed = parseID3v2(buffer);
    if (!parsed.title && !parsed.artist) {
      parsed = parseFLAC(buffer);
    }
    if (!parsed.title && !parsed.artist) {
      parsed = parseM4A(buffer);
    }
  }

  // Duration probe
  const duration = await probeAudioDuration(file);
  const fallback = parseFilenameFallback(filename);

  const title = (parsed.title || fallback.title).trim();
  const artist = (parsed.artist || fallback.artist).trim();
  const album = (parsed.album || fallback.album).trim();
  const codec = detectCodec(filename, file.type);

  let coverUrl = '';
  if (parsed.coverBlob) {
    coverUrl = URL.createObjectURL(parsed.coverBlob);
  } else {
    // Generate distinct aesthetic album cover (NOT the app icon!)
    coverUrl = generateAlbumCover(title, artist, album);
  }

  return {
    title,
    artist,
    album,
    trackNumber: parsed.trackNumber,
    year: parsed.year,
    genre: parsed.genre,
    coverBlob: parsed.coverBlob,
    coverUrl,
    codec,
    duration: duration || 180,
  };
}
