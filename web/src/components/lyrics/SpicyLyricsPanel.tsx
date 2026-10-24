import React, { useEffect, useState, useRef } from 'react';
import {
  Mic2,
  Maximize2,
  Minimize2,
  Upload,
  RefreshCw,
  Edit3,
  Check,
  X,
  Disc,
  CheckCircle2,
  Music,
  ExternalLink,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { apiRequest, resolveAssetUrl } from '../../api/client';
import { Song } from '../../types';

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
  const [error, setError] = useState<string | null>(null);

  // Upload/Edit Lyrics Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [customLyricsText, setCustomLyricsText] = useState('');
  const [isSavingLyrics, setIsSavingLyrics] = useState(false);
  const [isSearchingPublic, setIsSearchingPublic] = useState(false);

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
    setError(null);

    apiRequest<LyricsData>(`/songs/${currentTrack.id}/lyrics/parsed`)
      .then((data) => {
        setLyricsData(data);
      })
      .catch(() => {
        // Fallback or not found
        setLyricsData(null);
        setError('No lyrics available yet.');
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

  const handleSearchPublicLyrics = async () => {
    if (!currentTrack) return;
    setIsSearchingPublic(true);
    try {
      const refreshed = await apiRequest<LyricsData>(
        `/songs/${currentTrack.id}/lyrics?force_refresh=true`
      );
      if (refreshed) {
        // Reload parsed lines
        const parsed = await apiRequest<LyricsData>(`/songs/${currentTrack.id}/lyrics/parsed`);
        setLyricsData(parsed);
        setError(null);
      }
    } catch (err: any) {
      alert('Could not find public lyrics on LRCLIB: ' + (err.message || ''));
    } finally {
      setIsSearchingPublic(false);
    }
  };

  const handleSaveCustomLyrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack || !customLyricsText.trim()) return;

    setIsSavingLyrics(true);
    try {
      await apiRequest(`/songs/${currentTrack.id}/lyrics`, {
        method: 'PUT',
        body: JSON.stringify({ lyrics_text: customLyricsText.trim() }),
      });
      // Refresh
      const parsed = await apiRequest<LyricsData>(`/songs/${currentTrack.id}/lyrics/parsed`);
      setLyricsData(parsed);
      setError(null);
      setIsEditModalOpen(false);
      setCustomLyricsText('');
    } catch (err: any) {
      alert('Failed to save lyrics: ' + err.message);
    } finally {
      setIsSavingLyrics(false);
    }
  };

  const handleUploadLrcFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTrack) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsSavingLyrics(true);
    try {
      await apiRequest(`/songs/${currentTrack.id}/lyrics/upload-file`, {
        method: 'POST',
        body: formData,
      });
      const parsed = await apiRequest<LyricsData>(`/songs/${currentTrack.id}/lyrics/parsed`);
      setLyricsData(parsed);
      setError(null);
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert('Failed to upload LRC file: ' + err.message);
    } finally {
      setIsSavingLyrics(false);
    }
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
                <div className="absolute inset-0 rounded-full border border-neutral-700/30 opacity-70 pointer-events-none" />
                <div className="absolute inset-4 rounded-full border border-neutral-700/20 opacity-60 pointer-events-none" />
                <div className="absolute inset-8 rounded-full border border-neutral-700/20 opacity-50 pointer-events-none" />

                {/* Album Cover Center */}
                <img
                  src={
                    resolveAssetUrl(currentTrack.cover_url) ||
                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'
                  }
                  alt={currentTrack.title}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover shadow-inner pointer-events-none"
                />

                {/* Center Spindle Hole */}
                <div className="absolute w-6 h-6 rounded-full bg-neutral-950 border-2 border-neutral-600 shadow-inner flex items-center justify-center pointer-events-none">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-800" />
                </div>
              </div>
            </div>

            {/* Track Info */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-bold text-white tracking-tight truncate hover:underline cursor-pointer">
                  {currentTrack.title}
                </h3>
                <CheckCircle2 size={16} className="text-primary fill-primary/20 flex-shrink-0" />
              </div>
              <p className="text-xs text-neutral-400 font-medium truncate hover:underline cursor-pointer mt-0.5">
                {currentTrack.artist?.name || 'Local Artist'}
              </p>
            </div>

            {/* Spicy Lyrics Card */}
            <div className="bg-surface-card/80 border border-border-subtle/80 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3 relative overflow-hidden">
              {/* Lyrics Header Controls */}
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle/50">
                <div className="flex items-center gap-2">
                  <Mic2 size={16} className="text-primary" />
                  <span className="font-bold text-xs uppercase tracking-wider text-neutral-200">
                    Spicy Lyrics
                  </span>
                  {lyricsData?.synced && (
                    <span className="text-[10px] bg-primary/20 text-primary border border-primary/40 px-1.5 py-0.2 rounded font-semibold font-mono">
                      SYNCED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-surface-hover transition-colors"
                    title="Upload or Edit Lyrics"
                  >
                    <Upload size={14} />
                  </button>
                  <button
                    onClick={handleSearchPublicLyrics}
                    disabled={isSearchingPublic}
                    className="p-1 text-neutral-400 hover:text-primary rounded hover:bg-surface-hover transition-colors"
                    title="Search LRCLIB Public Database"
                  >
                    <RefreshCw size={13} className={isSearchingPublic ? 'animate-spin' : ''} />
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
                    <RefreshCw size={14} className="animate-spin text-primary" />
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
                        onClick={handleSearchPublicLyrics}
                        disabled={isSearchingPublic}
                        className="py-1.5 px-3 bg-surface hover:bg-surface-hover border border-border-subtle rounded-lg text-xs font-semibold text-neutral-200 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RefreshCw size={13} className={isSearchingPublic ? 'animate-spin' : ''} />
                        Search Online (LRCLIB)
                      </button>
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="py-1.5 px-3 bg-primary text-black font-semibold rounded-lg text-xs hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Upload size={13} /> Upload LRC Lyrics
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {lyricsData?.provider && (
                <div className="text-[10px] text-neutral-400 pt-1 border-t border-border-subtle/40 flex justify-between items-center">
                  <span>Lyrics source: {lyricsData.provider}</span>
                  <span className="text-primary font-mono cursor-pointer hover:underline" onClick={() => setIsEditModalOpen(true)}>
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

      {/* Upload & Edit Lyrics Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border-subtle rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Mic2 size={18} className="text-primary" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Upload or Edit Lyrics for "{currentTrack?.title}"
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-surface-hover"
              >
                <X size={18} />
              </button>
            </div>

            {/* Upload .lrc file option */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Upload .LRC or .TXT file
              </label>
              <input
                type="file"
                accept=".lrc,.txt"
                onChange={handleUploadLrcFile}
                className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-surface-hover file:text-neutral-200 hover:file:bg-primary hover:file:text-black cursor-pointer"
              />
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border-subtle"></div>
              <span className="flex-shrink mx-3 text-neutral-500 text-[11px] uppercase">Or Paste Lyrics</span>
              <div className="flex-grow border-t border-border-subtle"></div>
            </div>

            {/* Paste lyrics form */}
            <form onSubmit={handleSaveCustomLyrics} className="space-y-3">
              <textarea
                rows={8}
                placeholder="[00:12.30] In the end, it doesn't even matter...&#10;[00:16.80] I had to fall to lose it all"
                value={customLyricsText}
                onChange={(e) => setCustomLyricsText(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border-subtle rounded-xl text-white font-mono text-xs focus:outline-none focus:border-primary resize-none leading-relaxed"
                required
              />
              <p className="text-[11px] text-neutral-400">
                Supports standard timestamped LRC tags like <code className="text-primary">[01:23.45]</code> for synced karaoke.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLyrics || !customLyricsText.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-black hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Check size={14} />
                  {isSavingLyrics ? 'Saving...' : 'Save Lyrics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
