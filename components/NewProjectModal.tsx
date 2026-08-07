import React, { useState, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { FolderPlus } from 'lucide-react';

interface NewProjectModalProps {
  onClose: () => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose }) => {
  const { createProject } = useProject();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createProject(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[420px] bg-[#121212] border border-[#333] rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#f5a623]/10 border border-[#f5a623]/40 flex items-center justify-center">
            <FolderPlus size={18} className="text-[#f5a623]" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-widest">New Project</h2>
            <p className="text-xs text-gray-500">Create a fresh screenplay workspace</p>
          </div>
        </div>

        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Project Name</label>
        <input
          ref={inputRef}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="e.g. The Lighthouse"
          className="w-full bg-[#1e1e1e] border border-[#444] text-white px-4 py-3 rounded-lg outline-none focus:border-[#f5a623] text-sm"
        />

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-[#444] text-[#888] hover:text-white hover:bg-[#333] text-xs font-bold uppercase transition-all">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-5 py-2.5 rounded-lg bg-[#f5a623] text-black text-xs font-black uppercase hover:bg-[#ffb73c] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;
