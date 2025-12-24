
import React, { useMemo, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, Cell, PieChart, Pie, Legend,
    ComposedChart, Line
} from 'recharts';
import { 
    Activity, Target, Zap, 
    TrendingUp, Flame,
    ArrowUpRight, ArrowDownRight, Hourglass,
    GitCommit, Thermometer, Split, Clock, Calendar,
    Grid3X3, Network
} from 'lucide-react';

// --- CONSTANTS ---

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// --- COMPONENTS ---

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <div className="flex items-center gap-3 mb-6 mt-10 pb-2 border-b border-[#333]">
        <div className="p-1.5 bg-[#111] border border-[#333]">
            <Icon size={14} className="text-[#f5a623]" />
        </div>
        <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em] font-mono">{title}</h2>
    </div>
);

const KPICard = ({ label, value, sub, trend, icon: Icon, highlight }: any) => (
    <div className={`bg-[#0a0a0a] border ${highlight ? 'border-[#f5a623] bg-[#f5a623]/5' : 'border-[#333] hover:border-[#555]'} p-6 flex flex-col justify-between relative group transition-all h-full min-h-[140px]`}>
        <div className="flex justify-between items-start mb-4">
            <span className="text-[9px] font-mono font-bold text-[#555] uppercase tracking-widest">{label}</span>
            {Icon && <Icon size={14} className={`transition-colors ${highlight ? 'text-[#f5a623]' : 'text-[#444] group-hover:text-gray-400'}`} />}
        </div>
        <div>
            <div className={`text-4xl font-black tracking-tighter ${highlight ? 'text-[#f5a623]' : 'text-white'}`}>{value}</div>
            {sub && <div className="text-[10px] text-[#666] font-mono mt-2 font-bold uppercase">{sub}</div>}
        </div>
        {trend !== undefined && (
            <div className={`absolute top-6 right-6 flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border ${trend >= 0 ? 'text-green-500 border-green-900/50 bg-green-900/10' : 'text-red-500 border-red-900/50 bg-red-900/10'}`}>
                {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {Math.abs(Math.round(trend))}%
            </div>
        )}
        {/* Decorative Corner */}
        <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${highlight ? 'border-[#f5a623]' : 'border-[#333] group-hover:border-[#555]'}`}></div>
    </div>
);

// Tech Tooltip
const CustomInsightTooltip = ({ active, payload, label, insight, suffix = '' }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#050505] border border-[#f5a623] p-3 shadow-[0_0_20px_rgba(0,0,0,0.8)] max-w-[240px] z-50">
                <div className="flex justify-between items-center mb-2 border-b border-[#333] pb-1">
                    <p className="text-[9px] font-mono font-bold text-[#f5a623] uppercase">{label}</p>
                    <div className="w-1 h-1 bg-[#f5a623]"></div>
                </div>
                <div className="space-y-1 mb-3">
                    {payload.map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                {p.name === 'avg' ? 'AVG' : p.name === 'daily' ? 'WORDS' : p.name}
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                                {p.value} {suffix}
                            </span>
                        </div>
                    ))}
                </div>
                {insight && (
                    <div className="text-[9px] text-[#555] font-mono leading-relaxed border-t border-[#333] pt-2">
                        {`// ${insight}`}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

// --- FORCE DIRECTED GRAPH COMPONENT ---
const CharacterGraph = ({ characterData }: { characterData: any }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const engine = useRef({
        nodes: [] as any[],
        links: [] as any[],
        width: 800,
        height: 600
    });

    useEffect(() => {
        // Init Data
        const nodes: any[] = Object.values(characterData).map((c: any) => ({
            id: c.name,
            x: Math.random() * 800,
            y: Math.random() * 600,
            vx: 0,
            vy: 0,
            radius: 5 + (c.relationships?.length || 0) * 1.5, // Size by degree
            color: c.gender === 'Female' ? '#ec4899' : c.gender === 'Male' ? '#3b82f6' : '#f5a623'
        }));

        const links: any[] = [];
        nodes.forEach(node => {
            const char = characterData[node.id];
            if (char.relationships) {
                char.relationships.forEach((rel: any) => {
                    const target = nodes.find(n => n.id === rel.target);
                    if (target) {
                        // Check duplicate
                        const exists = links.find(l => 
                            (l.source === node && l.target === target) || 
                            (l.source === target && l.target === node)
                        );
                        if (!exists) links.push({ source: node, target, type: rel.type });
                    }
                });
            }
        });

        engine.current.nodes = nodes;
        engine.current.links = links;

        let animationFrameId: number;

        const updatePhysics = () => {
            const { nodes, links, width, height } = engine.current;
            
            // Forces
            const REPULSION = 100;
            const ATTRACTION = 0.01;
            const CENTER_GRAVITY = 0.005;
            const DAMPING = 0.9;

            // 1. Repulsion (Node-Node)
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const n1 = nodes[i];
                    const n2 = nodes[j];
                    const dx = n1.x - n2.x;
                    const dy = n1.y - n2.y;
                    const distSq = dx*dx + dy*dy;
                    if (distSq > 0) {
                        const dist = Math.sqrt(distSq);
                        const force = REPULSION / distSq;
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;
                        n1.vx += fx; n1.vy += fy;
                        n2.vx -= fx; n2.vy -= fy;
                    }
                }
            }

            // 2. Attraction (Links)
            links.forEach(link => {
                const dx = link.target.x - link.source.x;
                const dy = link.target.y - link.source.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const force = (dist - 100) * ATTRACTION; // 100 is ideal length
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                link.source.vx += fx; link.source.vy += fy;
                link.target.vx -= fx; link.target.vy -= fy;
            });

            // 3. Center Gravity
            const cx = width / 2;
            const cy = height / 2;
            nodes.forEach(n => {
                n.vx += (cx - n.x) * CENTER_GRAVITY;
                n.vy += (cy - n.y) * CENTER_GRAVITY;
                
                // Update Pos
                n.x += n.vx;
                n.y += n.vy;
                
                // Damp
                n.vx *= DAMPING;
                n.vy *= DAMPING;

                // Bounds
                n.x = Math.max(10, Math.min(width - 10, n.x));
                n.y = Math.max(10, Math.min(height - 10, n.y));
            });
        };

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const { width, height } = containerRef.current?.getBoundingClientRect() || { width: 800, height: 400 };
            canvas.width = width;
            canvas.height = height;
            engine.current.width = width;
            engine.current.height = height;

            ctx.clearRect(0, 0, width, height);

            // Draw Links
            ctx.lineWidth = 1;
            engine.current.links.forEach(link => {
                ctx.beginPath();
                ctx.moveTo(link.source.x, link.source.y);
                ctx.lineTo(link.target.x, link.target.y);
                ctx.strokeStyle = link.type === 'Enemy' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.2)';
                ctx.stroke();
            });

            // Draw Nodes
            engine.current.nodes.forEach(node => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.fill();
                
                // Text
                ctx.fillStyle = '#fff';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(node.id, node.x, node.y + node.radius + 12);
            });
        };

        const loop = () => {
            updatePhysics();
            draw();
            animationFrameId = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(animationFrameId);
    }, [characterData]);

    return (
        <div ref={containerRef} className="w-full h-[400px] bg-[#000] border border-[#333] rounded-lg overflow-hidden relative">
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="absolute top-4 left-4 text-[9px] font-bold text-[#555] uppercase tracking-widest pointer-events-none">
                Force-Directed Graph
            </div>
        </div>
    );
};

