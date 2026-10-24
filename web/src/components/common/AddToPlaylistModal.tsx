import React, { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { Song, PlaylistBasic } from '../../types';
import { apiRequest } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

interface AddToPlaylistModalProps {
  song: Song | null;
  onClose: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ song, onClose }) => {
  const { user } = useAuthStore();
  const [playlists, setPlaylists] = useState<PlaylistBasic[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (user) {
      apiRequest<PlaylistBasic[]>('/playlists?only_mine=true')
        .then((res) => setPlaylists(res || []))
        .catch(() => {});
    }
  }, [user]);

  if (!song) return null;

  const handleAdd = async (playlistId: number) => {
    try {
      await apiRequest(`/playlists/${playlistId}/songs`, {
        method: 'POST',
        body: JSON.stringify({ song_id: song.id }),
      });
      setAddedIds((prev) => new Set(prev).add(playlistId));
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      alert(`Could not add song: ${err.message}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const pl = await apiRequest<PlaylistBasic>('/playlists', {
        method: 'POST',
        body: JSON.stringify({ name: newTitle.trim(), is_public: true }),
      });
      setPlaylists((prev) => [pl, ...prev]);
      setNewTitle('');
      setIsCreating(false);
      handleAdd(pl.id);
    } catch (err: any) {
      alert(`Could not create playlist: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border-subtle rounded-xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
          <div>
            <h3 className="font-semibold text-neutral-100 text-base">Add to Playlist</h3>
            <p className="text-xs text-neutral-400 truncate max-w-[240px]">{song.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing Playlists */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 mb-4">
          {playlists.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">No playlists found. Create one below!</p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => handleAdd(pl.id)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-hover text-left transition-colors text-sm text-neutral-200"
              >
                <span className="truncate">{pl.name}</span>
                {addedIds.has(pl.id) ? (
                  <Check size={16} className="text-primary" />
                ) : (
                  <Plus size={16} className="text-neutral-500" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Create new playlist form */}
        {isCreating ? (
          <form onSubmit={handleCreate} className="space-y-2">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-card border border-border-subtle rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-primary"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-primary text-black font-semibold text-xs rounded-lg hover:bg-primary-hover"
              >
                Create & Add
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-surface-card hover:bg-surface-hover rounded-lg border border-border-subtle transition-colors"
          >
            <Plus size={15} /> New Playlist
          </button>
        )}
      </div>
    </div>
  );
};
