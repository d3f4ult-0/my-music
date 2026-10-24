import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Sliders,
  Mic2,
  ListMusic,
  Volume2,
  VolumeX,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { resolveAssetUrl } from '../../api/client';
import { EqualizerModal } from './EqualizerModal';
import { LyricsEditorModal } from '../lyrics/LyricsEditorModal';
import { getLyricsForSong, LyricsData } from '../../services/lyricsService';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface MobileFullPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSeek: (seconds: number) => void;
}

export const MobileFullPlayerModal: React.FC<MobileFullPlayerModalProps> = ({
  isOpen,
  onClose,
  onSeek,
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    dominantColor,
    togglePlay,
    next,
    previous,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleQueue,
    toggleTrackFavorite,
  } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<'cover' | 'lyrics'>('cover');
  const [isEqOpen, setIsEqOpen] = useState(false);
  const [isLyricsEditorOpen, setIsLyricsEditorOpen] = useState(false);
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load lyrics whenever current track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    setIsLoadingLyrics(true);
    getLyricsForSong(
      currentTrack.id,
      currentTrack.title,
      currentTrack.artist?.name,
      currentTrack.duration
    )
      .then((data) => setLyricsData(data))
      .catch(() => setLyricsData(null))
      .finally(() => setIsLoadingLyrics(false));
  }, [currentTrack?.id]);

  // Find active line index in lyrics
  const activeLineIndex =
    lyricsData?.lines && lyricsData.lines.length > 0
      ? lyricsData.lines.reduce((acc, line, idx) => {
          return currentTime >= line.time ? idx : acc;
        }, -1)
      : -1;

  // Auto-scroll lyrics smoothly
  useEffect(() => {
    if (
      activeTab === 'lyrics' &&
      !userScrollingRef.current &&
      activeLyricRef.current &&
      lyricsScrollRef.current
    ) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, activeTab]);

  const handleLyricsScroll = () => {
    userScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 2500);
  };

  if (!isOpen || !currentTrack) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-[#0d0e12] text-white select-none animate-in slide-in-from-bottom duration-300 overflow-hidden"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 20%, ${dominantColor}55 0%, #0d0e12 80%)`,
        }}
      >
        {/* Top Navigation Bar */}
        <header className="h-16 px-4 flex items-center justify-between flex-shrink-0 z-20">
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-neutral-300"
            title="Collapse"
          >
            <ChevronDown size={26} />
          </button>

          <div className="flex flex-col items-center max-w-[200px] text-center">
            <span className="text-[10px] tracking-wider uppercase text-neutral-400 font-semibold">
              Playing From Library
            </span>
            <span className="text-xs font-bold text-neutral-200 truncate w-full">
              {currentTrack.album_title || 'Local Audio'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEqOpen(true)}
              className="p-2 rounded-full hover:bg-white/10 text-neutral-300 transition-colors"
              title="Equalizer"
            >
              <Sliders size={20} />
            </button>
            <button
              onClick={() => {
                onClose();
                toggleQueue();
              }}
              className="p-2 rounded-full hover:bg-white/10 text-neutral-300 transition-colors"
              title="Queue"
            >
              <ListMusic size={20} />
            </button>
          </div>
        </header>

        {/* Tab Switcher: Cover Artwork vs Lyrics */}
        <div className="flex items-center justify-center gap-2 py-1 flex-shrink-0 z-20">
          <button
            onClick={() => setActiveTab('cover')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeTab === 'cover'
                ? 'bg-white/20 text-white font-bold backdrop-blur-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Artwork
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeTab === 'lyrics'
                ? 'bg-primary text-black font-bold shadow-md shadow-primary/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Mic2 size={13} />
            <span>Lyrics</span>
            {lyricsData?.synced && (
              <span className="w-1.5 h-1.5 rounded-full bg-black/60 ml-0.5" />
            )}
          </button>
        </div>

        {/* Center Content: Cover Art OR Synced Lyrics */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-2 overflow-hidden z-10 min-h-0">
          {activeTab === 'cover' ? (
            <div className="flex flex-col items-center justify-center w-full max-w-sm my-auto">
              {/* Big Album Art with Dynamic Ambient Shadow */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-neutral-900 group">
                <img
                  src={
                    resolveAssetUrl(currentTrack.cover_url) ||
                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'
                  }
                  alt={currentTrack.title}
                  className="w-full h-full object-cover select-none"
                />
              </div>
            </div>
          ) : (
            <div
              ref={lyricsScrollRef}
              onScroll={handleLyricsScroll}
              className="w-full h-full max-w-lg overflow-y-auto px-2 py-4 space-y-5 text-center scrollbar-none select-text"
            >
              {isLoadingLyrics ? (
                <div className="py-24 text-neutral-400 text-sm flex items-center justify-center gap-2">
                  <Sparkles size={18} className="animate-spin text-primary" />
                  Loading lyrics...
                </div>
              ) : lyricsData?.lines && lyricsData.lines.length > 0 ? (
                lyricsData.lines.map((line, idx) => {
                  const isActive = idx === activeLineIndex;
                  const isPast = idx < activeLineIndex;

                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLyricRef : null}
                      onClick={() => onSeek(line.time)}
                      className={`cursor-pointer transition-all duration-300 py-1.5 px-3 rounded-xl ${
                        isActive
                          ? 'text-white font-extrabold text-2xl sm:text-3xl scale-[1.03] drop-shadow-[0_4px_16px_rgba(255,255,255,0.4)]'
                          : isPast
                          ? 'text-neutral-500 font-semibold text-base sm:text-lg hover:text-neutral-300'
                          : 'text-neutral-400 font-semibold text-base sm:text-lg hover:text-neutral-200'
                      }`}
                    >
                      {line.text || '♪'}
                    </div>
                  );
                })
              ) : lyricsData?.raw_text ? (
                <div className="whitespace-pre-line text-base text-neutral-300 font-medium py-6 leading-relaxed">
                  {lyricsData.raw_text}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <Mic2 size={36} className="text-neutral-500" />
                  <p className="text-sm text-neutral-400">No lyrics found for this song yet.</p>
                  <button
                    onClick={() => setIsLyricsEditorOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md"
                  >
                    <PlusCircle size={15} />
                    <span>Add / Search Lyrics</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Section: Track Info, Scrubber, Playback Controls */}
        <div className="w-full max-w-md mx-auto px-6 pb-6 pt-2 flex flex-col space-y-3 z-20 flex-shrink-0">
          {/* Song Details & Favorite */}
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                {currentTrack.title}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 truncate">
                <span className="truncate">{currentTrack.artist?.name || 'Local Artist'}</span>
                {currentTrack.peer_origin && (
                  <span className="text-[9px] bg-primary/20 text-primary border border-primary/40 px-1 rounded font-mono font-bold">
                    P2P
                  </span>
                )}
                {currentTrack.codec && (
                  <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1 rounded font-mono uppercase">
                    {currentTrack.codec}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsLyricsEditorOpen(true)}
                className="p-2 text-neutral-400 hover:text-white"
                title="Add / Edit Lyrics"
              >
                <Mic2 size={20} className={lyricsData ? 'text-primary' : ''} />
              </button>

              <button
                onClick={() => toggleTrackFavorite(currentTrack.id)}
                className="p-2 text-neutral-400 hover:text-white active:scale-90 transition-transform"
                title="Favorite"
              >
                <Heart
                  size={24}
                  className={currentTrack.is_favorite ? 'fill-primary text-primary' : ''}
                />
              </button>
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-neutral-700/80 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Playback Controls: Shuffle, Prev, Play, Next, Repeat */}
          <div className="flex items-center justify-between px-2 pt-1">
            <button
              onClick={toggleShuffle}
              className={`p-2 transition-colors active:scale-90 ${
                shuffle ? 'text-primary' : 'text-neutral-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle size={22} />
            </button>

            <button
              onClick={previous}
              className="p-2 text-neutral-200 hover:text-white active:scale-90 transition-transform"
              title="Previous"
            >
              <SkipBack size={30} className="fill-current" />
            </button>

            {/* Big Circular Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={28} className="fill-current" />
              ) : (
                <Play size={28} className="fill-current ml-1" />
              )}
            </button>

            <button
              onClick={next}
              className="p-2 text-neutral-200 hover:text-white active:scale-90 transition-transform"
              title="Next"
            >
              <SkipForward size={30} className="fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-2 transition-colors active:scale-90 ${
                repeatMode !== 'off' ? 'text-primary' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
            </button>
          </div>

          {/* Bottom Volume Slider */}
          <div className="flex items-center gap-3 pt-2 px-1">
            <button
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white"
              title="Mute"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      </div>

      {/* Equalizer Modal */}
      <EqualizerModal isOpen={isEqOpen} onClose={() => setIsEqOpen(false)} />

      {/* Lyrics Editor Modal */}
      <LyricsEditorModal
        isOpen={isLyricsEditorOpen}
        song={currentTrack}
        initialLyrics={lyricsData}
        onClose={() => setIsLyricsEditorOpen(false)}
        onSave={(saved) => setLyricsData(saved)}
        onDelete={() => setLyricsData(null)}
      />
    </>
  );
};
