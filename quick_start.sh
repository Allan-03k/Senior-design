#!/bin/bash

# 🍳 SmartEats AI 烹饪教学视频 - 快速启动脚本

set -e

echo "==============================================="
echo "🍳 SmartEats AI 烹饪教学视频系统"
echo "==============================================="
echo ""

# 检查依赖
echo "📋 检查依赖..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi
echo "✅ Docker 已安装"

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi
echo "✅ Docker Compose 已安装"

# 检查必要文件
echo ""
echo "📁 检查必要文件..."

files_to_check=(
    "backend/services/cooking_guide.py"
    "client/src/RecipeDetail.jsx"
    "client/src/RecipeDetail.css"
    "backend/requirements.txt"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file 缺失"
        exit 1
    fi
done

# 检查 API Key
echo ""
echo "🔑 检查 API Key..."

if grep -q "ANTHROPIC_API_KEY=sk-ant-v4" backend/.env; then
    echo "✅ ANTHROPIC_API_KEY 已配置"
else
    echo "⚠️  ANTHROPIC_API_KEY 未配置"
    echo "   请编辑 backend/.env 添加你的 Anthropic API Key"
    echo "   获取地址: https://console.anthropic.com/account/keys"
fi

# 启动服务
echo ""
echo "🚀 启动服务..."
echo ""

# 停止现有容器
docker-compose down 2>/dev/null || true

# 构建并启动
docker-compose up --build -d

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务
echo ""
echo "✅ 检查服务状态..."

if docker ps | grep -q "smarteats-backend"; then
    echo "✅ 后端服务运行中 (http://localhost:5001)"
else
    echo "❌ 后端服务启动失败"
    docker-compose logs backend
    exit 1
fi

if docker ps | grep -q "smarteats-frontend"; then
    echo "✅ 前端服务运行中 (http://localhost:5173 或 http://localhost:3000)"
else
    echo "❌ 前端服务启动失败"
    docker-compose logs frontend
    exit 1
fi

echo ""
echo "==============================================="
echo "🎉 所有服务已启动！"
echo "==============================================="
echo ""
echo "📱 访问地址:"
echo "  • 前端应用: http://localhost:3000 或 http://localhost:5173"
echo "  • 后端 API: http://localhost:5000 或 http://localhost:5001"
echo "  • API 文档: http://localhost:5000/docs"
echo ""
echo "🧪 测试功能:"
echo "  python test_cooking_guide.py"
echo ""
echo "📖 查看文档:"
echo "  cat COOKING_GUIDE_SETUP.md"
echo ""
echo "🛑 停止服务:"
echo "  docker-compose down"
echo ""
