import { useState, useEffect, useCallback, useRef } from 'react';
import { Song, OfflineTrack } from '../types';
import {
  extractFullAudioMetadata,
  generateAlbumCover,
  probeAudioDuration,
  parseFilenameFallback,
  detectCodec,
} from '../utils/audioMetadataExtractor';

const DB_NAME = 'mymusic_offline_db';
const DB_VERSION = 2;
const STORE_NAME = 'offline_tracks';
const LYRICS_STORE_NAME = 'offline_lyrics';

// Global cache for cover image URLs to avoid recreating & prevent premature revoking
const globalCoverCache = new Map<number, string>();

export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LYRICS_STORE_NAME)) {
        db.createObjectStore(LYRICS_STORE_NAME, { keyPath: 'song_id' });
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

  const loadOfflineTracks = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records: any[] = req.result || [];

        const mapped: OfflineTrack[] = records.map((r) => {
          // Cover art resolution:
          // 1. Embedded image blob from ID3 / FLAC / M4A (cached stably in globalCoverCache)
          // 2. Or generate a unique aesthetic gradient cover
          let resolvedCover = r.song?.cover_url;
          if (r.cover_blob) {
            let cached = globalCoverCache.get(r.id);
            if (!cached) {
              cached = URL.createObjectURL(r.cover_blob);
              globalCoverCache.set(r.id, cached);
            }
            resolvedCover = cached;
          } else if (
            !resolvedCover ||
            resolvedCover === '/icon-512.png' ||
            resolvedCover.includes('unsplash')
          ) {
            resolvedCover = generateAlbumCover(
              r.song?.title || 'Unknown',
              r.song?.artist?.name || 'Local Artist',
              r.song?.album_title || 'Music'
            );
          }

          const song: Song = {
            ...r.song,
            // Stream URL: keep external/peer URLs if present, otherwise GlobalAudioPlayer
            // resolves it safely from IndexedDB via getOfflineTrackBlob
            stream_url: r.song?.stream_url && r.song.stream_url.startsWith('http') ? r.song.stream_url : undefined,
            cover_url: resolvedCover,
            artist: {
              ...r.song?.artist,
              id: r.song?.artist?.id || r.id,
              name: r.song?.artist?.name || 'Local Artist',
              image_url: resolvedCover,
            },
          };

          return {
            id: r.id,
            song,
            downloaded_at: r.downloaded_at,
            blob_url: undefined,
            size_bytes: r.size_bytes || (r.blob ? r.blob.size : 0),
          };
        });

        setOfflineTracks(mapped);
      };
    } catch (err) {
      console.warn('Failed to load offline tracks:', err);
    }
  }, []);

  useEffect(() => {
    loadOfflineTracks();
  }, [loadOfflineTracks]);

  // Scan & import audio files from device with real metadata & cover extraction
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

        // Extract complete metadata (ID3v2, FLAC, M4A, cover art blob, duration, etc.)
        const meta = await extractFullAudioMetadata(file);

        // Generate persistent integer ID based on file timestamp and size
        const uniqueId = Math.abs(
          ((file.lastModified || Date.now()) ^ (file.size << 5) ^ Math.floor(Math.random() * 100000))
        );

        const song: Song = {
          id: uniqueId,
          title: meta.title,
          duration: meta.duration || 180,
          audio_key: `device-${uniqueId}`,
          cover_url: meta.coverUrl,
          download_allowed: true,
          is_favorite: false,
          artist: {
            id: uniqueId,
            name: meta.artist,
            image_url: meta.coverUrl,
          },
          album_title: meta.album,
          track_number: meta.trackNumber,
          release_date: meta.year ? `${meta.year}-01-01` : undefined,
          codec: meta.codec,
          bitrate: undefined,
        };

        const record = {
          id: uniqueId,
          song,
          blob: file,
          cover_blob: meta.coverBlob,
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

  // Auto-scan device directory using File System Access API
  const autoScanStorage = async (): Promise<number> => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          id: 'mymusic_device_storage',
          mode: 'read',
        });

        const files: File[] = [];

        async function scanDirectory(handle: any) {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const name = entry.name.toLowerCase();
              if (
                name.endsWith('.mp3') ||
                name.endsWith('.flac') ||
                name.endsWith('.wav') ||
                name.endsWith('.m4a') ||
                name.endsWith('.aac') ||
                name.endsWith('.ogg') ||
                name.endsWith('.opus')
              ) {
                try {
                  const f = await entry.getFile();
                  files.push(f);
                } catch {}
              }
            } else if (entry.kind === 'directory') {
              try {
                await scanDirectory(entry);
              } catch {}
            }
          }
        }

        await scanDirectory(dirHandle);

        if (files.length > 0) {
          return await scanDeviceFiles(files);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Auto-scan directory picker canceled or error:', err);
        }
      }
    }
    return 0;
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

      // Fetch cover art if available
      let coverBlob: Blob | undefined = undefined;
      if (song.cover_url && !song.cover_url.startsWith('data:')) {
        try {
          const coverRes = await fetch(
            song.cover_url.startsWith('http') ? song.cover_url : `${cleanPeer}${song.cover_url}`
          );
          if (coverRes.ok) {
            coverBlob = await coverRes.blob();
          }
        } catch {}
      }

      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const resolvedCover = coverBlob
        ? undefined
        : song.cover_url?.startsWith('http')
        ? song.cover_url
        : generateAlbumCover(song.title, song.artist?.name || 'Peer', song.album_title || 'P2P Shared');

      const record = {
        id: song.id,
        song: {
          ...song,
          stream_url: undefined,
          cover_url: resolvedCover,
        },
        blob,
        cover_blob: coverBlob,
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
      const cached = globalCoverCache.get(songId);
      if (cached && cached.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached);
        } catch {}
        globalCoverCache.delete(songId);
      }

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
    autoScanStorage,
    downloadForOffline,
    downloadPeerTrack,
    removeOfflineTrack,
    clearAllOfflineTracks,
    isDownloaded,
    isDownloading,
    refreshOfflineTracks: loadOfflineTracks,
  };
}
