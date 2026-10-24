import React, { useEffect, useState } from 'react';
import { X, Sliders, RotateCcw, Zap, Volume2 } from 'lucide-react';
import { equalizerService, EQUALIZER_PRESETS, EqualizerSettings } from '../../services/equalizerService';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<EqualizerSettings>(equalizerService.getSettings());

  useEffect(() => {
    const unsubscribe = equalizerService.subscribe(() => {
      setSettings(equalizerService.getSettings());
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#18191c] border border-neutral-700/60 rounded-2xl p-5 shadow-2xl flex flex-col space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Equalizer</h3>
              <p className="text-xs text-neutral-400">Tune audio output & bass response</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Enable/Disable Toggle */}
            <label className="flex items-center cursor-pointer gap-2">
              <span className="text-xs text-neutral-300 font-medium">
                {settings.enabled ? 'Enabled' : 'Bypass'}
              </span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => equalizerService.setEnabled(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  settings.enabled ? 'bg-primary' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    settings.enabled ? 'left-6' : 'left-1'
                  }`}
                />
              </div>
            </label>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Presets Horizontal Scroll */}
        <div>
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Presets
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {Object.keys(EQUALIZER_PRESETS).map((preset) => {
              const isActive = settings.preset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => equalizerService.applyPreset(preset)}
                  disabled={!settings.enabled}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-primary text-black font-bold shadow-md shadow-primary/20'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  } ${!settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bass Boost Dial / Slider */}
        <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <Zap size={15} className="text-amber-400" />
              <span>Deep Bass Boost</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              +{settings.bassBoost.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            step={0.5}
            value={settings.bassBoost}
            disabled={!settings.enabled}
            onChange={(e) => equalizerService.setBassBoost(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:opacity-50"
          />
        </div>

        {/* 5-Band Equalizer Sliders */}
        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800/80">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>5-Band Frequency Response</span>
            <span className="text-[10px] text-neutral-500 font-mono">-12 dB to +12 dB</span>
          </div>

          <div className="grid grid-cols-5 gap-2 sm:gap-4 items-end justify-items-center h-48 py-2">
            {settings.bands.map((band, idx) => {
              return (
                <div key={idx} className="flex flex-col items-center justify-between h-full w-full">
                  {/* Gain readout */}
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      band.gain > 0
                        ? 'text-primary'
                        : band.gain < 0
                        ? 'text-neutral-400'
                        : 'text-neutral-500'
                    }`}
                  >
                    {band.gain > 0 ? `+${band.gain}` : band.gain}
                  </span>

                  {/* Vertical Slider Wrapper */}
                  <div className="relative flex-1 flex items-center justify-center my-2">
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={band.gain}
                      disabled={!settings.enabled}
                      onChange={(e) => equalizerService.setBandGain(idx, parseFloat(e.target.value))}
                      className="slider-vertical h-28 w-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
                      style={{
                        WebkitAppearance: 'slider-vertical',
                      }}
                    />
                  </div>

                  {/* Frequency Label */}
                  <span className="text-[11px] font-semibold text-neutral-300 whitespace-nowrap">
                    {band.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => equalizerService.resetFlat()}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <RotateCcw size={14} />
            <span>Reset to Flat</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
