
import React, { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    ComposedChart
} from 'recharts';
import { 
    Activity, TrendingUp, Flame, Calendar, Clock, 
    Layers, MousePointer2, FileText,
    LayoutGrid, PenTool, Lock, BookOpen,
    ToggleLeft, ToggleRight
} from 'lucide-react';

// --- CONSTANTS ---
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- TYPES ---
type MetricType = 'writing' | 'features';

// --- COMPONENTS ---

const StatCard = ({ label, value, sub, icon: Icon, colorClass, borderClass }: any) => (
    <div className={`bg-zinc-900/50 rounded-lg p-4 flex flex-col justify-between h-24 border relative overflow-hidden group transition-all hover:bg-zinc-900 ${borderClass || 'border-zinc-800'}`}>
        <div className={`absolute top-0 right-0 p-3 opacity-5 transition-transform group-hover:scale-110 group-hover:opacity-10 ${colorClass}`}>
            <Icon size={56} />
        </div>
        <div className="flex items-center gap-2 z-10">
            <div className={`p-1 rounded bg-zinc-800/80 ${colorClass}`}>
                <Icon size={12} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className="z-10 mt-1">
            <div className="text-2xl font-black text-zinc-100 tracking-tight leading-none">{value}</div>
            {sub && <div className="text-[9px] font-medium text-zinc-500 mt-1">{sub}</div>}
        </div>
    </div>
);

