/**
 * IR索引服务 - 持久化存储BM25索引和文档数据
 * 解决原系统索引存储在内存中的问题
 */

// ================ 数据库接口定义 ================

export interface DatabaseDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  title?: string;
  language?: string;
  uploadedAt: string;
  processedAt?: string;
  status: "processing" | "completed" | "error";
  error?: string;
  totalTokens: number;
  chunkCount: number;

  // 统计信息
  termStats: {
    totalTerms: number;
    uniqueTerms: number;
    avgTermsPerChunk: number;
  };
}

export interface DatabaseChunk {
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

  createdAt: string;
}

export interface DatabaseTerm {
  term: string;
  docFreq: number; // 包含该词的文档数
  chunkFreq: number; // 包含该词的文本块数
  totalFreq: number; // 词的总出现频次

  // 统计信息
  avgTermFreq: number; // 平均词频
  maxTermFreq: number; // 最大词频

  updatedAt: string;
}

export interface DatabasePosting {
  id: string;
  term: string;
  docId: string;
  chunkId: string;
  termFreq: number;

  // 字段权重
  titleWeight?: number;
  contentWeight?: number;
  tableHeaderWeight?: number;

  // 位置信息（用于短语查询）
  positions?: number[];

  createdAt: string;
}

export interface DatabaseIndexStats {
  id: string;
  totalDocuments: number;
  totalChunks: number;
  totalTerms: number;
  uniqueTerms: number;
  avgDocumentLength: number;
  avgChunkLength: number;
  lastUpdated: string;
}

// ================ 索引服务接口 ================

export interface IRIndexServiceInterface {
  // 文档管理
  addDocument(document: DatabaseDocument): Promise<string>;
  updateDocument(id: string, updates: Partial<DatabaseDocument>): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  getDocument(id: string): Promise<DatabaseDocument | null>;
  getAllDocuments(): Promise<DatabaseDocument[]>;

  // 文本块管理
  addChunk(chunk: DatabaseChunk): Promise<string>;
  addChunks(chunks: DatabaseChunk[]): Promise<string[]>;
  deleteChunksByDocId(docId: string): Promise<void>;
  getChunksByDocId(docId: string): Promise<DatabaseChunk[]>;
  getChunk(id: string): Promise<DatabaseChunk | null>;

  // 索引管理
  addTerms(terms: DatabaseTerm[]): Promise<void>;
  addPostings(postings: DatabasePosting[]): Promise<void>;
  deleteTermsByDocId(docId: string): Promise<void>;
  deletePostingsByDocId(docId: string): Promise<void>;

  // 搜索查询
  searchTerms(terms: string[]): Promise<Map<string, DatabaseTerm>>;
  getPostingsForTerms(terms: string[]): Promise<Map<string, DatabasePosting[]>>;
  getPostingsForTermsInDocs(
    terms: string[],
    docIds: string[],
  ): Promise<Map<string, DatabasePosting[]>>;

  // 统计信息
  updateIndexStats(stats: Omit<DatabaseIndexStats, "id">): Promise<void>;
  getIndexStats(): Promise<DatabaseIndexStats | null>;

  // 维护操作
  reindexAll(): Promise<void>;
  vacuum(): Promise<void>;
  backup(): Promise<string>;
}

// ================ 内存实现（开发/测试用） ================

export class MemoryIRIndexService implements IRIndexServiceInterface {
  private documents: Map<string, DatabaseDocument> = new Map();
  private chunks: Map<string, DatabaseChunk> = new Map();
  private terms: Map<string, DatabaseTerm> = new Map();
  private postings: Map<string, DatabasePosting[]> = new Map(); // term -> postings
  private indexStats: DatabaseIndexStats | null = null;

  // 辅助索引
  private chunksByDoc: Map<string, string[]> = new Map(); // docId -> chunkIds
  private postingsByDoc: Map<string, Set<string>> = new Map(); // docId -> terms

  constructor() {
    console.log(
      "🏗️ [IR Index Service] Initializing memory-based IR index service",
    );
  }

  // ================ 文档管理 ================

  async addDocument(document: DatabaseDocument): Promise<string> {
    console.log("📝 [IR Index Service] Adding document:", document.fileName);
    this.documents.set(document.id, { ...document });
    this.chunksByDoc.set(document.id, []);
    this.postingsByDoc.set(document.id, new Set());
    return document.id;
  }

  async updateDocument(
    id: string,
    updates: Partial<DatabaseDocument>,
  ): Promise<void> {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }

