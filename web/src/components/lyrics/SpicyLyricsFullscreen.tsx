import React, { useEffect, useState, useRef } from 'react';
import {
  Minimize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Mic2,
  Sliders,
  Sparkles,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { resolveAssetUrl } from '../../api/client';
import { getLyricsForSong, LyricsData } from '../../services/lyricsService';
import { LyricsEditorModal } from './LyricsEditorModal';
import { EqualizerModal } from '../player/EqualizerModal';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const SpicyLyricsFullscreen: React.FC = () => {
  const {
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    shuffle,
    repeatMode,
    togglePlay,
    next,
    previous,
    seek,
    toggleShuffle,
    cycleRepeat,
    isFullscreenLyrics,
    toggleFullscreenLyrics,
    dominantColor,
  } = usePlayerStore();

  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEqOpen, setIsEqOpen] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentTrack || !isFullscreenLyrics) return;

    setIsLoading(true);
    getLyricsForSong(
      currentTrack.id,
      currentTrack.title,
      currentTrack.artist?.name,
      currentTrack.duration
    )
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
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-[#0b0c10] text-white select-none animate-in fade-in duration-300 overflow-hidden"
        style={{
          backgroundImage: `radial-gradient(ellipse at 20% 30%, ${dominantColor}55 0%, #0c0d12 80%)`,
        }}
      >
        {/* Top Bar */}
        <div className="h-16 px-6 sm:px-8 flex items-center justify-between z-20 flex-shrink-0">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-neutral-200 transition-all backdrop-blur-md"
              title="Add or Edit Lyrics"
            >
              <Mic2 size={14} className="text-primary" />
              <span>{lyricsData ? 'Edit Lyrics' : 'Add Lyrics'}</span>
            </button>

            <button
              onClick={() => setIsEqOpen(true)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-200 transition-all backdrop-blur-md"
              title="Equalizer"
            >
              <Sliders size={18} />
            </button>

            <button
              onClick={toggleFullscreenLyrics}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
              title="Exit Fullscreen"
            >
              <Minimize2 size={20} />
            </button>
          </div>
        </div>

        {/* Main Split Layout: Left Rotating Artwork & Right Scrolling Lyrics */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 lg:px-16 py-2 overflow-hidden z-10 max-w-7xl mx-auto w-full items-center min-h-0">
          {/* Left Column: Rotating Vinyl Artwork & Track Info */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center text-center space-y-5">
            <div className="relative w-52 h-52 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center">
              {/* Dynamic Glow */}
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
                  className="w-32 h-32 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-full object-cover shadow-2xl pointer-events-none"
                />

                {/* Center Pin */}
                <div className="absolute w-7 h-7 rounded-full bg-neutral-950 border-2 border-neutral-600 shadow-inner flex items-center justify-center pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-neutral-800" />
                </div>
              </div>
            </div>

            <div className="space-y-1 max-w-sm">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
                <span className="truncate">{currentTrack.title}</span>
                <CheckCircle2 size={18} className="text-primary fill-primary/20 flex-shrink-0" />
              </h2>
              <p className="text-sm text-neutral-300 font-medium truncate">
                {currentTrack.artist?.name || 'Local Artist'}
              </p>
              {currentTrack.album_title && (
                <p className="text-xs text-neutral-400 font-mono truncate">
                  {currentTrack.album_title}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Synced Spicy Lyrics Scroll */}
          <div
            ref={scrollContainerRef}
            onScroll={handleContainerScroll}
            className="lg:col-span-7 h-full max-h-[55vh] lg:max-h-[65vh] overflow-y-auto px-4 py-4 space-y-5 text-left select-text scrollbar-none"
          >
            {isLoading ? (
              <div className="py-24 text-center text-neutral-400 text-sm flex items-center justify-center gap-2">
                <Sparkles size={18} className="animate-spin text-primary" />
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
                    className={`transition-all duration-300 cursor-pointer rounded-2xl p-2.5 ${
                      isActive
                        ? 'text-white font-extrabold text-xl sm:text-2xl lg:text-3xl scale-[1.02] drop-shadow-[0_4px_24px_rgba(255,255,255,0.45)]'
                        : isPast
                        ? 'text-neutral-500 font-bold text-base sm:text-lg lg:text-xl hover:text-neutral-300'
                        : 'text-neutral-400 font-semibold text-base sm:text-lg lg:text-xl hover:text-neutral-200'
                    }`}
                  >
                    {line.text || '♪'}
                  </div>
                );
              })
            ) : lyricsData?.raw_text ? (
              <div className="whitespace-pre-line text-base sm:text-lg leading-relaxed text-neutral-300 font-medium py-8">
                {lyricsData.raw_text}
              </div>
            ) : (
              <div className="py-20 text-center space-y-4">
                <p className="text-base text-neutral-400">
                  No lyrics available for this song yet.
                </p>
                <button
                  onClick={() => setIsEditorOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  <PlusCircle size={16} />
                  <span>Add / Search Lyrics</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Full Controls: Timeline Scrubber + Buttons */}
        <div className="px-6 sm:px-12 py-3 z-20 bg-black/50 backdrop-blur-md border-t border-white/10 flex flex-col space-y-2 flex-shrink-0">
          {/* Scrubber */}
          <div className="flex items-center gap-3 max-w-3xl mx-auto w-full text-xs font-mono text-neutral-400">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="w-10">{formatTime(duration)}</span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between max-w-md mx-auto w-full pt-1">
            <button
              onClick={toggleShuffle}
              className={`p-2 transition-colors ${
                shuffle ? 'text-primary' : 'text-neutral-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle size={20} />
            </button>

            <button
              onClick={previous}
              className="p-2 text-neutral-300 hover:text-white transition-transform active:scale-95"
              title="Previous"
            >
              <SkipBack size={24} className="fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={22} className="fill-current" />
              ) : (
                <Play size={22} className="fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={next}
              className="p-2 text-neutral-300 hover:text-white transition-transform active:scale-95"
              title="Next"
            >
              <SkipForward size={24} className="fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-2 transition-colors ${
                repeatMode !== 'off' ? 'text-primary' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <LyricsEditorModal
        isOpen={isEditorOpen}
        song={currentTrack}
        initialLyrics={lyricsData}
        onClose={() => setIsEditorOpen(false)}
        onSave={(saved) => setLyricsData(saved)}
        onDelete={() => setLyricsData(null)}
      />

      <EqualizerModal isOpen={isEqOpen} onClose={() => setIsEqOpen(false)} />
    </>
  );
};
