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
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { PeerNodeInfo, ConnectedPeer, Song } from '../types';
import { usePlayerStore } from '../stores/playerStore';

export const PeersPage: React.FC = () => {
  const [localNode, setLocalNode] = useState<PeerNodeInfo | null>(null);
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [isLoadingNode, setIsLoadingNode] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const loadLocalNodeAndPeers = async () => {
    setIsLoadingNode(true);
    try {
      const nodeData = await apiRequest<PeerNodeInfo>('/p2p/peer');
      setLocalNode(nodeData);

      const peersData = await apiRequest<{ peers: ConnectedPeer[]; local_node: string }>('/p2p/peers');
      setPeers(peersData.peers || []);
    } catch (err) {
      console.warn('Could not fetch P2P peer info:', err);
    } finally {
      setIsLoadingNode(false);
    }
  };

  useEffect(() => {
    loadLocalNodeAndPeers();
  }, []);

  const handleCopyAddress = () => {
    if (!localNode) return;
    const addr = `http://${localNode.local_ip}:${localNode.port}`;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectPeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerUrlInput.trim()) return;

    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<ConnectedPeer>('/p2p/peers/connect', {
        method: 'POST',
        body: JSON.stringify({
          peer_url: peerUrlInput.trim(),
          name: peerNameInput.trim() || undefined,
        }),
      });

      setPeers((prev) => {
        const filtered = prev.filter((p) => p.peer_url !== res.peer_url);
        return [res, ...filtered];
      });

      setPeerUrlInput('');
      setPeerNameInput('');

      // Auto-browse the newly connected peer
      handleBrowsePeer(res);
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
      });
      setPeers((prev) => prev.filter((p) => p.peer_url !== peerUrl));
      if (selectedPeer?.peer_url === peerUrl) {
        setSelectedPeer(null);
        setPeerTracks([]);
      }
    } catch (err: any) {
      alert(`Could not disconnect peer: ${err.message}`);
    }
  };

  const handleBrowsePeer = async (peer: ConnectedPeer) => {
    setSelectedPeer(peer);
    setIsLoadingManifest(true);
    try {
      const res = await apiRequest<{ peer_url: string; tracks: Song[] }>(
        `/p2p/peers/manifest?peer_url=${encodeURIComponent(peer.peer_url)}`
      );
      // Tag peer tracks with peer_origin for player indication
      const formatted = (res.tracks || []).map((t) => ({
        ...t,
        peer_origin: peer.name || peer.peer_url,
      }));
      setPeerTracks(formatted);
    } catch (err: any) {
      console.warn('Failed to load peer catalog:', err);
      setPeerTracks([]);
    } finally {
      setIsLoadingManifest(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
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
            Stream, discover, and listen to music directly between devices on your local network or P2P connections without accounts, clouds, or registration walls.
          </p>
        </div>

        <button
          onClick={loadLocalNodeAndPeers}
          disabled={isLoadingNode}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-subtle text-xs font-medium text-neutral-200 transition-colors"
        >
          <RefreshCw size={14} className={isLoadingNode ? 'animate-spin' : ''} />
          Refresh Nodes
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
                  Broadcasting on LAN
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
              v{localNode?.version || '1.0'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs pt-2 border-t border-border-subtle/50">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Node ID:</span>
              <span className="font-mono text-neutral-200 font-semibold">{localNode?.peer_id || 'local-node'}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Host Device:</span>
              <span className="text-neutral-200">{localNode?.device_name || 'localhost'}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Local IP:</span>
              <span className="font-mono text-neutral-200">{localNode?.local_ip || '127.0.0.1'}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Shared Catalog:</span>
              <span className="text-neutral-200 font-medium">
                {localNode?.track_count || 0} tracks ({localNode?.album_count || 0} albums)
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleCopyAddress}
              className="w-full py-2.5 px-3 bg-surface hover:bg-surface-hover border border-border-subtle rounded-xl text-xs font-medium text-neutral-200 flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
              {copied ? 'Network Address Copied!' : 'Copy LAN Node Address'}
            </button>
            <p className="text-[11px] text-neutral-400 text-center mt-2">
              Share this address with other devices on your WiFi to let them stream your music.
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
                Enter another device's MyMusic address to stream and browse their music collection.
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
                  className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-primary font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Device Nickname (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alice's MacBook, Living Room PC"
                  value={peerNameInput}
                  onChange={(e) => setPeerNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-neutral-400">
                Supports any standard HTTP or LAN node streaming endpoint.
              </span>
              <button
                type="submit"
                disabled={isConnecting || !peerUrlInput.trim()}
                className="px-5 py-2.5 bg-primary text-black font-semibold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
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
          <div className="py-12 border border-dashed border-border-subtle rounded-2xl text-center space-y-2">
            <Radio size={36} className="mx-auto text-neutral-600" />
            <div className="text-sm font-semibold text-neutral-300">No external peers connected yet</div>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Add a peer address above to connect to another computer, phone, or home server running MyMusic on your WiFi network.
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
                    <div>
                      <h4 className="font-bold text-white text-sm truncate max-w-[200px]">
                        {peer.name || peer.device_name || 'Remote Peer'}
                      </h4>
                      <span className="text-[11px] font-mono text-neutral-400 block truncate">
                        {peer.peer_url}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        peer.status === 'online'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {peer.status}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-400 mb-4 flex items-center justify-between">
                    <span>Library Catalog:</span>
                    <span className="font-medium text-neutral-200">
                      {peer.track_count ? `${peer.track_count} tracks` : 'Shared'}
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
                      {isSelected ? 'Browsing Library' : 'Browse Music'}
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
                Playing tracks directly through peer stream proxy with zero login requirements.
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
              {peerTracks.map((song, idx) => (
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

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                      {Math.floor(song.duration / 60)}:
                      {Math.floor(song.duration % 60)
                        .toString()
                        .padStart(2, '0')}
                    </span>

                    <button
                      onClick={() => addToQueue(song)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-surface transition-colors"
                      title="Add to queue"
                    >
                      <ListPlus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