// Standard Block Heatmap (GitHub/Zerodha Style)
const ContributionGraph = ({ data, type }: { data: any[], type: MetricType }) => {
    const { weeks } = useMemo(() => {
        const today = new Date();
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 365);
        
        // Align start date to the previous Sunday for proper column alignment
        const dayOfWeek = startDate.getDay(); 
        startDate.setDate(startDate.getDate() - dayOfWeek);

        const weeksArr = [];
        let currentWeek: any[] = [];
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const entry = data.find(d => d.date === dateStr);
            const val = type === 'writing' ? (entry?.words || 0) : (entry?.features || 0);

            // Level 0-4 Intensity
            let level = 0;
            if (val > 0) {
                const max = type === 'writing' ? 1500 : 30;
                level = Math.min(4, Math.ceil((val / max) * 4));
            }

            currentWeek.push({
                date: dateStr,
                value: val,
                level,
                dayOfMonth: currentDate.getDate(),
                monthIndex: currentDate.getMonth()
            });

            if (currentWeek.length === 7) {
                weeksArr.push(currentWeek);
                currentWeek = [];
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Push trailing partial week if exists
        if (currentWeek.length > 0) {
            weeksArr.push(currentWeek);
        }
        
        return { weeks: weeksArr };
    }, [data, type]);

    const getBgColor = (level: number) => {
        if (type === 'writing') {
            switch(level) {
                case 0: return 'bg-zinc-800/40';
                case 1: return 'bg-orange-900/60';
                case 2: return 'bg-orange-700/80';
                case 3: return 'bg-orange-600';
                case 4: return 'bg-[#f5a623]';
                default: return 'bg-zinc-800/40';
            }
        } else {
            switch(level) {
                case 0: return 'bg-zinc-800/40';
                case 1: return 'bg-blue-900/60';
                case 2: return 'bg-blue-800/80';
                case 3: return 'bg-blue-600';
                case 4: return 'bg-[#3b82f6]';
                default: return 'bg-zinc-800/40';
            }
        }
    };

    return (
        <div className="w-full flex justify-center custom-scrollbar pb-4 overflow-x-auto">
            <div className="flex min-w-max pt-6">
                
                {/* Y-Axis Labels (Sun, Tue, Thu, Sat) aligned with grid rows */}
                <div className="flex flex-col gap-1 mr-3 mt-5"> 
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                        <div key={i} className="h-2.5 flex items-center justify-end text-[9px] text-zinc-600 font-mono leading-none">
                            {(i === 0 || i === 2 || i === 4 || i === 6) ? day : ''}
                        </div>
                    ))}
                </div>
                
                {/* Heatmap Grid */}
                <div className="flex">
                    {weeks.map((week, wIdx) => {
                        // Determine if this week starts a new month visually
                        // We check if the 1st of the month falls within this week
                        const firstOfMonthDay = week.find(d => d.dayOfMonth === 1);
                        const monthLabel = firstOfMonthDay ? MONTH_NAMES[firstOfMonthDay.monthIndex] : null;
                        
                        // Add separation gap if it's a new month (unless it's the very first column)
                        const separationClass = (monthLabel && wIdx > 0) ? 'ml-4' : 'ml-1';

                        return (
                            <div key={wIdx} className={`flex flex-col gap-1 relative ${separationClass}`}>
                                {/* Floating Month Label */}
                                <div className="h-4 relative mb-1">
                                    {monthLabel && (
                                        <span className="absolute bottom-0 left-0 text-[10px] font-bold text-zinc-500 uppercase tracking-wider z-10">
                                            {monthLabel}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Day Squares */}
                                {week.map((day: any, dIdx: number) => (
                                    <div 
                                        key={dIdx}
                                        className={`w-2.5 h-2.5 rounded-[2px] transition-all hover:scale-125 hover:z-20 hover:ring-1 hover:ring-white/50 relative cursor-pointer ${getBgColor(day.level)}`}
                                        title={`${day.date}: ${day.value} ${type === 'writing' ? 'words' : 'actions'}`}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Hourly Block Grid (Expanded)
const CircadianHeatmap = ({ grid, type }: { grid: number[][], type: MetricType }) => {
    const maxVal = Math.max(...grid.flat());
    const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    return (
        <div className="w-full h-full flex flex-col pt-2">
            {/* Header (Hours) */}
            <div className="flex mb-2 pl-10 border-b border-zinc-800 pb-2">
                {Array.from({length: 12}).map((_, i) => {
                    const hour = i * 2;
                    return (
                        <div key={i} className="flex-1 text-[9px] text-zinc-500 font-mono text-center border-l border-zinc-800/50 first:border-l-0">
                            {hour === 0 ? '12A' : hour === 12 ? '12P' : hour > 12 ? (hour-12) + 'P' : hour + 'A'}
                        </div>
                    );
                })}
            </div>

            {/* Rows */}
            <div className="flex-1 flex flex-col justify-between gap-1">
                {grid.map((row, dayIdx) => (
                    <div key={dayIdx} className="flex items-center gap-3 h-full">
                        <span className="w-8 text-[9px] font-bold text-zinc-500 uppercase text-right shrink-0 tracking-wider">
                            {DAYS[dayIdx]}
                        </span>
                        <div className="flex-1 flex gap-1 h-full">
                            {row.map((val, hourIdx) => {
                                // Intensity 0-1
                                const ratio = maxVal > 0 ? val / maxVal : 0;
                                let bgClass = 'bg-zinc-800/30';
                                
                                if (ratio > 0) {
                                    if (type === 'writing') {
                                        if (ratio < 0.25) bgClass = 'bg-orange-900/30';
                                        else if (ratio < 0.5) bgClass = 'bg-orange-800/60';
                                        else if (ratio < 0.75) bgClass = 'bg-orange-600';
                                        else bgClass = 'bg-[#f5a623]';
                                    } else {
                                        if (ratio < 0.25) bgClass = 'bg-blue-900/30';
                                        else if (ratio < 0.5) bgClass = 'bg-blue-800/60';
                                        else if (ratio < 0.75) bgClass = 'bg-blue-600';
                                        else bgClass = 'bg-[#3b82f6]';
                                    }
                                }

                                return (
                                    <div 
                                        key={hourIdx} 
                                        className={`flex-1 min-h-[24px] rounded-[2px] transition-all hover:scale-x-110 hover:z-10 ${bgClass} ${val > 0 ? 'hover:brightness-125 cursor-help' : ''}`}
                                        title={val > 0 ? `${hourIdx}:00 - Activity: ${Math.round(ratio * 100)}%` : undefined}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatisticsView: React.FC = () => {
  const { dailyStats, beats } = useProject();
  const [metricScope, setMetricScope] = useState<MetricType>('writing');
  const [showDemoData, setShowDemoData] = useState(false);

  // --- ANALYTICS ENGINE ---
  const analytics = useMemo(() => {
      // 1. Live Snapshot Stats (From Beats - Realtime)
      let currentTotalWords = 0;
      let lockedSceneCount = 0;
      
      beats.forEach(b => {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          const txt = div.textContent || '';
          currentTotalWords += txt.trim().split(/\s+/).filter(w => w.length > 0).length;
          if (b.status === 'ready') lockedSceneCount++;
      });

      const currentTotalPages = Math.ceil(currentTotalWords / 250);

      // 2. Data Source (Real vs Demo)
      const dataToUse = showDemoData 
        ? generateHumanLikeData() 
        : Object.entries(dailyStats).map(([date, words]) => ({ date, words }));

      // Sort Date
      dataToUse.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // 3. Historical Data Processing
      const today = new Date();
      const endDate = new Date(today);
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 365);

      const fullHistory = [];
      // 7 days x 24 hours grid
      const circadianData = Array(7).fill(null).map(() => Array(24).fill(0));
      
      let historicalTotalWords = 0;
      let totalFeatures = 0;

      // Map existing data for O(1) lookup
      const dataMap = new Map(dataToUse.map(d => [d.date, d.words]));

      // Iterate last 365 days
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const dayOfWeek = d.getDay(); // 0 = Sun
          
          let words = dataMap.get(dateStr) || 0;
          let features = 0;

          // If Demo Mode, generate feature noise linked to words
          if (showDemoData && words > 0) {
              features = Math.floor(words / 50) + Math.floor(Math.random() * 10);
          }

          // Generate Circadian Distribution
          if (words > 0) {
              // Simulate "Evening Writer" vs "Weekend Warrior"
              // Weekdays: 7PM - 11PM heavy
              // Weekends: 10AM - 4PM heavy
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              
              for (let h = 0; h < 24; h++) {
                  let prob = 0;
                  if (isWeekend) {
                      // Weekend Bell Curve around 1 PM (13:00)
                      if (h >= 9 && h <= 17) prob = 0.8;
                      else if (h >= 18 && h <= 23) prob = 0.3;
                  } else {
                      // Weekday Evening Burst
                      if (h >= 19 && h <= 23) prob = 0.9;
                      else if (h >= 7 && h <= 8) prob = 0.4; // Quick morning session
                  }
                  
                  // Add randomness
                  if (Math.random() < prob) {
                      circadianData[dayOfWeek][h] += (words / 10); // Distribute value
                  }
              }
          }

          fullHistory.push({
              date: dateStr,
              words: words,
              features: features
          });

          historicalTotalWords += words;
          totalFeatures += features;
      }

      // 4. Velocity (Moving Average)
      // Calculate 7-day moving average for smoother chart
      const smoothedHistory = fullHistory.map((day, idx, arr) => {
          const start = Math.max(0, idx - 6);
          const subset = arr.slice(start, idx + 1);
          const avgWords = subset.reduce((acc, curr) => acc + curr.words, 0) / subset.length;
          const avgFeat = subset.reduce((acc, curr) => acc + curr.features, 0) / subset.length;
          return { ...day, words: Math.round(avgWords), features: Math.round(avgFeat), rawWords: day.words };
      });

      // 5. Velocity KPI
      const last30 = fullHistory.slice(-30);
      const avgVelocity = Math.round(last30.reduce((acc, curr) => acc + curr.words, 0) / 30);

      return {
          currentTotalWords,
          currentTotalPages,
          lockedSceneCount,
          totalScenes: beats.length,
          fullHistory: smoothedHistory,
          circadianData,
          avgVelocity,
          totalFeatures
      };
  }, [dailyStats, beats, showDemoData]);

  return (
    <div className="w-full h-full bg-[#050505] text-zinc-300 font-sans overflow-y-auto custom-scrollbar">
        
        {/* --- HEADER --- */}
        <div className="px-8 py-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-900 bg-[#050505]/90 backdrop-blur-sm sticky top-0 z-20">
            <div>
                <h1 className="text-2xl font-black text-zinc-100 uppercase tracking-tight flex items-center gap-3">
                    <Activity className="text-[#f5a623]" size={24} />
                    Project Analytics
                </h1>
                <p className="text-zinc-500 text-xs mt-1 font-medium">
                    Live production metrics and historical velocity.
                </p>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Demo Data Toggle */}
                <div className="flex items-center gap-2 mr-4 bg-zinc-900 rounded-full px-3 py-1 border border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Demo Data</span>
                    <button onClick={() => setShowDemoData(!showDemoData)} className={`transition-colors ${showDemoData ? 'text-[#f5a623]' : 'text-zinc-600'}`}>
                        {showDemoData ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                </div>

                {/* Scope Toggles */}
                <div className="bg-zinc-900 p-0.5 rounded-lg flex items-center border border-zinc-800">
                    <button onClick={() => setMetricScope('writing')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${metricScope === 'writing' ? 'bg-[#f5a623] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                        <PenTool size={12} /> Writing
                    </button>
                    <button onClick={() => setMetricScope('features')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${metricScope === 'features' ? 'bg-blue-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                        <LayoutGrid size={12} /> System
                    </button>
                </div>
            </div>
        </div>

        <div className="px-8 py-8 space-y-6 max-w-[1920px] mx-auto pb-24">
            
            {/* --- 1. COMPACT KPI GRID --- */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard 
                    label="Current Script" 
                    value={analytics.currentTotalWords.toLocaleString()} 
                    sub="Total Words (Live)"
                    icon={FileText} 
                    colorClass="text-[#f5a623]"
                    borderClass="border-[#f5a623]/20"
                />
                <StatCard 
                    label="Est. Pages" 
                    value={analytics.currentTotalPages} 
                    sub="~250 Words / Page"
                    icon={BookOpen} 
                    colorClass="text-zinc-100"
                />
                <StatCard 
                    label="Locked Scenes" 
                    value={`${analytics.lockedSceneCount} / ${analytics.totalScenes}`} 
                    sub="Marked as Ready"
                    icon={Lock} 
                    colorClass="text-green-500"
                    borderClass={analytics.lockedSceneCount === analytics.totalScenes ? 'border-green-900' : ''}
                />
                <StatCard 
                    label="30-Day Velocity" 
                    value={analytics.avgVelocity} 
                    sub="Words / Day Avg"
                    icon={TrendingUp} 
                    colorClass="text-blue-400"
                />
                <StatCard 
                    label="System Actions" 
                    value={analytics.totalFeatures.toLocaleString()} 
                    sub="Edits & Features"
                    icon={MousePointer2} 
                    colorClass="text-purple-500"
                />
                <StatCard 
                    label="Active Days" 
                    value={Object.keys(dailyStats).length + (showDemoData ? 142 : 0)} 
                    sub="Sessions Logged"
                    icon={Flame} 
                    colorClass="text-red-500"
                />
            </div>

            {/* --- 2. ANNUAL HEATMAP (FULL WIDTH) --- */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-sm flex flex-col relative overflow-hidden min-h-[240px]">
                <div className="flex items-center justify-between mb-4 z-10 relative">
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} className="text-zinc-500" /> 
                        Annual Contribution (365 Days)
                    </h2>
                    <div className="text-[10px] text-zinc-600 font-mono flex items-center gap-2 ml-2">
                        <span className={`w-2 h-2 rounded-full ${metricScope === 'writing' ? 'bg-[#f5a623]' : 'bg-blue-500'}`}></span>
                        {metricScope === 'writing' ? 'Words' : 'Actions'}
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center bg-black/20 rounded-md border border-zinc-800/50 p-4 relative z-10">
                    <ContributionGraph data={analytics.fullHistory} type={metricScope} />
                </div>
            </div>

            {/* --- 3. BOTTOM GRID: VELOCITY + CIRCADIAN --- */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[400px]">
                
                {/* HISTORICAL VELOCITY (2/3 Width) */}
                <div className="xl:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={14} className="text-zinc-500" /> 
                            Production Velocity (7-Day Avg)
                        </h2>
                        <div className="flex gap-4 text-[10px] uppercase font-bold text-zinc-500">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#f5a623]"></div> Words</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Actions</div>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-0 text-[10px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={analytics.fullHistory}>
                                <defs>
                                    <linearGradient id="colorWords" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f5a623" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f5a623" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorFeat" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#444" 
                                    tick={{fontSize: 9, fill: '#71717a'}} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    dy={10} 
                                    minTickGap={30}
                                    tickFormatter={(str) => {
                                        const d = new Date(str);
                                        return `${d.getMonth()+1}/${d.getDate()}`;
                                    }}
                                />
                                <YAxis yAxisId="left" stroke="#444" tick={{fontSize: 9, fill: '#71717a'}} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#444" tick={{fontSize: 9, fill: '#71717a'}} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#18181b', borderColor: '#333', borderRadius: '4px', color: '#fff', fontSize: '11px'}}
                                    itemStyle={{fontWeight: 'bold'}}
                                    labelStyle={{color: '#a1a1aa', marginBottom: '2px'}}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="words" stroke="#f5a623" strokeWidth={2} fill="url(#colorWords)" activeDot={{r: 4, strokeWidth: 0, fill:'#fff'}} />
                                <Area yAxisId="right" type="monotone" dataKey="features" stroke="#3b82f6" strokeWidth={2} fill="url(#colorFeat)" activeDot={{r: 4, strokeWidth: 0, fill:'#fff'}} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* CIRCADIAN RHYTHM (Larger, 1/3 Width) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={14} className="text-zinc-500" /> 
                            Session Pattern
                        </h2>
                    </div>
                    <div className="flex-1 flex flex-col bg-black/20 rounded-md border border-zinc-800/50 p-2 relative overflow-hidden">
                        <CircadianHeatmap 
                            grid={analytics.circadianData} 
                            type={metricScope}
                        />
                    </div>
                </div>

            </div>

        </div>
    </div>
  );
};

// --- DEMO DATA GENERATOR ---
function generateHumanLikeData() {
    const data = [];
    const now = new Date();
    // 365 days ago
    const start = new Date(now);
    start.setDate(now.getDate() - 365);

    let projectPhase = 'dormant'; 
    let momentum = 0;

    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // Randomly switch phases occasionally
        if (Math.random() < 0.05) {
            const r = Math.random();
            if (r < 0.3) projectPhase = 'dormant';
            else if (r < 0.7) projectPhase = 'steady';
            else projectPhase = 'crunch';
        }

        let baseWords = 0;
        if (projectPhase === 'steady') baseWords = 500;
        if (projectPhase === 'crunch') baseWords = 2000;

        // Apply Momentum (Streaks)
        if (baseWords > 0) {
            momentum += Math.random() * 0.2;
            if (momentum > 1.5) momentum = 1.5;
        } else {
            momentum *= 0.8;
        }

        // Calculate Daily Output
        let words = baseWords * momentum;
        
        // Add noise
        words += (Math.random() * 400) - 200;

        // Weekend Factor
        const day = d.getDay();
        if (day === 0 || day === 6) { // Weekend
            if (projectPhase === 'crunch') words *= 1.5; // Work harder on weekends during crunch
            else words *= 0.2; // Relax on weekends otherwise
        }

        // Random Skip Days (Human Element)
        if (Math.random() < 0.2) words = 0;

        data.push({
            date: dateStr,
            words: Math.max(0, Math.floor(words))
        });
    }
    return data;
}

export default StatisticsView;
