import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { ScriptVersion, RevisionColor } from '../types';
import { compareScriptVersions, VersionComparisonSummary } from '../services/diffEngine';
import ScriptDiffModal from './ScriptDiffModal';
import {
  Archive,
  Plus,
  Lock,
  Unlock,
  Copy,
  Trash2,
  CheckCircle2,
  Calendar,
  FileText,
  GitCompare,
  X,
  Sparkles
} from 'lucide-react';

interface ScriptArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'backstage_script_versions';

export const ScriptArchiveModal: React.FC<ScriptArchiveModalProps> = ({ isOpen, onClose }) => {
  const { beats = [], setBeats, appTheme } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [versions, setVersions] = useState<ScriptVersion[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: 'ver-white',
        versionNumber: 1,
        versionName: 'White Draft (First Locked Draft)',
        revisionColor: 'WHITE',
        status: 'LOCKED',
        author: 'Lead Writer',
        createdAt: '2026-08-20T10:00:00.000Z',
        scriptContent: '',
        sceneCount: beats.length || 10,
        pageCountEighths: (beats.length || 10) * 8,
        scenes: JSON.parse(JSON.stringify(beats)),
      },
      {
        id: 'ver-blue',
        versionNumber: 2,
        versionName: 'Blue Revision (Location Rewrite)',
        revisionColor: 'BLUE',
        status: 'REVISED',
        author: 'Director & Writer',
        createdAt: '2026-09-01T14:30:00.000Z',
        scriptContent: '',
        sceneCount: beats.length || 10,
        pageCountEighths: (beats.length || 10) * 8,
        scenes: JSON.parse(JSON.stringify(beats)),
      },
    ];
  });

  const [activeVersionId, setActiveVersionId] = useState<string>(versions[0]?.id || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDraftName, setNewDraftName] = useState('');
  const [newDraftColor, setNewDraftColor] = useState<RevisionColor>('PINK');

  // Diff comparison modal state
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffSummary, setDiffSummary] = useState<VersionComparisonSummary | null>(null);
  const [compareDraftA, setCompareDraftA] = useState<ScriptVersion | null>(null);
  const [compareDraftB, setCompareDraftB] = useState<ScriptVersion | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  }, [versions]);

  if (!isOpen) return null;

  const getColorMeta = (color: RevisionColor) => {
    switch (color) {
      case 'WHITE': return { bg: isLight ? '#ffffff' : '#1e1e24', text: isLight ? '#0f172a' : '#ffffff', border: '#cbd5e1' };
      case 'BLUE': return { bg: isLight ? '#dbeafe' : 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: '#60a5fa' };
      case 'PINK': return { bg: isLight ? '#fce7f3' : 'rgba(236, 72, 153, 0.15)', text: '#ec4899', border: '#f472b6' };
      case 'YELLOW': return { bg: isLight ? '#fef9c3' : 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: '#fde047' };
      case 'GREEN': return { bg: isLight ? '#dcfce7' : 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: '#4ade80' };
      default: return { bg: isLight ? '#ffedd5' : 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: '#fb923c' };
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDraftName.trim()) return;

    const newVer: ScriptVersion = {
      id: `ver-${Date.now()}`,
      versionNumber: versions.length + 1,
      versionName: newDraftName.trim(),
      revisionColor: newDraftColor,
      status: 'REVISED',
      author: 'Production Team',
      createdAt: new Date().toISOString(),
      scriptContent: '',
      sceneCount: beats.length,
      pageCountEighths: beats.length * 8,
      scenes: JSON.parse(JSON.stringify(beats)),
    };

    setVersions([newVer, ...versions]);
    setActiveVersionId(newVer.id);
    setNewDraftName('');
    setShowCreateModal(false);
  };

  const handleToggleLock = (id: string) => {
    setVersions(
      versions.map((v) =>
        v.id === id ? { ...v, status: v.status === 'LOCKED' ? 'REVISED' : 'LOCKED' } : v
      )
    );
  };

  const handleDelete = (id: string) => {
    if (versions.length <= 1) return;
    setVersions(versions.filter((v) => v.id !== id));
  };

  const handleRunDiff = (targetVer: ScriptVersion) => {
    const baseVer = versions.find((v) => v.id !== targetVer.id) || versions[0];
    const summary = compareScriptVersions(baseVer.scenes || [], targetVer.scenes || beats);
    setCompareDraftA(baseVer);
    setCompareDraftB(targetVer);
    setDiffSummary(summary);
    setDiffModalOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-[2500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className={`border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#141416] border-[#27272a] text-gray-100'
        }`}>
          {/* Header */}
          <div className="p-5 px-6 border-b border-inherit flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Archive size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Script Revisions & Draft Archive</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                  Hollywood colored revisions (White, Blue, Pink, Yellow, Green, Goldenrod)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#f5a623] hover:bg-[#e09612] text-black flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={14} />
                New Revision Draft
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-inherit hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Versions List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {versions.map((ver) => {
              const isActive = ver.id === activeVersionId;
              const colorMeta = getColorMeta(ver.revisionColor);

              return (
                <div
                  key={ver.id}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    isActive
                      ? isLight ? 'bg-amber-50/50 border-[#f5a623] shadow-md' : 'bg-[#1c1c24] border-[#f5a623] shadow-lg'
                      : isLight ? 'bg-slate-50 hover:bg-white border-slate-200' : 'bg-[#18181f] hover:bg-[#1f1f28] border-[#222]'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Revision Color Tag */}
                    <div
                      className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border shadow-sm flex-shrink-0"
                      style={{
                        backgroundColor: colorMeta.bg,
                        color: colorMeta.text,
                        borderColor: colorMeta.border,
                      }}
                    >
                      {ver.revisionColor}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate">{ver.versionName}</h3>
                        {ver.status === 'LOCKED' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-[#f5a623] border border-[#f5a623]/30 flex items-center gap-0.5">
                            <Lock size={10} /> Locked
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-3 mt-1 text-[11px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                        <span>Draft #{ver.versionNumber}</span>
                        <span>•</span>
                        <span>{ver.sceneCount || beats.length} Scenes</span>
                        <span>•</span>
                        <span>{new Date(ver.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{ver.author}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRunDiff(ver)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors ${
                        isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#121215] hover:bg-[#222] border-[#333] text-gray-200'
                      }`}
                      title="Compare against previous draft"
                    >
                      <GitCompare size={13} className="text-[#f5a623]" />
                      Diff
                    </button>

                    <button
                      onClick={() => handleToggleLock(ver.id)}
                      className="p-1.5 rounded-lg border border-inherit hover:bg-white/10 text-gray-400"
                      title={ver.status === 'LOCKED' ? 'Unlock Draft' : 'Lock Draft'}
                    >
                      {ver.status === 'LOCKED' ? <Lock size={14} className="text-[#f5a623]" /> : <Unlock size={14} />}
                    </button>

                    <button
                      onClick={() => handleDelete(ver.id)}
                      disabled={versions.length <= 1}
                      className="p-1.5 rounded-lg border border-inherit hover:bg-red-500/10 text-gray-400 hover:text-red-400 disabled:opacity-30"
                      title="Delete Draft"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* New Revision Modal Popup */}
          {showCreateModal && (
            <div className="fixed inset-0 z-[2600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className={`p-6 rounded-2xl border w-full max-w-md shadow-2xl font-sans ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#18181f] border-[#333] text-gray-100'
              }`}>
                <h3 className="text-base font-black mb-3">Create New Script Revision</h3>
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Draft / Revision Name</label>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. Pink Revision (Stunt Sequence Added)"
                      value={newDraftName}
                      onChange={(e) => setNewDraftName(e.target.value)}
                      className={`w-full p-2.5 text-xs rounded-lg border outline-none ${
                        isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#121215] border-[#333] text-white'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Hollywood Revision Color</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['WHITE', 'BLUE', 'PINK', 'YELLOW', 'GREEN', 'GOLDENROD'] as RevisionColor[]).map((col) => {
                        const meta = getColorMeta(col);
                        return (
                          <button
                            type="button"
                            key={col}
                            onClick={() => setNewDraftColor(col)}
                            className={`p-2 rounded-lg text-[11px] font-black uppercase border transition-all ${
                              newDraftColor === col ? 'ring-2 ring-[#f5a623]' : ''
                            }`}
                            style={{
                              backgroundColor: meta.bg,
                              color: meta.text,
                              borderColor: meta.border,
                            }}
                          >
                            {col}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-3 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#f5a623] hover:bg-[#e09612] text-black"
                    >
                      Create Draft
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diff Engine Modal */}
      {diffModalOpen && diffSummary && compareDraftA && compareDraftB && (
        <ScriptDiffModal
          isOpen={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          draftAName={compareDraftA.versionName}
          draftBName={compareDraftB.versionName}
          diffSummary={diffSummary}
        />
      )}
    </>
  );
};

export default ScriptArchiveModal;
