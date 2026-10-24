import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { History, Clock } from 'lucide-react';
import { ListeningHistoryItem, Song } from '../types';
import { apiRequest } from '../api/client';
import { SongRow } from '../components/common/SongRow';

export const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<ListeningHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  useEffect(() => {
    setLoading(true);
    apiRequest<ListeningHistoryItem[]>('/history?limit=50')
      .then((data) => setHistory(data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Loading history...</div>;
  }

  const songs = history.map((h) => h.song);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <History size={26} className="text-primary" /> Listening History
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Songs you've played for at least 30 seconds or completed.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 text-sm">
          No listening activity recorded yet. Start listening to tracks to build your history!
        </div>
      ) : (
        <div className="divide-y divide-border-subtle/30">
          {history.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <SongRow
                  song={item.song}
                  index={idx}
                  playlistContext={songs}
                  onAddToPlaylist={onAddToPlaylist}
                  onReport={onReport}
                />
              </div>
              <div className="text-[11px] text-neutral-500 pr-3 font-mono hidden sm:block">
                {new Date(item.played_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
