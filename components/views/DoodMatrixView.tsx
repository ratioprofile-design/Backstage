import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Printer, Download, Search, Users, CalendarCheck, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DoodMatrixViewProps {
  onBack?: () => void;
}

export const DoodMatrixView: React.FC<DoodMatrixViewProps> = ({ onBack }) => {
  const { beats = [], characters = [], appTheme, appAccentColor = '#f5a623' } = useProject();
  const [searchTerm, setSearchTerm] = useState('');

  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  // Derive unique shooting days
  const shootingDays = useMemo(() => {
    const days = new Set<number>();
    beats.forEach((b, idx) => {
      const day = b.shootingDay || Math.ceil((idx + 1) / 3);
      days.add(day);
    });
    const sorted = Array.from(days).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : [1];
  }, [beats]);

  // Map unique cast members and the scenes/days they appear in
  const castMatrix = useMemo(() => {
    const castMap = new Map<string, { character: string; actorName?: string; days: Set<number>; scenes: string[] }>();

    // Seed from characters list if available
    characters.forEach((char) => {
      const name = char.name.trim();
      if (name && !castMap.has(name.toLowerCase())) {
        castMap.set(name.toLowerCase(), {
          character: name,
          actorName: char.actor || '',
          days: new Set<number>(),
          scenes: [],
        });
      }
    });

    // Populate from beat breakdown data
    beats.forEach((b, idx) => {
      const day = b.shootingDay || Math.ceil((idx + 1) / 3);
      const sceneLabel = b.sceneNumber ? `Sc ${b.sceneNumber}` : `Beat ${idx + 1}`;

      const castItems: string[] = [];
      if (b.breakdownData?.cast && Array.isArray(b.breakdownData.cast)) {
        b.breakdownData.cast.forEach((item: any) => {
          const name = typeof item === 'string' ? item : item?.name;
          if (name) castItems.push(name.trim());
        });
      }

      castItems.forEach((name) => {
        const key = name.toLowerCase();
        if (!castMap.has(key)) {
          castMap.set(key, {
            character: name,
            actorName: '',
            days: new Set<number>(),
            scenes: [],
          });
        }
        const record = castMap.get(key)!;
        record.days.add(day);
        if (!record.scenes.includes(sceneLabel)) {
          record.scenes.push(sceneLabel);
        }
      });
    });

    return Array.from(castMap.values());
  }, [beats, characters]);

  // Filtered cast
  const filteredCast = useMemo(() => {
    if (!searchTerm.trim()) return castMatrix;
    const term = searchTerm.toLowerCase();
    return castMatrix.filter((c) =>
      c.character.toLowerCase().includes(term) || (c.actorName && c.actorName.toLowerCase().includes(term))
    );
  }, [castMatrix, searchTerm]);

  // Determine DOOD code: SW, W, H, WF, SWF
  const getDoodCode = (day: number, activeDays: Set<number>, minDay: number, maxDay: number) => {
    if (minDay === maxDay && day === minDay) {
      return { code: 'SWF', color: '#ea580c', bg: isLight ? '#ffedd5' : 'rgba(234, 88, 12, 0.2)' }; // Start-Work-Finish
    }
    if (day === minDay) {
      return { code: 'SW', color: '#16a34a', bg: isLight ? '#dcfce7' : 'rgba(22, 163, 74, 0.2)' }; // Start Work
    }
    if (day === maxDay) {
      return { code: 'WF', color: '#dc2626', bg: isLight ? '#fee2e2' : 'rgba(220, 38, 38, 0.2)' }; // Work Finish
    }
    if (activeDays.has(day)) {
      return { code: 'W', color: '#2563eb', bg: isLight ? '#dbeafe' : 'rgba(37, 99, 235, 0.2)' }; // Work
    }
    if (day > minDay && day < maxDay) {
      return { code: 'H', color: '#9333ea', bg: isLight ? '#f3e8ff' : 'rgba(147, 51, 234, 0.2)' }; // Hold
    }
    return { code: '-', color: isLight ? '#cbd5e1' : '#475569', bg: 'transparent' };
  };

  // Export to Excel
  const handleExportExcel = () => {
    const headers = ['#', 'Character', 'Actor', ...shootingDays.map((d) => `Day ${d}`), 'Work Days', 'Hold Days', 'Total Days'];
    const rows = filteredCast.map((c, idx) => {
      const daysArray = Array.from(c.days) as number[];
      const minDay = daysArray.length ? Math.min(...daysArray) : 0;
      const maxDay = daysArray.length ? Math.max(...daysArray) : 0;

      let workDays = 0;
      let holdDays = 0;

      const dayCells = shootingDays.map((d) => {
        if (!daysArray.length) return '-';
        const { code } = getDoodCode(d, c.days, minDay, maxDay);
        if (['SW', 'W', 'WF', 'SWF'].includes(code)) workDays++;
        if (code === 'H') holdDays++;
        return code;
      });

      return [
        idx + 1,
        c.character,
        c.actorName || '',
        ...dayCells,
        workDays,
        holdDays,
        workDays + holdDays,
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DOOD Matrix');
    XLSX.writeFile(workbook, `Backstage_DOOD_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className={`w-full min-h-full p-6 font-sans ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0a0a] text-gray-100'}`}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`p-2 rounded-lg border transition-colors ${
                isLight ? 'bg-white hover:bg-slate-100 border-slate-200' : 'bg-[#18181b] hover:bg-[#27272a] border-[#333]'
              }`}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-black flex items-center gap-2 tracking-tight">
              <CalendarCheck className="text-[#f5a623]" size={22} />
              Day-Out-Of-Days (DOOD) Matrix
            </h1>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
              Standard cast work/hold scheduling matrix across shooting days
            </p>
          </div>
        </div>

        {/* Legend pills & action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">SW: Start Work</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">W: Work</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">H: Hold</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">WF: Work Finish</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">SWF: 1-Day</span>
          </div>

          <button
            onClick={handleExportExcel}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors ${
              isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#18181b] hover:bg-[#27272a] border-[#333] text-gray-200'
            }`}
          >
            <Download size={14} />
            Export Excel
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#f5a623] hover:bg-[#e09612] text-black flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer size={14} />
            Print DOOD
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border mb-6 print:hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#141416] border-[#27272a]'
      }`}>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search character or actor name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
              isLight ? 'bg-slate-50 border-slate-200 focus:border-[#f5a623]' : 'bg-[#1e1e24] border-[#333] focus:border-[#f5a623] text-white'
            }`}
          />
        </div>
        <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
          Showing <strong>{filteredCast.length}</strong> cast member{filteredCast.length === 1 ? '' : 's'} across <strong>{shootingDays.length}</strong> shooting day{shootingDays.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Printable Header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-black uppercase text-black tracking-wide">Cast Day-Out-Of-Days (DOOD) Report</h1>
        <p className="text-xs text-gray-600">Total Cast: {filteredCast.length} • Shooting Days: {shootingDays.length} • Generated by Backstage</p>
      </div>

      {/* DOOD Table */}
      <div className={`w-full overflow-x-auto rounded-xl border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#121215] border-[#27272a]'
      }`}>
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className={`text-[11px] font-black uppercase tracking-wider border-b ${
              isLight ? 'bg-slate-100/70 border-slate-200 text-slate-600' : 'bg-[#18181e] border-[#27272a] text-gray-400'
            }`}>
              <th className="py-3 px-3 w-12 text-center">#</th>
              <th className="py-3 px-4 min-w-[180px]">Character</th>
              <th className="py-3 px-4 min-w-[140px]">Actor</th>
              {shootingDays.map((day) => (
                <th key={day} className="py-3 px-2 text-center min-w-[50px] border-l border-r border-slate-200/40 dark:border-white/5">
                  Day {day}
                </th>
              ))}
              <th className="py-3 px-3 text-center w-20">Work</th>
              <th className="py-3 px-3 text-center w-20">Hold</th>
              <th className="py-3 px-3 text-center w-20 bg-amber-500/10 text-amber-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
            {filteredCast.length === 0 ? (
              <tr>
                <td colSpan={shootingDays.length + 6} className="py-12 text-center text-gray-400">
                  <Users className="mx-auto mb-2 opacity-40" size={32} />
                  <p className="font-bold">No cast members found</p>
                  <p className="text-xs mt-1">Add characters in Casting or tag cast in Breakdown to populate the DOOD matrix.</p>
                </td>
              </tr>
            ) : (
              filteredCast.map((c, idx) => {
                const daysArray = Array.from(c.days) as number[];
                const minDay = daysArray.length ? Math.min(...daysArray) : 0;
                const maxDay = daysArray.length ? Math.max(...daysArray) : 0;

                let workDays = 0;
                let holdDays = 0;

                return (
                  <tr
                    key={c.character}
                    className={`transition-colors hover:${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}
                  >
                    <td className="py-2.5 px-3 text-center text-[10px] font-mono text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-bold">
                      <div className="truncate max-w-[200px]" title={c.character}>
                        {c.character}
                      </div>
                      {c.scenes.length > 0 && (
                        <div className="text-[10px] font-normal text-gray-400 truncate max-w-[200px]">
                          {c.scenes.slice(0, 3).join(', ')}{c.scenes.length > 3 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400">
                      {c.actorName || <span className="italic opacity-50">Uncast</span>}
                    </td>

                    {shootingDays.map((day) => {
                      if (!daysArray.length) {
                        return (
                          <td key={day} className="py-2.5 px-2 text-center text-gray-300 dark:text-gray-600 border-l border-r border-slate-100 dark:border-white/5">
                            -
                          </td>
                        );
                      }

                      const { code, color, bg } = getDoodCode(day, c.days, minDay, maxDay);
                      if (['SW', 'W', 'WF', 'SWF'].includes(code)) workDays++;
                      if (code === 'H') holdDays++;

                      return (
                        <td
                          key={day}
                          className="py-2.5 px-2 text-center border-l border-r border-slate-100 dark:border-white/5"
                          style={{ backgroundColor: code !== '-' ? bg : undefined }}
                        >
                          <span
                            className="font-black text-[11px] font-mono"
                            style={{ color: code !== '-' ? color : undefined }}
                          >
                            {code}
                          </span>
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-3 text-center font-bold text-blue-500">
                      {workDays}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-purple-500">
                      {holdDays}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black bg-amber-500/5 text-amber-500">
                      {workDays + holdDays}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DoodMatrixView;
