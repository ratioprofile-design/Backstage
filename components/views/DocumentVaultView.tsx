import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { 
  ProductionDocument, 
  DocumentAnnotation, 
  AnnotationType, 
  CommentReply, 
  DocumentFormat 
} from '../../types';
import { 
  getProductionDocuments, 
  saveProductionDocuments, 
  addProductionDocument 
} from '../../services/documentsStorage';
import { parseUniversalFile } from '../../services/documentParser';
import { generateText } from '../../services/gemini';
import { isLegacyBamini, transcodeBaminiToUnicode, transcodeHtmlBaminiToUnicode } from '../../services/tamilTranscoder';
import { paginateDocumentHtml, paginatePlainText } from '../../services/documentPaginator';
import confetti from 'canvas-confetti';
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
  FolderOpen,
  Sparkles,
  Search,
  Check,
  CheckCircle2,
  Clock,
  User,
  Download,
  Share2,
  CornerDownRight,
  Send,
  Sliders,
  Maximize2,
  Table as TableIcon,
  Image as ImageIcon,
  BookOpen,
  Layers,
  HelpCircle,
  Copy,
  ExternalLink,
  Bot,
  RotateCcw,
  Maximize,
  Languages,
  FileStack,
  File,
  Columns,
  Settings2,
  Bold,
  Italic,
  Underline,
  Edit3,
  Eye,
  Save
} from 'lucide-react';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#fde047', bg: 'rgba(253, 224, 71, 0.35)' },
  { name: 'Green', color: '#86efac', bg: 'rgba(134, 239, 172, 0.35)' },
  { name: 'Blue', color: '#93c5fd', bg: 'rgba(147, 197, 253, 0.35)' },
  { name: 'Pink', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.35)' },
  { name: 'Amber', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.35)' },
];

const PEN_COLORS = ['#dc2626', '#18181b', '#2563eb', '#16a34a', '#d97706', '#9333ea'];

