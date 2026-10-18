/**
 * Universal Markdown & HTML Document Pagination Engine (Browser & Web Engine)
 * Mirrors the C++ MarkdownPaginator architecture for high-speed sub-millisecond
 * discrete A4 printable page calculations, orphan prevention, and running headers/footers.
 */

import { markdownToHtml } from './markdownEngine';
import { paginateDocumentHtml, DocumentPage, DocumentPaginationResult } from './documentPaginator';

export type PageViewMode = 'continuous' | 'paginated';

export interface MarkdownPage {
  pageNumber: number;
  totalPages: number;
  markdown: string;
  html: string;
  wordCount: number;
  charCount: number;
  runningHeader: string;
  runningFooter: string;
}

export interface MarkdownPaginationResult {
  totalPages: number;
  pages: MarkdownPage[];
  totalWordCount: number;
  totalCharCount: number;
}

export interface MarkdownPaginatorOptions {
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  fontFamily?: 'sans' | 'serif' | 'mono' | 'calibri' | 'inter';
  docTitle?: string;
  docSubtitle?: string;
  pageSize?: 'a4' | 'letter';
}

/**
 * Paginates Markdown or rich document HTML into authentic discrete A4 printable pages
 */
export function paginateMarkdownContent(
  markdown: string,
  options: MarkdownPaginatorOptions = {}
): MarkdownPaginationResult {
  const docTitle = options.docTitle || 'Master Production Document';
  const docSubtitle = options.docSubtitle || '1ST AD BREAKDOWN & PRODUCTION CORE';

  if (!markdown || !markdown.trim()) {
    const emptyHtml = '<p class="text-slate-400 italic">Empty document</p>';
    return {
      totalPages: 1,
      pages: [
        {
          pageNumber: 1,
          totalPages: 1,
          markdown: '',
          html: emptyHtml,
          wordCount: 0,
          charCount: 0,
          runningHeader: docTitle,
          runningFooter: 'Page 1 of 1 • Backstage Production Core',
        },
      ],
      totalWordCount: 0,
      totalCharCount: 0,
    };
  }

  // Convert full markdown to structured HTML
  const fullHtml = markdownToHtml(markdown);

  // Paginate HTML using the cumulative DOM measurer with standard A4 parameters
  const paginationResult: DocumentPaginationResult = paginateDocumentHtml(fullHtml, {
    fontSize: options.fontSize || 'md',
    fontFamily: options.fontFamily || 'inter',
    targetHeightPx: 800, // A4 printable height with generous headroom before footer
    contentWidthPx: 680,
  });

  const total = Math.max(1, paginationResult.totalPages);

  const pages: MarkdownPage[] = paginationResult.pages.map((p, idx) => {
    const pageNum = idx + 1;
    return {
      pageNumber: pageNum,
      totalPages: total,
      markdown: '', // Pure page slice
      html: p.html,
      wordCount: p.wordCount,
      charCount: p.charCount,
      runningHeader: docTitle,
      runningFooter: `Page ${pageNum} of ${total} • ${docSubtitle}`,
    };
  });

  return {
    totalPages: total,
    pages,
    totalWordCount: paginationResult.totalWordCount,
    totalCharCount: paginationResult.totalCharCount,
  };
}
