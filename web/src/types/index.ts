export type UserRole = 'USER' | 'ARTIST' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  artist_id?: number | null;
  artist_name?: string | null;
}

export interface ArtistBasic {
  id: number;
  name: string;
  image_url?: string | null;
}

export interface Song {
  id: number;
  title: string;
  description?: string | null;
  duration: number;
  track_number?: number | null;
  disc_number?: number | null;
  audio_key: string;
  cover_url?: string | null;
  genre?: string | null;
  release_date?: string | null;
  download_allowed: boolean;
  stream_url?: string | null;
  peer_origin?: string | null;
  artist?: ArtistBasic | null;
  album_id?: number | null;
  album_title?: string | null;
  is_favorite: boolean;
  codec?: string | null;
  bitrate?: number | null;
}

export interface AlbumBasic {
  id: number;
  title: string;
  cover_url?: string | null;
  release_date?: string | null;
  year?: number | null;
  artist_id: number;
  artist_name?: string | null;
  track_count?: number | null;
}

export interface AlbumDetail extends AlbumBasic {
  description?: string | null;
  artist: ArtistBasic;
  tracks: Song[];
}

export interface ArtistDetail extends ArtistBasic {
  bio?: string | null;
  follower_count: number;
  is_following: boolean;
  albums: AlbumBasic[];
  popular_songs: Song[];
}

export interface PlaylistBasic {
  id: number;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  is_public: boolean;
  user_id: number;
  owner_name?: string | null;
  track_count: number;
  created_at: string;
}

export interface PlaylistDetail extends PlaylistBasic {
  songs: Song[];
}

export interface ListeningHistoryItem {
  id: number;
  song: Song;
  played_at: string;
  progress_seconds: number;
  completed: boolean;
}

export interface SearchResult {
  songs: Song[];
  albums: AlbumBasic[];
  artists: ArtistBasic[];
  playlists: PlaylistBasic[];
}

export interface HomeFeed {
  greeting: string;
  recently_played: Song[];
  favorites: Song[];
  new_releases: AlbumBasic[];
  popular_songs: Song[];
  featured_artists: ArtistBasic[];
}

export interface OfflineTrack {
  id: number;
  song: Song;
  downloaded_at: string;
  blob_url?: string;
  size_bytes: number;
}

export interface PeerNodeInfo {
  peer_id: string;
  device_name: string;
  local_ip: string;
  port: number;
  track_count: number;
  album_count: number;
  artist_count: number;
  version: string;
}

export interface ConnectedPeer {
  peer_url: string;
  name: string;
  peer_id: string;
  device_name: string;
  track_count: number;
  album_count?: number;
  status: 'online' | 'connected' | 'unverified' | 'offline';
}
