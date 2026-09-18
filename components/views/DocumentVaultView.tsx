import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { 
  ProductionDocument, 
  DocumentAnnotation, 
  AnnotationType, 
  CommentReply, 
  DocumentFormat,
  DocumentCategory
} from '../../types';
import { 
  getProductionDocuments, 
  saveProductionDocuments, 
  addProductionDocument,
  archiveProductionDocument,
  unarchiveProductionDocument,
  saveVoiceNoteToVault,
  saveNoteToVault,
  harvestProjectArtifacts
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
  Save,
  Archive,
  ArchiveRestore,
  Mic,
  MicOff,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Grid,
  List,
  Calendar,
  Film,
  Tag,
  Activity,
  ArrowUpDown,
  FileSpreadsheet,
  FileAudio,
  Radio,
  RefreshCw,
  Info
} from 'lucide-react';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#fde047', bg: 'rgba(253, 224, 71, 0.35)' },
  { name: 'Green', color: '#86efac', bg: 'rgba(134, 239, 172, 0.35)' },
  { name: 'Blue', color: '#93c5fd', bg: 'rgba(147, 197, 253, 0.35)' },
  { name: 'Pink', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.35)' },
  { name: 'Amber', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.35)' },
];

const PEN_COLORS = ['#dc2626', '#18181b', '#2563eb', '#16a34a', '#d97706', '#9333ea'];

