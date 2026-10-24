import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { AlbumPage } from './pages/AlbumPage';
import { ArtistPage } from './pages/ArtistPage';
import { PlaylistsOverviewPage } from './pages/PlaylistsOverviewPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HistoryPage } from './pages/HistoryPage';
import { OfflinePage } from './pages/OfflinePage';
import { StudioPage } from './pages/StudioPage';
import { AdminPage } from './pages/AdminPage';
import { PeersPage } from './pages/PeersPage';

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="albums/:id" element={<AlbumPage />} />
          <Route path="artists/:id" element={<ArtistPage />} />
          <Route path="playlists" element={<PlaylistsOverviewPage />} />
          <Route path="playlists/:id" element={<PlaylistPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="offline" element={<OfflinePage />} />
          <Route path="peers" element={<PeersPage />} />
          <Route path="studio" element={<StudioPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
