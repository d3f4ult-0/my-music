import React, { useRef, useState, useMemo } from 'react';
import {
  WifiOff,
  Trash2,
  HardDrive,
  Play,
  Pause,
  Upload,
  FolderPlus,
  Music,
  Shuffle,
  Search,
  CheckCircle,
  Radio,
  BookOpen,
  ArrowUpDown,
  FileAudio,
  Plus,
  ListPlus,
} from 'lucide-react';
import { useOfflineManager } from '../hooks/useOfflineManager';
import { usePlayerStore } from '../stores/playerStore';
import { resolveAssetUrl } from '../api/client';
import { P2PUserManualModal } from '../components/p2p/P2PUserManualModal';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const OfflinePage: React.FC = () => {
  const {
    offlineTracks,
    isScanning,
    scanProgress,
    scanDeviceFiles,
    removeOfflineTrack,
    clearAllOfflineTracks,
  } = useOfflineManager();

  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayerStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'duration' | 'size' | 'date'>('date');
  const [showManualModal, setShowManualModal] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const totalBytes = offlineTracks.reduce((acc, t) => acc + (t.size_bytes || 0), 0);

  // File picker handler
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setImportStatus('Scanning & importing files...');
      const count = await scanDeviceFiles(files);
      setImportStatus(`Successfully added ${count} song${count === 1 ? '' : 's'} to your offline library!`);
      setTimeout(() => setImportStatus(null), 4000);
    } catch (err: any) {
      alert(`Could not import files: ${err.message}`);
      setImportStatus(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Filtered and sorted tracks
  const filteredTracks = useMemo(() => {
    let result = [...offlineTracks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.song.title.toLowerCase().includes(q) ||
          t.song.artist?.name.toLowerCase().includes(q) ||
          t.song.album_title?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.song.title.localeCompare(b.song.title);
        case 'artist':
          return (a.song.artist?.name || '').localeCompare(b.song.artist?.name || '');
        case 'duration':
          return (b.song.duration || 0) - (a.song.duration || 0);
        case 'size':
          return (b.size_bytes || 0) - (a.size_bytes || 0);
        case 'date':
        default:
          return new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime();
      }
    });

    return result;
  }, [offlineTracks, searchQuery, sortBy]);

  const songList = useMemo(() => filteredTracks.map((t) => t.song), [filteredTracks]);

  const handlePlayOffline = (trackIndex: number) => {
    const item = filteredTracks[trackIndex];
    if (!item) return;

    if (currentTrack?.id === item.song.id) {
      togglePlay();
    } else {
      playTrack(item.song, songList, trackIndex);
    }
  };

  const handlePlayAll = () => {
    if (songList.length > 0) {
      playTrack(songList[0], songList, 0);
    }
  };

  const handleShuffleAll = () => {
    if (songList.length > 0) {
      const shuffled = [...songList];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      playTrack(shuffled[0], shuffled, 0);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to remove all scanned and downloaded songs from your local device storage?')) {
      clearAllOfflineTracks();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        multiple
        accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.wma"
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFilesSelected}
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <WifiOff size={16} /> Local Storage Audio
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            Device & Offline Music
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Scan and play music downloaded on your phone or computer. Completely offline with zero internet required.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle text-xs text-neutral-300 hover:text-white transition-colors"
          >
            <BookOpen size={14} className="text-primary" />
            <span>P2P User Manual</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border-subtle text-xs text-neutral-300">
            <HardDrive size={15} className="text-primary" />
            <span>{offlineTracks.length} tracks • {formatBytes(totalBytes)}</span>
          </div>
        </div>
      </div>

      {/* Action / Scan Bar */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Scan Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="px-4 py-2.5 bg-primary text-black font-bold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Music size={16} />
              <span>Pick Songs from Device</span>
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isScanning}
              className="px-4 py-2.5 bg-surface hover:bg-surface-hover text-white border border-border-subtle font-semibold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <FolderPlus size={16} />
              <span>Scan Folder</span>
            </button>

            {offlineTracks.length > 0 && (
              <>
                <button
                  onClick={handlePlayAll}
                  className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Play size={14} className="fill-current text-primary" />
                  <span>Play All</span>
                </button>

                <button
                  onClick={handleShuffleAll}
                  className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Shuffle size={14} className="text-primary" />
                  <span>Shuffle</span>
                </button>
              </>
            )}
          </div>

          {/* Search & Sort Controls */}
          {offlineTracks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search device music..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-1 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                <ArrowUpDown size={12} className="text-neutral-400" />
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs text-neutral-300 focus:outline-none cursor-pointer"
                >
                  <option value="date" className="bg-neutral-900 text-white">Date Added</option>
                  <option value="title" className="bg-neutral-900 text-white">Title (A-Z)</option>
                  <option value="artist" className="bg-neutral-900 text-white">Artist</option>
                  <option value="duration" className="bg-neutral-900 text-white">Duration</option>
                  <option value="size" className="bg-neutral-900 text-white">File Size</option>
                </select>
              </div>

              <button
                onClick={handleClearAll}
                className="p-2 text-neutral-400 hover:text-red-400 hover:bg-surface border border-border-subtle rounded-lg transition-colors"
                title="Clear all device tracks"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Scanning Progress Banner */}
        {isScanning && scanProgress && (
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-primary flex items-center gap-2">
                <FileAudio size={16} className="animate-spin" />
                Scanning device audio ({scanProgress.current} / {scanProgress.total})...
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

        {/* Import Success Banner */}
        {importStatus && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle size={15} />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* P2P Quick Guide Banner */}
      <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-surface-card to-surface-card border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-neutral-200">
          <Radio size={18} className="text-primary flex-shrink-0 animate-pulse" />
          <span>
            <strong>Want music from a friend or PC?</strong> Connect devices over your local Wi-Fi or phone hotspot with zero data used.
          </span>
        </div>
        <button
          onClick={() => setShowManualModal(true)}
          className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-lg font-semibold text-xs transition-colors self-start sm:self-auto"
        >
          View P2P Manual
        </button>
      </div>

      {/* Track List or Empty State */}
      {offlineTracks.length === 0 ? (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mx-auto">
            <Music size={32} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">No device songs scanned yet</h2>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Pick songs directly from your phone's <strong>Downloads</strong> or <strong>Music</strong> folder to listen anytime, anywhere without an internet connection.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-6 py-2.5 bg-primary text-black font-bold text-xs rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <Music size={15} />
              <span>Pick Songs from Device</span>
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              className="w-full sm:w-auto px-5 py-2.5 bg-surface hover:bg-surface-hover text-white border border-border-subtle font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <FolderPlus size={15} />
              <span>Scan Music Folder</span>
            </button>
          </div>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 text-sm">
          No offline tracks matching "{searchQuery}"
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredTracks.map((item, idx) => {
            const isCurrent = currentTrack?.id === item.song.id;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all group ${
                  isCurrent
                    ? 'bg-surface-active/80 border-primary/40 shadow-sm'
                    : 'bg-surface-card hover:bg-surface-hover border-border-subtle'
                }`}
              >
                {/* Clickable Song Info & Play Button */}
                <div
                  onClick={() => handlePlayOffline(idx)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
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
                        <Pause size={16} className="fill-primary text-primary" />
                      ) : (
                        <Play size={16} className="fill-white text-white ml-0.5" />
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
                    <div className="text-[11px] text-neutral-400 truncate flex items-center gap-2 mt-0.5">
                      <span>{item.song.artist?.name || 'Device Audio'}</span>
                      <span>•</span>
                      <span className="font-mono text-neutral-500">{formatBytes(item.size_bytes)}</span>
                      {item.song.codec && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] bg-neutral-800/80 px-1 py-0.2 rounded text-neutral-400">
                            {item.song.codec}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration & Actions */}
                <div className="flex items-center gap-2 sm:gap-4 pl-2">
                  <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                    {formatDuration(item.song.duration)}
                  </span>

                  <button
                    onClick={() => addToQueue(item.song)}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-surface rounded-lg transition-colors"
                    title="Add to queue"
                  >
                    <ListPlus size={15} />
                  </button>

                  <button
                    onClick={() => removeOfflineTrack(item.id)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-surface rounded-lg transition-colors"
                    title="Remove from device storage"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* P2P Manual Modal */}
      <P2PUserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
      />
    </div>
  );
};
