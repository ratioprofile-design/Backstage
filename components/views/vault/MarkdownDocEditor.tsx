import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Save, Download, Copy, Check, FileText, Eye, Columns, Code, 
  Type, Bold, Italic, Underline, Strikethrough, Highlighter,
  List, Quote, Maximize2, Minimize2, Clock,
  BookOpen, Scroll, ZoomIn, ZoomOut, Layers, ChevronLeft, ChevronRight
} from 'lucide-react';
import { ProductionDocument } from '../../../types';
import { 
  markdownToHtml, 
  htmlToMarkdown, 
  calculateDocStats, 
  SLASH_COMMANDS, 
  SlashCommandItem, 
  DOCUMENT_EMOJIS 
} from '../../../services/markdownEngine';
import { paginateMarkdownContent, PageViewMode } from '../../../services/markdownPaginator';

const FONT_STYLE_MAP: Record<string, string> = {
  inter: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  calibri: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

const FONT_SIZE_PX_MAP: Record<string, string> = {
  sm: '13px',
  md: '14.5px',
  lg: '16px',
  xl: '18px',
};

interface MarkdownDocEditorProps {
  document: ProductionDocument;
  isLight: boolean;
  onSave: (updatedDoc: ProductionDocument) => void;
  onClose?: () => void;
  showToast: (msg: string) => void;
}

export const MarkdownDocEditor: React.FC<MarkdownDocEditorProps> = ({
  document: doc,
  isLight,
  onSave,
  onClose,
  showToast
}) => {
  // Title & Icon
  const [title, setTitle] = useState<string>(doc.title || 'Untitled Document');
  const [docIcon, setDocIcon] = useState<string>(() => {
    const firstChar = (doc.title || '').trim().split(' ')[0];
    return DOCUMENT_EMOJIS.includes(firstChar) ? firstChar : '📄';
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  // Markdown content state for Split & Raw modes
  const [markdown, setMarkdown] = useState<string>(() => {
    if (doc.textContent && doc.textContent.trim()) {
      return doc.textContent;
    }
    if (doc.htmlContent && doc.htmlContent.trim()) {
      return htmlToMarkdown(doc.htmlContent);
    }
    return `# ${doc.title || 'Untitled Document'}\n\nStart typing here... Type \`/\` on an empty line for commands.\n`;
  });

  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedMd, setCopiedMd] = useState<boolean>(false);

  // View Layout
  const [editorMode, setEditorMode] = useState<'canvas' | 'split' | 'raw'>('canvas');
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [docTheme, setDocTheme] = useState<'default' | 'paper' | 'sepia'>('default');

  // Slash command menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState<boolean>(false);
  const [slashQuery, setSlashQuery] = useState<string>('');
  const [slashIndex, setSlashIndex] = useState<number>(0);
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Floating text selection toolbar
  const [floatingToolbarOpen, setFloatingToolbarOpen] = useState<boolean>(false);
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestHtmlRef = useRef<string>(doc.htmlContent || markdownToHtml(markdown));
  const markdownRef = useRef<string>(markdown);
  markdownRef.current = markdown;

  // Statistics calculation
  const stats = useMemo(() => calculateDocStats(markdown), [markdown]);

  // Typography state
  const [docFontFamily, setDocFontFamily] = useState<'inter' | 'calibri' | 'serif' | 'mono'>('inter');
  const [docFontSize, setDocFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');

  // Page Look: 'continuous' (infinite web flow) vs 'paginated' (discrete A4 print layout)
  const [pageLook, setPageLook] = useState<PageViewMode>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('backstage_md_page_look');
      if (saved === 'continuous' || saved === 'paginated') return saved;
    }
    return 'paginated';
  });

  // Zoom Level for Paginated View
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Dynamic pagination calculation (sub-millisecond)
  const paginatedResult = useMemo(() => {
    return paginateMarkdownContent(markdown, {
      docTitle: title || 'Master Document',
      docSubtitle: doc.category === 'BREAKDOWN' ? '1ST AD MASTER BREAKDOWN' : 'PRODUCTION CORE',
      fontSize: docFontSize,
      fontFamily: docFontFamily,
    });
  }, [markdown, title, doc.category, docFontSize, docFontFamily]);

  // Stable ref callback: guarantees instant, non-blank hydration the millisecond the continuous canvas mounts
  const setCanvasRef = useCallback((el: HTMLDivElement | null) => {
    (canvasRef as any).current = el;
    if (el) {
      const currentHtml = markdownToHtml(markdownRef.current);
      if (!el.innerHTML || el.innerHTML.trim() === '') {
        el.innerHTML = currentHtml;
        latestHtmlRef.current = currentHtml;
      }
    }
  }, []);

  // Hydrate continuous canvas whenever switching to continuous look or when document changes
  useEffect(() => {
    if (pageLook === 'continuous' && canvasRef.current) {
      const targetHtml = markdownToHtml(markdownRef.current);
      canvasRef.current.innerHTML = targetHtml;
      latestHtmlRef.current = targetHtml;
    }
  }, [pageLook, doc.id]);

  const handleTogglePageLook = (look: PageViewMode) => {
    if (look === pageLook) return;

    if (editorMode === 'canvas') {
      if (pageLook === 'continuous' && canvasRef.current && hasChanges) {
        // Only if user made real edits in continuous canvas do we sync canvas HTML to markdown!
        const html = canvasRef.current.innerHTML;
        latestHtmlRef.current = html;
        const converted = htmlToMarkdown(html);
        if (converted && converted.trim()) {
          setMarkdown(converted);
        }
      }
    }

    setPageLook(look);
    try {
      localStorage.setItem('backstage_md_page_look', look);
    } catch {}
  };

  const handlePaginatedCanvasInput = () => {
    const pageEls = document.querySelectorAll<HTMLElement>('.paginated-canvas-page-content');
    let combinedHtml = '';
    pageEls.forEach((el) => {
      combinedHtml += el.innerHTML;
    });
    if (combinedHtml) {
      latestHtmlRef.current = combinedHtml;
      setHasChanges(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const converted = htmlToMarkdown(combinedHtml);
        if (converted && converted.trim()) {
          setMarkdown(converted);
        }
        performSave(true);
      }, 1000);
    }
  };

  // When switching modes: sync HTML <-> Markdown smoothly
  const handleSwitchMode = (newMode: 'canvas' | 'split' | 'raw') => {
    if (editorMode === 'canvas') {
      if (pageLook === 'continuous' && canvasRef.current) {
        const html = canvasRef.current.innerHTML;
        latestHtmlRef.current = html;
        const converted = htmlToMarkdown(html);
        if (converted && converted.trim()) {
          setMarkdown(converted);
        }
      }
    }
    setEditorMode(newMode);
    if (newMode === 'canvas') {
      setTimeout(() => {
        if (canvasRef.current && pageLook === 'continuous') {
          const html = markdownToHtml(markdownRef.current);
          canvasRef.current.innerHTML = html;
          latestHtmlRef.current = html;
        }
      }, 0);
    }
  };

  // Perform document save
  const performSave = useCallback((silent: boolean = false) => {
    let currentHtml = latestHtmlRef.current;
    let currentMd = markdown;

    if (editorMode === 'canvas' && canvasRef.current) {
      currentHtml = canvasRef.current.innerHTML;
      latestHtmlRef.current = currentHtml;
      currentMd = htmlToMarkdown(currentHtml);
      setMarkdown(currentMd);
    } else {
      currentHtml = markdownToHtml(currentMd);
      latestHtmlRef.current = currentHtml;
    }

    const currentStats = calculateDocStats(currentMd);

    const updated: ProductionDocument = {
      ...doc,
      title: title.trim() || 'Untitled Document',
      textContent: currentMd,
      htmlContent: currentHtml,
      fileType: 'md',
      updatedAt: new Date().toISOString(),
      pageCount: Math.max(1, Math.ceil(currentStats.words / 400)),
    };

    setIsSaving(true);
    onSave(updated);
    setHasChanges(false);
    setTimeout(() => setIsSaving(false), 500);

    if (!silent) {
      showToast('✓ Saved document changes to Vault!');
    }
  }, [doc, title, markdown, editorMode, onSave, showToast]);

  // Handle typing inside contentEditable canvas without DOM resetting
  const handleCanvasInput = () => {
    if (!canvasRef.current) return;
    latestHtmlRef.current = canvasRef.current.innerHTML;
    setHasChanges(true);

    // If slash menu is open, update the search query from current caret
    if (slashMenuOpen) {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const text = sel.anchorNode.textContent || '';
        const offset = sel.anchorOffset;
        const lastSlash = text.lastIndexOf('/', offset);
        if (lastSlash !== -1 && offset >= lastSlash) {
          const query = text.substring(lastSlash + 1, offset).trim();
          setSlashQuery(query);
          setSlashIndex(0);
        } else {
          setSlashMenuOpen(false);
        }
      }
    }

    // Debounced background auto-save (1 second after typing stops)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      performSave(true);
    }, 1000);
  };

  // Measure exact cursor / caret coordinates in the viewport
  const getCaretCoordinates = (): { top: number; left: number } | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();

    let rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      const marker = document.createElement('span');
      marker.textContent = '\uFEFF';
      range.insertNode(marker);
      rect = marker.getBoundingClientRect();
      marker.parentNode?.removeChild(marker);
      range.collapse(false);
    }

    if (rect && rect.top > 0) {
      const menuWidth = 270;
      const menuHeight = 260;
      let top = rect.bottom + 4;
      let left = rect.left;

      // Keep menu inside viewport boundaries
      if (top + menuHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - menuHeight - 4);
      }
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 16);
      }

      return { top, left };
    }
    return null;
  };

  // Keyboard events in canvas
  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // If slash menu is active, navigate with arrow keys and Enter
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[slashIndex]) {
          executeSlashCommand(filteredCommands[slashIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
        return;
      }
    }

    // Trigger slash command menu on '/'
    if (e.key === '/') {
      setTimeout(() => {
        const coords = getCaretCoordinates();
        if (coords) {
          setSlashPosition(coords);
          setSlashMenuOpen(true);
          setSlashQuery('');
          setSlashIndex(0);
        }
      }, 10);
    }
  };

  // Save on Cmd+S / Ctrl+S
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        performSave(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [performSave]);

  // Save on unmount / blur
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Slash commands filtering
  const filteredCommands = useMemo(() => {
    if (!slashQuery.trim()) return SLASH_COMMANDS;
    const q = slashQuery.toLowerCase();
    return SLASH_COMMANDS.filter(
      (c) => c.title.toLowerCase().includes(q) || c.id.includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [slashQuery]);

  // Execute a slash command at the blinking cursor
  const executeSlashCommand = (cmd: SlashCommandItem) => {
    if (editorMode === 'canvas' && canvasRef.current) {
      canvasRef.current.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.anchorNode) {
        const range = sel.getRangeAt(0);
        const text = sel.anchorNode.textContent || '';
        const offset = sel.anchorOffset;
        const slashPos = text.lastIndexOf('/', offset);
        if (slashPos !== -1) {
          range.setStart(sel.anchorNode, slashPos);
          range.setEnd(sel.anchorNode, offset);
          range.deleteContents();
        }
      }

      // Insert formatted block HTML
      document.execCommand('insertHTML', false, markdownToHtml(cmd.template));
      setSlashMenuOpen(false);
      setSlashQuery('');
      handleCanvasInput();
    } else if (textareaRef.current) {
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = markdown.substring(0, Math.max(0, start - (slashQuery.length + 1)));
      const after = markdown.substring(end);
      const newMd = before + cmd.template + after;
      setMarkdown(newMd);
      setHasChanges(true);
      setSlashMenuOpen(false);
      setTimeout(() => {
        ta.focus();
        const cursor = before.length + cmd.template.length;
        ta.setSelectionRange(cursor, cursor);
      }, 50);
    }
  };

  // Selection change for floating toolbar
  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !canvasRef.current?.contains(sel.anchorNode)) {
      setFloatingToolbarOpen(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width > 2) {
      setFloatingToolbarPos({
        top: Math.max(10, rect.top - 44),
        left: Math.max(20, rect.left + rect.width / 2 - 120),
      });
      setFloatingToolbarOpen(true);
    } else {
      setFloatingToolbarOpen(false);
    }
  };

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = () => {
    let mdToCopy = markdown;
    if (editorMode === 'canvas' && canvasRef.current) {
      mdToCopy = htmlToMarkdown(canvasRef.current.innerHTML);
    }
    navigator.clipboard.writeText(mdToCopy).then(() => {
      setCopiedMd(true);
      showToast('✓ Markdown copied to clipboard!');
      setTimeout(() => setCopiedMd(false), 2000);
    });
  };

  // Download .md file
  const handleDownloadMarkdown = () => {
    let mdToDownload = markdown;
    if (editorMode === 'canvas' && canvasRef.current) {
      mdToDownload = htmlToMarkdown(canvasRef.current.innerHTML);
    }
    const blob = new Blob([mdToDownload], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_') || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Downloaded ${a.download}`);
  };

  // Quick formatting buttons (Bold, Italic, etc.)
  const applyFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorMode === 'canvas') {
      handleCanvasInput();
    }
  };

  return (
    <div 
      ref={editorContainerRef}
      className={`flex-1 flex flex-col h-full overflow-hidden transition-colors ${
        isLight ? 'bg-[#f8f9fa] text-slate-900' : 'bg-[#101014] text-zinc-100'
      }`}
      onMouseUp={handleSelectionChange}
      onKeyUp={handleSelectionChange}
    >
      {/* =========================================================================
          TOP ACTION & NOTION CONTROLS BAR
         ========================================================================= */}
      <div className={`h-11 px-5 border-b flex items-center justify-between gap-4 shrink-0 shadow-xs z-20 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#15151a] border-[#222228]'
      }`}>
        {/* Left: View Mode Switcher & Page Look Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center p-0.5 rounded-lg border text-xs font-medium ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-800/60 border-zinc-700/50'
          }`}>
            <button
              onClick={() => handleSwitchMode('canvas')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                editorMode === 'canvas'
                  ? 'bg-[#f5a623] text-black font-bold shadow-xs'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-400 hover:text-white'
              }`}
              title="Doc Canvas (Visual Editor & Live Preview)"
            >
              <Eye size={12} />
              <span>Canvas</span>
            </button>
            <button
              onClick={() => handleSwitchMode('split')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                editorMode === 'split'
                  ? 'bg-[#f5a623] text-black font-bold shadow-xs'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-400 hover:text-white'
              }`}
              title="Split View (Markdown + Live Preview)"
            >
              <Columns size={12} />
              <span>Split</span>
            </button>
            <button
              onClick={() => handleSwitchMode('raw')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                editorMode === 'raw'
                  ? 'bg-[#f5a623] text-black font-bold shadow-xs'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-400 hover:text-white'
              }`}
              title="Direct Markdown Source"
            >
              <Code size={12} />
              <span>Markdown</span>
            </button>
          </div>

          {/* Continuous vs Paginated Look Switcher */}
          <div className={`flex items-center p-0.5 rounded-lg border text-xs font-medium ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-800/60 border-zinc-700/50'
          }`}>
            <button
              onClick={() => handleTogglePageLook('continuous')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                pageLook === 'continuous'
                  ? 'bg-[#f5a623] text-black font-bold shadow-xs'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-400 hover:text-white'
              }`}
              title="Continuous Web Look (Infinite Scroll / Smooth Flow)"
            >
              <Scroll size={12} />
              <span>Continuous</span>
            </button>
            <button
              onClick={() => handleTogglePageLook('paginated')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                pageLook === 'paginated'
                  ? 'bg-[#f5a623] text-black font-bold shadow-xs'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-400 hover:text-white'
              }`}
              title="Paginated Look (A4 Print Sheets with Margins, Headers & Footers)"
            >
              <BookOpen size={12} />
              <span>Paginated</span>
            </button>
          </div>

          {/* Typography Control: Font Family + Size */}
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-xs shadow-xs ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-300'
          }`}>
            <Type size={12} className="text-[#f5a623] shrink-0" />
            <select
              value={docFontFamily}
              onChange={(e) => setDocFontFamily(e.target.value as any)}
              className={`bg-transparent outline-none text-xs font-semibold cursor-pointer py-0.5 max-w-[95px] truncate ${
                isLight ? 'text-slate-800' : 'text-zinc-200'
              }`}
              title="Document Font Family"
            >
              <option value="inter" className="bg-zinc-900 text-white">Inter</option>
              <option value="calibri" className="bg-zinc-900 text-white">Calibri</option>
              <option value="serif" className="bg-zinc-900 text-white">Georgia</option>
              <option value="mono" className="bg-zinc-900 text-white">Mono</option>
            </select>

            <div className={`h-3 w-px mx-0.5 ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`} />

            {/* Compact Size Selector */}
            <div className="flex items-center gap-0.5">
              {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setDocFontSize(sz)}
                  className={`w-4.5 h-4.5 rounded text-[9.5px] font-mono font-bold uppercase flex items-center justify-center transition-all cursor-pointer ${
                    docFontSize === sz
                      ? 'bg-[#f5a623] text-black shadow-xs'
                      : isLight
                      ? 'text-slate-500 hover:text-slate-900'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title={`Font size ${sz.toUpperCase()}`}
                >
                  {sz.charAt(0)}
                </button>
              ))}
            </div>
          </div>

          {/* Paginated Controls: Zoom & Page Count */}
          {pageLook === 'paginated' && (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-xs ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-300'
            }`}>
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="p-1 hover:text-[#f5a623] transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={12} />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="font-mono text-[10px] w-9 text-center font-bold hover:text-[#f5a623] cursor-pointer"
                title="Reset Zoom to 100%"
              >
                {zoomLevel}%
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="p-1 hover:text-[#f5a623] transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={12} />
              </button>
              <div className="w-[1px] h-3 bg-zinc-600/40 mx-0.5" />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-[#f5a623] font-bold flex items-center gap-1">
                <Layers size={10} />
                <span>{paginatedResult.totalPages} {paginatedResult.totalPages === 1 ? 'Page' : 'Pages'}</span>
              </span>
            </div>
          )}

          {/* Width Mode Toggle (available in continuous canvas mode) */}
          {pageLook === 'continuous' && editorMode === 'canvas' && (
            <button
              onClick={() => setIsFullWidth(!isFullWidth)}
              className={`p-1 rounded-lg border transition-all text-xs flex items-center gap-1 cursor-pointer ${
                isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-600' : 'border-zinc-800 hover:bg-zinc-800 text-zinc-400'
              }`}
              title={isFullWidth ? 'Standard Page Width' : 'Full Width Canvas'}
            >
              {isFullWidth ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          )}

          {/* Theme Palette */}
          <div className="flex items-center gap-1 border-l pl-2 border-zinc-700/30">
            <button
              onClick={() => setDocTheme('default')}
              className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                docTheme === 'default' ? 'ring-2 ring-[#f5a623]' : 'opacity-60'
              } ${isLight ? 'bg-white border-slate-300' : 'bg-zinc-900 border-zinc-700'}`}
              title="Modern Clean"
            />
            <button
              onClick={() => setDocTheme('paper')}
              className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer bg-[#faf8f5] border-amber-200 ${
                docTheme === 'paper' ? 'ring-2 ring-[#f5a623]' : 'opacity-60'
              }`}
              title="Warm Paper"
            />
            <button
              onClick={() => setDocTheme('sepia')}
              className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer bg-[#f4ecd8] border-amber-300 ${
                docTheme === 'sepia' ? 'ring-2 ring-[#f5a623]' : 'opacity-60'
              }`}
              title="Sepia"
            />
          </div>
        </div>

        {/* Center: Live Word Count & Reading Time Pill */}
        <div className={`hidden md:flex items-center gap-2.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
        }`}>
          <span><strong>{stats.words}</strong> words</span>
          <span>&bull;</span>
          <span className="flex items-center gap-1"><Clock size={10} /> {stats.readingTimeMinutes}m read</span>
        </div>

        {/* Right: Export & Save Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyMarkdown}
            className={`px-2 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
              isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Copy as Markdown"
          >
            {copiedMd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="hidden sm:inline">{copiedMd ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className={`px-2 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
              isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Export .md file"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => performSave(false)}
            disabled={isSaving}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              hasChanges
                ? 'bg-[#f5a623] hover:bg-amber-400 text-black font-bold shadow-xs'
                : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:bg-zinc-800 hover:text-white'
            }`}
            title="Save Document (Cmd+S)"
          >
            <Save size={12} />
            <span>{isSaving ? 'Saving...' : hasChanges ? 'Save' : 'Saved'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN EDITING SURFACE
         ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* MODE 1: NOTION / GOOGLE DOCS CANVAS */}
        {editorMode === 'canvas' && (
          pageLook === 'continuous' ? (
            /* Continuous Canvas (Infinite Flow / Pageless) */
            <div className="flex-1 overflow-y-auto px-4 py-8 flex justify-center items-start custom-scrollbar">
              <div
                className={`w-full h-fit min-h-full transition-all duration-200 p-8 sm:p-12 mb-20 rounded-xl border shadow-xs ${
                  isFullWidth ? 'max-w-5xl' : 'max-w-3xl'
                } ${
                  docTheme === 'paper'
                    ? 'bg-[#faf8f5] text-slate-900 border-amber-200/60'
                    : docTheme === 'sepia'
                    ? 'bg-[#f4ecd8] text-amber-950 border-amber-300/60'
                    : isLight
                    ? 'bg-white text-slate-900 border-slate-200'
                    : 'bg-[#18181d] text-zinc-100 border-zinc-800'
                }`}
              >
                {/* Document Header (Icon + Title) */}
                <div className="mb-6 group">
                  <div className="relative inline-block mb-2">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="text-3xl p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-transform active:scale-95 cursor-pointer"
                      title="Change Document Icon"
                    >
                      {docIcon}
                    </button>

                    {/* Emoji Picker Popover */}
                    {showEmojiPicker && (
                      <div className="absolute top-12 left-0 z-50 p-2 rounded-xl shadow-lg border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 flex flex-wrap gap-1.5 w-60 animate-in fade-in duration-100">
                        {DOCUMENT_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              setDocIcon(emoji);
                              setShowEmojiPicker(false);
                              setHasChanges(true);
                            }}
                            className="w-7 h-7 text-lg flex items-center justify-center rounded hover:bg-amber-500/20 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Editable Big Title */}
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setHasChanges(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        canvasRef.current?.focus();
                      }
                    }}
                    placeholder="Untitled Document"
                    className="w-full text-2xl sm:text-3xl font-black tracking-tight bg-transparent border-0 outline-none placeholder:opacity-30 focus:ring-0 leading-tight"
                  />

                  <div className="flex items-center gap-2 mt-2 text-[11px] opacity-40 font-mono">
                    <span>Type <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">/</kbd> for commands</span>
                    <span>&bull;</span>
                    <span>Continuous Document Flow</span>
                  </div>
                </div>

                {/* Editable Body Canvas - Caret is 100% preserved without jumping! */}
                <div
                  ref={setCanvasRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleCanvasInput}
                  onKeyDown={handleCanvasKeyDown}
                  className="outline-none min-h-[500px] leading-relaxed focus:ring-0 prose dark:prose-invert max-w-none"
                  style={{
                    fontFamily: FONT_STYLE_MAP[docFontFamily],
                    fontSize: FONT_SIZE_PX_MAP[docFontSize],
                  }}
                />
              </div>
            </div>
          ) : (
            /* Paginated Canvas (Real Discrete A4 Printable Sheets) */
            <div className={`flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center custom-scrollbar ${
              isLight ? 'bg-slate-200/70' : 'bg-[#0d0d11]'
            }`}>
              <div
                className="flex flex-col items-center gap-8 transition-transform origin-top duration-150 pb-20 my-2"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              >
                {paginatedResult.pages.map((page, idx) => (
                  <div
                    key={page.pageNumber}
                    className={`w-[794px] min-h-[1123px] h-fit px-14 py-12 relative rounded-xs border flex flex-col justify-between transition-all shadow-xs ${
                      docTheme === 'paper'
                        ? 'bg-[#faf8f5] text-slate-900 border-amber-200'
                        : docTheme === 'sepia'
                        ? 'bg-[#f4ecd8] text-amber-950 border-amber-300'
                        : isLight
                        ? 'bg-white text-slate-900 border-slate-300'
                        : 'bg-[#18181d] text-zinc-100 border-zinc-700/80'
                    }`}
                  >
                    {/* Running Header */}
                    <div className="flex justify-between items-center text-[10px] pb-3 mb-6 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider select-none">
                      <span className="font-semibold truncate max-w-sm flex items-center gap-1.5">
                        <span>{docIcon}</span>
                        <span>{page.runningHeader}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[#f5a623] font-bold text-[9px] tracking-widest">
                        {doc.category || 'PRODUCTION MASTER'}
                      </span>
                    </div>

                    {/* First page only: Title Banner */}
                    {page.pageNumber === 1 && (
                      <div className="mb-6 group">
                        <div className="relative inline-block mb-2">
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="text-3xl p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-transform active:scale-95 cursor-pointer"
                            title="Change Document Icon"
                          >
                            {docIcon}
                          </button>

                          {/* Emoji Picker Popover */}
                          {showEmojiPicker && (
                            <div className="absolute top-12 left-0 z-50 p-2 rounded-xl shadow-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 flex flex-wrap gap-1.5 w-60 animate-in fade-in duration-100">
                              {DOCUMENT_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => {
                                    setDocIcon(emoji);
                                    setShowEmojiPicker(false);
                                    setHasChanges(true);
                                  }}
                                  className="w-7 h-7 text-lg flex items-center justify-center rounded hover:bg-amber-500/20 cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Editable Big Title */}
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            setHasChanges(true);
                          }}
                          placeholder="Untitled Document"
                          className="w-full text-2xl sm:text-3xl font-black tracking-tight bg-transparent border-0 outline-none placeholder:opacity-30 focus:ring-0 leading-tight"
                        />

                        <div className="flex items-center gap-2 mt-2 text-[11px] opacity-40 font-mono select-none">
                          <span className="text-[#f5a623] font-bold">Sheet 1 of {paginatedResult.totalPages}</span>
                          <span>&bull;</span>
                          <span>Discrete A4 Print View</span>
                        </div>
                      </div>
                    )}

                    {/* Page Content Slice (Editable) */}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="paginated-canvas-page-content outline-none leading-relaxed prose dark:prose-invert max-w-none flex-1 overflow-visible"
                      style={{
                        fontFamily: FONT_STYLE_MAP[docFontFamily],
                        fontSize: FONT_SIZE_PX_MAP[docFontSize],
                      }}
                      dangerouslySetInnerHTML={{ __html: page.html }}
                      onInput={handlePaginatedCanvasInput}
                      onKeyDown={handleCanvasKeyDown}
                    />

                    {/* Running Footer */}
                    <div className="flex justify-between items-center text-[10px] pt-4 mt-8 border-t border-zinc-200 dark:border-zinc-800 text-zinc-400 font-mono select-none">
                      <span>{page.runningFooter}</span>
                      <span className="text-zinc-500 font-medium font-mono">
                        Page {page.pageNumber} of {paginatedResult.totalPages} &bull; {page.wordCount} words
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* MODE 2: SPLIT VIEW (Markdown Editor Left + Live Preview Right) */}
        {editorMode === 'split' && (
          <div className="flex-1 flex divide-x divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
            {/* Left Pane: Markdown Textarea */}
            <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-[#121216] p-6 overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Code size={12} className="text-[#f5a623]" />
                  <span>Markdown Editor</span>
                </span>
                <span>Type '/' for blocks</span>
              </div>
              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => {
                  setMarkdown(e.target.value);
                  latestHtmlRef.current = markdownToHtml(e.target.value);
                  setHasChanges(true);
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = setTimeout(() => performSave(true), 1000);
                }}
                className="flex-1 w-full p-4 font-mono text-xs leading-relaxed bg-transparent outline-none resize-none custom-scrollbar"
                placeholder="Write Markdown here..."
              />
            </div>

            {/* Right Pane: Live Rendered Preview (Continuous or Paginated) */}
            {pageLook === 'continuous' ? (
              <div className="flex-1 flex flex-col h-full p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-[#18181d]">
                <div className="flex items-center justify-between pb-2 mb-4 border-b border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                    <Scroll size={12} className="text-[#f5a623]" />
                    <span>Continuous Live Preview</span>
                  </span>
                  <span>{stats.words} words</span>
                </div>
                <h1 className="text-2xl font-black mb-4 tracking-tight flex items-center gap-2">
                  <span>{docIcon}</span>
                  <span>{title}</span>
                </h1>
                <div 
                  className="leading-relaxed prose dark:prose-invert max-w-none"
                  style={{
                    fontFamily: FONT_STYLE_MAP[docFontFamily],
                    fontSize: FONT_SIZE_PX_MAP[docFontSize],
                  }}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }}
                />
              </div>
            ) : (
              <div className={`flex-1 flex flex-col h-full overflow-hidden ${
                isLight ? 'bg-slate-200/60' : 'bg-[#0d0d10]'
              }`}>
                {/* Subheader bar with page navigation info */}
                <div className="px-6 py-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-400 bg-white/50 dark:bg-[#141418]/60 backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <BookOpen size={13} className="text-[#f5a623]" />
                    <span className="font-semibold text-zinc-200">A4 Printable Pages</span>
                    <span className="text-zinc-600 dark:text-zinc-500">&bull;</span>
                    <span>{paginatedResult.totalPages} {paginatedResult.totalPages === 1 ? 'Sheet' : 'Sheets'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{stats.words} words</span>
                    <span>&bull;</span>
                    <span className="text-[#f5a623] font-semibold">{zoomLevel}% scale</span>
                  </div>
                </div>

                {/* Stacked A4 Sheets Container */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex flex-col items-center">
                  <div 
                    className="flex flex-col items-center gap-8 transition-transform origin-top duration-150 pb-16"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                  >
                    {paginatedResult.pages.map((page) => (
                      <div
                        key={page.pageNumber}
                        className={`w-[794px] min-h-[1123px] h-fit px-14 py-12 relative rounded-xs border flex flex-col justify-between transition-all shadow-xs ${
                          docTheme === 'paper'
                            ? 'bg-[#faf8f5] text-slate-900 border-amber-200'
                            : docTheme === 'sepia'
                            ? 'bg-[#f4ecd8] text-amber-950 border-amber-300'
                            : isLight
                            ? 'bg-white text-slate-900 border-slate-300'
                            : 'bg-[#18181d] text-zinc-100 border-zinc-700/80'
                        }`}
                      >
                        {/* Running Header */}
                        <div className="flex justify-between items-center text-[10px] pb-3 mb-6 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider select-none">
                          <span className="font-bold truncate max-w-sm flex items-center gap-1.5">
                            <span>{docIcon}</span>
                            <span>{page.runningHeader}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[#f5a623] font-bold text-[9px] tracking-widest">
                            {doc.category || 'PRODUCTION MASTER'}
                          </span>
                        </div>

                        {/* First Page Title Banner */}
                        {page.pageNumber === 1 && (
                          <div className="mb-6">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                              <span>{docIcon}</span>
                              <span>{title}</span>
                            </h1>
                          </div>
                        )}

                        {/* Page Content Slice */}
                        <div 
                          className="flex-1 leading-relaxed prose dark:prose-invert max-w-none overflow-visible"
                          style={{
                            fontFamily: FONT_STYLE_MAP[docFontFamily],
                            fontSize: FONT_SIZE_PX_MAP[docFontSize],
                          }}
                          dangerouslySetInnerHTML={{ __html: page.html }}
                        />

                        {/* Running Footer */}
                        <div className="flex justify-between items-center text-[10px] pt-4 mt-8 border-t border-zinc-200 dark:border-zinc-800 text-zinc-400 font-mono select-none">
                          <span>{page.runningFooter}</span>
                          <span className="text-zinc-500 font-medium">{page.wordCount} words</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: PURE RAW MARKDOWN */}
        {editorMode === 'raw' && (
          <div className="flex-1 flex flex-col h-full bg-[#121216] p-8 overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-4 border-b border-zinc-800 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-2">
                <FileText size={13} className="text-[#f5a623]" />
                <span>{doc.fileName || `${title}.md`}</span>
              </span>
              <span>{stats.lines} lines &bull; {stats.characters} chars</span>
            </div>
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => {
                setMarkdown(e.target.value);
                latestHtmlRef.current = markdownToHtml(e.target.value);
                setHasChanges(true);
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => performSave(true), 1000);
              }}
              className="flex-1 w-full p-6 font-mono text-xs leading-relaxed bg-zinc-950 text-amber-100/90 rounded-2xl border border-zinc-800 outline-none resize-none custom-scrollbar shadow-inner"
              placeholder="# Write markdown here..."
            />
          </div>
        )}

        {/* =========================================================================
            FLOATING SLASH COMMANDS MENU - EXACTLY AT THE BLINKING CURSOR
           ========================================================================= */}
        {slashMenuOpen && (
          <div
            className="fixed z-[9999] w-64 rounded-xl shadow-2xl border bg-white dark:bg-[#1c1c24] border-slate-200 dark:border-zinc-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ top: slashPosition.top, left: slashPosition.left }}
          >
            <div className="px-2.5 py-1.5 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Blocks</span>
              {slashQuery && <span className="text-amber-500">/{slashQuery}</span>}
            </div>
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
              {filteredCommands.length === 0 ? (
                <div className="p-2.5 text-xs text-zinc-400 text-center">No blocks matching &quot;{slashQuery}&quot;</div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    onClick={() => executeSlashCommand(cmd)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      idx === slashIndex
                        ? 'bg-[#f5a623] text-black font-semibold'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <span className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      {cmd.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold leading-tight truncate">{cmd.title}</div>
                      <div className="text-[10px] opacity-70 truncate">{cmd.description}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            FLOATING SELECTION FORMATTING TOOLBAR
           ========================================================================= */}
        {floatingToolbarOpen && (
          <div
            className="fixed z-[9999] flex items-center gap-0.5 p-1 rounded-xl shadow-2xl border bg-zinc-900 border-zinc-700 text-white animate-in fade-in duration-100"
            style={{ top: floatingToolbarPos.top, left: floatingToolbarPos.left }}
          >
            <button
              onClick={() => applyFormat('bold')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Bold (Cmd+B)"
            >
              <Bold size={12} />
            </button>
            <button
              onClick={() => applyFormat('italic')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Italic (Cmd+I)"
            >
              <Italic size={12} />
            </button>
            <button
              onClick={() => applyFormat('underline')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Underline (Cmd+U)"
            >
              <Underline size={12} />
            </button>
            <button
              onClick={() => applyFormat('strikeThrough')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Strikethrough"
            >
              <Strikethrough size={12} />
            </button>
            <button
              onClick={() => {
                document.execCommand('hiliteColor', false, '#fef08a');
                if (editorMode === 'canvas') {
                  if (pageLook === 'continuous') handleCanvasInput();
                  else handlePaginatedCanvasInput();
                }
              }}
              className="p-1 rounded hover:bg-zinc-800 text-amber-400 hover:text-amber-300"
              title="Highlight Text"
            >
              <Highlighter size={12} />
            </button>
            <div className="w-[1px] h-3.5 bg-zinc-700 mx-1" />
            <button
              onClick={() => applyFormat('formatBlock', '<h1>')}
              className="px-1.5 py-0.5 text-xs font-bold rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Heading 1"
            >
              H1
            </button>
            <button
              onClick={() => applyFormat('formatBlock', '<h2>')}
              className="px-1.5 py-0.5 text-xs font-bold rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Heading 2"
            >
              H2
            </button>
            <button
              onClick={() => applyFormat('insertUnorderedList')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Bullet List"
            >
              <List size={12} />
            </button>
            <button
              onClick={() => applyFormat('formatBlock', '<blockquote>')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="Quote"
            >
              <Quote size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
