/**
 * High-Performance Inverted Index & BM25 Fuzzy Search Engine for Backstage Document Vault
 * Features:
 * - Inverted Token Index with Term Frequency & Line Position tracking
 * - Trigram (3-character) sub-word index for typo-tolerant fuzzy search
 * - BM25 probabilistic document relevance scoring (k1 = 1.2, b = 0.75)
 * - Microsecond-latency execution across thousands of script pages and production docs
 * - Snippet extraction with surrounding context and matched line numbers
 */

export interface SearchMatch {
  docId: string;
  docTitle: string;
  category: string;
  score: number;
  lineNumber: number;
  matchedSnippet: string;
  matchedTokens: string[];
}

export interface SearchResult {
  matches: SearchMatch[];
  totalHits: number;
  queryTimeUs: number; // in microseconds
}

export interface VaultDocumentInput {
  id: string;
  title: string;
  category: string;
  content: string;
}

interface Posting {
  docIndex: number;
  termFrequency: number;
  linePositions: number[];
}

interface DocRecord {
  id: string;
  title: string;
  category: string;
  content: string;
  lines: string[];
  wordCount: number;
}

export class VaultSearchEngine {
  private documents: DocRecord[] = [];
  private docIdToIndex: Map<string, number> = new Map();
  private tokenIndex: Map<string, Posting[]> = new Map();
  private trigramIndex: Map<string, string[]> = new Map();

  private avgDocLength: number = 0;
  private readonly k1: number = 1.2;
  private readonly b: number = 0.75;

  public clear(): void {
    this.documents = [];
    this.docIdToIndex.clear();
    this.tokenIndex.clear();
    this.trigramIndex.clear();
    this.avgDocLength = 0;
  }

  public get documentCount(): number {
    return this.documents.filter(d => Boolean(d.id)).length;
  }

