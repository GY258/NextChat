import {
  IRBusinessDocument,
  IRDocumentChunk,
  InvertedIndex,
  BM25Params,
  ProcessedQuery,
  SearchResult,
} from "./document-processor-ir";

/**
 * Information Retrieval Search Engine with BM25 and hierarchical search
 */
export class IRSearchEngine {
  private static instance: IRSearchEngine;

  // Two-level indexes
  private documentIndex: InvertedIndex; // Document-level index
  private chunkIndex: InvertedIndex; // Chunk-level index

  // Document collections
  private documents: Map<string, IRBusinessDocument> = new Map();
  private chunks: Map<string, IRDocumentChunk> = new Map();

  // BM25 parameters
  private bm25Params: BM25Params = {
    k1: 1.2,
    b: 0.75,
    k3: 8,
    fieldWeights: {
      title: 2.0,
      content: 1.0,
      tableHeader: 1.5,
    },
  };

  // Stop words and synonyms (same as processor)
  private stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "的",
    "了",
    "在",
    "是",
    "我",
    "有",
    "和",
    "就",
    "不",
    "人",
    "都",
    "一",
    "一个",
    "上",
    "也",
    "很",
    "到",
    "说",
    "要",
    "去",
    "你",
    "会",
    "着",
    "没有",
    "看",
    "好",
    "自己",
    "这",
  ]);

  private synonymGroups = new Map<string, string[]>([
    ["产品", ["商品", "物品", "制品"]],
    ["标准", ["规范", "准则", "要求", "规定"]],
    ["质量", ["品质", "质量标准"]],
    ["制作", ["生产", "加工", "制造"]],
    ["流程", ["过程", "程序", "步骤"]],
  ]);

  constructor() {
    this.documentIndex = this.createEmptyIndex();
    this.chunkIndex = this.createEmptyIndex();
  }

  static getInstance(): IRSearchEngine {
    if (!IRSearchEngine.instance) {
      IRSearchEngine.instance = new IRSearchEngine();
    }
    return IRSearchEngine.instance;
  }

  // ================ INDEX MANAGEMENT ================

  /**
   * Add document to both document-level and chunk-level indexes
   */
  addDocument(document: IRBusinessDocument): void {
    console.log("📚 [IR Index] Adding document:", document.fileName);

    this.documents.set(document.id, document);

    // Add to document-level index (aggregate all chunk terms)
    const docTerms = new Map<string, number>();
    let totalTerms = 0;

    for (const chunk of document.chunks) {
      this.chunks.set(chunk.id, chunk);

      // Aggregate terms for document-level index
      if (chunk.termFreqs) {
        for (const [term, freq] of chunk.termFreqs) {
          docTerms.set(term, (docTerms.get(term) || 0) + freq);
          totalTerms += freq;
        }
      }

      // Add to chunk-level index
      this.addChunkToIndex(chunk);
    }

    // Add to document-level index
    this.addDocumentToIndex(document, docTerms);

    // Update statistics
    this.updateIndexStatistics();

    console.log("✅ [IR Index] Document added. Stats:", {
      totalDocs: this.documents.size,
      totalChunks: this.chunks.size,
      docIndexTerms: this.documentIndex.terms.size,
      chunkIndexTerms: this.chunkIndex.terms.size,
    });
  }

  /**
   * Remove document from indexes
   */
  removeDocument(documentId: string): void {
    const document = this.documents.get(documentId);
    if (!document) return;

    console.log("🗑️ [IR Index] Removing document:", document.fileName);

    // Remove from collections
    this.documents.delete(documentId);
    for (const chunk of document.chunks) {
      this.chunks.delete(chunk.id);
    }

    // Rebuild indexes (simple approach - could be optimized)
    this.rebuildIndexes();
  }

  /**
   * Clear all indexes
   */
  clearIndexes(): void {
    console.log("🧹 [IR Index] Clearing all indexes");

    this.documents.clear();
    this.chunks.clear();
    this.documentIndex = this.createEmptyIndex();
    this.chunkIndex = this.createEmptyIndex();
  }

  // ================ SEARCH IMPLEMENTATION ================

  /**
   * Hierarchical search: first documents, then chunks
   */
  async search(
    query: string,
    options: {
      topK?: number; // Top documents to retrieve
      topN?: number; // Top chunks from selected documents
      usePRF?: boolean; // Use pseudo-relevance feedback
      explain?: boolean; // Return scoring explanation
    } = {},
  ): Promise<SearchResult[]> {
    const { topK = 10, topN = 5, usePRF = false, explain = false } = options;

    console.log("🔍 [IR Search] Starting hierarchical search:", query);
    console.log("🔍 [IR Search] Options:", { topK, topN, usePRF, explain });

    // Step 1: Process query
    const processedQuery = this.processQuery(query);
    console.log("📝 [IR Search] Processed query:", processedQuery);

    // Step 2: Document-level search (coarse retrieval)
    const topDocuments = this.searchDocuments(processedQuery, topK);
    console.log("📚 [IR Search] Top documents found:", topDocuments.length);

    if (topDocuments.length === 0) {
      console.log("❌ [IR Search] No documents found");
      return [];
    }

    // Step 3: Chunk-level search within top documents (fine-grained retrieval)
    const relevantChunks = this.searchChunksInDocuments(
      processedQuery,
      topDocuments.map((d) => d.docId),
      topN,
    );
    console.log("📄 [IR Search] Relevant chunks found:", relevantChunks.length);

    // Step 4: Pseudo-relevance feedback (optional)
    let finalResults = relevantChunks;
    if (usePRF && relevantChunks.length > 0) {
      console.log(
        "🔄 [IR Search] PRF requested but temporarily disabled for debugging",
      );
      console.log("🔄 [IR Search] Using original results without PRF");
      // Temporarily disable PRF to debug the core search issue
      // finalResults = await this.applyPRF(processedQuery, relevantChunks, topN);
    }

    // Step 5: Convert to SearchResult format
    const searchResults: SearchResult[] = [];

    console.log("🔄 [IR Search] Converting results to SearchResult format...");
    console.log("🔄 [IR Search] Internal chunks map size:", this.chunks.size);
    console.log(
      "🔄 [IR Search] Internal documents map size:",
      this.documents.size,
    );
    console.log(
      "🔄 [IR Search] Final results to convert:",
      finalResults.length,
    );

    for (const chunkResult of finalResults) {
      console.log(
        `🔍 [IR Search] Looking for chunk ${chunkResult.chunkId} and document ${chunkResult.docId}`,
      );

      const chunk = this.chunks.get(chunkResult.chunkId);
      const document = this.documents.get(chunkResult.docId);

      console.log(
        `🔍 [IR Search] Found chunk: ${chunk ? "YES" : "NO"}, Found document: ${
          document ? "YES" : "NO"
        }`,
      );

      if (chunk && document) {
        searchResults.push({
          chunk,
          document,
          score: chunkResult.score,
          explanation: explain ? chunkResult.explanation : undefined,
        });
        console.log(
          `✅ [IR Search] Added result with score: ${chunkResult.score}`,
        );
      } else {
        console.warn(
          `❌ [IR Search] Skipping result - missing chunk or document:`,
          {
            chunkId: chunkResult.chunkId,
            docId: chunkResult.docId,
            hasChunk: !!chunk,
            hasDocument: !!document,
          },
        );
      }
    }

    console.log("✅ [IR Search] Final results:", searchResults.length);
    return searchResults;
  }

  // ================ QUERY PROCESSING ================

  /**
   * Process and normalize query
   */
  private processQuery(query: string): ProcessedQuery {
    const originalQuery = query;

    // Normalize query
    const normalizedTerms = this.extractAndNormalizeTerms(query);

    // Expand with synonyms
    const expandedTerms = this.expandWithSynonyms(normalizedTerms);

    // Detect phrases (simple approach - quoted strings)
    const phrases = this.extractPhrases(query);

    return {
      originalQuery,
      normalizedTerms,
      expandedTerms,
      phrases,
    };
  }

  /**
   * Extract and normalize terms (same logic as processor)
   */
  private extractAndNormalizeTerms(text: string): string[] {
    const terms: string[] = [];

    const normalizedText = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // English words
    const englishWords = normalizedText.match(/[a-zA-Z]{2,}/g) || [];
    for (const word of englishWords) {
      if (!this.stopWords.has(word)) {
        terms.push(word);
      }
    }

    // Numbers
    const numbers = normalizedText.match(/\d+/g) || [];
    terms.push(...numbers);

    // Chinese terms
    const chineseText = normalizedText.replace(/[a-zA-Z0-9\s]/g, "");
    if (chineseText.length > 0) {
      // Unigrams
      for (let i = 0; i < chineseText.length; i++) {
        const char = chineseText[i];
        if (char && /[\u4e00-\u9fa5]/.test(char) && !this.stopWords.has(char)) {
          terms.push(char);
        }
      }

      // Bigrams
      for (let i = 0; i < chineseText.length - 1; i++) {
        const bigram = chineseText.substring(i, i + 2);
        if (
          bigram.length === 2 &&
          /^[\u4e00-\u9fa5]{2}$/.test(bigram) &&
          !this.stopWords.has(bigram)
        ) {
          terms.push(bigram);
        }
      }

      // Trigrams
      for (let i = 0; i < chineseText.length - 2; i++) {
        const trigram = chineseText.substring(i, i + 3);
        if (trigram.length === 3 && /^[\u4e00-\u9fa5]{3}$/.test(trigram)) {
          terms.push(trigram);
        }
      }
    }

    return [...new Set(terms)];
  }

  /**
   * Expand query with synonyms
   */
  private expandWithSynonyms(terms: string[]): string[] {
    const expanded = [...terms];

    for (const term of terms) {
      const synonyms = this.synonymGroups.get(term);
      if (synonyms) {
        expanded.push(...synonyms);
      }
    }

    return [...new Set(expanded)];
  }

  /**
   * Extract phrases from query (simple implementation)
   */
  private extractPhrases(query: string): string[][] {
    const phrases: string[][] = [];

    // Extract quoted phrases
    const quotedPhrases = query.match(/"([^"]*)"/g);
    if (quotedPhrases) {
      for (const quoted of quotedPhrases) {
        const phrase = quoted.replace(/"/g, "");
        const phraseTerms = this.extractAndNormalizeTerms(phrase);
        if (phraseTerms.length > 1) {
          phrases.push(phraseTerms);
        }
      }
    }

    return phrases;
  }

  // ================ BM25 SCORING ================

  /**
   * Calculate BM25 score for a term in a document/chunk
   */
  private calculateBM25Score(
    term: string,
    termFreq: number,
    docLength: number,
    avgDocLength: number,
    docFreq: number,
    totalDocs: number,
    fieldWeight: number = 1.0,
  ): number {
    const { k1, b } = this.bm25Params;

    // IDF component
    const idf = Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5));

    // TF component with normalization
    const tfComponent =
      (termFreq * (k1 + 1)) /
      (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));

    return idf * tfComponent * fieldWeight;
  }

  // ================ SEARCH METHODS ================

  private searchDocuments(
    query: ProcessedQuery,
    topK: number,
  ): Array<{ docId: string; score: number }> {
    const results: Array<{ docId: string; score: number }> = [];

    console.log(
      "📚 [IR Search] Searching documents with",
      query.normalizedTerms.length,
      "terms",
    );
    console.log("📚 [IR Search] Query terms:", query.normalizedTerms);
    console.log("📚 [IR Search] Document index stats:", {
      totalTerms: this.documentIndex.terms.size,
      totalDocs: this.documentIndex.totalDocs,
      avgDocLength: this.documentIndex.avgDocLength,
    });

    // Score each document
    for (const document of this.documents.values()) {
      let totalScore = 0;
      const termMatches: string[] = [];

      for (const term of query.normalizedTerms) {
        const postings = this.documentIndex.terms.get(term) || [];
        const docPosting = postings.find((p) => p.docId === document.id);

        if (docPosting) {
          termMatches.push(term);
          const docFreq = this.documentIndex.docFreqs.get(term) || 1;
          const score = this.calculateBM25Score(
            term,
            docPosting.termFreq,
            document.totalTokens,
            this.documentIndex.avgDocLength,
            docFreq,
            this.documentIndex.totalDocs,
            1.0,
          );
          totalScore += score;
        }
      }

      if (totalScore > 0) {
        console.log(
          `📄 [IR Search] Document "${
            document.fileName
          }" scored ${totalScore.toFixed(4)} (matched terms: ${termMatches.join(
            ", ",
          )})`,
        );
        results.push({ docId: document.id, score: totalScore });
      } else {
        console.log(
          `📄 [IR Search] Document "${document.fileName}" scored 0 (no term matches)`,
        );
      }
    }

    console.log(
      "📚 [IR Search] Document scores calculated for",
      results.length,
      "documents",
    );

    // Sort and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private searchChunksInDocuments(
    query: ProcessedQuery,
    docIds: string[],
    topN: number,
  ): Array<{
    docId: string;
    chunkId: string;
    score: number;
    explanation?: any;
  }> {
    const results: Array<{
      docId: string;
      chunkId: string;
      score: number;
      explanation?: any;
    }> = [];

    console.log(
      "📄 [IR Search] Searching chunks in",
      docIds.length,
      "documents",
    );

    // Get all chunks from selected documents
    const targetChunks = Array.from(this.chunks.values()).filter((chunk) =>
      docIds.includes(chunk.metadata.docId),
    );

    console.log(
      "📄 [IR Search] Found",
      targetChunks.length,
      "chunks to search",
    );

    // Score each chunk
    for (const chunk of targetChunks) {
      let totalScore = 0;
      const termScores = new Map<string, number>();

      for (const term of query.normalizedTerms) {
        const termFreq = chunk.termFreqs?.get(term) || 0;

        if (termFreq > 0) {
          const docFreq = this.chunkIndex.docFreqs.get(term) || 1;
          const fieldWeight = this.getFieldWeight(chunk, term);

          const score = this.calculateBM25Score(
            term,
            termFreq,
            chunk.tokenCount,
            this.chunkIndex.avgDocLength,
            docFreq,
            this.chunkIndex.totalDocs,
            fieldWeight,
          );

          totalScore += score;
          termScores.set(term, score);
        }
      }

      if (totalScore > 0) {
        results.push({
          docId: chunk.metadata.docId,
          chunkId: chunk.id,
          score: totalScore,
          explanation: {
            termScores,
            fieldBoosts: this.calculateFieldWeights(chunk),
            finalScore: totalScore,
          },
        });
      }
    }

    console.log(
      "📄 [IR Search] Chunk scores calculated for",
      results.length,
      "chunks",
    );

    // Sort and return top N
    return results.sort((a, b) => b.score - a.score).slice(0, topN);
  }

  private async applyPRF(
    originalQuery: ProcessedQuery,
    initialResults: Array<{ docId: string; chunkId: string; score: number }>,
    topN: number,
  ): Promise<
    Array<{ docId: string; chunkId: string; score: number; explanation?: any }>
  > {
    // Simple PRF implementation - expand query with top terms from top results
    console.log(
      "🔄 [IR Search] Applying PRF to top",
      Math.min(3, initialResults.length),
      "results",
    );

    // Get top 3 results for expansion
    const topResults = initialResults.slice(0, 3);
    const expansionTerms = new Map<string, number>();

    // Collect terms from top results
    for (const result of topResults) {
      const chunk = this.chunks.get(result.chunkId);
      if (chunk && chunk.termFreqs) {
        for (const [term, freq] of chunk.termFreqs) {
          if (!originalQuery.normalizedTerms.includes(term)) {
            expansionTerms.set(
              term,
              (expansionTerms.get(term) || 0) + freq * result.score,
            );
          }
        }
      }
    }

    // Get top expansion terms
    const sortedExpansionTerms = Array.from(expansionTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term);

    if (sortedExpansionTerms.length > 0) {
      console.log(
        "🔄 [IR Search] Expanding query with terms:",
        sortedExpansionTerms,
      );

      // Create expanded query
      const expandedQuery: ProcessedQuery = {
        ...originalQuery,
        normalizedTerms: [
          ...originalQuery.normalizedTerms,
          ...sortedExpansionTerms,
        ],
      };

      // Re-search with expanded query
      const expandedResults = this.searchChunksInDocuments(
        expandedQuery,
        Array.from(new Set(initialResults.map((r) => r.docId))),
        topN,
      );

      return expandedResults;
    }

    return initialResults;
  }

  // ================ HELPER METHODS ================

  private createEmptyIndex(): InvertedIndex {
    return {
      terms: new Map(),
      docFreqs: new Map(),
      totalDocs: 0,
      totalTerms: 0,
      avgDocLength: 0,
    };
  }

  private addChunkToIndex(chunk: IRDocumentChunk): void {
    if (!chunk.termFreqs) return;

    for (const [term, freq] of chunk.termFreqs) {
      // Add to postings list
      const postings = this.chunkIndex.terms.get(term) || [];
      postings.push({
        docId: chunk.metadata.docId,
        chunkId: chunk.id,
        termFreq: freq,
        fieldWeights: this.calculateFieldWeights(chunk),
      });
      this.chunkIndex.terms.set(term, postings);

      // Update document frequency
      const docFreq = this.chunkIndex.docFreqs.get(term) || 0;
      this.chunkIndex.docFreqs.set(term, docFreq + 1);
    }
  }

  private addDocumentToIndex(
    document: IRBusinessDocument,
    docTerms: Map<string, number>,
  ): void {
    for (const [term, freq] of docTerms) {
      // Add to postings list
      const postings = this.documentIndex.terms.get(term) || [];
      postings.push({
        docId: document.id,
        chunkId: "", // No specific chunk for doc-level
        termFreq: freq,
        fieldWeights: { content: 1.0 },
      });
      this.documentIndex.terms.set(term, postings);

      // Update document frequency
      const docFreq = this.documentIndex.docFreqs.get(term) || 0;
      this.documentIndex.docFreqs.set(term, docFreq + 1);
    }
  }

  private updateIndexStatistics(): void {
    // Update document statistics for BM25
    this.documentIndex.totalDocs = this.documents.size;
    this.chunkIndex.totalDocs = this.chunks.size;

    // Calculate average document lengths
    const docLengths = Array.from(this.documents.values()).map(
      (d) => d.totalTokens,
    );
    this.documentIndex.avgDocLength =
      docLengths.reduce((a, b) => a + b, 0) / docLengths.length || 0;

    const chunkLengths = Array.from(this.chunks.values()).map(
      (c) => c.tokenCount,
    );
    this.chunkIndex.avgDocLength =
      chunkLengths.reduce((a, b) => a + b, 0) / chunkLengths.length || 0;
  }

  private calculateFieldWeights(chunk: IRDocumentChunk): {
    [field: string]: number;
  } {
    const weights: { [field: string]: number } = {
      content: this.bm25Params.fieldWeights?.content || 1.0,
    };

    if (chunk.metadata.isTitle) {
      weights.title = this.bm25Params.fieldWeights?.title || 2.0;
    }

    if (chunk.metadata.isTableHeader) {
      weights.tableHeader = this.bm25Params.fieldWeights?.tableHeader || 1.5;
    }

    return weights;
  }

  private getFieldWeight(chunk: IRDocumentChunk, term: string): number {
    let weight = this.bm25Params.fieldWeights?.content || 1.0;

    if (chunk.metadata.isTitle) {
      weight = Math.max(weight, this.bm25Params.fieldWeights?.title || 2.0);
    }

    if (chunk.metadata.isTableHeader) {
      weight = Math.max(
        weight,
        this.bm25Params.fieldWeights?.tableHeader || 1.5,
      );
    }

    return weight;
  }

  private rebuildIndexes(): void {
    // Clear and rebuild indexes from scratch
    this.documentIndex = this.createEmptyIndex();
    this.chunkIndex = this.createEmptyIndex();

    for (const document of this.documents.values()) {
      this.addDocument(document);
    }
  }
}

// Note: SearchResult is already imported and used in this file
// If other files need SearchResult, they should import it directly from document-processor-ir
