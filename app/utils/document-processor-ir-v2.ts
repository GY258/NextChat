/**
 * IR文档处理器 V2 - 配合持久化索引服务
 * 解决原系统索引存储在内存中的问题
 */

import { nanoid } from "nanoid";
import {
  getIRIndexService,
  DatabaseDocument,
  DatabaseChunk,
  DatabaseTerm,
  DatabasePosting,
} from "../services/ir-index-service";

// ================ 增强的文档接口 ================

export interface IRDocumentV2 {
  id: string;
  fileName: string;
  fileType: string;
  size: number;

  // 元数据
  title?: string;
  url?: string;
  language?: string;

  // 时间戳
  uploadedAt: string;
  processedAt?: string;
  lastModified?: string;

  // 处理状态
  status: "processing" | "completed" | "error";
  error?: string;

  // 统计信息
  totalTokens: number;
  chunkCount: number;
  termStats: {
    totalTerms: number;
    uniqueTerms: number;
    avgTermsPerChunk: number;
  };
}

export interface IRChunkV2 {
  id: string;
  docId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;

  // 位置信息
  startOffset: number;
  endOffset: number;

  // 结构信息
  isTitle: boolean;
  isTableHeader: boolean;
  sectionTitle?: string;
  page?: number;

  // 语言和质量
  language?: string;
  confidence?: number;

  // 词汇信息
  terms: string[];
  termFreqs: Map<string, number>;

  createdAt: string;
}

// ================ 处理结果接口 ================

export interface ProcessingResult {
  document: IRDocumentV2;
  chunks: IRChunkV2[];
  terms: DatabaseTerm[];
  postings: DatabasePosting[];
  indexStats: {
    totalDocuments: number;
    totalChunks: number;
    totalTerms: number;
    uniqueTerms: number;
    avgDocumentLength: number;
    avgChunkLength: number;
  };
}

// ================ 增强的文档处理器 ================

export class IRDocumentProcessorV2 {
  private static instance: IRDocumentProcessorV2;

  // 处理参数
  private readonly chunkParams = {
    minTokens: 400,
    maxTokens: 800,
    overlapRatio: 0.15,
  };

  // 字段权重参数
  private readonly fieldWeights = {
    title: 2.0,
    content: 1.0,
    tableHeader: 1.5,
  };

