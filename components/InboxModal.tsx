import React, { useState, useMemo } from 'react';
import { ViewMode, AppTask, TaskModificationHistory } from '../types';
import { TwoClickDeleteButton } from './views/CrewView';
import { 
  Inbox, CheckCircle2, Clock, AlertCircle, Play, Filter, Search, 
  ArrowRight, Plus, X, MessageSquare, History, User, Tag, Film,
  Layers, ChevronDown, ChevronUp, Trash2, Check, RefreshCw
} from 'lucide-react';

interface InboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToView: (view: ViewMode) => void;
  tasks: AppTask[];
  onUpdateTask: (updatedTask: AppTask) => void;
  onAddTask: (newTask: AppTask) => void;
  onDeleteTask: (taskId: string) => void;
}

// Default initial tasks if none passed
export const DEFAULT_INBOX_TASKS: AppTask[] = [
  {
    id: 'inbox-tk-1',
    title: 'Script & Director Breakdown for Scene 12 (EXT Night Police Station Chase)',
    departmentId: 'direction',
    departmentName: 'Direction',
    owner: 'Karthik Subbaraj (Director)',
    priority: 'Critical',
    deadline: '2026-08-03',
    status: 'In Progress',
    relatedScene: 'Scene 12',
    targetView: 'script',
    notes: 'Verify stunt cues and extra lighting setups with DOP prior to night call.',
    isRead: false,
    history: [
      {
        id: 'h-1',
        timestamp: '10 mins ago',
        author: 'Karthik Subbaraj',
        changeType: 'status_change',
        fieldChanged: 'Status',
        oldValue: 'To Do',
        newValue: 'In Progress',
        comment: 'Started director breakdown for Master Shot 12A.'
      },
      {
        id: 'h-2',
        timestamp: '2 hours ago',
        author: 'Santhosh Kumar (Line Producer)',
        changeType: 'priority_change',
        fieldChanged: 'Priority',
        oldValue: 'High',
        newValue: 'Critical',
        comment: 'Escalated priority due to weather forecast changes for night shoot.'
      },
      {
        id: 'h-3',
        timestamp: '1 day ago',
        author: 'System',
        changeType: 'created',
        comment: 'Task automatically created from Script breakdown.'
      }
    ]
  },
  {
    id: 'inbox-tk-2',
    title: '35mm Anamorphic Lens Package & A-Cam Camera Rigging',
    departmentId: 'camera',
    departmentName: 'Camera',
    owner: 'Tirru ISC (DOP)',
    priority: 'High',
    deadline: '2026-08-04',
    status: 'To Do',
    relatedScene: 'Scene 14',
    targetView: 'crew',
    notes: 'Confirm vintage Cooke Anamorphic set from rental supplier.',
    isRead: false,
    history: [
      {
        id: 'h-4',
        timestamp: '1 hour ago',
        author: 'Tirru ISC',
        changeType: 'comment',
        comment: 'Requested secondary focal lengths (40mm & 65mm) for tight closeups.'
      },
      {
        id: 'h-5',
        timestamp: '1 day ago',
        author: '1st AC Siva',
        changeType: 'assignment',
        comment: 'Assigned primary responsibility to DOP Tirru ISC.'
      }
    ]
  },
  {
    id: 'inbox-tk-3',
    title: 'Vintage Police Station Interior Set Construction & Distress Paint',
    departmentId: 'art',
    departmentName: 'Art & Set Design',
    owner: 'Kumar Gangappan (Production Designer)',
    priority: 'High',
    deadline: '2026-08-02',
    status: 'Review',
    relatedScene: 'Scene 12',
    targetView: 'breakdown',
    notes: 'Interrogation cell weathering complete. Waiting for Director approval.',
    isRead: true,
    history: [
      {
        id: 'h-6',
        timestamp: '25 mins ago',
        author: 'Kumar Gangappan',
        changeType: 'status_change',
        fieldChanged: 'Status',
        oldValue: 'In Progress',
        newValue: 'Review',
        comment: 'Submitted high-res photos of set distressing for HOD sign-off.'
      }
    ]
  },
  {
    id: 'inbox-tk-4',
    title: 'Rain Machine & Stunt Rappelling Harness Inspection',
    departmentId: 'stunts',
    departmentName: 'Stunts & SFX',
    owner: 'Stunt Master Supreme',
    priority: 'Critical',
    deadline: '2026-08-03',
    status: 'In Progress',
    relatedScene: 'Scene 18',
    targetView: 'crew',
    notes: 'Ensure double-lock carabiners for rooftop jump stunt sequence.',
    isRead: true,
    history: [
      {
        id: 'h-7',
        timestamp: '3 hours ago',
        author: 'Safety Officer',
        changeType: 'comment',
        comment: 'Rigging test completed successfully on mock scaffold.'
      }
    ]
  },
  {
    id: 'inbox-tk-5',
    title: 'Hero Revolver Armory Lockbox & Blank Firing License',
    departmentId: 'props',
    departmentName: 'Props',
    owner: 'Mani (Prop Master)',
    priority: 'High',
    deadline: '2026-08-01',
    status: 'Completed',
    relatedScene: 'Scene 12',
    targetView: 'breakdown',
    notes: 'Armorer on site with certified lockbox and blank ammunition.',
    isRead: true,
    history: [
      {
        id: 'h-8',
        timestamp: '40 mins ago',
        author: 'Mani',
        changeType: 'status_change',
        fieldChanged: 'Status',
        oldValue: 'Review',
        newValue: 'Completed',
        comment: 'Police commissioner NOC signed and handed over to Line Producer.'
      }
    ]
  },
  {
    id: 'inbox-tk-6',
    title: 'Background Police Extras Casting & Uniform Fittings (25 Pax)',
    departmentId: 'casting',
    departmentName: 'Casting',
    owner: 'Arun Kumar (1st AD)',
    priority: 'Medium',
    deadline: '2026-08-05',
    status: 'To Do',
    relatedScene: 'Scene 12',
    targetView: 'casting',
    notes: '25 male extras required for precinct hallway background activity.',
    isRead: false,
    history: [
      {
        id: 'h-9',
        timestamp: '4 hours ago',
        author: 'Arun Kumar',
        changeType: 'created',
        comment: 'Created extra casting requirement for Scene 12 hallway.'
      }
    ]
  },
  {
    id: 'inbox-tk-7',
    title: 'Location Permit & Traffic Clearance for Triplicane Night Shoot',
    departmentId: 'production',
    departmentName: 'Production & Logistics',
    owner: 'Santhosh Kumar (Line Producer)',
    priority: 'Critical',
    deadline: '2026-08-02',
    status: 'In Progress',
    relatedScene: 'Scene 14, 15',
    targetView: 'schedule',
    notes: 'Street closure approved between 10 PM and 4 AM.',
    isRead: false,
    history: [
      {
        id: 'h-10',
        timestamp: '1 hour ago',
        author: 'Location Scout',
        changeType: 'comment',
        comment: 'Local resident welfare association consent form signed.'
      }
    ]
  }
];