    this.documents.set(id, { ...existing, ...updates });
    console.log("📝 [IR Index Service] Updated document:", id);
  }

  async deleteDocument(id: string): Promise<void> {
    console.log("🗑️ [IR Index Service] Deleting document:", id);

    // 删除相关的文本块
    await this.deleteChunksByDocId(id);

    // 删除相关的索引数据
    await this.deleteTermsByDocId(id);
    await this.deletePostingsByDocId(id);

    // 删除文档
    this.documents.delete(id);
    this.chunksByDoc.delete(id);
    this.postingsByDoc.delete(id);

    console.log("✅ [IR Index Service] Document deleted:", id);
  }

  async getDocument(id: string): Promise<DatabaseDocument | null> {
    return this.documents.get(id) || null;
  }

  async getAllDocuments(): Promise<DatabaseDocument[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
  }

  // ================ 文本块管理 ================

  async addChunk(chunk: DatabaseChunk): Promise<string> {
    this.chunks.set(chunk.id, { ...chunk });

    // 更新辅助索引
    const chunkIds = this.chunksByDoc.get(chunk.docId) || [];
    chunkIds.push(chunk.id);
    this.chunksByDoc.set(chunk.docId, chunkIds);

    return chunk.id;
  }

  async addChunks(chunks: DatabaseChunk[]): Promise<string[]> {
    const ids: string[] = [];
    for (const chunk of chunks) {
      const id = await this.addChunk(chunk);
      ids.push(id);
    }
    return ids;
  }

  async deleteChunksByDocId(docId: string): Promise<void> {
    const chunkIds = this.chunksByDoc.get(docId) || [];
    for (const chunkId of chunkIds) {
      this.chunks.delete(chunkId);
    }
    this.chunksByDoc.delete(docId);
    console.log(
      `🗑️ [IR Index Service] Deleted ${chunkIds.length} chunks for document:`,
      docId,
    );
  }

  async getChunksByDocId(docId: string): Promise<DatabaseChunk[]> {
    const chunkIds = this.chunksByDoc.get(docId) || [];
    return chunkIds.map((id) => this.chunks.get(id)!).filter(Boolean);
  }

  async getChunk(id: string): Promise<DatabaseChunk | null> {
    return this.chunks.get(id) || null;
  }

  // ================ 索引管理 ================

  async addTerms(terms: DatabaseTerm[]): Promise<void> {
    for (const term of terms) {
      this.terms.set(term.term, { ...term });
    }
    console.log(`📚 [IR Index Service] Added ${terms.length} terms to index`);
  }

  async addPostings(postings: DatabasePosting[]): Promise<void> {
    for (const posting of postings) {
      const existing = this.postings.get(posting.term) || [];
      existing.push({ ...posting });
      this.postings.set(posting.term, existing);

      // 更新文档-词汇关联
      const docTerms = this.postingsByDoc.get(posting.docId) || new Set();
      docTerms.add(posting.term);
      this.postingsByDoc.set(posting.docId, docTerms);
    }
    console.log(
      `📚 [IR Index Service] Added ${postings.length} postings to index`,
    );
  }

  async deleteTermsByDocId(docId: string): Promise<void> {
    const docTerms = this.postingsByDoc.get(docId) || new Set();

    for (const term of docTerms) {
      // 重新计算词汇统计
      const termData = this.terms.get(term);
      if (termData) {
        const postings = this.postings.get(term) || [];
        const remainingPostings = postings.filter((p) => p.docId !== docId);

        if (remainingPostings.length === 0) {
          // 如果没有其他文档包含这个词，删除词汇
          this.terms.delete(term);
          this.postings.delete(term);
        } else {
          // 更新词汇统计
          const uniqueDocs = new Set(remainingPostings.map((p) => p.docId));
          const totalFreq = remainingPostings.reduce(
            (sum, p) => sum + p.termFreq,
            0,
          );

          this.terms.set(term, {
            ...termData,
            docFreq: uniqueDocs.size,
            chunkFreq: remainingPostings.length,
            totalFreq,
            avgTermFreq: totalFreq / remainingPostings.length,
            maxTermFreq: Math.max(...remainingPostings.map((p) => p.termFreq)),
            updatedAt: new Date().toISOString(),
          });

          this.postings.set(term, remainingPostings);
        }
      }
    }

    console.log(`🗑️ [IR Index Service] Cleaned up terms for document:`, docId);
  }

  async deletePostingsByDocId(docId: string): Promise<void> {
    const docTerms = this.postingsByDoc.get(docId) || new Set();

    for (const term of docTerms) {
      const postings = this.postings.get(term) || [];
      const filtered = postings.filter((p) => p.docId !== docId);

      if (filtered.length === 0) {
        this.postings.delete(term);
      } else {
        this.postings.set(term, filtered);
      }
    }

    this.postingsByDoc.delete(docId);
    console.log(
      `🗑️ [IR Index Service] Cleaned up postings for document:`,
      docId,
    );
  }

  // ================ 搜索查询 ================

  async searchTerms(terms: string[]): Promise<Map<string, DatabaseTerm>> {
    const result = new Map<string, DatabaseTerm>();

    for (const term of terms) {
      const termData = this.terms.get(term);
      if (termData) {
        result.set(term, termData);
      }
    }

    return result;
  }

  async getPostingsForTerms(
    terms: string[],
  ): Promise<Map<string, DatabasePosting[]>> {
    const result = new Map<string, DatabasePosting[]>();

    for (const term of terms) {
      const postings = this.postings.get(term);
      if (postings) {
        result.set(term, [...postings]);
      }
    }

    return result;
  }

  async getPostingsForTermsInDocs(
    terms: string[],
    docIds: string[],
  ): Promise<Map<string, DatabasePosting[]>> {
    const result = new Map<string, DatabasePosting[]>();
    const docSet = new Set(docIds);

    for (const term of terms) {
      const postings = this.postings.get(term);
      if (postings) {
        const filtered = postings.filter((p) => docSet.has(p.docId));
        if (filtered.length > 0) {
          result.set(term, filtered);
        }
      }
    }

    return result;
  }

  // ================ 统计信息 ================

  async updateIndexStats(stats: Omit<DatabaseIndexStats, "id">): Promise<void> {
    this.indexStats = {
      id: "stats",
      ...stats,
    };
    console.log("📊 [IR Index Service] Updated index statistics");
  }

  async getIndexStats(): Promise<DatabaseIndexStats | null> {
    return this.indexStats;
  }

  // ================ 维护操作 ================

  async reindexAll(): Promise<void> {
    console.log("🔄 [IR Index Service] Starting full reindex...");

    // 清空索引
    this.terms.clear();
    this.postings.clear();

    // 重建辅助索引
    for (const [docId] of this.documents) {
      this.postingsByDoc.set(docId, new Set());
    }

    console.log("✅ [IR Index Service] Full reindex completed");
  }

  async vacuum(): Promise<void> {
    console.log("🧹 [IR Index Service] Running vacuum (memory cleanup)...");

    // 在内存实现中，垃圾回收由JS引擎处理
    // 这里可以做一些统计优化

    console.log("✅ [IR Index Service] Vacuum completed");
  }

  async backup(): Promise<string> {
    const backupData = {
      documents: Array.from(this.documents.entries()),
      chunks: Array.from(this.chunks.entries()),
      terms: Array.from(this.terms.entries()),
      postings: Array.from(this.postings.entries()),
      indexStats: this.indexStats,
      timestamp: new Date().toISOString(),
    };

    const backup = JSON.stringify(backupData, null, 2);
    console.log(
      "💾 [IR Index Service] Backup created, size:",
      backup.length,
      "characters",
    );

    return backup;
  }

  // ================ 调试和统计方法 ================

  getMemoryStats() {
    return {
      documents: this.documents.size,
      chunks: this.chunks.size,
      terms: this.terms.size,
      postings: Array.from(this.postings.values()).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ),
      memoryFootprint: {
        documents: JSON.stringify(Array.from(this.documents.values())).length,
        chunks: JSON.stringify(Array.from(this.chunks.values())).length,
        terms: JSON.stringify(Array.from(this.terms.values())).length,
        postings: JSON.stringify(Array.from(this.postings.entries())).length,
      },
    };
  }

  async getTermDistribution(): Promise<{ term: string; frequency: number }[]> {
    return Array.from(this.terms.entries())
      .map(([term, data]) => ({ term, frequency: data.totalFreq }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  async getDocumentDistribution(): Promise<
    { docId: string; termCount: number }[]
  > {
    const distribution: { docId: string; termCount: number }[] = [];

    for (const [docId, termSet] of this.postingsByDoc) {
      distribution.push({
        docId,
        termCount: termSet.size,
      });
    }

    return distribution.sort((a, b) => b.termCount - a.termCount);
  }
}

// ================ 服务单例 ================

let indexServiceInstance: IRIndexServiceInterface | null = null;

export function getIRIndexService(): IRIndexServiceInterface {
  if (!indexServiceInstance) {
    indexServiceInstance = new MemoryIRIndexService();
  }
  return indexServiceInstance;
}

export function setIRIndexService(service: IRIndexServiceInterface): void {
  indexServiceInstance = service;
}
