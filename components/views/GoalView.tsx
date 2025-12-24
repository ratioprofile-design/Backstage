
import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    Calculator, Calendar, Clock, Target, 
    Zap, Coffee, CheckCircle2, FileText, AlignLeft,
    ArrowRight, Rocket, AlertTriangle, CalendarDays,
    Timer, Flame, TrendingUp, XCircle, Hourglass, RefreshCw, Sliders
} from 'lucide-react';

const GoalView: React.FC = () => {
  const { writingGoal, setWritingGoal, beats } = useProject();

  // Mode Selection State
  const [activeTab, setActiveTab] = useState<'deadline' | 'habit'>(writingGoal.mode || 'deadline');

  // Local state for configuration
  const [config, setConfig] = useState({
      // Common
      isActive: writingGoal.isActive,
      type: writingGoal.type,
      // Deadline Mode
      targetAmount: writingGoal.targetAmount,
      deadlineStr: new Date(writingGoal.deadline).toISOString().split('T')[0],
      includeWeekends: writingGoal.includeWeekends,
      dailyMinutes: writingGoal.dailyWritingMinutes,
      // Habit Mode
      dailyTarget: writingGoal.dailyTarget || 500
  });

  // Calculate Current Stats
  const currentStats = useMemo(() => {
      let words = 0;
      beats.forEach(b => {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          words += (div.textContent || '').trim().split(/\s+/).length;
      });
      const pages = Math.ceil(words / 250);
      return { words, pages };
  }, [beats]);

  // --- DEADLINE CALCULATOR ---
  const deadlineResults = useMemo(() => {
      const deadline = new Date(config.deadlineStr);
      const today = new Date();
      // Reset hours to compare just dates roughly
      today.setHours(0,0,0,0);
      deadline.setHours(0,0,0,0);
      
      const diffTime = deadline.getTime() - today.getTime();
      const totalDays = Math.max(0, Math.ceil(diffTime / (1000 * 3600 * 24)));
      
      let writingDays = 0;
      let currentDate = new Date(today);
      // Don't count today if it's already passed in logic, but for simplicity:
      for (let i = 0; i < totalDays; i++) {
          currentDate.setDate(currentDate.getDate() + 1);
          const dayOfWeek = currentDate.getDay(); 
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          if (config.includeWeekends || !isWeekend) writingDays++;
      }

      const currentAmount = config.type === 'pages' ? currentStats.pages : currentStats.words;
      const remainingAmount = Math.max(0, config.targetAmount - currentAmount);
      const dailyOutput = writingDays > 0 ? remainingAmount / writingDays : remainingAmount;
      
      const dailyWords = config.type === 'words' ? dailyOutput : dailyOutput * 250;
      const wordsPerMinute = dailyWords / Math.max(1, config.dailyMinutes);
      
      return {
          totalDays, 
          writingDays, 
          remainingAmount,
          dailyPages: config.type === 'pages' ? dailyOutput : dailyOutput / 250,
          dailyWords: Math.ceil(dailyWords),
          sprint5m: Math.ceil(wordsPerMinute * 5),
          sprint15m: Math.ceil(wordsPerMinute * 15),
          sprint60m: Math.ceil(wordsPerMinute * 60),
          isImpossible: wordsPerMinute > 60 // Arbitrary "Hard" limit (60wpm sustained for entire session)
      };
  }, [config, currentStats]);

  // --- HABIT CALCULATOR ---
  const habitResults = useMemo(() => {
      const daily = config.dailyTarget;
      // Assuming standard screenplay ~110 pages ~27500 words
      const scriptLengthWords = 25000; 
      const daysToFinish = Math.ceil(scriptLengthWords / Math.max(1, daily));
      const finishDate = new Date();
      finishDate.setDate(finishDate.getDate() + daysToFinish);
      
      return {
          finishDate,
          daysToFinish,
          weeklyWords: daily * 7,
          monthlyWords: daily * 30
      };
  }, [config.dailyTarget]);

  const handleSave = () => {
      setWritingGoal({
          isActive: true,
          mode: activeTab,
          type: config.type,
          targetAmount: config.targetAmount,
          deadline: new Date(config.deadlineStr).getTime(),
          startDate: Date.now(),
          dailyTarget: config.dailyTarget,
          includeWeekends: config.includeWeekends,
          dailyWritingMinutes: config.dailyMinutes
      });
      setConfig(prev => ({...prev, isActive: true}));
  };

  const handleDeactivate = () => {
      setWritingGoal({ ...writingGoal, isActive: false });
      setConfig(prev => ({...prev, isActive: false}));
  };

  return (
    <div className="w-full h-full bg-[#050505] flex flex-col p-8 overflow-y-auto custom-scrollbar font-sans selection:bg-[#f5a623] selection:text-black">
        
        {/* HEADER - Technical Style */}
        <div className="max-w-7xl mx-auto w-full mb-10 flex items-end justify-between border-b border-[#333] pb-6">
            <div>
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                    <Target className="text-[#f5a623]" size={36} /> 
                    <span>TARGET <span className="text-[#333]">///</span> CONTROL</span>
                </h1>
                <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[#666] uppercase tracking-widest">
                    <span>SYS.GOAL_TRACKING</span>
                    <span className="text-[#333]">|</span>
                    <span>V.2.0</span>
                </div>
            </div>
            
            {/* Status Indicator */}
            <div className={`flex items-center gap-3 px-4 py-2 border ${config.isActive ? 'border-green-900 bg-green-900/10' : 'border-[#333] bg-[#111]'}`}>
                <div className={`w-2 h-2 ${config.isActive ? 'bg-green-500 animate-pulse' : 'bg-[#333]'}`}></div>
                <span className={`text-xs font-bold uppercase tracking-widest ${config.isActive ? 'text-green-500' : 'text-[#555]'}`}>
                    {config.isActive ? 'SYSTEM ACTIVE' : 'SYSTEM IDLE'}
                </span>
            </div>
        </div>

        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 pb-20">
            
            {/* --- LEFT: CONFIGURATION --- */}
            <div className="lg:col-span-5 space-y-8">
                
                {/* Mode Selectors - Sharp Tabs */}
                <div className="grid grid-cols-2 border border-[#333] bg-[#09090b]">
                    <button 
                        onClick={() => setActiveTab('deadline')}
                        className={`p-4 text-left transition-all relative group ${activeTab === 'deadline' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <CalendarDays size={20} />
                            {activeTab === 'deadline' && <div className="w-2 h-2 bg-black"></div>}
                        </div>
                        <div className="font-bold uppercase text-sm tracking-wider">Deadline Mode</div>
                        <div className={`text-[10px] font-mono mt-1 ${activeTab === 'deadline' ? 'text-black/70' : 'text-[#444]'}`}>FIXED DATE TARGET</div>
                    </button>

                    <button 
                        onClick={() => setActiveTab('habit')}
                        className={`p-4 text-left transition-all relative group border-l border-[#333] ${activeTab === 'habit' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <Coffee size={20} />
                            {activeTab === 'habit' && <div className="w-2 h-2 bg-black"></div>}
                        </div>
                        <div className="font-bold uppercase text-sm tracking-wider">Habit Mode</div>
                        <div className={`text-[10px] font-mono mt-1 ${activeTab === 'habit' ? 'text-black/70' : 'text-[#444]'}`}>DAILY CONSISTENCY</div>
                    </button>
                </div>

                {/* Settings Panel */}
                <div className="border border-[#333] bg-[#0a0a0a] p-8 relative">
                    {/* Decorative Corner accents */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#f5a623]"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#f5a623]"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#f5a623]"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#f5a623]"></div>

                    <h3 className="text-xs font-bold text-[#f5a623] uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Sliders size={12} /> Parameters Configuration
                    </h3>

                    {activeTab === 'deadline' ? (
                        <div className="space-y-8 animate-in slide-in-from-left-2 fade-in">
                            
                            {/* Project Target */}
                            <div className="group">
                                <label className="text-[10px] font-mono text-gray-500 uppercase block mb-2">Total Project Target</label>
                                <div className="flex border border-[#333] bg-[#111] focus-within:border-[#f5a623] transition-colors">
                                    <input 
                                        type="number" 
                                        value={config.targetAmount}
                                        onChange={(e) => setConfig({...config, targetAmount: parseInt(e.target.value) || 0})}
                                        className="flex-1 bg-transparent p-3 text-white text-lg font-mono font-bold outline-none placeholder-gray-700"
                                    />
                                    <div className="flex border-l border-[#333]">
                                        <button onClick={() => setConfig({...config, type: 'pages'})} className={`px-3 text-[10px] font-bold uppercase transition-colors ${config.type === 'pages' ? 'bg-[#333] text-white' : 'text-gray-600 hover:text-gray-400'}`}>PGS</button>
                                        <button onClick={() => setConfig({...config, type: 'words'})} className={`px-3 text-[10px] font-bold uppercase transition-colors border-l border-[#333] ${config.type === 'words' ? 'bg-[#333] text-white' : 'text-gray-600 hover:text-gray-400'}`}>WDS</button>
                                    </div>
                                </div>
                            </div>

                            {/* Deadline Date */}
                            <div className="group">
                                <label className="text-[10px] font-mono text-gray-500 uppercase block mb-2">Target Date</label>
                                <input 
                                    type="date"
                                    value={config.deadlineStr}
                                    onChange={(e) => setConfig({...config, deadlineStr: e.target.value})}
                                    className="w-full bg-[#111] border border-[#333] p-3 text-white font-mono text-sm focus:border-[#f5a623] outline-none transition-colors [color-scheme:dark]" 
                                />
                            </div>

                            {/* Availability Slider */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-mono text-gray-500 uppercase">Daily Capacity</label>
                                    <span className="text-xs font-mono font-bold text-[#f5a623] bg-[#f5a623]/10 px-2 py-0.5 border border-[#f5a623]/30">
                                        {Math.floor(config.dailyMinutes / 60)}h {config.dailyMinutes % 60}m
                                    </span>
                                </div>
                                <input 
                                    type="range" min="15" max="480" step="15"
                                    value={config.dailyMinutes}
                                    onChange={(e) => setConfig({...config, dailyMinutes: parseInt(e.target.value)})}
                                    className="w-full accent-[#f5a623] h-1 bg-[#222] appearance-none cursor-pointer hover:bg-[#333] transition-colors"
                                />
                            </div>

                            {/* Weekend Toggle */}
                            <div className="flex items-center justify-between border border-[#333] p-3 bg-[#111]">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Include Weekends</span>
                                <button 
                                    onClick={() => setConfig({...config, includeWeekends: !config.includeWeekends})}
                                    className={`w-4 h-4 border ${config.includeWeekends ? 'bg-[#f5a623] border-[#f5a623]' : 'border-[#555] bg-transparent'} flex items-center justify-center transition-all`}
                                >
                                    {config.includeWeekends && <CheckCircle2 size={12} className="text-black" />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in slide-in-from-right-2 fade-in">
                            <div className="group">
                                <label className="text-[10px] font-mono text-gray-500 uppercase block mb-2">Daily Word Target</label>
                                <div className="flex items-center border border-[#333] bg-[#111] focus-within:border-[#f5a623] transition-colors">
                                    <input 
                                        type="number" 
                                        value={config.dailyTarget}
                                        onChange={(e) => setConfig({...config, dailyTarget: parseInt(e.target.value) || 0})}
                                        className="flex-1 bg-transparent p-3 text-white text-lg font-mono font-bold outline-none placeholder-gray-700"
                                    />
                                    <span className="px-4 text-[10px] font-bold text-[#555] uppercase tracking-widest border-l border-[#333]">Words</span>
                                </div>
                                <p className="text-[10px] text-[#444] mt-2 font-mono">
                                    // "CONSISTENCY IS THE KEY."
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button 
                        onClick={handleSave}
                        className={`flex-1 py-4 text-black font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 border border-transparent ${config.isActive ? 'bg-[#f5a623] hover:bg-[#ffb74d]' : 'bg-white hover:bg-gray-200'}`}
                    >
                        {config.isActive ? <RefreshCw size={16} className={config.isActive ? "animate-spin-once" : ""} /> : <Rocket size={16} />}
                        {config.isActive ? 'UPDATE METRICS' : 'INITIALIZE'}
                    </button>
                    
                    {config.isActive && (
                        <button 
                            onClick={handleDeactivate} 
                            className="w-16 flex items-center justify-center border border-red-900 bg-red-900/10 text-red-500 hover:bg-red-900/30 hover:border-red-500 transition-all"
                            title="Abort Goal"
                        >
                            <XCircle size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* --- RIGHT: PROJECTION --- */}
            <div className="lg:col-span-7 bg-[#0a0a0a] border border-[#333] relative overflow-hidden flex flex-col">
                {/* Tech Grid Background */}
                <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
                <div className="absolute top-0 right-0 border-b border-l border-[#333] bg-[#111] px-3 py-1 text-[9px] font-mono text-[#555]">PROJECTION_MATRIX</div>

                <div className="p-8 relative z-10 flex-1 flex flex-col">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-10">
                        <TrendingUp size={14} className="text-[#f5a623]" /> Flight Trajectory
                    </h3>

                    {activeTab === 'deadline' ? (
                        <div className="flex-1 flex flex-col">
                            {/* HERO STAT */}
                            <div className="flex flex-col items-center justify-center py-6 border-b border-[#333] mb-8">
                                <div className="text-[9px] font-mono text-[#555] uppercase tracking-[0.3em] mb-4">REQUIRED VELOCITY</div>
                                <div className={`text-8xl font-black tracking-tighter leading-none ${deadlineResults.isImpossible ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                    {config.type === 'pages' ? deadlineResults.dailyPages.toFixed(1) : deadlineResults.dailyWords}
                                </div>
                                <div className={`text-xs font-bold uppercase mt-4 tracking-widest flex items-center gap-2 ${deadlineResults.isImpossible ? 'text-red-500' : 'text-[#f5a623]'}`}>
                                    {deadlineResults.isImpossible && <AlertTriangle size={14} />}
                                    {config.type === 'pages' ? 'PAGES / DAY' : 'WORDS / DAY'}
                                </div>
                            </div>

                            {/* SPRINT METRICS */}
                            <div className="grid grid-cols-3 border border-[#333] bg-[#0e0e0e] mb-8">
                                {[
                                    { label: '5m Burst', val: deadlineResults.sprint5m },
                                    { label: '15m Block', val: deadlineResults.sprint15m },
                                    { label: '1h Session', val: deadlineResults.sprint60m }
                                ].map((item, i) => (
                                    <div key={i} className="p-4 flex flex-col items-center justify-center border-r border-[#333] last:border-0 hover:bg-[#111] transition-colors">
                                        <div className="text-[9px] font-bold text-[#555] uppercase tracking-wider mb-2">{item.label}</div>
                                        <div className="text-2xl font-black text-white font-mono">{item.val}</div>
                                        <div className="text-[9px] text-[#333] font-bold uppercase">WDS</div>
                                    </div>
                                ))}
                            </div>

                            {/* DATA TABLE */}
                            <div className="grid grid-cols-3 gap-8 mt-auto">
                                <div>
                                    <div className="text-[9px] font-mono text-[#555] uppercase mb-1">TARGET_METRIC</div>
                                    <div className="text-lg font-bold text-white flex items-baseline gap-1">
                                        {config.type === 'words' ? deadlineResults.dailyPages.toFixed(1) : deadlineResults.dailyWords}
                                        <span className="text-[10px] text-[#444] font-bold uppercase">{config.type === 'words' ? 'PGS' : 'WDS'}</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-mono text-[#555] uppercase mb-1">REMAINING_DAYS</div>
                                    <div className="text-lg font-bold text-white flex items-baseline gap-1">
                                        {deadlineResults.writingDays} 
                                        <span className="text-[10px] text-[#444] font-bold uppercase">/ {deadlineResults.totalDays}</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-mono text-[#555] uppercase mb-1">TOTAL_REMAINING</div>
                                    <div className="text-lg font-bold text-white flex items-baseline gap-1">
                                        {deadlineResults.remainingAmount.toLocaleString()} 
                                        <span className="text-[10px] text-[#444] font-bold uppercase">{config.type === 'pages' ? 'PGS' : 'WDS'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            {/* HERO STAT */}
                            <div className="flex flex-col items-center justify-center py-12 border-b border-[#333] mb-8">
                                <div className="text-[9px] font-mono text-[#555] uppercase tracking-[0.3em] mb-4">ESTIMATED COMPLETION</div>
                                <div className="text-5xl font-black text-white text-center leading-tight tracking-tight">
                                    {habitResults.finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                                </div>
                                <div className="text-sm font-bold uppercase mt-4 text-[#f5a623] flex items-center gap-2 bg-[#f5a623]/10 px-3 py-1 border border-[#f5a623]/20">
                                    <Timer size={14} /> {habitResults.daysToFinish} Days Remaining
                                </div>
                            </div>

                            {/* OUTPUT METRICS */}
                            <div className="grid grid-cols-2 gap-px bg-[#333] border border-[#333]">
                                <div className="bg-[#0e0e0e] p-6 flex flex-col items-center justify-center hover:bg-[#111] transition-colors">
                                    <div className="flex items-center gap-2 text-[#555] mb-2">
                                        <Flame size={14} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Weekly Output</span>
                                    </div>
                                    <div className="text-3xl font-black text-white font-mono">{habitResults.weeklyWords.toLocaleString()}</div>
                                </div>
                                
                                <div className="bg-[#0e0e0e] p-6 flex flex-col items-center justify-center hover:bg-[#111] transition-colors">
                                    <div className="flex items-center gap-2 text-[#555] mb-2">
                                        <CalendarDays size={14} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Monthly Output</span>
                                    </div>
                                    <div className="text-3xl font-black text-white font-mono">{habitResults.monthlyWords.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timeline Bar */}
                    <div className="mt-8 pt-8 border-t border-[#333]">
                        <div className="flex items-center justify-between text-[9px] font-mono text-[#555] uppercase mb-2">
                            <span>START</span>
                            <span>FINISH_LINE</span>
                        </div>
                        <div className="h-1.5 bg-[#111] w-full relative">
                            <div className="absolute left-0 top-0 h-full bg-[#f5a623] w-[5%] shadow-[0_0_10px_#f5a623]"></div>
                            {/* Ticks */}
                            <div className="absolute left-1/4 top-0 h-full w-px bg-[#333]"></div>
                            <div className="absolute left-1/2 top-0 h-full w-px bg-[#333]"></div>
                            <div className="absolute left-3/4 top-0 h-full w-px bg-[#333]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default GoalView;
