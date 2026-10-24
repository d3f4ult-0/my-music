import React from 'react';
import { WifiOff, Trash2, HardDrive, Play } from 'lucide-react';
import { useOfflineManager } from '../hooks/useOfflineManager';
import { usePlayerStore } from '../stores/playerStore';
import { resolveAssetUrl } from '../api/client';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const OfflinePage: React.FC = () => {
  const { offlineTracks, removeOfflineTrack } = useOfflineManager();
  const { playTrack } = usePlayerStore();

  const totalBytes = offlineTracks.reduce((acc, t) => acc + (t.size_bytes || 0), 0);
  const songList = offlineTracks.map((t) => t.song);

  const handlePlayOffline = (trackIndex: number) => {
    const item = offlineTracks[trackIndex];
    if (!item) return;

    // Play cached song object
    playTrack(item.song, songList, trackIndex);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <WifiOff size={26} className="text-primary" /> Offline Library
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Tracks downloaded directly to your device storage. Playable without internet.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border-subtle text-xs text-neutral-300">
          <HardDrive size={16} className="text-primary" />
          <span>Storage used: {formatBytes(totalBytes)}</span>
        </div>
      </div>

      {offlineTracks.length === 0 ? (
        <div className="py-20 text-center max-w-sm mx-auto space-y-3">
          <WifiOff size={44} className="mx-auto text-neutral-600" />
          <h2 className="text-base font-bold text-white">No offline music yet</h2>
          <p className="text-xs text-neutral-400">
            When you see the download icon on any authorized song, click it to download and save it for offline listening.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {offlineTracks.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-subtle transition-colors group"
            >
              <div
                onClick={() => handlePlayOffline(idx)}
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              >
                <div className="relative w-11 h-11 rounded overflow-hidden flex-shrink-0 bg-neutral-800">
                  <img
                    src={resolveAssetUrl(item.song.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={16} className="fill-current text-white ml-0.5" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-100 truncate group-hover:text-primary transition-colors">
                    {item.song.title}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">
                    {item.song.artist?.name || 'Artist'} • {formatBytes(item.size_bytes)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => removeOfflineTrack(item.id)}
                  className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                  title="Remove offline copy"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
