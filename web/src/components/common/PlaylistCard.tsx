import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, Play } from 'lucide-react';
import { PlaylistBasic } from '../../types';
import { resolveAssetUrl } from '../../api/client';

interface PlaylistCardProps {
  playlist: PlaylistBasic;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({ playlist }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/playlists/${playlist.id}`)}
      className="group p-3 rounded-xl bg-surface-card hover:bg-surface-hover transition-all duration-200 cursor-pointer flex flex-col border border-border-subtle hover:border-border-muted"
    >
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-neutral-900 flex items-center justify-center">
        {playlist.cover_url ? (
          <img
            src={resolveAssetUrl(playlist.cover_url)}
            alt={playlist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <ListMusic size={40} className="text-neutral-600" />
        )}

        <div className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all duration-200 shadow-xl">
          <Play size={18} className="fill-current ml-0.5" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="font-semibold text-sm text-neutral-100 truncate group-hover:text-primary transition-colors">
          {playlist.name}
        </div>
        <div className="text-xs text-neutral-400 truncate mt-0.5">
          {playlist.owner_name ? `By ${playlist.owner_name} • ` : ''}
          {playlist.track_count} {playlist.track_count === 1 ? 'song' : 'songs'}
        </div>
      </div>
    </div>
  );
};
