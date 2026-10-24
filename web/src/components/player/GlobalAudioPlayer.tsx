import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  Download,
  AlertCircle,
  Mic2,
  Maximize2,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { useAuthStore } from '../../stores/authStore';
import { useOfflineManager, getOfflineTrackBlob } from '../../hooks/useOfflineManager';
import { apiRequest, resolveAssetUrl } from '../../api/client';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const GlobalAudioPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressReportedRef = useRef(false);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    isQueueOpen,
    isLyricsOpen,
    toggleLyrics,
    toggleFullscreenLyrics,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleQueue,
    updatePlaybackTime,
    setLoading,
    toggleTrackFavorite,
  } = usePlayerStore();

  const { user } = useAuthStore();
  const { downloadForOffline, isDownloaded, isDownloading } = useOfflineManager();

  const [hasError, setHasError] = useState(false);

  // Synchronize audio element playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play interrupted or blocked:', err);
          if (err.name === 'NotAllowedError') {
            usePlayerStore.getState().pause();
          }
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // Synchronize volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Audio stream URL resolution (supports remote peer stream, offline blob or local stream)
  const [resolvedStreamUrl, setResolvedStreamUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let activeBlobUrl: string | null = null;
    let isCancelled = false;

    if (!currentTrack) {
      setResolvedStreamUrl(undefined);
      return;
    }

    // 1. Direct stream URL (e.g. device blob: URL or remote peer HTTP URL)
    if (currentTrack.stream_url) {
      setResolvedStreamUrl(resolveAssetUrl(currentTrack.stream_url));
      return;
    }

    // 2. Check offline IndexedDB cache
    getOfflineTrackBlob(currentTrack.id).then((blob) => {
      if (isCancelled) return;
      if (blob) {
        activeBlobUrl = URL.createObjectURL(blob);
        setResolvedStreamUrl(activeBlobUrl);
      } else {
        setResolvedStreamUrl(resolveAssetUrl(`/api/v1/songs/${currentTrack.id}/stream`));
      }
    });

    return () => {
      isCancelled = true;
      if (activeBlobUrl) {
        try {
          URL.revokeObjectURL(activeBlobUrl);
        } catch {}
      }
    };
  }, [currentTrack?.id, currentTrack?.stream_url]);

  // Handle track change
  useEffect(() => {
    setHasError(false);
    progressReportedRef.current = false;
  }, [currentTrack?.id]);

  // Native Android MediaSession (Lockscreen, Notification tray, Bluetooth)
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist?.name || 'Local Artist',
          album: currentTrack.album_title || 'Single',
          artwork: [
            {
              src: resolveAssetUrl(currentTrack.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=512&auto=format&fit=crop&q=80',
              sizes: '512x512',
              type: 'image/jpeg',
            },
          ],
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => previous());
        navigator.mediaSession.setActionHandler('nexttrack', () => next());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            seek(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skip = details.seekOffset || 10;
          seek(Math.max(0, currentTime - skip));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skip = details.seekOffset || 10;
          seek(Math.min(duration || Infinity, currentTime + skip));
        });
      } catch (e) {
        // Safe fallback for older browser engines
      }
    }
  }, [currentTrack, isPlaying, currentTime, duration]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    updatePlaybackTime(audio.currentTime, audio.duration || currentTrack?.duration || 0);

    // Record listening history event after 30 seconds
    if (
      user &&
      currentTrack &&
      !progressReportedRef.current &&
      audio.currentTime >= 30
    ) {
      progressReportedRef.current = true;
      apiRequest('/history', {
        method: 'POST',
        body: JSON.stringify({
          song_id: currentTrack.id,
          progress_seconds: audio.currentTime,
          duration: audio.duration || currentTrack.duration,
          completed: false,
        }),
      }).catch(() => {});
    }
  };

  const handleEnded = () => {
    if (user && currentTrack) {
      apiRequest('/history', {
        method: 'POST',
        body: JSON.stringify({
          song_id: currentTrack.id,
          progress_seconds: duration,
          duration: duration,
          completed: true,
        }),
      }).catch(() => {});
    }

    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      next();
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seek(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  if (!currentTrack) {
    return null;
  }

  const downloaded = isDownloaded(currentTrack.id);
  const downloading = isDownloading(currentTrack.id);

  return (
    <>
      <audio
        ref={audioRef}
        src={resolvedStreamUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onError={() => {
          setHasError(true);
          setLoading(false);
        }}
        preload="metadata"
      />

      {/* MOBILE MINI-PLAYER (Android phone layout) */}
      <div
        className="md:hidden fixed bottom-14 left-2 right-2 h-14 bg-[#18191c]/95 border border-border-subtle rounded-xl z-40 px-3 flex items-center justify-between shadow-2xl backdrop-blur-md select-none overflow-hidden cursor-pointer"
        onClick={toggleFullscreenLyrics}
      >
        {/* Bottom hairline progress bar */}
        <div
          className="absolute bottom-0 left-0 h-[2.5px] bg-primary transition-all duration-300 pointer-events-none"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />

        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <img
            src={
              resolveAssetUrl(currentTrack.cover_url) ||
              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'
            }
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-neutral-800"
          />
          <div className="min-w-0 pr-1">
            <div className="font-semibold text-xs text-white truncate">{currentTrack.title}</div>
            <div className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
              <span>{currentTrack.artist?.name || 'Local Artist'}</span>
              {currentTrack.peer_origin && (
                <span className="text-[8px] bg-primary/20 text-primary px-1 rounded font-mono">P2P</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleTrackFavorite(currentTrack.id)}
            className="p-1.5 text-neutral-400 hover:text-white"
          >
            <Heart size={18} className={currentTrack.is_favorite ? 'fill-primary text-primary' : ''} />
          </button>

          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow"
          >
            {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
          </button>
        </div>
      </div>

      {/* DESKTOP PERSISTENT PLAYER (Desktop/Tablet layout) */}
      <footer className="hidden md:flex fixed bottom-0 left-0 right-0 h-20 md:h-24 bg-surface border-t border-border-subtle z-50 px-4 md:px-6 items-center justify-between shadow-2xl select-none">
        {/* Track Info (Left) */}
        <div className="flex items-center gap-3 w-1/4 min-w-[180px]">
          <img
            src={resolveAssetUrl(currentTrack.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'}
            alt={currentTrack.title}
            className="w-12 h-12 md:w-14 md:h-14 rounded-md object-cover flex-shrink-0 bg-surface-card"
          />
          <div className="min-w-0 pr-2">
            <div className="font-medium text-sm text-neutral-100 truncate hover:underline cursor-pointer">
              {currentTrack.title}
            </div>
            <div className="text-xs text-neutral-400 truncate flex items-center gap-1.5">
              <span className="hover:underline cursor-pointer">{currentTrack.artist?.name || 'Unknown Artist'}</span>
              {currentTrack.peer_origin && (
                <span className="text-[9px] bg-primary/20 text-primary border border-primary/40 px-1 py-0.2 rounded font-mono font-medium">
                  P2P Peer
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => toggleTrackFavorite(currentTrack.id)}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            title={currentTrack.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              size={18}
              className={currentTrack.is_favorite ? 'fill-primary text-primary' : ''}
            />
          </button>

          {currentTrack.download_allowed && (
            <button
              onClick={() => downloadForOffline(currentTrack)}
              disabled={downloading}
              className={`p-1.5 transition-colors ${
                downloaded
                  ? 'text-primary'
                  : downloading
                  ? 'text-neutral-500 animate-pulse'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title={downloaded ? 'Downloaded offline' : 'Download for offline playback'}
            >
              <Download size={17} />
            </button>
          )}

          {hasError && (
            <span className="text-red-400 text-xs flex items-center gap-1" title="Stream failed to load">
              <AlertCircle size={14} /> Error
            </span>
          )}
        </div>

        {/* Central Controls & Progress (Center) */}
        <div className="flex flex-col items-center max-w-[45%] w-full">
          {/* Buttons */}
          <div className="flex items-center gap-4 md:gap-6 mb-1.5">
            <button
              onClick={toggleShuffle}
              className={`p-1 transition-colors ${
                shuffle ? 'text-primary' : 'text-neutral-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle size={17} />
            </button>

            <button
              onClick={previous}
              className="text-neutral-300 hover:text-white transition-transform active:scale-95"
              title="Previous (P)"
            >
              <SkipBack size={20} className="fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
              title="Play/Pause (Space)"
            >
              {isPlaying ? (
                <Pause size={20} className="fill-current" />
              ) : (
                <Play size={20} className="fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={next}
              className="text-neutral-300 hover:text-white transition-transform active:scale-95"
              title="Next (N)"
            >
              <SkipForward size={20} className="fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-1 transition-colors ${
                repeatMode !== 'off' ? 'text-primary' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full flex items-center gap-2 text-[11px] text-neutral-400">
            <span className="w-9 text-right font-mono">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                onChange={handleSeekChange}
                className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary group-hover:h-1.5 transition-all"
              />
            </div>
            <span className="w-9 font-mono">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume & Queue & Spicy Lyrics (Right) */}
        <div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[180px]">
          {/* Spicy Lyrics Toggle */}
          <button
            onClick={toggleLyrics}
            className={`p-2 rounded-full transition-colors relative ${
              isLyricsOpen ? 'text-primary bg-surface-hover' : 'text-neutral-400 hover:text-white'
            }`}
            title="Spicy Lyrics Panel"
          >
            <Mic2 size={18} />
            {isLyricsOpen && (
              <span className="w-1 h-1 rounded-full bg-primary absolute bottom-1 right-2" />
            )}
          </button>

          <button
            onClick={toggleQueue}
            className={`p-2 rounded-full transition-colors ${
              isQueueOpen ? 'text-primary bg-surface-hover' : 'text-neutral-400 hover:text-white'
            }`}
            title="Queue"
          >
            <ListMusic size={19} />
          </button>

          <button
            onClick={toggleFullscreenLyrics}
            className="p-2 rounded-full text-neutral-400 hover:text-white transition-colors hidden lg:block"
            title="Full Screen Spicy Lyrics"
          >
            <Maximize2 size={17} />
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white transition-colors"
              title="Mute/Unmute (M)"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 md:w-24 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary hover:h-1.5 transition-all"
            />
          </div>
        </div>
      </footer>
    </>
  );
};
