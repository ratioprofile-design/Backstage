import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode } from '../types';

export const VIEW_NAMES: Record<string, string> = {
  script: 'Screenplay Editor',
  'two-column-script': 'Two-Column Script Studio',
  documents: 'Document Vault',
  breakdown: 'Scene Breakdown',
  board: 'Storyboard & Beats Canvas',
  casting: 'Casting & Talent Hub',
  characterdesign: 'Character Design Studio',
  characters: 'Character & Cast Roster',
  continuity: 'Costume & Continuity Tracker',
  crew: 'Crew & Departments',
  shotlist: 'Director Shot List',
  storyboard: 'Visual Storyboard Grid',
  schedule: 'Production Shooting Schedule',
  dood: 'Day-out-of-Days Matrix',
  callsheet: 'Daily Call Sheet Creator',
  statistics: 'Script Analytics & Stats',
  backstage: 'Backstage Dashboard',
  goals: 'Production Goals & Milestones',
  inbox: 'Production Inbox & Tasks',
  excalidraw: 'Whiteboard & Floorplans',
  locations: 'Location Scout & Staging',
};

export interface NavigationContextType {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  navigateToView: (view: ViewMode) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  backViewName: string | null;
  forwardViewName: string | null;
  historyStack: ViewMode[];
  historyIndex: number;
  pageLoadingMessage: string | null;
  setPageLoadingMessage: (msg: string | null) => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize current view from local storage or default to 'board'
  const [currentView, setCurrentViewInternal] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('backstage_last_view');
      if (saved) return saved as ViewMode;
    } catch {}
    return 'board';
  });

  // History stack tracks chronological view visits
  const [historyStack, setHistoryStack] = useState<ViewMode[]>(() => {
    try {
      const saved = localStorage.getItem('backstage_last_view');
      return [saved ? (saved as ViewMode) : 'board'];
    } catch {
      return ['board'];
    }
  });

  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [pageLoadingMessage, setPageLoadingMessage] = useState<string | null>(null);
  const pageLoadingTimerRef = useRef<any>(null);
  const isInternalHistoryStepRef = useRef<boolean>(false);

  // Set browser history initial state on mount (preserving OAuth code/hash/query params)
  useEffect(() => {
    try {
      const fullUrl = window.location.pathname + window.location.search + window.location.hash;
      window.history.replaceState({ view: currentView, index: 0 }, '', fullUrl);
    } catch (e) {}
  }, []);

  // Save last active view to localStorage
  useEffect(() => {
    try {
      if (currentView) {
        localStorage.setItem('backstage_last_view', currentView);
      }
    } catch (e) {}
  }, [currentView]);

  // Primary view navigation function (Instantaneous 0ms switch without artificial delays)
  const navigateToView = useCallback((nextView: ViewMode, isHistoryAction = false) => {
    setCurrentViewInternal((prevView) => {
      if (nextView === prevView) return prevView;

      if (!isHistoryAction) {
        setHistoryStack((prevStack) => {
          // Truncate forward history from current index and append new view
          const updated = [...prevStack.slice(0, historyIndex + 1), nextView];
          return updated;
        });

        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);

        try {
          window.history.pushState({ view: nextView, index: nextIndex }, '', window.location.pathname);
        } catch (e) {}
      }

      return nextView;
    });
  }, [historyIndex]);

  // Can Go Back / Forward state
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;

  const backViewName = canGoBack ? (VIEW_NAMES[historyStack[historyIndex - 1]] || historyStack[historyIndex - 1]) : null;
  const forwardViewName = canGoForward ? (VIEW_NAMES[historyStack[historyIndex + 1]] || historyStack[historyIndex + 1]) : null;

  // Step backward in history
  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const targetIndex = historyIndex - 1;
    const targetView = historyStack[targetIndex];
    if (!targetView) return;

    setHistoryIndex(targetIndex);
    isInternalHistoryStepRef.current = true;
    navigateToView(targetView, true);

    try {
      window.history.replaceState({ view: targetView, index: targetIndex }, '', window.location.pathname);
    } catch (e) {}
  }, [historyIndex, historyStack, navigateToView]);

  // Step forward in history
  const goForward = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const targetIndex = historyIndex + 1;
    const targetView = historyStack[targetIndex];
    if (!targetView) return;

    setHistoryIndex(targetIndex);
    isInternalHistoryStepRef.current = true;
    navigateToView(targetView, true);

    try {
      window.history.replaceState({ view: targetView, index: targetIndex }, '', window.location.pathname);
    } catch (e) {}
  }, [historyIndex, historyStack, navigateToView]);

  // Browser Popstate (Handles native browser back/forward buttons & mouse back/forward buttons)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        const targetView = e.state.view as ViewMode;
        const targetIndex = typeof e.state.index === 'number' ? e.state.index : -1;
        if (targetIndex >= 0) {
          setHistoryIndex(targetIndex);
        }
        navigateToView(targetView, true);
      } else {
        // Fallback to internal goBack
        goBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBack, navigateToView]);

  // Keyboard Shortcuts (Alt + ←, Alt + →, Cmd + [, Cmd + ]) & Mouse Back/Forward buttons (3 and 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      );
      if (isInput) return;

      // Alt + ArrowLeft or Cmd/Ctrl + [ -> Back
      if ((e.altKey && e.key === 'ArrowLeft') || ((e.metaKey || e.ctrlKey) && e.key === '[')) {
        e.preventDefault();
        goBack();
      }

      // Alt + ArrowRight or Cmd/Ctrl + ] -> Forward
      if ((e.altKey && e.key === 'ArrowRight') || ((e.metaKey || e.ctrlKey) && e.key === ']')) {
        e.preventDefault();
        goForward();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        // Mouse Back button
        e.preventDefault();
        goBack();
      } else if (e.button === 4) {
        // Mouse Forward button
        e.preventDefault();
        goForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [goBack, goForward]);

  // Global custom event listeners for programmatic navigation across sub-views
  useEffect(() => {
    const handleNavigateEvent = (e: any) => {
      if (e.detail?.view) {
        navigateToView(e.detail.view);
      }
    };
    const handleBackEvent = () => goBack();
    const handleForwardEvent = () => goForward();

    window.addEventListener('backstage_navigate', handleNavigateEvent);
    window.addEventListener('backstage_go_back', handleBackEvent);
    window.addEventListener('backstage_go_forward', handleForwardEvent);

    return () => {
      window.removeEventListener('backstage_navigate', handleNavigateEvent);
      window.removeEventListener('backstage_go_back', handleBackEvent);
      window.removeEventListener('backstage_go_forward', handleForwardEvent);
    };
  }, [navigateToView, goBack, goForward]);

  return (
    <NavigationContext.Provider
      value={{
        currentView,
        setCurrentView: navigateToView,
        navigateToView,
        goBack,
        goForward,
        canGoBack,
        canGoForward,
        backViewName,
        forwardViewName,
        historyStack,
        historyIndex,
        pageLoadingMessage,
        setPageLoadingMessage,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