export const InboxModal: React.FC<InboxModalProps> = ({
  isOpen,
  onClose,
  onNavigateToView,
  tasks,
  onUpdateTask,
  onAddTask,
  onDeleteTask
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'history'>('tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<{ [taskId: string]: string }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Aggregate all history entries across tasks for Notion-style modification feed
  const allHistoryFeed = useMemo(() => {
    const feed: { task: AppTask; historyItem: TaskModificationHistory }[] = [];
    tasks.forEach(task => {
      task.history.forEach(item => {
        feed.push({ task, historyItem: item });
      });
    });
    return feed;
  }, [tasks]);

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'direction', label: 'Direction' },
    { id: 'camera', label: 'Camera' },
    { id: 'art', label: 'Art & Set' },
    { id: 'props', label: 'Props' },
    { id: 'stunts', label: 'Stunts & SFX' },
    { id: 'sound', label: 'Sound & Audio' },
    { id: 'costume', label: 'Costume & Makeup' },
    { id: 'production', label: 'Production' },
    { id: 'casting', label: 'Casting' },
    { id: 'vfx', label: 'VFX & Post' },
  ];

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (selectedCategory !== 'all' && task.departmentId !== selectedCategory) return false;
    if (selectedStatus !== 'all' && task.status !== selectedStatus) return false;
    if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;
    if (onlyMyTasks && !task.owner.toLowerCase().includes('karthik') && !task.owner.toLowerCase().includes('director') && !task.owner.toLowerCase().includes('me')) return false;

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
  });

  const unreadCount = tasks.filter(t => !t.isRead).length;

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

  const handlePriorityChange = (task: AppTask, newPriority: AppTask['priority']) => {
    if (task.priority === newPriority) return;
    const oldPriority = task.priority;
    const newHistoryItem: TaskModificationHistory = {
      id: `h-${Date.now()}`,
      timestamp: 'Just now',
      author: 'Current User',
      changeType: 'priority_change',
      fieldChanged: 'Priority',
      oldValue: oldPriority,
      newValue: newPriority,
      comment: `Updated priority from ${oldPriority} to ${newPriority}`
    };

    const updated: AppTask = {
      ...task,
      priority: newPriority,
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

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Container Drawer / Modal Card */}
      <div className="w-full max-w-5xl h-[90vh] bg-[#121215] border border-[#2c2c32] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* HEADER BAR */}
        <div className="p-4 sm:p-5 border-b border-[#26262c] bg-[#16161a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Inbox size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Central Inbox & Task Manager
                </h2>
                {unreadCount > 0 && (
                  <span className="bg-[#f5a623] text-black text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                All production tasks, direct page links, and Notion-style modification history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Tab Switcher */}
            <div className="flex items-center bg-[#202026] p-1 rounded-xl border border-[#333]">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'tasks' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <CheckCircle2 size={14} />
                <span>Tasks ({filteredTasks.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'history' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <History size={14} />
                <span>Modification History</span>
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-gray-400 hover:text-amber-400 font-mono px-2 py-1 rounded bg-[#1e1e24] border border-[#333] transition-colors"
                title="Mark all items as read"
              >
                Mark Read
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#25252b] rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="p-3 sm:p-4 bg-[#18181c] border-b border-[#25252b] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, assignees, scenes, notes..."
              className="w-full bg-[#0e0e11] border border-[#2d2d34] text-white pl-9 pr-3 py-1.5 rounded-xl outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Filters Group */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#202026] text-gray-300 border border-[#333] px-2.5 py-1.5 rounded-xl font-mono outline-none cursor-pointer hover:border-amber-500"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#202026] text-gray-300 border border-[#333] px-2.5 py-1.5 rounded-xl font-mono outline-none cursor-pointer hover:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Completed">Completed</option>
            </select>

            {/* Priority Dropdown */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-[#202026] text-gray-300 border border-[#333] px-2.5 py-1.5 rounded-xl font-mono outline-none cursor-pointer hover:border-amber-500"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* My Tasks Toggle */}
            <button
              onClick={() => setOnlyMyTasks(!onlyMyTasks)}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1 ${
                onlyMyTasks 
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                  : 'bg-[#202026] border-[#333] text-gray-400 hover:text-white'
              }`}
            >
              <User size={13} />
              <span>Assigned to Me</span>
            </button>

            {/* Create Task Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shadow"
            >
              <Plus size={14} /> New Task
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: TASKS LIST */}
          {activeTab === 'tasks' && (
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[#2d2d34] rounded-2xl bg-[#161619]/50">
                  <Inbox size={36} className="mx-auto text-gray-600 mb-3" />
                  <h3 className="text-sm font-bold text-gray-300">No tasks match your filter</h3>
                  <p className="text-xs text-gray-500 mt-1">Try resetting search or category filters</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const isExpanded = expandedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`bg-[#17171b] border rounded-2xl transition-all ${
                        !task.isRead 
                          ? 'border-amber-500/50 shadow-[0_0_12px_rgba(245,166,35,0.08)]' 
                          : 'border-[#26262c] hover:border-[#383840]'
                      }`}
                    >
                      {/* TASK MAIN CARD HEADER */}
                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Status Badge Icon */}
                          <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            task.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            task.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            task.status === 'Review' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}>
                            {task.status === 'Completed' ? <CheckCircle2 size={16} /> :
                             task.status === 'In Progress' ? <Play size={14} /> :
                             task.status === 'Review' ? <AlertCircle size={16} /> :
                             <Clock size={16} />}
                          </div>

                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#24242a] text-amber-400 border border-[#333]">
                                {task.departmentName || task.departmentId}
                              </span>

                              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                                task.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                task.priority === 'High' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              }`}>
                                {task.priority} Priority
                              </span>

                              {task.relatedScene && (
                                <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1 bg-[#202026] px-2 py-0.5 rounded border border-[#333]">
                                  <Film size={11} className="text-amber-400" />
                                  {task.relatedScene}
                                </span>
                              )}

                              {!task.isRead && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                              )}
                            </div>

                            <h4 className="text-sm font-bold text-white leading-snug">
                              {task.title}
                            </h4>

                            {task.notes && (
                              <p className="text-xs text-gray-400 font-sans line-clamp-2">
                                {task.notes}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-gray-400 font-mono pt-1">
                              <span className="flex items-center gap-1 text-gray-300">
                                <User size={12} className="text-amber-400" />
                                {task.owner}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} className="text-gray-500" />
                                Due: <strong className="text-amber-400">{task.deadline}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ACTIONS & DIRECT LINK */}
                        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#222]">
                          
                          {/* Quick Status Selector */}
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value as any)}
                            className="bg-[#202026] text-amber-400 text-xs font-bold font-mono px-2.5 py-1.5 rounded-xl border border-[#3d3d46] outline-none cursor-pointer hover:border-amber-500"
                          >
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Review">Review</option>
                            <option value="Completed">Completed</option>
                          </select>

                          {/* DIRECT LINK TO PAGE BUTTON */}
                          <button
                            onClick={() => {
                              if (task.targetView) {
                                onNavigateToView(task.targetView);
                                onClose();
                              } else {
                                onNavigateToView('crew');
                                onClose();
                              }
                            }}
                            className="bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-500/30 transition-all flex items-center gap-1.5 shadow-sm group"
                            title={`Jump to ${task.targetView || 'crew'} page`}
                          >
                            <span>Go to Page</span>
                            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                          </button>

                          {/* Notion History Expand Toggle */}
                          <button
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            className={`p-1.5 rounded-xl border transition-colors flex items-center gap-1 text-xs font-mono ${
                              isExpanded 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500' 
                                : 'bg-[#202026] text-gray-400 hover:text-white border-[#333]'
                            }`}
                            title="View Notion-style modification history"
                          >
                            <History size={14} />
                            <span>{task.history.length}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          <TwoClickDeleteButton 
                            onDelete={() => onDeleteTask(task.id)}
                            iconSize={14}
                            confirmText="Confirm Delete?"
                            className="p-1.5 text-gray-500 hover:text-red-400 rounded-xl hover:bg-[#25252b] transition-colors"
                          />
                        </div>
                      </div>

                      {/* NOTION-STYLE EXPANDED MODIFICATION HISTORY SECTION */}
                      {isExpanded && (
                        <div className="bg-[#111114] border-t border-[#222227] p-4 sm:p-5 rounded-b-2xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <History size={14} />
                              <span>Notion-Style Modification History & Activity Log</span>
                            </h5>
                            <span className="text-[10px] font-mono text-gray-500">
                              {task.history.length} events logged
                            </span>
                          </div>

                          {/* New Activity/Comment Input */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newCommentText[task.id] || ''}
                              onChange={(e) => setNewCommentText({ ...newCommentText, [task.id]: e.target.value })}
                              placeholder="Write a modification note or comment (e.g., Equipment arrived at set)..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddComment(task);
                              }}
                              className="flex-1 bg-[#1a1a1e] border border-[#2e2e36] text-white text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 transition-colors"
                            />
                            <button
                              onClick={() => handleAddComment(task)}
                              className="bg-[#282830] hover:bg-amber-500 text-gray-300 hover:text-black text-xs font-bold px-3 py-2 rounded-xl border border-[#3a3a44] transition-all flex items-center gap-1"
                            >
                              <MessageSquare size={13} /> Log Note
                            </button>
                          </div>

                          {/* Timeline of Changes */}
                          <div className="relative pl-4 border-l border-[#282830] space-y-3 pt-1">
                            {task.history.map((hist) => (
                              <div key={hist.id} className="relative group">
                                {/* Dot on timeline */}
                                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500/80 border-2 border-[#111114]"></div>

                                <div className="bg-[#18181c] border border-[#24242a] rounded-xl p-3 space-y-1 text-xs">
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
                                      <span className="bg-[#24242a] px-1.5 py-0.5 rounded text-red-400 line-through">
                                        {hist.oldValue}
                                      </span>
                                      <ArrowRight size={10} className="text-gray-500" />
                                      <span className="bg-[#24242a] px-1.5 py-0.5 rounded text-emerald-400 font-bold">
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

          {/* TAB 2: GLOBAL NOTION-STYLE MODIFICATION HISTORY FEED */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-[#16161a] border border-[#26262c] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History size={16} className="text-amber-400" />
                    <span>Project-Wide Activity & Modification Feed</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Notion-style chronological log of all task edits, status updates, and comments
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-[#222] px-3 py-1 rounded-lg border border-[#333]">
                  {allHistoryFeed.length} Total Edits
                </span>
              </div>

              <div className="relative pl-6 border-l-2 border-[#2a2a32] space-y-4 pt-2">
                {allHistoryFeed.map(({ task, historyItem }, index) => (
                  <div key={`${task.id}-${historyItem.id}-${index}`} className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-[#121215] shadow-[0_0_8px_rgba(245,166,35,0.5)]"></div>

                    <div className="bg-[#17171b] border border-[#282830] hover:border-amber-500/40 rounded-xl p-4 space-y-2 transition-all">
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-amber-400 font-bold">{historyItem.author}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-300">{historyItem.timestamp}</span>
                        </div>

                        <button
                          onClick={() => {
                            if (task.targetView) {
                              onNavigateToView(task.targetView);
                              onClose();
                            }
                          }}
                          className="text-[11px] font-mono text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <span>{task.title}</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>

                      {historyItem.fieldChanged && historyItem.oldValue && historyItem.newValue && (
                        <div className="text-xs font-mono text-gray-300 flex items-center gap-2 bg-[#121215] p-2 rounded-lg border border-[#222]">
                          <span>Updated {historyItem.fieldChanged}:</span>
                          <span className="text-red-400 line-through bg-[#222] px-1.5 py-0.5 rounded">{historyItem.oldValue}</span>
                          <ArrowRight size={12} className="text-gray-500" />
                          <span className="text-emerald-400 font-bold bg-[#222] px-1.5 py-0.5 rounded">{historyItem.newValue}</span>
                        </div>
                      )}

                      {historyItem.comment && (
                        <p className="text-xs text-gray-200 bg-[#202026] p-2.5 rounded-lg border border-[#2d2d36] font-sans">
                          "{historyItem.comment}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* CREATE NEW TASK MODAL OVERLAY */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[1100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161619] border border-[#333] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2a2a30] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-amber-400" />
                <span>Create New Production Task</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
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
              const notes = formData.get('notes') as string;

              if (title) {
                const newTask: AppTask = {
                  id: `inbox-tk-${Date.now()}`,
                  title,
                  departmentId: dept || 'direction',
                  departmentName: categories.find(c => c.id === dept)?.label || 'Direction',
                  owner: owner || 'Current User',
                  priority: priority || 'High',
                  deadline: deadline || '2026-08-08',
                  status: 'To Do',
                  targetView: targetView || 'crew',
                  notes: notes || '',
                  isRead: true,
                  history: [{
                    id: `h-${Date.now()}`,
                    timestamp: 'Just now',
                    author: 'Current User',
                    changeType: 'created',
                    comment: 'Task created via Central Inbox'
                  }]
                };

                onAddTask(newTask);
                setShowCreateModal(false);
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Task Title</label>
                <input name="title" required placeholder="e.g. Master Shot Camera Rig Setup" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Department</label>
                  <select name="dept" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-amber-500">
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
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Assignee / Owner</label>
                  <input name="owner" placeholder="e.g. Tirru ISC" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Priority</label>
                  <select name="priority" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-amber-500">
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono font-bold">Target Page Link</label>
                  <select name="targetView" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-amber-500">
                    <option value="crew">Crew Workspace</option>
                    <option value="script">Script View</option>
                    <option value="breakdown">Breakdown View</option>
                    <option value="casting">Casting View</option>
                    <option value="shotlist">Shot Division</option>
                    <option value="schedule">Schedule</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono font-bold">Deadline Date</label>
                <input name="deadline" type="date" defaultValue="2026-08-08" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-amber-500" />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono font-bold">Notes / Description</label>
                <textarea name="notes" rows={2} placeholder="Add requirements, scene details, or instructions..." className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-amber-500" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2a2a30]">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" className="bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold px-4 py-1.5 rounded-lg">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default InboxModal;
