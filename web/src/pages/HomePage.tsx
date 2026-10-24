import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Sparkles, Disc, Flame, Radio } from 'lucide-react';
import { HomeFeed, Song } from '../types';
import { apiRequest, resolveAssetUrl } from '../api/client';
import { SongRow } from '../components/common/SongRow';
import { AlbumCard } from '../components/common/AlbumCard';
import { ArtistCard } from '../components/common/ArtistCard';
import { usePlayerStore } from '../stores/playerStore';

const DEMO_FEED: HomeFeed = {
  greeting: 'Welcome to MyMusic',
  recently_played: [
    {
      id: 991,
      title: 'Neon Odyssey',
      artist: { id: 991, name: 'Synthetica', image_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80' },
      album_title: 'Future Nights',
      duration: 184,
      audio_key: 'demo-1',
      stream_url: 'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
      cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
      is_favorite: true,
      download_allowed: true,
    },
    {
      id: 992,
      title: 'Midnight Echoes',
      artist: { id: 992, name: 'Solar Drift', image_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80' },
      album_title: 'Celestial Dream',
      duration: 215,
      audio_key: 'demo-2',
      stream_url: 'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Sevish_-__nbsp_.mp3',
      cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
      is_favorite: false,
      download_allowed: true,
    },
    {
      id: 993,
      title: 'Lepidoptera Wings',
      artist: { id: 993, name: 'Cosmic Beats', image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80' },
      album_title: 'Deep Horizon',
      duration: 168,
      audio_key: 'demo-3',
      stream_url: 'https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg',
      cover_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=80',
      is_favorite: true,
      download_allowed: true,
    },
  ],
  favorites: [],
  new_releases: [
    {
      id: 991,
      title: 'Future Nights',
      artist_id: 991,
      artist_name: 'Synthetica',
      cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
      track_count: 8,
      year: 2026,
    },
    {
      id: 992,
      title: 'Celestial Dream',
      artist_id: 992,
      artist_name: 'Solar Drift',
      cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
      track_count: 6,
      year: 2026,
    },
  ],
  popular_songs: [],
  featured_artists: [
    {
      id: 991,
      name: 'Synthetica',
      image_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 992,
      name: 'Solar Drift',
      image_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    },
  ],
};

export const HomePage: React.FC = () => {
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayerStore();
  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  useEffect(() => {
    apiRequest<HomeFeed>('/home')
      .then((data) => {
        setFeed(data);
        setIsDemoMode(false);
      })
      .catch((err) => {
        console.warn('Could not load remote home feed, activating live demo:', err);
        setFeed(DEMO_FEED);
        setIsDemoMode(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Curating your home feed...</span>
        </div>
      </div>
    );
  }

  const currentFeed = feed || DEMO_FEED;

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Demo / Web Mode Notice */}
      {isDemoMode && (
        <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-primary/10 via-neutral-900 to-neutral-900 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-neutral-200">
            <Radio size={16} className="text-primary flex-shrink-0 animate-pulse" />
            <span>
              <strong>GitHub Pages Live Preview:</strong> Playing sample tracks. Connect to your private server or LAN peer to stream your own library.
            </span>
          </div>
          <span className="text-[11px] text-primary font-mono bg-primary/10 px-2 py-1 rounded border border-primary/20">
            Live Preview Mode
          </span>
        </div>
      )}

      {/* Dynamic Greeting Banner */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
          {currentFeed.greeting}
        </h1>
        <p className="text-xs md:text-sm text-neutral-400">
          Discover certified independent music and authorized master recordings.
        </p>
      </div>

      {/* Recently Played (if available) */}
      {currentFeed.recently_played.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              Recently Played
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {currentFeed.recently_played.slice(0, 6).map((song, idx) => (
              <div
                key={song.id}
                onClick={() => playTrack(song, currentFeed.recently_played, idx)}
                className="flex items-center gap-3 p-2 rounded-lg bg-surface-card hover:bg-surface-hover transition-colors cursor-pointer border border-border-subtle group"
              >
                <img
                  src={resolveAssetUrl(song.cover_url) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'}
                  alt=""
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-200 truncate group-hover:text-primary transition-colors">
                    {song.title}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">
                    {song.artist?.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New Releases (Albums) */}
      {currentFeed.new_releases.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Sparkles size={20} className="text-primary" /> New Releases
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {currentFeed.new_releases.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Tracks */}
      {currentFeed.popular_songs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Flame size={20} className="text-amber-400" /> Popular Tracks
            </h2>
          </div>
          <div className="bg-surface-card/60 border border-border-subtle rounded-xl p-2 md:p-3 divide-y divide-border-subtle/50">
            {currentFeed.popular_songs.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                playlistContext={currentFeed.popular_songs}
                onAddToPlaylist={onAddToPlaylist}
                onReport={onReport}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured Artists */}
      {currentFeed.featured_artists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Disc size={20} className="text-primary" /> Featured Artists
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {currentFeed.featured_artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
