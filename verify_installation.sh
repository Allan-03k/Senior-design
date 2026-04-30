#!/bin/bash

echo "🔍 检查后端依赖..."
cd /Users/allan/Senior-design/backend

# 检查 cooking_guide.py 是否存在
if [ -f "services/cooking_guide.py" ]; then
    echo "✅ cooking_guide.py 已创建"
else
    echo "❌ cooking_guide.py 缺失"
    exit 1
fi

# 检查 requirements.txt 中的关键包
echo "🔍 检查 requirements.txt..."
if grep -q "anthropic" requirements.txt && grep -q "Pillow" requirements.txt; then
    echo "✅ 所需包已添加到 requirements.txt"
else
    echo "❌ 缺少必要的包"
    exit 1
fi

# 检查前端组件
echo "🔍 检查前端组件..."
cd /Users/allan/Senior-design/client/src

if [ -f "RecipeDetail.jsx" ] && [ -f "RecipeDetail.css" ]; then
    echo "✅ RecipeDetail 组件已创建"
else
    echo "❌ RecipeDetail 组件缺失"
    exit 1
fi

echo ""
echo "✨ 所有文件检查完成！"
echo ""
echo "📝 下一步："
echo "1. 在 .env 中添加 ANTHROPIC_API_KEY"
echo "2. 运行: docker-compose up --build"
echo "3. 访问: http://localhost:3000"
