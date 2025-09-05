import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import {
  IRBusinessDocument,
  IRDocumentChunk,
  IRDocumentProcessor,
  SearchResult,
} from "../utils/document-processor-ir";
import { IRSearchEngine } from "../utils/ir-search-engine";

export interface IRDocumentSearchResult {
  chunk: IRDocumentChunk;
  score: number;
  document: IRBusinessDocument;
  explanation?: {
    termScores: Map<string, number>;
    fieldBoosts: Map<string, number>;
    finalScore: number;
  };
}

export interface IRDocumentStore {
  documents: Record<string, IRBusinessDocument>;
  searchIndex: Record<string, IRDocumentChunk>;
  isIndexing: boolean;
  lastUpdated: number;

  // IR-specific settings
  searchSettings: {
    useHierarchicalSearch: boolean;
    usePRF: boolean; // Pseudo-relevance feedback
    topKDocuments: number; // Documents to retrieve in first stage
    topNChunks: number; // Chunks to retrieve in second stage
    explainScores: boolean; // Return scoring explanations
  };

  // Statistics
  indexStats?: {
    totalDocuments: number;
    totalChunks: number;
    totalTerms: number;
    avgDocumentLength: number;
    avgChunkLength: number;
  };
}

const DEFAULT_IR_DOCUMENT_STATE: IRDocumentStore = {
  documents: {},
  searchIndex: {},
  isIndexing: false,
  lastUpdated: 0,
  searchSettings: {
    useHierarchicalSearch: true,
    usePRF: false,
    topKDocuments: 10,
    topNChunks: 5,
    explainScores: false,
  },
};

