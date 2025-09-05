import { nanoid } from "nanoid";

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunkIndex: number;
    fileName: string;
    fileType: string;
    uploadedAt: string;
  };
  embedding?: number[];
}

export interface BusinessDocument {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadedAt: string;
  processedAt?: string;
  chunks: DocumentChunk[];
  status: "processing" | "completed" | "error";
  error?: string;
}

export class DocumentProcessor {
  private static instance: DocumentProcessor;

  static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  async processFile(file: File): Promise<BusinessDocument> {
    const document: BusinessDocument = {
      id: nanoid(),
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      chunks: [],
      status: "processing",
    };

    try {
      const text = await this.extractText(file);
      const chunks = this.chunkText(text, document);

      document.chunks = chunks;
      document.processedAt = new Date().toISOString();
      document.status = "completed";

      return document;
    } catch (error) {
      document.status = "error";
      document.error = error instanceof Error ? error.message : "Unknown error";
      throw error;
    }
  }

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

  private chunkText(text: string, document: BusinessDocument): DocumentChunk[] {
    const maxChunkSize = 1000; // characters
    const overlap = 200; // characters
    const chunks: DocumentChunk[] = [];

    // Split by paragraphs first, then by sentences
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = "";
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= maxChunkSize) {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, document, chunkIndex));
          chunkIndex++;
        }

        // If paragraph is too long, split it further
        if (paragraph.length > maxChunkSize) {
          const sentences = paragraph.split(/[.!?]+/);
          currentChunk = "";

          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length <= maxChunkSize) {
              currentChunk += (currentChunk ? ". " : "") + sentence.trim();
            } else {
              if (currentChunk) {
                chunks.push(
                  this.createChunk(currentChunk, document, chunkIndex),
                );
                chunkIndex++;
              }
              currentChunk = sentence.trim();
            }
          }
        } else {
          currentChunk = paragraph;
        }
      }
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, document, chunkIndex));
    }

    return chunks;
  }

  private createChunk(
    content: string,
    document: BusinessDocument,
    chunkIndex: number,
  ): DocumentChunk {
    return {
      id: nanoid(),
      content: content.trim(),
      metadata: {
        source: document.id,
        chunkIndex,
        fileName: document.fileName,
        fileType: document.fileType,
        uploadedAt: document.uploadedAt,
      },
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // This is a simplified embedding function
    // In production, you'd want to use a proper embedding model like OpenAI's text-embedding-ada-002
    console.log(
      "🧠 [Embedding Debug] Generating embedding for text length:",
      text.length,
    );
    console.log(
      "🧠 [Embedding Debug] Text preview:",
      text.substring(0, 100) + "...",
    );

    try {
      console.log("🌐 [Embedding Debug] Calling /api/embeddings...");
      const response = await fetch("/api/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: text }),
      });

      console.log("🌐 [Embedding Debug] API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("❌ [Embedding Debug] API error response:", errorText);
        throw new Error(
          `Failed to generate embedding: ${response.status} ${errorText}`,
        );
      }

      const data = await response.json();
      console.log("✅ [Embedding Debug] Embedding generated successfully:", {
        model: data.model,
        embeddingLength: data.embedding ? data.embedding.length : 0,
      });
      return data.embedding;
    } catch (error) {
      console.warn(
        "❌ [Embedding Debug] Failed to generate embedding, using fallback:",
        error,
      );
      // Fallback: create a simple hash-based embedding
      return this.createSimpleEmbedding(text);
    }
  }

  private createSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding for fallback
    const words = text.toLowerCase().split(/\W+/);
    const embedding = new Array(384).fill(0); // 384-dimensional vector

    for (const word of words) {
      if (word.length > 2) {
        const hash = this.simpleHash(word);
        const index = Math.abs(hash) % embedding.length;
        embedding[index] += 1;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    console.log("🔢 [Similarity Debug] Computing similarity between vectors:", {
      aLength: a.length,
      bLength: b.length,
      aPreview: a.slice(0, 5),
      bPreview: b.slice(0, 5),
    });

    if (a.length !== b.length) {
      console.log("❌ [Similarity Debug] Vector length mismatch");
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const sqrtNormA = Math.sqrt(normA);
    const sqrtNormB = Math.sqrt(normB);
    const denominator = sqrtNormA * sqrtNormB;

    console.log("🔢 [Similarity Debug] Calculation details:", {
      dotProduct,
      normA,
      normB,
      sqrtNormA,
      sqrtNormB,
      denominator,
    });

    if (denominator === 0) {
      console.log("❌ [Similarity Debug] Denominator is zero, returning 0");
      return 0;
    }

    const similarity = dotProduct / denominator;
    console.log("✅ [Similarity Debug] Final similarity:", similarity);

    return similarity;
  }

  // ==================== TERM-BASED RETRIEVAL METHODS ====================

  /**
   * Extract terms from text for term-based retrieval
   * 支持中文n-gram和英文单词提取
   */
  extractTerms(text: string): string[] {
    console.log(
      "📝 [Term Debug] Extracting terms from text length:",
      text.length,
    );

    // Normalize text - remove punctuation but keep Chinese, English, numbers
    const normalizedText = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const terms: string[] = [];

    // Extract English words (2+ characters)
    const englishWords = normalizedText.match(/[a-zA-Z]{2,}/g) || [];
    terms.push(...englishWords);

    // Extract numbers
    const numbers = normalizedText.match(/\d+/g) || [];
    terms.push(...numbers);

    // Extract Chinese terms using n-gram approach
    const chineseText = normalizedText.replace(/[a-zA-Z0-9\s]/g, "");

    if (chineseText.length > 0) {
      // Unigrams (single characters) - important for Chinese
      for (let i = 0; i < chineseText.length; i++) {
        const char = chineseText[i];
        if (char && /[\u4e00-\u9fa5]/.test(char)) {
          terms.push(char);
        }
      }

      // Bigrams (two-character combinations) - very important for Chinese
      for (let i = 0; i < chineseText.length - 1; i++) {
        const bigram = chineseText.substring(i, i + 2);
        if (bigram.length === 2 && /^[\u4e00-\u9fa5]{2}$/.test(bigram)) {
          terms.push(bigram);
        }
      }

      // Trigrams (three-character combinations)
      for (let i = 0; i < chineseText.length - 2; i++) {
        const trigram = chineseText.substring(i, i + 3);
        if (trigram.length === 3 && /^[\u4e00-\u9fa5]{3}$/.test(trigram)) {
          terms.push(trigram);
        }
      }
    }

    const uniqueTerms = [...new Set(terms)]; // Remove duplicates
    console.log(
      "📝 [Term Debug] Extracted",
      uniqueTerms.length,
      "unique terms",
    );

    return uniqueTerms;
  }

  /**
   * Calculate term-based similarity score between query and document
   */
  calculateTermSimilarity(queryText: string, docText: string): number {
    console.log("🔍 [Term Similarity] Calculating similarity between:");
    console.log(
      "🔍 [Term Similarity] Query:",
      queryText.substring(0, 50) + "...",
    );
    console.log("🔍 [Term Similarity] Doc:", docText.substring(0, 50) + "...");

    const queryTerms = this.extractTerms(queryText);
    const docTerms = this.extractTerms(docText);

    console.log("🔍 [Term Similarity] Query terms:", queryTerms.slice(0, 10));
    console.log(
      "🔍 [Term Similarity] Doc terms preview:",
      docTerms.slice(0, 10),
    );

    if (queryTerms.length === 0 || docTerms.length === 0) {
      console.log("🔍 [Term Similarity] No terms found, returning 0");
      return 0;
    }

    const querySet = new Set(queryTerms);
    const docSet = new Set(docTerms);

    // Calculate intersection
    const intersection = new Set(
      [...querySet].filter((term) => docSet.has(term)),
    );

    if (intersection.size === 0) {
      console.log("🔍 [Term Similarity] No intersection, returning 0");
      return 0;
    }

    console.log("🔍 [Term Similarity] Intersecting terms:", [...intersection]);

    // Jaccard similarity (intersection / union)
    const union = new Set([...querySet, ...docSet]);
    const jaccardSimilarity = intersection.size / union.size;

    // Term frequency boost - reward documents with multiple occurrences
    let tfBoost = 0;
    for (const term of intersection) {
      const queryCount = queryTerms.filter((t) => t === term).length;
      const docCount = docTerms.filter((t) => t === term).length;
      // Normalize by text length to avoid bias toward longer documents
      const normalizedTfBoost =
        Math.min(queryCount, docCount) /
        Math.max(queryTerms.length, docTerms.length);
      tfBoost += normalizedTfBoost;
    }

    // Combined score: Jaccard (70%) + TF boost (30%)
    const finalScore = jaccardSimilarity * 0.7 + tfBoost * 0.3;

    console.log("🔍 [Term Similarity] Scores:", {
      intersectionSize: intersection.size,
      unionSize: union.size,
      jaccardSimilarity: jaccardSimilarity.toFixed(4),
      tfBoost: tfBoost.toFixed(4),
      finalScore: finalScore.toFixed(4),
    });

    return finalScore;
  }

  /**
   * Generate term frequency map for more advanced scoring
   */
  getTermFrequencies(terms: string[]): Map<string, number> {
    const freqMap = new Map<string, number>();

    for (const term of terms) {
      freqMap.set(term, (freqMap.get(term) || 0) + 1);
    }

    return freqMap;
  }
}
