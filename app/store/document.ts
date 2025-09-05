import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import {
  BusinessDocument,
  DocumentChunk,
  DocumentProcessor,
} from "../utils/document-processor";

export interface DocumentSearchResult {
  chunk: DocumentChunk;
  score: number;
  document: BusinessDocument;
}

export interface DocumentStore {
  documents: Record<string, BusinessDocument>;
  searchIndex: Record<string, DocumentChunk>;
  isIndexing: boolean;
  lastUpdated: number;
  useTermBasedSearch?: boolean; // New flag to control search method
}

const DEFAULT_DOCUMENT_STATE: DocumentStore = {
  documents: {},
  searchIndex: {},
  isIndexing: false,
  lastUpdated: 0,
  useTermBasedSearch: true, // Default to term-based search
};

export const useDocumentStore = createPersistStore(
  DEFAULT_DOCUMENT_STATE,
  (set, get) => {
    // Define searchDocuments as a separate function to avoid circular reference
    const searchDocuments = async (
      query: string,
      limit = 5,
    ): Promise<DocumentSearchResult[]> => {
      const state = get();
      const processor = DocumentProcessor.getInstance();

      console.log(
        "🔍 [Search Debug] Starting search with method:",
        state.useTermBasedSearch ? "TERM-BASED" : "EMBEDDING-BASED",
      );
      console.log("🔍 [Search Debug] Query:", query);
      console.log(
        "🔍 [Search Debug] Search index size:",
        Object.keys(state.searchIndex).length,
      );

      if (Object.keys(state.searchIndex).length === 0) {
        console.log("❌ [Search Debug] No search index found");
        return [];
      }

      // Use term-based search if enabled
      if (state.useTermBasedSearch) {
        try {
          const results: DocumentSearchResult[] = [];
          console.log(
            "📊 [Term Search Debug] Calculating term-based similarities...",
          );

          for (const chunk of Object.values(state.searchIndex)) {
            const document = state.documents[chunk.metadata.source];

            if (!document) {
              console.log(
                "⚠️ [Term Search Debug] Chunk without document:",
                chunk.id,
              );
              continue;
            }

            // Calculate term-based similarity
            const score = processor.calculateTermSimilarity(
              query,
              chunk.content,
            );

            console.log("📊 [Term Search Debug] Term similarity:", {
              chunkId: chunk.id.substring(0, 8),
              score: score.toFixed(4),
              source: chunk.metadata.fileName,
              contentPreview: chunk.content.substring(0, 50) + "...",
            });

            if (score > 0) {
              results.push({ chunk, score, document });
            }
          }

          console.log("📊 [Term Search Debug] Term-based search stats:", {
            totalChunks: Object.keys(state.searchIndex).length,
            resultsWithScore: results.length,
          });

          // Sort by score and return top results
          const sortedResults = results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

          // Lower threshold for term-based (0.01 instead of 0.1)
          const finalResults = sortedResults.filter(
            (result) => result.score > 0.01,
          );

          console.log(
            "📊 [Term Search Debug] Final term-based results:",
            finalResults.map((r) => ({
              chunkId: r.chunk.id.substring(0, 8),
              score: r.score.toFixed(4),
              fileName: r.document.fileName,
            })),
          );

          return finalResults;
        } catch (error) {
          console.error(
            "❌ [Term Search Debug] Term-based search failed:",
            error,
          );
          return [];
        }
      }

      // Fall back to original embedding-based search
      console.log("🔍 [Search Debug] Using embedding-based search");

      try {
        // Generate embedding for the query
        console.log("🧠 [Search Debug] Generating query embedding...");
        const queryEmbedding = await processor.generateEmbedding(query);
        console.log(
          "🧠 [Search Debug] Query embedding generated:",
          queryEmbedding ? "SUCCESS" : "FAILED",
        );
        console.log(
          "🧠 [Search Debug] Query embedding length:",
          queryEmbedding ? queryEmbedding.length : 0,
        );

        if (!queryEmbedding) {
          console.log("❌ [Search Debug] Failed to generate query embedding");
          return [];
        }

        // Calculate similarity scores for all chunks
        const results: DocumentSearchResult[] = [];
        console.log("📊 [Search Debug] Calculating similarities...");

        let validChunks = 0;
        let chunksWithEmbeddings = 0;

        for (const chunk of Object.values(state.searchIndex)) {
          validChunks++;

          if (!chunk.embedding) {
            console.log("⚠️ [Search Debug] Chunk without embedding:", chunk.id);
            continue;
          }

          chunksWithEmbeddings++;
          const score = processor.cosineSimilarity(
            queryEmbedding,
            chunk.embedding,
          );
          const document = state.documents[chunk.metadata.source];

          console.log("📊 [Search Debug] Chunk similarity:", {
            chunkId: chunk.id,
            score: score,
            source: chunk.metadata.source,
            hasDocument: !!document,
          });

          if (document) {
            results.push({ chunk, score, document });
          }
        }

        console.log("📊 [Search Debug] Search stats:", {
          totalChunks: validChunks,
          chunksWithEmbeddings: chunksWithEmbeddings,
          results: results.length,
        });

        // Sort by score and return top results
        console.log(
          "📊 [Search Debug] Before filtering - all results:",
          results.map((r) => ({
            chunkId: r.chunk.id,
            score: r.score,
            isValidScore: !isNaN(r.score) && isFinite(r.score),
          })),
        );

        // Filter out invalid scores first
        const validResults = results.filter(
          (result) => !isNaN(result.score) && isFinite(result.score),
        );

        console.log(
          "📊 [Search Debug] Valid results after NaN filter:",
          validResults.length,
        );

        const sortedResults = validResults
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        console.log(
          "📊 [Search Debug] Top results before threshold:",
          sortedResults.map((r) => ({
            chunkId: r.chunk.id,
            score: r.score,
          })),
        );

        // Apply minimum similarity threshold (but allow lower threshold if no good matches)
        const thresholdResults = sortedResults.filter(
          (result) => result.score > 0.1,
        );

        // If no results meet threshold, return top 3 anyway (but lower the threshold)
        const finalResults =
          thresholdResults.length > 0
            ? thresholdResults
            : sortedResults.filter((result) => result.score > 0.05).slice(0, 3);

        console.log(
          "📊 [Search Debug] Final results:",
          finalResults.map((r) => ({
            chunkId: r.chunk.id,
            score: r.score,
          })),
        );

        return finalResults;
      } catch (error) {
        console.error("Document search failed:", error);
        return [];
      }
    };

    return {
      async uploadDocument(file: File): Promise<BusinessDocument> {
        const processor = DocumentProcessor.getInstance();

        try {
          set((state) => ({ ...state, isIndexing: true }));

          const document = await processor.processFile(file);

          // Skip embedding generation for term-based search
          const state = get();
          if (!state.useTermBasedSearch) {
            console.log(
              "📝 [Upload Debug] Generating embeddings for vector search...",
            );
            for (const chunk of document.chunks) {
              chunk.embedding = await processor.generateEmbedding(
                chunk.content,
              );
            }
          } else {
            console.log(
              "📝 [Upload Debug] Skipping embeddings for term-based search",
            );
          }

          const currentState = get();
          const newDocuments = { ...currentState.documents };
          const newSearchIndex = { ...currentState.searchIndex };

          newDocuments[document.id] = document;

          // Add chunks to search index
          for (const chunk of document.chunks) {
            newSearchIndex[chunk.id] = chunk;
          }

          set({
            documents: newDocuments,
            searchIndex: newSearchIndex,
            isIndexing: false,
            lastUpdated: Date.now(),
          });

          return document;
        } catch (error) {
          set((state) => ({ ...state, isIndexing: false }));
          throw error;
        }
      },

      deleteDocument(documentId: string): void {
        const state = get();
        const document = state.documents[documentId];

        if (!document) return;

        const newDocuments = { ...state.documents };
        const newSearchIndex = { ...state.searchIndex };

        delete newDocuments[documentId];

        // Remove chunks from search index
        for (const chunk of document.chunks) {
          delete newSearchIndex[chunk.id];
        }

        set({
          documents: newDocuments,
          searchIndex: newSearchIndex,
          lastUpdated: Date.now(),
        });
      },

      searchDocuments,

      async getRelevantContext(
        query: string,
        maxTokens = 2000,
      ): Promise<string> {
        const results = await searchDocuments(query, 10);

        if (results.length === 0) {
          return "";
        }

        let context = "";
        let tokenCount = 0;

        for (const result of results) {
          const chunkText = `[From: ${result.document.fileName}]\n${result.chunk.content}\n\n`;
          const chunkTokens = Math.ceil(chunkText.length / 4); // Rough token estimation

          if (tokenCount + chunkTokens <= maxTokens) {
            context += chunkText;
            tokenCount += chunkTokens;
          } else {
            break;
          }
        }

        return context.trim();
      },

      getDocument(documentId: string): BusinessDocument | undefined {
        return get().documents[documentId];
      },

      getAllDocuments(): BusinessDocument[] {
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
          searchMethod: state.useTermBasedSearch
            ? "term-based"
            : "embedding-based",
        };
      },

      // NEW: Toggle search method
      setSearchMethod(useTermBased: boolean): void {
        console.log(
          "🔧 [Search Method] Switching to:",
          useTermBased ? "term-based" : "embedding-based",
        );
        set((state) => ({ ...state, useTermBasedSearch: useTermBased }));
      },

      async reindexDocuments(): Promise<void> {
        const state = get();
        const processor = DocumentProcessor.getInstance();

        set((state) => ({ ...state, isIndexing: true }));

        try {
          const newSearchIndex: Record<string, DocumentChunk> = {};

          for (const document of Object.values(state.documents)) {
            for (const chunk of document.chunks) {
              // Only generate embeddings if not using term-based search
              if (!state.useTermBasedSearch && !chunk.embedding) {
                chunk.embedding = await processor.generateEmbedding(
                  chunk.content,
                );
              }
              newSearchIndex[chunk.id] = chunk;
            }
          }

          set({
            searchIndex: newSearchIndex,
            isIndexing: false,
            lastUpdated: Date.now(),
          });
        } catch (error) {
          console.error("Reindexing failed:", error);
          set((state) => ({ ...state, isIndexing: false }));
          throw error;
        }
      },

      clearAllDocuments(): void {
        set({
          documents: {},
          searchIndex: {},
          isIndexing: false,
          lastUpdated: Date.now(),
        });
      },
    };
  },
  {
    name: StoreKey.Document || "app-document",
    version: 1.1, // Bump version for new features
    migrate(persistedState, version) {
      const state = persistedState as any;

      // Ensure all required fields exist
      if (!state.documents) state.documents = {};
      if (!state.searchIndex) state.searchIndex = {};
      if (typeof state.isIndexing !== "boolean") state.isIndexing = false;
      if (!state.lastUpdated) state.lastUpdated = 0;
      if (typeof state.useTermBasedSearch !== "boolean")
        state.useTermBasedSearch = true;

      return state;
    },
  },
);