  /**
   * Fast alphanumeric tokenizer
   */
  public tokenize(text: string): string[] {
    if (!text) return [];
    const tokens: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // a-z: 97-122, A-Z: 65-90, 0-9: 48-57
      if (
        (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57)
      ) {
        current += text[i];
      } else if (code >= 65 && code <= 90) {
        current += String.fromCharCode(code + 32); // lowercase
      } else if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    }
    if (current.length > 0) tokens.push(current);
    return tokens;
  }

  /**
   * Generate 3-character sub-word grams for fuzzy typo matching
   */
  private generateTrigrams(word: string): string[] {
    if (word.length < 3) return [];
    const trigrams: string[] = [];
    for (let i = 0; i <= word.length - 3; i++) {
      trigrams.push(word.substring(i, i + 3));
    }
    return trigrams;
  }

  /**
   * Index or re-index a document into the memory pool
   */
  public indexDocument(doc: VaultDocumentInput): void {
    if (this.docIdToIndex.has(doc.id)) {
      this.removeDocument(doc.id);
    }

    const lines = doc.content ? doc.content.split('\n') : [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].endsWith('\r')) {
        lines[i] = lines[i].slice(0, -1);
      }
    }

    const rec: DocRecord = {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      content: doc.content || '',
      lines,
      wordCount: 0
    };

    const termStats = new Map<string, { count: number; lines: number[] }>();

    for (let l = 0; l < lines.length; l++) {
      const lineNum = l + 1;
      const tokens = this.tokenize(lines[l]);
      for (const t of tokens) {
        let stat = termStats.get(t);
        if (!stat) {
          stat = { count: 0, lines: [] };
          termStats.set(t, stat);
        }
        stat.count++;
        if (stat.lines.length === 0 || stat.lines[stat.lines.length - 1] !== lineNum) {
          stat.lines.push(lineNum);
        }
      }
    }

    // Title boost (+5 frequency)
    const titleTokens = this.tokenize(doc.title);
    for (const t of titleTokens) {
      let stat = termStats.get(t);
      if (!stat) {
        stat = { count: 0, lines: [1] };
        termStats.set(t, stat);
      }
      stat.count += 5;
      if (stat.lines.length === 0 || stat.lines[0] !== 1) {
        stat.lines.unshift(1);
      }
    }

    let totalWords = 0;
    for (const [, stat] of termStats) {
      totalWords += stat.count;
    }
    rec.wordCount = totalWords;

    const docIndex = this.documents.length;
    this.documents.push(rec);
    this.docIdToIndex.set(doc.id, docIndex);

    // Populate Inverted & Trigram index
    for (const [term, stat] of termStats) {
      let list = this.tokenIndex.get(term);
      if (!list) {
        list = [];
        this.tokenIndex.set(term, list);
      }
      list.push({
        docIndex,
        termFrequency: stat.count,
        linePositions: stat.lines
      });

      const trigrams = this.generateTrigrams(term);
      for (const tri of trigrams) {
        let triTerms = this.trigramIndex.get(tri);
        if (!triTerms) {
          triTerms = [];
          this.trigramIndex.set(tri, triTerms);
        }
        if (!triTerms.includes(term)) {
          triTerms.push(term);
        }
      }
    }

    // Recalculate average document length
    let sumLength = 0;
    let activeDocs = 0;
    for (const d of this.documents) {
      if (d.id) {
        sumLength += d.wordCount;
        activeDocs++;
      }
    }
    this.avgDocLength = activeDocs > 0 ? (sumLength / activeDocs) : 0;
  }

  /**
   * Remove a document from the inverted index
   */
  public removeDocument(docId: string): void {
    const idx = this.docIdToIndex.get(docId);
    if (idx === undefined) return;

    for (const [, list] of this.tokenIndex) {
      const matchIdx = list.findIndex(p => p.docIndex === idx);
      if (matchIdx !== -1) {
        list.splice(matchIdx, 1);
      }
    }

    this.documents[idx] = {
      id: '',
      title: '',
      category: '',
      content: '',
      lines: [],
      wordCount: 0
    };
    this.docIdToIndex.delete(docId);
  }

  /**
   * Extract contextual snippet surrounding matched term
   */
  private extractSnippet(doc: DocRecord, lineNumber: number, term: string): string {
    if (!doc.lines || doc.lines.length === 0) return doc.title;

    const actualIdx = (lineNumber > 0 && lineNumber <= doc.lines.length) ? (lineNumber - 1) : 0;
    const line = doc.lines[actualIdx] || doc.title;

    if (line.length <= 110) return line;

    const lower = line.toLowerCase();
    const pos = lower.indexOf(term.toLowerCase());

    if (pos === -1) {
      return line.slice(0, 107) + '...';
    }

    const start = Math.max(0, pos - 35);
    const len = Math.min(100, line.length - start);
    let snippet = line.substring(start, start + len);

    if (start > 0) snippet = '...' + snippet;
    if (start + len < line.length) snippet += '...';

    return snippet;
  }

  /**
   * Execute high-speed BM25 search with trigram fuzzy fallback
   */
  public search(query: string, limit: number = 20): SearchResult {
    const t0 = performance.now();

    if (!query || this.documents.length === 0) {
      return { matches: [], totalHits: 0, queryTimeUs: 0 };
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return { matches: [], totalHits: 0, queryTimeUs: 0 };
    }

    const N = this.documents.length;
    const docScores = new Map<number, number>();
    const docBestLine = new Map<number, number>();
    const docMatchedTerms = new Map<number, Set<string>>();

    for (const rawQ of queryTokens) {
      const candidateTerms = new Set<string>();

      // Exact term lookup
      if (this.tokenIndex.has(rawQ)) {
        candidateTerms.add(rawQ);
      }

      // Trigram fuzzy match for words >= 4 letters
      if (rawQ.length >= 4) {
        const qTris = this.generateTrigrams(rawQ);
        for (const tri of qTris) {
          const matched = this.trigramIndex.get(tri);
          if (matched) {
            for (const m of matched) {
              candidateTerms.add(m);
            }
          }
        }
      }

      // Score candidates with BM25
      for (const term of candidateTerms) {
        const postings = this.tokenIndex.get(term);
        if (!postings || postings.length === 0) continue;

        const docFreq = postings.length;
        const idf = Math.max(0.1, Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1.0));
        const termWeight = (term === rawQ) ? 1.0 : 0.65; // penalty for fuzzy matches

        for (const p of postings) {
          const doc = this.documents[p.docIndex];
          if (!doc.id) continue;

          const tf = p.termFrequency;
          const docLen = doc.wordCount;
          const normLen = this.avgDocLength > 0 ? (docLen / this.avgDocLength) : 1.0;

          // BM25 term weighting formula
          const score = idf * ((tf * (this.k1 + 1.0)) / (tf + this.k1 * (1.0 - this.b + this.b * normLen))) * termWeight;

          const prev = docScores.get(p.docIndex) || 0;
          docScores.set(p.docIndex, prev + score);

          let termsSet = docMatchedTerms.get(p.docIndex);
          if (!termsSet) {
            termsSet = new Set<string>();
            docMatchedTerms.set(p.docIndex, termsSet);
          }
          termsSet.add(term);

          if (!docBestLine.has(p.docIndex) && p.linePositions.length > 0) {
            docBestLine.set(p.docIndex, p.linePositions[0]);
          }
        }
      }
    }

    // Sort documents by score descending
    const ranked = Array.from(docScores.entries()).sort((a, b) => b[1] - a[1]);
    const count = Math.min(limit, ranked.length);
    const matches: SearchMatch[] = [];

    for (let i = 0; i < count; i++) {
      const docIdx = ranked[i][0];
      const doc = this.documents[docIdx];
      const terms = Array.from(docMatchedTerms.get(docIdx) || []);
      const bestLine = docBestLine.get(docIdx) || 1;
      const highlightTerm = terms[0] || queryTokens[0];

      matches.push({
        docId: doc.id,
        docTitle: doc.title,
        category: doc.category,
        score: ranked[i][1],
        lineNumber: bestLine,
        matchedTokens: terms,
        matchedSnippet: this.extractSnippet(doc, bestLine, highlightTerm)
      });
    }

    const t1 = performance.now();
    const queryTimeUs = (t1 - t0) * 1000;

    return {
      matches,
      totalHits: ranked.length,
      queryTimeUs
    };
  }
}