  // 停用词集合
  private readonly stopWords = new Set([
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

  // 同义词组
  private readonly synonymGroups = new Map<string, string[]>([
    ["产品", ["商品", "物品", "制品"]],
    ["标准", ["规范", "准则", "要求", "规定"]],
    ["质量", ["品质", "质量标准"]],
    ["制作", ["生产", "加工", "制造"]],
    ["流程", ["过程", "程序", "步骤"]],
  ]);

  static getInstance(): IRDocumentProcessorV2 {
    if (!IRDocumentProcessorV2.instance) {
      IRDocumentProcessorV2.instance = new IRDocumentProcessorV2();
    }
    return IRDocumentProcessorV2.instance;
  }

  /**
   * 处理文件并存储到持久化索引
   */
  async processFileAndIndex(file: File): Promise<ProcessingResult> {
    console.log("📝 [IR Processor V2] Starting file processing:", file.name);

    // 第一步：处理文档
    const document = await this.processDocument(file);

    // 第二步：处理文本块
    const text = await this.extractText(file);
    const chunks = await this.processChunks(text, document);

    // 第三步：构建索引数据
    const { terms, postings } = await this.buildIndexData(chunks);

    // 第四步：计算统计信息
    const indexStats = this.calculateIndexStats(document, chunks, terms);

    // 第五步：存储到持久化索引服务
    await this.storeToIndexService(
      document,
      chunks,
      terms,
      postings,
      indexStats,
    );

    console.log("✅ [IR Processor V2] File processing completed:", {
      fileName: document.fileName,
      chunksCount: chunks.length,
      termsCount: terms.length,
      postingsCount: postings.length,
    });

    return {
      document,
      chunks,
      terms,
      postings,
      indexStats,
    };
  }

  /**
   * 处理文档基本信息
   */
  private async processDocument(file: File): Promise<IRDocumentV2> {
    const document: IRDocumentV2 = {
      id: nanoid(),
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      title: this.extractTitleFromFileName(file.name),
      language: "zh-cn", // TODO: 添加语言检测
      uploadedAt: new Date().toISOString(),
      status: "processing",
      totalTokens: 0,
      chunkCount: 0,
      termStats: {
        totalTerms: 0,
        uniqueTerms: 0,
        avgTermsPerChunk: 0,
      },
    };

    return document;
  }

  /**
   * 处理文本块
   */
  private async processChunks(
    text: string,
    document: IRDocumentV2,
  ): Promise<IRChunkV2[]> {
    console.log(
      "📄 [IR Processor V2] Processing chunks for:",
      document.fileName,
    );

    const chunks: IRChunkV2[] = [];
    const paragraphs = text.split(/\n\s*\n/);

    let currentChunk = "";
    let currentTokens = 0;
    let chunkIndex = 0;
    let startOffset = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      const paragraphTokens = this.estimateTokenCount(paragraph);

      // 检查是否需要创建新块
      if (
        currentTokens + paragraphTokens > this.chunkParams.maxTokens &&
        currentChunk
      ) {
        const chunk = await this.createChunk(
          currentChunk,
          document,
          chunkIndex,
          startOffset,
          startOffset + currentChunk.length,
          currentTokens,
        );
        chunks.push(chunk);

        // 准备下一个块，包含重叠
        const overlapTokens = Math.floor(
          currentTokens * this.chunkParams.overlapRatio,
        );
        const overlapText = this.getLastTokens(currentChunk, overlapTokens);

        currentChunk = overlapText + "\n\n" + paragraph;
        currentTokens = this.estimateTokenCount(currentChunk);
        startOffset = startOffset + currentChunk.length - overlapText.length;
        chunkIndex++;
      } else {
        // 添加段落到当前块
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        currentTokens = this.estimateTokenCount(currentChunk);
      }
    }

    // 添加最后一个块
    if (currentChunk.trim()) {
      const chunk = await this.createChunk(
        currentChunk,
        document,
        chunkIndex,
        startOffset,
        startOffset + currentChunk.length,
        currentTokens,
      );
      chunks.push(chunk);
    }

    console.log(`📄 [IR Processor V2] Created ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * 创建单个文本块
   */
  private async createChunk(
    content: string,
    document: IRDocumentV2,
    chunkIndex: number,
    startOffset: number,
    endOffset: number,
    tokenCount: number,
  ): Promise<IRChunkV2> {
    const terms = this.extractAndNormalizeTerms(content);
    const termFreqs = this.calculateTermFrequencies(terms);

    const chunk: IRChunkV2 = {
      id: nanoid(),
      docId: document.id,
      chunkIndex,
      content: content.trim(),
      tokenCount,
      startOffset,
      endOffset,
      isTitle: this.isTitle(content),
      isTableHeader: this.isTableHeader(content),
      sectionTitle: this.extractSectionTitle(content),
      language: document.language,
      confidence: this.calculateContentQuality(content),
      terms,
      termFreqs,
      createdAt: new Date().toISOString(),
    };

    return chunk;
  }

  /**
   * 构建索引数据（词汇表和倒排索引）
   */
  private async buildIndexData(chunks: IRChunkV2[]): Promise<{
    terms: DatabaseTerm[];
    postings: DatabasePosting[];
  }> {
    console.log("🔍 [IR Processor V2] Building index data...");

    const termMap = new Map<
      string,
      {
        docIds: Set<string>;
        chunkIds: Set<string>;
        totalFreq: number;
        maxFreq: number;
        postings: DatabasePosting[];
      }
    >();

    // 处理每个文本块
    for (const chunk of chunks) {
      for (const [term, freq] of chunk.termFreqs) {
        if (!termMap.has(term)) {
          termMap.set(term, {
            docIds: new Set(),
            chunkIds: new Set(),
            totalFreq: 0,
            maxFreq: 0,
            postings: [],
          });
        }

        const termData = termMap.get(term)!;
        termData.docIds.add(chunk.docId);
        termData.chunkIds.add(chunk.id);
        termData.totalFreq += freq;
        termData.maxFreq = Math.max(termData.maxFreq, freq);

        // 创建倒排索引项
        const posting: DatabasePosting = {
          id: nanoid(),
          term,
          docId: chunk.docId,
          chunkId: chunk.id,
          termFreq: freq,
          contentWeight: this.fieldWeights.content,
          createdAt: new Date().toISOString(),
        };

        // 添加字段权重
        if (chunk.isTitle) {
          posting.titleWeight = this.fieldWeights.title;
        }
        if (chunk.isTableHeader) {
          posting.tableHeaderWeight = this.fieldWeights.tableHeader;
        }

        termData.postings.push(posting);
      }
    }

    // 构建词汇表
    const terms: DatabaseTerm[] = [];
    for (const [term, data] of termMap) {
      terms.push({
        term,
        docFreq: data.docIds.size,
        chunkFreq: data.chunkIds.size,
        totalFreq: data.totalFreq,
        avgTermFreq: data.totalFreq / data.chunkIds.size,
        maxTermFreq: data.maxFreq,
        updatedAt: new Date().toISOString(),
      });
    }

    // 构建倒排索引
    const postings: DatabasePosting[] = [];
    for (const data of termMap.values()) {
      postings.push(...data.postings);
    }

    console.log(
      `🔍 [IR Processor V2] Built index: ${terms.length} terms, ${postings.length} postings`,
    );

    return { terms, postings };
  }

  /**
   * 计算索引统计信息
   */
  private calculateIndexStats(
    document: IRDocumentV2,
    chunks: IRChunkV2[],
    terms: DatabaseTerm[],
  ) {
    const totalTerms = terms.reduce((sum, term) => sum + term.totalFreq, 0);
    const uniqueTerms = terms.length;
    const totalTokens = chunks.reduce(
      (sum, chunk) => sum + chunk.tokenCount,
      0,
    );

    return {
      totalDocuments: 1, // 这里只是单个文档的统计
      totalChunks: chunks.length,
      totalTerms,
      uniqueTerms,
      avgDocumentLength: totalTokens,
      avgChunkLength: chunks.length > 0 ? totalTokens / chunks.length : 0,
    };
  }

  /**
   * 存储到持久化索引服务
   */
  private async storeToIndexService(
    document: IRDocumentV2,
    chunks: IRChunkV2[],
    terms: DatabaseTerm[],
    postings: DatabasePosting[],
    indexStats: any,
  ): Promise<void> {
    console.log("💾 [IR Processor V2] Storing to index service...");

    const indexService = getIRIndexService();

    // 更新文档统计信息
    document.totalTokens = chunks.reduce(
      (sum, chunk) => sum + chunk.tokenCount,
      0,
    );
    document.chunkCount = chunks.length;
    document.termStats = {
      totalTerms: terms.reduce((sum, term) => sum + term.totalFreq, 0),
      uniqueTerms: terms.length,
      avgTermsPerChunk:
        chunks.length > 0
          ? terms.reduce((sum, term) => sum + term.totalFreq, 0) / chunks.length
          : 0,
    };
    document.processedAt = new Date().toISOString();
    document.status = "completed";

    // 转换为数据库格式
    const dbDocument: DatabaseDocument = {
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.size,
      title: document.title,
      language: document.language,
      uploadedAt: document.uploadedAt,
      processedAt: document.processedAt,
      status: document.status,
      error: document.error,
      totalTokens: document.totalTokens,
      chunkCount: document.chunkCount,
      termStats: document.termStats,
    };

    const dbChunks: DatabaseChunk[] = chunks.map((chunk) => ({
      id: chunk.id,
      docId: chunk.docId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      isTitle: chunk.isTitle,
      isTableHeader: chunk.isTableHeader,
      sectionTitle: chunk.sectionTitle,
      page: chunk.page,
      language: chunk.language,
      confidence: chunk.confidence,
      createdAt: chunk.createdAt,
    }));

    // 存储到索引服务
    await indexService.addDocument(dbDocument);
    await indexService.addChunks(dbChunks);
    await indexService.addTerms(terms);
    await indexService.addPostings(postings);

    // 更新全局统计信息（这里需要从索引服务获取当前统计并更新）
    const currentStats = await indexService.getIndexStats();
    const updatedStats = {
      totalDocuments: (currentStats?.totalDocuments || 0) + 1,
      totalChunks: (currentStats?.totalChunks || 0) + chunks.length,
      totalTerms: (currentStats?.totalTerms || 0) + indexStats.totalTerms,
      uniqueTerms: (currentStats?.uniqueTerms || 0) + indexStats.uniqueTerms,
      avgDocumentLength: indexStats.avgDocumentLength,
      avgChunkLength: indexStats.avgChunkLength,
      lastUpdated: new Date().toISOString(),
    };

    await indexService.updateIndexStats(updatedStats);

    console.log("✅ [IR Processor V2] Successfully stored to index service");
  }

  // ================ 辅助方法 ================

  /**
   * 提取文本内容
   */
  private async extractText(file: File): Promise<string> {
    const fileType = file.type;

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

    if (
      fileType.includes("text/") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".xml")
    ) {
      return await file.text();
    }

    throw new Error(`Unsupported file type: ${fileType}`);
  }

  /**
   * 提取PDF文本
   */
  private async extractPdfText(file: File): Promise<string> {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let fullText = "";
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
   * JSON转文本
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
   * 提取并标准化词汇
   */
  private extractAndNormalizeTerms(text: string): string[] {
    const terms: string[] = [];

    const normalizedText = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 英文词汇
    const englishWords = normalizedText.match(/[a-zA-Z]{2,}/g) || [];
    for (const word of englishWords) {
      if (!this.stopWords.has(word)) {
        terms.push(word);
      }
    }

    // 数字
    const numbers = normalizedText.match(/\d+/g) || [];
    terms.push(...numbers);

    // 中文词汇
    const chineseText = normalizedText.replace(/[a-zA-Z0-9\s]/g, "");
    if (chineseText.length > 0) {
      // 单字
      for (let i = 0; i < chineseText.length; i++) {
        const char = chineseText[i];
        if (char && /[\u4e00-\u9fa5]/.test(char) && !this.stopWords.has(char)) {
          terms.push(char);
        }
      }

      // 双字词
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

      // 三字词
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
   * 计算词频
   */
  private calculateTermFrequencies(terms: string[]): Map<string, number> {
    const freqs = new Map<string, number>();
    for (const term of terms) {
      freqs.set(term, (freqs.get(term) || 0) + 1);
    }
    return freqs;
  }

  /**
   * 估算token数量
   */
  private estimateTokenCount(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + englishChars / 4);
  }

  /**
   * 获取最后N个token的文本（用于重叠）
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
   * 从文件名提取标题
   */
  private extractTitleFromFileName(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  }

  /**
   * 检测是否为标题
   */
  private isTitle(content: string): boolean {
    const lines = content.split("\n");
    const firstLine = lines[0].trim();

    return (
      firstLine.length < 100 &&
      firstLine.length > 2 &&
      lines.length <= 3 &&
      !/[。！？.!?]$/.test(firstLine)
    );
  }

  /**
   * 检测是否为表格标题
   */
  private isTableHeader(content: string): boolean {
    return /^[^\n]*[|｜]\s*[^\n]*$/.test(content.trim());
  }

  /**
   * 提取章节标题
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
   * 计算内容质量分数
   */
  private calculateContentQuality(content: string): number {
    const length = content.length;
    const sentences = content.split(/[。！？.!?]/).length;
    const avgSentenceLength = length / sentences;

    let score = 0.5;

    if (length > 100 && length < 2000) score += 0.2;
    if (avgSentenceLength > 10 && avgSentenceLength < 100) score += 0.2;
    if (length < 50 || length > 3000) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }
}
