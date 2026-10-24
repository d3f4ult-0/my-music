import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Minimize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { apiRequest, resolveAssetUrl } from '../../api/client';

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsData {
  song_id: number;
  synced: boolean;
  provider?: string;
  lines?: LyricLine[];
  raw_text?: string;
}

export const SpicyLyricsFullscreen: React.FC = () => {
  const {
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    togglePlay,
    next,
    previous,
    seek,
    isFullscreenLyrics,
    toggleFullscreenLyrics,
    dominantColor,
  } = usePlayerStore();

  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentTrack || !isFullscreenLyrics) return;

    setIsLoading(true);
    apiRequest<LyricsData>(`/songs/${currentTrack.id}/lyrics/parsed`)
      .then((data) => setLyricsData(data))
      .catch(() => setLyricsData(null))
      .finally(() => setIsLoading(false));
  }, [currentTrack?.id, isFullscreenLyrics]);

  const activeIndex =
    lyricsData?.lines && lyricsData.lines.length > 0
      ? lyricsData.lines.reduce((acc, line, idx) => {
          return currentTime >= line.time ? idx : acc;
        }, -1)
      : -1;

  useEffect(() => {
    if (!userScrollingRef.current && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  const handleContainerScroll = () => {
    userScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 2500);
  };

  if (!isFullscreenLyrics || !currentTrack) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0b0c10] text-white select-none animate-in fade-in duration-300 overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(ellipse at 20% 30%, ${dominantColor}50 0%, #0c0d12 75%)`,
      }}
    >
      {/* Top Bar */}
      <div className="h-16 px-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <Mic2 size={20} className="text-primary" />
          <span className="font-bold text-sm tracking-wide text-neutral-200 uppercase">
            Spicy Lyrics
          </span>
          {lyricsData?.synced && (
            <span className="text-[10px] bg-primary/20 text-primary border border-primary/40 px-2 py-0.5 rounded font-mono font-bold">
              KARAOKE SYNC
            </span>
          )}
        </div>

        <button
          onClick={toggleFullscreenLyrics}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
          title="Exit Fullscreen"
        >
          <Minimize2 size={20} />
        </button>
      </div>

      {/* Main Split Layout: Left Rotating Artwork & Right Scrolling Lyrics */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 lg:px-16 py-4 overflow-hidden z-10 max-w-7xl mx-auto w-full items-center">
        {/* Left Column: Rotating Vinyl Artwork & Track Info */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 flex items-center justify-center">
            {/* Ambient Dynamic Glow */}
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-60 pointer-events-none transition-all duration-700"
              style={{ backgroundColor: dominantColor }}
            />

            {/* Slow Rotating Album Vinyl */}
            <div
              className={`relative w-full h-full rounded-full shadow-2xl p-4 bg-neutral-950 border-4 border-neutral-800/90 overflow-hidden flex items-center justify-center gpu-layer ${
                isPlaying ? 'animate-vinyl-spin' : ''
              }`}
              style={{
                animationPlayState: isPlaying ? 'running' : 'paused',
              }}
            >
              {/* Vinyl Grooves */}
              <div className="absolute inset-0 rounded-full border border-neutral-700/30 opacity-70 pointer-events-none" />
              <div className="absolute inset-6 rounded-full border border-neutral-700/20 opacity-60 pointer-events-none" />
              <div className="absolute inset-12 rounded-full border border-neutral-700/20 opacity-50 pointer-events-none" />

              {/* Cover Art Center */}
              <img
                src={
                  resolveAssetUrl(currentTrack.cover_url) ||
                  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'
                }
                alt={currentTrack.title}
                className="w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 rounded-full object-cover shadow-2xl pointer-events-none"
              />

              {/* Center Pin */}
              <div className="absolute w-8 h-8 rounded-full bg-neutral-950 border-2 border-neutral-600 shadow-inner flex items-center justify-center pointer-events-none">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
              <span>{currentTrack.title}</span>
              <CheckCircle2 size={20} className="text-primary fill-primary/20 flex-shrink-0" />
            </h2>
            <p className="text-base text-neutral-300 font-medium">
              {currentTrack.artist?.name || 'Local Artist'}
            </p>
            {currentTrack.album_title && (
              <p className="text-xs text-neutral-400 font-mono">
                {currentTrack.album_title}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Synced Spicy Lyrics Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleContainerScroll}
          className="lg:col-span-7 h-full max-h-[70vh] overflow-y-auto px-4 py-8 space-y-6 scrollbar-none text-left select-text"
        >
          {isLoading ? (
            <div className="py-32 text-center text-neutral-400 text-lg flex items-center justify-center gap-3">
              <RefreshCw size={24} className="animate-spin text-primary" />
              Loading synchronized lyrics...
            </div>
          ) : lyricsData?.lines && lyricsData.lines.length > 0 ? (
            lyricsData.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;

              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.time)}
                  className={`transition-all duration-300 cursor-pointer rounded-2xl p-3 ${
                    isActive
                      ? 'text-white font-extrabold text-2xl sm:text-3xl lg:text-4xl scale-[1.03] drop-shadow-[0_4px_24px_rgba(255,255,255,0.45)]'
                      : isPast
                      ? 'text-neutral-500 font-bold text-lg sm:text-xl lg:text-2xl hover:text-neutral-300'
                      : 'text-neutral-400 font-semibold text-lg sm:text-xl lg:text-2xl hover:text-neutral-200'
                  }`}
                >
                  {line.text || '♪'}
                </div>
              );
            })
          ) : lyricsData?.raw_text ? (
            <div className="whitespace-pre-line text-lg sm:text-xl leading-loose text-neutral-300 font-medium py-10">
              {lyricsData.raw_text}
            </div>
          ) : (
            <div className="py-32 text-center space-y-3">
              <p className="text-lg text-neutral-400">
                No synchronized lyrics available for this track.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Minimal Player Controls */}
      <div className="h-20 px-8 flex items-center justify-center gap-6 z-20 bg-black/40 backdrop-blur-md border-t border-white/10">
        <button
          onClick={previous}
          className="text-neutral-400 hover:text-white transition-colors"
          title="Previous"
        >
          <SkipBack size={22} />
        </button>

        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={22} className="fill-current" /> : <Play size={22} className="fill-current ml-0.5" />}
        </button>

        <button
          onClick={next}
          className="text-neutral-400 hover:text-white transition-colors"
          title="Next"
        >
          <SkipForward size={22} />
        </button>
      </div>
    </div>
  );
};
