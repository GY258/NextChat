# IR文件系统 V2 使用说明

## 概述

IR文件系统 V2 是对原IR系统的重大升级，主要解决了索引存储在内存中的问题，实现了持久化索引存储，并提供了更好的搜索性能和系统稳定性。

## 新特性

### 🔄 持久化索引存储
- **问题解决**: 原系统索引存储在内存中，页面刷新后需要重建索引
- **V2方案**: 使用独立的索引服务，支持持久化存储BM25索引数据
- **优势**: 
  - 索引在页面刷新后保持不变
  - 支持增量索引更新
  - 降低内存占用
  - 提高系统启动速度

### 🚀 增强的文档处理
- **智能分块**: 400-800 tokens，15%重叠，优化搜索精度
- **结构识别**: 自动识别标题、表格标题等结构元素
- **字段权重**: 标题×2.0，内容×1.0，表头×1.5
- **质量评分**: 基于内容长度和结构的质量评分

### 🔍 高级搜索功能
- **层次搜索**: 文档级 → 文本块级，两阶段检索
- **BM25评分**: 专业的信息检索评分算法
- **查询优化**: 停用词过滤、同义词扩展
- **伪相关反馈**: 基于初次搜索结果优化查询
- **搜索建议**: 实时搜索建议和查询分析

## 系统架构

```
前端组件 (React)
    ↓
文档存储 (Zustand Store)
    ↓
文档处理器 V2 (IRDocumentProcessorV2)
    ↓
索引服务 (IRIndexService)
    ↓
搜索引擎 V2 (IRSearchEngineV2)
    ↓
持久化存储 (内存/数据库)
```

## 快速开始

### 1. 使用新的文档管理器

```typescript
import { IRDocumentManagerV2Page } from "../components/ir-document-manager-v2";

// 在路由中使用
<Route path="/documents-v2" component={IRDocumentManagerV2Page} />
```

### 2. 使用新的存储系统

```typescript
import { useIRDocumentStoreV2 } from "../store/document-ir-v2";

function MyComponent() {
  const documentStore = useIRDocumentStoreV2();
  
  // 上传文档
  const handleUpload = async (file: File) => {
    const document = await documentStore.uploadDocument(file);
    console.log('Document uploaded:', document);
  };
  
  // 搜索文档
  const handleSearch = async (query: string) => {
    const results = await documentStore.searchDocuments(query, 5);
    console.log('Search results:', results);
  };
  
  // 获取统计信息
  const getStats = async () => {
    const stats = await documentStore.getDocumentStats();
    console.log('Stats:', stats);
  };
}
```

### 3. 直接使用API端点

```typescript
// 上传文档数据
const uploadDocument = async (document: DatabaseDocument) => {
  const response = await fetch('/api/ir-index/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document)
  });
  return response.json();
};

// 搜索索引
const searchIndex = async (terms: string[]) => {
  const response = await fetch('/api/ir-index/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terms, includePostings: true })
  });
  return response.json();
};
```

## 主要组件介绍

### 1. IRIndexService - 索引服务

负责持久化存储和管理BM25索引数据：

```typescript
import { getIRIndexService } from "../services/ir-index-service";

const indexService = getIRIndexService();

// 添加文档
await indexService.addDocument(document);

// 添加文本块
await indexService.addChunks(chunks);

// 添加索引数据
await indexService.addTerms(terms);
await indexService.addPostings(postings);

// 搜索
const termData = await indexService.searchTerms(['关键词']);
const postings = await indexService.getPostingsForTerms(['关键词']);
```

### 2. IRDocumentProcessorV2 - 文档处理器

增强的文档处理，配合索引服务：

```typescript
import { IRDocumentProcessorV2 } from "../utils/document-processor-ir-v2";

const processor = IRDocumentProcessorV2.getInstance();

// 处理文件并自动存储到索引服务
const result = await processor.processFileAndIndex(file);

console.log('Processing result:', {
  document: result.document,
  chunks: result.chunks.length,
  terms: result.terms.length,
  postings: result.postings.length
});
```

### 3. IRSearchEngineV2 - 搜索引擎

使用持久化索引的高级搜索：

