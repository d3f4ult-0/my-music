import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Search,
  Heart,
  Plus,
  Radio,
  UploadCloud,
  Disc3,
  Search as SearchIcon,
  ListFilter,
  Music,
  Users,
  Disc,
} from 'lucide-react';
import { apiRequest, resolveAssetUrl } from '../../api/client';
import { PlaylistBasic, ArtistBasic, AlbumBasic } from '../../types';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'all' | 'playlists' | 'albums' | 'artists'>('all');
  const [playlists, setPlaylists] = useState<PlaylistBasic[]>([]);
  const [artists, setArtists] = useState<ArtistBasic[]>([]);
  const [albums, setAlbums] = useState<AlbumBasic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    // Load library items
    apiRequest<PlaylistBasic[]>('/playlists')
      .then((d) => setPlaylists(d || []))
      .catch(() => {});

    apiRequest<ArtistBasic[]>('/artists')
      .then((d) => setArtists(d || []))
      .catch(() => {});

    apiRequest<AlbumBasic[]>('/albums')
      .then((d) => setAlbums(d || []))
      .catch(() => {});
  }, []);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
      isActive
        ? 'bg-surface-active text-white'
        : 'text-neutral-400 hover:text-neutral-100 hover:bg-surface-hover'
    }`;

  // Filtered items
  const showPlaylists = filterType === 'all' || filterType === 'playlists';
  const showAlbums = filterType === 'all' || filterType === 'albums';
  const showArtists = filterType === 'all' || filterType === 'artists';

  return (
    <aside className="hidden md:flex flex-col w-72 lg:w-80 bg-[#121212] border-r border-border-subtle p-2 select-none flex-shrink-0 gap-2">
      {/* Top Navigation Box */}
      <div className="bg-surface-card/60 border border-border-subtle/40 rounded-xl p-3 space-y-1">
        <NavLink to="/" end className={navClass}>
          <Home size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/search" className={navClass}>
          <Search size={20} />
          <span>Search</span>
        </NavLink>
        <NavLink to="/peers" className={navClass}>
          <Radio size={20} className="text-primary" />
          <span>P2P & LAN Sharing</span>
        </NavLink>
        <NavLink to="/studio" className={navClass}>
          <UploadCloud size={20} />
          <span>Import Music</span>
        </NavLink>
      </div>

      {/* "Your Library" Box (Exact Spotify Desktop Layout from screenshot) */}
      <div className="flex-1 bg-surface-card/60 border border-border-subtle/40 rounded-xl p-3 flex flex-col min-h-0 overflow-hidden">
        {/* Library Header */}
        <div className="flex items-center justify-between px-2 py-1 mb-2">
          <button
            onClick={() => navigate('/playlists')}
            className="flex items-center gap-2 text-neutral-300 hover:text-white font-bold text-sm transition-colors"
          >
            <Disc3 size={20} className="text-neutral-400" />
            <span>Your Library</span>
          </button>

          <button
            onClick={() => navigate('/studio')}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-surface hover:bg-surface-hover text-neutral-200 border border-border-subtle hover:text-white transition-colors"
            title="Create / Import"
          >
            <Plus size={14} />
            <span>Create</span>
          </button>
        </div>

        {/* Filter Pills (Playlists, Albums, Artists) */}
        <div className="flex items-center gap-1.5 px-2 py-1 mb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterType(filterType === 'playlists' ? 'all' : 'playlists')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterType === 'playlists'
                ? 'bg-white text-black'
                : 'bg-surface hover:bg-surface-hover text-neutral-300'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setFilterType(filterType === 'albums' ? 'all' : 'albums')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterType === 'albums'
                ? 'bg-white text-black'
                : 'bg-surface hover:bg-surface-hover text-neutral-300'
            }`}
          >
            Albums
          </button>
          <button
            onClick={() => setFilterType(filterType === 'artists' ? 'all' : 'artists')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterType === 'artists'
                ? 'bg-white text-black'
                : 'bg-surface hover:bg-surface-hover text-neutral-300'
            }`}
          >
            Artists
          </button>
        </div>

        {/* Sub-bar: Search in library & Recents */}
        <div className="flex items-center justify-between px-2 py-1 text-xs text-neutral-400">
          <div className="flex items-center gap-1 flex-1">
            <button
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className="p-1 hover:text-white rounded-full hover:bg-surface transition-colors"
            >
              <SearchIcon size={14} />
            </button>
            {isSearchVisible && (
              <input
                type="text"
                autoFocus
                placeholder="Search in Library"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded-md px-2 py-0.5 text-xs text-white focus:outline-none focus:border-primary"
              />
            )}
          </div>
          <span className="text-[11px] text-neutral-400 hover:text-white cursor-pointer">
            Recents
          </span>
        </div>

        {/* Scrollable Library List */}
        <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1 scrollbar-thin">
          {/* Liked Songs Special Item */}
          {showPlaylists && (
            <div
              onClick={() => navigate('/favorites')}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover/70 cursor-pointer transition-colors group"
            >
              <div className="w-11 h-11 rounded-md bg-gradient-to-br from-indigo-600 via-purple-700 to-emerald-800 flex items-center justify-center text-white flex-shrink-0 shadow">
                <Heart size={20} className="fill-white" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs sm:text-sm text-neutral-100 group-hover:text-primary transition-colors truncate">
                  Liked Songs
                </div>
                <div className="text-[11px] text-neutral-400 truncate">
                  Playlist • Local Library
                </div>
              </div>
            </div>
          )}

          {/* User Playlists */}
          {showPlaylists &&
            playlists
              .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((p) => (
                <div
                  key={`pl-${p.id}`}
                  onClick={() => navigate(`/playlists/${p.id}`)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover/70 cursor-pointer transition-colors group"
                >
                  <div className="w-11 h-11 rounded-md bg-neutral-800 flex items-center justify-center text-neutral-400 flex-shrink-0 overflow-hidden">
                    {p.cover_url ? (
                      <img src={resolveAssetUrl(p.cover_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={18} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-neutral-100 group-hover:text-primary transition-colors truncate">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">
                      Playlist • {p.track_count || 0} songs
                    </div>
                  </div>
                </div>
              ))}

          {/* Albums */}
          {showAlbums &&
            albums
              .filter((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((a) => (
                <div
                  key={`alb-${a.id}`}
                  onClick={() => navigate(`/albums/${a.id}`)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover/70 cursor-pointer transition-colors group"
                >
                  <img
                    src={
                      resolveAssetUrl(a.cover_url) ||
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'
                    }
                    alt=""
                    className="w-11 h-11 rounded-md object-cover flex-shrink-0 bg-neutral-800"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-neutral-100 group-hover:text-primary transition-colors truncate">
                      {a.title}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">
                      Album • {a.artist_name || 'Artist'}
                    </div>
                  </div>
                </div>
              ))}

          {/* Artists (Round Avatars) */}
          {showArtists &&
            artists
              .filter((art) => art.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((art) => (
                <div
                  key={`art-${art.id}`}
                  onClick={() => navigate(`/artists/${art.id}`)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover/70 cursor-pointer transition-colors group"
                >
                  <div className="w-11 h-11 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 flex-shrink-0 overflow-hidden">
                    {art.image_url ? (
                      <img src={resolveAssetUrl(art.image_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={18} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-neutral-100 group-hover:text-primary transition-colors truncate">
                      {art.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">Artist</div>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </aside>
  );
};
