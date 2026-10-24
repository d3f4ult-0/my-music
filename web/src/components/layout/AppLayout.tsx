import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { GlobalAudioPlayer } from '../player/GlobalAudioPlayer';
import { QueueDrawer } from '../player/QueueDrawer';
import { SpicyLyricsPanel } from '../lyrics/SpicyLyricsPanel';
import { SpicyLyricsFullscreen } from '../lyrics/SpicyLyricsFullscreen';
import { AddToPlaylistModal } from '../common/AddToPlaylistModal';
import { ReportModal } from '../common/ReportModal';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePlayerStore } from '../../stores/playerStore';
import { Song } from '../../types';

export const AppLayout: React.FC = () => {
  // Activate global keyboard shortcuts (Space, Arrow keys, N, P, M)
  useKeyboardShortcuts();

  const { dominantColor } = usePlayerStore();
  const [playlistTargetSong, setPlaylistTargetSong] = useState<Song | null>(null);
  const [reportTargetSong, setReportTargetSong] = useState<Song | null>(null);

  return (
    <div className="flex h-screen bg-[#121212] text-neutral-200 overflow-hidden font-sans">
      {/* Desktop Left Sidebar: "Your Library" (Exact Spotify Desktop Layout) */}
      <Sidebar />

      {/* Main Center Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Topbar />

        {/* Viewport with Center Content & Right Spicy Lyrics Panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Scrollable Viewport with Dynamic Cover-blended Ambient Glow */}
          <main
            className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-28 md:pb-32 relative transition-all duration-700 scrollbar-thin"
            style={{
              backgroundImage: `radial-gradient(circle at 45% -15%, ${dominantColor}50 0%, rgba(18, 18, 18, 0.96) 50%, #121212 100%)`,
            }}
          >
            <Outlet
              context={{
                onAddToPlaylist: (song: Song) => setPlaylistTargetSong(song),
                onReport: (song: Song) => setReportTargetSong(song),
              }}
            />
          </main>

          {/* Right Sidebar: Now Playing View + Rotating Artwork + Spicy Lyrics (From Screenshot) */}
          <SpicyLyricsPanel />
        </div>

        {/* Global Persistent Bottom Audio Player & Queue Drawer */}
        <GlobalAudioPlayer />
        <QueueDrawer />

        {/* Mobile Navigation */}
        <BottomNav />
      </div>

      {/* Fullscreen Spicy Lyrics View (Apple Music / Spotify Karaoke experience) */}
      <SpicyLyricsFullscreen />

      {/* Modals */}
      {playlistTargetSong && (
        <AddToPlaylistModal
          song={playlistTargetSong}
          onClose={() => setPlaylistTargetSong(null)}
        />
      )}
      {reportTargetSong && (
        <ReportModal
          song={reportTargetSong}
          onClose={() => setReportTargetSong(null)}
        />
      )}
    </div>
  );
};
