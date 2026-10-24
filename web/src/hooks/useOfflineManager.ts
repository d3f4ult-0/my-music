import { useState, useEffect, useCallback, useRef } from 'react';
import { Song, OfflineTrack } from '../types';

const DB_NAME = 'mymusic_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_tracks';

export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineTrackBlob(songId: number): Promise<Blob | null> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(songId);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        resolve(req.result?.blob || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function probeAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;

      let settled = false;
      const finish = (duration: number) => {
        if (!settled) {
          settled = true;
          URL.revokeObjectURL(url);
          resolve(duration);
        }
      };

      audio.onloadedmetadata = () => {
        const d = Math.round(audio.duration);
        finish(isNaN(d) ? 0 : d);
      };

      audio.onerror = () => finish(0);

      setTimeout(() => finish(0), 3000);
    } catch {
      resolve(0);
    }
  });
}

export function parseAudioFilename(filename: string): { title: string; artist: string } {
  // Strip file extension
  let base = filename.replace(/\.[^/.]+$/, '').trim();

  // Remove common leading track numbers like "01. ", "01 - ", "01_", "[01] "
  base = base.replace(/^[0-9]+[\s._\-–—]+/, '').trim();

  // Remove common noisy tags
  base = base.replace(/\s*[\(\[](official\s*(audio|video|music video)|audio|lyrics?|320\s*kbps|1080p|720p|hq|hd)[\)\]]/gi, '').trim();

  // Check if " - ", " – ", or " — " exists separating Artist and Title
  const separatorMatch = base.match(/\s+[-–—]\s+/);
  if (separatorMatch && separatorMatch.index) {
    const artist = base.substring(0, separatorMatch.index).trim();
    const title = base.substring(separatorMatch.index + separatorMatch[0].length).trim();
    if (artist && title) {
      return {
        artist: artist.replace(/_/g, ' '),
        title: title.replace(/_/g, ' '),
      };
    }
  }

  // Fallback: title from base, clean underscores
  const cleanTitle = base.replace(/_/g, ' ').trim() || 'Unknown Track';
  return {
    title: cleanTitle,
    artist: 'Device Audio',
  };
}

export function getCodecFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'flac':
      return 'FLAC (Lossless)';
    case 'wav':
      return 'WAV (Lossless)';
    case 'mp3':
      return 'MP3';
    case 'm4a':
      return 'AAC / M4A';
    case 'aac':
      return 'AAC';
    case 'ogg':
      return 'OGG Vorbis';
    case 'opus':
      return 'Opus';
    default:
      return ext ? ext.toUpperCase() : 'Audio';
  }
}

export interface ScanProgress {
  current: number;
  total: number;
  currentFile: string;
}

