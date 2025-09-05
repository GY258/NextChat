import { Plugin } from "../store/plugin";
import { useDocumentStore } from "../store/document";

export const DOCUMENT_RAG_PLUGIN_ID = "document-rag-search";

export function createDocumentRAGPlugin(): Plugin {
  const openAPISpec = {
    openapi: "3.0.0",
    info: {
      title: "Business Document RAG Search",
      version: "1.0.0",
      description:
        "Search and retrieve relevant information from uploaded business documents",
    },
    servers: [
      {
        url: "/api/document-search",
      },
    ],
    paths: {
      "/search": {
        post: {
          operationId: "searchBusinessDocuments",
          summary: "Search business documents for relevant information",
          description:
            "Performs semantic search across uploaded business documents to find relevant context for user queries",
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
                    minScore: {
                      type: "number",
                      description: "Minimum similarity score for results",
                      default: 0.1,
                    },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Search results",
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
                              description: "The relevant document content",
                            },
                            source: {
                              type: "string",
                              description: "The source document name",
                            },
                            score: {
                              type: "number",
                              description: "Similarity score",
                            },
                          },
                        },
                      },
                      context: {
                        type: "string",
                        description:
                          "Combined context from all relevant documents",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/context": {
        post: {
          operationId: "getDocumentContext",
          summary: "Get relevant document context for a query",
          description:
            "Returns formatted document context that can be used to enhance AI responses",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "The query to get context for",
                    },
                    maxTokens: {
                      type: "integer",
                      description: "Maximum tokens for context",
                      default: 2000,
                    },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Document context",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      context: {
                        type: "string",
                        description: "Formatted document context",
                      },
                      sources: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                        description: "List of source documents used",
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
    title: "Business Document RAG Search",
    version: "1.0.0",
    content: JSON.stringify(openAPISpec, null, 2),
    builtin: true,
    createdAt: Date.now(),
  };
}

// Function to automatically enhance user messages with document context
export async function enhanceMessageWithDocuments(
  userMessage: string,
  maxContextTokens = 2000,
): Promise<{
  enhancedMessage: string;
  hasContext: boolean;
  sources: string[];
}> {
  try {
    console.log("📝 [Enhance Debug] Starting enhancement for:", userMessage);

    const documentStore = useDocumentStore.getState();
    console.log("📚 [Enhance Debug] Document store state:", {
      documentsCount: Object.keys(documentStore.documents).length,
      searchIndexCount: Object.keys(documentStore.searchIndex).length,
      isIndexing: documentStore.isIndexing,
    });

    // First try to search for documents
    console.log("🔍 [Enhance Debug] Searching documents...");
    const searchResults = await documentStore.searchDocuments(userMessage, 5);
    console.log(
      "📊 [Enhance Debug] Search results:",
      searchResults.length,
      "results found",
    );

    if (searchResults.length > 0) {
      console.log("📄 [Enhance Debug] First result:", {
        score: searchResults[0].score,
        source: searchResults[0].document.fileName,
        contentPreview:
          searchResults[0].chunk.content.substring(0, 100) + "...",
      });
    }

    console.log("🎯 [Enhance Debug] Getting relevant context...");
    const context = await documentStore.getRelevantContext(
      userMessage,
      maxContextTokens,
    );
    console.log(
      "📝 [Enhance Debug] Context length:",
      context ? context.length : 0,
    );
    console.log(
      "📝 [Enhance Debug] Context preview:",
      context ? context.substring(0, 200) + "..." : "NO CONTEXT",
    );

    if (!context) {
      console.log(
        "❌ [Enhance Debug] No context found, returning original message",
      );
      return {
        enhancedMessage: userMessage,
        hasContext: false,
        sources: [],
      };
    }

    // Get source documents
    const sources = [...new Set(searchResults.map((r) => r.document.fileName))];
    console.log("📂 [Enhance Debug] Sources:", sources);

    // Improved prompt format for more natural responses
    const enhancedMessage = `你是一个专业的助手，我会为你提供一些相关的业务文档内容来帮助回答用户的问题。请基于这些文档内容给出准确、有用的回答。

参考文档内容：
${context}

用户问题：${userMessage}

请根据上述文档内容回答用户的问题。如果文档中包含相关信息，请直接引用并说明；如果文档内容不足以回答问题，请如实说明并尽力提供有用的建议。回答要自然、准确且有帮助。`;

    console.log("✅ [Enhance Debug] Enhancement successful!");
    return {
      enhancedMessage,
      hasContext: true,
      sources,
    };
  } catch (error) {
    console.error(
      "❌ [Enhance Debug] Failed to enhance message with documents:",
      error,
    );
    return {
      enhancedMessage: userMessage,
      hasContext: false,
      sources: [],
    };
  }
}

// Hook to check if document RAG should be used
export function shouldUseDocumentRAG(message: string): boolean {
  console.log("🔍 [RAG Debug] =================");
  console.log("🔍 [RAG Debug] Checking message:", message);

  // Simple heuristics to determine if document search would be helpful
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
  ];

  const lowerMessage = message.toLowerCase();
  console.log("🔤 [RAG Debug] Lowercase message:", lowerMessage);

  const hasBusinessKeyword = businessKeywords.some((keyword) =>
    lowerMessage.includes(keyword),
  );

  const hasQuestionWord = questionWords.some((word) =>
    lowerMessage.includes(word),
  );

  // Also check if there are uploaded documents
  const documentStore = useDocumentStore.getState();
  const hasDocuments = Object.keys(documentStore.documents).length > 0;
  const documentCount = Object.keys(documentStore.documents).length;
  const documentNames = Object.keys(documentStore.documents);

  console.log("📊 [RAG Debug] Has documents:", hasDocuments);
  console.log("📄 [RAG Debug] Document count:", documentCount);
  console.log("🗂️ [RAG Debug] Document names:", documentNames);
  console.log("🔑 [RAG Debug] Has business keyword:", hasBusinessKeyword);
  console.log("❓ [RAG Debug] Has question word:", hasQuestionWord);

  // Find which keywords matched
  const matchedBusinessKeywords = businessKeywords.filter((keyword) =>
    lowerMessage.includes(keyword),
  );
  const matchedQuestionWords = questionWords.filter((word) =>
    lowerMessage.includes(word),
  );

  console.log(
    "✅ [RAG Debug] Matched business keywords:",
    matchedBusinessKeywords,
  );
  console.log("✅ [RAG Debug] Matched question words:", matchedQuestionWords);

  // More lenient logic: if we have documents, and it's either:
  // 1. A business/product question, OR
  // 2. Any question word, OR
  // 3. The message is long enough to be a meaningful query (>10 chars)
  const isLongQuery = message.trim().length > 10;
  const shouldUse =
    hasDocuments && (hasBusinessKeyword || hasQuestionWord || isLongQuery);

  console.log("📏 [RAG Debug] Is long query (>10 chars):", isLongQuery);
  console.log("🎯 [RAG Debug] Final decision - Should use RAG:", shouldUse);
  console.log("🔍 [RAG Debug] =================");

  return shouldUse;
}
