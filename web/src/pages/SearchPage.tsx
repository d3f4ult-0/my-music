import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { SearchResult, Song } from '../types';
import { apiRequest } from '../api/client';
import { SongRow } from '../components/common/SongRow';
import { AlbumCard } from '../components/common/AlbumCard';
import { ArtistCard } from '../components/common/ArtistCard';
import { PlaylistCard } from '../components/common/PlaylistCard';

type FilterType = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const { onAddToPlaylist, onReport } = useOutletContext<{
    onAddToPlaylist: (song: Song) => void;
    onReport: (song: Song) => void;
  }>();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      apiRequest<SearchResult>(`/search?q=${encodeURIComponent(trimmed)}&limit=20`)
        .then((data) => setResults(data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const hasAnyResults =
    results &&
    (results.songs.length > 0 ||
      results.albums.length > 0 ||
      results.artists.length > 0 ||
      results.playlists.length > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Search Input Bar */}
      <div className="relative max-w-xl">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
          <Search size={19} />
        </div>
        <input
          type="text"
          placeholder="Search songs, artists, albums, or playlists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-11 pr-10 py-3 bg-surface-card border border-border-subtle rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-primary text-sm shadow-inner transition-colors"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      {results && (
        <div className="flex gap-2 pb-2 overflow-x-auto select-none">
          {(['all', 'songs', 'albums', 'artists', 'playlists'] as FilterType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                activeFilter === tab
                  ? 'bg-white text-black'
                  : 'bg-surface-card hover:bg-surface-hover text-neutral-300 border border-border-subtle'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-neutral-500 text-sm">Searching catalog...</div>
      )}

      {/* Empty State */}
      {!loading && query && !hasAnyResults && (
        <div className="py-16 text-center text-neutral-500 text-sm">
          No matches found for "{query}". Try checking the spelling or searching another artist.
        </div>
      )}

      {/* Default Prompt */}
      {!query && (
        <div className="py-20 text-center text-neutral-500 text-sm">
          Type an artist, song title, or genre to explore the platform.
        </div>
      )}

      {/* Search Results */}
      {!loading && results && hasAnyResults && (
        <div className="space-y-8">
          {/* Songs */}
          {(activeFilter === 'all' || activeFilter === 'songs') && results.songs.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white mb-3">Songs</h2>
              <div className="bg-surface-card/60 border border-border-subtle rounded-xl p-2 divide-y divide-border-subtle/50">
                {results.songs.map((song, idx) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={idx}
                    playlistContext={results.songs}
                    onAddToPlaylist={onAddToPlaylist}
                    onReport={onReport}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {(activeFilter === 'all' || activeFilter === 'albums') && results.albums.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white mb-3">Albums</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.albums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </section>
          )}

          {/* Artists */}
          {(activeFilter === 'all' || activeFilter === 'artists') && results.artists.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white mb-3">Artists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.artists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            </section>
          )}

          {/* Playlists */}
          {(activeFilter === 'all' || activeFilter === 'playlists') && results.playlists.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white mb-3">Playlists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.playlists.map((pl) => (
                  <PlaylistCard key={pl.id} playlist={pl} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
