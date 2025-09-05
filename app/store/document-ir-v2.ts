/**
 * IR文档存储 V2 - 使用持久化索引服务
 * 解决原系统索引存储在内存中的问题
 */

import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import {
  IRDocumentProcessorV2,
  ProcessingResult,
} from "../utils/document-processor-ir-v2";
import {
  IRSearchEngineV2,
  SearchResult,
  SearchOptions,
} from "../utils/ir-search-engine-v2";
import {
  getIRIndexService,
  DatabaseDocument,
  DatabaseChunk,
} from "../services/ir-index-service";

// ================ 存储接口定义 ================

export interface IRDocumentSearchResult {
  document: DatabaseDocument;
  chunk: DatabaseChunk;
  score: number;
  explanation?: {
    termScores: Map<string, number>;
    fieldBoosts: Map<string, number>;
    finalScore: number;
  };
}

export interface IRDocumentStoreV2 {
  // 基本状态
  isProcessing: boolean;
  lastUpdated: number;

  // 搜索设置
  searchSettings: {
    useHierarchicalSearch: boolean;
    usePRF: boolean;
    topKDocuments: number;
    topNChunks: number;
    explainScores: boolean;
    minScore: number;
  };

  // 统计信息缓存
  cachedStats?: {
    totalDocuments: number;
    totalChunks: number;
    totalTerms: number;
    uniqueTerms: number;
    avgDocumentLength: number;
    avgChunkLength: number;
    lastCached: number;
  };

  // 最近处理的文档ID列表（用于UI展示）
  recentDocumentIds: string[];
}

const DEFAULT_IR_DOCUMENT_STATE_V2: IRDocumentStoreV2 = {
  isProcessing: false,
  lastUpdated: 0,
  searchSettings: {
    useHierarchicalSearch: true,
    usePRF: false,
    topKDocuments: 10,
    topNChunks: 5,
    explainScores: false,
    minScore: 0.01,
  },
  recentDocumentIds: [],
};

