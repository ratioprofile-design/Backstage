
import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    Target, Calendar, Clock, BookOpen, 
    CheckCircle2, AlertCircle, Save,
    Film, FileText, Hourglass, RefreshCw,
    ToggleLeft, ToggleRight, Eye, AlignLeft
} from 'lucide-react';

const GoalView: React.FC = () => {
  const { writingGoal, setWritingGoal, beats, dailyStats } = useProject();

  // --- STATE ---
  const [targetAmount, setTargetAmount] = useState(writingGoal.targetAmount || 110);
  const [deadlineStr, setDeadlineStr] = useState(writingGoal.deadline 
      ? new Date(writingGoal.deadline).toLocaleDateString('en-CA') 
      : new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA')
  );
  const [projectType, setProjectType] = useState<'feature' | 'pilot' | 'short'>('feature');

  // --- REALTIME CALCULATIONS ---
  const stats = useMemo(() => {
      // 1. Calculate Actual Script Volume
      let totalWords = 0;
      beats.forEach(b => {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          const text = (div.textContent || '').trim();
          if (text.length > 0) {
              totalWords += text.split(/\s+/).filter(w => w.length > 0).length;
          }
      });

      // Industry Standard: 250 words = 1 Page
      // We use Math.floor to count only COMPLETED pages.
      // 1-249 words = 0 pages. 250 words = 1 page.
      const currentTotal = Math.floor(totalWords / 250);
      
      // 3. Deadline Math
      const today = new Date();
      today.setHours(0,0,0,0);
      const dueDate = new Date(deadlineStr);
      dueDate.setHours(0,0,0,0);

      const diffTime = dueDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const pagesLeft = Math.max(0, targetAmount - currentTotal);
      
      // Calculate Velocity (Pages/Day needed)
      const validDays = Math.max(1, daysLeft);
      const pagesPerDay = parseFloat((pagesLeft / validDays).toFixed(1));
      
      // Progress Bar Logic (Total only)
      const totalProgressPercent = targetAmount > 0 ? Math.min(100, (currentTotal / targetAmount) * 100) : 0;
      
      return {
          currentTotal,
          estRuntime: currentTotal, // Approx 1 min per page
          daysLeft: Math.max(0, daysLeft),
          pagesLeft,
          pagesPerDay,
          totalProgressPercent,
          displayLabel: 'Project Completion',
          displayValue: `${currentTotal} / ${targetAmount}`
      };
  }, [beats, targetAmount, deadlineStr]);

  const handleSave = () => {
      setWritingGoal({
          ...writingGoal,
          isActive: true,
          mode: 'deadline',
          type: 'pages', // Enforce pages
          targetAmount: targetAmount,
          deadline: new Date(deadlineStr).getTime(),
          startDate: Date.now()
      });
      alert("Production targets updated.");
  };

  const setPreset = (type: 'feature' | 'pilot' | 'short') => {
      setProjectType(type);
      if (type === 'feature') setTargetAmount(110);
      if (type === 'pilot') setTargetAmount(60);
      if (type === 'short') setTargetAmount(15);
  };

  return (
    <div className="w-full h-full bg-[#0c0c0c] text-gray-300 font-sans flex flex-col items-center justify-center p-8 overflow-y-auto">
        
        <div className="max-w-5xl w-full space-y-8">
            
            {/* TOP BAR: Heading Only */}
            <div className="flex justify-between items-end border-b border-[#222] pb-4">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Target className="text-[#f5a623]" size={24} /> Production Status
                    </h2>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                        Track your screenplay page count against production targets.
                    </p>
                </div>
            </div>

            {/* 1. THE BIG NUMBERS (3 COLUMNS: Current | Target | Rate) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Current Pages (BLUE) */}
                <div className="bg-[#151515] border border-[#222] p-6 rounded-lg flex flex-col items-center justify-center text-center h-48 relative overflow-hidden group hover:border-[#333] transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                    <FileText size={32} className="text-blue-500 mb-3 opacity-80" />
                    <div className="text-5xl font-black text-white tracking-tighter mb-1">{stats.currentTotal.toLocaleString()}</div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Completed Pages</div>
                    <div className="mt-2 text-[10px] text-gray-600 font-mono">~{stats.estRuntime} Mins Runtime</div>
                </div>

                {/* 2. Target Pages (ORANGE) - In the Middle */}
                <div className="bg-[#151515] border border-[#222] p-6 rounded-lg flex flex-col items-center justify-center text-center h-48 relative overflow-hidden group hover:border-[#333] transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#f5a623]"></div>
                    <Target size={32} className="text-[#f5a623] mb-3 opacity-80" />
                    <div className="text-5xl font-black text-white tracking-tighter mb-1">{targetAmount.toLocaleString()}</div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Target Pages</div>
                    <div className="mt-2 text-[10px] text-gray-600 font-mono">{stats.pagesLeft.toLocaleString()} Pages To Go</div>
                </div>

                {/* 3. Pages / Day (GREEN) */}
                <div className="bg-[#151515] border border-[#222] p-6 rounded-lg flex flex-col items-center justify-center text-center h-48 relative overflow-hidden group hover:border-[#333] transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                    <Hourglass size={32} className="text-green-500 mb-3 opacity-80" />
                    <div className="text-5xl font-black text-white tracking-tighter mb-1">{stats.pagesPerDay.toLocaleString()}</div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pages / Day</div>
                    <div className="mt-2 text-[10px] text-gray-600 font-mono">{stats.daysLeft} Days Remaining</div>
                </div>

            </div>

            {/* 2. PROGRESS BAR (TOTAL ONLY) */}
            <div className="bg-[#151515] border border-[#222] rounded-lg p-8 relative overflow-hidden">
                {/* Background Glow if Done */}
                {stats.pagesLeft <= 0 && <div className="absolute inset-0 bg-[#f5a623]/5 pointer-events-none animate-pulse"></div>}

                <div className="flex justify-between items-end mb-2 relative z-10">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Film size={16} className="text-[#f5a623]" />
                        {stats.displayLabel}
                    </h3>
                    <div className="text-right">
                        <span className="text-2xl font-black text-[#f5a623]">
                            {Math.round(stats.totalProgressPercent)}%
                        </span>
                        <div className="text-[10px] text-gray-500 font-mono font-bold">
                            {stats.displayValue} Pages
                        </div>
                    </div>
                </div>
                
                <div className="w-full h-4 bg-[#0a0a0a] rounded-full overflow-hidden border border-[#222] relative z-10">
                    <div 
                        className="h-full transition-all duration-1000 ease-out bg-[#f5a623]"
                        style={{ width: `${stats.totalProgressPercent}%` }}
                    />
                </div>
                
                <div className="mt-4 p-4 bg-[#222] rounded text-center relative z-10">
                    <p className="text-sm text-gray-300">
                        {stats.pagesLeft <= 0 
                            ? "🎉 Principal Photography Ready! Page count target achieved."
                            : `You are ${Math.round(stats.totalProgressPercent)}% through the ${projectType}. ${stats.daysLeft} days until deadline.`
                        }
                    </p>
                </div>
            </div>

            {/* 3. SETTINGS FORM */}
            <div className="bg-[#151515] border border-[#222] rounded-lg p-8">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Settings2 size={16} /> Project Configuration
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* TYPE SELECTION */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Project Format</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPreset('feature')}
                                className={`flex-1 py-3 px-2 rounded border text-xs font-bold uppercase transition-all ${projectType === 'feature' ? 'bg-[#f5a623] border-[#f5a623] text-black' : 'bg-[#0a0a0a] border-[#333] text-gray-500 hover:text-white'}`}
                            >
                                Feature
                            </button>
                            <button 
                                onClick={() => setPreset('pilot')}
                                className={`flex-1 py-3 px-2 rounded border text-xs font-bold uppercase transition-all ${projectType === 'pilot' ? 'bg-[#f5a623] border-[#f5a623] text-black' : 'bg-[#0a0a0a] border-[#333] text-gray-500 hover:text-white'}`}
                            >
                                Pilot
                            </button>
                            <button 
                                onClick={() => setPreset('short')}
                                className={`flex-1 py-3 px-2 rounded border text-xs font-bold uppercase transition-all ${projectType === 'short' ? 'bg-[#f5a623] border-[#f5a623] text-black' : 'bg-[#0a0a0a] border-[#333] text-gray-500 hover:text-white'}`}
                            >
                                Short
                            </button>
                        </div>
                        <div className="mt-4">
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Manual Target (Pages)</label>
                            <input 
                                type="number" 
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(parseInt(e.target.value))}
                                className="w-full bg-[#0a0a0a] border border-[#333] rounded px-4 py-2 text-white font-mono focus:border-[#f5a623] outline-none"
                            />
                        </div>
                    </div>

                    {/* DEADLINE SELECTION */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Deadline</label>
                        <div className="bg-[#0a0a0a] border border-[#333] rounded p-4">
                            <div className="flex items-center gap-3">
                                <Calendar size={18} className="text-[#f5a623]" />
                                <input 
                                    type="date" 
                                    value={deadlineStr}
                                    onChange={(e) => setDeadlineStr(e.target.value)}
                                    className="bg-transparent text-white font-bold text-sm outline-none w-full [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-2">
                            Select the date you need to have a finished draft.
                        </p>
                        
                        <div className="mt-6 flex justify-end">
                            <button 
                                onClick={handleSave}
                                className="bg-[#f5a623] hover:bg-[#e09612] text-black font-black uppercase text-xs px-6 py-3 rounded shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                            >
                                <Save size={14} /> Update Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

// Helper icon
const Settings2 = ({size}: {size: number}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

export default GoalView;
