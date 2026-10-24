import React, { useEffect, useState, useRef } from 'react';
import {
  Mic2,
  Maximize2,
  X,
  Disc,
  CheckCircle2,
  Music,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { resolveAssetUrl } from '../../api/client';
import { getLyricsForSong, LyricsData } from '../../services/lyricsService';
import { LyricsEditorModal } from './LyricsEditorModal';

export const SpicyLyricsPanel: React.FC = () => {
  const {
    currentTrack,
    currentTime,
    isPlaying,
    seek,
    isLyricsOpen,
    setLyricsOpen,
    toggleFullscreenLyrics,
    dominantColor,
  } = usePlayerStore();

  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Active line reference for auto-scrolling
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load lyrics when currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    setIsLoading(true);
    getLyricsForSong(
      currentTrack.id,
      currentTrack.title,
      currentTrack.artist?.name,
      currentTrack.duration
    )
      .then((data) => {
        setLyricsData(data);
      })
      .catch(() => {
        setLyricsData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [currentTrack?.id]);

  // Find active line index based on playback currentTime
  const activeIndex =
    lyricsData?.lines && lyricsData.lines.length > 0
      ? lyricsData.lines.reduce((acc, line, idx) => {
          return currentTime >= line.time ? idx : acc;
        }, -1)
      : -1;

  // Auto-scroll to active line smoothly unless user manually touched scroll
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

  const handleLineClick = (time: number) => {
    seek(time);
  };

  if (!isLyricsOpen) {
    return null;
  }

  return (
    <aside
      className="hidden xl:flex flex-col w-80 2xl:w-96 bg-[#121212]/95 border-l border-border-subtle select-none flex-shrink-0 relative overflow-hidden transition-all duration-300"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 10%, ${dominantColor}30 0%, transparent 60%)`,
      }}
    >
      {/* Header */}
      <div className="h-14 px-5 border-b border-border-subtle/60 flex items-center justify-between z-10 bg-surface/30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-neutral-100 truncate">
            {currentTrack?.album_title || 'Now Playing'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-neutral-400">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="p-1.5 hover:text-white rounded-lg hover:bg-surface-hover transition-colors"
            title="Add or Edit Lyrics"
          >
            <Mic2 size={16} className={lyricsData ? 'text-primary' : ''} />
          </button>
          <button
            onClick={toggleFullscreenLyrics}
            className="p-1.5 hover:text-white rounded-lg hover:bg-surface-hover transition-colors"
            title="Spicy Lyrics Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={() => setLyricsOpen(false)}
            className="p-1.5 hover:text-white rounded-lg hover:bg-surface-hover transition-colors"
            title="Close Panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-thin">
        {currentTrack ? (
          <>
            {/* Rotating Album Artwork */}
            <div className="relative group mx-auto w-52 h-52 sm:w-60 sm:h-60 mt-1 flex items-center justify-center">
              {/* Ambient Glow */}
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-40 transition-opacity duration-700 pointer-events-none"
                style={{ backgroundColor: dominantColor }}
              />

              {/* Vinyl Record with Slow Rotation */}
              <div
                className={`relative w-full h-full rounded-full shadow-2xl p-2.5 bg-neutral-900 border-4 border-neutral-800/80 overflow-hidden flex items-center justify-center transition-transform gpu-layer ${
                  isPlaying ? 'animate-vinyl-spin' : ''
                }`}
                style={{
                  animationPlayState: isPlaying ? 'running' : 'paused',
                }}
              >
                {/* Vinyl Grooves Texture */}
                <div className="absolute inset-0 rounded-full border border-neutral-700/40 opacity-70 pointer-events-none" />
                <div className="absolute inset-4 rounded-full border border-neutral-700/30 opacity-60 pointer-events-none" />
                <div className="absolute inset-8 rounded-full border border-neutral-700/20 opacity-50 pointer-events-none" />

                {/* Album Cover Centerpiece */}
                <img
                  src={
                    resolveAssetUrl(currentTrack.cover_url) ||
                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'
                  }
                  alt={currentTrack.title}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover shadow-inner pointer-events-none"
                />

                {/* Center Hole / Spindle Pin */}
                <div className="absolute w-6 h-6 rounded-full bg-neutral-950 border border-neutral-600 shadow-inner flex items-center justify-center pointer-events-none">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-800" />
                </div>
              </div>
            </div>

            {/* Track Info Card */}
            <div className="space-y-1 text-center">
              <h3 className="font-extrabold text-base text-white truncate flex items-center justify-center gap-1.5">
                <span>{currentTrack.title}</span>
                <CheckCircle2 size={16} className="text-primary fill-primary/20 flex-shrink-0" />
              </h3>
              <p className="text-xs text-neutral-400 font-medium truncate">
                {currentTrack.artist?.name || 'Local Artist'}
              </p>
            </div>

            {/* Spicy Lyrics Stream Card */}
            <div className="bg-surface-card/80 border border-border-subtle rounded-2xl p-4 shadow-xl backdrop-blur-md relative space-y-2">
              <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                <div className="flex items-center gap-2">
                  <Mic2 size={16} className="text-primary" />
                  <span className="font-bold text-xs uppercase tracking-wider text-neutral-200">
                    Spicy Lyrics
                  </span>
                  {lyricsData?.synced && (
                    <span className="text-[9px] bg-primary/20 text-primary border border-primary/40 px-1.5 py-0.5 rounded font-mono font-bold">
                      SYNC
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded hover:bg-surface-hover transition-colors"
                  >
                    {lyricsData ? 'Edit' : 'Add'}
                  </button>
                  <button
                    onClick={toggleFullscreenLyrics}
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-surface-hover transition-colors"
                    title="Expand Fullscreen"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>

              {/* Synchronized Scrolling Lines Container */}
              <div
                ref={scrollContainerRef}
                onScroll={handleContainerScroll}
                className="max-h-72 overflow-y-auto space-y-3.5 pr-1 scrollbar-none py-4 text-center sm:text-left select-text"
              >
                {isLoading ? (
                  <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                    <Sparkles size={14} className="animate-spin text-primary" />
                    Finding authentic lyrics...
                  </div>
                ) : lyricsData?.lines && lyricsData.lines.length > 0 ? (
                  lyricsData.lines.map((line, idx) => {
                    const isActive = idx === activeIndex;
                    const isPast = idx < activeIndex;

                    return (
                      <div
                        key={idx}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => handleLineClick(line.time)}
                        className={`transition-all duration-300 cursor-pointer rounded-lg px-2 py-1 ${
                          isActive
                            ? 'text-white font-extrabold text-base md:text-lg scale-[1.02] drop-shadow-[0_2px_12px_rgba(255,255,255,0.3)] bg-white/5'
                            : isPast
                            ? 'text-neutral-500 font-semibold text-xs md:text-sm hover:text-neutral-300'
                            : 'text-neutral-400 font-medium text-xs md:text-sm hover:text-neutral-200'
                        }`}
                      >
                        {line.text || '♪'}
                      </div>
                    );
                  })
                ) : lyricsData?.raw_text ? (
                  <div className="whitespace-pre-line text-xs leading-relaxed text-neutral-300 font-medium">
                    {lyricsData.raw_text}
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-neutral-400">
                      No lyrics found yet for this song.
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="py-1.5 px-3 bg-primary text-black font-semibold rounded-lg text-xs hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <PlusCircle size={14} /> Add / Search Lyrics
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {lyricsData?.provider && (
                <div className="text-[10px] text-neutral-400 pt-1 border-t border-border-subtle/40 flex justify-between items-center">
                  <span>Source: {lyricsData.provider}</span>
                  <span
                    className="text-primary font-mono cursor-pointer hover:underline"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    Edit / Replace
                  </span>
                </div>
              )}
            </div>

            {/* About the Artist Card */}
            <div className="bg-surface-card/60 border border-border-subtle/80 rounded-2xl p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                About the Artist
              </h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-neutral-400 overflow-hidden flex-shrink-0">
                  {currentTrack.artist?.image_url ? (
                    <img src={currentTrack.artist.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music size={22} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">
                    {currentTrack.artist?.name || 'Local Producer'}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    Local Device Master
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="py-24 text-center space-y-3 text-neutral-500">
            <Disc size={40} className="mx-auto text-neutral-700 animate-spin-slow" />
            <p className="text-xs">Play a track to view rotating artwork and Spicy Lyrics.</p>
          </div>
        )}
      </div>

      {/* Lyrics Editor Modal */}
      {currentTrack && (
        <LyricsEditorModal
          isOpen={isEditModalOpen}
          song={currentTrack}
          initialLyrics={lyricsData}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(saved) => setLyricsData(saved)}
          onDelete={() => setLyricsData(null)}
        />
      )}
    </aside>
  );
};
