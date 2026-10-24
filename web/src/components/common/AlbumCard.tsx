import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { AlbumBasic } from '../../types';
import { resolveAssetUrl } from '../../api/client';

interface AlbumCardProps {
  album: AlbumBasic;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/albums/${album.id}`)}
      className="group p-3 rounded-xl bg-surface-card hover:bg-surface-hover transition-all duration-200 cursor-pointer flex flex-col border border-border-subtle hover:border-border-muted"
    >
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-neutral-900">
        <img
          src={resolveAssetUrl(album.cover_url) || 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&auto=format&fit=crop&q=80'}
          alt={album.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Play button overlay */}
        <div className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all duration-200 shadow-xl">
          <Play size={18} className="fill-current ml-0.5" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="font-semibold text-sm text-neutral-100 truncate group-hover:text-primary transition-colors">
          {album.title}
        </div>
        <div className="text-xs text-neutral-400 truncate mt-0.5">
          {album.artist_name || 'Artist'} {album.year ? `• ${album.year}` : ''}
        </div>
      </div>
    </div>
  );
};
