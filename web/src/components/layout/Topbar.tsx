import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Radio,
  Search,
  Home,
  Settings,
  Wifi,
  WifiOff,
  Check,
  X,
  Server,
  User as UserIcon,
} from 'lucide-react';
import { apiRequest, getServerUrl, setServerUrl, isCapacitorApp } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [peerInfo, setPeerInfo] = useState<{ peer_id: string; local_ip: string; device_name: string } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [topSearch, setTopSearch] = useState('');
  
  // Server Host Modal state (especially useful for Android app)
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getServerUrl());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'testing' | 'saved' | 'error'>('idle');

  const checkConnection = () => {
    apiRequest('/p2p/peer')
      .then((data) => {
        setPeerInfo(data);
        setIsOnline(true);
      })
      .catch(() => {
        setIsOnline(false);
        if (isCapacitorApp() && !getServerUrl()) {
          setShowServerModal(true);
        }
      });
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(topSearch.trim())}`);
    }
  };

  const handleSaveServerUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('testing');
    try {
      setServerUrl(serverUrlInput);
      const data = await apiRequest('/p2p/peer');
      setPeerInfo(data);
      setIsOnline(true);
      setSaveStatus('saved');
      setTimeout(() => {
        setShowServerModal(false);
        setSaveStatus('idle');
        window.location.reload();
      }, 700);
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleResetServerUrl = () => {
    setServerUrl('');
    setServerUrlInput('');
    window.location.reload();
  };

  return (
    <>
      <header className="h-16 px-3 sm:px-4 md:px-6 bg-[#121212]/80 backdrop-blur-md border-b border-border-subtle/50 flex items-center justify-between sticky top-0 z-30 select-none">
        {/* Left: Navigation history controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
            title="Go Back"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
            title="Go Forward"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Center: Spotify-style Home & Pill Search Bar */}
        <div className="flex items-center gap-2 max-w-md w-full mx-2 sm:mx-4">
          <button
            onClick={() => navigate('/')}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              location.pathname === '/'
                ? 'bg-neutral-800 text-white'
                : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Home"
          >
            <Home size={19} />
          </button>

          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <div className="relative flex items-center">
              <Search
                size={17}
                className="absolute left-3.5 text-neutral-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="What do you want to play?"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                className="w-full h-10 sm:h-11 pl-10 pr-4 bg-neutral-900/90 hover:bg-neutral-800/90 focus:bg-neutral-800 text-xs sm:text-sm text-white placeholder-neutral-400 rounded-full border border-transparent focus:border-white/20 transition-all outline-none"
              />
            </div>
          </form>
        </div>

        {/* Right: Server connection & Peer status */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowServerModal(true)}
            className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            title="Server Connection Settings"
          >
            <Settings size={18} />
          </button>

          <button
            onClick={() => navigate('/peers')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border transition-all group ${
              isOnline
                ? 'bg-neutral-900/80 hover:bg-neutral-800 border-border-subtle'
                : 'bg-red-950/40 hover:bg-red-950/60 border-red-500/30'
            }`}
            title="P2P & LAN Music Network"
          >
            <span className="relative flex h-2 w-2">
              {isOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              )}
            </span>
            <div className="text-xs text-left hidden sm:block">
              <span className="font-semibold text-neutral-200 group-hover:text-primary transition-colors flex items-center gap-1">
                <Radio size={13} className={isOnline ? 'text-primary' : 'text-red-400'} />
                {peerInfo ? `Node: ${peerInfo.peer_id}` : (isOnline ? 'Local Peer' : 'Offline')}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400 bg-neutral-800/80 px-1.5 py-0.5 rounded font-mono hidden md:inline">
              {peerInfo?.local_ip || (isOnline ? 'LAN' : 'Disconnected')}
            </span>
          </button>

          {/* User / Node Avatar */}
          <div
            onClick={() => navigate('/studio')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 hover:text-white cursor-pointer transition-colors flex-shrink-0"
            title="Local Library Profile"
          >
            <UserIcon size={16} />
          </div>
        </div>
      </header>

      {/* Server / Backend URL Configuration Modal (crucial for Android APK to connect to host) */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border-subtle rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowServerModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Server size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Server Connection</h3>
                <p className="text-xs text-neutral-400">Configure host backend URL for Android & Web</p>
              </div>
            </div>

            <form onSubmit={handleSaveServerUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Backend API Host URL
                </label>
                <input
                  type="text"
                  placeholder="http://192.168.1.10:8000"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 focus:border-primary rounded-lg text-sm text-white placeholder-neutral-500 outline-none font-mono"
                />
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  Leave blank if running in browser on the same host (uses relative <code>/api/v1</code>).
                  On Android, point to your host computer IP (e.g. <code>http://192.168.1.5:8000</code>).
                </p>
              </div>

              {saveStatus === 'error' && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-center gap-2">
                  <WifiOff size={16} className="flex-shrink-0" />
                  Could not reach server at this address. Check IP, port 8000, and WiFi.
                </div>
              )}

              {saveStatus === 'saved' && (
                <div className="p-3 bg-green-950/40 border border-green-500/30 rounded-lg text-xs text-green-300 flex items-center gap-2">
                  <Check size={16} className="flex-shrink-0" />
                  Connected successfully! Reloading...
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetServerUrl}
                  className="text-xs text-neutral-400 hover:text-neutral-200 underline"
                >
                  Reset to Default
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowServerModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveStatus === 'testing'}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-primary text-black hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saveStatus === 'testing' ? 'Testing...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
