import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import {
  NotificationItem,
  subscribeToNotifications,
} from '../services/notificationService';
import {
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Cloud,
  Trash2,
  X,
  ChevronRight,
} from 'lucide-react';

interface ToastCardProps {
  item: NotificationItem;
  onDismiss: (id: string) => void;
  isLight: boolean;
  accentColor: string;
}

const ToastCard: React.FC<ToastCardProps> = ({ item, onDismiss, isLight, accentColor }) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(100);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const duration = item.duration || 4000;
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss(item.id);
    }, 280);
  }, [item.id, onDismiss]);

  // Auto-dismiss countdown timer with pause on hover
  useEffect(() => {
    if (duration <= 0) return;

    let animId: number;
    let lastTime = Date.now();

    const tick = () => {
      if (!isHovered && !isClosing) {
        const now = Date.now();
        const delta = now - lastTime;
        remainingTimeRef.current -= delta;
        const pct = Math.max(0, (remainingTimeRef.current / duration) * 100);
        setProgress(pct);

        if (remainingTimeRef.current <= 0) {
          handleClose();
          return;
        }
      }
      lastTime = Date.now();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [duration, isHovered, isClosing, handleClose]);

  // Style configurations by notification type
  const typeConfig = {
    success: {
      icon: CheckCircle2,
      accentBorder: 'border-l-emerald-500',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-500',
      badgeBorder: 'border-emerald-500/30',
      progressBg: 'bg-emerald-500',
      defaultTitle: 'Success',
    },
    cloud: {
      icon: Cloud,
      accentBorder: 'border-l-cyan-500',
      badgeBg: 'bg-cyan-500/15',
      badgeText: 'text-cyan-400',
      badgeBorder: 'border-cyan-500/30',
      progressBg: 'bg-cyan-500',
      defaultTitle: 'Cloud Sync',
    },
    trash: {
      icon: Trash2,
      accentBorder: 'border-l-rose-500',
      badgeBg: 'bg-rose-500/15',
      badgeText: 'text-rose-400',
      badgeBorder: 'border-rose-500/30',
      progressBg: 'bg-rose-500',
      defaultTitle: 'Deleted',
    },
    warning: {
      icon: AlertTriangle,
      accentBorder: 'border-l-amber-500',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/30',
      progressBg: 'bg-amber-500',
      defaultTitle: 'Notice',
    },
    error: {
      icon: AlertCircle,
      accentBorder: 'border-l-rose-600',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-400',
      badgeBorder: 'border-rose-500/40',
      progressBg: 'bg-rose-600',
      defaultTitle: 'Error',
    },
    info: {
      icon: Sparkles,
      accentBorder: 'border-l-[#f5a623]',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-[#f5a623]',
      badgeBorder: 'border-amber-500/30',
      progressBg: 'bg-[#f5a623]',
      defaultTitle: 'Notice',
    },
  }[item.type] || {
    icon: Sparkles,
    accentBorder: 'border-l-[#f5a623]',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-[#f5a623]',
    badgeBorder: 'border-amber-500/30',
    progressBg: 'bg-[#f5a623]',
    defaultTitle: 'Notice',
  };

  const IconComp = typeConfig.icon;
  const title = item.title || typeConfig.defaultTitle;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pointer-events-auto relative w-84 sm:w-92 rounded-2xl border border-l-4 overflow-hidden transition-all duration-300 ease-out select-none shadow-xl ${
        typeConfig.accentBorder
      } ${
        isClosing
          ? 'opacity-0 translate-x-12 scale-95 pointer-events-none'
          : 'opacity-100 translate-x-0 scale-100'
      } ${
        isLight
          ? 'bg-white/95 text-slate-800 border-slate-200/90 shadow-[0_12px_36px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl'
          : 'bg-[#141418]/95 text-zinc-100 border-zinc-800/80 shadow-[0_16px_40px_rgba(0,0,0,0.6),0_2px_10px_rgba(0,0,0,0.3)] backdrop-blur-xl'
      }`}
      style={{
        animation: !isClosing ? 'toastSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined,
      }}
    >
      <div className="p-3.5 flex items-start gap-3">
        {/* Type Icon Badge */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-xs ${
            typeConfig.badgeBg
          } ${typeConfig.badgeText} ${typeConfig.badgeBorder}`}
        >
          <IconComp size={16} />
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4
              className={`text-xs font-bold tracking-tight truncate ${
                isLight ? 'text-slate-900' : 'text-zinc-100'
              }`}
            >
              {title}
            </h4>
            <span
              className={`text-[10px] font-mono shrink-0 ${
                isLight ? 'text-slate-400' : 'text-zinc-500'
              }`}
            >
              Just now
            </span>
          </div>

          <p
            className={`text-xs leading-snug break-words ${
              isLight ? 'text-slate-600' : 'text-zinc-300'
            }`}
          >
            {item.message}
          </p>

          {/* Action Button if specified */}
          {item.action && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  handleClose();
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                  item.action.primary
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                }`}
              >
                <span>{item.action.label}</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Dismiss notification"
          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
            isLight
              ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress Bar (Auto-dismiss countdown indicator) */}
      {duration > 0 && (
        <div
          className={`h-[2px] w-full ${
            isLight ? 'bg-slate-100' : 'bg-zinc-800/60'
          } overflow-hidden`}
        >
          <div
            className={`h-full transition-all duration-75 ${typeConfig.progressBg}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const NotificationToastContainer: React.FC = () => {
  const { appTheme, appAccentColor = '#f5a623' } = useProject();
  const isLight =
    appTheme === 'light' ||
    (appTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((item) => {
      setNotifications((prev) => {
        // Keep up to 5 notifications in the stack to prevent vertical clutter
        const next = [item, ...prev.filter((n) => n.id !== item.id)];
        return next.slice(0, 5);
      });
    });

    return unsubscribe;
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none items-end max-w-sm w-full"
    >
      {notifications.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={handleDismiss}
          isLight={isLight}
          accentColor={appAccentColor}
        />
      ))}
    </div>
  );
};
