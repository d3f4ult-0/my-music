import React, { useState, useEffect } from 'react';
import {
  X,
  Mic2,
  Search,
  Upload,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
  FileText,
  HelpCircle,
} from 'lucide-react';
import {
  LyricsData,
  parseLrc,
  saveLyricsForSong,
  deleteLyricsForSong,
  fetchLyricsFromLrclib,
} from '../../services/lyricsService';
import { Song } from '../../types';

interface LyricsEditorModalProps {
  isOpen: boolean;
  song: Song;
  initialLyrics?: LyricsData | null;
  onClose: () => void;
  onSave: (saved: LyricsData) => void;
  onDelete?: () => void;
}

export const LyricsEditorModal: React.FC<LyricsEditorModalProps> = ({
  isOpen,
  song,
  initialLyrics,
  onClose,
  onSave,
  onDelete,
}) => {
  const [lyricsText, setLyricsText] = useState('');
  const [isSearchingLrclib, setIsSearchingLrclib] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialLyrics?.raw_text) {
      setLyricsText(initialLyrics.raw_text);
    } else if (initialLyrics?.lines && initialLyrics.lines.length > 0) {
      const formatted = initialLyrics.lines
        .map((l) => {
          const mins = Math.floor(l.time / 60);
          const secs = Math.floor(l.time % 60);
          const ms = Math.floor((l.time % 1) * 100);
          return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
            .toString()
            .padStart(2, '0')}] ${l.text}`;
        })
        .join('\n');
      setLyricsText(formatted);
    } else {
      setLyricsText('');
    }
    setSearchStatus(null);
  }, [initialLyrics, isOpen, song.id]);

  if (!isOpen) return null;

  const parsedPreview = parseLrc(lyricsText);

  // 1-Click Auto Search from public LRCLIB
  const handleAutoSearchLrclib = async () => {
    setIsSearchingLrclib(true);
    setSearchStatus('Searching LRCLIB public lyrics repository...');
    try {
      const result = await fetchLyricsFromLrclib(song.title, song.artist?.name, song.duration);
      if (result && (result.raw_text || result.lines?.length)) {
        setLyricsText(result.raw_text || '');
        setSearchStatus(
          `Found ${result.synced ? 'synced' : 'plain'} lyrics via ${result.provider || 'LRCLIB'}!`
        );
      } else {
        setSearchStatus('No match found on LRCLIB. You can paste lyrics manually below.');
      }
    } catch (err: any) {
      setSearchStatus('Search failed. Check your internet connection.');
    } finally {
      setIsSearchingLrclib(false);
    }
  };

  // Import .lrc or .txt from device
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setLyricsText(content);
        setSearchStatus(`Loaded file "${file.name}"`);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!lyricsText.trim()) return;

    setIsSaving(true);
    try {
      const saved = await saveLyricsForSong(
        song.id,
        lyricsText.trim(),
        song.title,
        song.artist?.name
      );
      onSave(saved);
      onClose();
    } catch (err: any) {
      alert('Could not save lyrics: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove lyrics for this song?')) return;
    await deleteLyricsForSong(song.id);
    if (onDelete) onDelete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-[#18191c] border border-neutral-700/70 rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/20 text-primary">
              <Mic2 size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-white truncate">Add / Edit Lyrics</h3>
              <p className="text-xs text-neutral-400 truncate">
                {song.title} • {song.artist?.name || 'Local Artist'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Row: Auto Search & File Import */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAutoSearchLrclib}
            disabled={isSearchingLrclib}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            {isSearchingLrclib ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Search size={14} />
            )}
            <span>Auto-Search LRCLIB</span>
          </button>

          <label className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold cursor-pointer transition-all active:scale-95">
            <Upload size={14} />
            <span>Import .LRC File</span>
            <input
              type="file"
              accept=".lrc,.txt"
              onChange={handleFileSelect}
              className="sr-only"
            />
          </label>
        </div>

        {/* Search Status Toast */}
        {searchStatus && (
          <div className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
            <span className="truncate">{searchStatus}</span>
          </div>
        )}

        {/* Text Area for LRC / Plain text */}
        <div className="flex-1 flex flex-col min-h-[180px] sm:min-h-[220px]">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5 flex-shrink-0">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              LRC / Plain Lyrics Input
            </span>
            <span className="font-mono text-[11px]">
              {parsedPreview.synced ? (
                <span className="text-primary font-bold">Karaoke Synced ({parsedPreview.lines.length} lines)</span>
              ) : (
                <span className="text-neutral-400">Plain text ({parsedPreview.lines.length} lines)</span>
              )}
            </span>
          </div>

          <textarea
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            placeholder={`Paste lyrics here...\n\nExample Synced format:\n[00:12.50] First verse line...\n[00:16.80] Second verse line...\n\nOr simply paste plain lyrics line-by-line.`}
            className="flex-1 w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs sm:text-sm font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-primary/60 resize-none scrollbar-thin"
          />
        </div>

        {/* Help Tip */}
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 flex-shrink-0">
          <HelpCircle size={13} />
          <span>
            Synced timestamps [mm:ss.xx] enable real-time karaoke highlight while playing.
          </span>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800 flex-shrink-0">
          {initialLyrics ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-2 rounded-xl hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !lyricsText.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Save Lyrics</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
