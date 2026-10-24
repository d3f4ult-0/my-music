import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User;
  isLoading: boolean;
  peerId: string;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: 1,
    username: 'local_peer',
    email: 'local@device',
    display_name: 'Local Library',
    avatar_url: null,
    role: 'ADMIN',
    is_active: true,
    created_at: new Date().toISOString(),
    artist_id: null,
    artist_name: null,
  },
  isLoading: false,
  peerId: 'local-node',

  updateUser: (data) => {
    set((state) => ({
      user: { ...state.user, ...data },
    }));
  },
}));
