import React, { useState } from 'react';
import {
  X,
  Radio,
  Wifi,
  Smartphone,
  Laptop,
  CheckCircle2,
  HelpCircle,
  Flame,
  DownloadCloud,
  Share2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface P2PUserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  localAddress?: string;
}

export const P2PUserManualModal: React.FC<P2PUserManualModalProps> = ({
  isOpen,
  onClose,
  localAddress,
}) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'hotspot' | 'pc2phone' | 'faq'>('quickstart');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#161616] border border-border-subtle rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between bg-surface-card/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center flex-shrink-0">
              <Radio size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  P2P Music Sharing Manual
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 font-semibold">
                  Zero Data
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Stream & listen to music together across phones and PCs without internet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border-subtle bg-surface/80 px-3 pt-2 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'quickstart'
                ? 'bg-[#161616] text-primary border-t-2 border-primary'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-surface-hover'
            }`}
          >
            <Zap size={14} /> Quick Start (3 Steps)
          </button>
          <button
            onClick={() => setActiveTab('hotspot')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'hotspot'
                ? 'bg-[#161616] text-primary border-t-2 border-primary'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-surface-hover'
            }`}
          >
            <Smartphone size={14} /> Mobile Hotspot Mode
          </button>
          <button
            onClick={() => setActiveTab('pc2phone')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pc2phone'
                ? 'bg-[#161616] text-primary border-t-2 border-primary'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-surface-hover'
            }`}
          >
            <Laptop size={14} /> PC to Phone
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'faq'
                ? 'bg-[#161616] text-primary border-t-2 border-primary'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-surface-hover'
            }`}
          >
            <HelpCircle size={14} /> FAQ & Tips
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {/* TAB 1: Quick Start */}
          {activeTab === 'quickstart' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-neutral-200 flex items-start gap-3">
                <ShieldCheck size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">How It Works:</strong>
                  MyMusic allows direct Peer-to-Peer (P2P) streaming over local Wi-Fi or phone hotspot.
                  No central servers, no user accounts, and zero internet data used. Audio travels directly through local radio waves!
                </div>
              </div>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-3.5 p-3.5 rounded-xl bg-surface-card border border-border-subtle">
                  <div className="w-8 h-8 rounded-full bg-primary text-black font-bold text-sm flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">Join the Same Wi-Fi or Mobile Hotspot</h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Make sure both devices (Phone + Phone, or PC + Phone) are connected to the same Wi-Fi router, or connect to one device's Mobile Hotspot.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3.5 p-3.5 rounded-xl bg-surface-card border border-border-subtle">
                  <div className="w-8 h-8 rounded-full bg-primary text-black font-bold text-sm flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">Find Your Node Address</h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      On the host device with the songs, open the <strong>P2P & LAN Sharing</strong> page.
                      Under <em>Your Local Node</em>, click <strong>"Copy LAN Node Address"</strong> (e.g.{' '}
                      <code className="text-primary font-mono bg-neutral-900 px-1 py-0.5 rounded text-[11px]">
                        {localAddress || 'http://192.168.1.15:8000'}
                      </code>
                      ).
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3.5 p-3.5 rounded-xl bg-surface-card border border-border-subtle">
                  <div className="w-8 h-8 rounded-full bg-primary text-black font-bold text-sm flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">Paste, Connect & Listen!</h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      On the other device, go to P2P Sharing, paste the address into <strong>"Peer LAN Address"</strong>, and tap <strong>"Connect to Peer"</strong>.
                      Tap <strong>"Browse Music"</strong> to stream their shared music collection, or tap the download icon to save songs offline!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Mobile Hotspot */}
          {activeTab === 'hotspot' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-3">
                <Flame size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Perfect for Road Trips, Camping, & Outdoors!</strong>
                  You don't need a home Wi-Fi router or an active internet connection. A mobile phone hotspot connects both devices directly.
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-surface-card border border-border-subtle space-y-2">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Smartphone size={16} className="text-primary" />
                    <span>On Device A (Your Friend's Phone):</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-neutral-300 space-y-1.5 pl-1">
                    <li>Turn on <strong>Personal Hotspot / Portable Wi-Fi</strong> in phone settings.</li>
                    <li><em>Optional:</em> Mobile Data can be turned OFF — only the local Wi-Fi signal is needed!</li>
                    <li>Open MyMusic, go to <strong>P2P Network</strong>, and note the Local IP shown (e.g. <code className="text-primary">192.168.43.1:8000</code>).</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-card border border-border-subtle space-y-2">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Smartphone size={16} className="text-primary" />
                    <span>On Device B (Your Phone):</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-neutral-300 space-y-1.5 pl-1">
                    <li>Connect your Wi-Fi to Device A's Hotspot.</li>
                    <li>Open MyMusic, go to <strong>P2P Network</strong>, and enter Device A's IP address.</li>
                    <li>Tap <strong>Connect to Peer</strong>! You can now browse, stream, and play all their music!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PC to Phone */}
          {activeTab === 'pc2phone' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-3">
                <Laptop size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Stream Your Giant PC Library to Your Android Phone:</strong>
                  Keep all your high-resolution FLAC, WAV, and MP3 albums on your computer hard drive and stream seamlessly to your phone anywhere around the house.
                </div>
              </div>

              <div className="space-y-3.5 text-xs text-neutral-300">
                <div className="p-3.5 rounded-xl bg-surface-card border border-border-subtle space-y-2">
                  <h4 className="font-bold text-white text-sm">1. Host from PC</h4>
                  <p>
                    Run the MyMusic server on your computer. It automatically detects your local Wi-Fi IP address (e.g. <code className="text-primary font-mono">http://192.168.1.100:8000</code>).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-card border border-border-subtle space-y-2">
                  <h4 className="font-bold text-white text-sm">2. Connect Android Phone</h4>
                  <p>
                    Open the MyMusic APK on your phone, tap the <strong>Settings / Server icon</strong> in the top bar or go to <strong>P2P Sharing</strong>.
                    Enter your PC's IP (<code className="text-primary font-mono">http://192.168.1.100:8000</code>).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-card border border-border-subtle space-y-2">
                  <h4 className="font-bold text-white text-sm">3. Download for Commute / Offline Play</h4>
                  <p>
                    Before leaving home, tap the download icon on any album or track to save it into your phone's offline storage. Listen on the subway or flight with zero internet!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FAQs */}
          {activeTab === 'faq' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-card border border-border-subtle space-y-1">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-primary" /> Does P2P streaming consume my mobile data?
                </h4>
                <p className="text-neutral-400 leading-relaxed">
                  No! When connected over Wi-Fi or Hotspot, audio data travels directly device-to-device through local network packets. It uses <strong>0 megabytes</strong> of cellular data.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-card border border-border-subtle space-y-1">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-primary" /> Why does connection fail on public / college Wi-Fi?
                </h4>
                <p className="text-neutral-400 leading-relaxed">
                  Some public Wi-Fi networks (hotels, dormitories, cafes) have "Client Isolation / AP Isolation" enabled, which blocks devices from talking to each other.
                  The simple fix: Turn on your phone's <strong>Personal Hotspot</strong> and connect the other device directly to it!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-card border border-border-subtle space-y-1">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-primary" /> What audio formats are supported?
                </h4>
                <p className="text-neutral-400 leading-relaxed">
                  MP3, FLAC (Lossless), AAC, M4A, WAV, OGG Vorbis, and Opus are all natively supported with high-fidelity bitrates.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-card border border-border-subtle space-y-1">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-primary" /> Can I scan my own downloaded songs without P2P?
                </h4>
                <p className="text-neutral-400 leading-relaxed">
                  Yes! Head to the <strong>Offline Library</strong> tab and tap <strong>"Pick Music Files"</strong>. You can immediately import and play any songs from your Downloads or Music folders.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            Need to pick songs from your device? Check the <strong>Offline Library</strong> tab.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary text-black font-bold text-xs rounded-xl hover:scale-105 active:scale-95 transition-all"
          >
            Got it, Let's Listen!
          </button>
        </div>
      </div>
    </div>
  );
};
