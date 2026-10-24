import React from 'react';
import { Play, Pause, Heart, Download, Plus, Flag, MoreHorizontal } from 'lucide-react';
import { Song } from '../../types';
import { usePlayerStore } from '../../stores/playerStore';
import { useOfflineManager } from '../../hooks/useOfflineManager';
import { resolveAssetUrl } from '../../api/client';

interface SongRowProps {
  song: Song;
  index: number;
  playlistContext?: Song[];
  onAddToPlaylist?: (song: Song) => void;
  onReport?: (song: Song) => void;
}

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const SongRow: React.FC<SongRowProps> = ({
  song,
  index,
  playlistContext,
  onAddToPlaylist,
  onReport,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, toggleTrackFavorite } = usePlayerStore();
  const { downloadForOffline, isDownloaded, isDownloading } = useOfflineManager();

  const isCurrent = currentTrack?.id === song.id;
  const isRowPlaying = isCurrent && isPlaying;
  const downloaded = isDownloaded(song.id);
  const downloading = isDownloading(song.id);

  const handlePlayClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(song, playlistContext || [song], index);
    }
  };

  return (
    <div
      className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-sm select-none ${
        isCurrent ? 'bg-surface-active text-primary' : 'hover:bg-surface-hover text-neutral-300'
      }`}
    >
      {/* Left: Index / Play Icon & Track Details */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
        {/* Number or Play/Pause Button */}
        <div className="w-6 flex items-center justify-center flex-shrink-0 text-xs font-mono text-neutral-500">
          <button
            onClick={handlePlayClick}
            className="hidden group-hover:flex items-center justify-center text-white"
          >
            {isRowPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
          </button>
          <span className="group-hover:hidden">
            {isRowPlaying ? (
              <span className="flex gap-0.5 items-end h-3">
                <span className="w-0.5 h-full bg-primary animate-pulse" />
                <span className="w-0.5 h-2 bg-primary animate-pulse" />
                <span className="w-0.5 h-3 bg-primary animate-pulse" />
              </span>
            ) : (
              index + 1
            )}
          </span>
        </div>

        {/* Thumbnail */}
        <img
          src={resolveAssetUrl(song.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&auto=format&fit=crop&q=80'}
          alt=""
          className="w-10 h-10 rounded object-cover flex-shrink-0 bg-surface-card"
        />

        {/* Title and Artist */}
        <div className="min-w-0 flex-1">
          <div
            onClick={handlePlayClick}
            className={`font-medium truncate cursor-pointer hover:underline ${
              isCurrent ? 'text-primary font-semibold' : 'text-neutral-100'
            }`}
          >
            {song.title}
          </div>
          <div className="text-xs text-neutral-400 truncate hover:underline cursor-pointer">
            {song.artist?.name || 'Unknown Artist'}
          </div>
        </div>
      </div>

      {/* Center: Album Title (Desktop) */}
      <div className="hidden md:block w-1/4 text-xs text-neutral-400 truncate pr-4">
        {song.album_title || 'Single'}
      </div>

      {/* Right: Actions & Duration */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Favorite */}
        <button
          onClick={() => toggleTrackFavorite(song.id)}
          className={`p-1.5 transition-colors ${
            song.is_favorite ? 'text-primary' : 'text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100'
          }`}
          title={song.is_favorite ? 'Favorited' : 'Favorite'}
        >
          <Heart size={16} className={song.is_favorite ? 'fill-primary' : ''} />
        </button>

        {/* Download */}
        {song.download_allowed && (
          <button
            onClick={() => downloadForOffline(song)}
            disabled={downloading}
            className={`p-1.5 transition-colors ${
              downloaded
                ? 'text-primary'
                : downloading
                ? 'text-neutral-500 animate-pulse'
                : 'text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100'
            }`}
            title={downloaded ? 'Downloaded offline' : 'Download song'}
          >
            <Download size={16} />
          </button>
        )}

        {/* Add to Playlist */}
        {onAddToPlaylist && (
          <button
            onClick={() => onAddToPlaylist(song)}
            className="p-1.5 text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add to playlist"
          >
            <Plus size={16} />
          </button>
        )}

        {/* Report track */}
        {onReport && (
          <button
            onClick={() => onReport(song)}
            className="p-1.5 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Report track"
          >
            <Flag size={14} />
          </button>
        )}

        {/* Duration */}
        <span className="w-12 text-right text-xs font-mono text-neutral-400">
          {formatDuration(song.duration)}
        </span>
      </div>
    </div>
  );
};