```typescript
import { IRSearchEngineV2 } from "../utils/ir-search-engine-v2";

const searchEngine = IRSearchEngineV2.getInstance();

// 执行搜索
const results = await searchEngine.search('查询内容', {
  topK: 10,           // 文档级搜索返回10个文档
  topN: 5,            // 最终返回5个文本块
  useHierarchicalSearch: true,  // 使用层次搜索
  usePRF: false,      // 不使用伪相关反馈
  explain: true       // 返回评分解释
});

// 获取搜索建议
const suggestions = await searchEngine.getSearchSuggestions('部分查询');

// 更新BM25参数
searchEngine.updateBM25Parameters({
  k1: 1.5,
  b: 0.8,
  fieldWeights: {
    title: 3.0,
    content: 1.0,
    tableHeader: 2.0
  }
});
```

## 配置选项

### 搜索设置

```typescript
documentStore.updateSearchSettings({
  useHierarchicalSearch: true,    // 层次搜索
  usePRF: false,                  // 伪相关反馈
  topKDocuments: 10,              // 文档级搜索数量
  topNChunks: 5,                  // 文本块搜索数量
  explainScores: false,           // 评分解释
  minScore: 0.01                  // 最小分数阈值
});
```

### BM25参数

```typescript
searchEngine.updateBM25Parameters({
  k1: 1.2,        // 词频饱和参数
  b: 0.75,        // 文档长度标准化参数
  k3: 8,          // 查询词频饱和参数
  fieldWeights: {
    title: 2.0,         // 标题权重
    content: 1.0,       // 内容权重
    tableHeader: 1.5    // 表头权重
  }
});
```

## 调试和分析

### 查询分析

```typescript
const analysis = await documentStore.analyzeQuery('查询内容');
console.log('Query analysis:', {
  originalQuery: analysis.originalQuery,
  normalizedTerms: analysis.normalizedTerms,
  termStatistics: analysis.termStatistics,
  estimatedResults: analysis.estimatedResults
});
```

### 索引统计

```typescript
const indexStats = await documentStore.getIndexStatistics();
console.log('Index statistics:', indexStats);

const termDistribution = await documentStore.getTermDistribution(50);
console.log('Top 50 terms:', termDistribution);
```

### 性能监控

```typescript
// 获取内存使用情况
const memoryStats = indexService.getMemoryStats();
console.log('Memory usage:', memoryStats);

// 创建备份
const backup = await documentStore.backup();
console.log('Backup created, size:', backup.length);
```

## 迁移指南

### 从原IR系统迁移

1. **数据迁移**: 原系统数据会自动失效，需要重新上传文档
2. **API更改**: 使用新的store和组件API
3. **配置调整**: 更新搜索设置和BM25参数

```typescript
// 旧系统
import { useIRDocumentStore } from "../store/document-ir";

// 新系统
import { useIRDocumentStoreV2 } from "../store/document-ir-v2";
```

### 性能优化建议

1. **批量操作**: 使用批量上传和删除
2. **缓存利用**: 系统会自动缓存统计信息5分钟
3. **索引维护**: 定期运行reindex和vacuum操作
4. **内存监控**: 监控内存使用情况，及时清理

## 故障排除

### 常见问题

1. **索引不一致**: 运行 `reindexDocuments()` 重建索引
2. **搜索无结果**: 检查查询词汇是否被停用词过滤
3. **性能问题**: 检查文档数量和索引大小，考虑清理无用文档
4. **内存泄漏**: 定期运行 `vacuum()` 清理内存

### 调试技巧

```typescript
// 启用详细日志
console.log('Search settings:', documentStore.searchSettings);
console.log('BM25 parameters:', searchEngine.getBM25Parameters());

// 分析查询性能
const startTime = Date.now();
const results = await documentStore.searchDocuments(query);
const searchTime = Date.now() - startTime;
console.log(`Search completed in ${searchTime}ms, found ${results.length} results`);

// 检查索引健康状况
const stats = await documentStore.getDocumentStats();
console.log('Index health:', {
  totalDocuments: stats.totalDocuments,
  totalChunks: stats.totalChunks,
  avgChunkLength: stats.avgChunkLength,
  uniqueTerms: stats.uniqueTerms
});
```

## 未来计划

1. **真实数据库支持**: 替换内存存储为MySQL/PostgreSQL
2. **分布式索引**: 支持多节点索引分片
3. **实时索引**: 支持文档内容的实时更新
4. **机器学习优化**: 集成学习排序算法
5. **多语言支持**: 增强多语言文本处理能力

## 技术支持

遇到问题时，请：

1. 检查浏览器控制台的详细日志
2. 运行 `getIndexStatistics()` 检查系统状态
3. 尝试重新索引文档
4. 清除所有文档后重新开始

更多技术细节请参考源代码注释和类型定义。
