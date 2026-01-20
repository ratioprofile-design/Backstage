
import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { X, Target, Calendar, CheckCircle2 } from 'lucide-react';

interface TargetModalProps {
  onClose: () => void;
}

const TargetModal: React.FC<TargetModalProps> = ({ onClose }) => {
  const { writingGoal, setWritingGoal } = useProject();
  
  const [goalAmount, setGoalAmount] = useState(writingGoal.targetAmount || 110);
  const [goalType, setGoalType] = useState<'pages' | 'words'>(writingGoal.type || 'pages');
  const [deadlineStr, setDeadlineStr] = useState(() => {
      const d = writingGoal.deadline ? new Date(writingGoal.deadline) : new Date(Date.now() + 30 * 86400000);
      return d.toLocaleDateString('en-CA');
  });

  const handleSave = () => {
      setWritingGoal({
          ...writingGoal,
          isActive: true,
          mode: 'deadline', // Explicitly set mode for this simple modal
          type: goalType, 
          targetAmount: goalAmount,
          deadline: new Date(deadlineStr).getTime(),
          startDate: writingGoal.startDate || Date.now()
      });
      onClose();
  };

  const handleDeactivate = () => {
      setWritingGoal({ ...writingGoal, isActive: false });
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-[#121212] border border-[#333] w-[380px] rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans">
            
            <div className="p-4 border-b border-[#222] bg-[#181818] flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Target size={16} className="text-[#f5a623]" />
                    <span className="text-sm font-bold text-white uppercase tracking-wide">Set Project Goal</span>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            <div className="p-6 space-y-5">
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Target Volume</label>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            value={goalAmount} 
                            onChange={(e) => setGoalAmount(parseInt(e.target.value))}
                            className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm font-bold text-white focus:border-[#f5a623] outline-none"
                        />
                        <div className="flex bg-[#1a1a1a] border border-[#333] rounded p-0.5">
                            <button 
                                onClick={() => setGoalType('pages')} 
                                className={`px-3 text-[10px] font-bold uppercase rounded transition-all ${goalType === 'pages' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                PGS
                            </button>
                            <button 
                                onClick={() => setGoalType('words')} 
                                className={`px-3 text-[10px] font-bold uppercase rounded transition-all ${goalType === 'words' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                WDS
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Target Date</label>
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-2.5 text-gray-500" />
                        <input 
                            type="date" 
                            value={deadlineStr}
                            onChange={(e) => setDeadlineStr(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 pl-9 text-sm text-white focus:border-[#f5a623] outline-none [color-scheme:dark]"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-[#222] bg-[#181818] flex gap-3">
                {writingGoal.isActive && (
                    <button 
                        onClick={handleDeactivate}
                        className="px-3 py-2 rounded border border-red-900/30 text-red-500 hover:bg-red-900/10 text-xs font-bold uppercase transition-all"
                    >
                        Disable
                    </button>
                )}
                <button 
                    onClick={handleSave}
                    className="flex-1 py-2 bg-[#f5a623] hover:bg-[#e09612] text-black rounded font-bold text-xs uppercase tracking-wide shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    <CheckCircle2 size={14} /> Save Goal
                </button>
            </div>

        </div>
    </div>
  );
};

export default TargetModal;
