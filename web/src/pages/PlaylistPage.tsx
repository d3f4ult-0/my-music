import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Play, Shuffle, Trash2, Globe, Lock, ArrowUp, ArrowDown } from 'lucide-react';
import { PlaylistDetail, Song } from '../types';
import { apiRequest, resolveAssetUrl } from '../api/client';
import { SongRow } from '../components/common/SongRow';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { extractDominantColor } from '../utils/colorExtractor';

export const PlaylistPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { playTrack, toggleShuffle, setDominantColor } = usePlayerStore();
  const { user } = useAuthStore();

  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  const loadPlaylist = () => {
    if (id) {
      apiRequest<PlaylistDetail>(`/playlists/${id}`)
        .then((data) => {
          setPlaylist(data);
          if (data?.cover_url) {
            extractDominantColor(data.cover_url).then((c) => setDominantColor(c));
          }
        })
        .catch(() => setPlaylist(null))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Loading playlist...</div>;
  }

  if (!playlist) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Playlist not found or private.</div>;
  }

  const isOwner = user && user.id === playlist.user_id;

  const handlePlay = () => {
    if (playlist.songs.length > 0) {
      playTrack(playlist.songs[0], playlist.songs, 0);
    }
  };

  const handleShuffle = () => {
    if (playlist.songs.length > 0) {
      toggleShuffle();
      playTrack(playlist.songs[0], playlist.songs, 0);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete playlist "${playlist.name}"?`)) return;
    try {
      await apiRequest(`/playlists/${playlist.id}`, { method: 'DELETE' });
      navigate('/playlists');
    } catch (err: any) {
      alert(`Could not delete: ${err.message}`);
    }
  };

  const handleRemoveTrack = async (songId: number) => {
    try {
      await apiRequest(`/playlists/${playlist.id}/songs/${songId}`, { method: 'DELETE' });
      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              songs: prev.songs.filter((s) => s.id !== songId),
              track_count: prev.track_count - 1,
            }
          : null
      );
    } catch (err: any) {
      alert(`Could not remove track: ${err.message}`);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= playlist.songs.length) return;

    const newSongs = [...playlist.songs];
    const [moved] = newSongs.splice(index, 1);
    newSongs.splice(targetIndex, 0, moved);

    setPlaylist((prev) => (prev ? { ...prev, songs: newSongs } : null));

    // Persist reorder to database
    try {
      await apiRequest(`/playlists/${playlist.id}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ song_ids: newSongs.map((s) => s.id) }),
      });
    } catch {
      loadPlaylist();
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Playlist Header */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end pb-6 border-b border-border-subtle">
        <img
          src={resolveAssetUrl(playlist.cover_url) || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80'}
          alt={playlist.name}
          className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl object-cover shadow-2xl bg-neutral-900 flex-shrink-0"
        />

        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-neutral-400">
            <span>Playlist</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-normal">
              {playlist.is_public ? <Globe size={13} /> : <Lock size={13} />}
              {playlist.is_public ? 'Public' : 'Private'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {playlist.name}
          </h1>

          <div className="text-sm text-neutral-300">
            {playlist.owner_name ? `Created by ${playlist.owner_name} • ` : ''}
            {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'}
          </div>

          {playlist.description && (
            <p className="text-xs text-neutral-400 max-w-2xl pt-1">{playlist.description}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlay}
            disabled={playlist.songs.length === 0}
            className="px-6 py-3 rounded-full bg-primary text-black font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <Play size={18} className="fill-current" /> Play
          </button>

          <button
            onClick={handleShuffle}
            disabled={playlist.songs.length === 0}
            className="p-3 rounded-full bg-surface-card hover:bg-surface-hover text-neutral-300 hover:text-white border border-border-subtle transition-all"
            title="Shuffle playlist"
          >
            <Shuffle size={18} />
          </button>
        </div>

        {isOwner && (
          <button
            onClick={handleDelete}
            className="text-xs font-semibold text-neutral-400 hover:text-red-400 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={16} /> Delete Playlist
          </button>
        )}
      </div>

      {/* Track List */}
      <div>
        {playlist.songs.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">
            This playlist is currently empty. Add songs from your library, search, or albums!
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/30">
            {playlist.songs.map((song, idx) => (
              <div key={`${song.id}-${idx}`} className="flex items-center gap-2 group">
                <div className="flex-1 min-w-0">
                  <SongRow
                    song={song}
                    index={idx}
                    playlistContext={playlist.songs}
                    onAddToPlaylist={onAddToPlaylist}
                    onReport={onReport}
                  />
                </div>

                {isOwner && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 pr-2 transition-opacity">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-neutral-500 hover:text-white disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === playlist.songs.length - 1}
                      className="p-1 text-neutral-500 hover:text-white disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      onClick={() => handleRemoveTrack(song.id)}
                      className="p-1 text-neutral-500 hover:text-red-400"
                      title="Remove from playlist"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
