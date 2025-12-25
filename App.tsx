
import React, { useState } from 'react';
import { ProjectProvider, useProject } from './context/ProjectContext';
import AppHeader from './components/AppHeader';
import BoardView from './components/views/BoardView';
import ScriptView from './components/views/ScriptView';
import CharacterView from './components/views/CharacterView';
import StoryboardView from './components/views/StoryboardView';
import StatisticsView from './components/views/StatisticsView';
import BackstageView from './components/views/SettingsView';
import GoalView from './components/views/GoalView';
import BreakdownView from './components/views/BreakdownView';
import EditorModal from './components/EditorModal';
import PrintPreviewModal from './components/PrintPreviewModal';
import WelcomeScreen from './components/WelcomeScreen';
import { ViewMode } from './types';

const AppContent: React.FC = () => {
  const { currentUser, currentProjectId } = useProject();
  const [currentView, setCurrentView] = useState<ViewMode>('board');
  
  // Window Management for Beat Editors
  const [openBeatIds, setOpenBeatIds] = useState<number[]>([]);
  
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleEditBeat = (id: number) => {
      setOpenBeatIds(prev => {
          // If already open, move to end (top focus)
          if (prev.includes(id)) return [...prev.filter(i => i !== id), id];
          return [...prev, id];
      });
  };

  const handleCloseBeat = (id: number) => {
      setOpenBeatIds(prev => prev.filter(i => i !== id));
  };

  const handleFocusBeat = (id: number) => {
      setOpenBeatIds(prev => {
          // Optimization: If already top, do nothing
          if (prev.length === 0 || prev[prev.length - 1] === id) return prev;
          return [...prev.filter(i => i !== id), id];
      });
  };

  // --- ROUTING LOGIC ---
  // If no user is logged in OR no project is selected, show Welcome Screen
  if (!currentUser || !currentProjectId) {
      return <WelcomeScreen />;
  }

  return (
    <>
      <div className="print:hidden">
        <AppHeader 
            currentView={currentView} 
            onViewChange={setCurrentView}
            onRefresh={handleRefresh}
            onPrint={() => setShowPrintPreview(true)}
        />
      </div>
      
      <main className="w-full h-[calc(100vh-50px)] mt-[50px] relative print:hidden print:mt-0 print:h-auto">
        {currentView === 'board' && <div className="w-full h-full"><BoardView key={`board-${refreshKey}`} onEditBeat={handleEditBeat} /></div>}
        {currentView === 'script' && <ScriptView key={`script-${refreshKey}`} />}
        {currentView === 'characters' && <div className="w-full h-full"><CharacterView key={`chars-${refreshKey}`} /></div>}
        {currentView === 'breakdown' && <div className="w-full h-full"><BreakdownView key={`breakdown-${refreshKey}`} /></div>}
        {currentView === 'storyboard' && <div className="w-full h-full"><StoryboardView key={`story-${refreshKey}`} /></div>}
        {currentView === 'statistics' && <div className="w-full h-full"><StatisticsView key={`stats-${refreshKey}`} /></div>}
        {currentView === 'backstage' && <div className="w-full h-full"><BackstageView key={`backstage-${refreshKey}`} onNavigateToBoard={() => setCurrentView('board')} /></div>}
        {currentView === 'goals' && <div className="w-full h-full"><GoalView key={`goals-${refreshKey}`} /></div>}
      </main>

      {/* WINDOWS LAYER (Only visible in Board View) */}
      {currentView === 'board' && (
        <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
            {openBeatIds.map((id, index) => (
              <div key={id} className="pointer-events-auto absolute" style={{ zIndex: 1000 + index }}>
                  <EditorModal 
                    beatId={id} 
                    onClose={() => handleCloseBeat(id)} 
                    onFocus={() => handleFocusBeat(id)}
                    initialOffset={index * 30}
                    onViewInScript={() => {
                      handleCloseBeat(id);
                      setCurrentView('script');
                    }}
                  />
              </div>
            ))}
        </div>
      )}

      {showPrintPreview && (
        <PrintPreviewModal onClose={() => setShowPrintPreview(false)} />
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
};

export default App;
