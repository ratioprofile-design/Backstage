import React, { useState, useMemo } from 'react';
import { ViewMode, AppTask, TaskModificationHistory } from '../../types';
import { 
  Inbox, CheckCircle2, Clock, AlertCircle, Play, Filter, Search, 
  ArrowRight, Plus, X, MessageSquare, History, User, Tag, Film,
  Layers, ChevronDown, ChevronUp, Trash2, Check, RefreshCw,
  LayoutGrid, List, SlidersHorizontal, ArrowUpDown, ExternalLink,
  ShieldAlert, Sparkles, CheckSquare, Calendar, Building2,
  ChevronLeft, ChevronRight, BarChart3, AlertTriangle, ArrowUpRight
} from 'lucide-react';

interface InboxViewProps {
  tasks: AppTask[];
  onNavigateToView: (view: ViewMode) => void;
  onUpdateTask: (updatedTask: AppTask) => void;
  onAddTask: (newTask: AppTask) => void;
  onDeleteTask: (taskId: string) => void;
}

const TARGET_VIEW_LABELS: Record<string, string> = {
  script: 'Script View',
  crew: 'Crew Workspace',
  breakdown: 'Breakdown Page',
  casting: 'Casting & Extras',
  shotlist: 'Shot Division',
  schedule: 'Scheduling',
  storyboard: 'Storyboard',
  board: 'Story Board',
  goals: 'Production Goals',
  backstage: 'Backstage Hub',
  statistics: 'Statistics & Analytics',
  inbox: 'Inbox'
};

