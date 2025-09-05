import { Plugin } from "../store/plugin";
import { useIRDocumentStore } from "../store/document-ir";

export const DOCUMENT_RAG_PLUGIN_ID = "ir-document-rag-search";

export function createIRDocumentRAGPlugin(): Plugin {
  const openAPISpec = {
    openapi: "3.0.0",
    info: {
      title: "IR Business Document RAG Search",
      version: "2.0.0",
      description:
        "Advanced information retrieval search with BM25 scoring and hierarchical search for business documents",
    },
    servers: [
      {
        url: "/api/ir-document-search",
      },
    ],
    paths: {
      "/search": {
        post: {
          operationId: "searchBusinessDocumentsIR",
          summary: "Search business documents using IR techniques",
          description:
            "Performs hierarchical search with BM25 scoring across uploaded business documents",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description:
                        "The search query to find relevant document content",
                    },
                    limit: {
                      type: "integer",
                      description: "Maximum number of results to return",
                      default: 5,
                    },
                    useHierarchicalSearch: {
                      type: "boolean",
                      description: "Use hierarchical search (document->chunk)",
                      default: true,
                    },
                    usePRF: {
                      type: "boolean",
                      description: "Use pseudo-relevance feedback",
                      default: false,
                    },
                    explainScores: {
                      type: "boolean",
                      description: "Return detailed scoring explanation",
                      default: false,
                    },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "IR search results with BM25 scores",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            content: {
                              type: "string",
                              description:
                                "The relevant document chunk content",
                            },
                            source: {
                              type: "string",
                              description: "The source document name",
                            },
                            score: {
                              type: "number",
                              description: "BM25 similarity score",
                            },
                            explanation: {
                              type: "object",
                              description: "Detailed scoring explanation",
                            },
                          },
                        },
                      },
                      context: {
                        type: "string",
                        description:
                          "Combined context from all relevant documents",
                      },
                      searchStats: {
                        type: "object",
                        description:
                          "Search statistics and performance metrics",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return {
    id: DOCUMENT_RAG_PLUGIN_ID,
    title: "IR Business Document RAG Search",
    version: "2.0.0",
    content: JSON.stringify(openAPISpec, null, 2),
    builtin: true,
    createdAt: Date.now(),
  };
}

// Function to automatically enhance user messages with IR document context
export async function enhanceMessageWithIRDocuments(
  userMessage: string,
  maxContextTokens = 2000,
): Promise<{
  enhancedMessage: string;
  hasContext: boolean;
  sources: string[];
}> {
  try {
    console.log(
      "📝 [IR Enhance Debug] Starting IR enhancement for:",
      userMessage,
    );

    const documentStore = useIRDocumentStore.getState();
    console.log("📚 [IR Enhance Debug] IR document store state:", {
      documentsCount: Object.keys(documentStore.documents).length,
      searchIndexCount: Object.keys(documentStore.searchIndex).length,
      isIndexing: documentStore.isIndexing,
      searchSettings: documentStore.searchSettings,
    });

    // Use IR search with current settings
    console.log("🔍 [IR Enhance Debug] Performing IR search...");
    const searchResults = await documentStore.searchDocuments(userMessage, 8);
    console.log(
      "📊 [IR Enhance Debug] IR search results:",
      searchResults.length,
      "results found",
    );

    if (searchResults.length > 0) {
      console.log("📄 [IR Enhance Debug] Top IR result:", {
        score: searchResults[0].score.toFixed(4),
        source: searchResults[0].document.fileName,
        contentPreview:
          searchResults[0].chunk.content.substring(0, 100) + "...",
        tokenCount: searchResults[0].chunk.tokenCount,
        isTitle: searchResults[0].chunk.metadata.isTitle,
        isTableHeader: searchResults[0].chunk.metadata.isTableHeader,
      });
    }

    // Get relevant context using IR method
    console.log("🎯 [IR Enhance Debug] Getting relevant context...");
    const context = await documentStore.getRelevantContext(
      userMessage,
      maxContextTokens,
    );
    console.log(
      "📝 [IR Enhance Debug] Context length:",
      context ? context.length : 0,
    );
    console.log(
      "📝 [IR Enhance Debug] Context preview:",
      context ? context.substring(0, 200) + "..." : "NO CONTEXT",
    );

    if (!context) {
      console.log(
        "❌ [IR Enhance Debug] No context found, returning original message",
      );
      return {
        enhancedMessage: userMessage,
        hasContext: false,
        sources: [],
      };
    }

    // Get source documents
    const sources = [...new Set(searchResults.map((r) => r.document.fileName))];
    console.log("📂 [IR Enhance Debug] Sources:", sources);

    // Enhanced prompt format for IR context
    const enhancedMessage = `你是一个专业的业务助手，我会为你提供通过先进的信息检索技术（BM25评分）找到的相关业务文档内容来帮助回答用户的问题。

以下是通过语义搜索找到的相关文档内容：
${context}

用户问题：${userMessage}

请根据上述文档内容回答用户的问题。回答时请：
1. 直接引用文档中的具体信息和数据
2. 明确指出信息来源的文档名称
3. 如果文档内容不足以完全回答问题，请如实说明并提供能找到的相关信息
4. 保持回答的准确性和专业性

回答要自然流畅、结构清晰且有帮助。`;

    console.log("✅ [IR Enhance Debug] IR enhancement successful!");
    console.log("📊 [IR Enhance Debug] Enhancement stats:", {
      originalMessageLength: userMessage.length,
      enhancedMessageLength: enhancedMessage.length,
      contextLength: context.length,
      sourcesCount: sources.length,
      searchResultsUsed: searchResults.length,
    });

    return {
      enhancedMessage,
      hasContext: true,
      sources,
    };
  } catch (error) {
    console.error(
      "❌ [IR Enhance Debug] Failed to enhance message with IR documents:",
      error,
    );
    return {
      enhancedMessage: userMessage,
      hasContext: false,
      sources: [],
    };
  }
}

// Hook to check if IR document RAG should be used
export function shouldUseIRDocumentRAG(message: string): boolean {
  console.log("🔍 [IR RAG Debug] =================");
  console.log("🔍 [IR RAG Debug] Checking message:", message);

  // Enhanced heuristics for IR system
  const businessKeywords = [
    // English keywords
    "company",
    "business",
    "policy",
    "procedure",
    "process",
    "guideline",
    "requirement",
    "specification",
    "documentation",
    "manual",
    "handbook",
    "terms",
    "conditions",
    "contract",
    "agreement",
    "standard",
    "workflow",
    "protocol",
    "rule",
    "regulation",
    "compliance",
    "audit",
    "report",
    // Chinese keywords
    "公司",
    "企业",
    "业务",
    "政策",
    "程序",
    "流程",
    "指南",
    "指导",
    "要求",
    "规范",
    "文档",
    "手册",
    "条款",
    "条件",
    "合同",
    "协议",
    "标准",
    "工作流",
    "协议",
    "规则",
    "规定",
    "合规",
    "审计",
    "报告",
    "产品",
    "服务",
    "制作",
    "生产",
    "标准",
    "质量",
    "管理",
    "操作",
    "配方",
    "成分",
    "工艺",
    "技术",
    "方法",
    "步骤",
    "要求",
    "检测",
  ];

  const questionWords = [
    // English question words
    "what",
    "how",
    "when",
    "where",
    "why",
    "who",
    "which",
    "can",
    "should",
    "would",
    "could",
    "is",
    "are",
    "does",
    "do",
    "tell",
    "explain",
    "describe",
    // Chinese question words
    "什么",
    "怎么",
    "如何",
    "哪里",
    "为什么",
    "谁",
    "哪个",
    "能",
    "应该",
    "会",
    "可以",
    "告诉",
    "解释",
    "描述",
    "介绍",
    "说明",
    "是什么",
    "怎样",
    "多少",
    "几个",
    "哪些",
    "包括",
    "含有",
    "需要",
  ];

  const lowerMessage = message.toLowerCase();
  console.log("🔤 [IR RAG Debug] Lowercase message:", lowerMessage);

  const hasBusinessKeyword = businessKeywords.some((keyword) =>
    lowerMessage.includes(keyword),
  );

  const hasQuestionWord = questionWords.some((word) =>
    lowerMessage.includes(word),
  );

  // Check if there are uploaded documents in IR store
  const documentStore = useIRDocumentStore.getState();
  const hasDocuments = Object.keys(documentStore.documents).length > 0;
  const documentCount = Object.keys(documentStore.documents).length;
  const documentNames = Object.keys(documentStore.documents);

  console.log("📊 [IR RAG Debug] Has documents:", hasDocuments);
  console.log("📄 [IR RAG Debug] Document count:", documentCount);
  console.log("🗂️ [IR RAG Debug] Document names:", documentNames);
  console.log("🔑 [IR RAG Debug] Has business keyword:", hasBusinessKeyword);
  console.log("❓ [IR RAG Debug] Has question word:", hasQuestionWord);
  console.log(
    "⚙️ [IR RAG Debug] Search settings:",
    documentStore.searchSettings,
  );

  // Find which keywords matched
  const matchedBusinessKeywords = businessKeywords.filter((keyword) =>
    lowerMessage.includes(keyword),
  );
  const matchedQuestionWords = questionWords.filter((word) =>
    lowerMessage.includes(word),
  );

  console.log(
    "✅ [IR RAG Debug] Matched business keywords:",
    matchedBusinessKeywords,
  );
  console.log(
    "✅ [IR RAG Debug] Matched question words:",
    matchedQuestionWords,
  );

  // IR-enhanced logic: more lenient triggering for better recall
  const isLongQuery = message.trim().length > 8; // Slightly lower threshold
  const isQuestionLike =
    hasQuestionWord || message.includes("?") || message.includes("？");
  const isBusinessRelated =
    hasBusinessKeyword || matchedBusinessKeywords.length > 0;

  // Trigger if we have documents and any of:
  // 1. Business-related content
  // 2. Question-like queries
  // 3. Long enough queries (likely informational)
  const shouldUse =
    hasDocuments && (isBusinessRelated || isQuestionLike || isLongQuery);

  console.log("📏 [IR RAG Debug] Is long query (>8 chars):", isLongQuery);
  console.log("❓ [IR RAG Debug] Is question-like:", isQuestionLike);
  console.log("💼 [IR RAG Debug] Is business-related:", isBusinessRelated);
  console.log(
    "🎯 [IR RAG Debug] Final decision - Should use IR RAG:",
    shouldUse,
  );
  console.log("🔍 [IR RAG Debug] =================");

  return shouldUse;
}
