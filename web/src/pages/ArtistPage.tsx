import React, { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Play, Shuffle, UserPlus, UserCheck } from 'lucide-react';
import { ArtistDetail, Song } from '../types';
import { apiRequest, resolveAssetUrl } from '../api/client';
import { SongRow } from '../components/common/SongRow';
import { AlbumCard } from '../components/common/AlbumCard';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';

export const ArtistPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { playTrack, toggleShuffle } = usePlayerStore();
  const { user } = useAuthStore();

  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  useEffect(() => {
    if (id) {
      setLoading(true);
      apiRequest<ArtistDetail>(`/artists/${id}`)
        .then((data) => setArtist(data))
        .catch((err) => console.warn('Could not load artist:', err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleFollowToggle = async () => {
    if (!artist) return;
    if (!user) {
      alert('Please sign in to follow artists.');
      return;
    }

    const nextStatus = !artist.is_following;
    setArtist((prev) =>
      prev
        ? {
            ...prev,
            is_following: nextStatus,
            follower_count: prev.follower_count + (nextStatus ? 1 : -1),
          }
        : null
    );

    try {
      await apiRequest(`/artists/${artist.id}/follow`, {
        method: nextStatus ? 'POST' : 'DELETE',
      });
    } catch {
      // Revert on error
      setArtist((prev) =>
        prev
          ? {
              ...prev,
              is_following: !nextStatus,
              follower_count: prev.follower_count + (nextStatus ? -1 : 1),
            }
          : null
      );
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Loading artist...</div>;
  }

  if (!artist) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Artist not found.</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end pb-6 border-b border-border-subtle">
        <img
          src={resolveAssetUrl(artist.image_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'}
          alt={artist.name}
          className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover shadow-2xl bg-neutral-900 border-2 border-border-subtle flex-shrink-0"
        />

        <div className="space-y-2 flex-1 min-w-0">
          <div className="text-xs uppercase font-bold tracking-wider text-neutral-400">Verified Artist</div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {artist.name}
          </h1>

          <div className="text-xs sm:text-sm text-neutral-300">
            {artist.follower_count.toLocaleString()} {artist.follower_count === 1 ? 'follower' : 'followers'}
          </div>

          {artist.bio && (
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl pt-1 leading-relaxed">
              {artist.bio}
            </p>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        {artist.popular_songs.length > 0 && (
          <>
            <button
              onClick={() => playTrack(artist.popular_songs[0], artist.popular_songs, 0)}
              className="px-6 py-3 rounded-full bg-primary text-black font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Play size={18} className="fill-current" /> Play
            </button>

            <button
              onClick={() => {
                toggleShuffle();
                playTrack(artist.popular_songs[0], artist.popular_songs, 0);
              }}
              className="p-3 rounded-full bg-surface-card hover:bg-surface-hover text-neutral-300 hover:text-white border border-border-subtle transition-all"
              title="Shuffle songs"
            >
              <Shuffle size={18} />
            </button>
          </>
        )}

        <button
          onClick={handleFollowToggle}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all ${
            artist.is_following
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border-muted text-white bg-surface-card hover:bg-surface-hover'
          }`}
        >
          {artist.is_following ? (
            <>
              <UserCheck size={16} /> Following
            </>
          ) : (
            <>
              <UserPlus size={16} /> Follow
            </>
          )}
        </button>
      </div>

      {/* Popular Songs */}
      {artist.popular_songs.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-3">Popular</h2>
          <div className="bg-surface-card/60 border border-border-subtle rounded-xl p-2 divide-y divide-border-subtle/40">
            {artist.popular_songs.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                playlistContext={artist.popular_songs}
                onAddToPlaylist={onAddToPlaylist}
                onReport={onReport}
              />
            ))}
          </div>
        </section>
      )}

      {/* Discography / Albums */}
      {artist.albums.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-3">Albums & Releases</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artist.albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
