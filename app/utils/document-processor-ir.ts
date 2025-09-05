import { nanoid } from "nanoid";

// ================ ENHANCED INTERFACES FOR IR SYSTEM ================

export interface IRDocumentChunk {
  id: string;
  content: string;
  tokenCount: number;

  // Enhanced metadata for IR
  metadata: {
    docId: string; // Document ID
    chunkIndex: number; // Chunk sequence number
    startOffset: number; // Character start position
    endOffset: number; // Character end position

    // Document metadata
    fileName: string;
    fileType: string;
    title?: string; // Document title
    url?: string; // Source URL if applicable
    page?: number; // Page number for PDFs

    // Structural metadata for field weighting
    isTitle: boolean; // Is this a title/heading?
    isTableHeader: boolean; // Is this a table header?
    sectionTitle?: string; // Parent section title

    // Temporal metadata
    uploadedAt: string;
    lastModified?: string;

    // Quality metadata
    language?: string; // Detected language
    confidence?: number; // Content quality score
  };

  // Term-based features (no embeddings)
  terms?: string[]; // Extracted terms
  termFreqs?: Map<string, number>; // Term frequencies in this chunk
}

export interface IRBusinessDocument {
  id: string;
  fileName: string;
  fileType: string;
  size: number;

  // Enhanced document metadata
  title?: string;
  url?: string;
  language?: string;

  // Timestamps
  uploadedAt: string;
  processedAt?: string;
  lastModified?: string;

  // Processing status
  status: "processing" | "completed" | "error";
  error?: string;

  // Document structure
  chunks: IRDocumentChunk[];
  totalTokens: number;

  // Document-level statistics
  termStats?: {
    totalTerms: number;
    uniqueTerms: number;
    avgTermsPerChunk: number;
  };
}

// ================ INVERTED INDEX STRUCTURES ================

export interface PostingEntry {
  docId: string;
  chunkId: string;
  termFreq: number; // Term frequency in this chunk
  positions?: number[]; // Term positions for phrase queries
  fieldWeights?: {
    // Field-specific weights
    title?: number;
    content?: number;
    tableHeader?: number;
  };
}

export interface InvertedIndex {
  terms: Map<string, PostingEntry[]>; // term -> postings list
  docFreqs: Map<string, number>; // term -> document frequency
  totalDocs: number;
  totalTerms: number;
  avgDocLength: number;
}

// ================ BM25 SCORING PARAMETERS ================

export interface BM25Params {
  k1: number; // Term frequency saturation (default: 1.2)
  b: number; // Field length normalization (default: 0.75)
  k3: number; // Query term frequency saturation (default: 8)

  // Field weights for BM25F
  fieldWeights?: {
    title: number;
    content: number;
    tableHeader: number;
  };
}

// ================ QUERY PROCESSING STRUCTURES ================

export interface ProcessedQuery {
  originalQuery: string;
  normalizedTerms: string[];
  expandedTerms?: string[]; // From PRF
  phrases?: string[][]; // Phrase queries
  fieldBoosts?: Map<string, number>;
}

export interface SearchResult {
  chunk: IRDocumentChunk;
  document: IRBusinessDocument;
  score: number;
  explanation?: {
    termScores: Map<string, number>;
    fieldBoosts: Map<string, number>;
    finalScore: number;
  };
}

// ================ ENHANCED DOCUMENT PROCESSOR ================

export class IRDocumentProcessor {
  private static instance: IRDocumentProcessor;

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

