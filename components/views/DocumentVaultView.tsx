import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ProductionDocument, DocumentAnnotation, AnnotationType } from '../../types';
import { getProductionDocuments, saveProductionDocuments } from '../../services/documentsStorage';
import {
  FileText,
  Upload,
  Highlighter,
  PenTool,
  Type,
  Square,
  StickyNote,
  Trash2,
  Printer,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Folder,
  Plus,
  X,
  MessageSquare,
  Shield,
  Palette,
  FileCheck,
  Scale,
  Hand,
  FolderOpen
} from 'lucide-react';

const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f472b6'];
const PEN_COLORS = ['#dc2626', '#18181b', '#2563eb', '#16a34a', '#d97706'];

export const DocumentVaultView: React.FC = () => {
  const { appTheme, appAccentColor = '#f5a623' } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [documents, setDocuments] = useState<ProductionDocument[]>(() => getProductionDocuments());
  const [selectedDocId, setSelectedDocId] = useState<string>(() => documents[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Active Annotation Tool
  const [activeTool, setActiveTool] = useState<AnnotationType | 'hand'>('hand');
  const [activeColor, setActiveColor] = useState<string>('#fde047');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Active note popup
  const [activeNote, setActiveNote] = useState<{ x: number; y: number; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const pageAnnotations = (selectedDoc?.annotations || []).filter((a) => a.pageNumber === currentPage);
  const totalPages = selectedDoc?.pageCount || 1;

  // Persist documents on change
  const updateDocuments = (docs: ProductionDocument[]) => {
    setDocuments(docs);
    saveProductionDocuments(docs);
  };

  const handleSelectDoc = (id: string) => {
    setSelectedDocId(id);
    setCurrentPage(1);
    setActiveNote(null);
  };

  const filteredDocs = documents.filter((d) => {
    if (selectedCategory === 'ALL') return true;
    return d.category === selectedCategory;
  });

  // Handle PDF / Doc Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const newDoc: ProductionDocument = {
        id: `doc-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        category: (selectedCategory === 'ALL' ? 'OTHER' : selectedCategory) as any,
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        pageCount: 3,
        uploadedAt: new Date().toISOString(),
        pdfDataUrl: dataUrl,
        annotations: [],
      };
      const updated = [newDoc, ...documents];
      updateDocuments(updated);
      setSelectedDocId(newDoc.id);
      setCurrentPage(1);
    };
    reader.readAsDataURL(file);
  };

  // SVG Mouse Coordinates helper
  const getSvgCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgOverlayRef.current) return { x: 0, y: 0 };
    const rect = svgOverlayRef.current.getBoundingClientRect();
    const scale = zoomLevel / 100;
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'hand') return;
    const { x, y } = getSvgCoords(e);
    setIsDrawing(true);
    setStartPoint({ x, y });

    if (activeTool === 'pen') {
      setCurrentPath([{ x, y }]);
    } else if (activeTool === 'rect' || activeTool === 'highlight') {
      setCurrentRect({ x, y, width: 0, height: 0 });
    } else if (activeTool === 'note') {
      setActiveNote({ x, y, text: '' });
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    const { x, y } = getSvgCoords(e);

    if (activeTool === 'pen') {
      setCurrentPath((prev) => [...prev, { x, y }]);
    } else if ((activeTool === 'rect' || activeTool === 'highlight') && startPoint) {
      const rx = Math.min(startPoint.x, x);
      const ry = Math.min(startPoint.y, y);
      const rw = Math.abs(x - startPoint.x);
      const rh = Math.abs(y - startPoint.y);
      setCurrentRect({ x: rx, y: ry, width: rw, height: rh });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !selectedDoc) return;
    setIsDrawing(false);

    if (activeTool === 'pen' && currentPath.length > 1) {
      const newAnno: DocumentAnnotation = {
        id: `ann-${Date.now()}`,
        documentId: selectedDoc.id,
        pageNumber: currentPage,
        type: 'pen',
        color: activeColor,
        strokeWidth,
        points: currentPath,
        createdAt: new Date().toISOString(),
      };
      saveAnnotation(newAnno);
      setCurrentPath([]);
    } else if ((activeTool === 'rect' || activeTool === 'highlight') && currentRect && currentRect.width > 5) {
      const newAnno: DocumentAnnotation = {
        id: `ann-${Date.now()}`,
        documentId: selectedDoc.id,
        pageNumber: currentPage,
        type: activeTool,
        color: activeColor,
        strokeWidth: activeTool === 'rect' ? strokeWidth : 0,
        opacity: activeTool === 'highlight' ? 0.35 : 1,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
        createdAt: new Date().toISOString(),
      };
      saveAnnotation(newAnno);
      setCurrentRect(null);
    }
    setStartPoint(null);
  };

  const saveAnnotation = (newAnno: DocumentAnnotation) => {
    if (!selectedDoc) return;
    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        return { ...d, annotations: [...(d.annotations || []), newAnno] };
      }
      return d;
    });
    updateDocuments(updatedDocs);
  };

  const handleDeleteAnnotation = (annoId: string) => {
    if (!selectedDoc) return;
    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        return { ...d, annotations: d.annotations.filter((a) => a.id !== annoId) };
      }
      return d;
    });
    updateDocuments(updatedDocs);
  };

  const handleSaveNote = () => {
    if (!activeNote || !activeNote.text.trim() || !selectedDoc) {
      setActiveNote(null);
      return;
    }
    const newAnno: DocumentAnnotation = {
      id: `ann-${Date.now()}`,
      documentId: selectedDoc.id,
      pageNumber: currentPage,
      type: 'note',
      color: activeColor,
      x: activeNote.x,
      y: activeNote.y,
      text: activeNote.text.trim(),
      author: 'Production Member',
      createdAt: new Date().toISOString(),
    };
    saveAnnotation(newAnno);
    setActiveNote(null);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'LOOKBOOK': return <Palette size={14} className="text-pink-400" />;
      case 'CALLSHEET': return <FileText size={14} className="text-cyan-400" />;
      case 'SAFETY': return <Shield size={14} className="text-red-400" />;
      case 'PERMIT': return <FileCheck size={14} className="text-emerald-400" />;
      case 'CONTRACT': return <Scale size={14} className="text-amber-400" />;
      default: return <Folder size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className={`w-full h-full flex font-sans ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0a0a0c] text-gray-100'}`}>
      {/* Sidebar: Categories & Document List */}
      <div className={`w-80 flex-shrink-0 flex flex-col border-r ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#121216] border-[#222]'
      }`}>
        <div className="p-4 border-b border-inherit">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black flex items-center gap-2 tracking-tight">
              <FolderOpen className="text-[#f5a623]" size={16} />
              Production Documents
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#f5a623] hover:bg-[#e09612] text-black flex items-center gap-1 transition-all"
            >
              <Upload size={12} />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {['ALL', 'LOOKBOOK', 'CALLSHEET', 'SAFETY', 'PERMIT', 'CONTRACT'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/40'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                    : 'bg-[#18181f] border-[#2a2a34] text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Document Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredDocs.map((doc) => {
            const isSelected = doc.id === selectedDocId;
            return (
              <div
                key={doc.id}
                onClick={() => handleSelectDoc(doc.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? isLight
                      ? 'bg-amber-500/10 border-[#f5a623] shadow-sm'
                      : 'bg-[#1c1c24] border-[#f5a623] shadow-lg'
                    : isLight
                    ? 'bg-slate-50 hover:bg-white border-slate-200'
                    : 'bg-[#16161c] hover:bg-[#1c1c24] border-[#222]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getCategoryIcon(doc.category)}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold truncate">{doc.title}</h3>
                    <p className={`text-[10px] mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[9px] font-mono text-gray-400">
                      <span>{doc.fileSize}</span>
                      <span>•</span>
                      <span>{doc.pageCount} Pages</span>
                      <span>•</span>
                      <span>{(doc.annotations || []).length} Notes</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content: Viewer & Annotation Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Annotation Toolbar */}
        <div className={`p-2.5 px-6 border-b flex items-center justify-between flex-wrap gap-3 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#121216] border-[#222]'
        }`}>
          {/* Tool selectors */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTool('hand')}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'hand'
                  ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-[#333] hover:bg-[#222]'
              }`}
              title="Hand Tool (Navigate)"
            >
              <Hand size={15} />
            </button>
            <button
              onClick={() => { setActiveTool('highlight'); setActiveColor('#fde047'); }}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'highlight'
                  ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-[#333] hover:bg-[#222]'
              }`}
              title="Highlighter"
            >
              <Highlighter size={15} />
            </button>
            <button
              onClick={() => { setActiveTool('pen'); setActiveColor('#dc2626'); }}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'pen'
                  ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-[#333] hover:bg-[#222]'
              }`}
              title="Pen (Freehand Drawing)"
            >
              <PenTool size={15} />
            </button>
            <button
              onClick={() => setActiveTool('rect')}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'rect'
                  ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-[#333] hover:bg-[#222]'
              }`}
              title="Bounding Box (Rectangle)"
            >
              <Square size={15} />
            </button>
            <button
              onClick={() => setActiveTool('note')}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'note'
                  ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-[#333] hover:bg-[#222]'
              }`}
              title="Sticky Note"
            >
              <StickyNote size={15} />
            </button>

            {/* Color Palette */}
            {activeTool !== 'hand' && (
              <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-inherit">
                {(activeTool === 'highlight' ? HIGHLIGHT_COLORS : PEN_COLORS).map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveColor(c)}
                    className="w-4 h-4 rounded-full border transition-transform hover:scale-125"
                    style={{
                      backgroundColor: c,
                      borderColor: activeColor === c ? '#fff' : 'transparent',
                      boxShadow: activeColor === c ? '0 0 0 1.5px #f5a623' : 'none',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Page & Zoom controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border disabled:opacity-30 border-inherit hover:bg-white/10"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-mono px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border disabled:opacity-30 border-inherit hover:bg-white/10"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex items-center gap-1 border-l border-inherit pl-3">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                className="p-1 rounded border border-inherit hover:bg-white/10"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-xs font-mono w-12 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                className="p-1 rounded border border-inherit hover:bg-white/10"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-lg border border-inherit hover:bg-white/10 text-gray-300"
              title="Print Document"
            >
              <Printer size={15} />
            </button>
          </div>
        </div>

        {/* PDF Page Canvas Wrapper */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex justify-center p-8 relative select-none"
        >
          {selectedDoc ? (
            <div
              className="relative shadow-2xl transition-transform origin-top"
              style={{
                width: '760px',
                minHeight: '980px',
                transform: `scale(${zoomLevel / 100})`,
                backgroundColor: '#ffffff',
                color: '#111827',
              }}
            >
              {/* Document Page Preview (Simulated Document Sheet for built-in or uploaded files) */}
              <div className="p-12 font-serif text-[12px] leading-relaxed h-full">
                <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-baseline font-sans">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#f5a623]">
                      BACKSTAGE PRODUCTION VAULT
                    </span>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight mt-1">{selectedDoc.title}</h1>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-500">
                    <div>{selectedDoc.fileName}</div>
                    <div>PAGE {currentPage} OF {totalPages}</div>
                  </div>
                </div>

                {/* Content Simulation based on category */}
                {selectedDoc.category === 'LOOKBOOK' && (
                  <div className="space-y-4 font-sans text-xs">
                    <h2 className="text-sm font-bold text-slate-800">Visual Palette & Lighting Tone</h2>
                    <p className="text-slate-600 leading-normal">
                      The visual language contrasts dusty ochre daylight with rich sapphire night scenes. Deep shadows with prominent warm sodium rims represent the protagonist’s moral tension.
                    </p>
                    <div className="grid grid-cols-3 gap-3 my-4">
                      <div className="h-28 rounded bg-[#1e293b] flex items-center justify-center text-white text-[10px] font-mono">Night Amber Rim</div>
                      <div className="h-28 rounded bg-[#d97706] flex items-center justify-center text-white text-[10px] font-mono">Temple Flare</div>
                      <div className="h-28 rounded bg-[#475569] flex items-center justify-center text-white text-[10px] font-mono">Alleyway Cool</div>
                    </div>
                  </div>
                )}

                {selectedDoc.category === 'CALLSHEET' && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 bg-slate-100 rounded border border-slate-300">
                      <strong>GENERAL CALL:</strong> 06:00 AM &nbsp;&nbsp;|&nbsp;&nbsp; <strong>BREAKFAST:</strong> 06:30 AM &nbsp;&nbsp;|&nbsp;&nbsp; <strong>READY TO SHOOT:</strong> 07:15 AM
                    </div>
                    <table className="w-full text-left text-[11px] border border-slate-300 mt-4">
                      <thead className="bg-slate-200">
                        <tr>
                          <th className="p-1.5">Cast #</th>
                          <th className="p-1.5">Character</th>
                          <th className="p-1.5">Pickup</th>
                          <th className="p-1.5">H/MU</th>
                          <th className="p-1.5">On Set</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-300">
                          <td className="p-1.5">1</td>
                          <td className="p-1.5">Ranga</td>
                          <td className="p-1.5">05:30</td>
                          <td className="p-1.5">06:00</td>
                          <td className="p-1.5">07:00</td>
                        </tr>
                        <tr className="border-t border-slate-300">
                          <td className="p-1.5">2</td>
                          <td className="p-1.5">Inspector David</td>
                          <td className="p-1.5">06:00</td>
                          <td className="p-1.5">06:30</td>
                          <td className="p-1.5">07:15</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedDoc.category === 'SAFETY' && (
                  <div className="space-y-4 font-sans text-xs">
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 font-bold">
                      MANDATORY SAFETY PROTOCOL: Stunt weapons must be blunted aluminum props inspected by the stunt coordinator prior to camera rolling.
                    </div>
                    <ul className="list-disc pl-5 space-y-2 text-slate-700">
                      <li>Ambulance and first-aid team stationed at Gate 2.</li>
                      <li>Fire marshal present during all practical pyrotechnic charges.</li>
                      <li>Perimeter fencing established 50 meters from blast radius.</li>
                    </ul>
                  </div>
                )}

                {selectedDoc.category !== 'LOOKBOOK' && selectedDoc.category !== 'CALLSHEET' && selectedDoc.category !== 'SAFETY' && (
                  <div className="space-y-4 font-serif text-sm text-slate-700 leading-relaxed">
                    <p>
                      Official production document filed under <strong>{selectedDoc.category}</strong>. All department heads must review and acknowledge safety and scheduling clauses.
                    </p>
                    <p className="text-slate-500 italic">
                      Upload signed agreements or digital recce packets to annotate specific requirements with the production team.
                    </p>
                  </div>
                )}
              </div>

              {/* Interactive SVG Annotation Layer */}
              <svg
                ref={svgOverlayRef}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: activeTool === 'hand' ? 'default' : 'crosshair' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                {pageAnnotations.map((anno) => {
                  if (anno.type === 'highlight') {
                    return (
                      <rect
                        key={anno.id}
                        x={anno.x}
                        y={anno.y}
                        width={anno.width}
                        height={anno.height}
                        fill={anno.color}
                        fillOpacity={anno.opacity || 0.4}
                      />
                    );
                  }
                  if (anno.type === 'rect') {
                    return (
                      <rect
                        key={anno.id}
                        x={anno.x}
                        y={anno.y}
                        width={anno.width}
                        height={anno.height}
                        fill="none"
                        stroke={anno.color}
                        strokeWidth={anno.strokeWidth || 2}
                        strokeDasharray="4 2"
                      />
                    );
                  }
                  if (anno.type === 'pen' && anno.points && anno.points.length > 1) {
                    const pathData = anno.points
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                      .join(' ');
                    return (
                      <path
                        key={anno.id}
                        d={pathData}
                        fill="none"
                        stroke={anno.color}
                        strokeWidth={anno.strokeWidth || 3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  }
                  return null;
                })}

                {/* Currently drawing preview */}
                {isDrawing && activeTool === 'pen' && currentPath.length > 1 && (
                  <path
                    d={currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                  />
                )}
                {isDrawing && (activeTool === 'rect' || activeTool === 'highlight') && currentRect && (
                  <rect
                    x={currentRect.x}
                    y={currentRect.y}
                    width={currentRect.width}
                    height={currentRect.height}
                    fill={activeTool === 'highlight' ? activeColor : 'none'}
                    fillOpacity={activeTool === 'highlight' ? 0.4 : 0}
                    stroke={activeColor}
                    strokeWidth={activeTool === 'rect' ? strokeWidth : 0}
                  />
                )}
              </svg>

              {/* Render Sticky Notes */}
              {pageAnnotations
                .filter((a) => a.type === 'note' && a.x !== undefined && a.y !== undefined)
                .map((note) => (
                  <div
                    key={note.id}
                    style={{ left: note.x, top: note.y }}
                    className="absolute z-20 group -translate-x-3 -translate-y-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-md flex items-center justify-center cursor-pointer text-black">
                      <MessageSquare size={12} />
                    </div>
                    {/* Hover Tooltip / Popup */}
                    <div className="hidden group-hover:block absolute left-8 top-0 w-64 p-3 bg-amber-50 border border-amber-200 rounded-xl shadow-xl text-xs text-slate-800 font-sans z-30">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-[10px] text-amber-900">{note.author || 'Note'}</span>
                        <button
                          onClick={() => handleDeleteAnnotation(note.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <p className="leading-snug">{note.text}</p>
                    </div>
                  </div>
                ))}

              {/* Active New Note Modal/Input */}
              {activeNote && (
                <div
                  style={{ left: activeNote.x, top: activeNote.y }}
                  className="absolute z-40 w-64 p-3 bg-amber-50 border-2 border-[#f5a623] rounded-xl shadow-2xl font-sans"
                >
                  <div className="text-[10px] font-bold text-amber-900 mb-1">Add Sticky Note</div>
                  <textarea
                    autoFocus
                    placeholder="Enter production note..."
                    value={activeNote.text}
                    onChange={(e) => setActiveNote({ ...activeNote, text: e.target.value })}
                    className="w-full h-16 p-2 text-xs bg-white border rounded outline-none resize-none"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setActiveNote(null)}
                      className="px-2 py-1 text-[10px] font-bold rounded text-gray-600 hover:bg-black/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNote}
                      className="px-3 py-1 text-[10px] font-bold rounded bg-[#f5a623] text-black hover:bg-[#e09612]"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <Folder size={48} className="mb-3 opacity-30" />
              <p className="font-bold">No documents in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentVaultView;
