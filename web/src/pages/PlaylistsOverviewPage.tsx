import React, { useEffect, useState } from 'react';
import { Plus, ListMusic } from 'lucide-react';
import { PlaylistBasic } from '../types';
import { apiRequest } from '../api/client';
import { PlaylistCard } from '../components/common/PlaylistCard';
import { useAuthStore } from '../stores/authStore';

export const PlaylistsOverviewPage: React.FC = () => {
  const [playlists, setPlaylists] = useState<PlaylistBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const { user } = useAuthStore();

  const loadPlaylists = () => {
    setLoading(true);
    apiRequest<PlaylistBasic[]>('/playlists')
      .then((data) => setPlaylists(data || []))
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlaylists();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const pl = await apiRequest<PlaylistBasic>('/playlists', {
        method: 'POST',
        body: JSON.stringify({
          name: title.trim(),
          description: description.trim() || undefined,
          is_public: isPublic,
        }),
      });
      setPlaylists((prev) => [pl, ...prev]);
      setTitle('');
      setDescription('');
      setIsCreating(false);
    } catch (err: any) {
      alert(`Could not create playlist: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ListMusic size={28} className="text-primary" /> Playlists
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Curated song collections created by listeners and artists.
          </p>
        </div>

        {user && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-primary text-black font-semibold text-xs rounded-full flex items-center gap-1.5 hover:bg-primary-hover transition-colors shadow"
          >
            <Plus size={16} /> Create Playlist
          </button>
        )}
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div className="p-5 rounded-xl bg-surface-card border border-border-subtle max-w-md">
          <h3 className="font-bold text-white text-sm mb-3">Create New Playlist</h3>
          <form onSubmit={handleCreate} className="space-y-3 text-xs sm:text-sm">
            <div>
              <label className="block text-neutral-400 mb-1">Playlist Name *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ambient Rain Focus"
                className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this playlist about?"
                className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublicCheck"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 rounded accent-primary cursor-pointer"
              />
              <label htmlFor="isPublicCheck" className="text-xs text-neutral-300 cursor-pointer">
                Make playlist public for all listeners
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-primary text-black font-bold text-xs rounded-lg hover:bg-primary-hover"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-neutral-500 text-sm">Loading playlists...</div>
      ) : playlists.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 text-sm">
          No playlists available yet. Be the first to create one!
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {playlists.map((pl) => (
            <PlaylistCard key={pl.id} playlist={pl} />
          ))}
        </div>
      )}
    </div>
  );
};
