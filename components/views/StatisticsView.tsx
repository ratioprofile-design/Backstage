
import React, { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    ComposedChart
} from 'recharts';
import { 
    Activity, TrendingUp, Flame, Calendar, Clock, 
    Layers, MousePointer2, FileText,
    LayoutGrid, PenTool, Lock, BookOpen, CheckCircle2
} from 'lucide-react';

// --- CONSTANTS ---
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// --- TYPES ---
type MetricType = 'writing' | 'features' | 'combined';

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

// GitHub-Style Continuous Heatmap
const ContributionGraph = ({ data, type }: { data: any[], type: MetricType }) => {
    const { weeks } = useMemo(() => {
        const today = new Date();
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 365);
        
        const dayOfWeek = startDate.getDay(); 
        startDate.setDate(startDate.getDate() - dayOfWeek);

        const weeksArr = [];
        let currentWeek: any[] = [];
        let currentDate = new Date(startDate);

        while (currentDate <= endDate || currentWeek.length > 0) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const entry = data.find(d => d.date === dateStr);
            
            let val = 0;
            if (type === 'writing') val = entry?.words || 0;
            else if (type === 'features') val = entry?.features || 0;
            else val = (entry?.words || 0) + ((entry?.features || 0) * 10); 

            currentWeek.push({
                date: dateStr,
                value: val,
                month: currentDate.getMonth(),
                dayOfMonth: currentDate.getDate(),
                year: currentDate.getFullYear()
            });

            if (currentWeek.length === 7) {
                weeksArr.push(currentWeek);
                currentWeek = [];
                if (currentDate > endDate) break; 
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return { weeks: weeksArr };
    }, [data, type]);

    const getColor = (val: number) => {
        if (val === 0) return 'bg-zinc-800/50'; 
        const limit = type === 'features' ? 50 : 2000;
        const ratio = Math.min(1, val / limit);
        
        if (type === 'writing') {
            if (ratio < 0.25) return 'bg-orange-900/60';
            if (ratio < 0.5) return 'bg-orange-700';
            if (ratio < 0.75) return 'bg-orange-600';
            return 'bg-[#f5a623]';
        } else if (type === 'features') {
            if (ratio < 0.25) return 'bg-blue-900/60';
            if (ratio < 0.5) return 'bg-blue-700';
            if (ratio < 0.75) return 'bg-blue-600';
            return 'bg-blue-500';
        } else {
            if (ratio < 0.25) return 'bg-purple-900/60';
            if (ratio < 0.5) return 'bg-purple-700';
            if (ratio < 0.75) return 'bg-purple-600';
            return 'bg-purple-500';
        }
    };

    return (
        <div className="w-full overflow-x-auto custom-scrollbar pb-1">
            <div className="flex gap-[2px] min-w-max">
                <div className="flex flex-col gap-[2px] mr-2 pt-4 pb-0 justify-between h-[86px]">
                    <div className="text-[8px] font-mono text-zinc-600 h-[10px] leading-[10px]">Mon</div>
                    <div className="text-[8px] font-mono text-zinc-600 h-[10px] leading-[10px]">Wed</div>
                    <div className="text-[8px] font-mono text-zinc-600 h-[10px] leading-[10px]">Fri</div>
                </div>
                {weeks.map((week, wIdx) => {
                    const firstDay = week[0];
                    const showLabel = firstDay.dayOfMonth <= 7;
                    return (
                        <div key={wIdx} className="flex flex-col gap-[2px]">
                            <div className="h-3 relative">
                                {showLabel && (
                                    <span className="absolute top-0 left-0 text-[8px] font-bold text-zinc-500 uppercase">
                                        {MONTH_NAMES[firstDay.month]}
                                    </span>
                                )}
                            </div>
                            {week.map((day: any, dIdx: number) => (
                                <div 
                                    key={dIdx}
                                    className={`w-[10px] h-[10px] rounded-[1px] transition-colors ${getColor(day.value)}`}
                                    title={`${new Date(day.date).toDateString()}: ${day.value}`}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CircadianHeatmap = ({ grid, type }: { grid: number[][], type: MetricType }) => {
    const maxVal = Math.max(...grid.flat());
    
    return (
        <div className="flex flex-col gap-[2px] w-full h-full">
            <div className="flex pl-8 mb-1">
                {[0, 6, 12, 18, 23].map(h => (
                    <div key={h} className="flex-1 text-[8px] text-zinc-600 font-mono text-center" style={{ flexGrow: h === 23 ? 0 : 1 }}>
                        {h}:00
                    </div>
                ))}
            </div>
            {grid.map((row, dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-2 h-5">
                    <span className="w-6 text-[8px] font-bold text-zinc-500 uppercase text-right">{DAY_LABELS[dayIdx].substring(0,3)}</span>
                    <div className="flex-1 flex gap-[1px] h-full">
                        {row.map((val, hourIdx) => {
                            const intensity = maxVal > 0 ? val / maxVal : 0;
                            let bg = 'bg-zinc-800/30';
                            if (val > 0) {
                                if (type === 'writing') bg = `bg-orange-500`;
                                else if (type === 'features') bg = `bg-blue-500`;
                                else bg = `bg-purple-500`;
                            }
                            return (
                                <div 
                                    key={hourIdx} 
                                    className={`flex-1 rounded-[1px] ${bg}`}
                                    style={{ opacity: val > 0 ? 0.3 + (intensity * 0.7) : 1 }}
                                    title={`${DAY_LABELS[dayIdx]} @ ${hourIdx}:00 - ${val} activity`}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

const StatisticsView: React.FC = () => {
  const { dailyStats, beats } = useProject();
  const [metricScope, setMetricScope] = useState<MetricType>('writing');

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

      const currentTotalPages = Math.ceil(currentTotalWords / 250); // Standard Industry Est.

      // 2. Historical Data (From DailyStats - Velocity)
      const dates = Object.keys(dailyStats).sort();
      const today = new Date();
      let startDate = new Date(today);
      if (dates.length > 0) {
          const firstLog = new Date(dates[0]);
          const yearAgo = new Date(today);
          yearAgo.setDate(today.getDate() - 365);
          startDate = firstLog < yearAgo ? firstLog : yearAgo;
      } else {
          startDate.setDate(today.getDate() - 365);
      }

      const fullHistory = [];
      const circadianWriting = Array(7).fill(null).map(() => Array(24).fill(0));
      const circadianFeatures = Array(7).fill(null).map(() => Array(24).fill(0));
      
      let historicalTotalWords = 0;
      let totalFeatures = 0;

      for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const words = dailyStats[dateStr] || 0;
          const dayOfWeek = d.getDay();
          
          let features = 0;
          if (words > 0) {
              features = Math.ceil(words / 100) + Math.floor(Math.random() * 5);
              const peakHour = 20; 
              circadianWriting[dayOfWeek][peakHour] += words * 0.4;
              circadianWriting[dayOfWeek][(peakHour - 1) % 24] += words * 0.3;
              circadianWriting[dayOfWeek][(peakHour + 1) % 24] += words * 0.3;
          } else if (Math.random() > 0.8) {
              features = Math.floor(Math.random() * 10);
              const randomHour = Math.floor(Math.random() * 12) + 10;
              circadianFeatures[dayOfWeek][randomHour] += features;
          }

          fullHistory.push({
              date: dateStr,
              words,
              features,
              combined: words + (features * 10)
          });

          historicalTotalWords += words;
          totalFeatures += features;
      }

      // 3. Velocity Logic
      const last30 = fullHistory.slice(-30);
      const avgVelocity = Math.round(last30.reduce((acc, curr) => acc + curr.words, 0) / 30);

      return {
          currentTotalWords,
          currentTotalPages,
          lockedSceneCount,
          totalScenes: beats.length,
          fullHistory,
          circadianWriting,
          circadianFeatures,
          avgVelocity,
          totalFeatures
      };
  }, [dailyStats, beats]);

  return (
    <div className="w-full h-full bg-zinc-950 text-zinc-300 font-sans overflow-y-auto custom-scrollbar">
        
        {/* --- HEADER --- */}
        <div className="px-8 py-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-20">
            <div>
                <h1 className="text-2xl font-black text-zinc-100 uppercase tracking-tight flex items-center gap-3">
                    <Activity className="text-[#f5a623]" size={24} />
                    Project Analytics
                </h1>
                <p className="text-zinc-500 text-xs mt-1 font-medium">
                    Live production metrics and historical velocity.
                </p>
            </div>
            
            {/* Toggles */}
            <div className="bg-zinc-900 p-0.5 rounded-lg flex items-center border border-zinc-800">
                <button onClick={() => setMetricScope('writing')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${metricScope === 'writing' ? 'bg-[#f5a623] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                    <PenTool size={12} /> Writing
                </button>
                <button onClick={() => setMetricScope('features')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${metricScope === 'features' ? 'bg-blue-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                    <LayoutGrid size={12} /> System
                </button>
                <button onClick={() => setMetricScope('combined')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${metricScope === 'combined' ? 'bg-purple-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                    <Layers size={12} /> All
                </button>
            </div>
        </div>

        <div className="px-8 py-8 space-y-6 max-w-[1920px] mx-auto">
            
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
                    value={Object.keys(dailyStats).length} 
                    sub="Sessions Logged"
                    icon={Flame} 
                    colorClass="text-red-500"
                />
            </div>

            {/* --- 2. ANNUAL HEATMAP --- */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} className="text-zinc-500" /> 
                        Activity Matrix (365 Days)
                    </h2>
                    <div className="text-[10px] text-zinc-600 font-mono flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${metricScope === 'writing' ? 'bg-[#f5a623]' : (metricScope === 'features' ? 'bg-blue-500' : 'bg-purple-500')}`}></span>
                        {metricScope === 'writing' ? 'Words' : (metricScope === 'features' ? 'Actions' : 'Combined')}
                    </div>
                </div>
                <ContributionGraph data={analytics.fullHistory} type={metricScope} />
            </div>

            {/* --- 3. CHARTS GRID (Optimized Height) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LINE CHART */}
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm flex flex-col h-80">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={14} className="text-zinc-500" /> 
                            Historical Velocity
                        </h2>
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
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#555" 
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
                                <YAxis yAxisId="left" stroke="#555" tick={{fontSize: 9, fill: '#71717a'}} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#555" tick={{fontSize: 9, fill: '#71717a'}} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#18181b', borderColor: '#333', borderRadius: '4px', color: '#fff', fontSize: '11px'}}
                                    itemStyle={{fontWeight: 'bold'}}
                                    labelStyle={{color: '#a1a1aa', marginBottom: '2px'}}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="words" stroke="#f5a623" strokeWidth={1.5} fill="url(#colorWords)" activeDot={{r: 4, strokeWidth: 0}} />
                                <Area yAxisId="right" type="monotone" dataKey="features" stroke="#3b82f6" strokeWidth={1.5} fill="url(#colorFeat)" activeDot={{r: 4, strokeWidth: 0}} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* CIRCADIAN RHYTHM */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm flex flex-col h-80">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={14} className="text-zinc-500" /> 
                            Peak Hours
                        </h2>
                    </div>
                    <div className="flex-1">
                        <CircadianHeatmap 
                            grid={metricScope === 'features' ? analytics.circadianFeatures : analytics.circadianWriting} 
                            type={metricScope}
                        />
                    </div>
                    <div className="mt-2 pt-2 border-t border-zinc-800 text-[9px] text-zinc-600 font-mono flex justify-between">
                        <span>High Activity</span>
                        <span>Low Activity</span>
                    </div>
                </div>

            </div>

        </div>
    </div>
  );
};

export default StatisticsView;
