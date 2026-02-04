import React from 'react';
import { VoiceSettings } from '../types';

interface VoiceStudioProps {
  settings: VoiceSettings;
  onUpdate: (s: VoiceSettings) => void;
  onGenerate: () => void;
  canGenerate: boolean;
}

const VoiceStudio: React.FC<VoiceStudioProps> = ({ settings, onUpdate, onGenerate, canGenerate }) => {
  return (
    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
      
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <h3 className="font-bold text-white tracking-wide">VOICE STUDIO PRO</h3>
      </div>

      <div className="space-y-4">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
          <span className="text-sm text-gray-300">Trạng thái</span>
          <button 
            onClick={() => onUpdate({...settings, enabled: !settings.enabled})}
            className={`w-12 h-6 rounded-full relative transition-colors ${settings.enabled ? 'bg-cyan-600' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enabled ? 'left-7' : 'left-1'}`}></span>
          </button>
        </div>

        {/* Voice Selection */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUpdate({...settings, voice: 'Nam'})}
            className={`p-3 rounded-lg border text-sm font-medium transition-all ${
              settings.voice === 'Nam' 
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' 
              : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30'
            }`}
          >
            Nam (Trầm)
          </button>
          <button
            onClick={() => onUpdate({...settings, voice: 'Nu'})}
            className={`p-3 rounded-lg border text-sm font-medium transition-all ${
              settings.voice === 'Nu' 
              ? 'bg-pink-500/20 border-pink-500 text-pink-300' 
              : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30'
            }`}
          >
            Nữ (Cảm xúc)
          </button>
        </div>

        {/* Speed Control */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Tốc độ đọc</span>
            <span>{settings.speed}x</span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="2.0" 
            step="0.25"
            value={settings.speed}
            onChange={(e) => onUpdate({...settings, speed: parseFloat(e.target.value)})}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        {/* Action Button */}
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`
            w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider
            transition-all duration-300
            ${canGenerate 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/30 text-white' 
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {canGenerate ? '🎧 Tạo Giọng Đọc AI' : 'Viết nội dung để tạo'}
        </button>
      </div>
    </div>
  );
};

export default VoiceStudio;