export const useIRDocumentStore = createPersistStore(
  DEFAULT_IR_DOCUMENT_STATE,
  (set, get) => {
    // Initialize IR components
    const processor = IRDocumentProcessor.getInstance();
    const searchEngine = IRSearchEngine.getInstance();

    const searchDocuments = async (
      query: string,
      limit = 5,
    ): Promise<IRDocumentSearchResult[]> => {
      const state = get();

      console.log("🔍 [IR Store] Starting IR search for:", query);
      console.log("🔍 [IR Store] Settings:", state.searchSettings);
      console.log(
        "🔍 [IR Store] Index size:",
        Object.keys(state.searchIndex).length,
      );

      if (Object.keys(state.searchIndex).length === 0) {
        console.log("❌ [IR Store] No search index found");
        return [];
      }

      try {
        const searchOptions = {
          topK: state.searchSettings.topKDocuments,
          topN: Math.min(state.searchSettings.topNChunks, limit),
          usePRF: state.searchSettings.usePRF,
          explain: state.searchSettings.explainScores,
        };

        let results: SearchResult[];

        if (state.searchSettings.useHierarchicalSearch) {
          // Use hierarchical search (document -> chunk)
          console.log("🏗️ [IR Store] Using hierarchical search");
          results = await searchEngine.search(query, searchOptions);
        } else {
          // Fall back to direct chunk search
          console.log("📄 [IR Store] Using direct chunk search");
          results = await searchEngine.search(query, {
            ...searchOptions,
            topK: 0, // Skip document-level stage
          });
        }

        console.log("📊 [IR Store] IR search completed:", {
          query,
          resultsFound: results.length,
          averageScore:
            results.length > 0
              ? results.reduce((sum, r) => sum + r.score, 0) / results.length
              : 0,
        });

        // Convert to store format
        return results.map((result) => ({
          chunk: result.chunk,
          score: result.score,
          document: result.document,
          explanation: result.explanation,
        }));
      } catch (error) {
        console.error("❌ [IR Store] IR search failed:", error);
        return [];
      }
    };

    return {
      async uploadDocument(file: File): Promise<IRBusinessDocument> {
        try {
          set((state) => ({ ...state, isIndexing: true }));

          console.log(
            "📤 [IR Store] Processing document with IR pipeline:",
            file.name,
          );

          // Process document with IR-enhanced processor
          const document = await processor.processFile(file);

          console.log("📊 [IR Store] Document processed:", {
            fileName: document.fileName,
            totalTokens: document.totalTokens,
            chunksCount: document.chunks.length,
            termStats: document.termStats,
          });

          // Add to search engine indexes
          searchEngine.addDocument(document);

          // Update store
          const state = get();
          const newDocuments = { ...state.documents };
          const newSearchIndex = { ...state.searchIndex };

          newDocuments[document.id] = document;

          // Add chunks to search index (for compatibility with existing UI)
          for (const chunk of document.chunks) {
            newSearchIndex[chunk.id] = chunk;
          }

          // Calculate updated statistics
          const allDocuments = Object.values(newDocuments);
          const allChunks = Object.values(newSearchIndex);

          const indexStats = {
            totalDocuments: allDocuments.length,
            totalChunks: allChunks.length,
            totalTerms: allDocuments.reduce(
              (sum, doc) => sum + (doc.termStats?.totalTerms || 0),
              0,
            ),
            avgDocumentLength:
              allDocuments.reduce((sum, doc) => sum + doc.totalTokens, 0) /
              allDocuments.length,
            avgChunkLength:
              allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) /
              allChunks.length,
          };

          set({
            documents: newDocuments,
            searchIndex: newSearchIndex,
            isIndexing: false,
            lastUpdated: Date.now(),
            indexStats,
          });

          console.log("✅ [IR Store] Document uploaded and indexed:", {
            documentId: document.id,
            indexStats,
          });

          return document;
        } catch (error) {
          console.error("❌ [IR Store] Document upload failed:", error);
          set((state) => ({ ...state, isIndexing: false }));
          throw error;
        }
      },

      deleteDocument(documentId: string): void {
        const state = get();
        const document = state.documents[documentId];

        if (!document) {
          console.log(
            "⚠️ [IR Store] Document not found for deletion:",
            documentId,
          );
          return;
        }

        console.log("🗑️ [IR Store] Deleting document:", document.fileName);

        // Remove from search engine
        searchEngine.removeDocument(documentId);

        // Update store
        const newDocuments = { ...state.documents };
        const newSearchIndex = { ...state.searchIndex };

        delete newDocuments[documentId];

        // Remove chunks from search index
        for (const chunk of document.chunks) {
          delete newSearchIndex[chunk.id];
        }

        // Recalculate statistics
        const allDocuments = Object.values(newDocuments);
        const allChunks = Object.values(newSearchIndex);

        const indexStats = {
          totalDocuments: allDocuments.length,
          totalChunks: allChunks.length,
          totalTerms: allDocuments.reduce(
            (sum, doc) => sum + (doc.termStats?.totalTerms || 0),
            0,
          ),
          avgDocumentLength:
            allDocuments.length > 0
              ? allDocuments.reduce((sum, doc) => sum + doc.totalTokens, 0) /
                allDocuments.length
              : 0,
          avgChunkLength:
            allChunks.length > 0
              ? allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) /
                allChunks.length
              : 0,
        };

        set({
          documents: newDocuments,
          searchIndex: newSearchIndex,
          lastUpdated: Date.now(),
          indexStats,
        });

        console.log("✅ [IR Store] Document deleted");
      },

      searchDocuments,

      async getRelevantContext(
        query: string,
        maxTokens = 2000,
      ): Promise<string> {
        const results = await searchDocuments(query, 10);

        if (results.length === 0) {
          console.log("❌ [IR Store] No context found for query:", query);
          return "";
        }

        console.log(
          "📝 [IR Store] Building context from",
          results.length,
          "results",
        );

        let context = "";
        let tokenCount = 0;

        for (const result of results) {
          const chunkText = `[From: ${result.document.fileName}${
            result.chunk.metadata.page
              ? `, Page ${result.chunk.metadata.page}`
              : ""
          }]\n${result.chunk.content}\n\n`;
          const chunkTokens = result.chunk.tokenCount;

          if (tokenCount + chunkTokens <= maxTokens) {
            context += chunkText;
            tokenCount += chunkTokens;
          } else {
            break;
          }
        }

        console.log("✅ [IR Store] Context built:", {
          totalTokens: tokenCount,
          chunksUsed: context.split("[From:").length - 1,
        });

        return context.trim();
      },

      // Search settings management
      updateSearchSettings(
        settings: Partial<IRDocumentStore["searchSettings"]>,
      ): void {
        console.log("⚙️ [IR Store] Updating search settings:", settings);

        set((state) => ({
          ...state,
          searchSettings: { ...state.searchSettings, ...settings },
        }));
      },

      getDocument(documentId: string): IRBusinessDocument | undefined {
        return get().documents[documentId];
      },

      getAllDocuments(): IRBusinessDocument[] {
        return Object.values(get().documents).sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
        );
      },

      getDocumentStats() {
        const state = get();
        const documents = Object.values(state.documents);

        return {
          totalDocuments: documents.length,
          totalChunks: Object.keys(state.searchIndex).length,
          totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
          processingDocuments: documents.filter(
            (doc) => doc.status === "processing",
          ).length,
          errorDocuments: documents.filter((doc) => doc.status === "error")
            .length,
          searchMethod: "ir-bm25",
          indexStats: state.indexStats,
        };
      },

      async reindexDocuments(): Promise<void> {
        const state = get();

        set((state) => ({ ...state, isIndexing: true }));

        try {
          console.log("🔄 [IR Store] Reindexing all documents...");

          // Clear search engine
          searchEngine.clearIndexes();

          // Re-add all documents
          for (const document of Object.values(state.documents)) {
            searchEngine.addDocument(document);
          }

          console.log("✅ [IR Store] Reindexing completed");

          set((state) => ({
            ...state,
            isIndexing: false,
            lastUpdated: Date.now(),
          }));
        } catch (error) {
          console.error("❌ [IR Store] Reindexing failed:", error);
          set((state) => ({ ...state, isIndexing: false }));
          throw error;
        }
      },

      clearAllDocuments(): void {
        console.log("🧹 [IR Store] Clearing all documents");

        searchEngine.clearIndexes();

        set({
          documents: {},
          searchIndex: {},
          isIndexing: false,
          lastUpdated: Date.now(),
          indexStats: {
            totalDocuments: 0,
            totalChunks: 0,
            totalTerms: 0,
            avgDocumentLength: 0,
            avgChunkLength: 0,
          },
        });
      },

      // Debug and analysis methods
      analyzeQuery(query: string): any {
        // Return query analysis for debugging
        return {
          originalQuery: query,
          normalizedTerms: [], // TODO: expose from search engine
          expandedTerms: [],
          estimatedResults: 0,
        };
      },

      getIndexStatistics(): any {
        const state = get();
        return {
          storeStats: state.indexStats,
          searchSettings: state.searchSettings,
          // TODO: Add search engine internal stats
        };
      },
    };
  },
  {
    name: StoreKey.Document || "app-ir-document",
    version: 2.0, // New version for IR system
    migrate(persistedState, version) {
      const state = persistedState as any;

      // Ensure all required fields exist
      if (!state.documents) state.documents = {};
      if (!state.searchIndex) state.searchIndex = {};
      if (typeof state.isIndexing !== "boolean") state.isIndexing = false;
      if (!state.lastUpdated) state.lastUpdated = 0;

      // Add new IR-specific fields
      if (!state.searchSettings) {
        state.searchSettings = DEFAULT_IR_DOCUMENT_STATE.searchSettings;
      }

      if (!state.indexStats) {
        state.indexStats = {
          totalDocuments: 0,
          totalChunks: 0,
          totalTerms: 0,
          avgDocumentLength: 0,
          avgChunkLength: 0,
        };
      }

      return state;
    },
  },
);