export const DocumentVaultView: React.FC = () => {
  const { appTheme, appAccentColor = '#f5a623', generalAiModel, openrouterKey } = useProject();
  const { aiAvailable } = useAiKeyStatus();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [documents, setDocuments] = useState<ProductionDocument[]>(() => getProductionDocuments());
  const [selectedDocId, setSelectedDocId] = useState<string>(() => documents[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'stacked' | 'single' | 'spread'>('stacked');
  const [isBaminiDetected, setIsBaminiDetected] = useState<boolean>(false);

  // Document Editing & Typography Customization
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [docFontSize, setDocFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [docFontFamily, setDocFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [customHeaderTitle, setCustomHeaderTitle] = useState<string>('');
  const [showFooter, setShowFooter] = useState<boolean>(true);
  const [customFooterText, setCustomFooterText] = useState<string>('');
  const [pageNumberFormat, setPageNumberFormat] = useState<'page-of-total' | 'page-only' | 'none'>('page-of-total');
  const [isFormattingDrawerOpen, setIsFormattingDrawerOpen] = useState<boolean>(false);
  const [editedHtmlContent, setEditedHtmlContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Active Annotation & Selection Tool
  const [activeTool, setActiveTool] = useState<AnnotationType | 'hand'>('hand');
  const [activeColor, setActiveColor] = useState<string>('#fde047');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);

  // Side-by-side Comments Panel State
  const [showCommentsPanel, setShowCommentsPanel] = useState<boolean>(true);
  const [activeSideTab, setActiveSideTab] = useState<'comments' | 'ai'>('comments');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState<{ [commentId: string]: string }>({});



  // Floating Selection Context Menu State
  const [selectionRange, setSelectionRange] = useState<{ text: string; rect: DOMRect } | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const isToolbarActionRef = useRef(false);

  // Floating AI Command Box State (Google Docs "Help me write / analyze" bar)
  const [isAiCommandOpen, setIsAiCommandOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Drawing state per page
  const [drawingPageNumber, setDrawingPageNumber] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentSheetRef = useRef<HTMLDivElement>(null);

  // Listen to live document updates across the workspace
  useEffect(() => {
    const handleDocsUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setDocuments(e.detail);
        if (!selectedDocId && e.detail[0]) {
          setSelectedDocId(e.detail[0].id);
        }
      }
    };
    window.addEventListener('backstage_documents_updated', handleDocsUpdated);
    return () => {
      window.removeEventListener('backstage_documents_updated', handleDocsUpdated);
    };
  }, [selectedDocId]);

  // Shortcut listener for Cmd+K / / to open AI Command Box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsAiCommandOpen((prev) => !prev);
      }
      // Escape key dismisses the selection toolbar and AI command modal
      if (e.key === 'Escape') {
        setSelectionRange(null);
        setIsAiCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dismiss the selection toolbar when the user clicks outside of it
  useEffect(() => {
    if (!selectionRange) return;

    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (selectionToolbarRef.current && selectionToolbarRef.current.contains(e.target as Node)) {
        return; // Click was inside the toolbar, don't dismiss
      }
      // Don't dismiss immediately — let handleTextSelection handle it via onMouseUp
    };

    // Dismiss on scroll (the rect position becomes stale)
    const handleScroll = () => {
      // Re-check if browser selection is still active
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectionRange(null);
      } else {
        // Update the toolbar position to follow scroll
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionRange((prev) => prev ? { ...prev, rect } : null);
      }
    };

    const scrollContainer = document.querySelector('.flex-1.overflow-auto');
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousedown', handleGlobalMouseDown);

    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousedown', handleGlobalMouseDown);
    };
  }, [selectionRange]);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const annotations = selectedDoc?.annotations || [];
  const pageAnnotations = annotations.filter((a) => a.pageNumber === currentPage);

  // Precision Document Pagination Engine pass with dynamic font size, family and edit state
  const paginatedDoc = useMemo(() => {
    if (!selectedDoc) return { totalPages: 1, pages: [] };
    const content = editedHtmlContent || selectedDoc.htmlContent;
    const targetHeightPx = showHeader && showFooter ? 860 : (showHeader || showFooter ? 910 : 960);

    if (content && !selectedDoc.sheetData) {
      return paginateDocumentHtml(content, { 
        fontSize: docFontSize, 
        fontFamily: docFontFamily,
        targetHeightPx
      });
    }
    if (selectedDoc.textContent && !selectedDoc.sheetData && !selectedDoc.imageDataUrl && !selectedDoc.pdfDataUrl) {
      return paginatePlainText(selectedDoc.textContent, { 
        fontSize: docFontSize, 
        fontFamily: docFontFamily,
        targetHeightPx
      });
    }
    return { 
      totalPages: selectedDoc.pageCount || 1, 
      pages: [] 
    };
  }, [
    selectedDoc?.id, 
    selectedDoc?.htmlContent, 
    selectedDoc?.textContent, 
    editedHtmlContent, 
    docFontSize, 
    docFontFamily, 
    showHeader, 
    showFooter, 
    selectedDoc?.sheetData, 
    selectedDoc?.imageDataUrl, 
    selectedDoc?.pdfDataUrl, 
    selectedDoc?.pageCount
  ]);

  const totalPages = Math.max(1, paginatedDoc.totalPages || selectedDoc?.pageCount || 1);

  // Check and Auto-transcode legacy Bamini typewriter fonts to Tamil Unicode on document open
  useEffect(() => {
    if (!selectedDoc) return;
    const rawText = selectedDoc.textContent || '';
    const rawHtml = selectedDoc.htmlContent || '';
    const hasBamini = isLegacyBamini(rawText) || isLegacyBamini(rawHtml);
    setIsBaminiDetected(hasBamini);

    if (hasBamini) {
      const convertedText = transcodeBaminiToUnicode(rawText);
      const convertedHtml = rawHtml ? transcodeHtmlBaminiToUnicode(rawHtml) : undefined;

      const updatedDocs = documents.map((d) => {
        if (d.id === selectedDoc.id) {
          return {
            ...d,
            textContent: convertedText,
            htmlContent: convertedHtml || d.htmlContent,
          };
        }
        return d;
      });

      updateDocuments(updatedDocs);
      showToast('Bamini script auto-transcoded to Tamil Unicode!');
    }
  }, [selectedDocId]);

  // Manual Bamini Transcoder action
  const handleTranscodeBamini = (force: boolean = false) => {
    if (!selectedDoc) return;
    const rawText = selectedDoc.textContent || '';
    const rawHtml = selectedDoc.htmlContent || '';

    if (!force && !isLegacyBamini(rawText) && !isLegacyBamini(rawHtml)) {
      showToast('No Bamini script detected in this document.');
      return;
    }

    const convertedText = transcodeBaminiToUnicode(rawText);
    const convertedHtml = rawHtml ? transcodeHtmlBaminiToUnicode(rawHtml) : undefined;

    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        return {
          ...d,
          textContent: convertedText,
          htmlContent: convertedHtml || d.htmlContent,
        };
      }
      return d;
    });

    updateDocuments(updatedDocs);
    showToast('Transcoded document to Tamil Unicode!');
  };

  // Save in-place edited document content to Production Vault
  const handleSaveDocumentContent = () => {
    if (!selectedDoc) return;
    const contentToSave = editedHtmlContent || selectedDoc.htmlContent || '';
    const plainText = contentToSave.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        return {
          ...d,
          htmlContent: contentToSave,
          textContent: plainText || d.textContent,
        };
      }
      return d;
    });

    updateDocuments(updatedDocs);
    setHasUnsavedChanges(false);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
    showToast('Saved changes to Production Vault!');
  };

  // Smooth Page Navigation Handler (supports single, stacked, and 2-page spread)
  const handlePageChange = (newPage: number) => {
    const target = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(target);
    if (viewMode === 'stacked') {
      const el = document.getElementById(`doc-page-${target}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Persist documents on change
  const updateDocuments = (docs: ProductionDocument[]) => {
    setDocuments(docs);
    saveProductionDocuments(docs);
  };

  const handleSelectDoc = (id: string) => {
    setSelectedDocId(id);
    setCurrentPage(1);
    setSelectionRange(null);
    setSelectedCommentId(null);
    setEditedHtmlContent('');
    setHasUnsavedChanges(false);
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      const matchCat = selectedCategory === 'ALL' || d.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [documents, selectedCategory, searchQuery]);

  // Handle Universal File Upload (Word, PDF, Images, Spreadsheets, Markdown)
  const handleUniversalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseUniversalFile(
        file,
        (selectedCategory === 'ALL' ? 'OTHER' : selectedCategory) as any
      );

      const newDoc: ProductionDocument = {
        id: `doc-${Date.now()}`,
        title: parsed.title,
        category: parsed.category,
        fileName: parsed.fileName,
        fileSize: parsed.fileSize,
        fileType: parsed.fileType,
        pageCount: parsed.pageCount,
        uploadedAt: new Date().toISOString(),
        pdfDataUrl: parsed.pdfDataUrl,
        imageDataUrl: parsed.imageDataUrl,
        htmlContent: parsed.htmlContent,
        textContent: parsed.textContent,
        sheetData: parsed.sheetData,
        annotations: [],
      };

      const updated = [newDoc, ...documents];
      updateDocuments(updated);
      setSelectedDocId(newDoc.id);
      setCurrentPage(1);
      confetti({ particleCount: 30, spread: 45, origin: { y: 0.6 } });
      showToast(`Imported ${parsed.fileName} into Production Vault!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to parse uploaded document.');
    }
  };

  // Text selection handler on document paper
  const handleTextSelection = (e: React.MouseEvent) => {
    // Guard: Don't dismiss the toolbar if the user clicked inside it
    if (isToolbarActionRef.current) {
      isToolbarActionRef.current = false;
      return;
    }
    if (selectionToolbarRef.current && selectionToolbarRef.current.contains(e.target as Node)) {
      return;
    }

    // Small delay to let the browser finalize text selection after mouseUp
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectionRange(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionRange({ text, rect });
      }
    });
  };

  // Add Comment from selected text
  const handleAddCommentFromSelection = (commentText: string = '') => {
    isToolbarActionRef.current = true;
    if (!selectedDoc) return;
    const selectedSnippet = selectionRange?.text || '';

    // Safely wrap the selected text with an amber highlight mark
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        // Only use surroundContents if range is within a single element (safe path)
        const mark = document.createElement('mark');
        mark.style.backgroundColor = 'rgba(245, 166, 35, 0.25)';
        mark.style.borderBottom = '2px solid #f5a623';
        mark.style.color = 'inherit';
        mark.style.padding = '1px 2px';
        mark.style.borderRadius = '2px';
        mark.style.cursor = 'pointer';
        mark.className = 'backstage-comment-mark';
        if (range.startContainer === range.endContainer || 
            range.startContainer.parentElement === range.endContainer.parentElement) {
          range.surroundContents(mark);
        } else {
          // Cross-element selection: clone content instead of mutating
          const fragment = range.cloneContents();
          mark.appendChild(fragment);
          range.deleteContents();
          range.insertNode(mark);
        }
        selection.removeAllRanges();

        // Sync DOM changes back to edited HTML for persistence
        syncDomToEditedHtml(mark);
      } catch {
        // Continue saving annotation even if mark wrapping failed
      }
    }

    const newAnno: DocumentAnnotation = {
      id: `comment-${Date.now()}`,
      documentId: selectedDoc.id,
      pageNumber: currentPage,
      type: 'comment',
      color: activeColor,
      text: commentText || 'Review this section with director & production team.',
      selectedText: selectedSnippet,
      author: 'Production Team',
      status: 'open',
      createdAt: new Date().toISOString(),
      replies: [],
    };

    saveAnnotation(newAnno);
    setSelectedCommentId(newAnno.id);
    setShowCommentsPanel(true);
    setActiveSideTab('comments');
    setSelectionRange(null);
    showToast('Added comment note to thread!');
  };

  // Helper: Sync DOM mutations (marks, highlights) back to the edited HTML state for persistence
  const syncDomToEditedHtml = (referenceNode: HTMLElement) => {
    try {
      // In stacked mode, gather all pages' prose content back into a single HTML string
      if (viewMode === 'stacked') {
        const allPageSheets = document.querySelectorAll('[id^="doc-page-"]');
        const allHtml: string[] = [];
        allPageSheets.forEach((sheet) => {
          const proseDiv = sheet.querySelector('.prose');
          if (proseDiv) allHtml.push(proseDiv.innerHTML);
        });
        if (allHtml.length > 0) {
          setEditedHtmlContent(allHtml.join('\n'));
          setHasUnsavedChanges(true);
        }
      } else {
        // Single / spread mode: just capture the current page
        const targetSheet = referenceNode.closest('[id^="doc-page-"]') || document.querySelector('[id^="doc-page-"]');
        if (targetSheet) {
          const proseDiv = targetSheet.querySelector('.prose');
          if (proseDiv) {
            setEditedHtmlContent(proseDiv.innerHTML);
            setHasUnsavedChanges(true);
          }
        }
      }
    } catch {
      // Non-critical: highlights still work visually even if sync fails
    }
  };

  // Highlight selected text with actual visual mark element & annotation persistence
  const handleHighlightSelection = (color: string) => {
    isToolbarActionRef.current = true;
    if (!selectedDoc || !selectionRange) return;
    const selection = window.getSelection();

    // 1. Physically highlight the text in the rendered document DOM
    if (selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.style.backgroundColor = color;
        mark.style.color = '#111827';
        mark.style.padding = '1px 3px';
        mark.style.borderRadius = '3px';
        mark.style.cursor = 'pointer';
        mark.className = 'backstage-highlight-mark';

        // Safe wrapping: use surroundContents when possible, fallback for cross-element ranges
        if (range.startContainer === range.endContainer || 
            range.startContainer.parentElement === range.endContainer.parentElement) {
          range.surroundContents(mark);
        } else {
          const fragment = range.cloneContents();
          mark.appendChild(fragment);
          range.deleteContents();
          range.insertNode(mark);
        }
        selection.removeAllRanges();

        // Sync DOM changes back to edited HTML for persistence
        syncDomToEditedHtml(mark);
      } catch (err) {
        console.warn('Highlight wrapping fallback', err);
      }
    }

    // 2. Save annotation record
    const newAnno: DocumentAnnotation = {
      id: `hl-${Date.now()}`,
      documentId: selectedDoc.id,
      pageNumber: currentPage,
      type: 'highlight',
      color: color,
      opacity: 0.4,
      selectedText: selectionRange.text,
      createdAt: new Date().toISOString(),
    };
    saveAnnotation(newAnno);
    setSelectionRange(null);
    showToast('Highlighted selected text!');
  };

  // Selection to AI Command Box Executor
  const handleOpenAiWithSelection = (customTask?: string) => {
    isToolbarActionRef.current = true;
    if (!selectionRange && !aiPrompt) return;
    const selectedTextSnippet = selectionRange?.text || '';
    const task = customTask 
      ? `${customTask} for this excerpt from ${selectedDoc?.title}:\n"${selectedTextSnippet}"`
      : `Analyze the following excerpt from ${selectedDoc?.title}:\n"${selectedTextSnippet}"`;
    
    setAiPrompt(task);
    setSelectionRange(null);

    // Auto-switch to AI Co-Pilot sidebar tab and open the panel
    setShowCommentsPanel(true);
    setActiveSideTab('ai');

    if (customTask) {
      // Run directly in the sidebar AI panel
      handleRunAiCommand(task);
    }

    // Clear browser selection visually
    window.getSelection()?.removeAllRanges();
  };

  // Save Annotation helper
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

  // Delete Annotation / Comment / Sticky Note
  const handleDeleteAnnotation = (annoId: string) => {
    if (!selectedDoc) return;
    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        return { ...d, annotations: d.annotations.filter((a) => a.id !== annoId) };
      }
      return d;
    });
    updateDocuments(updatedDocs);
    if (selectedCommentId === annoId) setSelectedCommentId(null);
    showToast('Deleted annotation!');
  };

  // Toggle Resolve Comment
  const handleToggleResolveComment = (annoId: string) => {
    if (!selectedDoc) return;
    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        const updatedAnnos = d.annotations.map((a) => {
          if (a.id === annoId) {
            return { ...a, status: a.status === 'resolved' ? 'open' : 'resolved' };
          }
          return a;
        });
        return { ...d, annotations: updatedAnnos as any };
      }
      return d;
    });
    updateDocuments(updatedDocs);
  };

  // Add reply to comment thread
  const handleAddReply = (commentId: string) => {
    const text = (replyInput[commentId] || '').trim();
    if (!text || !selectedDoc) return;

    const newReply: CommentReply = {
      id: `reply-${Date.now()}`,
      author: 'Production Member',
      text,
      createdAt: new Date().toISOString(),
    };

    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        const updatedAnnos = d.annotations.map((a) => {
          if (a.id === commentId) {
            return { ...a, replies: [...(a.replies || []), newReply] };
          }
          return a;
        });
        return { ...d, annotations: updatedAnnos };
      }
      return d;
    });

    updateDocuments(updatedDocs);
    setReplyInput((prev) => ({ ...prev, [commentId]: '' }));
  };

  // Delete document
  const handleDeleteDocument = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this document from the Vault?')) {
      const updated = documents.filter((d) => d.id !== docId);
      updateDocuments(updated);
      if (selectedDocId === docId) {
        setSelectedDocId(updated[0]?.id || '');
      }
    }
  };

  // AI Command Execution (Google Docs Style "Help Me Write / Analyze")
  const handleRunAiCommand = async (customCommand?: string) => {
    const commandToRun = customCommand || aiPrompt;
    if (!commandToRun.trim() || !selectedDoc) return;

    setIsAiLoading(true);
    setAiResponse(null);

    try {
      const docContext = selectedDoc.textContent || selectedDoc.htmlContent || selectedDoc.title;
      const prompt = `You are a film production legal, directorial, and script assistant.
Document Title: ${selectedDoc.title} (${selectedDoc.category})
Document Context Snippet:
"""${docContext.slice(0, 3500)}"""

User Task:
${commandToRun}

Provide a concise, direct, professional response with clean bullet points:`;

      const response = await generateText(
        prompt,
        generalAiModel || 'gemini-2.5-flash',
        openrouterKey
      );

      setAiResponse(response);
    } catch (err: any) {
      console.error(err);
      setAiResponse('AI analysis failed. Please verify your API key.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Sheet-specific Mouse Coordinates helper for drawing on individual pages
  // The SVG sits inside a sheet (780×1060px) that is already CSS-transformed by the zoom container.
  // getBoundingClientRect() returns screen-space coords (already accounts for CSS scale),
  // so we must invert the scale to get the original page-space coordinates.
  const getSheetCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = zoomLevel / 100;
    // rect.width is the scaled width; the sheet's intrinsic width is rect.width / scale
    // We want coordinates relative to the unscaled sheet dimensions
    return {
      x: Math.round((e.clientX - rect.left) / scale),
      y: Math.round((e.clientY - rect.top) / scale),
    };
  };

  const handleSheetMouseDown = (e: React.MouseEvent<SVGSVGElement>, targetPageNumber: number) => {
    if (activeTool === 'hand') return;
    const { x, y } = getSheetCoords(e);
    setDrawingPageNumber(targetPageNumber);
    setIsDrawing(true);
    setStartPoint({ x, y });

    if (activeTool === 'pen') {
      setCurrentPath([{ x, y }]);
    } else if (activeTool === 'rect' || activeTool === 'highlight') {
      setCurrentRect({ x, y, width: 0, height: 0 });
    } else if (activeTool === 'note') {
      const noteText = prompt('Enter Sticky Note text:');
      if (noteText && noteText.trim()) {
        saveAnnotation({
          id: `note-${Date.now()}`,
          documentId: selectedDoc.id,
          pageNumber: targetPageNumber,
          type: 'note',
          color: activeColor,
          x,
          y,
          text: noteText.trim(),
          author: 'Production Team',
          createdAt: new Date().toISOString(),
        });
        showToast(`Added Sticky Note to page ${targetPageNumber}!`);
      }
      setIsDrawing(false);
      setDrawingPageNumber(null);
    }
  };

  const handleSheetMouseMove = (e: React.MouseEvent<SVGSVGElement>, targetPageNumber: number) => {
    if (!isDrawing || drawingPageNumber !== targetPageNumber) return;
    const { x, y } = getSheetCoords(e);

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

  const handleSheetMouseUp = (e: React.MouseEvent<SVGSVGElement>, targetPageNumber: number) => {
    if (!isDrawing || drawingPageNumber !== targetPageNumber || !selectedDoc) return;
    setIsDrawing(false);

    if (activeTool === 'pen' && currentPath.length > 1) {
      saveAnnotation({
        id: `ann-${Date.now()}`,
        documentId: selectedDoc.id,
        pageNumber: targetPageNumber,
        type: 'pen',
        color: activeColor,
        strokeWidth,
        points: currentPath,
        createdAt: new Date().toISOString(),
      });
      setCurrentPath([]);
    } else if ((activeTool === 'rect' || activeTool === 'highlight') && currentRect && currentRect.width > 4) {
      saveAnnotation({
        id: `ann-${Date.now()}`,
        documentId: selectedDoc.id,
        pageNumber: targetPageNumber,
        type: activeTool,
        color: activeColor,
        strokeWidth: activeTool === 'rect' ? strokeWidth : 0,
        opacity: activeTool === 'highlight' ? 0.35 : 1,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
        createdAt: new Date().toISOString(),
      });
      setCurrentRect(null);
    }
    setDrawingPageNumber(null);
    setStartPoint(null);
  };

  // Reusable Page Annotation & Drawing Layer rendered directly inside each page sheet
  const renderPageAnnotations = (pageNumber: number) => {
    const pageAnnos = annotations.filter((a) => a.pageNumber === pageNumber);
    const pageNotes = pageAnnos.filter((a) => a.type === 'note' && a.x !== undefined && a.y !== undefined);

    return (
      <>
        {/* SVG Drawing & Shape Layer */}
        <svg
          className={`absolute inset-0 w-full h-full ${
            activeTool === 'hand' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
          }`}
          style={{ zIndex: 20 }}
          onMouseDown={(e) => handleSheetMouseDown(e, pageNumber)}
          onMouseMove={(e) => handleSheetMouseMove(e, pageNumber)}
          onMouseUp={(e) => handleSheetMouseUp(e, pageNumber)}
        >
          {pageAnnos.map((anno) => {
            if (anno.type === 'highlight' && anno.width && anno.height) {
              return (
                <rect
                  key={anno.id}
                  x={anno.x}
                  y={anno.y}
                  width={anno.width}
                  height={anno.height}
                  fill={anno.color}
                  fillOpacity={anno.opacity || 0.35}
                  rx={2}
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
                  rx={2}
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

          {/* Live Drawing Preview */}
          {isDrawing && drawingPageNumber === pageNumber && (
            <>
              {activeTool === 'pen' && currentPath.length > 1 && (
                <path
                  d={currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {(activeTool === 'rect' || activeTool === 'highlight') && currentRect && (
                <rect
                  x={currentRect.x}
                  y={currentRect.y}
                  width={currentRect.width}
                  height={currentRect.height}
                  fill={activeTool === 'highlight' ? activeColor : 'none'}
                  fillOpacity={activeTool === 'highlight' ? 0.35 : 0}
                  stroke={activeColor}
                  strokeWidth={activeTool === 'rect' ? strokeWidth : 0}
                  rx={2}
                />
              )}
            </>
          )}
        </svg>

        {/* Interactive Sticky Note Pins */}
        {pageNotes.map((note) => (
          <div
            key={note.id}
            style={{
              position: 'absolute',
              left: `${note.x}px`,
              top: `${note.y}px`,
              zIndex: 25,
              transform: 'translate(-50%, -50%)',
            }}
            className="group"
          >
            <button
              onClick={() => setSelectedCommentId(selectedCommentId === note.id ? null : note.id)}
              className="w-7 h-7 rounded-full bg-amber-400 text-black shadow-lg border-2 border-white flex items-center justify-center hover:scale-125 transition-transform cursor-pointer"
              title={note.text || 'Sticky note'}
            >
              <StickyNote size={13} className="fill-amber-400" />
            </button>

            {/* Note popup on select */}
            {selectedCommentId === note.id && (
              <div className="absolute left-8 top-0 w-60 p-3 rounded-xl bg-amber-100 text-slate-900 border border-amber-300 shadow-2xl z-30 animate-in zoom-in-95 text-xs font-sans">
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-amber-200">
                  <span className="font-bold text-[10px] text-amber-900 uppercase tracking-wider">📌 Sticky Note</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAnnotation(note.id);
                    }}
                    className="text-amber-800 hover:text-red-600 p-0.5 rounded"
                    title="Delete note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-xs leading-relaxed font-medium">{note.text}</p>
                <div className="mt-2 pt-1 border-t border-amber-200 text-[9.5px] text-amber-800 flex justify-between">
                  <span>Page {pageNumber}</span>
                  <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </>
    );
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'BREAKDOWN': return <FileText size={14} className="text-amber-400" />;
      case 'LOOKBOOK': return <Palette size={14} className="text-pink-400" />;
      case 'CALLSHEET': return <FileText size={14} className="text-cyan-400" />;
      case 'SAFETY': return <Shield size={14} className="text-red-400" />;
      case 'PERMIT': return <FileCheck size={14} className="text-emerald-400" />;
      case 'CONTRACT': return <Scale size={14} className="text-amber-400" />;
      case 'SCRIPT': return <BookOpen size={14} className="text-purple-400" />;
      case 'SCHEDULE': return <Clock size={14} className="text-blue-400" />;
      default: return <Folder size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className={`w-full h-full flex font-sans overflow-hidden select-none ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0a0a0e] text-gray-100'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-950/90 text-white border border-white/10 shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 size={15} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Left Library Sidebar (Categories, Dropzone, Search, Docs List) */}
      <div className={`w-72 flex-shrink-0 flex flex-col border-r ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#111116] border-[#222]'
      }`}>
        <div className="p-3.5 border-b border-inherit space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black flex items-center gap-2 uppercase tracking-wider">
              <FolderOpen className="text-amber-500" size={16} />
              Production Vault
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1 transition-all shadow-xs"
            >
              <Upload size={12} />
              Import File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.svg,.txt,.fountain"
              onChange={handleUniversalUpload}
              className="hidden"
            />
          </div>

          {/* Search Box */}
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#181820] border-white/10 text-white'
          }`}>
            <Search size={13} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search documents, clauses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-xs"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {['ALL', 'BREAKDOWN', 'LOOKBOOK', 'CALLSHEET', 'SCRIPT', 'SCHEDULE', 'SAFETY', 'PERMIT', 'CONTRACT', 'OTHER'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-black'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                    : 'bg-[#181820] border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Document Cards List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {filteredDocs.map((doc) => {
            const isSelected = doc.id === selectedDocId;
            const commentsCount = (doc.annotations || []).filter((a) => a.type === 'comment' || a.type === 'note').length;

            return (
              <div
                key={doc.id}
                onClick={() => handleSelectDoc(doc.id)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all group relative ${
                  isSelected
                    ? isLight
                      ? 'bg-amber-500/10 border-amber-500 shadow-xs'
                      : 'bg-[#1c1c26] border-amber-500 shadow-md'
                    : isLight
                    ? 'bg-slate-50 hover:bg-white border-slate-200'
                    : 'bg-[#16161c] hover:bg-[#1c1c24] border-white/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">{getCategoryIcon(doc.category)}</div>
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-xs font-bold truncate">{doc.title}</h3>
                    <p className={`text-[10px] mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-gray-400">
                      <span>{doc.fileSize}</span>
                      <span>•</span>
                      <span>{doc.pageCount} Pages</span>
                      {commentsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-bold">{commentsCount} Notes</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteDocument(e, doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-opacity absolute top-2 right-2"
                    title="Delete document"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Main Central Workspace (Google Docs-Style Topbar & Paper Viewer) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Google Docs Formatting & Zoom Toolbar */}
        <div className={`p-2.5 px-5 border-b flex items-center justify-between flex-wrap gap-3 shrink-0 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#121218] border-[#222]'
        }`}>
          {/* Left: Tools selection (Hand, Highlight, Pen, Rect, Note, Comment) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTool('hand')}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'hand'
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5'
              }`}
              title="Hand Tool / Text Select Mode"
            >
              <Hand size={14} />
            </button>
            <button
              onClick={() => { setActiveTool('highlight'); setActiveColor('#fde047'); }}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'highlight'
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5'
              }`}
              title="Highlighter"
            >
              <Highlighter size={14} />
            </button>
            <button
              onClick={() => { setActiveTool('pen'); setActiveColor('#dc2626'); }}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'pen'
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5'
              }`}
              title="Pen Drawing Tool"
            >
              <PenTool size={14} />
            </button>
            <button
              onClick={() => setActiveTool('rect')}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'rect'
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5'
              }`}
              title="Bounding Box Rectangle"
            >
              <Square size={14} />
            </button>
            <button
              onClick={() => setActiveTool('note')}
              className={`p-1.5 rounded-lg border transition-colors ${
                activeTool === 'note'
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                  : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5'
              }`}
              title="Add Sticky Note Pin"
            >
              <StickyNote size={14} />
            </button>

            {/* Color Palette */}
            {activeTool !== 'hand' && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-inherit">
                {(activeTool === 'highlight' ? HIGHLIGHT_COLORS.map(c => c.color) : PEN_COLORS).map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveColor(c)}
                    className="w-3.5 h-3.5 rounded-full border transition-transform hover:scale-125"
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

          {/* Center: Pagination, View Mode & Zoom Controls */}
          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Multi-page Stacked Sheets vs Single Page Flip vs Two-Page Spread */}
            <div className={`flex items-center rounded-lg border p-0.5 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/20 border-white/10'
            }`}>
              <button
                onClick={() => setViewMode('stacked')}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-bold transition-all ${
                  viewMode === 'stacked'
                    ? 'bg-amber-500 text-black shadow-xs'
                    : isLight ? 'text-slate-600 hover:text-black' : 'text-gray-400 hover:text-white'
                }`}
                title="Continuous Multi-page Stacked View"
              >
                <FileStack size={12} />
                <span className="text-[10.5px]">Sheets</span>
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-bold transition-all ${
                  viewMode === 'single'
                    ? 'bg-amber-500 text-black shadow-xs'
                    : isLight ? 'text-slate-600 hover:text-black' : 'text-gray-400 hover:text-white'
                }`}
                title="Single Page View"
              >
                <File size={12} />
                <span className="text-[10.5px]">Single</span>
              </button>
              <button
                onClick={() => setViewMode('spread')}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-bold transition-all ${
                  viewMode === 'spread'
                    ? 'bg-amber-500 text-black shadow-xs'
                    : isLight ? 'text-slate-600 hover:text-black' : 'text-gray-400 hover:text-white'
                }`}
                title="Two-Page Spread (Side-by-Side Book View)"
              >
                <Columns size={12} />
                <span className="text-[10.5px]">Spread</span>
              </button>
            </div>

            {/* Page Navigation Controls */}
            <div className="flex items-center gap-1 border-l border-inherit pl-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(viewMode === 'spread' ? Math.max(1, currentPage - 2) : currentPage - 1)}
                className="p-1 rounded border disabled:opacity-30 border-inherit hover:bg-white/10"
                title="Previous Page"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-xs font-mono px-2">
                {viewMode === 'spread' 
                  ? `Pages ${Math.floor((currentPage - 1) / 2) * 2 + 1}-${Math.min(totalPages, Math.floor((currentPage - 1) / 2) * 2 + 2)} of ${totalPages}`
                  : `Page ${currentPage} of ${totalPages}`
                }
              </span>
              <button
                disabled={viewMode === 'spread' ? (Math.floor((currentPage - 1) / 2) * 2 + 2 >= totalPages) : (currentPage >= totalPages)}
                onClick={() => handlePageChange(viewMode === 'spread' ? Math.min(totalPages, currentPage + 2) : currentPage + 1)}
                className="p-1 rounded border disabled:opacity-30 border-inherit hover:bg-white/10"
                title="Next Page"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-l border-inherit pl-3">
              <button
                onClick={() => setZoomLevel((z) => Math.max(40, z - 15))}
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
          </div>

          {/* Right: Bamini Transcode, Edit / Formatting, AI Command, Comments, Print */}
          <div className="flex items-center gap-2">
            {/* Bamini to Tamil Unicode Button - ONLY APPEARS IF BAMINI SCRIPT IS DETECTED */}
            {isBaminiDetected && (
              <button
                onClick={() => handleTranscodeBamini(true)}
                className="px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs bg-amber-500/20 text-amber-500 border-amber-500/40 hover:bg-amber-500/30"
                title="Transcode legacy Bamini typewriter font to standard Tamil Unicode"
              >
                <Languages size={13} className="text-amber-500 animate-pulse" />
                <span>Bamini → Unicode</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Bamini script detected" />
              </button>
            )}

            {/* Document Edit Mode & Formatting Toggle */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                isEditMode
                  ? 'bg-purple-500 text-white border-purple-400 shadow-xs'
                  : isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#181820] border-white/10 text-gray-300 hover:text-white'
              }`}
              title="Toggle In-place Document Edit Mode"
            >
              {isEditMode ? <Eye size={13} /> : <Edit3 size={13} />}
              <span>{isEditMode ? 'Read Mode' : 'Edit Doc'}</span>
            </button>

            {/* Header & Footer Customization Settings Button */}
            <button
              onClick={() => setIsFormattingDrawerOpen(!isFormattingDrawerOpen)}
              className={`p-1.5 rounded-lg border transition-all ${
                isFormattingDrawerOpen
                  ? 'bg-amber-500 text-black border-amber-400 shadow-xs'
                  : isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#181820] border-white/10 text-gray-300'
              }`}
              title="Header, Footer & Typography Settings"
            >
              <Settings2 size={13} />
            </button>

            {/* Save Changes Button (Visible when changes exist) */}
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveDocumentContent}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 border border-emerald-400 text-xs font-black flex items-center gap-1.5 shadow-md animate-bounce"
                title="Save Edits to Production Vault"
              >
                <Save size={13} />
                <span>Save</span>
              </button>
            )}

            {/* Google Docs AI Command Box Button */}
            <button
              onClick={() => setIsAiCommandOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              title="Help Me Write / Analyze (Cmd+K)"
            >
              <Sparkles size={13} />
              <span>AI Command</span>
              <span className="text-[9px] font-mono px-1 rounded bg-sky-500/20 opacity-80">⌘K</span>
            </button>

            {/* Comments Sidebar Toggle */}
            <button
              onClick={() => setShowCommentsPanel(!showCommentsPanel)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                showCommentsPanel
                  ? 'bg-amber-500 text-black border-amber-400 shadow-xs'
                  : isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#181820] border-white/10 text-gray-300'
              }`}
              title="Toggle Side-by-side Comments Panel"
            >
              <MessageSquare size={13} />
              <span>Comments ({annotations.filter(a => a.type === 'comment').length})</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-lg border border-inherit hover:bg-white/10 text-gray-300"
              title="Print Document"
            >
              <Printer size={14} />
            </button>
          </div>
        </div>

        {/* Header & Footer / Typography Settings Floating Drawer */}
        {isFormattingDrawerOpen && (
          <div className={`border-b p-3 px-6 flex flex-wrap items-center justify-between gap-4 text-xs font-sans animate-in slide-in-from-top-2 ${
            isLight ? 'bg-amber-50/70 border-amber-200 text-slate-900' : 'bg-[#15151e] border-white/10 text-gray-200'
          }`}>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Text Size */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400">Text Size:</span>
                <div className="flex items-center rounded-lg border border-inherit p-0.5 bg-black/5 dark:bg-white/5">
                  {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setDocFontSize(sz)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-all ${
                        docFontSize === sz ? 'bg-amber-500 text-black shadow-xs' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {sz === 'sm' ? '10pt' : sz === 'md' ? '12pt' : sz === 'lg' ? '14pt' : '18pt'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400">Font:</span>
                <div className="flex items-center rounded-lg border border-inherit p-0.5 bg-black/5 dark:bg-white/5">
                  {(['serif', 'sans', 'mono'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setDocFontFamily(f)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize transition-all ${
                        docFontFamily === f ? 'bg-amber-500 text-black shadow-xs' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Header Toggle & Title */}
              <div className="flex items-center gap-2 border-l border-inherit pl-4">
                <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-[11px]">
                  <input
                    type="checkbox"
                    checked={showHeader}
                    onChange={(e) => setShowHeader(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  Header Bar
                </label>
                {showHeader && (
                  <input
                    type="text"
                    placeholder="Custom Header Title..."
                    value={customHeaderTitle}
                    onChange={(e) => setCustomHeaderTitle(e.target.value)}
                    className="px-2 py-0.5 text-xs rounded border border-inherit bg-transparent outline-none w-40"
                  />
                )}
              </div>

              {/* Footer Toggle & Watermark */}
              <div className="flex items-center gap-2 border-l border-inherit pl-4">
                <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-[11px]">
                  <input
                    type="checkbox"
                    checked={showFooter}
                    onChange={(e) => setShowFooter(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  Footer Bar
                </label>
                {showFooter && (
                  <input
                    type="text"
                    placeholder="Confidentiality watermark..."
                    value={customFooterText}
                    onChange={(e) => setCustomFooterText(e.target.value)}
                    className="px-2 py-0.5 text-xs rounded border border-inherit bg-transparent outline-none w-48"
                  />
                )}
              </div>

              {/* Page Number Format */}
              <div className="flex items-center gap-1.5 border-l border-inherit pl-4">
                <span className="text-[11px] font-bold text-gray-400">Page Num:</span>
                <select
                  value={pageNumberFormat}
                  onChange={(e) => setPageNumberFormat(e.target.value as any)}
                  className="px-2 py-0.5 rounded border border-inherit bg-transparent text-[11px] outline-none font-bold"
                >
                  <option value="page-of-total">Page 1 of {totalPages}</option>
                  <option value="page-only">Page 1</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setIsFormattingDrawerOpen(false)}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Paper Document Canvas Wrapper */}
        <div
          onMouseUp={handleTextSelection}
          className="flex-1 overflow-auto flex flex-col items-center p-8 relative select-text"
        >
          {selectedDoc ? (
            <div className="w-full flex flex-col items-center">
              {/* 1. WORD / FORMATTED TEXT WITH PRECISION PAGINATION ENGINE */}
              {paginatedDoc.pages.length > 0 && !selectedDoc.sheetData && !selectedDoc.imageDataUrl && !selectedDoc.pdfDataUrl ? (
                viewMode === 'stacked' ? (
                  /* A. Continuous Stacked Multi-Page Sheets (Google Docs / Word Layout) */
                  <div 
                    className="flex flex-col items-center gap-8 pb-16 transition-transform origin-top min-w-max"
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    {paginatedDoc.pages.map((page) => (
                      <div
                        key={page.pageNumber}
                        id={`doc-page-${page.pageNumber}`}
                        className="relative shadow-2xl select-text flex flex-col justify-between shrink-0"
                        style={{
                          width: '780px',
                          height: '1060px',
                          backgroundColor: '#ffffff',
                          color: '#111827',
                          padding: '44px 52px',
                        }}
                      >
                        {/* Page Header */}
                        {showHeader && (
                          <div className="border-b-2 border-slate-900 pb-2.5 mb-4 flex justify-between items-baseline font-sans select-none flex-shrink-0">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                                BACKSTAGE PRODUCTION VAULT • {selectedDoc.category}
                              </span>
                              <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                                {customHeaderTitle || selectedDoc.title}
                              </h1>
                            </div>
                            <div className="text-right text-[10px] font-mono text-slate-500">
                              <div>{selectedDoc.fileName}</div>
                              {pageNumberFormat === 'page-of-total' && <div>PAGE {page.pageNumber} OF {totalPages}</div>}
                              {pageNumberFormat === 'page-only' && <div>PAGE {page.pageNumber}</div>}
                            </div>
                          </div>
                        )}

                        {/* Page Body */}
                        <div
                          contentEditable={isEditMode}
                          suppressContentEditableWarning={true}
                          onInput={(e) => {
                            setEditedHtmlContent(e.currentTarget.innerHTML);
                            setHasUnsavedChanges(true);
                          }}
                          className={`prose prose-sm max-w-none text-slate-800 flex-1 overflow-hidden outline-none [&_p]:my-1.5 [&_p]:leading-relaxed [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1.5 ${
                            docFontFamily === 'sans' ? 'font-sans' : docFontFamily === 'mono' ? 'font-mono' : 'font-serif'
                          } ${
                            docFontSize === 'sm' ? 'text-[11px] leading-relaxed' : docFontSize === 'lg' ? 'text-[14px] leading-relaxed' : docFontSize === 'xl' ? 'text-[16px] leading-normal' : 'text-[12px] leading-relaxed'
                          }`}
                          dangerouslySetInnerHTML={{ __html: page.html }}
                        />

                        {/* Page Footer */}
                        {showFooter && (
                          <div className="border-t border-slate-200 mt-auto pt-3 flex justify-between items-center text-[10px] font-mono text-slate-400 select-none flex-shrink-0">
                            <div>{customFooterText || 'CONFIDENTIAL • PRODUCTION PROPERTY'}</div>
                            <div>
                              {pageNumberFormat === 'page-of-total' && `Page ${page.pageNumber} of ${totalPages}`}
                              {pageNumberFormat === 'page-only' && `Page ${page.pageNumber}`}
                            </div>
                          </div>
                        )}

                        {/* Interactive In-Sheet Drawing & Sticky Note Layer */}
                        {renderPageAnnotations(page.pageNumber)}
                      </div>
                    ))}
                  </div>
                ) : viewMode === 'spread' ? (
                  /* B. Two-Page Side-by-Side Spread View */
                  <div 
                    className="flex justify-center items-start gap-8 pb-16 transition-transform origin-top min-w-max"
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    {(() => {
                      const leftIdx = Math.floor((currentPage - 1) / 2) * 2;
                      const leftP = paginatedDoc.pages[leftIdx] || paginatedDoc.pages[0];
                      const rightP = paginatedDoc.pages[leftIdx + 1];

                      return (
                        <>
                          {/* Left Page Sheet */}
                          {leftP && (
                            <div
                              key={leftP.pageNumber}
                              id={`doc-page-${leftP.pageNumber}`}
                              className="relative shadow-2xl select-text flex flex-col justify-between shrink-0"
                              style={{
                                width: '780px',
                                height: '1060px',
                                backgroundColor: '#ffffff',
                                color: '#111827',
                                padding: '44px 52px',
                              }}
                            >
                              {showHeader && (
                                <div className="border-b-2 border-slate-900 pb-2.5 mb-4 flex justify-between items-baseline font-sans select-none flex-shrink-0">
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                                      BACKSTAGE PRODUCTION VAULT • {selectedDoc.category}
                                    </span>
                                    <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                                      {customHeaderTitle || selectedDoc.title}
                                    </h1>
                                  </div>
                                  <div className="text-right text-[10px] font-mono text-slate-500">
                                    <div>{selectedDoc.fileName}</div>
                                    {pageNumberFormat === 'page-of-total' && <div>PAGE {leftP.pageNumber} OF {totalPages}</div>}
                                    {pageNumberFormat === 'page-only' && <div>PAGE {leftP.pageNumber}</div>}
                                  </div>
                                </div>
                              )}

                              <div
                                contentEditable={isEditMode}
                                suppressContentEditableWarning={true}
                                onInput={(e) => {
                                  setEditedHtmlContent(e.currentTarget.innerHTML);
                                  setHasUnsavedChanges(true);
                                }}
                                className={`prose prose-sm max-w-none text-slate-800 flex-1 overflow-hidden outline-none [&_p]:my-1.5 [&_p]:leading-relaxed [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1.5 ${
                                  docFontFamily === 'sans' ? 'font-sans' : docFontFamily === 'mono' ? 'font-mono' : 'font-serif'
                                } ${
                                  docFontSize === 'sm' ? 'text-[11px] leading-relaxed' : docFontSize === 'lg' ? 'text-[14px] leading-relaxed' : docFontSize === 'xl' ? 'text-[16px] leading-normal' : 'text-[12px] leading-relaxed'
                                }`}
                                dangerouslySetInnerHTML={{ __html: leftP.html }}
                              />

                              {showFooter && (
                                <div className="border-t border-slate-200 mt-auto pt-3 flex justify-between items-center text-[10px] font-mono text-slate-400 select-none flex-shrink-0">
                                  <div>{customFooterText || 'CONFIDENTIAL • PRODUCTION PROPERTY'}</div>
                                  <div>
                                    {pageNumberFormat === 'page-of-total' && `Page ${leftP.pageNumber} of ${totalPages}`}
                                    {pageNumberFormat === 'page-only' && `Page ${leftP.pageNumber}`}
                                  </div>
                                </div>
                              )}

                              {/* Interactive In-Sheet Drawing & Sticky Note Layer */}
                              {renderPageAnnotations(leftP.pageNumber)}
                            </div>
                          )}

                          {/* Right Page Sheet */}
                          {rightP ? (
                            <div
                              key={rightP.pageNumber}
                              id={`doc-page-${rightP.pageNumber}`}
                              className="relative shadow-2xl select-text flex flex-col justify-between shrink-0"
                              style={{
                                width: '780px',
                                height: '1060px',
                                backgroundColor: '#ffffff',
                                color: '#111827',
                                padding: '44px 52px',
                              }}
                            >
                              {showHeader && (
                                <div className="border-b-2 border-slate-900 pb-2.5 mb-4 flex justify-between items-baseline font-sans select-none flex-shrink-0">
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                                      BACKSTAGE PRODUCTION VAULT • {selectedDoc.category}
                                    </span>
                                    <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                                      {customHeaderTitle || selectedDoc.title}
                                    </h1>
                                  </div>
                                  <div className="text-right text-[10px] font-mono text-slate-500">
                                    <div>{selectedDoc.fileName}</div>
                                    {pageNumberFormat === 'page-of-total' && <div>PAGE {rightP.pageNumber} OF {totalPages}</div>}
                                    {pageNumberFormat === 'page-only' && <div>PAGE {rightP.pageNumber}</div>}
                                  </div>
                                </div>
                              )}

                              <div
                                contentEditable={isEditMode}
                                suppressContentEditableWarning={true}
                                onInput={(e) => {
                                  setEditedHtmlContent(e.currentTarget.innerHTML);
                                  setHasUnsavedChanges(true);
                                }}
                                className={`prose prose-sm max-w-none text-slate-800 flex-1 overflow-hidden outline-none [&_p]:my-1.5 [&_p]:leading-relaxed [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1.5 ${
                                  docFontFamily === 'sans' ? 'font-sans' : docFontFamily === 'mono' ? 'font-mono' : 'font-serif'
                                } ${
                                  docFontSize === 'sm' ? 'text-[11px] leading-relaxed' : docFontSize === 'lg' ? 'text-[14px] leading-relaxed' : docFontSize === 'xl' ? 'text-[16px] leading-normal' : 'text-[12px] leading-relaxed'
                                }`}
                                dangerouslySetInnerHTML={{ __html: rightP.html }}
                              />

                              {showFooter && (
                                <div className="border-t border-slate-200 mt-auto pt-3 flex justify-between items-center text-[10px] font-mono text-slate-400 select-none flex-shrink-0">
                                  <div>{customFooterText || 'CONFIDENTIAL • PRODUCTION PROPERTY'}</div>
                                  <div>
                                    {pageNumberFormat === 'page-of-total' && `Page ${rightP.pageNumber} of ${totalPages}`}
                                    {pageNumberFormat === 'page-only' && `Page ${rightP.pageNumber}`}
                                  </div>
                                </div>
                              )}

                              {/* Interactive In-Sheet Drawing & Sticky Note Layer */}
                              {renderPageAnnotations(rightP.pageNumber)}
                            </div>
                          ) : (
                            /* Empty Facing Page on last odd page */
                            <div
                              className="relative border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 font-mono text-xs opacity-60 shrink-0"
                              style={{
                                width: '780px',
                                height: '1060px',
                              }}
                            >
                              [ End of Document ]
                            </div>
                          )}

                        </>
                      );
                    })()}
                  </div>
                ) : (
                  /* C. Single Page Flip View */
                  <div 
                    className="transition-transform origin-top pb-16 min-w-max"
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    <div
                      ref={documentSheetRef}
                      className="relative shadow-2xl select-text flex flex-col justify-between shrink-0"
                      style={{
                        width: '780px',
                        height: '1060px',
                        backgroundColor: '#ffffff',
                        color: '#111827',
                        padding: '44px 52px',
                      }}
                    >
                      {/* Document Header Bar */}
                      {showHeader && (
                        <div className="border-b-2 border-slate-900 pb-2.5 mb-4 flex justify-between items-baseline font-sans select-none flex-shrink-0">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                              BACKSTAGE PRODUCTION VAULT • {selectedDoc.category}
                            </span>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                              {customHeaderTitle || selectedDoc.title}
                            </h1>
                          </div>
                          <div className="text-right text-[10px] font-mono text-slate-500">
                            <div>{selectedDoc.fileName}</div>
                            {pageNumberFormat === 'page-of-total' && <div>PAGE {currentPage} OF {totalPages}</div>}
                            {pageNumberFormat === 'page-only' && <div>PAGE {currentPage}</div>}
                          </div>
                        </div>
                      )}

                      {/* Single Page Content */}
                      <div
                        contentEditable={isEditMode}
                        suppressContentEditableWarning={true}
                        onInput={(e) => {
                          setEditedHtmlContent(e.currentTarget.innerHTML);
                          setHasUnsavedChanges(true);
                        }}
                        className={`prose prose-sm max-w-none text-slate-800 flex-1 overflow-hidden outline-none [&_p]:my-1.5 [&_p]:leading-relaxed [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1.5 ${
                          docFontFamily === 'sans' ? 'font-sans' : docFontFamily === 'mono' ? 'font-mono' : 'font-serif'
                        } ${
                          docFontSize === 'sm' ? 'text-[11px] leading-relaxed' : docFontSize === 'lg' ? 'text-[14px] leading-relaxed' : docFontSize === 'xl' ? 'text-[16px] leading-normal' : 'text-[12px] leading-relaxed'
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: paginatedDoc.pages[currentPage - 1]?.html || paginatedDoc.pages[0]?.html || selectedDoc.htmlContent || '',
                        }}
                      />

                      {/* Page Footer */}
                      {showFooter && (
                        <div className="border-t border-slate-200 mt-auto pt-3 flex justify-between items-center text-[10px] font-mono text-slate-400 select-none flex-shrink-0">
                          <div>{customFooterText || 'CONFIDENTIAL • PRODUCTION PROPERTY'}</div>
                          <div>
                            {pageNumberFormat === 'page-of-total' && `Page ${currentPage} of ${totalPages}`}
                            {pageNumberFormat === 'page-only' && `Page ${currentPage}`}
                          </div>
                        </div>
                      )}

                      {/* Interactive In-Sheet Drawing & Sticky Note Layer */}
                      {renderPageAnnotations(currentPage)}
                    </div>
                  </div>
                )
              ) : (
                /* OTHER FORMATS: Spreadsheets, Images, PDFs, and Templates */
                <div
                  ref={documentSheetRef}
                  className="relative shadow-2xl transition-transform origin-top select-text"
                  style={{
                    width: '780px',
                    minHeight: '1020px',
                    transform: `scale(${zoomLevel / 100})`,
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    padding: '48px 56px',
                  }}
                >
                  {/* Document Header Bar */}
                  {showHeader && (
                    <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-baseline font-sans select-none">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                          BACKSTAGE PRODUCTION VAULT • {selectedDoc.category}
                        </span>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                          {customHeaderTitle || selectedDoc.title}
                        </h1>
                      </div>
                      <div className="text-right text-[10px] font-mono text-slate-500">
                        <div>{selectedDoc.fileName}</div>
                        <div>PAGE {currentPage} OF {totalPages}</div>
                      </div>
                    </div>
                  )}

                  {/* 2. Spreadsheet (.xlsx, .csv) */}
                  {selectedDoc.sheetData && (
                    <div className="font-sans text-xs overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-slate-300">
                        <tbody>
                          {selectedDoc.sheetData.slice(0, 45).map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-200 font-bold' : 'border-t border-slate-200 hover:bg-amber-50/50'}>
                              {row.map((cell: any, cIdx: number) => (
                                <td key={cIdx} className="p-2 border-r border-slate-200 text-[11px]">
                                  {cell !== undefined && cell !== null ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 3. Image File / Excalidraw Whiteboard */}
                  {selectedDoc.imageDataUrl && (
                    <div className="space-y-3 font-sans">
                      <div className="rounded-xl overflow-hidden border border-slate-300 shadow-md bg-slate-950 flex items-center justify-center">
                        <img
                          src={selectedDoc.imageDataUrl}
                          alt={selectedDoc.title}
                          className="w-full h-auto object-contain max-h-[750px]"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. Embedded PDF Document */}
                  {selectedDoc.pdfDataUrl && !selectedDoc.htmlContent && !selectedDoc.imageDataUrl && (
                    <div className="w-full h-[800px] border rounded-xl overflow-hidden bg-slate-100">
                      <iframe
                        src={selectedDoc.pdfDataUrl}
                        title={selectedDoc.title}
                        className="w-full h-full border-none"
                      />
                    </div>
                  )}

                  {/* 5. Fallback Text / Templates */}
                  {!selectedDoc.htmlContent && !selectedDoc.sheetData && !selectedDoc.imageDataUrl && !selectedDoc.pdfDataUrl && (
                    <div className="space-y-4 font-sans text-xs leading-relaxed text-slate-700">
                      {selectedDoc.category === 'BREAKDOWN' && (
                        <div className="space-y-3">
                          <div className="p-3 bg-slate-100 rounded border font-bold">1ST AD PRODUCTION BREAKDOWN SHEET</div>
                          <p>Scene production elements categorized for scheduling and department HOD distribution.</p>
                        </div>
                      )}
                      {selectedDoc.textContent && (
                        <div className="whitespace-pre-wrap font-mono text-[11px] leading-normal bg-slate-50 p-4 rounded border">
                          {selectedDoc.textContent}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive In-Sheet Drawing & Sticky Note Layer */}
                  {renderPageAnnotations(currentPage)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <Folder size={48} className="mb-3 opacity-30" />
              <p className="font-bold">No documents found in this category</p>
            </div>
          )}

          {/* Floating Google Docs Text Selection Context Toolbar */}
          {selectionRange && (
            <div
              ref={selectionToolbarRef}
              onMouseDown={(e) => {
                // Prevent this mousedown from clearing browser selection or triggering handleTextSelection
                e.preventDefault();
                e.stopPropagation();
                isToolbarActionRef.current = true;
              }}
              style={{
                position: 'fixed',
                top: Math.max(12, selectionRange.rect.top - 54),
                left: Math.max(12, Math.min(
                  window.innerWidth - 460,
                  selectionRange.rect.left + selectionRange.rect.width / 2 - 180
                )),
                zIndex: 100,
              }}
              className="flex items-center gap-2 p-1.5 px-3 rounded-2xl bg-[#111116]/95 text-white shadow-2xl border border-white/20 backdrop-blur-md animate-in fade-in duration-100"
            >
              {/* Highlight Palette (5 Colors) */}
              <div className="flex items-center gap-1.5 pr-2 border-r border-white/15">
                <span className="text-[10px] font-bold text-gray-400">Highlight:</span>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHighlightSelection(c.color);
                    }}
                    className="w-4 h-4 rounded-full hover:scale-125 transition-transform border border-white/30"
                    style={{ backgroundColor: c.color }}
                    title={`Highlight in ${c.name}`}
                  />
                ))}
              </div>

              {/* Add Comment */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddCommentFromSelection();
                }}
                className="px-2 py-1 rounded-lg text-xs font-bold hover:bg-white/15 flex items-center gap-1.5 text-amber-400 transition-colors"
                title="Add Comment Note"
              >
                <MessageSquare size={13} />
                <span>Comment</span>
              </button>

              {/* Selection AI Command with Direct Quick Action Chips */}
              <div className="flex items-center gap-1 pl-1 border-l border-white/15">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAiWithSelection();
                  }}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 flex items-center gap-1.5 text-sky-400 transition-colors"
                  title="Ask AI about this selection"
                >
                  <Sparkles size={13} />
                  <span>AI Prompt</span>
                </button>

                {/* Quick 1-Click AI Chips on Selection */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAiWithSelection('Summarize this in 2 concise bullet points');
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10.5px] font-medium bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10 transition-colors"
                  title="Summarize selection"
                >
                  Summarize
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAiWithSelection('Translate this section to formal Tamil (தமிழ்)');
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10.5px] font-medium bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10 transition-colors"
                  title="Translate to Tamil"
                >
                  Tamil (தமிழ்)
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAiWithSelection('Audit this clause for legal risks, actor safety, and continuity issues');
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10.5px] font-medium bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10 transition-colors"
                  title="Audit safety and risk"
                >
                  Safety Audit
                </button>
              </div>

              {/* Copy */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isToolbarActionRef.current = true;
                  navigator.clipboard.writeText(selectionRange.text);
                  showToast('Copied to clipboard!');
                  setSelectionRange(null);
                }}
                className="p-1.5 rounded-lg hover:bg-white/15 text-gray-400 hover:text-white transition-colors"
                title="Copy selected text"
              >
                <Copy size={13} />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 3. Right Side-by-Side Google Docs Comments & AI Co-Pilot Column */}
      {showCommentsPanel && (
        <div className={`w-80 flex-shrink-0 flex flex-col border-l transition-all ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#111116] border-[#222]'
        }`}>
          {/* Header Tabs (Comments vs AI Assistant) */}
          <div className="p-2 border-b border-inherit flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveSideTab('comments')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeSideTab === 'comments'
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Notes & Comments ({annotations.filter(a => a.type === 'comment' || a.type === 'note').length})
              </button>
              <button
                onClick={() => setActiveSideTab('ai')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  activeSideTab === 'ai'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Bot size={13} />
                AI Co-Pilot
              </button>
            </div>

            <button
              onClick={() => setShowCommentsPanel(false)}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400"
              title="Close sidebar"
            >
              <X size={14} />
            </button>
          </div>

          {/* TAB 1: Real-time Comments & Sticky Notes Thread Stream */}
          {activeSideTab === 'comments' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {annotations.filter(a => a.type === 'comment' || a.type === 'note').length > 0 ? (
                annotations
                  .filter((a) => a.type === 'comment' || a.type === 'note')
                  .map((item) => {
                    const isSelected = selectedCommentId === item.id;
                    const isResolved = item.status === 'resolved';

                    if (item.type === 'note') {
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedCommentId(item.id)}
                          className={`p-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-amber-100/90 border-amber-400 text-slate-900 shadow-md ring-1 ring-amber-400'
                              : isLight
                              ? 'bg-amber-50/60 hover:bg-amber-50 border-amber-200/80 text-slate-800'
                              : 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-amber-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <StickyNote size={14} className="text-amber-500 fill-amber-400" />
                              <span className="text-xs font-bold">Sticky Note • Page {item.pageNumber}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAnnotation(item.id);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-red-400"
                              title="Delete note"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <p className="text-xs leading-relaxed font-medium">{item.text}</p>
                          <div className="mt-2 pt-1.5 border-t border-inherit text-[9.5px] opacity-70 flex justify-between">
                            <span>{item.author || 'Production Member'}</span>
                            <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedCommentId(item.id)}
                        className={`p-3 rounded-xl border transition-all ${
                          isSelected
                            ? isLight
                              ? 'bg-amber-50/80 border-amber-400 shadow-md ring-1 ring-amber-400'
                              : 'bg-[#1c1c28] border-amber-500 shadow-lg ring-1 ring-amber-500/40'
                            : isResolved
                            ? 'opacity-60 bg-black/5 dark:bg-white/5 border-transparent'
                            : isLight
                            ? 'bg-slate-50 hover:bg-white border-slate-200'
                            : 'bg-[#16161c] hover:bg-[#1a1a22] border-white/5'
                        }`}
                      >
                        {/* Author & Actions Bar */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">
                              {(item.author || 'P')[0]}
                            </div>
                            <span className="text-xs font-bold">{item.author || 'Production Member'} • Page {item.pageNumber}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleResolveComment(item.id);
                              }}
                              className={`p-1 rounded transition-colors ${
                                isResolved ? 'text-emerald-400' : 'text-gray-400 hover:text-emerald-400'
                              }`}
                              title={isResolved ? 'Reopen comment' : 'Resolve comment'}
                            >
                              <CheckCircle2 size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAnnotation(item.id);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-red-400"
                              title="Delete comment"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Highlighted Quote Context */}
                        {item.selectedText && (
                          <div className="p-1.5 px-2 mb-2 rounded bg-amber-500/10 border-l-2 border-amber-500 text-[10.5px] italic text-amber-300/90 truncate font-serif">
                            "{item.selectedText}"
                          </div>
                        )}

                        {/* Comment Body */}
                        <p className="text-xs leading-relaxed text-slate-200">{item.text}</p>

                        {/* Threaded Replies */}
                        {(item.replies || []).length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-inherit space-y-1.5 pl-2">
                            {item.replies?.map((rep) => (
                              <div key={rep.id} className="text-[11px] leading-snug">
                                <strong className="text-gray-400 font-semibold">{rep.author}: </strong>
                                <span>{rep.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quick Reply Input */}
                        <div className="mt-2 pt-2 border-t border-inherit flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Add reply..."
                            value={replyInput[item.id] || ''}
                            onChange={(e) => setReplyInput({ ...replyInput, [item.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddReply(item.id)}
                            className={`w-full px-2 py-1 text-[11px] rounded-lg border outline-none ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#121216] border-white/10'
                            }`}
                          />
                          <button
                            onClick={() => handleAddReply(item.id)}
                            className="p-1 rounded bg-amber-500 text-black hover:bg-amber-400"
                            title="Post reply"
                          >
                            <Send size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                  <MessageSquare size={32} className="mb-2 opacity-30" />
                  <p className="text-xs font-bold">No comments or notes</p>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-[200px]">
                    Select text to comment or use the Sticky Note tool to drop notes on any page.
                  </p>
                </div>
              )}
            </div>
          )}


          {/* TAB 2: AI Document Assistant */}
          {activeSideTab === 'ai' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              <div className="p-2.5 bg-sky-500/10 border border-sky-400/20 rounded-xl mb-3 shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 mb-1">
                  <Sparkles size={13} />
                  <span>AI Document Co-Pilot</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-snug">
                  Ask questions about <strong className="text-white">{selectedDoc?.title}</strong>, check continuity, extract safety protocols, or translate.
                </p>
              </div>

              {/* Quick Prompt Chips */}
              <div className="flex flex-wrap gap-1 mb-3 shrink-0">
                {[
                  'Summarize in 3 bullet points',
                  'Extract all safety hazards',
                  'Check cast & call times',
                  'Translate to Tamil (தமிழ்)',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleRunAiCommand(chip)}
                    className="text-[10px] font-medium px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Response output */}
              <div className="flex-1 overflow-y-auto p-2.5 rounded-xl border border-inherit bg-black/20 text-xs leading-relaxed space-y-2 mb-3">
                {isAiLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-sky-400">
                    <Sparkles size={16} className="animate-spin" />
                    <span>Analyzing document...</span>
                  </div>
                ) : aiResponse ? (
                  <div className="whitespace-pre-wrap select-text text-gray-200">
                    {aiResponse}
                  </div>
                ) : (
                  <div className="text-gray-500 italic text-center py-10">
                    Enter a prompt or select a chip above to analyze this document.
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="text"
                  placeholder="Ask anything about this document..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunAiCommand()}
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none ${
                    isLight ? 'bg-white border-slate-300' : 'bg-[#181822] border-white/10 text-white'
                  }`}
                />
                <button
                  onClick={() => handleRunAiCommand()}
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Google Docs-Style Floating AI Command Box (Cmd+K / /) */}
      {isAiCommandOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`w-full max-w-xl p-5 rounded-2xl border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#181822] border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-inherit">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-sky-400" />
                <h2 className="text-sm font-black">AI Command Box • Help Me Analyze</h2>
              </div>
              <button
                onClick={() => setIsAiCommandOpen(false)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#121218] border-white/15'
              }`}>
                <Sparkles size={15} className="text-sky-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Extract all stunt and pyrotechnic safety protocols from this agreement..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunAiCommand()}
                  className="w-full bg-transparent outline-none text-xs font-medium"
                />
              </div>

              {/* Quick Action Chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Summarize Key Clauses',
                  'Audit Safety & Risk Guidelines',
                  'Extract Actors & Call Times',
                  'Translate Selected Section to Tamil',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleRunAiCommand(chip)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-400/30 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Output Result */}
              {(isAiLoading || aiResponse) && (
                <div className="p-3.5 rounded-xl border border-inherit bg-black/20 max-h-60 overflow-y-auto text-xs leading-relaxed">
                  {isAiLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-sky-400">
                      <Sparkles size={16} className="animate-spin" />
                      <span>Processing command with Gemini...</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap select-text text-gray-200">
                      {aiResponse}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-inherit">
                <span className="text-[10px] font-mono text-gray-400">Tip: Press Enter to execute</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAiCommandOpen(false)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunAiCommand()}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="px-4 py-1.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 shadow-sm"
                  >
                    Execute Command
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentVaultView;
