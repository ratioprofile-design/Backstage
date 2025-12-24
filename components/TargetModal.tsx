
import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { X, Target, Calendar, BarChart3, Clock, AlertTriangle } from 'lucide-react';

interface TargetModalProps {
  onClose: () => void;
}

const TargetModal: React.FC<TargetModalProps> = ({ onClose }) => {
  const { writingGoal, setWritingGoal, beats } = useProject();
  
  const [goalAmount, setGoalAmount] = useState(writingGoal.targetAmount || 120);
  const [goalType, setGoalType] = useState<'pages' | 'words'>(writingGoal.type || 'pages');
  // Initialize date input string YYYY-MM-DD
  const [deadlineStr, setDeadlineStr] = useState(() => {
      const d = new Date(writingGoal.deadline || Date.now() + 2592000000);
      return d.toISOString().split('T')[0];
  });

  // Stats for "Actual"
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
      // Simple metric calculation
      let words = 0;
      beats.forEach(b => {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          words += (div.textContent || '').trim().split(/\s+/).length;
      });
      setCurrentProgress(goalType === 'words' ? words : Math.ceil(words / 250));
  }, [beats, goalType]);

  // Derived Metrics for Preview
  const deadlineDate = new Date(deadlineStr);
  const today = new Date();
  const timeDiff = deadlineDate.getTime() - today.getTime();
  const daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
  
  const remainingAmount = Math.max(0, goalAmount - currentProgress);
  const dailyPace = daysLeft > 0 ? Math.ceil(remainingAmount / daysLeft) : remainingAmount;
  const weeklyPace = Math.ceil(dailyPace * 7);
  
  // Crunch mode metric (if deadline is very close)
  const fiveMinPace = daysLeft <= 1 
    ? Math.ceil((remainingAmount / (Math.max(1, timeDiff / (1000 * 60)) / 5))) // Amount / 5-min segments
    : 0;

  const handleSave = () => {
      setWritingGoal({
          ...writingGoal,
          isActive: true,
          type: goalType,
          targetAmount: goalAmount,
          deadline: new Date(deadlineStr).getTime(),
          startDate: writingGoal.startDate || Date.now()
      });
      onClose();
  };

  const handleClear = () => {
      setWritingGoal({
          ...writingGoal,
          isActive: false
      });
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-[#121212] border border-[#333] w-[500px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-[#222] bg-[#181818] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f5a623]/20 flex items-center justify-center text-[#f5a623]">
                        <Target size={20} />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg">Writing Target</h2>
                        <p className="text-xs text-gray-500">Set your deadline and tracking metrics</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8">
                
                {/* 1. Goal Input */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">I want to write</label>
                        <input 
                            type="number" 
                            value={goalAmount} 
                            onChange={(e) => setGoalAmount(parseInt(e.target.value))}
                            className="w-full bg-[#222] border border-[#333] rounded-lg p-3 text-white text-xl font-bold focus:border-[#f5a623] outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unit</label>
                        <div className="flex bg-[#222] rounded-lg p-1 border border-[#333]">
                            <button onClick={() => setGoalType('pages')} className={`flex-1 py-2 text-xs font-bold rounded uppercase transition-all ${goalType === 'pages' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}>Pages</button>
                            <button onClick={() => setGoalType('words')} className={`flex-1 py-2 text-xs font-bold rounded uppercase transition-all ${goalType === 'words' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}>Words</button>
                        </div>
                    </div>
                </div>

                {/* 2. Deadline */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={12} /> Finished By</label>
                    <input 
                        type="date" 
                        value={deadlineStr}
                        onChange={(e) => setDeadlineStr(e.target.value)}
                        className="w-full bg-[#222] border border-[#333] rounded-lg p-3 text-white text-sm focus:border-[#f5a623] outline-none [color-scheme:dark]"
                    />
                </div>

                {/* 3. Preview Card */}
                <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <BarChart3 size={64} className="text-white" />
                    </div>
                    
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Required Pace</h3>
                    
                    {daysLeft > 0 ? (
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="text-2xl font-black text-white">{dailyPace} <span className="text-xs font-medium text-gray-500 font-sans uppercase">/ Day</span></div>
                                <div className="text-[10px] text-gray-600 mt-1">To finish in {daysLeft} days</div>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-[#f5a623]">{weeklyPace} <span className="text-xs font-medium text-gray-500 font-sans uppercase">/ Week</span></div>
                                <div className="text-[10px] text-gray-600 mt-1">Steady progress</div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-red-400 font-bold flex items-center gap-2">
                            <AlertTriangle size={16} /> Deadline Passed or Today!
                        </div>
                    )}

                    {daysLeft <= 1 && remainingAmount > 0 && (
                        <div className="mt-4 pt-4 border-t border-[#333] flex items-center gap-3 animate-pulse">
                            <Clock size={16} className="text-red-500" />
                            <span className="text-sm font-bold text-gray-300">
                                Crunch Mode: <span className="text-red-400">{Math.max(1, fiveMinPace)} {goalType === 'pages' ? 'Pages' : 'Words'}</span> every 5 mins
                            </span>
                        </div>
                    )}
                </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#222] bg-[#181818] flex gap-3">
                {writingGoal.isActive && (
                    <button 
                        onClick={handleClear}
                        className="px-6 py-3 rounded-lg border border-red-900/30 text-red-500 hover:bg-red-900/20 text-xs font-bold uppercase tracking-wider transition-all"
                    >
                        Deactivate
                    </button>
                )}
                <button 
                    onClick={handleSave}
                    className="flex-1 py-3 bg-[#f5a623] hover:bg-[#e09612] text-black rounded-lg font-bold text-sm uppercase tracking-wide shadow-lg transition-all"
                >
                    {writingGoal.isActive ? 'Update Target' : 'Set Target'}
                </button>
            </div>

        </div>
    </div>
  );
};

export default TargetModal;
