import React, { useEffect, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { Play, Shuffle, Clock, Calendar } from 'lucide-react';
import { AlbumDetail, Song } from '../types';
import { apiRequest, resolveAssetUrl } from '../api/client';
import { SongRow } from '../components/common/SongRow';
import { usePlayerStore } from '../stores/playerStore';
import { extractDominantColor } from '../utils/colorExtractor';

export const AlbumPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { playTrack, toggleShuffle, setDominantColor } = usePlayerStore();

  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  useEffect(() => {
    if (id) {
      setLoading(true);
      apiRequest<AlbumDetail>(`/albums/${id}`)
        .then((data) => {
          setAlbum(data);
          if (data?.cover_url) {
            extractDominantColor(data.cover_url).then((c) => setDominantColor(c));
          }
        })
        .catch((err) => console.warn('Could not load album:', err))
        .finally(() => setLoading(false));
    }
  }, [id, setDominantColor]);

  if (loading) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Loading album...</div>;
  }

  if (!album) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Album not found.</div>;
  }

  const handlePlayAlbum = () => {
    if (album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks, 0);
    }
  };

  const handleShuffleAlbum = () => {
    if (album.tracks.length > 0) {
      toggleShuffle();
      playTrack(album.tracks[0], album.tracks, 0);
    }
  };

  const totalDuration = album.tracks.reduce((acc, s) => acc + (s.duration || 0), 0);
  const totalMins = Math.floor(totalDuration / 60);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end pb-4 border-b border-border-subtle">
        <img
          src={resolveAssetUrl(album.cover_url) || 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&auto=format&fit=crop&q=80'}
          alt={album.title}
          className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl object-cover shadow-2xl bg-neutral-900 flex-shrink-0"
        />

        <div className="space-y-2">
          <div className="text-xs uppercase font-bold tracking-wider text-neutral-400">Album</div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {album.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-300 pt-1">
            <Link
              to={`/artists/${album.artist.id}`}
              className="font-semibold text-white hover:underline hover:text-primary transition-colors"
            >
              {album.artist.name}
            </Link>
            <span>•</span>
            {album.year && <span>{album.year}</span>}
            <span>•</span>
            <span>
              {album.tracks.length} {album.tracks.length === 1 ? 'song' : 'songs'}, ~{totalMins} min
            </span>
          </div>

          {album.description && (
            <p className="text-xs text-neutral-400 max-w-2xl pt-2">{album.description}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayAlbum}
          disabled={album.tracks.length === 0}
          className="px-6 py-3 rounded-full bg-primary text-black font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
        >
          <Play size={18} className="fill-current" /> Play Album
        </button>

        <button
          onClick={handleShuffleAlbum}
          disabled={album.tracks.length === 0}
          className="p-3 rounded-full bg-surface-card hover:bg-surface-hover text-neutral-300 hover:text-white border border-border-subtle transition-all"
          title="Shuffle album"
        >
          <Shuffle size={18} />
        </button>
      </div>

      {/* Track List */}
      <div>
        <div className="grid grid-cols-12 text-xs uppercase font-medium text-neutral-500 px-3 py-2 border-b border-border-subtle mb-1">
          <div className="col-span-1">#</div>
          <div className="col-span-6 md:col-span-6">Title</div>
          <div className="hidden md:block col-span-4">Album</div>
          <div className="col-span-5 md:col-span-1 text-right flex items-center justify-end gap-1">
            <Clock size={14} />
          </div>
        </div>

        <div className="divide-y divide-border-subtle/30">
          {album.tracks.map((song, idx) => (
            <SongRow
              key={song.id}
              song={song}
              index={idx}
              playlistContext={album.tracks}
              onAddToPlaylist={onAddToPlaylist}
              onReport={onReport}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
