import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAiKeyStatus } from '../context/AiKeyStatusContext';
import { chatWithAI, ChatMessage } from '../services/gemini';
import { buildProjectSnapshot, snapshotStats } from '../services/projectReport';
import {
  X, Sparkles, Send, Loader2, User, Bot, AlertTriangle,
  RefreshCw, FileText, ListChecks, Shirt, Clapperboard, Users, BarChart2, MessageSquare
} from 'lucide-react';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REPORT_CHIPS = [
  { label: 'Script Analysis', icon: FileText, prompt: 'Generate a detailed SCRIPT ANALYSIS report from the attached project data. Cover story structure, scene pacing, word counts, readiness (locked/not-ready), locations and time-of-day balance, and any weak or underdeveloped scenes. Be specific, referencing scene numbers and titles.' },
  { label: 'Breakdown Report', icon: ListChecks, prompt: 'Generate a BREAKDOWN REPORT from the attached breakdown data (sound, props, costume, VFX, practical/SFX, extras/cast, location). Group by department, list recurring items with how many scenes they appear in, and flag the heaviest scenes and any gaps where breakdowns are missing.' },
  { label: 'Continuity Report', icon: Shirt, prompt: 'Generate a CONTINUITY REPORT from the attached continuity data. Summarize tracked looks per department and character, call out mismatched warnings or severe/destroyed items, and note any gaps or items that need attention with their scene ranges.' },
  { label: 'Shot List', icon: Clapperboard, prompt: 'Generate a SHOT LIST REPORT from the attached storyboard data. Summarize shots per scene (sizes and angles used), flag scenes with no shots yet, and note overall storyboard coverage.' },
  { label: 'Casting Roster', icon: Users, prompt: 'Generate a CASTING REPORT from the attached character roster. List every character with billing tier and archetype, note which have confirmed artists and which are still uncast, and flag any missing character profiles.' },
  { label: 'Production Overview', icon: BarChart2, prompt: 'Generate a PRODUCTION OVERVIEW report from the attached project data. Combine the key numbers (scenes, words, pages, runtime estimate, characters, shots, breakdown and continuity item counts), current writing goal progress, and top production risks or action items.' },
];

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const {
    generalAiModel, openrouterKey,
    beats, characterData, projectList, currentProjectId, generatedShots,
    writingGoal, dailyStats, globalNotes,
  } = useProject();

  const { aiAvailable, router, gemini, testing } = useAiKeyStatus();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const projectName = useMemo(() => {
    const p = projectList.find(proj => proj.id === currentProjectId);
    return p ? p.name : 'Untitled Project';
  }, [projectList, currentProjectId]);

  const snapshot = useMemo(() => buildProjectSnapshot({
    projectName,
    beats,
    characterData,
    generatedShots,
    globalNotes,
    writingGoal,
    dailyStats,
  }), [projectName, beats, characterData, generatedShots, globalNotes, writingGoal, dailyStats, refreshTick]);

  const stats = useMemo(() => snapshotStats({
    projectName,
    beats,
    characterData,
    generatedShots,
  }), [projectName, beats, characterData, generatedShots, refreshTick]);

  const systemPrompt = useMemo(() => [
    `You are Backstage Assistant, an expert screenplay and film production AI inside the "Backstage Story Sequencer" tool.`,
    `The user is chatting with you in a popup to pull data and reports out of their project.`,
    `You have the CURRENT PROJECT DATA attached below. Use it to answer questions and produce accurate, specific reports.`,
    `When asked for a report, produce a well-structured report (headings, bullet lists, concrete numbers) referencing scene numbers, titles, character names, departments and item names from the data. If the data for something is missing, say so instead of inventing it.`,
    `You may also answer general screenwriting, formatting, casting, breakdown, scheduling and storyboarding questions.`,
    `Be concise, practical and direct.`,
    ``,
    `=== CURRENT PROJECT DATA ===`,
    snapshot,
    `=== END PROJECT DATA ===`,
  ].join('\n'), [snapshot]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setMessages([]);
    setInput('');
    setRefreshTick(t => t + 1);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const send = useCallback(async (text: string) => {
    if (!text || isLoading || !aiAvailable) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsLoading(true);
    try {
      const reply = await chatWithAI(nextMessages, generalAiModel, systemPrompt, openrouterKey);
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setError(err?.message || 'Failed to get a response. Check your API keys in Backstage > AI.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, generalAiModel, systemPrompt, openrouterKey]);

  const handleSend = () => send(input.trim());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div
        className="relative w-full max-w-3xl bg-[#1a1a1a] border border-[#3d3d3d] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d2d] bg-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-purple-600/20 border border-amber-500/30 text-[#f5a623]">
              <Sparkles size={20} className="fill-[#f5a623]/30" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Ask Anything</h2>
              <p className="text-xs text-gray-400">
                Chat with your project — scripts, breakdowns, continuity, shots, casting &amp; reports.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Data stats strip */}
        <div className="flex items-center gap-4 px-6 py-2.5 bg-[#141414] border-b border-[#222] flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
            <BarChart2 size={12} className="text-[#f5a623]" />
            {projectName}
          </div>
          <Stat label="Scenes" value={stats.scenes} />
          <Stat label="Words" value={stats.words.toLocaleString()} />
          <Stat label="Pages" value={stats.pages} />
          <Stat label="Chars" value={stats.characters} />
          <Stat label="Shots" value={stats.shots} />
          <Stat label="Breakdown" value={stats.breakdownItems} />
          <Stat label="Continuity" value={stats.continuityItems} />
          <button
            onClick={() => setRefreshTick(t => t + 1)}
            className="ml-auto p-1.5 text-gray-500 hover:text-[#f5a623] hover:bg-[#222] rounded transition-colors"
            title="Refresh project data"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[52vh] min-h-[300px] bg-[#141414]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="p-3 rounded-xl bg-[#1f1f1f] border border-[#333] text-[#f5a623] mb-3">
                <Bot size={28} />
              </div>
              <p className="text-sm text-gray-300 font-semibold">Pull reports &amp; data straight from Backstage</p>
              <p className="text-xs text-gray-500 mt-1 max-w-lg">
                Ask for a breakdown, continuity, shot-list, casting or script-analysis report — or type any question
                about your project. Your live project data is attached.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-5 w-full max-w-xl">
                {REPORT_CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.label}
                      onClick={() => send(chip.prompt)}
                      disabled={isLoading || !aiAvailable}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1f1f1f] border border-[#333] hover:border-[#f5a623]/60 hover:bg-[#252018] text-left text-[11px] text-gray-300 font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Icon size={14} className="text-[#f5a623] shrink-0" />
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 shrink-0 rounded-full bg-[#252018] border border-[#f5a623]/40 text-[#f5a623] flex items-center justify-center">
                  <Bot size={14} />
                </div>
              )}
              <div className={`max-w-[82%] rounded-xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#f5a623] text-black font-medium'
                  : 'bg-[#222] border border-[#333] text-gray-200'
              }`}>
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 shrink-0 rounded-full bg-[#333] text-white flex items-center justify-center">
                  <User size={14} />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 shrink-0 rounded-full bg-[#252018] border border-[#f5a623]/40 text-[#f5a623] flex items-center justify-center">
                <Bot size={14} />
              </div>
              <div className="bg-[#222] border border-[#333] rounded-xl px-4 py-3 flex items-center gap-2 text-gray-400">
                <Loader2 size={14} className="animate-spin text-[#f5a623]" />
                <span className="text-xs">Analyzing project data...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#2d2d2d] bg-[#222] p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              disabled={!aiAvailable}
              placeholder={aiAvailable ? "Ask anything about your project..." : "AI unavailable — no working API key. Fix in Backstage > AI."}
              className="flex-1 bg-[#111] border border-[#333] focus:border-[#f5a623] rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none transition-colors resize-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !aiAvailable}
              className="p-2.5 rounded-lg bg-[#f5a623] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f7b84d] transition-colors shrink-0"
              title="Send (Enter)"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2 flex items-center gap-1.5">
            <MessageSquare size={11} />
            Enter to send · Shift+Enter for a new line · Model: <span className="text-gray-400">{generalAiModel}</span>
            <span className={`flex items-center gap-1 ml-auto ${testing ? 'text-amber-400' : aiAvailable ? 'text-green-500' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${testing ? 'bg-amber-400 animate-pulse' : aiAvailable ? 'bg-green-400' : 'bg-red-500'}`}></span>
              {testing ? 'Checking keys...' : aiAvailable ? `AI ready${gemini.state === 'valid' ? ' (Gemini)' : ` (${router.provider})`}` : 'No working API key'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="flex items-baseline gap-1">
    <span className="text-[11px] font-black text-white">{value}</span>
    <span className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</span>
  </div>
);
