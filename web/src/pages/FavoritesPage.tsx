import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Heart, Play, Shuffle } from 'lucide-react';
import { Song } from '../types';
import { apiRequest } from '../api/client';
import { SongRow } from '../components/common/SongRow';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';

export const FavoritesPage: React.FC = () => {
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack, toggleShuffle } = usePlayerStore();
  const { user } = useAuthStore();

  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  useEffect(() => {
    setLoading(true);
    apiRequest<Song[]>('/favorites')
      .then((data) => setFavorites(data || []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Loading your favorites...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end pb-6 border-b border-border-subtle">
        <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-900 flex items-center justify-center text-white shadow-2xl flex-shrink-0">
          <Heart size={64} className="fill-current" />
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase font-bold tracking-wider text-neutral-400">Playlist</div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Liked Songs
          </h1>
          <div className="text-sm text-neutral-300">
            {user.display_name || user.username} • {favorites.length} {favorites.length === 1 ? 'song' : 'songs'}
          </div>
        </div>
      </div>

      {/* Controls */}
      {favorites.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => playTrack(favorites[0], favorites, 0)}
            className="px-6 py-3 rounded-full bg-primary text-black font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <Play size={18} className="fill-current" /> Play
          </button>

          <button
            onClick={() => {
              toggleShuffle();
              playTrack(favorites[0], favorites, 0);
            }}
            className="p-3 rounded-full bg-surface-card hover:bg-surface-hover text-neutral-300 hover:text-white border border-border-subtle transition-all"
            title="Shuffle favorites"
          >
            <Shuffle size={18} />
          </button>
        </div>
      )}

      {/* Tracks */}
      {favorites.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 text-sm">
          You haven't liked any songs yet. Click the heart icon on any song to save it here.
        </div>
      ) : (
        <div className="divide-y divide-border-subtle/30">
          {favorites.map((song, idx) => (
            <SongRow
              key={song.id}
              song={song}
              index={idx}
              playlistContext={favorites}
              onAddToPlaylist={onAddToPlaylist}
              onReport={onReport}
            />
          ))}
        </div>
      )}
    </div>
  );
};