// Category visual styling configuration
const CATEGORY_STYLES: Record<string, { label: string; icon: any; badgeBg: string; badgeText: string; border: string }> = {
  ALL: { label: 'All Assets', icon: FileStack, badgeBg: 'bg-zinc-500/15', badgeText: 'text-zinc-300', border: 'border-zinc-500/30' },
  SCRIPT: { label: 'Scripts', icon: FileText, badgeBg: 'bg-emerald-500/15', badgeText: 'text-emerald-400', border: 'border-emerald-500/30' },
  LOOKBOOK: { label: 'Pictures & Lookbooks', icon: ImageIcon, badgeBg: 'bg-purple-500/15', badgeText: 'text-purple-400', border: 'border-purple-500/30' },
  VOICE_NOTE: { label: 'Voice Notes & Audio', icon: Mic, badgeBg: 'bg-cyan-500/15', badgeText: 'text-cyan-400', border: 'border-cyan-500/30' },
  SNAPSHOT: { label: 'Snapshots & Canvas', icon: Palette, badgeBg: 'bg-blue-500/15', badgeText: 'text-blue-400', border: 'border-blue-500/30' },
  BREAKDOWN: { label: 'Breakdown Sheets', icon: Layers, badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-400', border: 'border-amber-500/30' },
  CALLSHEET: { label: 'Call Sheets', icon: Clock, badgeBg: 'bg-yellow-500/15', badgeText: 'text-yellow-400', border: 'border-yellow-500/30' },
  NOTE: { label: 'Notes & Memos', icon: StickyNote, badgeBg: 'bg-lime-500/15', badgeText: 'text-lime-400', border: 'border-lime-500/30' },
  STORYBOARD: { label: 'Storyboards', icon: Film, badgeBg: 'bg-pink-500/15', badgeText: 'text-pink-400', border: 'border-pink-500/30' },
  SAFETY: { label: 'Safety Guidelines', icon: Shield, badgeBg: 'bg-red-500/15', badgeText: 'text-red-400', border: 'border-red-500/30' },
  CONTRACT: { label: 'Contracts & Legal', icon: Scale, badgeBg: 'bg-indigo-500/15', badgeText: 'text-indigo-400', border: 'border-indigo-500/30' },
  PERMIT: { label: 'Location Permits', icon: FileCheck, badgeBg: 'bg-teal-500/15', badgeText: 'text-teal-400', border: 'border-teal-500/30' },
  EXPORT: { label: 'Exports & Reports', icon: Download, badgeBg: 'bg-fuchsia-500/15', badgeText: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
  OTHER: { label: 'Other Docs', icon: Folder, badgeBg: 'bg-zinc-500/15', badgeText: 'text-zinc-300', border: 'border-zinc-500/30' },
};

export const DocumentVaultView: React.FC = () => {
  const projectContext = useProject();
  const { appTheme, appAccentColor = '#f5a623', generalAiModel, openrouterKey } = projectContext;
  const { aiAvailable } = useAiKeyStatus();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  // Core Document State
  const [documents, setDocuments] = useState<ProductionDocument[]>(() => getProductionDocuments());
  const [selectedDocId, setSelectedDocId] = useState<string>(() => documents[0]?.id || '');
  
  // Gallery Hub vs. Studio Mode
  const [inStudioMode, setInStudioMode] = useState<boolean>(false);
  const [galleryViewMode, setGalleryViewMode] = useState<'gallery' | 'table' | 'kanban' | 'timeline'>('gallery');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'size' | 'comments'>('newest');

  // Reader / Studio Pagination & Zoom
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [readerViewMode, setReaderViewMode] = useState<'stacked' | 'single' | 'spread'>('stacked');
  const [isBaminiDetected, setIsBaminiDetected] = useState<boolean>(false);

  // Document In-Place Editing & Typography
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

  // Annotations & Markup
  const [activeTool, setActiveTool] = useState<AnnotationType | 'hand'>('hand');
  const [activeColor, setActiveColor] = useState<string>('#fde047');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);

  // Comments Side-Panel
  const [showCommentsPanel, setShowCommentsPanel] = useState<boolean>(true);
  const [activeSideTab, setActiveSideTab] = useState<'comments' | 'ai'>('comments');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState<{ [commentId: string]: string }>({});
  const [newCommentText, setNewCommentText] = useState<string>('');

  // Audio Playback Engine
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingDocId, setPlayingDocId] = useState<string | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Floating Selection Toolbar
  const [selectionRange, setSelectionRange] = useState<{ text: string; rect: DOMRect } | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const isToolbarActionRef = useRef(false);

  // Floating AI Command Box
  const [isAiCommandOpen, setIsAiCommandOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // In-Vault Voice Recorder Modal State
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedAudioDataUrl, setRecordedAudioDataUrl] = useState<string | null>(null);
  const [voiceNoteTitle, setVoiceNoteTitle] = useState<string>('');
  const [voiceNoteTags, setVoiceNoteTags] = useState<string>('Voice Note, On-Set');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // In-Vault Quick Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [quickNoteTitle, setQuickNoteTitle] = useState<string>('');
  const [quickNoteContent, setQuickNoteContent] = useState<string>('');
  const [quickNoteTags, setQuickNoteTags] = useState<string>('Production Note, Memo');

  // Drawing Canvas per page
  const [drawingPageNumber, setDrawingPageNumber] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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

  // Audio Playback event handling
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setAudioDuration(audio.duration || 0);
    const handleEnded = () => {
      setPlayingDocId(null);
      setAudioCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playingDocId]);

  // Handle Play/Pause for Audio Notes
  const togglePlayAudio = (doc: ProductionDocument, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!doc.audioUrl) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (playingDocId === doc.id) {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
        setPlayingDocId(null);
      }
    } else {
      audio.src = doc.audioUrl;
      audio.playbackRate = audioPlaybackRate;
      audio.muted = isAudioMuted;
      audio.play().catch((err) => console.warn('Audio play error:', err));
      setPlayingDocId(doc.id);
    }
  };

  // Change Audio Playback Speed
  const handleSetSpeed = (rate: number) => {
    setAudioPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Auto-Harvest App Artifacts on first mount
  useEffect(() => {
    try {
      const { addedCount } = harvestProjectArtifacts(projectContext);
      if (addedCount > 0) {
        const updated = getProductionDocuments();
        setDocuments(updated);
      }
    } catch (e) {
      console.warn('Auto-harvesting skipped on mount:', e);
    }
  }, []);

  // Manual Trigger for Syncing App Artifacts
  const handleSyncArtifacts = () => {
    try {
      const { addedCount, documents: updated } = harvestProjectArtifacts(projectContext);
      setDocuments(updated);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      if (addedCount > 0) {
        showToast(`⚡ Synchronized ${addedCount} new production assets into Document Vault!`);
      } else {
        showToast('✓ All project notes, voice memos, and snapshots are already synchronized!');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to synchronize project assets.');
    }
  };

  // Shortcut listener for Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsAiCommandOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSelectionRange(null);
        setIsAiCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dismiss selection toolbar on click outside
  useEffect(() => {
    if (!selectionRange) return;
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (selectionToolbarRef.current && selectionToolbarRef.current.contains(e.target as Node)) {
        return;
      }
    };
    window.addEventListener('mousedown', handleGlobalMouseDown);
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown);
  }, [selectionRange]);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const annotations = selectedDoc?.annotations || [];
  const pageAnnotations = annotations.filter((a) => a.pageNumber === currentPage);

  // Archival Counts & Filtering
  const counts = useMemo(() => {
    const active = documents.filter((d) => !d.isArchived);
    const archived = documents.filter((d) => d.isArchived);
    const byCat: Record<string, number> = { ALL: active.length, ARCHIVED: archived.length };

    active.forEach((d) => {
      byCat[d.category] = (byCat[d.category] || 0) + 1;
    });
    return byCat;
  }, [documents]);

  // Filter & Search Engine
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Archive Filter
      if (selectedCategory === 'ARCHIVED') {
        if (!doc.isArchived) return false;
      } else {
        if (doc.isArchived) return false;
        if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchTitleTa = doc.titleTa?.toLowerCase().includes(q);
        const matchFileName = doc.fileName.toLowerCase().includes(q);
        const matchAuthor = doc.author?.toLowerCase().includes(q);
        const matchCategory = doc.category.toLowerCase().includes(q);
        const matchTags = doc.tags?.some((t) => t.toLowerCase().includes(q));
        const matchText = doc.textContent?.toLowerCase().includes(q);
        const matchHtml = doc.htmlContent?.toLowerCase().includes(q);
        const matchAnnos = doc.annotations?.some(
          (a) => a.text?.toLowerCase().includes(q) || a.selectedText?.toLowerCase().includes(q)
        );

        if (
          !matchTitle &&
          !matchTitleTa &&
          !matchFileName &&
          !matchAuthor &&
          !matchCategory &&
          !matchTags &&
          !matchText &&
          !matchHtml &&
          !matchAnnos
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      if (sortBy === 'oldest') return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'comments') return (b.annotations?.length || 0) - (a.annotations?.length || 0);
      return 0;
    });
  }, [documents, selectedCategory, searchQuery, sortBy]);

  // Precision Document Pagination Engine
  const paginatedDoc = useMemo(() => {
    if (!selectedDoc) return { totalPages: 1, pages: [] };
    const content = editedHtmlContent || selectedDoc.htmlContent;
    const targetHeightPx = showHeader && showFooter ? 860 : showHeader || showFooter ? 910 : 960;

    if (content && !selectedDoc.sheetData) {
      return paginateDocumentHtml(content, {
        fontSize: docFontSize,
        fontFamily: docFontFamily,
        targetHeightPx,
      });
    }
    if (selectedDoc.textContent && !selectedDoc.sheetData && !selectedDoc.imageDataUrl && !selectedDoc.pdfDataUrl) {
      return paginatePlainText(selectedDoc.textContent, {
        fontSize: docFontSize,
        fontFamily: docFontFamily,
        targetHeightPx,
      });
    }
    return {
      totalPages: selectedDoc.pageCount || 1,
      pages: [],
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
    selectedDoc?.pageCount,
  ]);

  const totalPages = Math.max(1, paginatedDoc.totalPages || selectedDoc?.pageCount || 1);

  // Auto-transcode legacy Bamini Tamil fonts on document open
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
      showToast('Bamini typewriter font auto-transcoded to Tamil Unicode!');
    }
  }, [selectedDocId]);

  // Persist documents on change
  const updateDocuments = (docs: ProductionDocument[]) => {
    setDocuments(docs);
    saveProductionDocuments(docs);
  };

  const handleOpenDocInStudio = (docId: string) => {
    setSelectedDocId(docId);
    setCurrentPage(1);
    setSelectionRange(null);
    setSelectedCommentId(null);
    setEditedHtmlContent('');
    setHasUnsavedChanges(false);
    setInStudioMode(true);
  };

  // ARCHIVE DOCUMENT (NO DELETION GUARANTEE)
  const handleArchiveDocument = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    const docToArchive = documents.find((d) => d.id === docId);
    if (!docToArchive) return;

    if (confirm(`Archive "${docToArchive.title}"?\n\nBackstage Vault preserves all production assets; documents are archived safely and never permanently deleted.`)) {
      archiveProductionDocument(docId);
      const updated = getProductionDocuments();
      setDocuments(updated);
      showToast(`🗄️ Archived "${docToArchive.title}" into Vault Archive.`);
    }
  };

  // UNARCHIVE / RESTORE DOCUMENT
  const handleUnarchiveDocument = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    unarchiveProductionDocument(docId);
    const updated = getProductionDocuments();
    setDocuments(updated);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
    showToast(`✓ Restored document back to active Vault!`);
  };

  // Save in-place edited document content to Vault
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
    showToast('✓ Saved changes to Production Vault!');
  };

  // Smooth Page Navigation Handler
  const handlePageChange = (newPage: number) => {
    const target = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(target);
    if (readerViewMode === 'stacked') {
      const el = document.getElementById(`doc-page-${target}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Universal File Upload Handler
  const handleUniversalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseUniversalFile(
        file,
        (selectedCategory === 'ALL' || selectedCategory === 'ARCHIVED' ? 'OTHER' : selectedCategory) as any
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
        author: 'Uploaded by User',
        status: 'review',
        tags: ['Import', parsed.category],
        annotations: [],
      };

      const updated = [newDoc, ...documents];
      updateDocuments(updated);
      setSelectedDocId(newDoc.id);
      setInStudioMode(true);
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
      showToast(`✓ Imported "${parsed.fileName}" into Production Vault!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to parse uploaded document.');
    }
  };

  // Voice Recording Functions for Built-in Vault Voice Memo Modal
  const startRecordingVoiceNote = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudioDataUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Microphone access is required to record voice notes in the Vault.');
    }
  };

  const stopRecordingVoiceNote = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const handleSaveVoiceNote = () => {
    if (!recordedAudioDataUrl) return;
    const title = voiceNoteTitle.trim() || `Voice Note (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const doc = saveVoiceNoteToVault(
      title,
      recordedAudioDataUrl,
      recordingSeconds,
      `Recorded in Document Vault on ${new Date().toLocaleDateString()}`,
      'Director / Sound Team'
    );

    const updated = getProductionDocuments();
    setDocuments(updated);
    setSelectedDocId(doc.id);
    setIsVoiceRecorderOpen(false);
    setRecordedAudioDataUrl(null);
    setRecordingSeconds(0);
    setVoiceNoteTitle('');
    confetti({ particleCount: 30, spread: 45, origin: { y: 0.6 } });
    showToast(`✓ Saved Voice Note "${title}" to Vault!`);
  };

  // Quick Note Save Function
  const handleSaveQuickNote = () => {
    if (!quickNoteTitle.trim() && !quickNoteContent.trim()) return;
    const title = quickNoteTitle.trim() || `Production Note (${new Date().toLocaleDateString()})`;
    const tags = quickNoteTags.split(',').map((t) => t.trim()).filter(Boolean);
    const doc = saveNoteToVault(title, quickNoteContent, tags, 'Production Office');

    const updated = getProductionDocuments();
    setDocuments(updated);
    setSelectedDocId(doc.id);
    setIsNoteModalOpen(false);
    setQuickNoteTitle('');
    setQuickNoteContent('');
    confetti({ particleCount: 25, spread: 40, origin: { y: 0.6 } });
    showToast(`✓ Saved Note "${title}" to Vault!`);
  };

  // Save Annotation
  const saveAnnotation = (anno: DocumentAnnotation) => {
    if (!selectedDoc) return;
    const updatedDocs = documents.map((d) => {
      if (d.id === selectedDoc.id) {
        return { ...d, annotations: [...(d.annotations || []), anno] };
      }
      return d;
    });
    updateDocuments(updatedDocs);
  };

  // Add General Comment on current document
  const handleAddGeneralComment = () => {
    if (!newCommentText.trim() || !selectedDoc) return;
    const newAnno: DocumentAnnotation = {
      id: `comment-${Date.now()}`,
      documentId: selectedDoc.id,
      pageNumber: currentPage,
      type: 'comment',
      color: '#f5a623',
      text: newCommentText.trim(),
      author: 'Production Member',
      createdAt: new Date().toISOString(),
      status: 'open',
      replies: [],
    };
    saveAnnotation(newAnno);
    setNewCommentText('');
    showToast('✓ Added comment to document thread!');
  };

  // Reply to Comment
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

  // Sheet Mouse Coords for drawing
  const getSheetCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scale = zoomLevel / 100;
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
        showToast(`✓ Added Sticky Note to page ${targetPageNumber}!`);
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
      setCurrentRect({
        x: Math.min(startPoint.x, x),
        y: Math.min(startPoint.y, y),
        width: Math.abs(x - startPoint.x),
        height: Math.abs(y - startPoint.y),
      });
    }
  };

  const handleSheetMouseUp = () => {
    if (!isDrawing || drawingPageNumber === null || !selectedDoc) return;

    if (activeTool === 'pen' && currentPath.length > 1) {
      saveAnnotation({
        id: `pen-${Date.now()}`,
        documentId: selectedDoc.id,
        pageNumber: drawingPageNumber,
        type: 'pen',
        color: activeColor,
        strokeWidth,
        points: currentPath,
        createdAt: new Date().toISOString(),
      });
    } else if (activeTool === 'rect' && currentRect && currentRect.width > 5 && currentRect.height > 5) {
      saveAnnotation({
        id: `rect-${Date.now()}`,
        documentId: selectedDoc.id,
        pageNumber: drawingPageNumber,
        type: 'rect',
        color: activeColor,
        strokeWidth: 2,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
        createdAt: new Date().toISOString(),
      });
    } else if (activeTool === 'highlight' && currentRect && currentRect.width > 5 && currentRect.height > 5) {
      saveAnnotation({
        id: `hl-${Date.now()}`,
        documentId: selectedDoc.id,
        pageNumber: drawingPageNumber,
        type: 'highlight',
        color: activeColor,
        opacity: 0.35,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
        createdAt: new Date().toISOString(),
      });
    }

    setIsDrawing(false);
    setDrawingPageNumber(null);
    setCurrentPath([]);
    setCurrentRect(null);
    setStartPoint(null);
  };

  return (
    <div className={`w-full h-full flex flex-col font-sans select-none overflow-hidden ${isLight ? 'bg-[#f4f5f8] text-slate-900' : 'bg-[#09090b] text-gray-100'}`}>
      
      {/* Hidden Audio Element for Playback */}
      <audio ref={audioRef} className="hidden" />

      {/* Hidden File Picker for Universal Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.svg,.txt,.md,.webm,.mp3,.wav"
        className="hidden"
        onChange={handleUniversalUpload}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-50 px-4 py-2.5 rounded-xl bg-zinc-900/95 border border-[#f5a623]/50 text-white font-medium text-xs shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 backdrop-blur-md">
          <Sparkles size={16} className="text-[#f5a623]" />
          {toastMessage}
        </div>
      )}

      {/* =========================================================================
          TOP HEADER: VAULT NAVIGATION & MASTER ACTION BAR
         ========================================================================= */}
      <header className={`h-16 px-6 border-b flex items-center justify-between shrink-0 transition-colors z-20 ${
        isLight ? 'bg-white/80 border-slate-200 backdrop-blur-md' : 'bg-[#121215]/80 border-[#222226] backdrop-blur-md'
      }`}>
        {/* Left: Vault Title, View Switcher or Back to Gallery */}
        <div className="flex items-center gap-4">
          {inStudioMode ? (
            <button
              onClick={() => {
                setInStudioMode(false);
                if (playingDocId) {
                  audioRef.current?.pause();
                  setPlayingDocId(null);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-[#f5a623] hover:text-[#f5a623] bg-zinc-800/40 border-zinc-700/60"
            >
              <ChevronLeft size={16} />
              <span>Back to Gallery</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f5a623]/20 to-amber-500/10 border border-[#f5a623]/30 flex items-center justify-center text-[#f5a623] shadow-inner">
                <FileStack size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                    Production Document Vault
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-[#f5a623]/15 text-[#f5a623] border border-[#f5a623]/30">
                    Grand Gallery
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  {counts.ALL || 0} active assets • {counts.ARCHIVED || 0} preserved in archive • Permanent production record
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Live Search Bar (Gallery Mode) or Doc Title (Studio Mode) */}
        {!inStudioMode ? (
          <div className="flex-1 max-w-xl mx-8">
            <div className={`relative flex items-center rounded-xl border transition-all ${
              isLight ? 'bg-slate-100 border-slate-300 focus-within:border-[#f5a623] focus-within:bg-white' : 'bg-[#18181c] border-[#2c2c32] focus-within:border-[#f5a623] focus-within:bg-[#1e1e24]'
            }`}>
              <Search size={16} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents, pictures, snapshots, voice notes, memos, tags, content..."
                className="w-full py-2 pl-10 pr-10 text-xs bg-transparent outline-none font-medium placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-0.5 rounded-full hover:bg-zinc-700/50 text-zinc-400 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border ${
              CATEGORY_STYLES[selectedDoc?.category]?.badgeBg || 'bg-zinc-800'
            } ${CATEGORY_STYLES[selectedDoc?.category]?.badgeText || 'text-zinc-300'} ${
              CATEGORY_STYLES[selectedDoc?.category]?.border || 'border-zinc-700'
            }`}>
              {selectedDoc?.category}
            </span>
            <span className="text-sm font-bold truncate max-w-md">
              {selectedDoc?.title}
            </span>
          </div>
        )}

        {/* Right: Gallery Layout Switcher & Action Tools */}
        <div className="flex items-center gap-2">
          {!inStudioMode ? (
            <>
              {/* View Mode Switcher (Gallery, Table, Kanban, Timeline) */}
              <div className="flex items-center p-1 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <button
                  onClick={() => setGalleryViewMode('gallery')}
                  title="Visual Card Gallery View"
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    galleryViewMode === 'gallery' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Grid size={14} />
                  <span className="hidden sm:inline">Gallery</span>
                </button>
                <button
                  onClick={() => setGalleryViewMode('table')}
                  title="Detailed Table / List View"
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    galleryViewMode === 'table' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <List size={14} />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => setGalleryViewMode('kanban')}
                  title="Category Board (Kanban) View"
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    galleryViewMode === 'kanban' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Columns size={14} />
                  <span className="hidden sm:inline">Board</span>
                </button>
                <button
                  onClick={() => setGalleryViewMode('timeline')}
                  title="Production Timeline Feed"
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    galleryViewMode === 'timeline' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  <span className="hidden sm:inline">Timeline</span>
                </button>
              </div>

              {/* Action Creators: Voice Note, Quick Note, Import, Sync */}
              <button
                onClick={() => {
                  setVoiceNoteTitle('');
                  setIsVoiceRecorderOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 flex items-center gap-1.5 transition-all shadow-sm"
                title="Record Voice Note directly in Vault"
              >
                <Mic size={14} />
                <span className="hidden md:inline">Voice Note</span>
              </button>

              <button
                onClick={() => {
                  setQuickNoteTitle('');
                  setQuickNoteContent('');
                  setIsNoteModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400 hover:bg-lime-500/20 flex items-center gap-1.5 transition-all shadow-sm"
                title="Write a Production Memo"
              >
                <StickyNote size={14} />
                <span className="hidden md:inline">Quick Note</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-200 border border-zinc-700 flex items-center gap-1.5 transition-all shadow-sm"
                title="Import PDF, Word, Image, Audio, Sheet"
              >
                <Upload size={14} />
                <span className="hidden md:inline">Import</span>
              </button>

              <button
                onClick={handleSyncArtifacts}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#f5a623] hover:bg-[#e09612] text-black flex items-center gap-1.5 transition-all shadow-md font-mono"
                title="Scan and synchronize all notes, voice memos, storyboard panels, and breakdowns from project"
              >
                <Sparkles size={14} />
                <span>Sync Artifacts</span>
              </button>
            </>
          ) : (
            /* Studio Mode Header Actions */
            <div className="flex items-center gap-2">
              {/* Prev / Next Doc Navigation */}
              <div className="flex items-center rounded-lg bg-zinc-800/80 border border-zinc-700/60 p-0.5">
                <button
                  onClick={() => {
                    const idx = filteredDocuments.findIndex((d) => d.id === selectedDocId);
                    if (idx > 0) handleOpenDocInStudio(filteredDocuments[idx - 1].id);
                  }}
                  disabled={filteredDocuments.findIndex((d) => d.id === selectedDocId) <= 0}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
                  title="Previous Document"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => {
                    const idx = filteredDocuments.findIndex((d) => d.id === selectedDocId);
                    if (idx >= 0 && idx < filteredDocuments.length - 1) {
                      handleOpenDocInStudio(filteredDocuments[idx + 1].id);
                    }
                  }}
                  disabled={filteredDocuments.findIndex((d) => d.id === selectedDocId) >= filteredDocuments.length - 1}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
                  title="Next Document"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* In-Place Edit Mode Toggle */}
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                  isEditMode ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                <Edit3 size={14} />
                <span>{isEditMode ? 'Editing' : 'Edit'}</span>
              </button>

              {hasUnsavedChanges && (
                <button
                  onClick={handleSaveDocumentContent}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md transition-all animate-pulse"
                >
                  <Save size={14} />
                  <span>Save Changes</span>
                </button>
              )}

              {/* Archive / Unarchive Button (NO DELETION GUARANTEE) */}
              {selectedDoc?.isArchived ? (
                <button
                  onClick={(e) => handleUnarchiveDocument(e, selectedDoc.id)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 flex items-center gap-1.5 transition-all"
                  title="Restore document to active Vault"
                >
                  <ArchiveRestore size={14} />
                  <span>Unarchive</span>
                </button>
              ) : (
                <button
                  onClick={(e) => handleArchiveDocument(e, selectedDoc?.id || '')}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:text-amber-400 hover:border-amber-500/40 flex items-center gap-1.5 transition-all"
                  title="Safely archive this document into Vault history"
                >
                  <Archive size={14} />
                  <span>Archive</span>
                </button>
              )}

              {/* Print Preview */}
              <button
                onClick={() => window.print()}
                className="p-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:text-white"
                title="Print Document"
              >
                <Printer size={15} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* =========================================================================
          MAIN VAULT VIEW: GRAND GALLERY HUB vs. DOCUMENT STUDIO
         ========================================================================= */}
      {!inStudioMode ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Filter Chips Bar & Sort Selector */}
          <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#151518] border-[#222226]'
          }`}>
            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {(
                [
                  'ALL',
                  'SCRIPT',
                  'LOOKBOOK',
                  'VOICE_NOTE',
                  'SNAPSHOT',
                  'BREAKDOWN',
                  'CALLSHEET',
                  'NOTE',
                  'STORYBOARD',
                  'SAFETY',
                  'CONTRACT',
                  'EXPORT',
                  'ARCHIVED'
                ] as const
              ).map((catKey) => {
                const isSelected = selectedCategory === catKey;
                const count = counts[catKey] || 0;
                const isArchivedChip = catKey === 'ARCHIVED';

                return (
                  <button
                    key={catKey}
                    onClick={() => setSelectedCategory(catKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border ${
                      isSelected
                        ? isArchivedChip
                          ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                          : 'bg-[#f5a623] text-black border-[#f5a623] shadow-md'
                        : isArchivedChip
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                        : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        : 'bg-zinc-900/60 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    {isArchivedChip ? <Archive size={13} /> : null}
                    <span>{isArchivedChip ? 'Archived' : CATEGORY_STYLES[catKey]?.label || catKey}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? 'bg-black/20 text-inherit'
                        : 'bg-zinc-800/80 text-zinc-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                <ArrowUpDown size={12} />
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`text-xs font-bold rounded-lg border px-2.5 py-1 outline-none ${
                  isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                }`}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title (A-Z)</option>
                <option value="comments">Most Annotations</option>
              </select>
            </div>
          </div>

          {/* Archived Notice Banner when viewing the Archive */}
          {selectedCategory === 'ARCHIVED' && (
            <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-400">
              <div className="flex items-center gap-2 font-medium">
                <Archive size={15} />
                <span>
                  <strong>Vault Permanent Archive:</strong> Documents here are preserved for historical record. Backstage never deletes production assets.
                </span>
              </div>
              <span className="font-mono text-[11px] opacity-80">
                Click "Unarchive" on any item to restore to active gallery
              </span>
            </div>
          )}

          {/* Gallery Content Area */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {filteredDocuments.length === 0 ? (
              <div className="h-96 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/60 flex items-center justify-center text-zinc-500 mb-4">
                  <Search size={28} />
                </div>
                <h3 className="text-base font-bold mb-1">No matching assets found</h3>
                <p className="text-xs text-zinc-400 max-w-sm mb-4">
                  {searchQuery
                    ? `No documents matching "${searchQuery}" in this category.`
                    : 'No documents in this category yet. Record a voice memo, write a note, or click Sync Artifacts.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ALL');
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={handleSyncArtifacts}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#f5a623] text-black"
                  >
                    Sync App Artifacts
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* -------------------------------------------------------------
                    LAYOUT 1: VISUAL CARD GALLERY VIEW
                   ------------------------------------------------------------- */}
                {galleryViewMode === 'gallery' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredDocuments.map((doc) => {
                      const style = CATEGORY_STYLES[doc.category] || CATEGORY_STYLES.OTHER;
                      const IconComp = style.icon;
                      const isAudio = doc.category === 'VOICE_NOTE' || doc.fileType === 'audio' || !!doc.audioUrl;
                      const isImage = !!doc.imageDataUrl;
                      const isPlayingThis = playingDocId === doc.id;

                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleOpenDocInStudio(doc.id)}
                          className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-0.5 ${
                            isLight
                              ? 'bg-white border-slate-200/90 hover:border-[#f5a623]'
                              : 'bg-[#141418] border-[#25252b] hover:border-[#f5a623]/80 hover:bg-[#18181f]'
                          }`}
                        >
                          {/* Top Visual Preview Area */}
                          <div className={`h-40 w-full relative overflow-hidden border-b flex items-center justify-center ${
                            isLight ? 'bg-slate-100 border-slate-100' : 'bg-[#0e0e11] border-[#222226]'
                          }`}>
                            {/* CASE 1: Voice Note / Audio Player Card */}
                            {isAudio ? (
                              <div className="w-full h-full p-4 flex flex-col justify-between bg-gradient-to-br from-cyan-950/30 via-zinc-900/60 to-zinc-950/80">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                                    <Radio size={14} className={isPlayingThis ? 'animate-pulse text-cyan-300' : ''} />
                                    Voice Memo
                                  </span>
                                  <span className="text-[11px] font-mono text-cyan-300/80 px-2 py-0.5 rounded bg-cyan-900/30 border border-cyan-800/40">
                                    {doc.durationSeconds ? `${doc.durationSeconds}s` : 'Audio'}
                                  </span>
                                </div>

                                {/* Animated Audio Waveform Bars */}
                                <div className="flex items-end justify-center gap-1.5 h-14 my-1">
                                  {[35, 65, 45, 85, 95, 60, 40, 75, 90, 50, 70, 40, 80, 60, 45].map((h, i) => (
                                    <div
                                      key={i}
                                      className={`w-1 rounded-full transition-all duration-150 ${
                                        isPlayingThis
                                          ? 'bg-cyan-400 animate-pulse'
                                          : 'bg-zinc-600 group-hover:bg-cyan-500/60'
                                      }`}
                                      style={{
                                        height: isPlayingThis ? `${Math.max(15, (h * ((i % 3) + 1)) % 100)}%` : `${h}%`,
                                      }}
                                    />
                                  ))}
                                </div>

                                {/* Quick Play / Pause Button */}
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={(e) => togglePlayAudio(doc, e)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                      isPlayingThis
                                        ? 'bg-cyan-500 text-black shadow-lg'
                                        : 'bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black'
                                    }`}
                                  >
                                    {isPlayingThis ? <Pause size={13} /> : <Play size={13} />}
                                    <span>{isPlayingThis ? 'Pause' : 'Play Audio'}</span>
                                  </button>
                                  <span className="text-[10px] text-zinc-500 font-mono">WebM Audio</span>
                                </div>
                              </div>
                            ) : isImage ? (
                              /* CASE 2: Image / Storyboard / Snapshot Preview */
                              <div className="w-full h-full relative overflow-hidden bg-black/40 flex items-center justify-center">
                                <img
                                  src={doc.imageDataUrl}
                                  alt={doc.title}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                    <Eye size={12} /> Inspect Canvas
                                  </span>
                                </div>
                              </div>
                            ) : (
                              /* CASE 3: Document Paper Simulation */
                              <div className="w-full h-full p-4 flex flex-col justify-start relative overflow-hidden">
                                <div className="w-3/4 h-2.5 rounded bg-zinc-700/60 mb-2"></div>
                                <div className="w-full h-1.5 rounded bg-zinc-700/40 mb-1.5"></div>
                                <div className="w-5/6 h-1.5 rounded bg-zinc-700/40 mb-1.5"></div>
                                <div className="w-2/3 h-1.5 rounded bg-zinc-700/40 mb-3"></div>
                                <div className="text-[11px] font-mono line-clamp-3 text-zinc-400 leading-relaxed italic opacity-85">
                                  {doc.textContent || (doc.htmlContent ? doc.htmlContent.replace(/<[^>]+>/g, ' ') : 'Production Document')}
                                </div>
                                <div className="absolute bottom-2 right-3 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                                  <BookOpen size={11} /> {doc.pageCount || 1} {doc.pageCount === 1 ? 'Page' : 'Pages'}
                                </div>
                              </div>
                            )}

                            {/* Top Badge: Category Pill */}
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border backdrop-blur-md shadow-sm ${style.badgeBg} ${style.badgeText} ${style.border}`}>
                                <IconComp size={10} className="inline mr-1" />
                                {doc.category}
                              </span>
                            </div>

                            {/* Top Right: Archive Quick Trigger */}
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {doc.isArchived ? (
                                <button
                                  onClick={(e) => handleUnarchiveDocument(e, doc.id)}
                                  className="p-1.5 rounded-lg bg-zinc-900/90 text-amber-400 hover:bg-amber-500 hover:text-black transition-all shadow-md"
                                  title="Unarchive / Restore"
                                >
                                  <ArchiveRestore size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => handleArchiveDocument(e, doc.id)}
                                  className="p-1.5 rounded-lg bg-zinc-900/90 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-all shadow-md"
                                  title="Archive document (Safely preserved)"
                                >
                                  <Archive size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h3 className="text-sm font-bold tracking-tight line-clamp-2 leading-snug group-hover:text-[#f5a623] transition-colors">
                                  {doc.title}
                                </h3>
                              </div>

                              {doc.titleTa && (
                                <p className="text-xs font-tamil text-[#f5a623]/80 line-clamp-1 mb-2">
                                  {doc.titleTa}
                                </p>
                              )}

                              {/* Tags */}
                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {doc.tags.slice(0, 3).map((tag, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                        isLight ? 'bg-slate-100 text-slate-600' : 'bg-zinc-800/80 text-zinc-400'
                                      }`}
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {doc.tags.length > 3 && (
                                    <span className="text-[10px] text-zinc-500 self-center">
                                      +{doc.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Card Meta Footer */}
                            <div className={`pt-3 border-t flex items-center justify-between text-xs ${
                              isLight ? 'border-slate-100 text-slate-500' : 'border-[#222226] text-zinc-400'
                            }`}>
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold text-[#f5a623]">
                                  {doc.author ? doc.author.charAt(0).toUpperCase() : 'P'}
                                </div>
                                <span className="truncate max-w-[90px] text-[11px] font-medium">
                                  {doc.author || 'Production'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                {doc.annotations && doc.annotations.length > 0 && (
                                  <span className="flex items-center gap-1 text-[#f5a623]" title={`${doc.annotations.length} Annotations & Comments`}>
                                    <MessageSquare size={12} />
                                    {doc.annotations.length}
                                  </span>
                                )}
                                <span>{doc.fileSize || '1.1 MB'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* -------------------------------------------------------------
                    LAYOUT 2: DETAILED TABLE / LIST VIEW
                   ------------------------------------------------------------- */}
                {galleryViewMode === 'table' && (
                  <div className={`rounded-2xl border overflow-hidden shadow-lg ${
                    isLight ? 'bg-white border-slate-200' : 'bg-[#121215] border-[#222226]'
                  }`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b font-mono font-bold text-[11px] uppercase tracking-wider ${
                          isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-zinc-900/60 text-zinc-400 border-zinc-800'
                        }`}>
                          <th className="p-3.5 pl-5">Document Title & Filename</th>
                          <th className="p-3.5">Category</th>
                          <th className="p-3.5">Format</th>
                          <th className="p-3.5">Author</th>
                          <th className="p-3.5">Size / Length</th>
                          <th className="p-3.5">Uploaded</th>
                          <th className="p-3.5">Marks</th>
                          <th className="p-3.5 text-right pr-5">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {filteredDocuments.map((doc) => {
                          const style = CATEGORY_STYLES[doc.category] || CATEGORY_STYLES.OTHER;
                          const isAudio = doc.category === 'VOICE_NOTE' || doc.fileType === 'audio' || !!doc.audioUrl;
                          const isPlayingThis = playingDocId === doc.id;

                          return (
                            <tr
                              key={doc.id}
                              onClick={() => handleOpenDocInStudio(doc.id)}
                              className={`transition-colors cursor-pointer group ${
                                isLight ? 'hover:bg-slate-50' : 'hover:bg-zinc-800/40'
                              }`}
                            >
                              <td className="p-3.5 pl-5">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${style.badgeBg} ${style.badgeText} ${style.border}`}>
                                    {isAudio ? <Mic size={15} /> : doc.imageDataUrl ? <ImageIcon size={15} /> : <FileText size={15} />}
                                  </div>
                                  <div>
                                    <div className="font-bold text-sm tracking-tight group-hover:text-[#f5a623] transition-colors">
                                      {doc.title}
                                    </div>
                                    <div className="font-mono text-[11px] text-zinc-500">
                                      {doc.fileName}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${style.badgeBg} ${style.badgeText} ${style.border}`}>
                                  {doc.category}
                                </span>
                              </td>

                              <td className="p-3.5 font-mono uppercase text-zinc-400">
                                {doc.fileType || 'PDF'}
                              </td>

                              <td className="p-3.5 text-zinc-300">
                                {doc.author || 'Production'}
                              </td>

                              <td className="p-3.5 font-mono text-zinc-400">
                                {doc.durationSeconds ? `${doc.durationSeconds}s` : doc.fileSize || '1.1 MB'}
                              </td>

                              <td className="p-3.5 font-mono text-zinc-500">
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </td>

                              <td className="p-3.5">
                                {doc.annotations && doc.annotations.length > 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-[#f5a623]/10 text-[#f5a623] font-bold text-[11px] border border-[#f5a623]/30">
                                    {doc.annotations.length} marks
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>

                              <td className="p-3.5 text-right pr-5">
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  {isAudio && (
                                    <button
                                      onClick={(e) => togglePlayAudio(doc, e)}
                                      className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all"
                                      title="Play audio note"
                                    >
                                      {isPlayingThis ? <Pause size={13} /> : <Play size={13} />}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleOpenDocInStudio(doc.id)}
                                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                                    title="Open in Document Studio"
                                  >
                                    <ExternalLink size={13} />
                                  </button>

                                  {doc.isArchived ? (
                                    <button
                                      onClick={(e) => handleUnarchiveDocument(e, doc.id)}
                                      className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black transition-all"
                                      title="Restore from Archive"
                                    >
                                      <ArchiveRestore size={13} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => handleArchiveDocument(e, doc.id)}
                                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-all"
                                      title="Archive document"
                                    >
                                      <Archive size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    LAYOUT 3: KANBAN / CATEGORY BOARD VIEW
                   ------------------------------------------------------------- */}
                {galleryViewMode === 'kanban' && (
                  <div className="flex gap-5 overflow-x-auto pb-4 items-start scrollbar-thin">
                    {(
                      [
                        'SCRIPT',
                        'LOOKBOOK',
                        'VOICE_NOTE',
                        'SNAPSHOT',
                        'BREAKDOWN',
                        'CALLSHEET',
                        'NOTE',
                        'CONTRACT'
                      ] as const
                    ).map((catKey) => {
                      const colDocs = filteredDocuments.filter((d) => d.category === catKey);
                      const style = CATEGORY_STYLES[catKey] || CATEGORY_STYLES.OTHER;
                      const IconComp = style.icon;

                      return (
                        <div
                          key={catKey}
                          className={`w-80 shrink-0 rounded-2xl border flex flex-col max-h-[calc(100vh-230px)] shadow-md ${
                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121215] border-[#222226]'
                          }`}
                        >
                          {/* Column Header */}
                          <div className="p-3.5 border-b flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                              <span className={`p-1.5 rounded-lg ${style.badgeBg} ${style.badgeText} border ${style.border}`}>
                                <IconComp size={14} />
                              </span>
                              <span className="font-black text-xs uppercase tracking-tight">
                                {style.label}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                              {colDocs.length}
                            </span>
                          </div>

                          {/* Column Items */}
                          <div className="p-3 flex-1 overflow-y-auto space-y-3 scrollbar-thin">
                            {colDocs.map((doc) => (
                              <div
                                key={doc.id}
                                onClick={() => handleOpenDocInStudio(doc.id)}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-lg hover:border-[#f5a623]/80 ${
                                  isLight ? 'bg-white border-slate-200' : 'bg-[#18181d] border-[#2a2a30]'
                                }`}
                              >
                                <div className="text-xs font-bold leading-snug mb-1 line-clamp-2">
                                  {doc.title}
                                </div>
                                <div className="text-[11px] text-zinc-500 line-clamp-2 mb-2 font-mono">
                                  {doc.textContent || doc.fileName}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-800/60 font-mono">
                                  <span>{doc.author || 'Production'}</span>
                                  <span>{doc.fileSize || '1.1 MB'}</span>
                                </div>
                              </div>
                            ))}
                            {colDocs.length === 0 && (
                              <div className="py-8 text-center text-xs text-zinc-500 italic">
                                No items in this category
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* -------------------------------------------------------------
                    LAYOUT 4: TIMELINE ACTIVITY VIEW
                   ------------------------------------------------------------- */}
                {galleryViewMode === 'timeline' && (
                  <div className="max-w-3xl mx-auto py-4">
                    <div className="relative border-l-2 border-zinc-800 ml-4 pl-6 space-y-6">
                      {filteredDocuments.map((doc) => {
                        const style = CATEGORY_STYLES[doc.category] || CATEGORY_STYLES.OTHER;
                        const IconComp = style.icon;

                        return (
                          <div key={doc.id} className="relative group">
                            {/* Dot on line */}
                            <div className={`absolute -left-[33px] top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${style.badgeBg} ${style.badgeText} ${style.border} bg-zinc-950 shadow-md`}>
                              <IconComp size={12} />
                            </div>

                            {/* Timeline Card */}
                            <div
                              onClick={() => handleOpenDocInStudio(doc.id)}
                              className={`p-4 rounded-2xl border transition-all cursor-pointer hover:border-[#f5a623] hover:shadow-xl ${
                                isLight ? 'bg-white border-slate-200' : 'bg-[#131317] border-[#24242a]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${style.badgeBg} ${style.badgeText} ${style.border}`}>
                                  {doc.category}
                                </span>
                                <span className="text-xs font-mono text-zinc-500">
                                  {new Date(doc.uploadedAt).toLocaleString()}
                                </span>
                              </div>

                              <h4 className="text-sm font-bold tracking-tight mb-1 group-hover:text-[#f5a623] transition-colors">
                                {doc.title}
                              </h4>
                              <p className="text-xs text-zinc-400 line-clamp-2 mb-2 font-mono">
                                {doc.textContent || doc.fileName}
                              </p>

                              <div className="flex items-center justify-between text-xs text-zinc-500 font-mono pt-2 border-t border-zinc-800/40">
                                <span>Author: {doc.author || 'Production Member'}</span>
                                <span className="flex items-center gap-2">
                                  {doc.annotations?.length ? `${doc.annotations.length} comments` : ''}
                                  <span>{doc.fileSize}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* =========================================================================
            DOCUMENT STUDIO / READER / PLAYER / ANNOTATOR / INSPECTOR
           ========================================================================= */
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main Inspection Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Archived Alert Banner if document is archived */}
            {selectedDoc?.isArchived && (
              <div className="px-6 py-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-400 shrink-0">
                <div className="flex items-center gap-2 font-bold">
                  <Archive size={16} />
                  <span>Archived Document — Permanently preserved in Backstage Vault's historic archive.</span>
                </div>
                <button
                  onClick={(e) => handleUnarchiveDocument(e, selectedDoc.id)}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-500 text-black flex items-center gap-1.5 shadow"
                >
                  <ArchiveRestore size={14} />
                  Restore to Active Vault
                </button>
              </div>
            )}

            {/* Studio Action Sub-Toolbar: Markup Tools, Audio Controls, Zoom, Layout */}
            <div className={`h-12 px-6 border-b flex items-center justify-between shrink-0 ${
              isLight ? 'bg-white/90 border-slate-200' : 'bg-[#141418]/90 border-[#222226]'
            }`}>
              {/* Left: Markup & Annotation Tool Selector */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTool('hand')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    activeTool === 'hand' ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title="Hand Tool (Pan & Select)"
                >
                  <Hand size={13} />
                  <span>Pan</span>
                </button>

                <button
                  onClick={() => setActiveTool('highlight')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    activeTool === 'highlight' ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title="Highlighter"
                >
                  <Highlighter size={13} />
                  <span>Highlight</span>
                </button>

                <button
                  onClick={() => setActiveTool('pen')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    activeTool === 'pen' ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title="Pen / Freehand Draw"
                >
                  <PenTool size={13} />
                  <span>Draw</span>
                </button>

                <button
                  onClick={() => setActiveTool('rect')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    activeTool === 'rect' ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title="Draw Rectangle Marker"
                >
                  <Square size={13} />
                  <span>Box</span>
                </button>

                <button
                  onClick={() => setActiveTool('note')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    activeTool === 'note' ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                  title="Sticky Note Marker"
                >
                  <StickyNote size={13} />
                  <span>Sticky Note</span>
                </button>

                {/* Color Picker Swatches */}
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-zinc-700/60">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setActiveColor(c.color)}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        activeColor === c.color ? 'scale-125 border-white shadow' : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Center: Audio Player Bar if Selected Doc is Audio */}
              {selectedDoc?.audioUrl && (
                <div className="flex items-center gap-3 bg-cyan-950/40 border border-cyan-800/50 px-3 py-1 rounded-xl">
                  <button
                    onClick={(e) => togglePlayAudio(selectedDoc, e)}
                    className="w-7 h-7 rounded-full bg-cyan-500 text-black flex items-center justify-center font-bold shadow-md hover:bg-cyan-400"
                  >
                    {playingDocId === selectedDoc.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </button>

                  <div className="flex items-center gap-2 font-mono text-xs text-cyan-300">
                    <span>
                      {playingDocId === selectedDoc.id
                        ? `${Math.floor(audioCurrentTime)}s`
                        : '0s'}
                    </span>
                    <span className="text-zinc-500">/</span>
                    <span>{selectedDoc.durationSeconds ? `${selectedDoc.durationSeconds}s` : 'Audio'}</span>
                  </div>

                  {/* Playback Speed Multiplier */}
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    {[1, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleSetSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded ${
                          audioPlaybackRate === spd ? 'bg-cyan-500 text-black font-bold' : 'text-cyan-400 hover:bg-cyan-900/40'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Right: Zoom & Layout View (Stacked, Single, Spread) */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg bg-zinc-800/80 border border-zinc-700/60 p-0.5">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-300"
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="px-2 font-mono text-xs text-zinc-300 min-w-[45px] text-center">
                    {zoomLevel}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-300"
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="px-1.5 text-[10px] font-bold text-zinc-400 hover:text-white"
                    title="Reset Zoom"
                  >
                    Reset
                  </button>
                </div>

                {/* Reader Layout Mode */}
                <div className="flex items-center rounded-lg bg-zinc-800/80 border border-zinc-700/60 p-0.5">
                  <button
                    onClick={() => setReaderViewMode('stacked')}
                    className={`p-1 rounded ${readerViewMode === 'stacked' ? 'bg-[#f5a623] text-black' : 'text-zinc-300'}`}
                    title="Stacked Continuous Pages"
                  >
                    <Layers size={14} />
                  </button>
                  <button
                    onClick={() => setReaderViewMode('single')}
                    className={`p-1 rounded ${readerViewMode === 'single' ? 'bg-[#f5a623] text-black' : 'text-zinc-300'}`}
                    title="Single Page Mode"
                  >
                    <BookOpen size={14} />
                  </button>
                </div>

                {/* Toggle Comments Side Panel */}
                <button
                  onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    showCommentsPanel ? 'bg-[#f5a623]/20 border-[#f5a623]/40 text-[#f5a623]' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                  title="Toggle Comments & AI Panel"
                >
                  <MessageSquare size={13} />
                  <span>Comments ({annotations.length})</span>
                </button>
              </div>
            </div>

            {/* Document Paper & Media Reader Scroller */}
            <div
              ref={documentSheetRef}
              className={`flex-1 overflow-auto p-8 flex justify-center ${
                isLight ? 'bg-slate-200/80' : 'bg-[#0c0c0e]'
              }`}
              style={{
                cursor: activeTool === 'hand' ? 'default' : 'crosshair',
              }}
            >
              {/* Media Studio Renderer */}
              {selectedDoc?.imageDataUrl ? (
                /* IMAGE / SNAPSHOT STUDIO */
                <div
                  className="relative rounded-xl border shadow-2xl overflow-hidden bg-black max-w-4xl max-h-[85vh] flex items-center justify-center"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                >
                  <img
                    src={selectedDoc.imageDataUrl}
                    alt={selectedDoc.title}
                    className="max-h-[80vh] w-auto object-contain"
                  />
                  {/* Freehand SVG Overlay for Drawing on Image */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-auto"
                    onMouseDown={(e) => handleSheetMouseDown(e, 1)}
                    onMouseMove={(e) => handleSheetMouseMove(e, 1)}
                    onMouseUp={handleSheetMouseUp}
                  >
                    {/* Render existing annotations */}
                    {pageAnnotations.map((anno) => {
                      if (anno.type === 'pen' && anno.points) {
                        const d = anno.points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
                        return <path key={anno.id} d={d} stroke={anno.color} strokeWidth={anno.strokeWidth || 3} fill="none" strokeLinecap="round" />;
                      }
                      if (anno.type === 'rect') {
                        return <rect key={anno.id} x={anno.x} y={anno.y} width={anno.width} height={anno.height} stroke={anno.color} strokeWidth={anno.strokeWidth || 2} fill="none" />;
                      }
                      return null;
                    })}
                  </svg>
                </div>
              ) : (
                /* UNIVERSAL PAGINATED DOCUMENT READER */
                <div
                  className="flex flex-col gap-8 items-center pb-24"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                >
                  {(paginatedDoc.pages.length > 0
                    ? readerViewMode === 'single'
                      ? [paginatedDoc.pages[currentPage - 1] || paginatedDoc.pages[0]]
                      : paginatedDoc.pages
                    : [{ pageNumber: 1, html: selectedDoc?.htmlContent || selectedDoc?.textContent || '' }]
                  ).map((pg, idx) => {
                    const pageNum = pg.pageNumber || idx + 1;
                    const thisPageAnnotations = annotations.filter((a) => a.pageNumber === pageNum);

                    return (
                      <div
                        id={`doc-page-${pageNum}`}
                        key={pageNum}
                        className={`w-[780px] min-h-[1060px] p-16 relative shadow-2xl rounded-sm transition-all ${
                          isLight ? 'bg-white text-black' : 'bg-[#18181b] text-gray-100'
                        } ${docFontFamily === 'serif' ? 'font-serif' : docFontFamily === 'mono' ? 'font-mono' : 'font-sans'}`}
                      >
                        {/* Page Header */}
                        {showHeader && (
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 pb-4 mb-6 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-widest font-mono">
                            <span>{customHeaderTitle || selectedDoc?.title}</span>
                            <span>{selectedDoc?.category}</span>
                          </div>
                        )}

                        {/* Editable or Static Page Content */}
                        {isEditMode ? (
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => {
                              setEditedHtmlContent(e.currentTarget.innerHTML);
                              setHasUnsavedChanges(true);
                            }}
                            dangerouslySetInnerHTML={{ __html: pg.html }}
                            className="outline-none min-h-[850px] leading-relaxed text-sm focus:ring-1 focus:ring-[#f5a623]/40 rounded p-2"
                          />
                        ) : (
                          <div
                            dangerouslySetInnerHTML={{ __html: pg.html }}
                            className="leading-relaxed text-sm min-h-[850px]"
                          />
                        )}

                        {/* Page Footer */}
                        {showFooter && (
                          <div className="absolute bottom-8 left-16 right-16 flex justify-between items-center text-[10px] text-zinc-400 pt-4 border-t border-zinc-200 dark:border-zinc-800 font-mono">
                            <span>{customFooterText || 'Backstage Production Sequencer'}</span>
                            <span>Page {pageNum} of {totalPages}</span>
                          </div>
                        )}

                        {/* Drawing & Sticky Note Annotation Layer */}
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-auto"
                          onMouseDown={(e) => handleSheetMouseDown(e, pageNum)}
                          onMouseMove={(e) => handleSheetMouseMove(e, pageNum)}
                          onMouseUp={handleSheetMouseUp}
                        >
                          {thisPageAnnotations.map((anno) => {
                            if (anno.type === 'pen' && anno.points) {
                              const d = anno.points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
                              return <path key={anno.id} d={d} stroke={anno.color} strokeWidth={anno.strokeWidth || 3} fill="none" strokeLinecap="round" />;
                            }
                            if (anno.type === 'rect') {
                              return <rect key={anno.id} x={anno.x} y={anno.y} width={anno.width} height={anno.height} stroke={anno.color} strokeWidth={anno.strokeWidth || 2} fill="none" />;
                            }
                            if (anno.type === 'highlight') {
                              return <rect key={anno.id} x={anno.x} y={anno.y} width={anno.width} height={anno.height} fill={anno.color} opacity={anno.opacity || 0.35} />;
                            }
                            return null;
                          })}
                        </svg>

                        {/* Sticky Notes on Page */}
                        {thisPageAnnotations
                          .filter((a) => a.type === 'note')
                          .map((note) => (
                            <div
                              key={note.id}
                              style={{ left: note.x || 100, top: note.y || 100 }}
                              className="absolute w-48 p-2.5 rounded-lg shadow-xl bg-amber-400 text-black text-xs font-sans border border-amber-500 z-10 animate-in fade-in"
                            >
                              <div className="font-bold text-[10px] uppercase tracking-wider mb-1 flex items-center justify-between text-amber-900">
                                <span>Sticky Note</span>
                                <span>{note.author || 'AD'}</span>
                              </div>
                              <p className="leading-tight">{note.text}</p>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Side-by-Side Comments & AI Assistant Panel */}
          {showCommentsPanel && (
            <aside className={`w-80 border-l flex flex-col shrink-0 transition-all ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#121215] border-[#222226]'
            }`}>
              {/* Panel Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#f5a623]" />
                  <span className="font-black text-xs uppercase tracking-wider">Comments & Notes</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300">
                    {annotations.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowCommentsPanel(false)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {annotations.filter((a) => a.type === 'comment' || a.type === 'note').length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
                    <p>No comments on this document yet.</p>
                    <p className="text-[11px] text-zinc-600 mt-1">Add a note or comment below to collaborate.</p>
                  </div>
                ) : (
                  annotations
                    .filter((a) => a.type === 'comment' || a.type === 'note')
                    .map((anno) => (
                      <div
                        key={anno.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          anno.status === 'resolved'
                            ? 'opacity-60 bg-zinc-900/30 border-zinc-800'
                            : isLight
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-[#18181e] border-[#2a2a32]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-zinc-200">
                            {anno.author || 'Production Member'}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            p. {anno.pageNumber}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed mb-2.5">
                          {anno.text}
                        </p>

                        {/* Threaded Replies */}
                        {anno.replies && anno.replies.length > 0 && (
                          <div className="pl-3 border-l-2 border-zinc-700 space-y-2 mb-2 pt-1">
                            {anno.replies.map((reply) => (
                              <div key={reply.id} className="text-xs">
                                <span className="font-bold text-[#f5a623] mr-1 text-[11px]">
                                  {reply.author}:
                                </span>
                                <span className="text-zinc-300">{reply.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Input */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <input
                            type="text"
                            value={replyInput[anno.id] || ''}
                            onChange={(e) => setReplyInput({ ...replyInput, [anno.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddReply(anno.id)}
                            placeholder="Reply..."
                            className="flex-1 py-1 px-2 text-xs rounded bg-zinc-900 border border-zinc-700 outline-none"
                          />
                          <button
                            onClick={() => handleAddReply(anno.id)}
                            className="p-1 rounded bg-[#f5a623] text-black font-bold"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Add New Comment Box */}
              <div className="p-3 border-t bg-zinc-950/60">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGeneralComment()}
                    placeholder="Add comment on this document..."
                    className="flex-1 py-1.5 px-3 text-xs rounded-xl bg-zinc-900 border border-zinc-700 outline-none text-zinc-200 placeholder:text-zinc-500"
                  />
                  <button
                    onClick={handleAddGeneralComment}
                    className="p-2 rounded-xl bg-[#f5a623] text-black font-bold hover:bg-[#e09612]"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: RECORD VOICE NOTE MODAL
         ========================================================================= */}
      {isVoiceRecorderOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-cyan-500/30 p-6 shadow-2xl text-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Mic size={18} />
                </div>
                <h3 className="text-base font-bold">Record Voice Note into Vault</h3>
              </div>
              <button
                onClick={() => {
                  stopRecordingVoiceNote();
                  setIsVoiceRecorderOpen(false);
                }}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Recording Controls */}
            <div className="py-6 flex flex-col items-center justify-center bg-zinc-900/60 rounded-xl border border-zinc-800/80 mb-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 transition-all ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 border-2 border-red-500 animate-pulse'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}>
                <Mic size={32} />
              </div>

              <div className="font-mono text-2xl font-bold text-cyan-400 mb-2">
                {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                {String(recordingSeconds % 60).padStart(2, '0')}
              </div>

              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecordingVoiceNote}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                  >
                    <Radio size={14} />
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecordingVoiceNote}
                    className="px-4 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                  >
                    <Square size={14} />
                    Stop Recording
                  </button>
                )}
              </div>
            </div>

            {/* Note Title & Meta Fields */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Voice Note Title</label>
                <input
                  type="text"
                  value={voiceNoteTitle}
                  onChange={(e) => setVoiceNoteTitle(e.target.value)}
                  placeholder="e.g., Director On-Set Lens Blocking Note"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-700 outline-none text-zinc-200"
                />
              </div>

              {recordedAudioDataUrl && (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40">
                  <span className="block text-[11px] font-bold text-cyan-400 mb-1">Preview Audio:</span>
                  <audio src={recordedAudioDataUrl} controls className="w-full h-8" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsVoiceRecorderOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVoiceNote}
                disabled={!recordedAudioDataUrl}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-40"
              >
                Save to Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: QUICK PRODUCTION NOTE MODAL
         ========================================================================= */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141418] border border-lime-500/30 p-6 shadow-2xl text-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lime-500/20 text-lime-400 flex items-center justify-center font-bold">
                  <StickyNote size={18} />
                </div>
                <h3 className="text-base font-bold">New Production Note</h3>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Note Title</label>
                <input
                  type="text"
                  value={quickNoteTitle}
                  onChange={(e) => setQuickNoteTitle(e.target.value)}
                  placeholder="e.g., East Gopuram Crowd Marshalling Schedule"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-700 outline-none text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Note Content</label>
                <textarea
                  rows={5}
                  value={quickNoteContent}
                  onChange={(e) => setQuickNoteContent(e.target.value)}
                  placeholder="Type production instructions, scene notes, or logistics here..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-700 outline-none text-zinc-200 resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={quickNoteTags}
                  onChange={(e) => setQuickNoteTags(e.target.value)}
                  placeholder="Logistics, Sound, Crowd, Temple"
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-900 border border-zinc-700 outline-none text-zinc-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuickNote}
                disabled={!quickNoteContent.trim() && !quickNoteTitle.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-40"
              >
                Save to Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentVaultView;
