# IR文档索引数据库Schema设计

## 概述

这个文档定义了IR文档索引系统的数据库schema，用于持久化存储BM25索引和文档数据。

## 数据库表结构

### 1. 文档表 (documents)

存储文档的基本信息和统计数据。

```sql
CREATE TABLE documents (
    id VARCHAR(255) PRIMARY KEY,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    title VARCHAR(1000),
    language VARCHAR(10),
    url TEXT,
    
    -- 时间戳
    uploaded_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    last_modified TIMESTAMP,
    
    -- 处理状态
    status ENUM('processing', 'completed', 'error') NOT NULL DEFAULT 'processing',
    error_message TEXT,
    
    -- 统计信息
    total_tokens INT NOT NULL DEFAULT 0,
    chunk_count INT NOT NULL DEFAULT 0,
    total_terms INT NOT NULL DEFAULT 0,
    unique_terms INT NOT NULL DEFAULT 0,
    avg_terms_per_chunk DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- 索引
    INDEX idx_file_name (file_name),
    INDEX idx_status (status),
    INDEX idx_uploaded_at (uploaded_at),
    INDEX idx_file_type (file_type)
);
```

### 2. 文本块表 (chunks)

存储文档的分块信息。

```sql
CREATE TABLE chunks (
    id VARCHAR(255) PRIMARY KEY,
    doc_id VARCHAR(255) NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT NOT NULL,
    
    -- 位置信息
    start_offset BIGINT NOT NULL,
    end_offset BIGINT NOT NULL,
    
    -- 结构信息
    is_title BOOLEAN NOT NULL DEFAULT FALSE,
    is_table_header BOOLEAN NOT NULL DEFAULT FALSE,
    section_title VARCHAR(500),
    page_number INT,
    
    -- 语言和质量
    language VARCHAR(10),
    confidence DECIMAL(3,2),
    
    -- 时间戳
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键和索引
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    INDEX idx_doc_id (doc_id),
    INDEX idx_chunk_index (doc_id, chunk_index),
    INDEX idx_is_title (is_title),
    INDEX idx_token_count (token_count),
    
    -- 全文索引用于备用搜索
    FULLTEXT KEY idx_content (content)
);
```

### 3. 词汇表 (terms)

存储所有唯一词汇及其全局统计信息。

```sql
CREATE TABLE terms (
    term VARCHAR(255) PRIMARY KEY,
    doc_freq INT NOT NULL DEFAULT 0,           -- 包含该词的文档数
    chunk_freq INT NOT NULL DEFAULT 0,         -- 包含该词的文本块数
    total_freq BIGINT NOT NULL DEFAULT 0,      -- 词的总出现频次
    avg_term_freq DECIMAL(10,4) NOT NULL DEFAULT 0,  -- 平均词频
    max_term_freq INT NOT NULL DEFAULT 0,      -- 最大词频
    
    -- 时间戳
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_doc_freq (doc_freq),
    INDEX idx_total_freq (total_freq),
    INDEX idx_updated_at (updated_at)
);
```

### 4. 倒排索引表 (postings)

存储倒排索引数据，用于快速检索。

```sql
CREATE TABLE postings (
    id VARCHAR(255) PRIMARY KEY,
    term VARCHAR(255) NOT NULL,
    doc_id VARCHAR(255) NOT NULL,
    chunk_id VARCHAR(255) NOT NULL,
    term_freq INT NOT NULL,
    
    -- 字段权重
    title_weight DECIMAL(3,2),
    content_weight DECIMAL(3,2),
    table_header_weight DECIMAL(3,2),
    
    -- 位置信息（用于短语查询）
    positions JSON,
    
    -- 时间戳
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键和索引
    FOREIGN KEY (term) REFERENCES terms(term) ON DELETE CASCADE,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
    
    -- 复合索引用于快速检索
    INDEX idx_term_doc (term, doc_id),
    INDEX idx_term_chunk (term, chunk_id),
    INDEX idx_doc_term (doc_id, term),
    INDEX idx_chunk_term (chunk_id, term),
    INDEX idx_term_freq (term, term_freq DESC)
);
```

### 5. 索引统计表 (index_stats)

存储全局索引统计信息。

```sql
CREATE TABLE index_stats (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global',
    total_documents INT NOT NULL DEFAULT 0,
    total_chunks INT NOT NULL DEFAULT 0,
    total_terms BIGINT NOT NULL DEFAULT 0,
    unique_terms INT NOT NULL DEFAULT 0,
    avg_document_length DECIMAL(10,2) NOT NULL DEFAULT 0,
    avg_chunk_length DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- 时间戳
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_last_updated (last_updated)
);
```

### 6. 搜索日志表 (search_logs) - 可选

用于分析和优化搜索性能。

