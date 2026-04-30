#!/bin/bash

# 🍳 完整实现检查清单

echo "==============================================="
echo "🔍 SmartEats AI 烹饪指南 - 完整实现检查"
echo "==============================================="
echo ""

PASS=0
FAIL=0

check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo "✅ $description: $file"
        ((PASS++))
    else
        echo "❌ $description: $file (缺失)"
        ((FAIL++))
    fi
}

check_directory() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        echo "✅ $description: $dir"
        ((PASS++))
    else
        echo "❌ $description: $dir (缺失)"
        ((FAIL++))
    fi
}

check_content() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo "✅ $description"
        ((PASS++))
    else
        echo "❌ $description"
        ((FAIL++))
    fi
}

# 后端文件检查
echo "📁 后端文件检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "backend/services/cooking_guide.py" "烹饪指南服务"
check_file "backend/app.py" "主应用文件"
check_file "backend/requirements.txt" "Python 依赖"
check_file "backend/.env" "环境配置"
check_file "backend/Dockerfile" "后端 Dockerfile"

echo ""
echo "📝 后端配置检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_content "backend/requirements.txt" "anthropic" "Anthropic 包已添加"
check_content "backend/requirements.txt" "Pillow" "Pillow 包已添加"
check_content "backend/app.py" "services.cooking_guide" "烹饪指南服务已导入"
check_content "backend/.env" "ANTHROPIC_API_KEY" "Anthropic API Key 已配置"

echo ""
echo "🎨 前端文件检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "client/src/RecipeDetail.jsx" "食谱详情组件"
check_file "client/src/RecipeDetail.css" "食谱详情样式"
check_file "client/src/App.jsx" "主应用组件"

echo ""
echo "🎯 功能检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_content "backend/services/cooking_guide.py" "def optimize_cooking_steps" "AI 步骤优化函数"
check_content "backend/services/cooking_guide.py" "def create_video_from_steps" "视频生成函数"
check_content "backend/services/cooking_guide.py" "def generate_tutorial_video" "教学视频生成函数"
check_content "backend/services/cooking_guide.py" "/api/generate-cooking-guide" "API 路由端点"
check_content "backend/services/cooking_guide.py" "/videos/" "视频文件服务"

echo ""
echo "📚 文档检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "COOKING_GUIDE_SETUP.md" "设置指南"
check_file "IMPLEMENTATION_SUMMARY.md" "实现总结"
check_file "quick_start.sh" "快速启动脚本"
check_file "test_cooking_guide.py" "测试脚本"

echo ""
echo "🔧 系统依赖检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker 已安装"
    ((PASS++))
else
    echo "❌ Docker 未安装"
    ((FAIL++))
fi

# 检查 Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose 已安装"
    ((PASS++))
else
    echo "❌ Docker Compose 未安装"
    ((FAIL++))
fi

# 检查 FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg 已安装"
    ((PASS++))
else
    echo "⚠️  FFmpeg 未安装 (但可在 Docker 中运行)"
    ((FAIL++))
fi

# 检查 Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo "✅ Python 已安装 (版本: $PYTHON_VERSION)"
    ((PASS++))
else
    echo "❌ Python 未安装"
    ((FAIL++))
fi

# 检查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js 已安装 (版本: $NODE_VERSION)"
    ((PASS++))
else
    echo "❌ Node.js 未安装"
    ((FAIL++))
fi

echo ""
echo "🐳 Docker 容器检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker ps | grep -q "smarteats-backend"; then
    echo "✅ 后端容器运行中"
    ((PASS++))
else
    echo "⚠️  后端容器未运行"
fi

if docker ps | grep -q "smarteats-frontend"; then
    echo "✅ 前端容器运行中"
    ((PASS++))
else
    echo "⚠️  前端容器未运行"
fi

# 总结
echo ""
echo "==============================================="
echo "📊 检查结果"
echo "==============================================="
TOTAL=$((PASS + FAIL))
PERCENTAGE=$((PASS * 100 / TOTAL))

echo "✅ 通过: $PASS"
echo "❌ 失败: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "总体: $PERCENTAGE% ($PASS/$TOTAL)"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "🎉 完美！所有检查都通过了！"
    echo ""
    echo "✨ 接下来的步骤："
    echo "1. 更新 ANTHROPIC_API_KEY in backend/.env"
    echo "2. 运行: bash quick_start.sh"
    echo "3. 访问: http://localhost:3000"
    echo "4. 开始创建 AI 教学视频！"
else
    echo "⚠️  还有 $FAIL 项需要修复"
    echo ""
    echo "💡 建议:"
    echo "1. 查看上面的 ❌ 项"
    echo "2. 按照 COOKING_GUIDE_SETUP.md 中的说明安装缺失的组件"
    echo "3. 重新运行此脚本确认"
fi

echo ""
