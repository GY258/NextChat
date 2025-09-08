/**
 * IR服务配置文件 - 管理不同环境下的服务配置
 */

import { IRServiceConfig } from "../services/ir-service-manager";

// 开发环境配置
const developmentConfig: IRServiceConfig = {
  serviceType: "memory",
  autoStart: true,
  enableLogging: true,
  memoryConfig: {
    maxDocuments: 100, // 开发环境限制较小
    maxMemoryMB: 256, // 256MB内存限制
    enableCompression: false, // 开发环境不压缩，便于调试
  },
};

// 生产环境配置
const productionConfig: IRServiceConfig = {
  serviceType: "memory",
  autoStart: true,
  enableLogging: false, // 生产环境减少日志
  memoryConfig: {
    maxDocuments: 1000, // 生产环境支持更多文档
    maxMemoryMB: 1024, // 1GB内存限制
    enableCompression: true, // 生产环境启用压缩
  },
};

// 测试环境配置
const testConfig: IRServiceConfig = {
  serviceType: "memory",
  autoStart: false, // 测试环境手动启动
  enableLogging: false, // 测试时减少噪音
  memoryConfig: {
    maxDocuments: 50, // 测试环境小规模
    maxMemoryMB: 128, // 128MB内存限制
    enableCompression: false,
  },
};

// 数据库配置模板（未来使用）
const databaseConfigTemplate: IRServiceConfig = {
  serviceType: "database",
  autoStart: true,
  enableLogging: true,
  databaseConfig: {
    host: process.env.IR_DB_HOST || "localhost",
    port: parseInt(process.env.IR_DB_PORT || "3306"),
    database: process.env.IR_DB_NAME || "nextchat_ir",
    username: process.env.IR_DB_USER || "nextchat",
    password: process.env.IR_DB_PASSWORD || "",
    connectionPool: 10,
  },
};

// Redis配置模板（未来使用）
const redisConfigTemplate: IRServiceConfig = {
  serviceType: "redis",
  autoStart: true,
  enableLogging: true,
  redisConfig: {
    host: process.env.IR_REDIS_HOST || "localhost",
    port: parseInt(process.env.IR_REDIS_PORT || "6379"),
    password: process.env.IR_REDIS_PASSWORD,
    keyPrefix: "nextchat:ir:",
  },
};

/**
 * 根据环境获取配置
 */
export function getIRServiceConfig(): IRServiceConfig {
  const env = process.env.NODE_ENV || "development";

  switch (env) {
    case "development":
      return developmentConfig;
    case "production":
      return productionConfig;
    case "test":
      return testConfig;
    default:
      console.warn(`⚠️ Unknown environment: ${env}, using development config`);
      return developmentConfig;
  }
}

/**
 * 根据服务类型获取配置
 */
export function getIRServiceConfigByType(
  serviceType: "memory" | "database" | "redis",
): IRServiceConfig {
  switch (serviceType) {
    case "memory":
      return getIRServiceConfig();
    case "database":
      return databaseConfigTemplate;
    case "redis":
      return redisConfigTemplate;
    default:
      throw new Error(`Unsupported service type: ${serviceType}`);
  }
}

/**
 * 自定义配置合并
 */
export function createCustomIRConfig(
  overrides: Partial<IRServiceConfig>,
): IRServiceConfig {
  const baseConfig = getIRServiceConfig();
  return {
    ...baseConfig,
    ...overrides,
    // 深度合并嵌套配置
    memoryConfig: {
      ...baseConfig.memoryConfig,
      ...overrides.memoryConfig,
    } as {
      maxDocuments: number;
      maxMemoryMB: number;
      enableCompression: boolean;
    },
    databaseConfig: {
      ...baseConfig.databaseConfig,
      ...overrides.databaseConfig,
    } as {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
      connectionPool: number;
    },
    redisConfig: {
      ...baseConfig.redisConfig,
      ...overrides.redisConfig,
    } as {
      host: string;
      port: number;
      password?: string;
      keyPrefix: string;
    },
  };
}

/**
 * 验证配置是否有效
 */
export function validateIRServiceConfig(config: IRServiceConfig): boolean {
  try {
    // 基础字段验证
    if (
      !config.serviceType ||
      !["memory", "database", "redis"].includes(config.serviceType)
    ) {
      throw new Error("Invalid serviceType");
    }

    if (typeof config.autoStart !== "boolean") {
      throw new Error("autoStart must be boolean");
    }

    if (typeof config.enableLogging !== "boolean") {
      throw new Error("enableLogging must be boolean");
    }

    // 内存配置验证
    if (config.serviceType === "memory" && config.memoryConfig) {
      const memConfig = config.memoryConfig;
      if (
        memConfig.maxDocuments &&
        (memConfig.maxDocuments < 1 || memConfig.maxDocuments > 10000)
      ) {
        throw new Error("maxDocuments must be between 1 and 10000");
      }
      if (
        memConfig.maxMemoryMB &&
        (memConfig.maxMemoryMB < 64 || memConfig.maxMemoryMB > 4096)
      ) {
        throw new Error("maxMemoryMB must be between 64 and 4096");
      }
    }

    // 数据库配置验证
    if (config.serviceType === "database" && config.databaseConfig) {
      const dbConfig = config.databaseConfig;
      if (!dbConfig.host || !dbConfig.database || !dbConfig.username) {
        throw new Error("Database config missing required fields");
      }
      if (dbConfig.port < 1 || dbConfig.port > 65535) {
        throw new Error("Invalid database port");
      }
    }

    // Redis配置验证
    if (config.serviceType === "redis" && config.redisConfig) {
      const redisConfig = config.redisConfig;
      if (!redisConfig.host || !redisConfig.keyPrefix) {
        throw new Error("Redis config missing required fields");
      }
      if (redisConfig.port < 1 || redisConfig.port > 65535) {
        throw new Error("Invalid Redis port");
      }
    }

    return true;
  } catch (error) {
    console.error("❌ IR service config validation failed:", error);
    return false;
  }
}

/**
 * 打印配置信息（隐藏敏感信息）
 */
export function printIRServiceConfig(config: IRServiceConfig): void {
  const safePrint = (obj: any): any => {
    if (!obj) return obj;

    const result = { ...obj };

    // 隐藏密码等敏感信息
    if (result.password) result.password = "***";
    if (result.username)
      result.username = result.username.substring(0, 3) + "***";

    return result;
  };

  console.log("⚙️ [IR Service Config]", {
    serviceType: config.serviceType,
    autoStart: config.autoStart,
    enableLogging: config.enableLogging,
    memoryConfig: safePrint(config.memoryConfig),
    databaseConfig: safePrint(config.databaseConfig),
    redisConfig: safePrint(config.redisConfig),
  });
}

// 导出预定义配置
export const IR_CONFIGS = {
  development: developmentConfig,
  production: productionConfig,
  test: testConfig,
  database: databaseConfigTemplate,
  redis: redisConfigTemplate,
};
