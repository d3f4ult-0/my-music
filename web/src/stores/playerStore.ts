import { create } from 'zustand';
import { Song } from '../types';
import { apiRequest } from '../api/client';
import { extractDominantColor } from '../utils/colorExtractor';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Song | null;
  queue: Song[];
  queueIndex: number;
  originalQueue: Song[]; // preserved for un-shuffling
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isQueueOpen: boolean;
  isLyricsOpen: boolean;
  isFullscreenLyrics: boolean;
  dominantColor: string;

  // Actions
  playTrack: (track: Song, newQueue?: Song[], index?: number) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Song) => void;
  playNext: (track: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleQueue: () => void;
  toggleLyrics: () => void;
  setLyricsOpen: (open: boolean) => void;
  toggleFullscreenLyrics: () => void;
  setDominantColor: (color: string) => void;
  updatePlaybackTime: (currentTime: number, duration: number) => void;
  setLoading: (loading: boolean) => void;
  toggleTrackFavorite: (trackId: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  originalQueue: [],
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  volume: parseFloat(localStorage.getItem('mymusic_volume') || '0.8'),
  isMuted: false,
  shuffle: false,
  repeatMode: 'off',
  isQueueOpen: false,
  isLyricsOpen: true, // open by default like Spotify desktop
  isFullscreenLyrics: false,
  dominantColor: '#1e3a5f',

  playTrack: (track, newQueue, index) => {
    let queue = newQueue || get().queue;
    let qIndex = index !== undefined ? index : queue.findIndex((t) => t.id === track.id);

    if (qIndex === -1) {
      queue = [track, ...queue];
      qIndex = 0;
    }

    // Extract ambient cover art color
    extractDominantColor(track.cover_url).then((color) => {
      set({ dominantColor: color });
    });

    set({
      currentTrack: track,
      queue,
      originalQueue: newQueue ? [...newQueue] : get().originalQueue,
      queueIndex: qIndex,
      isPlaying: true,
      isLoading: true,
      currentTime: 0,
      duration: track.duration || 0,
    });
  },

  toggleLyrics: () => set((state) => ({ isLyricsOpen: !state.isLyricsOpen })),
  setLyricsOpen: (open) => set({ isLyricsOpen: open }),
  toggleFullscreenLyrics: () => set((state) => ({ isFullscreenLyrics: !state.isFullscreenLyrics })),
  setDominantColor: (color) => set({ dominantColor: color }),

  togglePlay: () => {
    const { isPlaying, currentTrack, queue } = get();
    if (!currentTrack && queue.length > 0) {
      get().playTrack(queue[0], queue, 0);
      return;
    }
    set({ isPlaying: !isPlaying });
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  next: () => {
    const { queue, queueIndex, repeatMode, shuffle } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    set({
      currentTrack: nextTrack,
      queueIndex: nextIndex,
      currentTime: 0,
      duration: nextTrack.duration || 0,
      isPlaying: true,
    });
  },

  previous: () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 3) {
      // Seek back to beginning if more than 3 seconds in
      set({ currentTime: 0 });
      return;
    }

    if (queue.length === 0) return;
    const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    const prevTrack = queue[prevIndex];

    set({
      currentTrack: prevTrack,
      queueIndex: prevIndex,
      currentTime: 0,
      duration: prevTrack.duration || 0,
      isPlaying: true,
    });
  },

  seek: (seconds) => {
    set({ currentTime: seconds });
  },

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    localStorage.setItem('mymusic_volume', clamped.toString());
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  toggleShuffle: () => {
    const { shuffle, queue, currentTrack, originalQueue } = get();
    if (!shuffle) {
      // Turn shuffle ON
      const otherTracks = queue.filter((t) => t.id !== currentTrack?.id);
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
      }
      const newQueue = currentTrack ? [currentTrack, ...otherTracks] : otherTracks;
      set({ shuffle: true, queue: newQueue, queueIndex: 0 });
    } else {
      // Turn shuffle OFF: restore original queue order
      const newIndex = originalQueue.findIndex((t) => t.id === currentTrack?.id);
      set({
        shuffle: false,
        queue: [...originalQueue],
        queueIndex: newIndex !== -1 ? newIndex : 0,
      });
    }
  },

  cycleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const current = get().repeatMode;
    const nextMode = modes[(modes.indexOf(current) + 1) % modes.length];
    set({ repeatMode: nextMode });
  },

  addToQueue: (track) => {
    const { queue } = get();
    set({
      queue: [...queue, track],
      originalQueue: [...get().originalQueue, track],
    });
  },

  playNext: (track) => {
    const { queue, queueIndex } = get();
    const newQueue = [...queue];
    newQueue.splice(queueIndex + 1, 0, track);
    set({ queue: newQueue });
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    let newIndex = queueIndex;
    if (index < queueIndex) {
      newIndex--;
    }
    set({ queue: newQueue, queueIndex: newIndex });
  },

  clearQueue: () => {
    const { currentTrack } = get();
    set({
      queue: currentTrack ? [currentTrack] : [],
      originalQueue: currentTrack ? [currentTrack] : [],
      queueIndex: currentTrack ? 0 : -1,
    });
  },

  toggleQueue: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),

  updatePlaybackTime: (currentTime, duration) => {
    set({ currentTime, duration: duration || get().duration });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  toggleTrackFavorite: (trackId) => {
    const updateSongFav = (s: Song) => (s.id === trackId ? { ...s, is_favorite: !s.is_favorite } : s);
    set((state) => ({
      currentTrack: state.currentTrack?.id === trackId
        ? { ...state.currentTrack, is_favorite: !state.currentTrack.is_favorite }
        : state.currentTrack,
      queue: state.queue.map(updateSongFav),
      originalQueue: state.originalQueue.map(updateSongFav),
    }));

    // Trigger API in background
    apiRequest(`/favorites/${trackId}/check`)
      .then((res) => {
        if (res.is_favorite) {
          return apiRequest(`/favorites/${trackId}`, { method: 'DELETE' });
        } else {
          return apiRequest(`/favorites/${trackId}`, { method: 'POST' });
        }
      })
      .catch(() => {});
  },
}));
