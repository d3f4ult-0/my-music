import React from 'react';
import { X, Trash2, Music } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { resolveAssetUrl } from '../../api/client';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const QueueDrawer: React.FC = () => {
  const {
    isQueueOpen,
    toggleQueue,
    queue,
    queueIndex,
    currentTrack,
    playTrack,
    removeFromQueue,
    clearQueue,
  } = usePlayerStore();

  if (!isQueueOpen) return null;

  const upNext = queue.slice(queueIndex + 1);

  return (
    <aside className="fixed top-0 right-0 bottom-20 md:bottom-24 w-80 md:w-96 bg-surface border-l border-border-subtle z-40 p-4 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
          <Music size={18} className="text-primary" /> Play Queue
        </h2>
        <div className="flex items-center gap-2">
          {queue.length > 1 && (
            <button
              onClick={clearQueue}
              className="text-xs text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-1 rounded"
              title="Clear queue"
            >
              <Trash2 size={14} /> Clear
            </button>
          )}
          <button
            onClick={toggleQueue}
            className="p-1 text-neutral-400 hover:text-white rounded-full hover:bg-surface-hover"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 space-y-4">
        {/* Now Playing */}
        {currentTrack && (
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-neutral-400 mb-2">
              Now Playing
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-active/60 border border-primary/20">
              <img
                src={resolveAssetUrl(currentTrack.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'}
                alt=""
                className="w-11 h-11 rounded object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary truncate">
                  {currentTrack.title}
                </div>
                <div className="text-xs text-neutral-400 truncate">
                  {currentTrack.artist?.name || 'Unknown Artist'}
                </div>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                {formatDuration(currentTrack.duration)}
              </span>
            </div>
          </div>
        )}

        {/* Up Next */}
        <div>
          <div className="text-xs uppercase font-medium tracking-wider text-neutral-400 mb-2 flex justify-between">
            <span>Next Up ({upNext.length})</span>
          </div>

          {upNext.length === 0 ? (
            <div className="text-xs text-neutral-500 py-6 text-center">
              No tracks lined up next in queue.
            </div>
          ) : (
            <div className="space-y-1">
              {upNext.map((track, idx) => {
                const actualIndex = queueIndex + 1 + idx;
                return (
                  <div
                    key={`${track.id}-${actualIndex}`}
                    className="group flex items-center justify-between p-2 rounded-md hover:bg-surface-hover transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => playTrack(track, queue, actualIndex)}
                    >
                      <img
                        src={resolveAssetUrl(track.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'}
                        alt=""
                        className="w-9 h-9 rounded object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-neutral-200 truncate group-hover:text-primary transition-colors">
                          {track.title}
                        </div>
                        <div className="text-[11px] text-neutral-400 truncate">
                          {track.artist?.name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-500">
                        {formatDuration(track.duration)}
                      </span>
                      <button
                        onClick={() => removeFromQueue(actualIndex)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-400 transition-opacity"
                        title="Remove from queue"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
