/**
 * IR搜索引擎 V2 - 使用持久化索引服务
 * 解决原系统索引存储在内存中的问题
 */

import {
  getIRIndexService,
  DatabaseDocument,
  DatabaseChunk,
  DatabaseTerm,
  DatabasePosting,
} from "../services/ir-index-service";

// ================ 搜索接口定义 ================

export interface SearchQuery {
  originalQuery: string;
  normalizedTerms: string[];
  expandedTerms?: string[];
  phrases?: string[][];
  fieldBoosts?: Map<string, number>;
}

export interface SearchResult {
  document: DatabaseDocument;
  chunk: DatabaseChunk;
  score: number;
  explanation?: {
    termScores: Map<string, number>;
    fieldBoosts: Map<string, number>;
    finalScore: number;
    bm25Details?: {
      idf: number;
      tf: number;
      fieldNorm: number;
    };
  };
}

export interface SearchOptions {
  topK?: number; // 文档级搜索返回的文档数
  topN?: number; // 最终返回的文本块数
  useHierarchicalSearch?: boolean; // 是否使用层次搜索
  usePRF?: boolean; // 是否使用伪相关反馈
  explain?: boolean; // 是否返回评分解释
  minScore?: number; // 最小分数阈值
}

export interface BM25Parameters {
  k1: number; // 词频饱和参数 (默认: 1.2)
  b: number; // 文档长度标准化参数 (默认: 0.75)
  k3: number; // 查询词频饱和参数 (默认: 8)

  // 字段权重
  fieldWeights: {
    title: number;
    content: number;
    tableHeader: number;
  };
}

// ================ 持久化IR搜索引擎 ================

export class IRSearchEngineV2 {
  private static instance: IRSearchEngineV2;

  // BM25参数
  private readonly bm25Params: BM25Parameters = {
    k1: 1.2,
    b: 0.75,
    k3: 8,
    fieldWeights: {
      title: 2.0,
      content: 1.0,
      tableHeader: 1.5,
    },
  };

