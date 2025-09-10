#!/usr/bin/env node

/**
 * Simple BMF Integration Test Script
 * 
 * 运行这个脚本来测试BMF搜索服务是否正常工作
 */

// Use global fetch if available, otherwise use a simple alternative
const fetch = globalThis.fetch || (async (url, options) => {
  // Fallback using built-in modules
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');
  
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options?.method || 'GET',
      headers: options?.headers || {},
      timeout: options?.timeout || 10000
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => JSON.parse(data),
          text: () => data
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options?.body) {
      req.write(options.body);
    }
    req.end();
  });
});

// BMF搜索服务配置
const BMF_BASE_URL = process.env.BMF_BASE_URL || 'http://localhost:5003';

async function testBMFService() {
  console.log('🧪 Testing BMF Search Service...');
  console.log('📍 Base URL:', BMF_BASE_URL);
  
  try {
    // 健康检查
    console.log('\n🏥 Performing health check...');
    try {
      const healthResponse = await fetch(`${BMF_BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (healthResponse.ok) {
        console.log('✅ Health check passed');
      } else {
        console.log('⚠️ Health check failed with status:', healthResponse.status);
      }
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }

    // 获取服务信息
    console.log('\nℹ️ Getting service info...');
    try {
      const infoResponse = await fetch(`${BMF_BASE_URL}/info`, {
        method: 'GET'
      });
      
      if (infoResponse.ok) {
        const info = await infoResponse.json();
        console.log('📋 Service info:', JSON.stringify(info, null, 2));
      } else {
        console.log('⚠️ Could not get service info');
      }
    } catch (error) {
      console.log('⚠️ Could not get service info:', error.message);
    }

    // 测试搜索
    console.log('\n🔍 Testing search...');
    const searchQuery = '猪肝';
    const searchPayload = {
      query: searchQuery,
      limit: 3,
      include_snippets: true
    };

    console.log('📝 Search payload:', JSON.stringify(searchPayload, null, 2));

    const searchResponse = await fetch(`${BMF_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed with status: ${searchResponse.status} ${searchResponse.statusText}`);
    }

    const searchResult = await searchResponse.json();
    
    console.log('📊 Search result summary:', {
      resultsCount: searchResult.results?.length || 0,
      took: searchResult.took_ms,
      query: searchResult.query
    });

    if (searchResult.results && searchResult.results.length > 0) {
      console.log('\n📄 First few results:');
      searchResult.results.slice(0, 2).forEach((result, index) => {
        console.log(`\n  Result ${index + 1}:`);
        console.log(`    Content: ${(result.content || result.text || '').substring(0, 100)}...`);
        console.log(`    Score: ${result.score || result.similarity || 'N/A'}`);
        console.log(`    Source: ${result.source || result.filename || result.document || 'N/A'}`);
        if (result.snippets) {
          console.log(`    Snippets: ${result.snippets.length} found`);
        }
      });
    } else {
      console.log('⚠️ No search results returned');
    }

    console.log('\n✅ BMF service test completed successfully!');
    console.log('\n💡 You can now use BMF search in your NextChat application.');
    console.log('🔧 Make sure the BMF service is running on', BMF_BASE_URL);

  } catch (error) {
    console.error('\n❌ BMF service test failed:', error.message);
    console.log('\n🔍 Troubleshooting tips:');
    console.log('  1. Make sure the BMF search service is running');
    console.log('  2. Verify the service URL:', BMF_BASE_URL);
    console.log('  3. Check if the service accepts the expected request format');
    console.log('  4. Try running: curl -X POST "' + BMF_BASE_URL + '/search" -H "Content-Type: application/json" -d \'{"query": "test", "limit": 3}\'');
    process.exit(1);
  }
}

// 运行测试
testBMFService();