export const InboxView: React.FC<InboxViewProps> = ({
  tasks,
  onNavigateToView,
  onUpdateTask,
  onAddTask,
  onDeleteTask
}) => {
  // Sidebar Quick Filter State
  const [quickFilter, setQuickFilter] = useState<'all' | 'my' | 'high' | 'unread' | 'due' | 'history'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedTargetView, setSelectedTargetView] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'department' | 'status'>('deadline');

  // Display Mode: List, Kanban, Calendar, Gantt, or Notion Feed
  const [displayLayout, setDisplayLayout] = useState<'list' | 'kanban' | 'calendar' | 'gantt' | 'history_feed'>('list');

  // Calendar state (August 2026 default)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(7); // 0-indexed: 7 = August

  // Expanded task ID for inline Notion history
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<{ [taskId: string]: string }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Departments configuration
  const departments = [
    { id: 'all', label: 'All Departments' },
    { id: 'direction', label: 'Direction' },
    { id: 'camera', label: 'Camera' },
    { id: 'art', label: 'Art & Set Design' },
    { id: 'props', label: 'Props' },
    { id: 'stunts', label: 'Stunts & SFX' },
    { id: 'sound', label: 'Sound & Audio' },
    { id: 'costume', label: 'Costume & Makeup' },
    { id: 'production', label: 'Production & Logistics' },
    { id: 'casting', label: 'Casting & Extras' },
    { id: 'vfx', label: 'VFX & Post' },
  ];

  const targetViewsList: { id: ViewMode | 'all'; label: string }[] = [
    { id: 'all', label: 'All Pages' },
    { id: 'script', label: 'Script View' },
    { id: 'crew', label: 'Crew Workspace' },
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'casting', label: 'Casting' },
    { id: 'shotlist', label: 'Shot Division' },
    { id: 'schedule', label: 'Scheduling' },
    { id: 'storyboard', label: 'Storyboard' },
    { id: 'board', label: 'Board' },
  ];

  // Aggregate global Notion history feed across all tasks
  const allHistoryFeed = useMemo(() => {
    const feed: { task: AppTask; historyItem: TaskModificationHistory }[] = [];
    tasks.forEach(task => {
      task.history.forEach(item => {
        feed.push({ task, historyItem: item });
      });
    });
    return feed;
  }, [tasks]);

  // Filter tasks based on search & filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Quick Sidebar Filter
      if (quickFilter === 'my') {
        const isMyTask = task.owner.toLowerCase().includes('karthik') || 
                         task.owner.toLowerCase().includes('director') || 
                         task.owner.toLowerCase().includes('me') ||
                         task.owner.toLowerCase().includes('lead');
        if (!isMyTask) return false;
      } else if (quickFilter === 'high') {
        if (task.priority !== 'Critical' && task.priority !== 'High') return false;
      } else if (quickFilter === 'unread') {
        if (task.isRead) return false;
      } else if (quickFilter === 'due') {
        if (task.status === 'Completed') return false;
      }

      // Department Filter
      if (selectedDept !== 'all' && task.departmentId !== selectedDept) return false;

      // Target View Filter
      if (selectedTargetView !== 'all' && task.targetView !== selectedTargetView) return false;

      // Status Filter
      if (selectedStatus !== 'all' && task.status !== selectedStatus) return false;

      // Priority Filter
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchOwner = task.owner.toLowerCase().includes(q);
        const matchDept = (task.departmentName || task.departmentId).toLowerCase().includes(q);
        const matchScene = (task.relatedScene || '').toLowerCase().includes(q);
        const matchNotes = (task.notes || '').toLowerCase().includes(q);
        return matchTitle || matchOwner || matchDept || matchScene || matchNotes;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'deadline') {
        return a.deadline.localeCompare(b.deadline);
      }
      if (sortBy === 'priority') {
        const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sortBy === 'status') {
        const statusOrder = { 'In Progress': 0, 'To Do': 1, Review: 2, Completed: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return (a.departmentName || a.departmentId).localeCompare(b.departmentName || b.departmentId);
    });
  }, [tasks, quickFilter, selectedDept, selectedTargetView, selectedStatus, selectedPriority, searchQuery, sortBy]);

  // Deadline Groupings
  const deadlineGroups = useMemo(() => {
    const today = '2026-08-05'; // Reference current date
    const overdue: AppTask[] = [];
    const todayTasks: AppTask[] = [];
    const thisWeek: AppTask[] = [];
    const upcoming: AppTask[] = [];

    filteredTasks.forEach(task => {
      if (task.status === 'Completed') {
        upcoming.push(task);
        return;
      }
      if (task.deadline < today) {
        overdue.push(task);
      } else if (task.deadline === today) {
        todayTasks.push(task);
      } else if (task.deadline <= '2026-08-12') {
        thisWeek.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return { overdue, todayTasks, thisWeek, upcoming };
  }, [filteredTasks]);

  // Counts
  const totalCount = tasks.length;
  const unreadCount = tasks.filter(t => !t.isRead).length;
  const criticalCount = tasks.filter(t => t.priority === 'Critical' || t.priority === 'High').length;
  const toDoCount = tasks.filter(t => t.status === 'To Do').length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const reviewCount = tasks.filter(t => t.status === 'Review').length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  const handleStatusChange = (task: AppTask, newStatus: AppTask['status']) => {
    if (task.status === newStatus) return;
    const oldStatus = task.status;
    const newHistoryItem: TaskModificationHistory = {
      id: `h-${Date.now()}`,
      timestamp: 'Just now',
      author: 'Current User',
      changeType: 'status_change',
      fieldChanged: 'Status',
      oldValue: oldStatus,
      newValue: newStatus,
      comment: `Updated status from ${oldStatus} to ${newStatus}`
    };

    const updated: AppTask = {
      ...task,
      status: newStatus,
      isRead: true,
      history: [newHistoryItem, ...task.history]
    };

    onUpdateTask(updated);
  };

  const handleAddComment = (task: AppTask) => {
    const text = newCommentText[task.id];
    if (!text || !text.trim()) return;

    const newHistoryItem: TaskModificationHistory = {
      id: `h-${Date.now()}`,
      timestamp: 'Just now',
      author: 'Current User',
      changeType: 'comment',
      comment: text.trim()
    };

    const updated: AppTask = {
      ...task,
      history: [newHistoryItem, ...task.history]
    };

    onUpdateTask(updated);
    setNewCommentText(prev => ({ ...prev, [task.id]: '' }));
  };

  const handleMarkAllRead = () => {
    tasks.forEach(t => {
      if (!t.isRead) {
        onUpdateTask({ ...t, isRead: true });
      }
    });
  };

  // Calendar Helper Days Generation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const days = [];
    // Padding before day 1
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasks.filter(t => t.deadline === dayStr);
      days.push({ dayNumber: d, dateStr: dayStr, dayTasks });
    }
    return days;
  }, [currentYear, currentMonth, tasks]);

  // Gantt Timeline Dates (August 1 to August 20, 2026)
  const ganttDays = useMemo(() => {
    const dates = [];
    for (let d = 1; d <= 22; d++) {
      const dateStr = `2026-08-${String(d).padStart(2, '0')}`;
      dates.push({ dayNumber: d, dateStr, label: `Aug ${d}` });
    }
    return dates;
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-60px)] bg-[#0c0c0e] text-white">
      
      {/* LEFT SIDEBAR: FILTERS & DEPARTMENTS */}
      <div className="w-full lg:w-72 bg-[#121215] border-r border-[#222227] p-4 flex flex-col gap-5 shrink-0 overflow-y-auto custom-scrollbar">
        
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-[#222227] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Inbox size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Production Inbox
              </h2>
              <p className="text-[11px] text-gray-400 font-mono">
                {totalCount} Active Tasks
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-transform hover:scale-105 font-bold shadow"
            title="Create Task"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* QUICK SMART VIEWS */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider block px-2 mb-1">
            Smart Filters
          </label>

          <button
            onClick={() => { setQuickFilter('all'); if (displayLayout === 'history_feed') setDisplayLayout('list'); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'all' && displayLayout !== 'history_feed'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-gray-300 hover:bg-[#1a1a1f] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Inbox size={15} />
              <span>All Tasks</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e24] border border-[#333]">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => { setQuickFilter('due'); setDisplayLayout('list'); setSortBy('deadline'); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'due'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-gray-300 hover:bg-[#1a1a1f] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-amber-400" />
              <span>Upcoming Deadlines</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e24] text-amber-400 border border-[#333]">
              {tasks.filter(t => t.status !== 'Completed').length}
            </span>
          </button>

          <button
            onClick={() => { setQuickFilter('my'); setDisplayLayout('list'); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'my'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-gray-300 hover:bg-[#1a1a1f] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <User size={15} />
              <span>Assigned to Me</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e24] border border-[#333]">
              {tasks.filter(t => t.owner.toLowerCase().includes('karthik') || t.owner.toLowerCase().includes('director')).length}
            </span>
          </button>

          <button
            onClick={() => { setQuickFilter('high'); setDisplayLayout('list'); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'high'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-gray-300 hover:bg-[#1a1a1f] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert size={15} className="text-red-400" />
              <span>Critical & High</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e24] text-red-400 border border-[#333]">
              {criticalCount}
            </span>
          </button>

          <button
            onClick={() => { setQuickFilter('unread'); setDisplayLayout('list'); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'unread'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-gray-300 hover:bg-[#1a1a1f] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-amber-400" />
              <span>Unread Updates</span>
            </div>
            {unreadCount > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-black shadow">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setDisplayLayout('history_feed'); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              displayLayout === 'history_feed'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-gray-300 hover:bg-[#1a1a1f] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <History size={15} />
              <span>Notion History Stream</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e24] border border-[#333]">
              {allHistoryFeed.length}
            </span>
          </button>
        </div>

        {/* DEPARTMENT CATEGORIES FILTER */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 mb-1">
            <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">
              Departments
            </label>
            {selectedDept !== 'all' && (
              <button onClick={() => setSelectedDept('all')} className="text-[10px] text-amber-400 hover:underline">
                Reset
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {departments.map(dept => {
              const deptCount = dept.id === 'all' 
                ? tasks.length 
                : tasks.filter(t => t.departmentId === dept.id).length;

              return (
                <button
                  key={dept.id}
                  onClick={() => { setSelectedDept(dept.id); if (displayLayout === 'history_feed') setDisplayLayout('list'); }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                    selectedDept === dept.id
                      ? 'bg-[#22222a] text-amber-400 font-bold border border-[#383845]'
                      : 'text-gray-400 hover:bg-[#16161b] hover:text-gray-200'
                  }`}
                >
                  <span className="truncate">{dept.label}</span>
                  <span className="text-[10px] text-gray-500 bg-[#121215] px-1.5 py-0.5 rounded border border-[#222]">
                    {deptCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TARGET PAGE LINK FILTER */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider block px-2 mb-1">
            Filter Source Page
          </label>
          <select
            value={selectedTargetView}
            onChange={(e) => setSelectedTargetView(e.target.value)}
            className="w-full bg-[#18181d] text-gray-300 text-xs border border-[#2e2e36] p-2 rounded-xl outline-none font-mono focus:border-amber-500 cursor-pointer"
          >
            {targetViewsList.map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* STATUS METRICS SUMMARY */}
        <div className="mt-auto pt-4 border-t border-[#222227] space-y-2">
          <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider block">
            Status Breakdown
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-[#18181c] border border-[#26262c] p-2 rounded-xl text-center">
              <span className="text-[10px] text-gray-400 block">To Do</span>
              <strong className="text-blue-400 text-sm">{toDoCount}</strong>
            </div>
            <div className="bg-[#18181c] border border-[#26262c] p-2 rounded-xl text-center">
              <span className="text-[10px] text-gray-400 block">In Progress</span>
              <strong className="text-amber-400 text-sm">{inProgressCount}</strong>
            </div>
            <div className="bg-[#18181c] border border-[#26262c] p-2 rounded-xl text-center">
              <span className="text-[10px] text-gray-400 block">Review</span>
              <strong className="text-purple-400 text-sm">{reviewCount}</strong>
            </div>
            <div className="bg-[#18181c] border border-[#26262c] p-2 rounded-xl text-center">
              <span className="text-[10px] text-gray-400 block">Completed</span>
              <strong className="text-emerald-400 text-sm">{completedCount}</strong>
            </div>
          </div>
        </div>

      </div>

      {/* MAIN VIEW CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e11]">
        
        {/* TOP SEARCH & ACTION TOOLBAR */}
        <div className="p-4 sm:p-5 bg-[#141418] border-b border-[#222227] flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: Search & Filter Pills */}
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, assignees, department, scenes..."
                className="w-full bg-[#0a0a0c] border border-[#2b2b32] text-white text-xs pl-10 pr-4 py-2 rounded-xl outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="hidden md:block bg-[#1a1a20] text-gray-300 text-xs border border-[#2b2b32] px-3 py-2 rounded-xl font-mono outline-none cursor-pointer hover:border-amber-500"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Sort Dropdown */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#1a1a20] border border-[#2b2b32] px-3 py-1.5 rounded-xl text-xs font-mono">
              <ArrowUpDown size={13} className="text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-gray-200 outline-none cursor-pointer"
              >
                <option value="deadline">Due Date (Earliest First)</option>
                <option value="priority">Priority First</option>
                <option value="status">Status</option>
                <option value="department">Department</option>
              </select>
            </div>
          </div>

          {/* Right: Layout Switcher & Action Buttons */}
          <div className="flex items-center gap-3">
            
            {/* Display Mode Toggle Tabs */}
            <div className="flex items-center bg-[#1a1a20] p-1 rounded-xl border border-[#2b2b32] text-xs font-bold">
              <button
                onClick={() => setDisplayLayout('list')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  displayLayout === 'list' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="List View"
              >
                <List size={15} />
                <span className="hidden xl:inline">List</span>
              </button>

              <button
                onClick={() => setDisplayLayout('kanban')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  displayLayout === 'kanban' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="Kanban Board View"
              >
                <LayoutGrid size={15} />
                <span className="hidden xl:inline">Kanban</span>
              </button>

              <button
                onClick={() => setDisplayLayout('calendar')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  displayLayout === 'calendar' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="Calendar Deadlines View"
              >
                <Calendar size={15} />
                <span className="hidden xl:inline">Calendar</span>
              </button>

              <button
                onClick={() => setDisplayLayout('gantt')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  displayLayout === 'gantt' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="Gantt Timeline View"
              >
                <BarChart3 size={15} />
                <span className="hidden xl:inline">Gantt</span>
              </button>

              <button
                onClick={() => setDisplayLayout('history_feed')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  displayLayout === 'history_feed' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="Notion Modification Stream"
              >
                <History size={15} />
                <span className="hidden xl:inline">History</span>
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-gray-300 hover:text-amber-400 font-mono px-3 py-2 rounded-xl bg-[#1e1e24] border border-[#333] transition-colors"
              >
                Mark Read
              </button>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>

        </div>

        {/* FEED / LIST / KANBAN / CALENDAR / GANTT CONTAINER */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* VIEW 1: LIST VIEW WITH UPCOMING DEADLINE SECTIONS */}
          {displayLayout === 'list' && (
            <div className="space-y-6">
              
              {/* UPCOMING DEADLINES SUMMARY RIBBON */}
              {quickFilter === 'due' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-red-400 uppercase block">Overdue</span>
                      <strong className="text-xl font-bold text-white">{deadlineGroups.overdue.length} Tasks</strong>
                    </div>
                    <AlertTriangle size={24} className="text-red-400" />
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase block">Due Today</span>
                      <strong className="text-xl font-bold text-white">{deadlineGroups.todayTasks.length} Tasks</strong>
                    </div>
                    <Clock size={24} className="text-amber-400" />
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-blue-400 uppercase block">This Week</span>
                      <strong className="text-xl font-bold text-white">{deadlineGroups.thisWeek.length} Tasks</strong>
                    </div>
                    <Calendar size={24} className="text-blue-400" />
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase block">Later / Upcoming</span>
                      <strong className="text-xl font-bold text-white">{deadlineGroups.upcoming.length} Tasks</strong>
                    </div>
                    <CheckCircle2 size={24} className="text-emerald-400" />
                  </div>
                </div>
              )}

              {filteredTasks.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-[#26262c] rounded-2xl bg-[#121215]/50">
                  <Inbox size={42} className="mx-auto text-gray-600 mb-3" />
                  <h3 className="text-sm font-bold text-gray-300">No tasks found matching your filter</h3>
                  <p className="text-xs text-gray-500 mt-1">Try clearing your search query or department filters</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const isExpanded = expandedTaskId === task.id;
                  const targetLabel = TARGET_VIEW_LABELS[task.targetView] || 'Target Page';

                  return (
                    <div
                      key={task.id}
                      className={`bg-[#141418] border rounded-2xl transition-all ${
                        !task.isRead 
                          ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,166,35,0.06)]' 
                          : 'border-[#222227] hover:border-[#383842]'
                      }`}
                    >
                      {/* CARD HEADER */}
                      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5 flex-1 min-w-0">
                          
                          {/* Status Icon Indicator */}
                          <button
                            onClick={() => {
                              const statusFlow: AppTask['status'][] = ['To Do', 'In Progress', 'Review', 'Completed'];
                              const nextIdx = (statusFlow.indexOf(task.status) + 1) % statusFlow.length;
                              handleStatusChange(task, statusFlow[nextIdx]);
                            }}
                            className={`mt-0.5 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-transform hover:scale-105 ${
                              task.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                              task.status === 'In Progress' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                              task.status === 'Review' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' :
                              'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            }`}
                            title="Click to advance status"
                          >
                            {task.status === 'Completed' ? <CheckCircle2 size={18} /> :
                             task.status === 'In Progress' ? <Play size={16} /> :
                             task.status === 'Review' ? <AlertCircle size={18} /> :
                             <Clock size={18} />}
                          </button>

                          <div className="space-y-2 flex-1 min-w-0">
                            {/* Badges Bar */}
                            <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                              
                              {/* Source Page Badge */}
                              <button
                                onClick={() => onNavigateToView(task.targetView)}
                                className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/25 transition-all flex items-center gap-1 group/btn"
                                title={`Navigates directly to ${targetLabel}`}
                              >
                                <span className="text-gray-400 font-normal">Source:</span>
                                <span>{targetLabel}</span>
                                <ArrowUpRight size={12} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                              </button>

                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#202026] text-gray-300 border border-[#333]">
                                {task.departmentName || task.departmentId}
                              </span>

                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                task.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                task.priority === 'High' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              }`}>
                                {task.priority} Priority
                              </span>

                              {task.relatedScene && (
                                <span className="text-[10px] text-gray-300 flex items-center gap-1 bg-[#1a1a20] px-2 py-0.5 rounded border border-[#333]">
                                  <Film size={11} className="text-amber-400" />
                                  {task.relatedScene}
                                </span>
                              )}

                              {!task.isRead && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                              )}
                            </div>

                            {/* Task Title & Direct Navigation */}
                            <h3 
                              onClick={() => onNavigateToView(task.targetView)}
                              className="text-base font-bold text-white leading-snug hover:text-amber-400 cursor-pointer transition-colors flex items-center gap-2 group/title"
                            >
                              <span>{task.title}</span>
                              <ExternalLink size={14} className="opacity-0 group-hover/title:opacity-100 text-amber-400 transition-opacity" />
                            </h3>

                            {task.notes && (
                              <p className="text-xs text-gray-400 font-sans line-clamp-2">
                                {task.notes}
                              </p>
                            )}

                            <div className="flex items-center gap-5 text-xs text-gray-400 font-mono pt-1">
                              <span className="flex items-center gap-1.5 text-gray-300">
                                <User size={13} className="text-amber-400" />
                                {task.owner}
                              </span>
                              <span className="flex items-center gap-1.5 bg-[#1a1a20] px-2.5 py-1 rounded-lg border border-[#2b2b32]">
                                <Calendar size={13} className="text-amber-400" />
                                Deadline: <strong className="text-amber-400">{task.deadline}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ACTIONS & DIRECT JUMP TO ORIGIN PAGE */}
                        <div className="flex items-center gap-2.5 flex-wrap justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#222]">
                          
                          {/* Quick Status Dropdown */}
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value as any)}
                            className="bg-[#1e1e24] text-amber-400 text-xs font-bold font-mono px-3 py-2 rounded-xl border border-[#333] outline-none cursor-pointer hover:border-amber-500"
                          >
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Review">Review</option>
                            <option value="Completed">Completed</option>
                          </select>

                          {/* DIRECT NAVIGATION BUTTON WITH CLEAR DESTINATION LABEL */}
                          <button
                            onClick={() => onNavigateToView(task.targetView)}
                            className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow group cursor-pointer"
                            title={`Jump to ${targetLabel}`}
                          >
                            <span>Open {targetLabel}</span>
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>

                          {/* Notion History Expand Button */}
                          <button
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            className={`px-3 py-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-mono ${
                              isExpanded 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500' 
                                : 'bg-[#1e1e24] text-gray-400 hover:text-white border-[#333]'
                            }`}
                            title="View Notion-style modification history"
                          >
                            <History size={14} />
                            <span>{task.history.length}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="p-2 text-gray-500 hover:text-red-400 rounded-xl hover:bg-[#202026] transition-colors"
                            title="Delete Task"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* NOTION-STYLE MODIFICATION HISTORY SECTION */}
                      {isExpanded && (
                        <div className="bg-[#0f0f12] border-t border-[#222227] p-4 sm:p-6 rounded-b-2xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                              <History size={15} />
                              <span>Notion-Style Modification History & Activity Log</span>
                            </h4>
                            <span className="text-[10px] font-mono text-gray-500">
                              {task.history.length} audit entries
                            </span>
                          </div>

                          {/* Add Note Input */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newCommentText[task.id] || ''}
                              onChange={(e) => setNewCommentText({ ...newCommentText, [task.id]: e.target.value })}
                              placeholder="Add a modification note or comment (e.g. Approved by Director)..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddComment(task);
                              }}
                              className="flex-1 bg-[#18181d] border border-[#2b2b34] text-white text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-amber-500 transition-colors"
                            />
                            <button
                              onClick={() => handleAddComment(task)}
                              className="bg-[#24242c] hover:bg-amber-500 text-gray-200 hover:text-black text-xs font-bold px-4 py-2.5 rounded-xl border border-[#3a3a46] transition-all flex items-center gap-1.5"
                            >
                              <MessageSquare size={14} /> Log Note
                            </button>
                          </div>

                          {/* Timeline of Changes */}
                          <div className="relative pl-5 border-l-2 border-[#26262e] space-y-3 pt-1">
                            {task.history.map((hist) => (
                              <div key={hist.id} className="relative group">
                                <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-amber-500/80 border-2 border-[#0f0f12]"></div>

                                <div className="bg-[#16161a] border border-[#24242a] rounded-xl p-3 space-y-1 text-xs">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-2 font-mono text-gray-300">
                                      <strong className="text-amber-400">{hist.author}</strong>
                                      {hist.fieldChanged && (
                                        <span className="text-gray-400">
                                          modified <strong className="text-white">{hist.fieldChanged}</strong>
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500">{hist.timestamp}</span>
                                  </div>

                                  {hist.oldValue && hist.newValue && (
                                    <div className="text-[11px] font-mono text-gray-400 flex items-center gap-2 pt-0.5">
                                      <span className="bg-[#222228] px-2 py-0.5 rounded text-red-400 line-through">
                                        {hist.oldValue}
                                      </span>
                                      <ArrowRight size={11} className="text-gray-500" />
                                      <span className="bg-[#222228] px-2 py-0.5 rounded text-emerald-400 font-bold">
                                        {hist.newValue}
                                      </span>
                                    </div>
                                  )}

                                  {hist.comment && (
                                    <p className="text-gray-300 font-sans pt-0.5 text-xs">
                                      "{hist.comment}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW 2: KANBAN BOARD VIEW */}
          {displayLayout === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(['To Do', 'In Progress', 'Review', 'Completed'] as const).map(statusCol => {
                const colTasks = filteredTasks.filter(t => t.status === statusCol);

                return (
                  <div key={statusCol} className="bg-[#141418] border border-[#222227] rounded-2xl p-4 flex flex-col space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222227]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          statusCol === 'To Do' ? 'bg-blue-400' :
                          statusCol === 'In Progress' ? 'bg-amber-400' :
                          statusCol === 'Review' ? 'bg-purple-400' : 'bg-emerald-400'
                        }`}></span>
                        <h4 className="text-xs font-bold text-white uppercase font-mono">
                          {statusCol}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono bg-[#202026] text-gray-400 px-2 py-0.5 rounded-full border border-[#333]">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1">
                      {colTasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-600 text-xs border border-dashed border-[#202026] rounded-xl">
                          Empty
                        </div>
                      ) : (
                        colTasks.map(task => {
                          const targetLabel = TARGET_VIEW_LABELS[task.targetView] || 'Source Page';
                          return (
                            <div
                              key={task.id}
                              className="bg-[#1a1a20] border border-[#2a2a32] hover:border-amber-500/50 p-3.5 rounded-xl space-y-2.5 transition-all shadow-sm group"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span className="text-amber-400 font-bold uppercase">
                                  {task.departmentName || task.departmentId}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded border ${
                                  task.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30'
                                }`}>
                                  {task.priority}
                                </span>
                              </div>

                              <h5 
                                onClick={() => onNavigateToView(task.targetView)}
                                className="text-xs font-bold text-white leading-snug hover:text-amber-400 cursor-pointer transition-colors"
                              >
                                {task.title}
                              </h5>

                              <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-gray-400">
                                <span>{task.owner}</span>
                                <button
                                  onClick={() => onNavigateToView(task.targetView)}
                                  className="text-amber-400 hover:underline flex items-center gap-1 font-bold text-[10px]"
                                  title={`Open ${targetLabel}`}
                                >
                                  <span>{targetLabel}</span>
                                  <ArrowUpRight size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 3: CALENDAR DEADLINES VIEW */}
          {displayLayout === 'calendar' && (
            <div className="space-y-4">
              
              {/* Calendar Month Header */}
              <div className="bg-[#141418] border border-[#222227] p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono uppercase">
                      Production Deadlines Calendar
                    </h3>
                    <p className="text-xs text-gray-400">
                      August 2026 Production Schedule & Deadlines
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <button 
                    onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)}
                    className="p-2 bg-[#1e1e24] hover:bg-[#282830] text-gray-300 rounded-xl border border-[#333]"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-bold text-amber-400 px-3">
                    {new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)}
                    className="p-2 bg-[#1e1e24] hover:bg-[#282830] text-gray-300 rounded-xl border border-[#333]"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono font-bold text-gray-500 uppercase">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((dayObj, index) => {
                  if (!dayObj) {
                    return <div key={`empty-${index}`} className="min-h-[110px] bg-[#121215]/30 border border-transparent rounded-xl"></div>;
                  }

                  const { dayNumber, dateStr, dayTasks } = dayObj;
                  const isToday = dateStr === '2026-08-05';

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[110px] bg-[#141418] border p-2 rounded-xl flex flex-col justify-between transition-all ${
                        isToday ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_12px_rgba(245,166,35,0.15)]' : 'border-[#222227]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono font-bold ${isToday ? 'text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded' : 'text-gray-400'}`}>
                          {dayNumber}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500 text-black font-bold">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-[75px] custom-scrollbar">
                        {dayTasks.map(t => {
                          const targetLabel = TARGET_VIEW_LABELS[t.targetView] || 'Page';
                          return (
                            <div
                              key={t.id}
                              onClick={() => onNavigateToView(t.targetView)}
                              className={`p-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all truncate border ${
                                t.status === 'Completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                t.priority === 'Critical' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
                                'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-black'
                              }`}
                              title={`${t.title} (${targetLabel}) - Click to open page`}
                            >
                              <div className="truncate">{t.title}</div>
                              <div className="text-[9px] opacity-75 font-normal truncate">{targetLabel}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* VIEW 4: GANTT TIMELINE VIEW */}
          {displayLayout === 'gantt' && (
            <div className="space-y-4">
              <div className="bg-[#141418] border border-[#222227] p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono uppercase">
                      Production Gantt Timeline
                    </h3>
                    <p className="text-xs text-gray-400">
                      Chronological task timelines and deadlines across all departments
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="flex items-center gap-1 text-red-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Critical</span>
                  <span className="flex items-center gap-1 text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> In Progress</span>
                  <span className="flex items-center gap-1 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed</span>
                </div>
              </div>

              {/* Gantt Timeline Container */}
              <div className="bg-[#141418] border border-[#222227] rounded-2xl overflow-x-auto custom-scrollbar">
                <div className="min-w-[900px]">
                  
                  {/* Timeline Header Row */}
                  <div className="grid grid-cols-[240px_1fr] border-b border-[#222227] bg-[#18181d]">
                    <div className="p-3 text-xs font-mono font-bold text-gray-400 uppercase border-r border-[#222227]">
                      Department / Task Title
                    </div>
                    <div className="grid grid-cols-22 divide-x divide-[#26262e] text-center text-[10px] font-mono text-gray-400 py-2">
                      {ganttDays.map(gDay => (
                        <div key={gDay.dateStr} className={`px-1 font-bold ${gDay.dateStr === '2026-08-05' ? 'text-amber-400 bg-amber-500/10' : ''}`}>
                          {gDay.dayNumber}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gantt Task Rows */}
                  <div className="divide-y divide-[#1e1e24]">
                    {filteredTasks.map(task => {
                      const dayNum = parseInt(task.deadline.split('-')[2] || '10', 10);
                      const targetLabel = TARGET_VIEW_LABELS[task.targetView] || 'Source Page';

                      return (
                        <div key={task.id} className="grid grid-cols-[240px_1fr] items-center hover:bg-[#1a1a20] transition-colors">
                          
                          {/* Task Info Left Column */}
                          <div className="p-3 border-r border-[#222227] space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-amber-400 font-bold uppercase">{task.departmentName || task.departmentId}</span>
                              <button 
                                onClick={() => onNavigateToView(task.targetView)}
                                className="text-gray-400 hover:text-amber-400 flex items-center gap-1 font-bold"
                                title={`Open ${targetLabel}`}
                              >
                                {targetLabel} <ArrowUpRight size={11} />
                              </button>
                            </div>
                            <div 
                              onClick={() => onNavigateToView(task.targetView)}
                              className="text-xs font-bold text-white truncate cursor-pointer hover:text-amber-400"
                            >
                              {task.title}
                            </div>
                          </div>

                          {/* Timeline Bar Right Column */}
                          <div className="relative h-12 flex items-center px-2">
                            {/* Marker line for deadline */}
                            <div 
                              className={`h-8 rounded-xl px-3 flex items-center justify-between text-xs font-mono font-bold cursor-pointer transition-all shadow-md hover:scale-[1.01] ${
                                task.status === 'Completed' ? 'bg-emerald-500 text-black' :
                                task.priority === 'Critical' ? 'bg-red-500 text-white' :
                                'bg-amber-500 text-black'
                              }`}
                              style={{
                                width: `${Math.max(15, (dayNum / 22) * 100)}%`
                              }}
                              onClick={() => onNavigateToView(task.targetView)}
                              title={`Click to open ${targetLabel}`}
                            >
                              <span className="truncate pr-2">{task.title}</span>
                              <span className="text-[10px] shrink-0 opacity-90">Due Aug {dayNum}</span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* VIEW 5: NOTION HISTORY STREAM */}
          {displayLayout === 'history_feed' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-[#141418] border border-[#222227] p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History size={18} className="text-amber-400" />
                    <span>Notion-Style Live Modification Stream</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Real-time timeline of all edits, status shifts, priority changes, and comments across all departments
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-[#1e1e24] px-3 py-1 rounded-xl border border-[#333]">
                  {allHistoryFeed.length} Events
                </span>
              </div>

              <div className="relative pl-6 border-l-2 border-[#2a2a32] space-y-4 pt-2">
                {allHistoryFeed.map(({ task, historyItem }, idx) => {
                  const targetLabel = TARGET_VIEW_LABELS[task.targetView] || 'Source Page';

                  return (
                    <div key={`${task.id}-${historyItem.id}-${idx}`} className="relative group">
                      <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-[#0e0e11] shadow-[0_0_8px_rgba(245,166,35,0.6)]"></div>

                      <div className="bg-[#141418] border border-[#26262c] hover:border-amber-500/40 rounded-2xl p-4 space-y-2 transition-all">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400 font-bold">{historyItem.author}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400">{historyItem.timestamp}</span>
                          </div>

                          <button
                            onClick={() => onNavigateToView(task.targetView)}
                            className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-bold"
                            title={`Jump directly to ${targetLabel}`}
                          >
                            <span>{task.title} ({targetLabel})</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>

                        {historyItem.fieldChanged && historyItem.oldValue && historyItem.newValue && (
                          <div className="text-xs font-mono text-gray-300 flex items-center gap-2 bg-[#0c0c0e] p-2.5 rounded-xl border border-[#222]">
                            <span>Updated {historyItem.fieldChanged}:</span>
                            <span className="text-red-400 line-through bg-[#1a1a20] px-2 py-0.5 rounded">{historyItem.oldValue}</span>
                            <ArrowRight size={12} className="text-gray-500" />
                            <span className="text-emerald-400 font-bold bg-[#1a1a20] px-2 py-0.5 rounded">{historyItem.newValue}</span>
                          </div>
                        )}

                        {historyItem.comment && (
                          <p className="text-xs text-gray-200 bg-[#1c1c22] p-3 rounded-xl border border-[#2d2d38] font-sans">
                            "{historyItem.comment}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[1100] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#161619] border border-[#333] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#2a2a30] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-amber-400" />
                <span>Create Production Task</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const dept = formData.get('dept') as string;
              const owner = formData.get('owner') as string;
              const priority = formData.get('priority') as any;
              const deadline = formData.get('deadline') as string;
              const targetView = formData.get('targetView') as any;
              const relatedScene = formData.get('relatedScene') as string;
              const notes = formData.get('notes') as string;

              if (title) {
                const newTask: AppTask = {
                  id: `inbox-tk-${Date.now()}`,
                  title,
                  departmentId: dept || 'direction',
                  departmentName: departments.find(c => c.id === dept)?.label || 'Direction',
                  owner: owner || 'Current User',
                  priority: priority || 'High',
                  deadline: deadline || '2026-08-10',
                  status: 'To Do',
                  targetView: targetView || 'crew',
                  relatedScene: relatedScene || '',
                  notes: notes || '',
                  isRead: true,
                  history: [{
                    id: `h-${Date.now()}`,
                    timestamp: 'Just now',
                    author: 'Current User',
                    changeType: 'created',
                    comment: 'Task created via Dedicated Inbox Page'
                  }]
                };

                onAddTask(newTask);
                setShowCreateModal(false);
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-mono font-bold">Task Title</label>
                <input name="title" required placeholder="e.g. Master Shot Anamorphic Lens Setup" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Department</label>
                  <select name="dept" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500">
                    <option value="direction">Direction</option>
                    <option value="camera">Camera</option>
                    <option value="art">Art & Set</option>
                    <option value="props">Props</option>
                    <option value="stunts">Stunts & SFX</option>
                    <option value="sound">Sound & Audio</option>
                    <option value="costume">Costume & Makeup</option>
                    <option value="production">Production</option>
                    <option value="casting">Casting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Assignee / HOD</label>
                  <input name="owner" placeholder="e.g. Tirru ISC" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Priority</label>
                  <select name="priority" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500">
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Source Page</label>
                  <select name="targetView" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500">
                    <option value="crew">Crew Workspace</option>
                    <option value="script">Script View</option>
                    <option value="breakdown">Breakdown</option>
                    <option value="casting">Casting</option>
                    <option value="shotlist">Shot Division</option>
                    <option value="schedule">Scheduling</option>
                    <option value="storyboard">Storyboard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Deadline Date</label>
                  <input type="date" name="deadline" defaultValue="2026-08-10" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500" />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono font-bold">Related Scene / Note</label>
                <input name="relatedScene" placeholder="e.g. Scene 14 - Night Action Sequence" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500" />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono font-bold">Notes / Requirements</label>
                <textarea name="notes" rows={2} placeholder="Detail requirements, gear specifications, or dependencies..." className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-xl outline-none focus:border-amber-500" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white font-mono">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default InboxView;
