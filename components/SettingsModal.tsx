import React, { useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { X, Settings } from 'lucide-react';
import BackstageView from './views/BackstageView';
import { translateUi } from '../services/appTranslations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToBackstage?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { appTheme = 'dark', appAccentColor = '#f5a623', appLanguage = 'english' } = useProject();
  const isLight = appTheme === 'light';

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal Dialog Window */}
      <div
        className={`relative w-full max-w-[1280px] h-[92vh] max-h-[920px] rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-300 text-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.25)]'
            : 'bg-[#0a0a0c] border-[#27272f] text-white shadow-[0_25px_60px_rgba(0,0,0,0.85)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div
          className={`px-5 py-3 border-b flex items-center justify-between shrink-0 select-none ${
            isLight ? 'bg-slate-100/95 border-slate-200' : 'bg-[#0f0f13]/95 border-[#222228]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center border shadow-xs"
              style={{
                backgroundColor: `${appAccentColor}18`,
                borderColor: `${appAccentColor}40`,
                color: appAccentColor
              }}
            >
              <Settings size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider">{translateUi('Backstage Settings Panel', appLanguage)}</span>
                <span
                  className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold border hidden sm:inline"
                  style={{
                    backgroundColor: `${appAccentColor}15`,
                    borderColor: `${appAccentColor}40`,
                    color: appAccentColor
                  }}
                >
                  {translateUi('Popup Panel', appLanguage)}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-mono hidden sm:block">{translateUi('Preferences, Appearance, Screenplay Typography, AI Keys & Tools', appLanguage)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gray-400 hidden md:inline px-2 py-0.5 rounded bg-black/20 border border-white/5">
              {translateUi('Press ESC to exit', appLanguage)}
            </span>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={translateUi('Close Settings', appLanguage)}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body: Full Backstage Settings View */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <BackstageView onNavigateToBoard={onClose} onClose={onClose} />
        </div>
      </div>
    </div>
  );
};