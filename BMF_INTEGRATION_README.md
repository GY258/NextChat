# BMF 搜索服务集成指南

本文档说明如何在 NextChat 中集成和使用 BMF 搜索服务。

## 概述

BMF 搜索服务集成允许 NextChat 在对话过程中自动搜索相关的业务文档，并使用搜索结果来增强用户的消息，从而为 AI 助手提供更准确和相关的上下文信息。

## 功能特性

- 🔍 **自动文档搜索**: 在用户发送消息时自动搜索相关文档
- 🚀 **消息增强**: 使用搜索结果增强用户消息，提供更好的上下文
- ⚙️ **可配置**: 支持灵活的配置选项
- 🏥 **健康检查**: 自动检查 BMF 服务状态
- 📊 **调试信息**: 详细的日志和调试信息

## 安装和配置

### 1. BMF 搜索服务

确保你的 BMF 搜索服务正在运行，并且可以通过以下 API 访问：

```bash
curl -X POST "http://localhost:5002/search" \
     -H "Content-Type: application/json" \
     -d '{"query": "猪肝", "limit": 3, "include_snippets": true}'
```

### 2. 环境变量配置

你可以通过以下环境变量配置 BMF 搜索服务：

```bash
# 启用/禁用 BMF 搜索（默认：true）
NEXT_PUBLIC_BMF_ENABLED=true

# BMF 服务基础 URL（默认：http://localhost:5002）
NEXT_PUBLIC_BMF_BASE_URL=http://localhost:5002

# 最大上下文 token 数量（默认：2000）
NEXT_PUBLIC_BMF_MAX_CONTEXT_TOKENS=2000

# 搜索结果数量限制（默认：8）
NEXT_PUBLIC_BMF_SEARCH_LIMIT=8

# 是否包含摘要片段（默认：true）
NEXT_PUBLIC_BMF_INCLUDE_SNIPPETS=true

# 健康检查超时时间（毫秒，默认：5000）
NEXT_PUBLIC_BMF_HEALTH_CHECK_TIMEOUT=5000

# 消息增强最小长度（默认：0，所有非空消息都触发）
NEXT_PUBLIC_BMF_ENHANCE_MIN_LENGTH=0
```

### 3. 测试集成

使用提供的测试脚本验证 BMF 服务集成：

```bash
# 使用默认配置测试
node test-bmf.js

# 使用自定义 URL 测试
BMF_BASE_URL=http://your-bmf-service:5002 node test-bmf.js
```

## 工作流程

1. **用户输入消息**: 用户在 NextChat 中输入消息
2. **消息检查**: 系统检查消息是否符合增强条件
3. **BMF 搜索**: 如果符合条件，调用 BMF 搜索服务
4. **结果处理**: 处理搜索结果并构建上下文
5. **消息增强**: 使用搜索结果增强原始消息
6. **发送到 AI**: 将增强后的消息发送给 AI 模型

## API 接口

### BMF 搜索请求格式

```typescript
interface BMFSearchRequest {
  query: string;                // 搜索查询
  limit?: number;              // 结果数量限制
  include_snippets?: boolean;  // 是否包含摘要片段
}
```

### BMF 搜索响应格式

```typescript
interface BMFSearchResponse {
  results: BMFSearchResult[];  // 搜索结果数组
  total?: number;             // 总结果数
  query: string;              // 查询字符串
  took_ms?: number;           // 搜索耗时（毫秒）
}

interface BMFSearchResult {
  id?: string;                // 结果ID
  content: string;            // 文档内容
  score?: number;             // 相关性评分
  metadata?: {                // 元数据
    source?: string;          // 来源文档
    title?: string;           // 标题
    [key: string]: any;
  };
  snippets?: string[];        // 摘要片段
}
```

## 文件结构

```
app/
├── services/
│   └── bmf-search-service.ts      # BMF 搜索服务客户端
├── utils/
│   ├── bmf-document-rag-plugin.ts # BMF 文档 RAG 插件
│   └── test-bmf-integration.ts    # 集成测试工具
├── config/
│   └── bmf-search.ts              # BMF 配置管理
└── store/
    └── chat.ts                    # 聊天存储（已修改）
```

## 调试和故障排除

### 启用调试日志

BMF 集成包含详细的调试日志。在浏览器开发者工具的控制台中查找以下前缀的日志：

- `🔍 [Chat Store]`: 聊天存储中的 BMF 处理
- `📝 [BMF Enhance Debug]`: 消息增强过程
- `🔍 [BMF Search]`: 搜索服务调用
- `🧪 [BMF Test]`: 测试相关日志

### 常见问题

1. **BMF 服务不可用**
   - 检查服务是否正在运行
   - 验证服务 URL 配置
   - 确认网络连接

2. **搜索结果为空**
   - 检查搜索查询是否有效
   - 验证文档是否已正确索引
   - 调整搜索参数

3. **消息未被增强**
   - 检查消息长度是否满足最小要求
   - 验证 BMF 搜索是否已启用
   - 查看控制台日志了解详细信息

### 禁用 BMF 搜索

如果需要临时禁用 BMF 搜索，设置环境变量：

```bash
NEXT_PUBLIC_BMF_ENABLED=false
```

或者在代码中修改配置文件 `app/config/bmf-search.ts`。

## 性能考虑

- BMF 搜索会增加消息处理延迟
- 建议为 BMF 服务配置适当的超时时间
- 考虑在高并发场景下的服务性能和可用性

## 安全注意事项

- 确保 BMF 服务的访问安全
- 注意敏感文档的搜索和显示
- 考虑实施适当的访问控制和审计机制

## 更新和维护

- 定期检查 BMF 服务的健康状态
- 监控搜索性能和准确性
- 根据使用反馈调整配置参数
