/**
 * BMF Search Service Client
 *
 * 提供与BMF搜索服务的REST API交互功能
 */

import { getBMFConfig } from "../config/bmf-search";

export interface BMFSearchRequest {
  query: string;
  limit?: number;
  include_snippets?: boolean;
}

export interface BMFSearchResult {
  id?: string;
  content: string;
  score?: number;
  metadata?: {
    source?: string;
    title?: string;
    [key: string]: any;
  };
  snippets?: string[];
}

export interface BMFSearchResponse {
  results: BMFSearchResult[];
  total?: number;
  query: string;
  took_ms?: number;
}

export class BMFSearchService {
  private static instance: BMFSearchService;
  private baseUrl: string;

  private constructor(baseUrl?: string) {
    const config = getBMFConfig();
    this.baseUrl = baseUrl || config.baseUrl;
  }

  public static getInstance(baseUrl?: string): BMFSearchService {
    if (!BMFSearchService.instance) {
      BMFSearchService.instance = new BMFSearchService(baseUrl);
    }
    return BMFSearchService.instance;
  }

  /**
   * 设置BMF搜索服务的基础URL
   */
  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * 执行搜索查询
   */
  public async search(request: BMFSearchRequest): Promise<BMFSearchResponse> {
    try {
      console.log("🔍 [BMF Search] Sending search request:", {
        baseUrl: this.baseUrl,
        query: request.query,
        limit: request.limit,
        include_snippets: request.include_snippets,
      });

      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: request.query,
          limit: request.limit || 5,
          include_snippets: request.include_snippets !== false,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `BMF search service error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      console.log("📊 [BMF Search] Search response:", {
        resultsCount: data.results?.length || 0,
        took: data.took_ms,
        query: data.query,
      });

      // 转换响应格式以匹配现有的搜索结果接口
      const bmfResponse: BMFSearchResponse = {
        results: (data.results || []).map((result: any) => ({
          id: result.id,
          content: result.content || result.text || "",
          score: result.score || result.similarity || 0,
          metadata: {
            source: result.source || result.filename || result.document,
            title: result.title,
            ...result.metadata,
          },
          snippets: result.snippets || [],
        })),
        total: data.total || data.results?.length || 0,
        query: data.query || request.query,
        took_ms: data.took_ms,
      };

      return bmfResponse;
    } catch (error) {
      console.error("❌ [BMF Search] Search failed:", error);
      throw new Error(
        `BMF search failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        timeout: 5000,
      } as RequestInit);

      return response.ok;
    } catch (error) {
      console.warn("⚠️ [BMF Search] Health check failed:", error);
      return false;
    }
  }

  /**
   * 获取服务信息
   */
  public async getServiceInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/info`, {
        method: "GET",
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn("⚠️ [BMF Search] Failed to get service info:", error);
      return null;
    }
  }
}

// 导出默认实例
export const bmfSearchService = BMFSearchService.getInstance();
