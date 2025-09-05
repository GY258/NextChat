# IR索引服务启动指南

## 📋 概述

IR索引服务现在提供了完整的启动和管理机制，支持自动启动、手动控制、健康监控等功能。本指南将详细说明如何启动和使用IR索引服务。

## 🚀 启动方式

### 1. 自动启动（推荐）

**默认行为**: 服务会在页面加载时自动启动，无需手动干预。

```typescript
// 在应用的入口文件中导入引导程序
import './lib/ir-bootstrap';

// 或者在需要的地方手动引导
import { bootstrapIRService } from './lib/ir-bootstrap';

// 应用启动时调用
bootstrapIRService();
```

**自动启动流程**:
1. 页面加载 → DOM Ready
2. 延迟500ms → 开始引导
3. 读取环境配置 → 验证配置
4. 启动服务 → 健康检查
5. 服务就绪 ✅

### 2. 使用React Hook启动

```typescript
import { useIRService } from './hooks/use-ir-service';

function MyComponent() {
  const { 
    isInitialized, 
    isLoading, 
    error, 
    initialize 
  } = useIRService(true); // true = 自动初始化

  if (isLoading) return <div>正在启动IR服务...</div>;
  if (error) return <div>启动失败: {error}</div>;
  if (!isInitialized) return <div>服务未启动</div>;

  return <div>IR服务已就绪！</div>;
}
```

### 3. 手动启动

```typescript
import { startIRService, stopIRService } from './services/ir-service-manager';
import { getIRServiceConfig } from './config/ir-service';

// 启动服务
const config = getIRServiceConfig();
await startIRService(config);

// 停止服务
await stopIRService();
```

### 4. API方式启动

```bash
# 启动服务
curl -X PUT http://localhost:3000/api/ir-index/index/reindex

# 检查状态
curl http://localhost:3000/api/ir-index/index/stats
```

## ⚙️ 配置选项

### 环境配置

系统会根据 `NODE_ENV` 自动选择配置：

```typescript
// 开发环境 (NODE_ENV=development)
{
  serviceType: 'memory',
  maxDocuments: 100,
  maxMemoryMB: 256,
  enableLogging: true
}

// 生产环境 (NODE_ENV=production)
{
  serviceType: 'memory',
  maxDocuments: 1000,
  maxMemoryMB: 1024,
  enableLogging: false
}

// 测试环境 (NODE_ENV=test)
{
  serviceType: 'memory',
  maxDocuments: 50,
  maxMemoryMB: 128,
  autoStart: false
}
```

### 自定义配置

```typescript
import { createCustomIRConfig } from './config/ir-service';

const customConfig = createCustomIRConfig({
  memoryConfig: {
    maxDocuments: 500,
    maxMemoryMB: 512
  },
  enableLogging: true
});

await startIRService(customConfig);
```

### 环境变量配置

```bash
# .env.local
IR_SERVICE_TYPE=memory
IR_MAX_DOCUMENTS=1000
IR_MAX_MEMORY_MB=1024
IR_ENABLE_LOGGING=true

# 数据库配置（未来支持）
IR_DB_HOST=localhost
IR_DB_PORT=3306
IR_DB_NAME=nextchat_ir
IR_DB_USER=nextchat
IR_DB_PASSWORD=your_password

# Redis配置（未来支持）
IR_REDIS_HOST=localhost
IR_REDIS_PORT=6379
IR_REDIS_PASSWORD=your_password
```

## 🏥 服务监控

### 1. 使用控制面板

导入并使用内置的控制面板组件：

```typescript
import { IRServiceDashboard } from './components/ir-service-dashboard';

function AdminPage() {
  return (
    <div>
      <h1>管理面板</h1>
      <IRServiceDashboard />
    </div>
  );
}
```

### 2. 编程方式监控

```typescript
import { 
  getIRServiceStatus, 
  getIRServiceMetrics, 
  checkIRServiceHealth 
} from './services/ir-service-manager';

// 获取服务状态
const status = getIRServiceStatus();
console.log('服务状态:', status);

// 获取详细指标
const metrics = await getIRServiceMetrics();
console.log('服务指标:', metrics);

// 健康检查
const isHealthy = await checkIRServiceHealth();
console.log('健康状态:', isHealthy);
```

### 3. Hook方式监控

```typescript
import { useIRServiceStatus } from './hooks/use-ir-service';

function StatusComponent() {
  const { status, lastUpdate, refresh } = useIRServiceStatus();
  
  return (
    <div>
      <p>状态: {status?.isStarted ? '运行中' : '已停止'}</p>
      <p>更新时间: {new Date(lastUpdate).toLocaleString()}</p>
      <button onClick={refresh}>刷新状态</button>
    </div>
  );
}
```

