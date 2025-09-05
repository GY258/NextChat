# BMF RAG 触发条件更新

## 🔄 更新内容

根据您的反馈，已将 BMF RAG 的触发条件修改为**默认所有非空消息都触发**。

## 📝 具体改动

### 1. 修改触发逻辑
**文件**: `app/utils/bmf-document-rag-plugin.ts`

**修改前**:
```typescript
// 只有长度大于10个字符的消息才触发RAG
const shouldUse = message.length > config.enhanceMinLength && 
                  !message.startsWith('/') && 
                  !message.startsWith('!');
```

**修改后**:
```typescript
// 所有非空消息都触发RAG（除了命令）
const shouldUse = message.trim().length > 0 && 
                  !message.startsWith('/') && 
                  !message.startsWith('!');
```

### 2. 更新默认配置
**文件**: `app/config/bmf-search.ts`

**修改前**:
```typescript
enhanceMinLength: 10  // 最小10个字符
```

**修改后**:
```typescript
enhanceMinLength: 0   // 最小0个字符，所有非空消息都可能触发
```

## ✅ 新的触发规则

现在 BMF RAG 会在以下情况下触发：

| 消息类型 | 是否触发 RAG | 示例 |
|---------|-------------|------|
| 普通消息 | ✅ 是 | `"你好"`, `"猪肝如何制作?"` |
| 短消息 | ✅ 是 | `"hi"`, `"好"` |
| 命令消息 | ❌ 否 | `"/help"`, `"!clear"` |
| 空消息 | ❌ 否 | `""`, `"   "` |

## 🧪 测试验证

已通过测试验证新的触发逻辑：

```
=== 测试RAG触发条件 ===
🔍 Testing message: 猪肝如何制作?
🎯 Should use BMF RAG: true

🔍 Testing message: hello  
🎯 Should use BMF RAG: true

🔍 Testing message: /help
🎯 Should use BMF RAG: false

🔍 Testing message: !clear
🎯 Should use BMF RAG: false

🔍 Testing message: 
🎯 Should use BMF RAG: false

🔍 Testing message:    
🎯 Should use BMF RAG: false
```

## 🔧 如何恢复原有行为

如果您希望恢复到原来的行为（只有长消息才触发RAG），可以设置环境变量：

```bash
NEXT_PUBLIC_BMF_ENHANCE_MIN_LENGTH=10
```

或者修改 `app/config/bmf-search.ts` 中的 `enhanceMinLength` 值。

## 📊 预期效果

现在当您发送任何普通消息（比如 `"猪肝如何制作?"` 或者简单的 `"你好"`）时，都会：

1. 🔍 自动调用您的 BMF 搜索服务
2. 📄 搜索相关文档
3. ✨ 增强消息内容
4. 🤖 让 AI 基于文档内容回答

您应该能在浏览器控制台看到更多的 BMF 相关日志输出了！