const StatisticsView: React.FC = () => {
  const { beats, dailyStats, writingGoal, characterData } = useProject();

  // --- ANALYTICS ENGINE ---
  const data = useMemo(() => {
    // 1. RAW DATA
    let totalWordCount = 0;
    let totalVersions = 0;
    const hourMap = new Array(24).fill(0); // Aggregate
    const circadianGrid = Array(7).fill(null).map(() => new Array(24).fill(0)); // 7x24 Matrix
    let hasVersionData = false;
    let maxHourlyActivity = 0;
    
    beats.forEach(b => {
        const div = document.createElement('div');
        div.innerHTML = b.content;
        totalWordCount += (div.textContent || '').trim().split(/\s+/).filter(w => w.length > 0).length;
        if(b.versions) {
            totalVersions += b.versions.length;
            b.versions.forEach(v => {
                hasVersionData = true;
                const d = new Date(v.timestamp);
                const h = d.getHours();
                const day = d.getDay();
                hourMap[h]++;
                circadianGrid[day][h]++;
                maxHourlyActivity = Math.max(maxHourlyActivity, circadianGrid[day][h]);
            });
        }
    });

    // Simulation Data if Empty (For aesthetics in demo)
    if (!hasVersionData) {
        for(let d=0; d<7; d++) {
            for(let h=0; h<24; h++) {
                // Mock: Night Owl Pattern
                if ((h >= 21 || h <= 2) && Math.random() > 0.3) {
                    circadianGrid[d][h] = Math.floor(Math.random() * 5) + 2;
                } else if (h === 12 && Math.random() > 0.8) {
                    circadianGrid[d][h] = 1;
                }
                maxHourlyActivity = Math.max(maxHourlyActivity, circadianGrid[d][h]);
            }
        }
        maxHourlyActivity = Math.max(1, maxHourlyActivity);
    }

    const dates = Object.keys(dailyStats).sort();
    const activeDays = dates.length;
    const values = Object.values(dailyStats) as number[];
    const totalLogged = values.reduce((a, b) => a + b, 0);

    // 2. AVERAGES
    const lifetimeAvg = activeDays > 0 ? Math.round(totalLogged / activeDays) : 0;
    const last30Days = dates.slice(-30);
    const avg30Day = last30Days.reduce((sum, d) => sum + dailyStats[d], 0) / (last30Days.length || 1);

    // 3. STREAKS
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date();
    for(let i=0; i<365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        if (i === 0 && (dailyStats[dateStr] || 0) === 0) continue;
        if ((dailyStats[dateStr] || 0) > 0) currentStreak++;
        else break;
    }

    let prevDate: Date | null = null;
    dates.forEach(dStr => {
        const d = new Date(dStr);
        if (dailyStats[dStr] > 0) {
            if (prevDate) {
                const diff = (d.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
                if (diff <= 1.1) { 
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            } else {
                tempStreak = 1;
            }
            prevDate = d;
        }
    });
    longestStreak = Math.max(longestStreak, tempStreak);

    // 4. GOAL FIDELITY
    const targetDaily = writingGoal.mode === 'habit' ? writingGoal.dailyTarget : 500;
    const daysMet = values.filter(v => v >= targetDaily).length;
    const goalFidelity = activeDays > 0 ? Math.round((daysMet / activeDays) * 100) : 0;

    // 5. TIME & FREQUENCY
    const dowStats = [0,0,0,0,0,0,0];
    const dowCounts = [0,0,0,0,0,0,0];
    dates.forEach(dStr => {
        const d = new Date(dStr);
        const day = d.getDay(); 
        dowStats[day] += dailyStats[dStr];
        dowCounts[day]++;
    });
    const dowData = dowStats.map((total, i) => ({
        day: DAYS_OF_WEEK[i],
        avg: dowCounts[i] > 0 ? Math.round(total / dowCounts[i]) : 0,
        frequency: dowCounts[i]
    }));

    // 6. FORECAST
    const targetTotal = writingGoal.targetAmount || 100000;
    const remaining = Math.max(0, targetTotal - totalWordCount);
    const velocity = Math.max(1, Math.round(avg30Day)) || 500;
    const daysToFinish = Math.ceil(remaining / velocity);
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + daysToFinish);

    // 7. QUALITY
    const revisionDensity = beats.length > 0 ? (totalVersions / beats.length).toFixed(1) : "0.0";

    return {
        totalWordCount, activeDays, lifetimeAvg, avg30Day, currentStreak, longestStreak,
        goalFidelity, dowData, circadianGrid, maxHourlyActivity, hasVersionData, forecastDate, velocity, remaining, revisionDensity
    };
  }, [beats, dailyStats, writingGoal]);

  // --- CHART DATA ---
  const historyChartData = useMemo(() => {
      const dates = Object.keys(dailyStats).sort();
      const chartData = [];
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      let cumulative = 0;
      dates.forEach(dStr => {
          if (new Date(dStr) < start) cumulative += dailyStats[dStr];
      });
      for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const s = d.toISOString().split('T')[0];
          const daily = dailyStats[s] || 0;
          cumulative += daily;
          chartData.push({
              date: s.slice(5), 
              daily: daily,
              cumulative: cumulative,
              goal: writingGoal.mode === 'habit' ? writingGoal.dailyTarget : data.velocity
          });
      }
      return chartData;
  }, [dailyStats, writingGoal, data.velocity]);

  // --- CONTINUOUS YEARLY GRID DATA ---
  const yearlyHeatmapData = useMemo(() => {
      const today = new Date();
      today.setHours(0,0,0,0); // Normalize

      const endDayOffset = 6 - today.getDay(); // Align to Saturday end
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + endDayOffset);

      // 52 weeks back
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - (52 * 7) + 1);

      const weeks = [];
      let d = new Date(startDate);

      for (let w = 0; w < 52; w++) {
          const days = [];
          let monthName = null;
          let hasFirstOfMonth = false;
          let sundayMonthName = null;
          
          for (let i = 0; i < 7; i++) {
              const dateStr = d.toISOString().split('T')[0];
              const monthIndex = d.getMonth();
              const dayNum = d.getDate();
              
              if (i === 0) sundayMonthName = MONTH_NAMES[monthIndex];
              
              // Logic: Month label appears on the week containing the 1st of the month
              if (dayNum === 1) {
                  hasFirstOfMonth = true;
                  monthName = MONTH_NAMES[monthIndex];
              }

              const isFuture = d > today;
              const count = dailyStats[dateStr] || 0;

              days.push({ date: dateStr, count, isFuture });
              d.setDate(d.getDate() + 1);
          }
          
          // Determine final label and margin
          let label = null;
          let addGap = false;

          if (hasFirstOfMonth) {
              label = monthName;
              if (w > 0) addGap = true;
          } else if (w === 0) {
              label = sundayMonthName;
          }

          weeks.push({ days, monthName: label, addGap });
      }
      return weeks;
  }, [dailyStats]);

  const threadData = useMemo(() => {
      const sorted = [...beats].sort((a, b) => a.x - b.x);
      if (sorted.length === 0) return { data: [], colors: [] };
      const BINS = 10; 
      const chunkSize = Math.max(1, Math.ceil(sorted.length / BINS));
      const chartData = [];
      const colorsFound = new Set<string>();
      for (let i = 0; i < BINS; i++) {
          const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
          const stat: any = { name: `${(i+1) * 10}%` };
          chunk.forEach(b => {
              const c = b.color || '#444';
              stat[c] = (stat[c] || 0) + 1;
              colorsFound.add(c);
          });
          chartData.push(stat);
      }
      return { data: chartData, colors: Array.from(colorsFound) };
  }, [beats]);

  return (
    <div className="w-full h-full bg-[#050505] overflow-y-auto custom-scrollbar text-gray-300 font-sans p-8 pb-32">
        {/* Background Grid Pattern */}
        <div className="fixed inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        <div className="max-w-[1600px] mx-auto space-y-12 relative z-10">
            
            {/* --- DASHBOARD HEADER --- */}
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#333] pb-6 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                        <Activity className="text-[#f5a623]" size={36} /> 
                        PERFORMANCE ANALYTICS
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[#666] uppercase tracking-widest">
                        <span>SYS.METRICS</span>
                        <span className="text-[#333]">|</span>
                        <span>V.2.0</span>
                    </div>
                </div>
                <div className="flex gap-1">
                    <div className="bg-[#0a0a0a] border border-[#333] px-6 py-3 flex flex-col items-end min-w-[140px]">
                        <div className="text-3xl font-black text-white leading-none tabular-nums tracking-tight">{data.totalWordCount.toLocaleString()}</div>
                        <div className="text-[9px] text-[#555] font-mono font-bold uppercase tracking-widest mt-1">Total Words</div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-[#333] px-6 py-3 flex flex-col items-end min-w-[140px]">
                        <div className="text-3xl font-black text-[#f5a623] leading-none tabular-nums tracking-tight">{data.activeDays}</div>
                        <div className="text-[9px] text-[#555] font-mono font-bold uppercase tracking-widest mt-1">Active Days</div>
                    </div>
                </div>
            </div>

            {/* --- TOP ROW: KPIs --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    label="Current Velocity" 
                    value={Math.round(data.avg30Day)} 
                    sub="Words / Day (30d Avg)" 
                    icon={TrendingUp} 
                    highlight 
                    trend={((data.avg30Day - data.lifetimeAvg) / (data.lifetimeAvg || 1)) * 100}
                />
                <KPICard 
                    label="Consistency Streak" 
                    value={data.currentStreak} 
                    sub={`Longest: ${data.longestStreak} Days`} 
                    icon={Flame} 
                />
                <KPICard 
                    label="Goal Fidelity" 
                    value={`${data.goalFidelity}%`} 
                    sub="Days Target Met" 
                    icon={Target} 
                />
                <KPICard 
                    label="Est. Completion" 
                    value={data.forecastDate.toLocaleDateString(undefined, {month:'short', day:'numeric'}).toUpperCase()} 
                    sub={`${(data.remaining/1000).toFixed(1)}k words remaining`} 
                    icon={Hourglass} 
                />
            </div>

            {/* --- SECTION A: OUTPUT VELOCITY --- */}
            <div>
                <SectionHeader title="A. OUTPUT VELOCITY" icon={Activity} />
                <div className="bg-[#0a0a0a] border border-[#333] p-6 h-[350px] relative">
                    <ResponsiveContainer>
                        <ComposedChart data={historyChartData}>
                            <defs>
                                <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f5a623" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#f5a623" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                            <XAxis dataKey="date" stroke="#444" tick={{fontSize: 9, fontFamily: 'monospace'}} tickLine={false} axisLine={false} dy={10} />
                            <YAxis yAxisId="left" stroke="#444" tick={{fontSize: 9, fontFamily: 'monospace'}} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="right" orientation="right" stroke="#444" tick={{fontSize: 9}} tickLine={false} axisLine={false} hide />
                            <Tooltip 
                                content={<CustomInsightTooltip insight="Peaks indicate flow states. Aim for consistent plateaus rather than spikes." />}
                                cursor={{fill: '#1a1a1a'}} 
                            />
                            <Area yAxisId="left" type="monotone" dataKey="daily" stroke="#f5a623" fill="url(#colorDaily)" strokeWidth={2} />
                            <Line yAxisId="left" type="monotone" dataKey="goal" stroke="#444" strokeDasharray="4 4" dot={false} strokeWidth={1} />
                            <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#555" strokeWidth={2} dot={false} opacity={0.5} />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div className="absolute top-4 right-4 flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-[#f5a623]"></div>
                            <span className="text-[9px] font-mono text-[#666] uppercase">Daily Output</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-[#555]"></div>
                            <span className="text-[9px] font-mono text-[#666] uppercase">Cumulative</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SECTION B: CONTINUOUS ACTIVITY MAP --- */}
            <div>
                <SectionHeader title="B. CONTINUOUS ACTIVITY MAP" icon={Calendar} />
                <div className="bg-[#0a0a0a] border border-[#333] p-6 overflow-x-auto custom-scrollbar flex gap-4">
                    
                    {/* Y-Axis Labels (Day of Week) */}
                    <div className="flex flex-col gap-1.5 pt-6 select-none shrink-0">
                        {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
                            <div key={i} className="h-4 flex items-center justify-end text-[9px] font-mono font-bold text-[#444]">{d}</div>
                        ))}
                    </div>

                    {/* Continuous Grid */}
                    <div className="flex-1 min-w-max">
                        {/* Month Headers */}
                        <div className="flex mb-2 h-4 relative">
                            {yearlyHeatmapData.map((week, wIdx) => (
                                <div 
                                    key={wIdx} 
                                    className={`w-4 mr-1.5 flex-shrink-0 relative ${week.addGap ? 'ml-8' : ''}`}
                                >
                                    {week.monthName && (
                                        <span className="absolute top-0 left-0 text-[9px] font-mono font-bold text-[#555] uppercase tracking-wider">
                                            {week.monthName}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* The Weeks */}
                        <div className="flex">
                            {yearlyHeatmapData.map((week, wIdx) => (
                                <div 
                                    key={wIdx} 
                                    className={`flex flex-col gap-1.5 w-4 mr-1.5 ${week.addGap ? 'ml-8' : ''}`}
                                >
                                    {week.days.map((day, dIdx) => (
                                        <div 
                                            key={day.date} 
                                            className={`w-4 h-4 transition-all duration-300 relative group rounded-[1px] ${
                                                day.isFuture ? 'bg-[#151515] opacity-50' : 
                                                day.count === 0 ? 'bg-[#151515] hover:bg-[#1a1a1a]' :
                                                day.count < 500 ? 'bg-[#1e3a2a]' : 
                                                day.count < 1000 ? 'bg-[#22c55e]/60' : 
                                                day.count < 2000 ? 'bg-[#22c55e]' : 
                                                'bg-[#f5a623]'
                                            }`}
                                            title={`${day.date}: ${day.count} words`}
                                        >
                                            {day.count > 0 && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#111] border border-[#333] px-2 py-1 text-[9px] font-bold text-white whitespace-nowrap z-50">
                                                    {new Date(day.date).toLocaleDateString()} • {day.count}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SECTION C: TIME INTELLIGENCE --- */}
            <div>
                <SectionHeader title="C. TEMPORAL INTELLIGENCE" icon={Clock} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* C.1 Day of Week */}
                    <div className="bg-[#0a0a0a] border border-[#333] p-6 h-[300px]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-mono font-bold text-[#555] uppercase tracking-widest">Weekly Output Rhythm</h3>
                        </div>
                        <ResponsiveContainer>
                            <BarChart data={data.dowData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                                <XAxis dataKey="day" stroke="#444" tick={{fontSize: 9, fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    content={<CustomInsightTooltip insight="Prioritize your highest output days for heavy lifting." />} 
                                    cursor={{fill: '#1a1a1a'}} 
                                />
                                <Bar dataKey="avg">
                                    {data.dowData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.avg > data.lifetimeAvg ? '#f5a623' : '#222'} stroke={entry.avg > data.lifetimeAvg ? '#f5a623' : 'none'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* C.2 Time of Day Heatmap (7x24 Matrix) */}
                    <div className="bg-[#0a0a0a] border border-[#333] p-6 h-[300px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-mono font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                                <Grid3X3 size={12} /> Circadian Punch Card (7-Day Cycle)
                            </h3>
                            {!data.hasVersionData && (
                                <span className="text-[9px] font-mono text-[#444] uppercase animate-pulse">Simulation Data Active</span>
                            )}
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-between select-none">
                            {/* Header: Hours */}
                            <div className="flex ml-8 text-[8px] font-mono text-[#444] justify-between px-1 mb-1">
                                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                            </div>

                            {/* Matrix */}
                            <div className="flex-1 flex flex-col justify-between gap-[2px]">
                                {data.circadianGrid.map((row, dayIdx) => (
                                    <div key={dayIdx} className="flex items-center gap-2">
                                        <span className="w-6 text-[9px] font-mono font-bold text-[#444] uppercase">{DAYS_OF_WEEK[dayIdx].substring(0,3)}</span>
                                        <div className="flex-1 grid grid-cols-[repeat(24,1fr)] gap-[2px] h-full">
                                            {row.map((count, hour) => {
                                                const intensity = Math.min(1, count / (data.maxHourlyActivity || 1));
                                                let bgColor = '#151515';
                                                if (count > 0) {
                                                    bgColor = `rgba(245, 166, 35, ${0.1 + (intensity * 0.9)})`;
                                                }

                                                return (
                                                    <div 
                                                        key={hour}
                                                        className="h-full w-full relative group cursor-crosshair transition-all duration-300"
                                                        style={{ backgroundColor: bgColor }}
                                                        title={`${DAYS_OF_WEEK[dayIdx]} @ ${hour}:00 - ${count} events`}
                                                    >
                                                        {/* Tooltip on Hover */}
                                                        {count > 0 && (
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex bg-[#111] border border-[#f5a623] text-white text-[9px] font-bold px-2 py-1 z-50 whitespace-nowrap">
                                                                {hour}:00 • {count} edits
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SECTION D: METRICS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* D.1 Burnout Risk */}
                <div className="bg-[#0a0a0a] border border-[#333] p-6">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-2">
                            <Thermometer size={14} className="text-[#f5a623]" />
                            <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Burnout Load</h3>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 border ${data.avg30Day > 2500 ? 'text-red-500 border-red-900 bg-red-900/10' : 'text-green-500 border-green-900 bg-green-900/10'}`}>
                            {data.avg30Day > 2500 ? 'HIGH LOAD' : 'OPTIMAL'}
                        </span>
                    </div>
                    
                    <div className="flex items-center justify-center py-4 relative">
                        {/* Custom Gauge SVG */}
                        <svg className="w-48 h-24 overflow-visible">
                            <defs>
                                <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#22c55e" />
                                    <stop offset="50%" stopColor="#f5a623" />
                                    <stop offset="100%" stopColor="#ef4444" />
                                </linearGradient>
                            </defs>
                            <path d="M 10 100 A 80 80 0 0 1 170 100" fill="none" stroke="#222" strokeWidth="12" strokeLinecap="butt" />
                            <path 
                                d="M 10 100 A 80 80 0 0 1 170 100" 
                                fill="none" 
                                stroke="url(#gaugeGradient)" 
                                strokeWidth="12" 
                                strokeLinecap="butt"
                                strokeDasharray="251"
                                strokeDashoffset={251 - (251 * Math.min(100, (data.avg30Day / 3000) * 100)) / 100}
                                className="transition-all duration-1000 ease-out"
                            />
                            {/* Needle */}
                            <g transform={`translate(90, 100) rotate(${(Math.min(100, (data.avg30Day / 3000) * 100) / 100 * 180) - 90})`}>
                                <path d="M 0 -75 L -4 0 L 4 0 Z" fill="#fff" />
                                <circle cx="0" cy="0" r="4" fill="#fff" />
                            </g>
                        </svg>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-[#555] mt-2 uppercase">
                        <span>Idle</span>
                        <span>Max Load</span>
                    </div>
                </div>

                {/* D.2 Revision Density */}
                <div className="bg-[#0a0a0a] border border-[#333] p-6 flex flex-col justify-center gap-6">
                    <div className="flex items-center gap-2 mb-2">
                        <GitCommit size={14} className="text-pink-500" />
                        <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Iterative Depth</h3>
                    </div>
                    
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-2">
                                <span className="uppercase">Rewrite Ratio</span>
                                <span className="text-white font-bold">{data.revisionDensity} v/beat</span>
                            </div>
                            <div className="h-1.5 bg-[#222] overflow-hidden">
                                <div className="h-full bg-pink-500" style={{width: `${Math.min(100, parseFloat(data.revisionDensity) * 10)}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-2">
                                <span className="uppercase">Structural Stability</span>
                                <span className="text-white font-bold">{Math.round((beats.filter(b => b.status === 'ready').length / Math.max(1, beats.length)) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-[#222] overflow-hidden">
                                <div className="h-full bg-blue-500" style={{width: `${(beats.filter(b => b.status === 'ready').length / Math.max(1, beats.length)) * 100}%`}}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* D.3 Story Thread */}
                <div className="bg-[#0a0a0a] border border-[#333] p-6 h-[250px] relative">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <Split size={14} className="text-purple-500" />
                            <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Narrative Threads</h3>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={threadData.data}
                            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="threadGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                            <XAxis dataKey="name" stroke="#444" tick={{fontSize: 9, fontFamily: 'monospace'}} />
                            <Tooltip 
                                content={<CustomInsightTooltip insight="Ensure subplots are evenly distributed." />}
                            />
                            {threadData.colors.map((color, i) => (
                                <Area 
                                    key={color} 
                                    type="monotone" 
                                    dataKey={color} 
                                    stackId="1" 
                                    stroke="none" 
                                    fill={color} 
                                    fillOpacity={0.8}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

            </div>

            {/* --- SECTION E: CAST NETWORK TOPOLOGY --- */}
            <div>
                <SectionHeader title="E. CAST NETWORK TOPOLOGY" icon={Network} />
                <div className="bg-[#0a0a0a] border border-[#333] p-1">
                    <CharacterGraph characterData={characterData} />
                </div>
            </div>

            {/* --- FOOTER FORECAST --- */}
            <div className="mt-8 border-t border-[#f5a623] bg-[#0a0a0a] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="relative z-10">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        STRATEGIC FORECAST <span className="text-[#f5a623]">///</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-2 max-w-lg font-mono leading-relaxed">
                        BASED ON A ROLLING 30-DAY VELOCITY OF <span className="text-white font-bold">{Math.round(data.avg30Day)} WPD</span>.
                        <br/> MAINTAIN PACE TO REACH TERMINAL VELOCITY.
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[9px] font-bold text-[#f5a623] uppercase tracking-widest mb-1 font-mono">Projected Completion</div>
                    <div className="text-5xl font-black text-white tracking-tighter">
                        {data.forecastDate.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'}).toUpperCase()}
                    </div>
                    <div className="text-[10px] text-[#444] font-mono mt-1 uppercase">
                        {new Date().getFullYear()}
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default StatisticsView;
