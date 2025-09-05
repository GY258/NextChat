/**
 * IR服务管理器 - 统一管理IR索引服务的启动、停止和配置
 */

import {
  getIRIndexService,
  setIRIndexService,
  IRIndexServiceInterface,
  MemoryIRIndexService,
} from "./ir-index-service";

export interface IRServiceConfig {
  // 基础配置
  serviceType: "memory" | "database" | "redis";
  autoStart: boolean;
  enableLogging: boolean;

  // 内存配置
  memoryConfig?: {
    maxDocuments: number;
    maxMemoryMB: number;
    enableCompression: boolean;
  };

  // 数据库配置（预留）
  databaseConfig?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    connectionPool: number;
  };

  // Redis配置（预留）
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
    keyPrefix: string;
  };
}

const DEFAULT_CONFIG: IRServiceConfig = {
  serviceType: "memory",
  autoStart: true,
  enableLogging: true,
  memoryConfig: {
    maxDocuments: 1000,
    maxMemoryMB: 512,
    enableCompression: false,
  },
};

export class IRServiceManager {
  private static instance: IRServiceManager;
  private config: IRServiceConfig;
  private isStarted: boolean = false;
  private startTime: number = 0;

  static getInstance(): IRServiceManager {
    if (!IRServiceManager.instance) {
      IRServiceManager.instance = new IRServiceManager();
    }
    return IRServiceManager.instance;
  }

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 启动IR索引服务
   */
  async start(config?: Partial<IRServiceConfig>): Promise<void> {
    if (this.isStarted) {
      console.log("🔄 [IR Service Manager] Service is already started");
      return;
    }

    console.log("🚀 [IR Service Manager] Starting IR Index Service...");
    this.startTime = Date.now();

    // 合并配置
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // 根据配置类型创建服务实例
      let serviceInstance: IRIndexServiceInterface;

      switch (this.config.serviceType) {
        case "memory":
          serviceInstance = await this.createMemoryService();
          break;
        case "database":
          serviceInstance = await this.createDatabaseService();
          break;
        case "redis":
          serviceInstance = await this.createRedisService();
          break;
        default:
          throw new Error(
            `Unsupported service type: ${this.config.serviceType}`,
          );
      }

      // 设置服务实例
      setIRIndexService(serviceInstance);

      // 执行启动后检查
      await this.performHealthCheck();

      this.isStarted = true;
      const startupTime = Date.now() - this.startTime;

      console.log("✅ [IR Service Manager] Service started successfully");
      console.log(`⏱️ [IR Service Manager] Startup time: ${startupTime}ms`);
      console.log("⚙️ [IR Service Manager] Configuration:", this.config);
    } catch (error) {
      console.error("❌ [IR Service Manager] Failed to start service:", error);
      this.isStarted = false;
      throw error;
    }
  }

  /**
   * 停止IR索引服务
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      console.log("⚠️ [IR Service Manager] Service is not started");
      return;
    }

    console.log("🛑 [IR Service Manager] Stopping IR Index Service...");

    try {
      const service = getIRIndexService();

      // 执行清理操作
      if ("vacuum" in service) {
        await service.vacuum();
      }

      // 创建最终备份
      if ("backup" in service) {
        const backup = await service.backup();
        console.log(
          "💾 [IR Service Manager] Final backup created, size:",
          backup.length,
        );
      }

      this.isStarted = false;
      const uptime = Date.now() - this.startTime;

      console.log("✅ [IR Service Manager] Service stopped successfully");
      console.log(`⏱️ [IR Service Manager] Total uptime: ${uptime}ms`);
    } catch (error) {
      console.error("❌ [IR Service Manager] Error during shutdown:", error);
      throw error;
    }
  }

  /**
   * 重启服务
   */
  async restart(config?: Partial<IRServiceConfig>): Promise<void> {
    console.log("🔄 [IR Service Manager] Restarting service...");

    if (this.isStarted) {
      await this.stop();
    }

    await this.start(config);
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      startTime: this.startTime,
      uptime: this.isStarted ? Date.now() - this.startTime : 0,
      config: this.config,
    };
  }

  /**
   * 健康检查
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      const service = getIRIndexService();

      // 基础功能测试
      const testDoc = {
        id: "health-check-doc",
        fileName: "health-check.txt",
        fileType: "text/plain",
        fileSize: 100,
        uploadedAt: new Date().toISOString(),
        status: "completed" as const,
        totalTokens: 10,
        chunkCount: 1,
        termStats: {
          totalTerms: 5,
          uniqueTerms: 5,
          avgTermsPerChunk: 5,
        },
      };

      // 测试添加文档
      await service.addDocument(testDoc);

      // 测试获取文档
      const retrieved = await service.getDocument("health-check-doc");
      if (!retrieved) {
        throw new Error("Failed to retrieve test document");
      }

      // 测试删除文档
      await service.deleteDocument("health-check-doc");

      console.log("✅ [IR Service Manager] Health check passed");
      return true;
    } catch (error) {
      console.error("❌ [IR Service Manager] Health check failed:", error);
      return false;
    }
  }

  /**
   * 获取服务指标
   */
  async getMetrics() {
    try {
      const service = getIRIndexService();
      const stats = await service.getIndexStats();

      let memoryStats = {};
      if ("getMemoryStats" in service) {
        memoryStats = (service as any).getMemoryStats();
      }

      return {
        serviceStatus: this.getStatus(),
        indexStats: stats,
        memoryStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ [IR Service Manager] Failed to get metrics:", error);
      return null;
    }
  }

  // ================ 私有方法 ================

  private async createMemoryService(): Promise<IRIndexServiceInterface> {
    console.log("🧠 [IR Service Manager] Creating memory-based service");

    const service = new MemoryIRIndexService();

    if (this.config.enableLogging) {
      console.log(
        "📊 [IR Service Manager] Memory service configuration:",
        this.config.memoryConfig,
      );
    }

    return service;
  }

  private async createDatabaseService(): Promise<IRIndexServiceInterface> {
    console.log("🗄️ [IR Service Manager] Creating database-based service");

    // TODO: 实现数据库服务
    throw new Error("Database service not implemented yet");
  }

  private async createRedisService(): Promise<IRIndexServiceInterface> {
    console.log("🔴 [IR Service Manager] Creating Redis-based service");

    // TODO: 实现Redis服务
    throw new Error("Redis service not implemented yet");
  }
}

// ================ 便捷函数 ================

/**
 * 启动IR索引服务
 */
export async function startIRService(
  config?: Partial<IRServiceConfig>,
): Promise<void> {
  const manager = IRServiceManager.getInstance();
  await manager.start(config);
}

/**
 * 停止IR索引服务
 */
export async function stopIRService(): Promise<void> {
  const manager = IRServiceManager.getInstance();
  await manager.stop();
}

/**
 * 重启IR索引服务
 */
export async function restartIRService(
  config?: Partial<IRServiceConfig>,
): Promise<void> {
  const manager = IRServiceManager.getInstance();
  await manager.restart(config);
}

/**
 * 获取服务状态
 */
export function getIRServiceStatus() {
  const manager = IRServiceManager.getInstance();
  return manager.getStatus();
}

/**
 * 健康检查
 */
export async function checkIRServiceHealth(): Promise<boolean> {
  const manager = IRServiceManager.getInstance();
  return await manager.performHealthCheck();
}

/**
 * 获取服务指标
 */
export async function getIRServiceMetrics() {
  const manager = IRServiceManager.getInstance();
  return await manager.getMetrics();
}