  // Stop words for Chinese and English
  private stopWords = new Set([
    // English stop words
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
    "will",
    "would",
    "should",
    "could",
    "can",
    "may",
    "might",
    "must",
    "shall",
    // Chinese stop words
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

  // Synonym groups for query expansion
  private synonymGroups = new Map<string, string[]>([
    ["产品", ["商品", "物品", "制品"]],
    ["标准", ["规范", "准则", "要求", "规定"]],
    ["质量", ["品质", "质量标准"]],
    ["制作", ["生产", "加工", "制造"]],
    ["流程", ["过程", "程序", "步骤"]],
  ]);

  static getInstance(): IRDocumentProcessor {
    if (!IRDocumentProcessor.instance) {
      IRDocumentProcessor.instance = new IRDocumentProcessor();
    }
    return IRDocumentProcessor.instance;
  }

  /**
   * Process file with enhanced chunking strategy (400-800 tokens, 10-20% overlap)
   */
  async processFile(file: File): Promise<IRBusinessDocument> {
    const document: IRBusinessDocument = {
      id: nanoid(),
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      title: this.extractTitleFromFileName(file.name),
      uploadedAt: new Date().toISOString(),
      chunks: [],
      totalTokens: 0,
      status: "processing",
    };

    try {
      const text = await this.extractText(file);
      const chunks = this.chunkTextIR(text, document);

      // Calculate document-level statistics
      const totalTerms = chunks.reduce(
        (sum, chunk) => sum + (chunk.terms?.length || 0),
        0,
      );
      const uniqueTerms = new Set(chunks.flatMap((chunk) => chunk.terms || []))
        .size;

      document.chunks = chunks;
      document.totalTokens = chunks.reduce(
        (sum, chunk) => sum + chunk.tokenCount,
        0,
      );
      document.termStats = {
        totalTerms,
        uniqueTerms,
        avgTermsPerChunk: chunks.length > 0 ? totalTerms / chunks.length : 0,
      };
      document.processedAt = new Date().toISOString();
      document.status = "completed";

      return document;
    } catch (error) {
      document.status = "error";
      document.error = error instanceof Error ? error.message : "Unknown error";
      throw error;
    }
  }

  /**
   * Extract text from various file formats
   */
  private async extractText(file: File): Promise<string> {
    const fileType = file.type;

    // Handle PDF files
    if (
      fileType === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      return await this.extractPdfText(file);
    }

    if (fileType === "text/plain") {
      return await file.text();
    }

    if (fileType === "application/json") {
      const json = JSON.parse(await file.text());
      return this.jsonToText(json);
    }

    if (fileType.includes("text/")) {
      return await file.text();
    }

    // Handle common text-based formats
    if (fileType === "text/markdown" || file.name.endsWith(".md")) {
      return await file.text();
    }

    if (fileType === "text/csv" || file.name.endsWith(".csv")) {
      return await file.text();
    }

    if (
      fileType === "text/xml" ||
      fileType === "application/xml" ||
      file.name.endsWith(".xml")
    ) {
      return await file.text();
    }

    throw new Error(
      `Unsupported file type: ${fileType}. Supported formats: PDF, TXT, MD, JSON, CSV, XML`,
    );
  }

  /**
   * Extract text from PDF files
   */
  private async extractPdfText(file: File): Promise<string> {
    try {
      // Import pdfjs-dist dynamically to avoid SSR issues
      const pdfjsLib = await import("pdfjs-dist");

      // Set up the worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let fullText = "";

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");

        fullText += pageText + "\n";
      }

      if (!fullText || fullText.trim().length === 0) {
        throw new Error(
          "PDF appears to be empty or contains no extractable text",
        );
      }

      return fullText.trim();
    } catch (error) {
      console.error("PDF extraction failed:", error);
      throw new Error(
        `PDF extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Convert JSON object to text
   */
  private jsonToText(obj: any, prefix = ""): string {
    let text = "";

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          text += `${fullKey}: ${value.join(", ")}\n`;
        } else {
          text += this.jsonToText(value, fullKey);
        }
      } else {
        text += `${fullKey}: ${value}\n`;
      }
    }

    return text;
  }

  /**
   * Enhanced text chunking with 400-800 tokens and 10-20% overlap
   */
  private chunkTextIR(
    text: string,
    document: IRBusinessDocument,
  ): IRDocumentChunk[] {
    const minTokens = 400;
    const maxTokens = 800;
    const overlapRatio = 0.15; // 15% overlap

    const chunks: IRDocumentChunk[] = [];

    // First, detect structure (titles, sections, tables)
    const structuredText = this.analyzeDocumentStructure(text);

    // Split into paragraphs
    const paragraphs = text.split(/\n\s*\n/);

    let currentChunk = "";
    let currentTokens = 0;
    let chunkIndex = 0;
    let startOffset = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      const paragraphTokens = this.estimateTokenCount(paragraph);

      // Check if adding this paragraph would exceed max tokens
      if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
        // Create chunk
        const chunk = this.createIRChunk(
          currentChunk,
          document,
          chunkIndex,
          startOffset,
          startOffset + currentChunk.length,
          currentTokens,
        );
        chunks.push(chunk);

        // Prepare next chunk with overlap
        const overlapTokens = Math.floor(currentTokens * overlapRatio);
        const overlapText = this.getLastTokens(currentChunk, overlapTokens);

        currentChunk = overlapText + "\n\n" + paragraph;
        currentTokens = this.estimateTokenCount(currentChunk);
        startOffset = startOffset + currentChunk.length - overlapText.length;
        chunkIndex++;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        currentTokens = this.estimateTokenCount(currentChunk);
      }

      // If current chunk reaches minimum size and we have more content, consider breaking
      if (currentTokens >= minTokens && i < paragraphs.length - 1) {
        const nextParagraph = paragraphs[i + 1];
        const nextTokens = this.estimateTokenCount(nextParagraph);

        // If next paragraph is very long, break here
        if (nextTokens > maxTokens * 0.5) {
          const chunk = this.createIRChunk(
            currentChunk,
            document,
            chunkIndex,
            startOffset,
            startOffset + currentChunk.length,
            currentTokens,
          );
          chunks.push(chunk);

          currentChunk = "";
          currentTokens = 0;
          startOffset = startOffset + currentChunk.length;
          chunkIndex++;
        }
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      const chunk = this.createIRChunk(
        currentChunk,
        document,
        chunkIndex,
        startOffset,
        startOffset + currentChunk.length,
        currentTokens,
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Create IR-enhanced chunk with term extraction and metadata
   */
  private createIRChunk(
    content: string,
    document: IRBusinessDocument,
    chunkIndex: number,
    startOffset: number,
    endOffset: number,
    tokenCount: number,
  ): IRDocumentChunk {
    const terms = this.extractAndNormalizeTerms(content);
    const termFreqs = this.calculateTermFrequencies(terms);

    // Detect structural elements
    const isTitle = this.isTitle(content);
    const isTableHeader = this.isTableHeader(content);
    const sectionTitle = this.extractSectionTitle(content);

    return {
      id: nanoid(),
      content: content.trim(),
      tokenCount,
      metadata: {
        docId: document.id,
        chunkIndex,
        startOffset,
        endOffset,
        fileName: document.fileName,
        fileType: document.fileType,
        title: document.title,
        isTitle,
        isTableHeader,
        sectionTitle,
        uploadedAt: document.uploadedAt,
        language: "zh-cn", // TODO: Add language detection
        confidence: this.calculateContentQuality(content),
      },
      terms,
      termFreqs,
    };
  }

  /**
   * Extract and normalize terms with advanced processing
   */
  extractAndNormalizeTerms(text: string): string[] {
    const terms: string[] = [];

    // Normalize text
    const normalizedText = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract English words (2+ characters, not stop words)
    const englishWords = normalizedText.match(/[a-zA-Z]{2,}/g) || [];
    for (const word of englishWords) {
      if (!this.stopWords.has(word)) {
        terms.push(word);
      }
    }

    // Extract numbers
    const numbers = normalizedText.match(/\d+/g) || [];
    terms.push(...numbers);

    // Extract Chinese terms using enhanced n-gram
    const chineseText = normalizedText.replace(/[a-zA-Z0-9\s]/g, "");

    if (chineseText.length > 0) {
      // Unigrams (filtered stop words)
      for (let i = 0; i < chineseText.length; i++) {
        const char = chineseText[i];
        if (char && /[\u4e00-\u9fa5]/.test(char) && !this.stopWords.has(char)) {
          terms.push(char);
        }
      }

      // Bigrams (most important for Chinese)
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

      // Trigrams (for compound words)
      for (let i = 0; i < chineseText.length - 2; i++) {
        const trigram = chineseText.substring(i, i + 3);
        if (trigram.length === 3 && /^[\u4e00-\u9fa5]{3}$/.test(trigram)) {
          terms.push(trigram);
        }
      }
    }

    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Calculate term frequencies for BM25
   */
  private calculateTermFrequencies(terms: string[]): Map<string, number> {
    const freqs = new Map<string, number>();
    for (const term of terms) {
      freqs.set(term, (freqs.get(term) || 0) + 1);
    }
    return freqs;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Chinese: ~1.5 chars per token, English: ~4 chars per token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = text.length - chineseChars;

    return Math.ceil(chineseChars / 1.5 + englishChars / 4);
  }

  /**
   * Get last N tokens worth of text for overlap
   */
  private getLastTokens(text: string, targetTokens: number): string {
    const sentences = text.split(/[。！？.!?]/);
    let result = "";
    let tokens = 0;

    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      const sentenceTokens = this.estimateTokenCount(sentence);
      if (tokens + sentenceTokens <= targetTokens) {
        result = sentence + "。" + result;
        tokens += sentenceTokens;
      } else {
        break;
      }
    }

    return result.trim();
  }

  /**
   * Extract title from filename
   */
  private extractTitleFromFileName(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  }

  /**
   * Analyze document structure for field weighting
   */
  private analyzeDocumentStructure(text: string): any {
    // TODO: Implement structure analysis
    return {};
  }

  /**
   * Detect if content is a title/heading
   */
  private isTitle(content: string): boolean {
    const lines = content.split("\n");
    const firstLine = lines[0].trim();

    // Simple heuristics for title detection
    return (
      firstLine.length < 100 && // Short
      firstLine.length > 2 && // Not too short
      lines.length <= 3 && // Few lines
      !/[。！？.!?]$/.test(firstLine) // No sentence ending
    );
  }

  /**
   * Detect if content is a table header
   */
  private isTableHeader(content: string): boolean {
    // Simple detection for table headers
    return /^[^\n]*[|｜]\s*[^\n]*$/.test(content.trim());
  }

  /**
   * Extract section title from content
   */
  private extractSectionTitle(content: string): string | undefined {
    const lines = content.split("\n");
    const firstLine = lines[0].trim();

    if (this.isTitle(content)) {
      return firstLine;
    }

    return undefined;
  }

  /**
   * Calculate content quality score
   */
  private calculateContentQuality(content: string): number {
    // Simple quality scoring based on length and structure
    const length = content.length;
    const sentences = content.split(/[。！？.!?]/).length;
    const avgSentenceLength = length / sentences;

    // Normalize to 0-1 range
    let score = 0.5;

    // Prefer medium-length content
    if (length > 100 && length < 2000) score += 0.2;
    if (avgSentenceLength > 10 && avgSentenceLength < 100) score += 0.2;

    // Penalize very short or very long content
    if (length < 50 || length > 3000) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }
}