  // 停用词和同义词
  private readonly stopWords = new Set([
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

  private readonly synonymGroups = new Map<string, string[]>([
    ["产品", ["商品", "物品", "制品"]],
    ["标准", ["规范", "准则", "要求", "规定"]],
    ["质量", ["品质", "质量标准"]],
    ["制作", ["生产", "加工", "制造"]],
    ["流程", ["过程", "程序", "步骤"]],
  ]);

  static getInstance(): IRSearchEngineV2 {
    if (!IRSearchEngineV2.instance) {
      IRSearchEngineV2.instance = new IRSearchEngineV2();
    }
    return IRSearchEngineV2.instance;
  }

  /**
   * 主搜索接口
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const {
      topK = 10,
      topN = 5,
      useHierarchicalSearch = true,
      usePRF = false,
      explain = false,
      minScore = 0.01,
    } = options;

    console.log("🔍 [IR Search V2] Starting search:", query);
    console.log("🔍 [IR Search V2] Options:", {
      topK,
      topN,
      useHierarchicalSearch,
      usePRF,
      explain,
    });

    // 第一步：处理查询
    const processedQuery = this.processQuery(query);
    console.log("📝 [IR Search V2] Processed query:", processedQuery);

    let results: SearchResult[];

    if (useHierarchicalSearch) {
      // 层次搜索：文档 → 文本块
      results = await this.hierarchicalSearch(
        processedQuery,
        topK,
        topN,
        explain,
      );
    } else {
      // 直接块级搜索
      results = await this.directChunkSearch(processedQuery, topN, explain);
    }

    // 过滤低分结果
    results = results.filter((result) => result.score >= minScore);

    // 伪相关反馈（可选）
    if (usePRF && results.length > 0) {
      console.log("🔄 [IR Search V2] Applying pseudo-relevance feedback...");
      results = await this.applyPseudoRelevanceFeedback(
        processedQuery,
        results,
        topN,
      );
    }

    console.log(
      `✅ [IR Search V2] Search completed: ${results.length} results found`,
    );
    return results;
  }

  /**
   * 层次搜索：先搜索文档，再在相关文档中搜索文本块
   */
  private async hierarchicalSearch(
    query: SearchQuery,
    topK: number,
    topN: number,
    explain: boolean,
  ): Promise<SearchResult[]> {
    console.log("🏗️ [IR Search V2] Performing hierarchical search");

    // 第一阶段：文档级搜索
    const relevantDocuments = await this.searchDocuments(query, topK, explain);
    console.log(
      `📚 [IR Search V2] Found ${relevantDocuments.length} relevant documents`,
    );

    if (relevantDocuments.length === 0) {
      return [];
    }

    // 第二阶段：在相关文档中搜索文本块
    const docIds = relevantDocuments.map((doc) => doc.document.id);
    const chunkResults = await this.searchChunksInDocuments(
      query,
      docIds,
      topN,
      explain,
    );

    console.log(
      `📄 [IR Search V2] Found ${chunkResults.length} relevant chunks`,
    );
    return chunkResults;
  }

  /**
   * 直接块级搜索
   */
  private async directChunkSearch(
    query: SearchQuery,
    topN: number,
    explain: boolean,
  ): Promise<SearchResult[]> {
    console.log("📄 [IR Search V2] Performing direct chunk search");

    const indexService = getIRIndexService();

    // 获取查询词的倒排索引
    const postingsMap = await indexService.getPostingsForTerms(
      query.normalizedTerms,
    );
    const termDataMap = await indexService.searchTerms(query.normalizedTerms);

    if (postingsMap.size === 0) {
      console.log("❌ [IR Search V2] No postings found for query terms");
      return [];
    }

    // 获取全局统计信息
    const indexStats = await indexService.getIndexStats();
    if (!indexStats) {
      throw new Error("Index statistics not available");
    }

    // 计算文本块分数
    const chunkScores = await this.calculateChunkScores(
      query,
      postingsMap,
      termDataMap,
      indexStats,
      explain,
    );

    // 获取前N个文本块
    const topChunks = Array.from(chunkScores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, topN);

    // 构建搜索结果
    const results: SearchResult[] = [];
    for (const [chunkId, scoreData] of topChunks) {
      const chunk = await indexService.getChunk(chunkId);
      const document = chunk
        ? await indexService.getDocument(chunk.docId)
        : null;

      if (chunk && document) {
        results.push({
          document,
          chunk,
          score: scoreData.score,
          explanation: explain ? scoreData.explanation : undefined,
        });
      }
    }

    return results;
  }

  /**
   * 文档级搜索
   */
  private async searchDocuments(
    query: SearchQuery,
    topK: number,
    explain: boolean,
  ): Promise<
    Array<{ document: DatabaseDocument; score: number; explanation?: any }>
  > {
    const indexService = getIRIndexService();

    // 获取所有文档
    const allDocuments = await indexService.getAllDocuments();
    const docScores: Array<{
      document: DatabaseDocument;
      score: number;
      explanation?: any;
    }> = [];

    // 获取查询词的统计信息
    const termDataMap = await indexService.searchTerms(query.normalizedTerms);
    const indexStats = await indexService.getIndexStats();

    if (!indexStats) {
      throw new Error("Index statistics not available");
    }

    // 为每个文档计算分数
    for (const document of allDocuments) {
      let totalScore = 0;
      const termScores = new Map<string, number>();

      // 获取该文档的所有倒排索引
      const docPostings = await indexService.getPostingsForTermsInDocs(
        query.normalizedTerms,
        [document.id],
      );

      for (const term of query.normalizedTerms) {
        const termData = termDataMap.get(term);
        const postings = docPostings.get(term) || [];

        if (termData && postings.length > 0) {
          // 计算文档中该词的总频次
          const docTermFreq = postings.reduce(
            (sum, posting) => sum + posting.termFreq,
            0,
          );

          // 计算BM25分数
          const score = this.calculateBM25Score(
            term,
            docTermFreq,
            document.totalTokens,
            indexStats.avgDocumentLength,
            termData.docFreq,
            indexStats.totalDocuments,
            1.0, // 文档级搜索使用基础权重
          );

          totalScore += score;
          termScores.set(term, score);
        }
      }

      if (totalScore > 0) {
        docScores.push({
          document,
          score: totalScore,
          explanation: explain
            ? { termScores, finalScore: totalScore }
            : undefined,
        });
      }
    }

    // 排序并返回前K个文档
    return docScores.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * 在指定文档中搜索文本块
   */
  private async searchChunksInDocuments(
    query: SearchQuery,
    docIds: string[],
    topN: number,
    explain: boolean,
  ): Promise<SearchResult[]> {
    const indexService = getIRIndexService();

    // 获取指定文档中的倒排索引
    const postingsMap = await indexService.getPostingsForTermsInDocs(
      query.normalizedTerms,
      docIds,
    );
    const termDataMap = await indexService.searchTerms(query.normalizedTerms);
    const indexStats = await indexService.getIndexStats();

    if (!indexStats || postingsMap.size === 0) {
      return [];
    }

    // 计算文本块分数
    const chunkScores = await this.calculateChunkScores(
      query,
      postingsMap,
      termDataMap,
      indexStats,
      explain,
    );

    // 获取前N个文本块
    const topChunks = Array.from(chunkScores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, topN);

    // 构建搜索结果
    const results: SearchResult[] = [];
    for (const [chunkId, scoreData] of topChunks) {
      const chunk = await indexService.getChunk(chunkId);
      const document = chunk
        ? await indexService.getDocument(chunk.docId)
        : null;

      if (chunk && document) {
        results.push({
          document,
          chunk,
          score: scoreData.score,
          explanation: explain ? scoreData.explanation : undefined,
        });
      }
    }

    return results;
  }

  /**
   * 计算文本块分数
   */
  private async calculateChunkScores(
    query: SearchQuery,
    postingsMap: Map<string, DatabasePosting[]>,
    termDataMap: Map<string, DatabaseTerm>,
    indexStats: any,
    explain: boolean,
  ): Promise<Map<string, { score: number; explanation?: any }>> {
    const chunkScores = new Map<string, { score: number; explanation?: any }>();

    // 收集所有相关的文本块
    const relevantChunks = new Set<string>();
    for (const postings of postingsMap.values()) {
      for (const posting of postings) {
        relevantChunks.add(posting.chunkId);
      }
    }

    // 为每个文本块计算分数
    for (const chunkId of relevantChunks) {
      let totalScore = 0;
      const termScores = new Map<string, number>();
      const fieldBoosts = new Map<string, number>();

      for (const term of query.normalizedTerms) {
        const termData = termDataMap.get(term);
        const postings = postingsMap.get(term) || [];
        const chunkPosting = postings.find((p) => p.chunkId === chunkId);

        if (termData && chunkPosting) {
          // 计算字段权重
          let fieldWeight =
            chunkPosting.contentWeight || this.bm25Params.fieldWeights.content;
          if (chunkPosting.titleWeight) {
            fieldWeight = Math.max(fieldWeight, chunkPosting.titleWeight);
          }
          if (chunkPosting.tableHeaderWeight) {
            fieldWeight = Math.max(fieldWeight, chunkPosting.tableHeaderWeight);
          }

          // 获取文本块信息以计算长度
          // 这里简化处理，实际应该从索引服务获取文本块信息
          const avgChunkLength = indexStats.avgChunkLength || 500;

          // 计算BM25分数
          const score = this.calculateBM25Score(
            term,
            chunkPosting.termFreq,
            avgChunkLength, // 使用平均长度作为近似
            indexStats.avgChunkLength,
            termData.chunkFreq, // 使用chunkFreq代替docFreq
            indexStats.totalChunks,
            fieldWeight,
          );

          totalScore += score;
          termScores.set(term, score);
          fieldBoosts.set(term, fieldWeight);
        }
      }

      if (totalScore > 0) {
        chunkScores.set(chunkId, {
          score: totalScore,
          explanation: explain
            ? {
                termScores,
                fieldBoosts,
                finalScore: totalScore,
              }
            : undefined,
        });
      }
    }

    return chunkScores;
  }

  /**
   * 计算BM25分数
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

    // IDF分量
    const idf = Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5));

    // TF分量（带长度标准化）
    const tfComponent =
      (termFreq * (k1 + 1)) /
      (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));

    return idf * tfComponent * fieldWeight;
  }

  /**
   * 查询处理
   */
  private processQuery(query: string): SearchQuery {
    const originalQuery = query;

    // 标准化查询词
    const normalizedTerms = this.extractAndNormalizeTerms(query);

    // 同义词扩展
    const expandedTerms = this.expandWithSynonyms(normalizedTerms);

    // 提取短语
    const phrases = this.extractPhrases(query);

    return {
      originalQuery,
      normalizedTerms,
      expandedTerms,
      phrases,
    };
  }

  /**
   * 提取和标准化词汇
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
   * 同义词扩展
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
   * 提取短语
   */
  private extractPhrases(query: string): string[][] {
    const phrases: string[][] = [];

    // 提取引号中的短语
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

  /**
   * 伪相关反馈
   */
  private async applyPseudoRelevanceFeedback(
    originalQuery: SearchQuery,
    initialResults: SearchResult[],
    topN: number,
  ): Promise<SearchResult[]> {
    // 简化的PRF实现：从前3个结果中提取扩展词汇
    const topResults = initialResults.slice(0, 3);
    const expansionTerms = new Map<string, number>();

    // 从顶部结果中收集词汇
    for (const result of topResults) {
      const content = result.chunk.content;
      const terms = this.extractAndNormalizeTerms(content);

      for (const term of terms) {
        if (!originalQuery.normalizedTerms.includes(term)) {
          expansionTerms.set(
            term,
            (expansionTerms.get(term) || 0) + result.score,
          );
        }
      }
    }

    // 选择前5个扩展词汇
    const sortedExpansionTerms = Array.from(expansionTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term);

    if (sortedExpansionTerms.length > 0) {
      console.log(
        "🔄 [IR Search V2] Expanding query with terms:",
        sortedExpansionTerms,
      );

      // 创建扩展查询
      const expandedQuery: SearchQuery = {
        ...originalQuery,
        normalizedTerms: [
          ...originalQuery.normalizedTerms,
          ...sortedExpansionTerms,
        ],
      };

      // 重新搜索
      return await this.directChunkSearch(expandedQuery, topN, false);
    }

    return initialResults;
  }

  /**
   * 获取搜索建议
   */
  async getSearchSuggestions(
    query: string,
    limit: number = 5,
  ): Promise<string[]> {
    const indexService = getIRIndexService();
    const terms = this.extractAndNormalizeTerms(query);

    if (terms.length === 0) {
      return [];
    }

    // 获取相关词汇的统计信息
    const termDistribution = await indexService.getTermDistribution();

    // 基于查询词汇查找相关建议
    const suggestions = new Set<string>();

    for (const term of terms) {
      // 查找包含查询词的其他词汇
      const relatedTerms = termDistribution
        .filter((t) => t.term.includes(term) && t.term !== term)
        .slice(0, 3)
        .map((t) => t.term);

      relatedTerms.forEach((t) => suggestions.add(t));
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * 更新BM25参数
   */
  updateBM25Parameters(params: Partial<BM25Parameters>): void {
    Object.assign(this.bm25Params, params);
    console.log("⚙️ [IR Search V2] Updated BM25 parameters:", this.bm25Params);
  }

  /**
   * 获取当前BM25参数
   */
  getBM25Parameters(): BM25Parameters {
    return { ...this.bm25Params };
  }
}
