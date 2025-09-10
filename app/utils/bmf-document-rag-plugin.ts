/**
 * BMF Document RAG Plugin
 *
 * 使用BMF搜索服务来增强用户消息的插件
 */

import { Plugin } from "../store/plugin";
import { bmfSearchService } from "../services/bmf-search-service";
import { getBMFConfig } from "../config/bmf-search";

export function createBMFDocumentRAGPlugin(): Plugin {
  const bmfPlugin = {
    id: "bmf-document-rag",
    createdAt: Date.now(),
    title: "BMF Document Search",
    version: "1.0.0",
    content: `
openapi: 3.0.1
info:
  title: BMF Document Search Plugin
  description: Plugin for searching documents using BMF search service
  version: 1.0.0
servers:
  - url: /api/bmf
paths:
  /search:
    post:
      operationId: searchDocuments
      summary: Search for relevant documents
      description: Search documents using BMF search service
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - query
              properties:
                query:
                  type: string
                  description: The search query
                limit:
                  type: integer
                  description: Maximum number of results to return
                  default: 5
                include_snippets:
                  type: boolean
                  description: Whether to include snippets in results
                  default: true
      responses:
        '200':
          description: Search results
          content:
            application/json:
              schema:
                type: object
                properties:
                  results:
                    type: array
                    items:
                      type: object
                      properties:
                        content:
                          type: string
                        score:
                          type: number
                        metadata:
                          type: object
                        snippets:
                          type: array
                          items:
                            type: string
`,
    builtin: true,
  };

  return bmfPlugin;
}

/**
 * 使用BMF搜索服务增强用户消息
 */
export async function enhanceMessageWithBMFDocuments(
  userMessage: string,
  maxContextTokens?: number,
): Promise<{
  enhancedMessage: string;
  hasContext: boolean;
  sources: string[];
}> {
  try {
    const config = getBMFConfig();

    // 检查是否启用BMF搜索
    if (!config.enabled) {
      console.log("ℹ️ [BMF Enhance Debug] BMF search is disabled");
      return {
        enhancedMessage: userMessage,
        hasContext: false,
        sources: [],
      };
    }

    console.log(
      "📝 [BMF Enhance Debug] Starting BMF enhancement for:",
      userMessage,
    );

    // 健康检查BMF服务
    const isHealthy = await bmfSearchService.healthCheck();
    if (!isHealthy) {
      console.warn(
        "⚠️ [BMF Enhance Debug] BMF service is not available, skipping enhancement",
      );
      return {
        enhancedMessage: userMessage,
        hasContext: false,
        sources: [],
      };
    }

    // 执行BMF搜索
    console.log("🔍 [BMF Enhance Debug] Performing BMF search...");
    const searchResponse = await bmfSearchService.search({
      query: userMessage,
      limit: config.searchLimit,
      include_snippets: config.includeSnippets,
    });

    console.log("📊 [BMF Enhance Debug] BMF search results:", {
      resultsCount: searchResponse.results.length,
      took: searchResponse.took_ms,
      query: searchResponse.query,
    });

    if (searchResponse.results.length === 0) {
      console.log("❌ [BMF Enhance Debug] No search results found");
      return {
        enhancedMessage: userMessage,
        hasContext: false,
        sources: [],
      };
    }

    // 显示第一个结果的详细信息
    if (searchResponse.results.length > 0) {
      const topResult = searchResponse.results[0];
      console.log("📄 [BMF Enhance Debug] Top BMF result:", {
        score: topResult.score?.toFixed(4),
        source: topResult.metadata?.source || "Unknown",
        contentPreview: topResult.content.substring(0, 100) + "...",
        snippetsCount: topResult.snippets?.length || 0,
      });
    }

    // 构建上下文
    const maxTokens = maxContextTokens || config.maxContextTokens;
    let contextTokens = 0;
    const contextParts: string[] = [];
    const sources: Set<string> = new Set();

    for (const result of searchResponse.results) {
      const content = result.content;
      const estimatedTokens = content.length / 4; // 粗略估算token数量

      if (contextTokens + estimatedTokens > maxTokens) {
        break;
      }

      // 添加来源信息
      const source =
        result.metadata?.source || result.metadata?.title || "Unknown Document";
      sources.add(source);

      // 格式化内容
      let formattedContent = content;
      if (result.snippets && result.snippets.length > 0) {
        // 如果有片段，优先使用片段
        formattedContent = result.snippets.join("\n...\n");
      }

      contextParts.push(`**来源: ${source}**\n${formattedContent}`);
      contextTokens += estimatedTokens;
    }

    if (contextParts.length === 0) {
      console.log("❌ [BMF Enhance Debug] No valid context found");
      return {
        enhancedMessage: userMessage,
        hasContext: false,
        sources: [],
      };
    }

    const context = contextParts.join("\n\n---\n\n");
    const sourcesList = Array.from(sources);

    console.log("📝 [BMF Enhance Debug] Context built:", {
      contextLength: context.length,
      sourcesCount: sourcesList.length,
      resultsUsed: contextParts.length,
    });

    // 构建增强消息
    const enhancedMessage = `你是一个专业餐饮公司内部业务助手，我会为你提供通过BMF搜索服务找到的相关业务文档内容来帮助回答公司内部用户的问题。

以下是通过BMF搜索找到的相关文档内容：
${context}

用户问题：${userMessage}

请根据上述文档内容回答用户的问题。回答时请：
1. 直接引用文档中的具体信息和数据
2. 明确指出信息来源的文档名称  
3. 如果文档内容不足以完全回答问题，请如实说明并提供能找到的相关信息
4. 保持回答的准确性和专业性
5. **结构化输出**：使用以下标准结构，不输出思维过程：
   - 摘要（一句话回答结论/可否/是否满足）  
   - 依据与要点（1-3 条关键事实，逐条**引用来源**）  
   - 操作/执行步骤（编号清晰，适配对应角色）  
   - 注意事项与风险（如适用）  
   - 参考来源（精确到文档名与可用的片段标识/页码/章节）

回答要自然流畅、结构清晰且有帮助。`;

    console.log("✅ [BMF Enhance Debug] BMF enhancement successful!");
    console.log("📊 [BMF Enhance Debug] Enhancement stats:", {
      originalMessageLength: userMessage.length,
      enhancedMessageLength: enhancedMessage.length,
      contextLength: context.length,
      sourcesCount: sourcesList.length,
      searchResultsUsed: searchResponse.results.length,
    });

    return {
      enhancedMessage,
      hasContext: true,
      sources: sourcesList,
    };
  } catch (error) {
    console.error(
      "❌ [BMF Enhance Debug] Failed to enhance message with BMF documents:",
      error,
    );
    return {
      enhancedMessage: userMessage,
      hasContext: false,
      sources: [],
    };
  }
}

/**
 * 检查是否应该使用BMF文档RAG
 */
export function shouldUseBMFDocumentRAG(message: string): boolean {
  const config = getBMFConfig();

  if (!config.enabled) {
    return false;
  }

  console.log(
    "🔍 [BMF RAG Debug] Checking if BMF RAG should be used for message:",
    message,
  );

  // 修改为默认都触发 RAG（除了命令和空消息）
  const shouldUse =
    message.trim().length > 0 &&
    !message.startsWith("/") &&
    !message.startsWith("!");

  console.log(
    "🎯 [BMF RAG Debug] Should use BMF RAG:",
    shouldUse,
    "for message:",
    message,
  );
  return shouldUse;
}
