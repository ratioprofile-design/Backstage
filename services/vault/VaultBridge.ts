/**
 * VaultBridge: Unified C++ / High-Speed TS Bridge for Document Vault
 * Integrates:
 * - Sub-millisecond Myers O(ND) script & text diffing
 * - BM25 Inverted Trigram search engine
 * - Virtualized document memory index
 */

import { ProductionDocument } from '../../types';
import { 
  VaultSearchEngine, 
  SearchResult, 
  SearchMatch, 
  VaultDocumentInput 
} from './VaultSearchEngine';
import { 
  compareScriptDrafts, 
  diffLines, 
  createHunks, 
  formatUnifiedDiff,
  ScriptDiffSummary, 
  ScriptSceneInput,
  DiffHunk 
} from './VaultDiffEngine';

export class VaultBridge {
  private static instance: VaultBridge | null = null;
  private searchEngine: VaultSearchEngine = new VaultSearchEngine();
  private isIndexed: boolean = false;
  private indexedDocIds: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): VaultBridge {
    if (!VaultBridge.instance) {
      VaultBridge.instance = new VaultBridge();
    }
    return VaultBridge.instance;
  }

  /**
   * Synchronize the search index with an array of Backstage ProductionDocuments
   */
  public syncDocuments(documents: ProductionDocument[]): void {
    const currentIds = new Set(documents.map(d => d.id));

    // Remove deleted documents
    for (const id of this.indexedDocIds) {
      if (!currentIds.has(id)) {
        this.searchEngine.removeDocument(id);
        this.indexedDocIds.delete(id);
      }
    }

    // Index new or updated documents
    for (const doc of documents) {
      if (doc.isArchived) {
        if (this.indexedDocIds.has(doc.id)) {
          this.searchEngine.removeDocument(doc.id);
          this.indexedDocIds.delete(doc.id);
        }
        continue;
      }

      // Convert document content into searchable text
      let textContent = doc.textContent || (doc as any).content || '';
      if ((doc as any).extractedText) {
        textContent += '\n' + (doc as any).extractedText;
      }
      if (doc.tags && doc.tags.length > 0) {
        textContent += '\nTags: ' + doc.tags.join(', ');
      }
      if ((doc as any).notes) {
        textContent += '\nNotes: ' + (doc as any).notes;
      }

      const input: VaultDocumentInput = {
        id: doc.id,
        title: doc.title,
        category: doc.category || 'OTHER',
        content: textContent
      };

      this.searchEngine.indexDocument(input);
      this.indexedDocIds.add(doc.id);
    }

    this.isIndexed = true;
  }

  /**
   * Search across the document vault in sub-millisecond time
   */
  public search(query: string, categoryFilter?: string, limit: number = 20): SearchResult {
    const rawResult = this.searchEngine.search(query, limit * 2);
    if (!categoryFilter || categoryFilter === 'ALL') {
      return {
        ...rawResult,
        matches: rawResult.matches.slice(0, limit)
      };
    }

    const filtered = rawResult.matches.filter(m => m.category === categoryFilter).slice(0, limit);
    return {
      matches: filtered,
      totalHits: filtered.length,
      queryTimeUs: rawResult.queryTimeUs
    };
  }

  /**
   * Compare two documents (plain text, fountain script, or markdown)
   */
  public compareTextDocuments(
    docA: { id: string; title: string; content: string },
    docB: { id: string; title: string; content: string }
  ): { hunks: DiffHunk[]; unifiedDiff: string; executionTimeMs: number } {
    const t0 = performance.now();
    const diff = diffLines(docA.content, docB.content);
    const hunks = createHunks(diff, 3);
    const unifiedDiff = formatUnifiedDiff(docA.title, docB.title, hunks);
    const executionTimeMs = performance.now() - t0;

    return {
      hunks,
      unifiedDiff,
      executionTimeMs
    };
  }

  /**
   * Compare two screenplay drafts by scene breakdown
   */
  public compareScreenplays(
    scenesA: ScriptSceneInput[],
    scenesB: ScriptSceneInput[]
  ): ScriptDiffSummary {
    return compareScriptDrafts(scenesA, scenesB);
  }

  public getDocumentCount(): number {
    return this.searchEngine.documentCount;
  }

  public clear(): void {
    this.searchEngine.clear();
    this.indexedDocIds.clear();
    this.isIndexed = false;
  }
}

export const vaultBridge = VaultBridge.getInstance();