## 🔧 开发调试

### 开发环境调试工具

在开发环境中，服务会在 `window` 对象上提供调试工具：

```javascript
// 浏览器控制台中使用
const debug = window.__IR_SERVICE_DEBUG__;

// 获取状态
await debug.getStatus();

// 获取指标
await debug.getMetrics();

// 健康检查
await debug.healthCheck();
```

### 日志级别

```typescript
// 启用详细日志
const config = createCustomIRConfig({
  enableLogging: true
});

// 日志会显示在控制台，包含：
// 🚀 启动信息
// 📊 统计数据
// 🔍 搜索操作
// ❌ 错误信息
```

### 性能监控

```typescript
// 监控内存使用
const service = getIRIndexService();
const memoryStats = service.getMemoryStats();
console.log('内存使用:', memoryStats);

// 监控搜索性能
const startTime = Date.now();
const results = await documentStore.searchDocuments('查询');
const searchTime = Date.now() - startTime;
console.log(`搜索耗时: ${searchTime}ms`);
```

## 🚨 故障排除

### 常见问题

#### 1. 服务启动失败

```typescript
// 检查配置是否有效
import { validateIRServiceConfig } from './config/ir-service';

const config = getIRServiceConfig();
const isValid = validateIRServiceConfig(config);
if (!isValid) {
  console.error('配置无效');
}
```

#### 2. 内存不足

```typescript
// 减少内存配置
const config = createCustomIRConfig({
  memoryConfig: {
    maxDocuments: 100,
    maxMemoryMB: 256
  }
});
```

#### 3. 服务无响应

```typescript
// 重启服务
import { restartIRService } from './services/ir-service-manager';

await restartIRService();
```

#### 4. 搜索结果为空

```typescript
// 检查索引状态
const stats = await getIRServiceMetrics();
console.log('索引统计:', stats.indexStats);

// 重建索引
const documentStore = useIRDocumentStoreV2.getState();
await documentStore.reindexDocuments();
```

### 错误代码

| 错误代码 | 含义 | 解决方案 |
|---------|------|----------|
| `SERVICE_NOT_INITIALIZED` | 服务未初始化 | 调用 `initializeIRService()` |
| `INVALID_CONFIG` | 配置无效 | 检查配置文件 |
| `MEMORY_EXCEEDED` | 内存超限 | 减少文档数量或增加内存限制 |
| `HEALTH_CHECK_FAILED` | 健康检查失败 | 重启服务 |

## 📈 性能优化

### 1. 内存优化

```typescript
// 启用压缩
const config = createCustomIRConfig({
  memoryConfig: {
    enableCompression: true
  }
});

// 定期清理
setInterval(async () => {
  const service = getIRIndexService();
  await service.vacuum();
}, 30 * 60 * 1000); // 每30分钟
```

### 2. 搜索优化

```typescript
// 使用层次搜索
documentStore.updateSearchSettings({
  useHierarchicalSearch: true,
  topKDocuments: 5,
  topNChunks: 3
});

// 设置最小分数阈值
documentStore.updateSearchSettings({
  minScore: 0.1
});
```

### 3. 批量操作

```typescript
// 批量上传文档
const files = [file1, file2, file3];
const promises = files.map(file => documentStore.uploadDocument(file));
await Promise.all(promises);
```

## 🔮 未来扩展

### 数据库后端

```typescript
// 将来支持数据库后端
const databaseConfig = createCustomIRConfig({
  serviceType: 'database',
  databaseConfig: {
    host: 'localhost',
    database: 'nextchat_ir',
    username: 'nextchat',
    password: 'password'
  }
});
```

### Redis后端

```typescript
// 将来支持Redis后端
const redisConfig = createCustomIRConfig({
  serviceType: 'redis',
  redisConfig: {
    host: 'localhost',
    port: 6379,
    keyPrefix: 'nextchat:ir:'
  }
});
```

### 分布式部署

```typescript
// 将来支持分布式索引
const distributedConfig = createCustomIRConfig({
  serviceType: 'distributed',
  nodes: ['node1:9200', 'node2:9200', 'node3:9200']
});
```

## 📚 最佳实践

1. **生产环境**: 关闭详细日志，启用压缩
2. **开发环境**: 启用日志，使用较小的内存限制
3. **监控**: 定期检查服务健康状态和性能指标
4. **备份**: 定期创建索引备份
5. **清理**: 定期执行vacuum操作清理无用数据

## 📞 技术支持

如果遇到问题：

1. 查看浏览器控制台的详细日志
2. 运行健康检查确认服务状态
3. 检查服务配置是否正确
4. 尝试重启服务
5. 参考错误代码表

更多技术细节请参考源代码注释和API文档。
