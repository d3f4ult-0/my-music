import React, { useEffect, useState } from 'react';
import {
  Radio,
  Wifi,
  Copy,
  Check,
  Plus,
  Play,
  ListPlus,
  Trash2,
  HardDrive,
  RefreshCw,
  Share2,
  Music2,
  Disc,
  AlertCircle,
  ExternalLink,
  BookOpen,
  DownloadCloud,
  CheckCircle2,
  Smartphone,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { apiRequest, resolveAssetUrl } from '../api/client';
import { PeerNodeInfo, ConnectedPeer, Song } from '../types';
import { usePlayerStore } from '../stores/playerStore';
import { useOfflineManager } from '../hooks/useOfflineManager';
import { P2PUserManualModal } from '../components/p2p/P2PUserManualModal';

const SAVED_PEERS_STORAGE_KEY = 'mymusic_connected_peers';

function getSavedPeers(): ConnectedPeer[] {
  try {
    const raw = localStorage.getItem(SAVED_PEERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePeersToStorage(peers: ConnectedPeer[]) {
  try {
    localStorage.setItem(SAVED_PEERS_STORAGE_KEY, JSON.stringify(peers));
  } catch {}
}

export const PeersPage: React.FC = () => {
  const [localNode, setLocalNode] = useState<PeerNodeInfo | null>(null);
  const [peers, setPeers] = useState<ConnectedPeer[]>(getSavedPeers());
  const [isLoadingNode, setIsLoadingNode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Connect form state
  const [peerUrlInput, setPeerUrlInput] = useState('');
  const [peerNameInput, setPeerNameInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected remote peer catalog inspection
  const [selectedPeer, setSelectedPeer] = useState<ConnectedPeer | null>(null);
  const [peerTracks, setPeerTracks] = useState<Song[]>([]);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);

  const { playTrack, addToQueue } = usePlayerStore();
  const { offlineTracks, downloadPeerTrack, isDownloaded, isDownloading } = useOfflineManager();

  const loadLocalNodeAndPeers = async () => {
    setIsLoadingNode(true);
    try {
      // 1. Try to fetch from local server
      const nodeData = await apiRequest<PeerNodeInfo>('/p2p/peer');
      setLocalNode(nodeData);

      const peersData = await apiRequest<{ peers: ConnectedPeer[]; local_node: string }>('/p2p/peers');
      const backendPeers = peersData.peers || [];

      // Merge backend peers with localStorage peers
      const stored = getSavedPeers();
      const combined = [...backendPeers];
      stored.forEach((sp) => {
        if (!combined.some((bp) => bp.peer_url === sp.peer_url)) {
          combined.push(sp);
        }
      });

      setPeers(combined);
      savePeersToStorage(combined);
    } catch (err) {
      // Standalone Android APK / Client-only mode fallback
      const isAndroid = navigator.userAgent.includes('Android');
      setLocalNode({
        peer_id: 'client-node',
        device_name: isAndroid ? 'Android Mobile Device' : 'Local Audio Player',
        local_ip: 'Connected via Wi-Fi',
        port: 8000,
        track_count: offlineTracks.length,
        album_count: 1,
        artist_count: 1,
        version: '1.0.0',
      });
      setPeers(getSavedPeers());
    } finally {
      setIsLoadingNode(false);
    }
  };

  useEffect(() => {
    loadLocalNodeAndPeers();
  }, []);

  const handleCopyAddress = () => {
    if (!localNode) return;
    const addr = localNode.local_ip.startsWith('http')
      ? localNode.local_ip
      : `http://${localNode.local_ip}:${localNode.port}`;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectPeer = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = peerUrlInput.trim();
    if (!rawInput) return;

    setIsConnecting(true);
    setErrorMsg(null);

    let cleanUrl = rawInput.replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }

    try {
      let resolvedPeer: ConnectedPeer | null = null;

      // 1. Try backend connect proxy if server exists
      try {
        resolvedPeer = await apiRequest<ConnectedPeer>('/p2p/peers/connect', {
          method: 'POST',
          body: JSON.stringify({
            peer_url: cleanUrl,
            name: peerNameInput.trim() || undefined,
          }),
        });
      } catch (backendErr) {
        // 2. Direct client-side fetch (for Android APK or standalone web)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const probeResp = await fetch(`${cleanUrl}/api/v1/p2p/peer`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (probeResp.ok) {
            const probeData = await probeResp.json();
            resolvedPeer = {
              peer_url: cleanUrl,
              name: peerNameInput.trim() || probeData.device_name || cleanUrl,
              peer_id: probeData.peer_id || 'remote-peer',
              device_name: probeData.device_name || 'LAN Peer',
              track_count: probeData.track_count || 0,
              album_count: probeData.album_count || 0,
              status: 'online',
            };
          }
        } catch {
          // If probing failed, still allow saving so user can connect when peer is up
          resolvedPeer = {
            peer_url: cleanUrl,
            name: peerNameInput.trim() || cleanUrl,
            peer_id: 'remote-peer',
            device_name: 'LAN Peer',
            track_count: 0,
            status: 'unverified',
          };
        }
      }

      if (resolvedPeer) {
        const updated = [resolvedPeer, ...peers.filter((p) => p.peer_url !== resolvedPeer!.peer_url)];
        setPeers(updated);
        savePeersToStorage(updated);

        setPeerUrlInput('');
        setPeerNameInput('');

        // Auto browse newly added peer
        handleBrowsePeer(resolvedPeer);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to peer');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectPeer = async (peerUrl: string) => {
    try {
      await apiRequest('/p2p/peers/disconnect', {
        method: 'POST',
        body: JSON.stringify({ peer_url: peerUrl }),
      }).catch(() => {});
    } catch {}

    const updated = peers.filter((p) => p.peer_url !== peerUrl);
    setPeers(updated);
    savePeersToStorage(updated);

    if (selectedPeer?.peer_url === peerUrl) {
      setSelectedPeer(null);
      setPeerTracks([]);
    }
  };

  const handleBrowsePeer = async (peer: ConnectedPeer) => {
    setSelectedPeer(peer);
    setIsLoadingManifest(true);
    try {
      let rawTracks: Song[] = [];

      // 1. Try server backend proxy
      try {
        const res = await apiRequest<{ peer_url: string; tracks: Song[] }>(
          `/p2p/peers/manifest?peer_url=${encodeURIComponent(peer.peer_url)}`
        );
        rawTracks = res.tracks || [];
      } catch (backendErr) {
        // 2. Direct client fetch from peer URL
        const cleanPeerUrl = peer.peer_url.replace(/\/+$/, '');
        const res = await fetch(`${cleanPeerUrl}/api/v1/p2p/manifest`, {
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          rawTracks = await res.json();
        }
      }

      // Rewrite tracks to absolute URLs if relative
      const cleanPeer = peer.peer_url.replace(/\/+$/, '');
      const formatted: Song[] = (rawTracks || []).map((t) => {
        let stream = t.stream_url;
        if (!stream || stream.startsWith('/')) {
          stream = `${cleanPeer}${stream || `/api/v1/songs/${t.id}/stream`}`;
        }
        let cover = t.cover_url;
        if (cover && cover.startsWith('/')) {
          cover = `${cleanPeer}${cover}`;
        }
        return {
          ...t,
          stream_url: stream,
          cover_url: cover || '/icon-512.png',
          peer_origin: peer.name || peer.peer_url,
        };
      });

      setPeerTracks(formatted);
    } catch (err: any) {
      console.warn('Failed to load peer catalog:', err);
      setPeerTracks([]);
    } finally {
      setIsLoadingManifest(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <Radio size={16} /> Decentralized Local-First Audio
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            P2P & LAN Music Network
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            Stream, discover, and listen to songs directly between phones and PCs on your Wi-Fi or hotspot with zero accounts and zero data usage.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
          >
            <BookOpen size={15} />
            <span>P2P User Manual</span>
          </button>

          <button
            onClick={loadLocalNodeAndPeers}
            disabled={isLoadingNode}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-card hover:bg-surface-hover border border-border-subtle text-xs font-medium text-neutral-200 transition-colors"
          >
            <RefreshCw size={14} className={isLoadingNode ? 'animate-spin text-primary' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Setup Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-neutral-900 to-neutral-900 border border-primary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Sparkles size={16} /> How to connect to another person:
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed max-w-2xl">
            1. Connect both devices to the same Wi-Fi or turn on a phone's Mobile Hotspot. 
            2. Enter their LAN Address below.
            3. Tap <strong>Connect to Peer</strong> to stream or download their music catalog!
          </p>
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="px-4 py-2 bg-surface hover:bg-surface-hover text-white border border-border-subtle rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
        >
          <span>Read Full Step-by-Step Guide</span>
        </button>
      </div>

      {/* Grid: Local Node Identity & Connect Peer Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Local Node Card */}
        <div className="lg:col-span-1 bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/40 flex items-center justify-center">
                <Wifi size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Your Local Node</h3>
                <span className="text-[11px] text-primary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                  Ready on Local Network
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
              v{localNode?.version || '1.0'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs pt-2 border-t border-border-subtle/50">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Device:</span>
              <span className="text-neutral-200 font-medium">{localNode?.device_name || 'This Device'}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Local IP / Status:</span>
              <span className="font-mono text-neutral-200 font-semibold">{localNode?.local_ip || '127.0.0.1'}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Port:</span>
              <span className="font-mono text-neutral-200">{localNode?.port || 8000}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Local Offline Songs:</span>
              <span className="text-neutral-200 font-medium">
                {offlineTracks.length} tracks
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleCopyAddress}
              className="w-full py-2.5 px-3 bg-surface hover:bg-surface-hover border border-border-subtle rounded-xl text-xs font-semibold text-neutral-200 flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
              {copied ? 'LAN Address Copied!' : 'Copy LAN Node Address'}
            </button>
            <p className="text-[11px] text-neutral-400 text-center mt-2 leading-relaxed">
              Share your address with friends on your Wi-Fi or hotspot so they can connect to you.
            </p>
          </div>
        </div>

        {/* Connect to Peer Form */}
        <div className="lg:col-span-2 bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Connect to a Peer or Device</h3>
              <p className="text-xs text-neutral-400">
                Enter another phone or computer's address to stream their music collection in real time.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleConnectPeer} className="space-y-3 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Peer LAN Address *
                </label>
                <input
                  type="text"
                  placeholder="e.g. http://192.168.1.100:8000"
                  value={peerUrlInput}
                  onChange={(e) => setPeerUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-primary font-mono placeholder-neutral-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Nickname (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex's Phone, Living Room PC"
                  value={peerNameInput}
                  onChange={(e) => setPeerNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-primary placeholder-neutral-600"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-neutral-400">
                Works over Home Wi-Fi, Mobile Hotspot, or Ethernet LAN.
              </span>
              <button
                type="submit"
                disabled={isConnecting || !peerUrlInput.trim()}
                className="px-5 py-2.5 bg-primary text-black font-semibold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {isConnecting ? 'Verifying Peer...' : 'Connect to Peer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Discovered / Connected Peers List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <HardDrive size={18} className="text-primary" /> Connected Peers & Devices ({peers.length})
        </h2>

        {peers.length === 0 ? (
          <div className="py-12 border border-dashed border-border-subtle rounded-2xl text-center space-y-3 p-4">
            <Radio size={36} className="mx-auto text-neutral-600" />
            <div className="text-sm font-semibold text-neutral-300">No external peers connected yet</div>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              Add a peer address above to connect to another phone, laptop, or server on your Wi-Fi network. Need help? Open the{' '}
              <button
                onClick={() => setShowManualModal(true)}
                className="text-primary hover:underline font-semibold"
              >
                P2P User Manual
              </button>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {peers.map((peer) => {
              const isSelected = selectedPeer?.peer_url === peer.peer_url;
              return (
                <div
                  key={peer.peer_url}
                  className={`bg-surface-card border rounded-2xl p-4 transition-all ${
                    isSelected
                      ? 'border-primary ring-1 ring-primary/40 bg-surface-hover/80'
                      : 'border-border-subtle hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">
                        {peer.name || peer.device_name || 'Remote Peer'}
                      </h4>
                      <span className="text-[11px] font-mono text-neutral-400 block truncate">
                        {peer.peer_url}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                        peer.status === 'online'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {peer.status}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-400 mb-4 flex items-center justify-between">
                    <span>Shared Catalog:</span>
                    <span className="font-medium text-neutral-200">
                      {peer.track_count ? `${peer.track_count} tracks` : 'Available'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBrowsePeer(peer)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        isSelected
                          ? 'bg-primary text-black'
                          : 'bg-surface hover:bg-surface-hover text-white border border-border-subtle'
                      }`}
                    >
                      <Music2 size={13} />
                      {isSelected ? 'Browsing Catalog' : 'Browse Music'}
                    </button>

                    <button
                      onClick={() => handleDisconnectPeer(peer.peer_url)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-surface border border-border-subtle transition-colors"
                      title="Disconnect Peer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Peer's Music Catalog */}
      {selectedPeer && (
        <div className="space-y-4 pt-4 border-t border-border-subtle animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-card border border-border-subtle p-4 rounded-2xl">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">
                Streaming from Peer
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {selectedPeer.name || selectedPeer.peer_url}
              </h3>
              <p className="text-xs text-neutral-400">
                Playing lossless audio directly over your local network. You can also download tracks to keep them offline!
              </p>
            </div>

            {peerTracks.length > 0 && (
              <button
                onClick={() => playTrack(peerTracks[0], peerTracks, 0)}
                className="px-5 py-2.5 rounded-full bg-primary text-black font-bold text-xs flex items-center gap-2 hover:scale-105 active:scale-95 transition-all self-start sm:self-auto"
              >
                <Play size={15} className="fill-current" /> Play All {peerTracks.length} Tracks
              </button>
            )}
          </div>

          {isLoadingManifest ? (
            <div className="py-16 text-center text-neutral-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-primary" />
              Loading peer catalog...
            </div>
          ) : peerTracks.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-sm">
              No shared tracks found on this peer.
            </div>
          ) : (
            <div className="bg-surface-card/60 border border-border-subtle rounded-2xl overflow-hidden divide-y divide-border-subtle/40">
              {peerTracks.map((song, idx) => {
                const downloaded = isDownloaded(song.id);
                const downloading = isDownloading(song.id);

                return (
                  <div
                    key={song.id || idx}
                    className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-surface-hover/80 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        onClick={() => playTrack(song, peerTracks, idx)}
                        className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-neutral-300 group-hover:text-primary group-hover:bg-primary/10 transition-colors flex-shrink-0"
                      >
                        <Play size={16} className="fill-current" />
                      </button>

                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-neutral-100 truncate group-hover:text-primary transition-colors">
                          {song.title}
                        </div>
                        <div className="text-xs text-neutral-400 truncate flex items-center gap-2">
                          <span>{song.artist?.name || 'Peer Artist'}</span>
                          {song.album_title && <span>• {song.album_title}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                        {Math.floor(song.duration / 60)}:
                        {Math.floor(song.duration % 60)
                          .toString()
                          .padStart(2, '0')}
                      </span>

                      {/* Download to Offline Storage Button */}
                      <button
                        onClick={() => downloadPeerTrack(song, selectedPeer.peer_url)}
                        disabled={downloaded || downloading}
                        className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
                          downloaded
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
                            : downloading
                            ? 'text-primary border-primary/30 animate-pulse'
                            : 'text-neutral-400 hover:text-white hover:bg-surface border-border-subtle'
                        }`}
                        title={downloaded ? 'Saved to Offline Library' : 'Download to Offline Library'}
                      >
                        {downloaded ? (
                          <CheckCircle2 size={15} />
                        ) : downloading ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : (
                          <DownloadCloud size={15} />
                        )}
                        <span className="hidden md:inline text-[11px]">
                          {downloaded ? 'Saved' : downloading ? 'Saving...' : 'Save'}
                        </span>
                      </button>

                      <button
                        onClick={() => addToQueue(song)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-surface border border-border-subtle transition-colors"
                        title="Add to queue"
                      >
                        <ListPlus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* P2P User Manual Modal */}
      <P2PUserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        localAddress={localNode ? `http://${localNode.local_ip}:${localNode.port}` : undefined}
      />
    </div>
  );
};
