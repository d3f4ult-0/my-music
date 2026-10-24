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
  Disc,
  Mic2,
  ChevronLeft,
  Sparkles,
  Zap,
  Folder,
} from 'lucide-react';
import { useOfflineManager } from '../hooks/useOfflineManager';
import { usePlayerStore } from '../stores/playerStore';
import { resolveAssetUrl } from '../api/client';
import { P2PUserManualModal } from '../components/p2p/P2PUserManualModal';
import { Song, OfflineTrack } from '../types';

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

interface AlbumGroup {
  name: string;
  artist: string;
  coverUrl: string;
  tracks: OfflineTrack[];
  totalDuration: number;
}

interface ArtistGroup {
  name: string;
  coverUrl: string;
  tracks: OfflineTrack[];
  albums: string[];
}

export const OfflinePage: React.FC = () => {
  const {
    offlineTracks,
    isScanning,
    scanProgress,
    scanDeviceFiles,
    autoScanStorage,
    removeOfflineTrack,
    clearAllOfflineTracks,
  } = useOfflineManager();

  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayerStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Active view section: 'tracks' | 'albums' | 'artists'
  const [activeTab, setActiveTab] = useState<'tracks' | 'albums' | 'artists'>('tracks');

  // Selected Album / Artist view (drilldown)
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumGroup | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ArtistGroup | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration' | 'size' | 'date'>('date');
  const [showManualModal, setShowManualModal] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const totalBytes = offlineTracks.reduce((acc, t) => acc + (t.size_bytes || 0), 0);

  // File picker handler
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setImportStatus('Extracting ID3 tags & album art...');
      const count = await scanDeviceFiles(files);
      setImportStatus(`Successfully added ${count} song${count === 1 ? '' : 's'} with cover art!`);
      setTimeout(() => setImportStatus(null), 4000);
    } catch (err: any) {
      alert(`Could not import files: ${err.message}`);
      setImportStatus(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Auto-scan storage handler
  const handleAutoScan = async () => {
    try {
      setImportStatus('Auto-scanning storage for songs...');
      const count = await autoScanStorage();
      if (count > 0) {
        setImportStatus(`Auto-scan complete! Added ${count} new songs with album art.`);
      } else {
        // Fallback to folder input if showDirectoryPicker not supported
        folderInputRef.current?.click();
      }
      setTimeout(() => setImportStatus(null), 4000);
    } catch (err: any) {
      console.warn('Auto-scan fallback:', err);
      folderInputRef.current?.click();
    }
  };

  // Group into Albums
  const albumGroups = useMemo<AlbumGroup[]>(() => {
    const map = new Map<string, AlbumGroup>();

    offlineTracks.forEach((t) => {
      const albumName = t.song.album_title || 'Single / Unknown Album';
      const existing = map.get(albumName);

      if (existing) {
        existing.tracks.push(t);
        existing.totalDuration += t.song.duration || 0;
        if (!existing.coverUrl || existing.coverUrl === '/icon-512.png') {
          existing.coverUrl = t.song.cover_url || '';
        }
      } else {
        map.set(albumName, {
          name: albumName,
          artist: t.song.artist?.name || 'Local Artist',
          coverUrl: t.song.cover_url || '',
          tracks: [t],
          totalDuration: t.song.duration || 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [offlineTracks]);

  // Group into Artists
  const artistGroups = useMemo<ArtistGroup[]>(() => {
    const map = new Map<string, ArtistGroup>();

    offlineTracks.forEach((t) => {
      const artistName = t.song.artist?.name || 'Local Artist';
      const existing = map.get(artistName);

      if (existing) {
        existing.tracks.push(t);
        if (t.song.album_title && !existing.albums.includes(t.song.album_title)) {
          existing.albums.push(t.song.album_title);
        }
      } else {
        map.set(artistName, {
          name: artistName,
          coverUrl: t.song.cover_url || '',
          tracks: [t],
          albums: t.song.album_title ? [t.song.album_title] : [],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [offlineTracks]);

  // Filtered and sorted individual tracks
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
        case 'album':
          return (a.song.album_title || '').localeCompare(b.song.album_title || '');
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

  const handlePlayAlbum = (album: AlbumGroup) => {
    const albumSongs = album.tracks.map((t) => t.song);
    if (albumSongs.length > 0) {
      playTrack(albumSongs[0], albumSongs, 0);
    }
  };

  const handleShuffleAlbum = (album: AlbumGroup) => {
    const albumSongs = [...album.tracks.map((t) => t.song)];
    for (let i = albumSongs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [albumSongs[i], albumSongs[j]] = [albumSongs[j], albumSongs[i]];
    }
    if (albumSongs.length > 0) {
      playTrack(albumSongs[0], albumSongs, 0);
    }
  };

  const handlePlayArtist = (artist: ArtistGroup) => {
    const artistSongs = artist.tracks.map((t) => t.song);
    if (artistSongs.length > 0) {
      playTrack(artistSongs[0], artistSongs, 0);
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
    if (
      window.confirm(
        'Are you sure you want to remove all scanned and downloaded songs from your local device storage?'
      )
    ) {
      clearAllOfflineTracks();
      setSelectedAlbum(null);
      setSelectedArtist(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
            <WifiOff size={16} /> Offline Music Library
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            Device Music & Albums
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Real album covers, ID3 tags, and offline playback. No internet or subscription needed.
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
            <span>
              {offlineTracks.length} tracks • {albumGroups.length} albums • {formatBytes(totalBytes)}
            </span>
          </div>
        </div>
      </div>

      {/* Action / Auto-Scan Bar */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAutoScan}
              disabled={isScanning}
              className="px-4 py-2.5 bg-gradient-to-r from-primary to-emerald-400 text-black font-extrabold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-primary/25"
            >
              <Zap size={16} className="fill-black" />
              <span>Auto-Scan Storage</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="px-4 py-2.5 bg-surface hover:bg-surface-hover text-white border border-border-subtle font-semibold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Music size={16} />
              <span>Pick Music Files</span>
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isScanning}
              className="px-3.5 py-2.5 bg-surface hover:bg-surface-hover text-neutral-200 border border-border-subtle font-semibold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
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

          {/* Search Controls */}
          {offlineTracks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search tracks, albums, artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary"
                />
              </div>

              {activeTab === 'tracks' && (
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
                    <option value="album" className="bg-neutral-900 text-white">Album</option>
                    <option value="duration" className="bg-neutral-900 text-white">Duration</option>
                    <option value="size" className="bg-neutral-900 text-white">File Size</option>
                  </select>
                </div>
              )}

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
                Extracting tags & covers ({scanProgress.current} / {scanProgress.total})...
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

        {/* Status Message */}
        {importStatus && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle size={15} />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* Navigation Sections: Tracks vs Albums vs Artists */}
      {!selectedAlbum && !selectedArtist && (
        <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
          <button
            onClick={() => setActiveTab('tracks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'tracks'
                ? 'bg-primary text-black shadow-md shadow-primary/20'
                : 'bg-surface hover:bg-surface-hover text-neutral-300'
            }`}
          >
            <Music size={15} />
            <span>All Tracks ({offlineTracks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('albums')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'albums'
                ? 'bg-primary text-black shadow-md shadow-primary/20'
                : 'bg-surface hover:bg-surface-hover text-neutral-300'
            }`}
          >
            <Disc size={15} />
            <span>Albums ({albumGroups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('artists')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'artists'
                ? 'bg-primary text-black shadow-md shadow-primary/20'
                : 'bg-surface hover:bg-surface-hover text-neutral-300'
            }`}
          >
            <Mic2 size={15} />
            <span>Artists ({artistGroups.length})</span>
          </button>
        </div>
      )}

      {/* Selected Album Drilldown View */}
      {selectedAlbum && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <button
            onClick={() => setSelectedAlbum(null)}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white font-semibold transition-colors"
          >
            <ChevronLeft size={16} /> Back to All Albums
          </button>

          {/* Album Hero Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 bg-gradient-to-b from-surface-card to-[#121212] border border-border-subtle p-6 rounded-2xl">
            <div className="w-44 h-44 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-900 border border-neutral-800">
              <img
                src={resolveAssetUrl(selectedAlbum.coverUrl)}
                alt={selectedAlbum.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-3 text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Album
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {selectedAlbum.name}
              </h2>
              <div className="text-xs text-neutral-300 flex items-center justify-center sm:justify-start gap-2">
                <span className="font-semibold">{selectedAlbum.artist}</span>
                <span>•</span>
                <span>{selectedAlbum.tracks.length} songs</span>
                <span>•</span>
                <span>{formatDuration(selectedAlbum.totalDuration)}</span>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
                <button
                  onClick={() => handlePlayAlbum(selectedAlbum)}
                  className="px-6 py-2.5 bg-primary text-black font-extrabold text-xs rounded-full hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Play size={16} className="fill-current" /> Play Album
                </button>

                <button
                  onClick={() => handleShuffleAlbum(selectedAlbum)}
                  className="p-2.5 bg-surface hover:bg-surface-hover text-white border border-border-subtle rounded-full transition-colors"
                  title="Shuffle Album"
                >
                  <Shuffle size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Album Tracklist */}
          <div className="bg-surface-card/60 border border-border-subtle rounded-2xl divide-y divide-border-subtle/50 overflow-hidden">
            {selectedAlbum.tracks.map((item, idx) => {
              const isCurrent = currentTrack?.id === item.song.id;
              const albumSongList = selectedAlbum.tracks.map((t) => t.song);

              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 flex items-center justify-between gap-4 transition-colors group ${
                    isCurrent ? 'bg-surface-active/80' : 'hover:bg-surface-hover/80'
                  }`}
                >
                  <div
                    onClick={() => playTrack(item.song, albumSongList, idx)}
                    className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                  >
                    <span className="text-xs font-mono text-neutral-500 w-5 text-center group-hover:hidden">
                      {item.song.track_number || idx + 1}
                    </span>
                    <Play size={14} className="fill-primary text-primary hidden group-hover:block" />

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-primary' : 'text-neutral-100 group-hover:text-primary'
                        }`}
                      >
                        {item.song.title}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {item.song.artist?.name || selectedAlbum.artist}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-mono">
                      {formatDuration(item.song.duration)}
                    </span>
                    <button
                      onClick={() => addToQueue(item.song)}
                      className="p-1.5 text-neutral-400 hover:text-white hover:bg-surface rounded-lg transition-colors"
                      title="Add to queue"
                    >
                      <ListPlus size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Artist Drilldown View */}
      {selectedArtist && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <button
            onClick={() => setSelectedArtist(null)}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white font-semibold transition-colors"
          >
            <ChevronLeft size={16} /> Back to All Artists
          </button>

          {/* Artist Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 bg-gradient-to-b from-surface-card to-[#121212] border border-border-subtle p-6 rounded-2xl">
            <div className="w-36 h-36 rounded-full overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-900 border-2 border-primary/40">
              <img
                src={resolveAssetUrl(selectedArtist.coverUrl)}
                alt={selectedArtist.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Artist
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {selectedArtist.name}
              </h2>
              <div className="text-xs text-neutral-300">
                {selectedArtist.tracks.length} tracks • {selectedArtist.albums.length} albums
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handlePlayArtist(selectedArtist)}
                  className="px-6 py-2.5 bg-primary text-black font-extrabold text-xs rounded-full hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Play size={16} className="fill-current" /> Play All by Artist
                </button>
              </div>
            </div>
          </div>

          {/* Artist Tracks */}
          <div className="bg-surface-card/60 border border-border-subtle rounded-2xl divide-y divide-border-subtle/50 overflow-hidden">
            {selectedArtist.tracks.map((item, idx) => {
              const isCurrent = currentTrack?.id === item.song.id;
              const artistSongList = selectedArtist.tracks.map((t) => t.song);

              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 flex items-center justify-between gap-4 transition-colors group ${
                    isCurrent ? 'bg-surface-active/80' : 'hover:bg-surface-hover/80'
                  }`}
                >
                  <div
                    onClick={() => playTrack(item.song, artistSongList, idx)}
                    className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-900">
                      <img
                        src={resolveAssetUrl(item.song.cover_url)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={14} className="fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-primary' : 'text-neutral-100 group-hover:text-primary'
                        }`}
                      >
                        {item.song.title}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {item.song.album_title || 'Single'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-mono">
                      {formatDuration(item.song.duration)}
                    </span>
                    <button
                      onClick={() => addToQueue(item.song)}
                      className="p-1.5 text-neutral-400 hover:text-white hover:bg-surface rounded-lg transition-colors"
                      title="Add to queue"
                    >
                      <ListPlus size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 1: ALL TRACKS VIEW */}
      {!selectedAlbum && !selectedArtist && activeTab === 'tracks' && (
        <div className="space-y-2">
          {offlineTracks.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mx-auto">
                <Music size={32} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">No device songs scanned yet</h2>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Tap <strong>Auto-Scan</strong> or pick songs from your phone's storage. Full ID3 album art will be extracted automatically!
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  onClick={handleAutoScan}
                  className="w-full sm:w-auto px-6 py-2.5 bg-primary text-black font-bold text-xs rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Zap size={15} className="fill-black" />
                  <span>Auto-Scan Storage</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-surface hover:bg-surface-hover text-white border border-border-subtle font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Music size={15} />
                  <span>Pick Music Files</span>
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
                    <div
                      onClick={() => handlePlayOffline(idx)}
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-900 border border-neutral-800">
                        <img
                          src={resolveAssetUrl(item.song.cover_url)}
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
                          <span>{item.song.artist?.name || 'Local Artist'}</span>
                          {item.song.album_title && (
                            <>
                              <span>•</span>
                              <span className="text-neutral-300">{item.song.album_title}</span>
                            </>
                          )}
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
        </div>
      )}

      {/* SECTION 2: ALBUMS GRID VIEW */}
      {!selectedAlbum && !selectedArtist && activeTab === 'albums' && (
        <div>
          {albumGroups.length === 0 ? (
            <div className="py-16 text-center text-neutral-500 text-sm">
              No albums found. Import songs to automatically group them into albums!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {albumGroups.map((album) => (
                <div
                  key={album.name}
                  onClick={() => setSelectedAlbum(album)}
                  className="bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-2xl p-3 cursor-pointer transition-all group flex flex-col justify-between"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-neutral-900 border border-neutral-800">
                    <img
                      src={resolveAssetUrl(album.coverUrl)}
                      alt={album.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAlbum(album);
                      }}
                      className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-xl"
                      title="Play Album"
                    >
                      <Play size={16} className="fill-current ml-0.5" />
                    </button>
                  </div>

                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                      {album.name}
                    </h3>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {album.artist}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-1">
                      {album.tracks.length} track{album.tracks.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: ARTISTS VIEW */}
      {!selectedAlbum && !selectedArtist && activeTab === 'artists' && (
        <div>
          {artistGroups.length === 0 ? (
            <div className="py-16 text-center text-neutral-500 text-sm">
              No artists found. Import songs to see artists organized here!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artistGroups.map((artist) => (
                <div
                  key={artist.name}
                  onClick={() => setSelectedArtist(artist)}
                  className="bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-2xl p-4 cursor-pointer transition-all group flex flex-col items-center text-center space-y-3"
                >
                  <div className="relative w-28 h-28 rounded-full overflow-hidden bg-neutral-900 border-2 border-border-subtle group-hover:border-primary transition-colors shadow-md">
                    <img
                      src={resolveAssetUrl(artist.coverUrl)}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={20} className="fill-white text-white ml-0.5" />
                    </div>
                  </div>

                  <div className="w-full">
                    <h3 className="font-bold text-white text-sm truncate group-hover:text-primary transition-colors">
                      {artist.name}
                    </h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {artist.tracks.length} song{artist.tracks.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
