import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtistBasic } from '../../types';

interface ArtistCardProps {
  artist: ArtistBasic;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/artists/${artist.id}`)}
      className="group p-3 rounded-xl bg-surface-card hover:bg-surface-hover transition-all duration-200 cursor-pointer flex flex-col items-center text-center border border-border-subtle hover:border-border-muted"
    >
      <div className="aspect-square w-full max-w-[140px] rounded-full overflow-hidden mb-3 bg-neutral-800 shadow-md">
        <img
          src={artist.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'}
          alt={artist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="font-semibold text-sm text-neutral-100 truncate w-full group-hover:text-primary transition-colors">
        {artist.name}
      </div>
      <div className="text-xs text-neutral-400 mt-0.5">Artist</div>
    </div>
  );
};
