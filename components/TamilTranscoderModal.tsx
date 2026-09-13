import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { convertToUnicode, FontEncoding } from '../services/tamilTranscoder';
import {
  Type,
  X,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  BookOpen
} from 'lucide-react';

interface TamilTranscoderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText?: (text: string) => void;
}

export const TamilTranscoderModal: React.FC<TamilTranscoderModalProps> = ({
  isOpen,
  onClose,
  onInsertText,
}) => {
  const { appTheme } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [encoding, setEncoding] = useState<FontEncoding>('BAMINI');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleConvert = (textToConvert = inputText) => {
    if (!textToConvert.trim()) {
      setOutputText('');
      return;
    }
    const unicode = convertToUnicode(textToConvert, encoding);
    setOutputText(unicode);
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    handleConvert(val);
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (outputText && onInsertText) {
      onInsertText(outputText);
      onClose();
    }
  };

  const handleLoadSample = () => {
    const sampleBamini = `fhl;rp 1: ntsp. kJiu kPdhl;rp mk;kd; Nfhtpy; - ,uT\n\nthdk; ,Uz;L fplf;fpwJ. gyj;j ,bRow;rpAld; kiw nfhj;jpj; jPh;f;fpwJ.\n\nMjp\nur;rpdk;! cd; rhk;uh[;ak; ,Njhj KbaPJlh!`;
    setInputText(sampleBamini);
    handleConvert(sampleBamini);
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className={`border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#141416] border-[#27272a] text-gray-100'
      }`}>
        {/* Header */}
        <div className="p-5 px-6 border-b border-inherit flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#f5a623]">
              <Type size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Tamil Screenplay Transcoder & Unicode Converter</h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Convert legacy Bamini typewriter fonts or Tanglish text to standard Tamil Unicode
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-inherit hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className={`p-3 px-6 border-b border-inherit flex items-center justify-between flex-wrap gap-2 text-xs ${
          isLight ? 'bg-slate-50' : 'bg-[#18181f]'
        }`}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-400">Encoding Source:</span>
            <select
              value={encoding}
              onChange={(e) => setEncoding(e.target.value as FontEncoding)}
              className={`px-2 py-1 rounded border outline-none font-bold text-xs ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#121215] border-[#333] text-white'
              }`}
            >
              <option value="BAMINI">Bamini (Standard Screenplay Typewriter)</option>
              <option value="AUTO">Auto Detect</option>
            </select>
          </div>

          <button
            onClick={handleLoadSample}
            className="px-2.5 py-1 text-xs rounded border border-inherit hover:bg-white/10 flex items-center gap-1.5 text-gray-400 hover:text-[#f5a623]"
          >
            <BookOpen size={13} />
            Load Sample Bamini Script
          </button>
        </div>

        {/* Two-Column Editor: Input vs Output */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-inherit min-h-[340px]">
          {/* Input Box */}
          <div className="p-4 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Raw Input (Bamini / Typewriter)
              </span>
              {inputText && (
                <button
                  onClick={() => handleInputChange('')}
                  className="text-[10px] text-gray-400 hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              placeholder="Paste Bamini encoded script here (e.g. fhl;rp 1: ntsp. kJiu...)"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              className={`flex-1 w-full p-3 rounded-xl border outline-none font-mono text-xs resize-none leading-relaxed ${
                isLight ? 'bg-slate-50 border-slate-200 focus:bg-white' : 'bg-[#181820] border-[#2a2a34] focus:bg-[#121216] text-gray-200'
              }`}
            />
          </div>

          {/* Output Box */}
          <div className="p-4 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase font-bold text-[#f5a623] tracking-wider">
                Converted Unicode Tamil
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!outputText}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 transition-all disabled:opacity-30 ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'border-inherit hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy Unicode'}
                </button>
              </div>
            </div>
            <textarea
              readOnly
              placeholder="Converted Tamil Unicode text will appear here automatically..."
              value={outputText}
              className={`flex-1 w-full p-3 rounded-xl border outline-none font-sans text-sm resize-none leading-relaxed ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#181820] border-[#2a2a34] text-white'
              }`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-inherit flex items-center justify-between">
          <div className="text-[11px] text-gray-400">
            Supports Grantha characters, vowels, consonants, compound glyphs, and screenplay sluglines.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-inherit hover:bg-white/10 text-gray-400"
            >
              Close
            </button>
            {onInsertText && (
              <button
                onClick={handleInsert}
                disabled={!outputText}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-40"
              >
                Insert into Script
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TamilTranscoderModal;
