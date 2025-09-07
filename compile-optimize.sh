#!/bin/bash

echo "🚀 NextChat 远程编译优化脚本"
echo "================================="

# 设置环境变量优化编译
export NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=64"
export NEXT_TELEMETRY_DISABLED=1
export WEBPACK_MEMORY_CACHE=0

# 禁用不必要的开发工具
export DISABLE_ESLINT_PLUGIN=true
export DISABLE_TYPE_CHECK=true

echo "✅ 环境变量已优化"
echo "📦 开始安装依赖..."
yarn install --frozen-lockfile --prefer-offline

echo "🔨 开始构建masks..."
yarn mask

echo "🏗️ 开始Next.js编译..."
time yarn build

echo "🎉 编译完成！"
