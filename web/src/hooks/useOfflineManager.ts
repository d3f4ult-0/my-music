import { useState, useEffect, useCallback } from 'react';
import { Song, OfflineTrack } from '../types';

const DB_NAME = 'mymusic_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_tracks';

function openOfflineDB(): Promise<IDBDatabase> {
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

export function useOfflineManager() {
  const [offlineTracks, setOfflineTracks] = useState<OfflineTrack[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());

  const loadOfflineTracks = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: any[] = req.result || [];
        const mapped: OfflineTrack[] = records.map((r) => ({
          id: r.id,
          song: r.song,
          downloaded_at: r.downloaded_at,
          blob_url: r.blob ? URL.createObjectURL(r.blob) : undefined,
          size_bytes: r.size_bytes || 0,
        }));
        setOfflineTracks(mapped);
      };
    } catch (err) {
      console.warn('Failed to load offline tracks:', err);
    }
  }, []);

  useEffect(() => {
    loadOfflineTracks();
  }, [loadOfflineTracks]);

  const downloadForOffline = async (song: Song) => {
    if (!song.download_allowed) {
      alert('The artist has not enabled downloads for this song.');
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

  const isDownloaded = (songId: number) => {
    return offlineTracks.some((t) => t.id === songId);
  };

  const isDownloading = (songId: number) => {
    return downloadingIds.has(songId);
  };

  return {
    offlineTracks,
    downloadForOffline,
    removeOfflineTrack,
    isDownloaded,
    isDownloading,
    refreshOfflineTracks: loadOfflineTracks,
  };
}