```sql
CREATE TABLE search_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    query_text TEXT NOT NULL,
    normalized_terms JSON,
    result_count INT NOT NULL DEFAULT 0,
    search_time_ms INT NOT NULL DEFAULT 0,
    
    -- 搜索参数
    use_hierarchical BOOLEAN NOT NULL DEFAULT TRUE,
    use_prf BOOLEAN NOT NULL DEFAULT FALSE,
    top_k INT NOT NULL DEFAULT 10,
    top_n INT NOT NULL DEFAULT 5,
    
    -- 用户信息
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    
    -- 时间戳
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_created_at (created_at),
    INDEX idx_user_id (user_id),
    INDEX idx_search_time (search_time_ms),
    
    -- 全文索引用于查询分析
    FULLTEXT KEY idx_query_text (query_text)
);
```

## 视图定义

### 1. 文档统计视图

```sql
CREATE VIEW document_stats_view AS
SELECT 
    d.id,
    d.file_name,
    d.total_tokens,
    d.chunk_count,
    COUNT(DISTINCT p.term) as indexed_terms,
    AVG(c.token_count) as avg_chunk_tokens,
    MAX(c.token_count) as max_chunk_tokens,
    MIN(c.token_count) as min_chunk_tokens
FROM documents d
LEFT JOIN chunks c ON d.id = c.doc_id
LEFT JOIN postings p ON d.id = p.doc_id
WHERE d.status = 'completed'
GROUP BY d.id, d.file_name, d.total_tokens, d.chunk_count;
```

### 2. 词汇分布视图

```sql
CREATE VIEW term_distribution_view AS
SELECT 
    t.term,
    t.total_freq,
    t.doc_freq,
    t.chunk_freq,
    (t.total_freq / t.chunk_freq) as avg_freq_per_chunk,
    (t.doc_freq / (SELECT total_documents FROM index_stats WHERE id = 'global')) * 100 as doc_coverage_percent
FROM terms t
ORDER BY t.total_freq DESC;
```

## 索引优化建议

### 1. 分区策略

对于大型部署，可以考虑按时间分区：

```sql
-- 按月分区postings表
ALTER TABLE postings PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
    PARTITION p202401 VALUES LESS THAN (202402),
    PARTITION p202402 VALUES LESS THAN (202403),
    -- ... 继续添加分区
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

### 2. 复合索引优化

根据查询模式优化索引：

```sql
-- 用于层次搜索的复合索引
CREATE INDEX idx_hierarchical_search ON postings (term, doc_id, term_freq DESC);

-- 用于块级搜索的复合索引
CREATE INDEX idx_chunk_search ON postings (term, chunk_id, term_freq DESC);

-- 用于统计查询的索引
CREATE INDEX idx_term_stats ON postings (term, doc_id, chunk_id);
```

### 3. 查询缓存

配置MySQL查询缓存以提高重复查询性能：

```sql
SET GLOBAL query_cache_type = ON;
SET GLOBAL query_cache_size = 268435456; -- 256MB
```

## 数据维护

### 1. 定期统计更新

```sql
-- 更新全局统计信息的存储过程
DELIMITER //
CREATE PROCEDURE UpdateIndexStats()
BEGIN
    INSERT INTO index_stats (id, total_documents, total_chunks, total_terms, unique_terms, avg_document_length, avg_chunk_length, last_updated)
    VALUES (
        'global',
        (SELECT COUNT(*) FROM documents WHERE status = 'completed'),
        (SELECT COUNT(*) FROM chunks),
        (SELECT COALESCE(SUM(total_freq), 0) FROM terms),
        (SELECT COUNT(*) FROM terms),
        (SELECT COALESCE(AVG(total_tokens), 0) FROM documents WHERE status = 'completed'),
        (SELECT COALESCE(AVG(token_count), 0) FROM chunks),
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        total_documents = VALUES(total_documents),
        total_chunks = VALUES(total_chunks),
        total_terms = VALUES(total_terms),
        unique_terms = VALUES(unique_terms),
        avg_document_length = VALUES(avg_document_length),
        avg_chunk_length = VALUES(avg_chunk_length),
        last_updated = VALUES(last_updated);
END //
DELIMITER ;
```

### 2. 清理孤立数据

```sql
-- 清理孤立的倒排索引数据
DELETE p FROM postings p
LEFT JOIN chunks c ON p.chunk_id = c.id
WHERE c.id IS NULL;

-- 清理未使用的词汇
DELETE t FROM terms t
LEFT JOIN postings p ON t.term = p.term
WHERE p.term IS NULL;
```

## 性能考虑

1. **内存配置**: 确保innodb_buffer_pool_size足够大，建议为可用内存的70-80%
2. **连接池**: 使用连接池管理数据库连接
3. **批量操作**: 使用批量插入/更新来提高写入性能
4. **读写分离**: 对于高负载场景，考虑使用读写分离
5. **缓存层**: 在应用层添加Redis等缓存层缓存热点数据

## 备份策略

1. **全量备份**: 每日进行全量备份
2. **增量备份**: 每小时进行二进制日志备份
3. **测试恢复**: 定期测试备份恢复流程
4. **异地备份**: 将备份文件存储到异地位置
