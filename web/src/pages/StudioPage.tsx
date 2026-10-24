import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Plus,
  Music,
  Disc,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FolderSearch,
  Layers,
  Sparkles,
  FileAudio,
} from 'lucide-react';
import { apiRequest, resolveAssetUrl } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { AlbumBasic, Song } from '../types';

export const StudioPage: React.FC = () => {
  const { user } = useAuthStore();
  const [albums, setAlbums] = useState<AlbumBasic[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab switch: 'batch' (recommended for normal users), 'single', 'folder', 'album'
  const [activeTab, setActiveTab] = useState<'batch' | 'single' | 'folder' | 'album'>('batch');

  // Batch upload state
  const [batchFiles, setBatchFiles] = useState<FileList | null>(null);
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  // Local folder scan state
  const [folderPath, setFolderPath] = useState('');
  const [isScanningFolder, setIsScanningFolder] = useState(false);

  // Album creation form
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [albumYear, setAlbumYear] = useState<number>(new Date().getFullYear());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  // Single song upload form
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [songTitle, setSongTitle] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | undefined>(undefined);
  const [songGenre, setSongGenre] = useState('');
  const [downloadAllowed, setDownloadAllowed] = useState(true);
  const [isUploadingSong, setIsUploadingSong] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStudioData = async () => {
    setLoading(true);
    try {
      const allAlbums = await apiRequest<AlbumBasic[]>('/albums');
      setAlbums(allAlbums);

      const allSongs = await apiRequest<Song[]>('/songs');
      setSongs(allSongs);
    } catch (err: any) {
      console.warn('Studio load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudioData();
  }, []);

  // 1. Batch Upload (Normal User Flow)
  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchFiles || batchFiles.length === 0) return;

    setIsBatchUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < batchFiles.length; i++) {
        formData.append('files', batchFiles[i]);
      }
      formData.append('download_allowed', downloadAllowed ? 'true' : 'false');

      const res = await apiRequest<{
        total_processed: number;
        imported_songs: Song[];
        created_albums: number;
        failed_files: { file: string; error: string }[];
      }>('/studio/songs/batch-upload', {
        method: 'POST',
        body: formData,
      });

      if (res.imported_songs.length > 0) {
        setSongs((prev) => [...res.imported_songs, ...prev]);
        setMessage({
          type: 'success',
          text: `Successfully auto-imported ${res.imported_songs.length} song(s) and organized them into ${res.created_albums} album(s) with extracted cover art!`,
        });
      } else if (res.failed_files.length > 0) {
        setMessage({
          type: 'error',
          text: `Import failed for: ${res.failed_files.map((f) => f.file).join(', ')}`,
        });
      }
      setBatchFiles(null);
      loadStudioData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Batch upload failed' });
    } finally {
      setIsBatchUploading(false);
    }
  };

  // 2. Folder Scan (Local Device Library Flow)
  const handleScanFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath.trim()) return;

    setIsScanningFolder(true);
    setMessage(null);
    try {
      const res = await apiRequest<{
        status: string;
        total_scanned: number;
        imported: number;
        failed_count: number;
        message?: string;
      }>('/studio/import-directory', {
        method: 'POST',
        body: JSON.stringify({
          directory_path: folderPath.trim(),
          download_allowed: downloadAllowed,
        }),
      });

      if (res.status === 'completed') {
        setMessage({
          type: 'success',
          text: `Found ${res.total_scanned} audio files: ${res.imported} tracks successfully auto-detected, tagged, and imported with artwork!`,
        });
        loadStudioData();
      } else {
        setMessage({ type: 'error', text: res.message || 'No audio files found.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Folder scan failed' });
    } finally {
      setIsScanningFolder(false);
    }
  };

  // 3. Single Song Upload
  const handleUploadSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) return;

    setIsUploadingSong(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      if (songTitle.trim()) formData.append('title', songTitle.trim());
      if (selectedAlbumId) formData.append('album_id', selectedAlbumId.toString());
      if (songGenre.trim()) formData.append('genre', songGenre.trim());
      formData.append('download_allowed', downloadAllowed ? 'true' : 'false');

      const newSong = await apiRequest<Song>('/studio/songs/upload', {
        method: 'POST',
        body: formData,
      });

      setSongs((prev) => [newSong, ...prev]);
      setAudioFile(null);
      setSongTitle('');
      setSongGenre('');
      setMessage({
        type: 'success',
        text: `Track "${newSong.title}" uploaded! Tags and cover artwork auto-detected.`,
      });
      loadStudioData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Audio upload failed' });
    } finally {
      setIsUploadingSong(false);
    }
  };

  // 4. Album Creation
  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumTitle.trim()) return;

    setIsCreatingAlbum(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('title', albumTitle.trim());
      if (albumDesc) formData.append('description', albumDesc.trim());
      if (albumYear) formData.append('year', albumYear.toString());
      if (coverFile) formData.append('cover_file', coverFile);

      const newAlbum = await apiRequest<AlbumBasic>('/studio/albums', {
        method: 'POST',
        body: formData,
      });

      setAlbums((prev) => [newAlbum, ...prev]);
      setAlbumTitle('');
      setAlbumDesc('');
      setCoverFile(null);
      setMessage({ type: 'success', text: `Album "${newAlbum.title}" created successfully!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Album creation failed' });
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const handleDeleteSong = async (songId: number) => {
    if (!window.confirm('Delete this track from your catalog?')) return;
    try {
      await apiRequest(`/studio/songs/${songId}`, { method: 'DELETE' });
      setSongs((prev) => prev.filter((s) => s.id !== songId));
      setMessage({ type: 'success', text: 'Track deleted.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Could not delete track' });
    }
  };

  const handleToggleDownload = async (song: Song) => {
    const nextAllowed = !song.download_allowed;
    try {
      const formData = new FormData();
      formData.append('download_allowed', nextAllowed ? 'true' : 'false');
      await apiRequest(`/studio/songs/${song.id}`, {
        method: 'PATCH',
        body: formData,
      });
      setSongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, download_allowed: nextAllowed } : s))
      );
    } catch (err: any) {
      alert(`Could not toggle download permission: ${err.message}`);
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="pb-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <Sparkles size={16} /> Intelligent Audio & Artwork Ingestion
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <UploadCloud size={28} className="text-primary" /> Music Import & Studio
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            Drop your music files or scan a folder. The player automatically reads ID3/Vorbis tags, extracts embedded cover art, creates albums, and indexes your audio.
          </p>
        </div>
      </div>

      {/* Status Alert Banner */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-150 ${
            message.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
              : 'bg-red-950/40 text-red-300 border border-red-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-3">
        <button
          onClick={() => setActiveTab('batch')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'batch'
              ? 'bg-primary text-black shadow-md'
              : 'bg-surface-card hover:bg-surface-hover text-neutral-300 border border-border-subtle'
          }`}
        >
          <Layers size={16} />
          <span>Batch / Drop Multiple Files (Auto-Detect)</span>
        </button>

        <button
          onClick={() => setActiveTab('folder')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'folder'
              ? 'bg-primary text-black shadow-md'
              : 'bg-surface-card hover:bg-surface-hover text-neutral-300 border border-border-subtle'
          }`}
        >
          <FolderSearch size={16} />
          <span>Scan Local Folder</span>
        </button>

        <button
          onClick={() => setActiveTab('single')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'single'
              ? 'bg-primary text-black shadow-md'
              : 'bg-surface-card hover:bg-surface-hover text-neutral-300 border border-border-subtle'
          }`}
        >
          <Music size={16} />
          <span>Single Track Upload</span>
        </button>

        <button
          onClick={() => setActiveTab('album')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'album'
              ? 'bg-primary text-black shadow-md'
              : 'bg-surface-card hover:bg-surface-hover text-neutral-300 border border-border-subtle'
          }`}
        >
          <Disc size={16} />
          <span>Manual Album Creator</span>
        </button>
      </div>

      {/* TAB 1: BATCH AUTO-DETECT (Best for normal users) */}
      {activeTab === 'batch' && (
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border-subtle">
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                Batch Import with Automatic Tag & Cover Art Detection
              </h3>
              <p className="text-xs text-neutral-400">
                Select or drop multiple MP3s, FLACs, or M4As. Titles, artists, albums, and embedded cover art are extracted automatically.
              </p>
            </div>
          </div>

          <form onSubmit={handleBatchUpload} className="space-y-4">
            <div className="border-2 border-dashed border-border-subtle hover:border-primary/50 transition-colors rounded-2xl p-8 text-center bg-background/50 cursor-pointer relative">
              <input
                type="file"
                multiple
                accept=".mp3,.flac,.wav,.m4a,.ogg"
                onChange={(e) => setBatchFiles(e.target.files)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <FileAudio size={42} className="mx-auto text-primary mb-3" />
              <div className="text-sm font-bold text-white">
                {batchFiles && batchFiles.length > 0
                  ? `${batchFiles.length} file(s) selected for import`
                  : 'Click or Drag & Drop audio files here'}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Supports MP3 (with ID3 APIC), FLAC, M4A, OGG, and WAV.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={downloadAllowed}
                  onChange={(e) => setDownloadAllowed(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <span className="text-neutral-300">Allow listeners and LAN peers to download these tracks</span>
              </label>

              <button
                type="submit"
                disabled={isBatchUploading || !batchFiles || batchFiles.length === 0}
                className="px-6 py-2.5 bg-primary text-black font-bold text-xs sm:text-sm rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                {isBatchUploading ? 'Auto-Detecting & Importing...' : `Import ${batchFiles?.length || 0} Track(s)`}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB 2: FOLDER SCAN */}
      {activeTab === 'folder' && (
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border-subtle">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FolderSearch size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                Scan Local Music Folder on Device
              </h3>
              <p className="text-xs text-neutral-400">
                Point to a music folder on this machine. All subfolders are scanned, extracting ID3 tags, embedded covers, and folder artwork (cover.jpg/png).
              </p>
            </div>
          </div>

          <form onSubmit={handleScanFolder} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Folder Directory Path *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. C:\Users\Username\Music or D:\Music\Albums"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border-subtle rounded-xl text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-neutral-400">
                Recursively checks audio files and captures folder artwork like <code className="text-neutral-300">cover.jpg</code> or <code className="text-neutral-300">folder.jpg</code>.
              </span>

              <button
                type="submit"
                disabled={isScanningFolder || !folderPath.trim()}
                className="px-6 py-2.5 bg-primary text-black font-bold text-xs sm:text-sm rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <FolderSearch size={16} />
                {isScanningFolder ? 'Scanning & Auto-Importing...' : 'Scan & Auto-Import'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB 3: SINGLE TRACK UPLOAD */}
      {activeTab === 'single' && (
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-white border-b border-border-subtle pb-3">
            <Music size={18} className="text-primary" />
            <span>Upload Single Audio Track</span>
          </div>

          <form onSubmit={handleUploadSong} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-neutral-400 mb-1 font-medium">
                Audio File * (MP3, FLAC, WAV, M4A)
              </label>
              <input
                type="file"
                required
                accept=".mp3,.flac,.wav,.m4a,.ogg"
                onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-surface-hover file:text-neutral-200 hover:file:bg-primary hover:file:text-black cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-400 mb-1 font-medium">
                  Track Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-detect from tags"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 font-medium">
                  Assign to Album (Optional)
                </label>
                <select
                  value={selectedAlbumId || ''}
                  onChange={(e) =>
                    setSelectedAlbumId(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary"
                >
                  <option value="">Auto-detect from album tag</option>
                  {albums.map((alb) => (
                    <option key={alb.id} value={alb.id}>
                      {alb.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-neutral-400 mb-1 font-medium">Genre (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Synthwave, Indie Rock"
                  value={songGenre}
                  onChange={(e) => setSongGenre(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 sm:pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={downloadAllowed}
                    onChange={(e) => setDownloadAllowed(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                  <span className="text-neutral-300">Allow Listeners to Download</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploadingSong || !audioFile}
              className="w-full py-2.5 bg-primary text-black font-bold text-xs sm:text-sm rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors shadow"
            >
              {isUploadingSong ? 'Uploading & Extracting Metadata & Cover Art...' : 'Publish Track'}
            </button>
          </form>
        </section>
      )}

      {/* TAB 4: MANUAL ALBUM CREATOR */}
      {activeTab === 'album' && (
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-white border-b border-border-subtle pb-3">
            <Disc size={18} className="text-primary" />
            <span>Create New Album with Custom Artwork</span>
          </div>

          <form onSubmit={handleCreateAlbum} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-neutral-400 mb-1 font-medium">Album Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Midnight Reverie"
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-medium">Description</label>
              <textarea
                rows={2}
                placeholder="Story, credits, or notes..."
                value={albumDesc}
                onChange={(e) => setAlbumDesc(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-400 mb-1 font-medium">Release Year</label>
                <input
                  type="number"
                  value={albumYear}
                  onChange={(e) => setAlbumYear(parseInt(e.target.value) || 2026)}
                  className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 font-medium">Cover Artwork File</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCoverFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-surface-hover file:text-neutral-200 hover:file:bg-primary hover:file:text-black cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingAlbum}
              className="w-full py-2.5 bg-primary text-black font-bold text-xs sm:text-sm rounded-xl hover:bg-primary-hover transition-colors shadow"
            >
              {isCreatingAlbum ? 'Creating Album...' : 'Create Album'}
            </button>
          </form>
        </section>
      )}

      {/* Published Catalog Table */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">Your Library Catalog ({songs.length} tracks)</h2>

        {songs.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500 bg-surface-card rounded-2xl border border-border-subtle">
            Your catalog is empty. Drag and drop audio files above to auto-detect and populate your library!
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card">
            <table className="w-full text-left text-xs sm:text-sm text-neutral-300">
              <thead className="bg-surface-hover/80 text-[11px] uppercase tracking-wider text-neutral-400 border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Album</th>
                  <th className="py-3 px-4">Codec / Bitrate</th>
                  <th className="py-3 px-4">Download Permission</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {songs.map((song) => (
                  <tr key={song.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-3">
                      <img
                        src={resolveAssetUrl(song.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&auto=format&fit=crop&q=80'}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-neutral-800"
                      />
                      <div>
                        <div className="font-semibold text-neutral-100">{song.title}</div>
                        <div className="text-[11px] text-neutral-400">{song.artist?.name || 'Local Artist'}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-neutral-400">{song.album_title || 'Single'}</td>
                    <td className="py-3 px-4 font-mono text-neutral-400 text-xs">
                      {song.codec || 'audio/mp3'} {song.bitrate ? `• ${Math.round(song.bitrate / 1000)}kbps` : ''}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleDownload(song)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          song.download_allowed
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {song.download_allowed ? 'Allowed' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteSong(song.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors rounded-lg hover:bg-surface"
                        title="Delete track"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