export const useIRDocumentStoreV2 = createPersistStore(
  DEFAULT_IR_DOCUMENT_STATE_V2,
  (set, get) => {
    // 初始化处理器和搜索引擎
    const processor = IRDocumentProcessorV2.getInstance();
    const searchEngine = IRSearchEngineV2.getInstance();
    const indexService = getIRIndexService();

    return {
      // ================ 文档管理 ================

      async uploadDocument(file: File): Promise<DatabaseDocument> {
        console.log("📤 [IR Store V2] Starting document upload:", file.name);

        try {
          set((state) => ({ ...state, isProcessing: true }));

          // 使用新的处理器处理文档并存储到索引服务
          const result: ProcessingResult =
            await processor.processFileAndIndex(file);

          console.log("✅ [IR Store V2] Document processed and indexed:", {
            fileName: result.document.fileName,
            chunksCount: result.chunks.length,
            termsCount: result.terms.length,
            postingsCount: result.postings.length,
          });

          // 更新最近文档列表
          const state = get();
          const newRecentIds = [
            result.document.id,
            ...state.recentDocumentIds.slice(0, 9),
          ];

          set({
            isProcessing: false,
            lastUpdated: Date.now(),
            recentDocumentIds: newRecentIds,
            cachedStats: undefined, // 清除缓存的统计信息
          });

          return {
            id: result.document.id,
            fileName: result.document.fileName,
            fileType: result.document.fileType,
            fileSize: result.document.size,
            title: result.document.title,
            language: result.document.language,
            uploadedAt: result.document.uploadedAt,
            processedAt: result.document.processedAt,
            status: result.document.status,
            error: result.document.error,
            totalTokens: result.document.totalTokens,
            chunkCount: result.document.chunkCount,
            termStats: result.document.termStats,
          };
        } catch (error) {
          console.error("❌ [IR Store V2] Document upload failed:", error);
          set((state) => ({ ...state, isProcessing: false }));
          throw error;
        }
      },

      async deleteDocument(documentId: string): Promise<void> {
        console.log("🗑️ [IR Store V2] Deleting document:", documentId);

        try {
          await indexService.deleteDocument(documentId);

          // 从最近文档列表中移除
          const state = get();
          const newRecentIds = state.recentDocumentIds.filter(
            (id) => id !== documentId,
          );

          set({
            lastUpdated: Date.now(),
            recentDocumentIds: newRecentIds,
            cachedStats: undefined, // 清除缓存的统计信息
          });

          console.log("✅ [IR Store V2] Document deleted successfully");
        } catch (error) {
          console.error("❌ [IR Store V2] Document deletion failed:", error);
          throw error;
        }
      },

      async getDocument(documentId: string): Promise<DatabaseDocument | null> {
        return await indexService.getDocument(documentId);
      },

      async getAllDocuments(): Promise<DatabaseDocument[]> {
        return await indexService.getAllDocuments();
      },

      // ================ 搜索功能 ================

      async searchDocuments(
        query: string,
        limit = 5,
      ): Promise<IRDocumentSearchResult[]> {
        console.log("🔍 [IR Store V2] Starting search:", query);

        const state = get();
        const options: SearchOptions = {
          topK: state.searchSettings.topKDocuments,
          topN: Math.min(state.searchSettings.topNChunks, limit),
          useHierarchicalSearch: state.searchSettings.useHierarchicalSearch,
          usePRF: state.searchSettings.usePRF,
          explain: state.searchSettings.explainScores,
          minScore: state.searchSettings.minScore,
        };

        try {
          const results: SearchResult[] = await searchEngine.search(
            query,
            options,
          );

          console.log("📊 [IR Store V2] Search completed:", {
            query,
            resultsFound: results.length,
            searchSettings: options,
          });

          // 转换为store格式
          return results.map((result) => ({
            document: result.document,
            chunk: result.chunk,
            score: result.score,
            explanation: result.explanation,
          }));
        } catch (error) {
          console.error("❌ [IR Store V2] Search failed:", error);
          return [];
        }
      },

      async getRelevantContext(
        query: string,
        maxTokens = 2000,
      ): Promise<string> {
        const results = await get().searchDocuments(query, 10);

        if (results.length === 0) {
          console.log("❌ [IR Store V2] No context found for query:", query);
          return "";
        }

        console.log(
          "📝 [IR Store V2] Building context from",
          results.length,
          "results",
        );

        let context = "";
        let tokenCount = 0;

        for (const result of results) {
          const chunkText = `[From: ${result.document.fileName}${
            result.chunk.page ? `, Page ${result.chunk.page}` : ""
          }]\n${result.chunk.content}\n\n`;
          const chunkTokens = result.chunk.tokenCount;

          if (tokenCount + chunkTokens <= maxTokens) {
            context += chunkText;
            tokenCount += chunkTokens;
          } else {
            break;
          }
        }

        console.log("✅ [IR Store V2] Context built:", {
          totalTokens: tokenCount,
          chunksUsed: context.split("[From:").length - 1,
        });

        return context.trim();
      },

      async getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
        try {
          return await searchEngine.getSearchSuggestions(query, limit);
        } catch (error) {
          console.error(
            "❌ [IR Store V2] Failed to get search suggestions:",
            error,
          );
          return [];
        }
      },

      // ================ 设置管理 ================

      updateSearchSettings(
        settings: Partial<IRDocumentStoreV2["searchSettings"]>,
      ): void {
        console.log("⚙️ [IR Store V2] Updating search settings:", settings);

        set((state) => ({
          ...state,
          searchSettings: { ...state.searchSettings, ...settings },
          lastUpdated: Date.now(),
        }));
      },

      updateBM25Parameters(params: any): void {
        console.log("⚙️ [IR Store V2] Updating BM25 parameters:", params);
        searchEngine.updateBM25Parameters(params);
      },

      getBM25Parameters(): any {
        return searchEngine.getBM25Parameters();
      },

      // ================ 统计和维护 ================

      async getDocumentStats() {
        const state = get();

        // 检查缓存是否有效（5分钟缓存）
        const now = Date.now();
        if (
          state.cachedStats &&
          now - state.cachedStats.lastCached < 5 * 60 * 1000
        ) {
          return {
            ...state.cachedStats,
            searchMethod: "ir-bm25-v2",
            isProcessing: state.isProcessing,
          };
        }

        try {
          // 从索引服务获取最新统计
          const indexStats = await indexService.getIndexStats();
          const documents = await indexService.getAllDocuments();

          const stats = {
            totalDocuments: indexStats?.totalDocuments || 0,
            totalChunks: indexStats?.totalChunks || 0,
            totalTerms: indexStats?.totalTerms || 0,
            uniqueTerms: indexStats?.uniqueTerms || 0,
            avgDocumentLength: indexStats?.avgDocumentLength || 0,
            avgChunkLength: indexStats?.avgChunkLength || 0,
            totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
            processingDocuments: documents.filter(
              (doc) => doc.status === "processing",
            ).length,
            errorDocuments: documents.filter((doc) => doc.status === "error")
              .length,
            searchMethod: "ir-bm25-v2",
            isProcessing: state.isProcessing,
            lastCached: now,
          };

          // 更新缓存
          set((state) => ({
            ...state,
            cachedStats: {
              totalDocuments: stats.totalDocuments,
              totalChunks: stats.totalChunks,
              totalTerms: stats.totalTerms,
              uniqueTerms: stats.uniqueTerms,
              avgDocumentLength: stats.avgDocumentLength,
              avgChunkLength: stats.avgChunkLength,
              lastCached: now,
            },
          }));

          return stats;
        } catch (error) {
          console.error(
            "❌ [IR Store V2] Failed to get document stats:",
            error,
          );

          // 返回基本统计信息
          return {
            totalDocuments: 0,
            totalChunks: 0,
            totalTerms: 0,
            uniqueTerms: 0,
            avgDocumentLength: 0,
            avgChunkLength: 0,
            totalSize: 0,
            processingDocuments: 0,
            errorDocuments: 0,
            searchMethod: "ir-bm25-v2",
            isProcessing: state.isProcessing,
          };
        }
      },

      async reindexDocuments(): Promise<void> {
        console.log("🔄 [IR Store V2] Starting reindex...");

        set((state) => ({ ...state, isProcessing: true }));

        try {
          await indexService.reindexAll();

          set({
            isProcessing: false,
            lastUpdated: Date.now(),
            cachedStats: undefined, // 清除缓存
          });

          console.log("✅ [IR Store V2] Reindex completed");
        } catch (error) {
          console.error("❌ [IR Store V2] Reindex failed:", error);
          set((state) => ({ ...state, isProcessing: false }));
          throw error;
        }
      },

      async clearAllDocuments(): Promise<void> {
        console.log("🧹 [IR Store V2] Clearing all documents...");

        try {
          // 删除所有文档（这会级联删除所有相关数据）
          const documents = await indexService.getAllDocuments();
          for (const doc of documents) {
            await indexService.deleteDocument(doc.id);
          }

          set({
            lastUpdated: Date.now(),
            recentDocumentIds: [],
            cachedStats: undefined,
          });

          console.log("✅ [IR Store V2] All documents cleared");
        } catch (error) {
          console.error("❌ [IR Store V2] Failed to clear documents:", error);
          throw error;
        }
      },

      async vacuum(): Promise<void> {
        console.log("🧹 [IR Store V2] Running vacuum...");

        try {
          await indexService.vacuum();
          set({ lastUpdated: Date.now() });
          console.log("✅ [IR Store V2] Vacuum completed");
        } catch (error) {
          console.error("❌ [IR Store V2] Vacuum failed:", error);
          throw error;
        }
      },

      async backup(): Promise<string> {
        console.log("💾 [IR Store V2] Creating backup...");

        try {
          const backup = await indexService.backup();
          console.log("✅ [IR Store V2] Backup created");
          return backup;
        } catch (error) {
          console.error("❌ [IR Store V2] Backup failed:", error);
          throw error;
        }
      },

      // ================ 调试和分析 ================

      async analyzeQuery(query: string): Promise<any> {
        const processor = IRDocumentProcessorV2.getInstance();
        const terms = processor.extractAndNormalizeTerms(query);

        try {
          const termData = await indexService.searchTerms(terms);
          const postings = await indexService.getPostingsForTerms(terms);

          return {
            originalQuery: query,
            normalizedTerms: terms,
            termStatistics: Object.fromEntries(termData),
            postingsCounts: Object.fromEntries(
              Array.from(postings.entries()).map(([term, postingsList]) => [
                term,
                postingsList.length,
              ]),
            ),
            estimatedResults: Array.from(postings.values()).reduce(
              (sum, list) => sum + list.length,
              0,
            ),
          };
        } catch (error) {
          console.error("❌ [IR Store V2] Query analysis failed:", error);
          return {
            originalQuery: query,
            normalizedTerms: terms,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      async getIndexStatistics(): Promise<any> {
        try {
          const indexStats = await indexService.getIndexStats();
          const memoryStats = indexService.getMemoryStats
            ? indexService.getMemoryStats()
            : null;

          return {
            indexStats,
            memoryStats,
            searchSettings: get().searchSettings,
            bm25Parameters: searchEngine.getBM25Parameters(),
          };
        } catch (error) {
          console.error(
            "❌ [IR Store V2] Failed to get index statistics:",
            error,
          );
          return {
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      async getTermDistribution(
        limit = 50,
      ): Promise<{ term: string; frequency: number }[]> {
        try {
          return await indexService.getTermDistribution();
        } catch (error) {
          console.error(
            "❌ [IR Store V2] Failed to get term distribution:",
            error,
          );
          return [];
        }
      },

      async getDocumentDistribution(): Promise<
        { docId: string; termCount: number }[]
      > {
        try {
          return await indexService.getDocumentDistribution();
        } catch (error) {
          console.error(
            "❌ [IR Store V2] Failed to get document distribution:",
            error,
          );
          return [];
        }
      },
    };
  },
  {
    name: StoreKey.Document + "-ir-v2" || "app-ir-document-v2",
    version: 3.0, // 新版本号
    migrate(persistedState, version) {
      const state = persistedState as any;

      // 确保所有必需字段存在
      if (typeof state.isProcessing !== "boolean") state.isProcessing = false;
      if (!state.lastUpdated) state.lastUpdated = 0;
      if (!Array.isArray(state.recentDocumentIds)) state.recentDocumentIds = [];

      // 添加新的搜索设置
      if (!state.searchSettings) {
        state.searchSettings = DEFAULT_IR_DOCUMENT_STATE_V2.searchSettings;
      } else {
        // 确保所有搜索设置字段存在
        const defaultSettings = DEFAULT_IR_DOCUMENT_STATE_V2.searchSettings;
        Object.keys(defaultSettings).forEach((key) => {
          if (!(key in state.searchSettings)) {
            state.searchSettings[key] =
              defaultSettings[key as keyof typeof defaultSettings];
          }
        });
      }

      // 清除旧的缓存数据
      if (state.cachedStats) {
        delete state.cachedStats;
      }

      return state;
    },
  },
);
