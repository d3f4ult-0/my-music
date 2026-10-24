import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Disc,
  Flame,
  Radio,
  Music,
  FolderPlus,
  Play,
  Pause,
  BookOpen,
  WifiOff,
  CheckCircle,
  FileAudio,
  Zap,
} from 'lucide-react';
import { HomeFeed, Song } from '../types';
import { apiRequest, resolveAssetUrl } from '../api/client';
import { SongRow } from '../components/common/SongRow';
import { AlbumCard } from '../components/common/AlbumCard';
import { ArtistCard } from '../components/common/ArtistCard';
import { usePlayerStore } from '../stores/playerStore';
import { useOfflineManager } from '../hooks/useOfflineManager';
import { P2PUserManualModal } from '../components/p2p/P2PUserManualModal';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const { offlineTracks, isScanning, scanProgress, scanDeviceFiles, autoScanStorage } = useOfflineManager();

  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  const handleAutoScan = async () => {
    try {
      setScanMessage('Auto-scanning device storage for songs...');
      const count = await autoScanStorage();
      if (count > 0) {
        setScanMessage(`Auto-scan complete! Added ${count} songs with album art.`);
      } else {
        fileInputRef.current?.click();
      }
      setTimeout(() => setScanMessage(null), 4000);
    } catch {
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    apiRequest<HomeFeed>('/home')
      .then((data) => {
        setFeed(data);
      })
      .catch((err) => {
        console.warn('Could not load remote home feed, defaulting to local player mode:', err);
        setFeed({
          greeting: 'Welcome to MyMusic',
          recently_played: [],
          favorites: [],
          new_releases: [],
          popular_songs: [],
          featured_artists: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDeviceFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setScanMessage('Scanning & importing songs from your device...');
      const count = await scanDeviceFiles(files);
      setScanMessage(`Successfully imported ${count} song${count === 1 ? '' : 's'}!`);
      setTimeout(() => setScanMessage(null), 4000);
    } catch (err: any) {
      alert(`Could not import audio files: ${err.message}`);
      setScanMessage(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const offlineSongs = offlineTracks.map((t) => t.song);

  const handlePlayDeviceTrack = (index: number) => {
    const song = offlineSongs[index];
    if (!song) return;

    if (currentTrack?.id === song.id) {
      togglePlay();
    } else {
      playTrack(song, offlineSongs, index);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Curating your music space...</span>
        </div>
      </div>
    );
  }

  const currentFeed = feed || {
    greeting: 'Welcome to MyMusic',
    recently_played: [],
    favorites: [],
    new_releases: [],
    popular_songs: [],
    featured_artists: [],
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Hidden file input for 1-tap device song scan */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDeviceFiles}
        multiple
        accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.wma"
        className="hidden"
      />

      {/* Greeting Banner */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1.5">
          {currentFeed.greeting}
        </h1>
        <p className="text-xs md:text-sm text-neutral-400">
          Lossless music player, local storage scanner, and P2P Wi-Fi sharing.
        </p>
      </div>

      {/* Device Music & P2P Quick Actions Hero Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Device Storage Scanner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-neutral-900 to-[#181818] border border-border-subtle shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
              <Music size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Your Downloaded Music</h3>
              <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                Scan MP3, FLAC, or WAV songs stored in your phone's Downloads or Music folder. Play offline anytime with zero internet.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleAutoScan}
              disabled={isScanning}
              className="px-4 py-2 bg-gradient-to-r from-primary to-emerald-400 text-black font-extrabold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shadow-primary/25"
            >
              <Zap size={14} className="fill-black" />
              <span>Auto-Scan</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="px-3.5 py-2 bg-surface hover:bg-surface-hover text-white border border-border-subtle rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Music size={14} />
              <span>Pick Files</span>
            </button>

            <button
              onClick={() => navigate('/offline')}
              className="px-3.5 py-2 bg-surface hover:bg-surface-hover text-white border border-border-subtle rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <WifiOff size={14} className="text-primary" />
              <span>Library ({offlineTracks.length})</span>
            </button>
          </div>
        </div>

        {/* Card 2: P2P Network & User Manual */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-950/30 to-[#181818] border border-blue-500/25 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Radio size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">P2P Wi-Fi & Hotspot Sharing</h3>
              <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                Stream lossless music directly between devices on the same Wi-Fi or phone hotspot. No accounts, no data usage.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => navigate('/peers')}
              className="px-4 py-2 bg-blue-500 text-white font-bold text-xs rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Radio size={14} />
              <span>Connect to Peers</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className="px-3.5 py-2 bg-surface hover:bg-surface-hover text-white border border-border-subtle rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <BookOpen size={14} className="text-blue-400" />
              <span>User Manual</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scanning Progress Feedback */}
      {isScanning && scanProgress && (
        <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-primary flex items-center gap-2">
              <FileAudio size={16} className="animate-spin" />
              Scanning device songs ({scanProgress.current} / {scanProgress.total})...
            </span>
            <span className="text-neutral-400 font-mono text-[11px]">
              {Math.round((scanProgress.current / scanProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-neutral-400 truncate font-mono">
            {scanProgress.currentFile}
          </p>
        </div>
      )}

      {/* Success Notification */}
      {scanMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle size={15} />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Device Music Section (shown if user has scanned tracks) */}
      {offlineTracks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Music size={20} className="text-primary" /> Your Device Music ({offlineTracks.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => playTrack(offlineSongs[0], offlineSongs, 0)}
                className="px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-bold flex items-center gap-1.5 hover:scale-105 transition-all"
              >
                <Play size={13} className="fill-current" /> Play All
              </button>
              <button
                onClick={() => navigate('/offline')}
                className="text-xs text-neutral-400 hover:text-white"
              >
                See All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {offlineTracks.slice(0, 6).map((item, idx) => {
              const isCurrent = currentTrack?.id === item.song.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handlePlayDeviceTrack(idx)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group ${
                    isCurrent
                      ? 'bg-surface-active/80 border-primary/40'
                      : 'bg-surface-card hover:bg-surface-hover border-border-subtle'
                  }`}
                >
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-900 border border-neutral-800">
                    <img
                      src={resolveAssetUrl(item.song.cover_url) || '/icon-512.png'}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div
                      className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                        isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause size={14} className="fill-primary text-primary" />
                      ) : (
                        <Play size={14} className="fill-white text-white ml-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                        isCurrent ? 'text-primary' : 'text-neutral-100 group-hover:text-primary'
                      }`}
                    >
                      {item.song.title}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {item.song.artist?.name || 'Device Audio'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recently Played */}
      {currentFeed.recently_played.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              Recently Played
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {currentFeed.recently_played.slice(0, 6).map((song, idx) => (
              <div
                key={song.id}
                onClick={() => playTrack(song, currentFeed.recently_played, idx)}
                className="flex items-center gap-3 p-2 rounded-lg bg-surface-card hover:bg-surface-hover transition-colors cursor-pointer border border-border-subtle group"
              >
                <img
                  src={resolveAssetUrl(song.cover_url) || '/icon-512.png'}
                  alt=""
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-200 truncate group-hover:text-primary transition-colors">
                    {song.title}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">
                    {song.artist?.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New Releases (Albums) */}
      {currentFeed.new_releases.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Sparkles size={20} className="text-primary" /> New Releases
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {currentFeed.new_releases.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Tracks */}
      {currentFeed.popular_songs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Flame size={20} className="text-amber-400" /> Popular Tracks
            </h2>
          </div>
          <div className="bg-surface-card/60 border border-border-subtle rounded-xl p-2 md:p-3 divide-y divide-border-subtle/50">
            {currentFeed.popular_songs.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                playlistContext={currentFeed.popular_songs}
                onAddToPlaylist={onAddToPlaylist}
                onReport={onReport}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured Artists */}
      {currentFeed.featured_artists.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Disc size={20} className="text-primary" /> Featured Artists
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {currentFeed.featured_artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {/* P2P User Manual Modal */}
      <P2PUserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
      />
    </div>
  );
};
