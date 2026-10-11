import React, { useState } from 'react';
import { 
  Instagram, Copy, Check, ExternalLink, Sparkles, X, 
  Chrome, Folder, ArrowRight, ShieldCheck, CheckCircle2 
} from 'lucide-react';

interface IgGrabberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IgGrabberModal: React.FC<IgGrabberModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const extensionPath = '/Volumes/Crucial X9/Vibe Coding/Backstage/extension';

  if (!isOpen) return null;

  const copyPath = () => {
    navigator.clipboard.writeText(extensionPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl rounded-xl shadow-2xl border border-slate-800 bg-[#12141a] text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#161822]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <Chrome size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">Backstage Chrome Extension</h2>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold uppercase">
                  Ready to Load
                </span>
              </div>
              <p className="text-xs text-slate-400">10-second setup to enable 1-click Instagram sync</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                <Folder size={14} className="text-amber-500" />
                Extension Folder Path:
              </span>
              <button
                onClick={copyPath}
                className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-bold text-[11px] font-mono transition-colors flex items-center gap-1 border border-amber-500/30"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copied ? 'Copied Path!' : 'Copy Path'}</span>
              </button>
            </div>

            <div className="px-3 py-2 rounded bg-black/50 border border-slate-800 font-mono text-[11px] text-amber-300 break-all select-all">
              {extensionPath}
            </div>
          </div>

          {/* 3 Step Installation Guide */}
          <div className="space-y-3 font-sans">
            <h4 className="font-bold text-slate-200 text-xs uppercase font-mono tracking-wider">How to load it in Chrome / Brave / Edge:</h4>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">1</div>
              <div>
                Open a new tab in Chrome and go to: <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">chrome://extensions</strong>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">2</div>
              <div>
                Toggle on <strong>"Developer mode"</strong> in the top-right corner of the Extensions page.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">3</div>
              <div>
                Click the <strong>"Load unpacked"</strong> button (top left), and select the <strong><code>extension</code></strong> folder (paste the path above)!
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="text-[11.5px]">
              That’s it! Now whenever you visit any Instagram actor profile or click their IG link in Backstage, a floating <strong>🎬 Send to Backstage</strong> button appears on Instagram and syncs in 1 second!
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 flex justify-end bg-[#161822]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-md"
          >
            Done!
          </button>
        </div>
      </div>
    </div>
  );
};