export function useOfflineManager() {
  const [offlineTracks, setOfflineTracks] = useState<OfflineTrack[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  // Track active blob URLs to clean up and prevent memory leaks
  const activeBlobUrlsRef = useRef<string[]>([]);

  const loadOfflineTracks = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        // Clean up previous blob URLs
        activeBlobUrlsRef.current.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch {}
        });
        activeBlobUrlsRef.current = [];

        const records: any[] = req.result || [];
        const newUrls: string[] = [];

        const mapped: OfflineTrack[] = records.map((r) => {
          const blobUrl = r.blob ? URL.createObjectURL(r.blob) : undefined;
          if (blobUrl) {
            newUrls.push(blobUrl);
          }

          const song: Song = {
            ...r.song,
            stream_url: blobUrl || r.song?.stream_url,
          };

          return {
            id: r.id,
            song,
            downloaded_at: r.downloaded_at,
            blob_url: blobUrl,
            size_bytes: r.size_bytes || (r.blob ? r.blob.size : 0),
          };
        });

        activeBlobUrlsRef.current = newUrls;
        setOfflineTracks(mapped);
      };
    } catch (err) {
      console.warn('Failed to load offline tracks:', err);
    }
  }, []);

  useEffect(() => {
    loadOfflineTracks();

    return () => {
      activeBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      activeBlobUrlsRef.current = [];
    };
  }, [loadOfflineTracks]);

  // Scan & import local audio files from device
  const scanDeviceFiles = async (fileList: FileList | File[]): Promise<number> => {
    const files = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      return (
        f.type.startsWith('audio/') ||
        name.endsWith('.mp3') ||
        name.endsWith('.flac') ||
        name.endsWith('.wav') ||
        name.endsWith('.m4a') ||
        name.endsWith('.aac') ||
        name.endsWith('.ogg') ||
        name.endsWith('.opus') ||
        name.endsWith('.wma')
      );
    });

    if (files.length === 0) {
      return 0;
    }

    setIsScanning(true);
    setScanProgress({ current: 0, total: files.length, currentFile: '' });

    try {
      const db = await openOfflineDB();
      let importedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setScanProgress({ current: i + 1, total: files.length, currentFile: file.name });

        const duration = await probeAudioDuration(file);
        const { title, artist } = parseAudioFilename(file.name);
        const codec = getCodecFromFilename(file.name);

        // Generate persistent integer ID based on file timestamp and size
        const uniqueId = Math.abs(
          ((file.lastModified || Date.now()) ^ (file.size << 5) ^ Math.floor(Math.random() * 100000))
        );

        const song: Song = {
          id: uniqueId,
          title: title,
          duration: duration || 180,
          audio_key: `device-${uniqueId}`,
          cover_url: '/icon-512.png',
          download_allowed: true,
          is_favorite: false,
          artist: {
            id: uniqueId,
            name: artist,
            image_url: '/icon-512.png',
          },
          album_title: 'Device Music',
          codec: codec,
          bitrate: undefined,
        };

        const record = {
          id: uniqueId,
          song,
          blob: file,
          downloaded_at: new Date().toISOString(),
          size_bytes: file.size,
          source: 'device_scan',
          filename: file.name,
        };

        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);

        await new Promise((resolve) => {
          tx.oncomplete = resolve;
        });

        importedCount++;
      }

      await loadOfflineTracks();
      return importedCount;
    } catch (err: any) {
      console.error('Error importing device files:', err);
      throw err;
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  // Download track from current backend server
  const downloadForOffline = async (song: Song) => {
    if (!song.download_allowed) {
      alert('Downloads are not enabled for this song.');
      return;
    }

    setDownloadingIds((prev) => new Set(prev).add(song.id));
    try {
      const token = localStorage.getItem('mymusic_token');
      const res = await fetch(`/api/v1/songs/${song.id}/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id: song.id,
        song: { ...song, cover_url: song.cover_url },
        blob,
        downloaded_at: new Date().toISOString(),
        size_bytes: blob.size,
        source: 'server_download',
      };

      store.put(record);
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });

      await loadOfflineTracks();
    } catch (err: any) {
      alert(`Offline download failed: ${err.message}`);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  };

  // Download track from a LAN / P2P peer directly
  const downloadPeerTrack = async (song: Song, peerUrl: string) => {
    setDownloadingIds((prev) => new Set(prev).add(song.id));
    try {
      const cleanPeer = peerUrl.replace(/\/+$/, '');
      const streamUrl = song.stream_url?.startsWith('http')
        ? song.stream_url
        : `${cleanPeer}/api/v1/songs/${song.id}/stream`;

      const res = await fetch(streamUrl);
      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const resolvedCover = song.cover_url?.startsWith('http')
        ? song.cover_url
        : `${cleanPeer}${song.cover_url || '/icon-512.png'}`;

      const record = {
        id: song.id,
        song: {
          ...song,
          stream_url: undefined,
          cover_url: resolvedCover,
        },
        blob,
        downloaded_at: new Date().toISOString(),
        size_bytes: blob.size,
        source: 'peer_download',
        peer_origin: cleanPeer,
      };

      store.put(record);
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });

      await loadOfflineTracks();
    } catch (err: any) {
      alert(`Could not download track from peer: ${err.message}`);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  };

  const removeOfflineTrack = async (songId: number) => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(songId);
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });
      await loadOfflineTracks();
    } catch (err) {
      console.warn('Failed to remove offline track:', err);
    }
  };

  const clearAllOfflineTracks = async () => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });
      await loadOfflineTracks();
    } catch (err) {
      console.warn('Failed to clear offline tracks:', err);
    }
  };

  const isDownloaded = (songId: number) => {
    return offlineTracks.some((t) => t.id === songId);
  };

  const isDownloading = (songId: number) => {
    return downloadingIds.has(songId);
  };

  return {
    offlineTracks,
    isScanning,
    scanProgress,
    scanDeviceFiles,
    downloadForOffline,
    downloadPeerTrack,
    removeOfflineTrack,
    clearAllOfflineTracks,
    isDownloaded,
    isDownloading,
    refreshOfflineTracks: loadOfflineTracks,
  };
}
