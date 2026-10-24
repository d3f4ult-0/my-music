// Universal Lyrics Service: IndexedDB Persistence + LRCLIB Public API Sync
import { openOfflineDB } from '../hooks/useOfflineManager';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  song_id: number;
  title?: string;
  artist?: string;
  synced: boolean;
  provider?: string;
  lines?: LyricLine[];
  raw_text?: string;
}

const LYRICS_STORE_NAME = 'offline_lyrics';
const LOCAL_STORAGE_PREFIX = 'mymusic_lyrics_';

/**
 * Parse LRC text format: [mm:ss.xx] lyric text
 */
export function parseLrc(lrcText: string): { synced: boolean; lines: LyricLine[]; raw_text: string } {
  if (!lrcText || typeof lrcText !== 'string') {
    return { synced: false, lines: [], raw_text: '' };
  }

  const lines = lrcText.split(/\r?\n/);
  const parsedLines: LyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  let hasTimestamp = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for timestamps
    const matches = Array.from(trimmed.matchAll(timeRegex));
    if (matches.length > 0) {
      hasTimestamp = true;
      const text = trimmed.replace(timeRegex, '').trim();

      for (const match of matches) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        let ms = 0;
        if (match[3]) {
          ms = match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3].slice(0, 3), 10);
        }
        const timeInSeconds = mins * 60 + secs + ms / 1000;
        parsedLines.push({ time: timeInSeconds, text });
      }
    }
  }

  if (hasTimestamp && parsedLines.length > 0) {
    parsedLines.sort((a, b) => a.time - b.time);
    return {
      synced: true,
      lines: parsedLines,
      raw_text: lrcText,
    };
  }

  // Fallback: Plain unsynced text
  return {
    synced: false,
    lines: lines.map((l, i) => ({ time: i * 4, text: l.trim() })).filter((l) => l.text.length > 0),
    raw_text: lrcText,
  };
}

/**
 * Fetch lyrics from public LRCLIB instance (free, CORS-ready)
 */
export async function fetchLyricsFromLrclib(
  title: string,
  artist?: string,
  duration?: number
): Promise<LyricsData | null> {
  if (!title) return null;

  try {
    const cleanTitle = title.replace(/\.(mp3|flac|wav|m4a|ogg)$/i, '').trim();
    const cleanArtist = (artist || '').replace(/Local Artist|Unknown Artist/i, '').trim();

    // 1. Try exact match
    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}`;
    if (cleanArtist) {
      url += `&artist_name=${encodeURIComponent(cleanArtist)}`;
    }
    if (duration && duration > 0) {
      url += `&duration=${Math.round(duration)}`;
    }

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        const parsed = parseLrc(data.syncedLyrics);
        return {
          song_id: 0,
          title: cleanTitle,
          artist: cleanArtist,
          synced: true,
          provider: 'LRCLIB (Synced)',
          lines: parsed.lines,
          raw_text: data.syncedLyrics,
        };
      } else if (data.plainLyrics) {
        const parsed = parseLrc(data.plainLyrics);
        return {
          song_id: 0,
          title: cleanTitle,
          artist: cleanArtist,
          synced: false,
          provider: 'LRCLIB (Plain)',
          lines: parsed.lines,
          raw_text: data.plainLyrics,
        };
      }
    }

    // 2. Fallback: Search endpoint
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim())}`;
    const searchRes = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
    if (searchRes.ok) {
      const results: any[] = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        // Find best match with synced lyrics
        const best = results.find((r) => r.syncedLyrics) || results[0];
        const lrc = best.syncedLyrics || best.plainLyrics;
        if (lrc) {
          const parsed = parseLrc(lrc);
          return {
            song_id: 0,
            title: best.trackName || cleanTitle,
            artist: best.artistName || cleanArtist,
            synced: !!best.syncedLyrics,
            provider: best.syncedLyrics ? 'LRCLIB (Synced Search)' : 'LRCLIB (Plain Search)',
            lines: parsed.lines,
            raw_text: lrc,
          };
        }
      }
    }
  } catch (err) {
    console.warn('LRCLIB fetch error:', err);
  }

  return null;
}

/**
 * Save lyrics to offline storage (IndexedDB + localStorage backup)
 */
export async function saveLyricsForSong(
  songId: number,
  lyricsText: string,
  title?: string,
  artist?: string
): Promise<LyricsData> {
  const parsed = parseLrc(lyricsText);
  const data: LyricsData = {
    song_id: songId,
    title,
    artist,
    synced: parsed.synced,
    provider: parsed.synced ? 'Synced LRC' : 'User Lyrics',
    lines: parsed.lines,
    raw_text: lyricsText,
  };

  // 1. Save to localStorage backup
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + songId, JSON.stringify(data));
  } catch {}

  // 2. Save to IndexedDB
  try {
    const db = await openOfflineDB();
    if (db.objectStoreNames.contains(LYRICS_STORE_NAME)) {
      const tx = db.transaction(LYRICS_STORE_NAME, 'readwrite');
      tx.objectStore(LYRICS_STORE_NAME).put(data);
    }
  } catch (err) {
    console.warn('IndexedDB save lyrics failed, localStorage used:', err);
  }

  return data;
}

/**
 * Retrieve lyrics for a song (Offline IndexedDB first -> LocalStorage -> LRCLIB public API)
 */
export async function getLyricsForSong(
  songId: number,
  title?: string,
  artist?: string,
  duration?: number
): Promise<LyricsData | null> {
  // 1. Check IndexedDB
  try {
    const db = await openOfflineDB();
    if (db.objectStoreNames.contains(LYRICS_STORE_NAME)) {
      const tx = db.transaction(LYRICS_STORE_NAME, 'readonly');
      const store = tx.objectStore(LYRICS_STORE_NAME);
      const req = store.get(songId);
      const result: LyricsData = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (result && (result.lines?.length || result.raw_text)) {
        return result;
      }
    }
  } catch {}

  // 2. Check localStorage backup
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_PREFIX + songId);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.lines?.length || parsed.raw_text)) {
        return parsed;
      }
    }
  } catch {}

  // 3. If online and title is provided, auto-fetch from LRCLIB
  if (navigator.onLine && title) {
    const lrclibData = await fetchLyricsFromLrclib(title, artist, duration);
    if (lrclibData) {
      lrclibData.song_id = songId;
      // Cache it permanently offline!
      saveLyricsForSong(songId, lrclibData.raw_text || '', title, artist).catch(() => {});
      return lrclibData;
    }
  }

  return null;
}

/**
 * Delete lyrics for a song
 */
export async function deleteLyricsForSong(songId: number): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_PREFIX + songId);
  } catch {}

  try {
    const db = await openOfflineDB();
    if (db.objectStoreNames.contains(LYRICS_STORE_NAME)) {
      const tx = db.transaction(LYRICS_STORE_NAME, 'readwrite');
      tx.objectStore(LYRICS_STORE_NAME).delete(songId);
    }
  } catch {}
}
