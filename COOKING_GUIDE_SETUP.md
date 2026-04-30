# 🍳 AI烹饪教学视频功能 - 实现指南

## ✨ 功能概述

添加了 **AI烹饪教学视频生成**功能，让用户可以：
1. 查看食谱详情
2. 点击 "Start Cooking" 按钮
3. AI 使用 Claude 生成详细的分步骤烹饪指南
4. 自动生成教学视频（每个步骤一张图片，配上文字说明）
5. 观看视频并跟随详细指南

---

## 📁 新增/修改文件

### 后端

#### 1. `backend/services/cooking_guide.py` ✨ 新建
- **功能**:
  - `optimize_cooking_steps()` - 使用 Claude API 生成详细步骤
  - `create_video_from_steps()` - 使用 PIL + FFmpeg 生成视频
  - `generate_tutorial_video()` - 协调视频生成流程
  - `/api/generate-cooking-guide` - 路由端点
  - `/videos/<filename>` - 视频文件服务

#### 2. `backend/app.py` 修改
```python
# 新增导入
import services.cooking_guide
os.makedirs('generated_videos', exist_ok=True)  # 创建视频目录
```

#### 3. `backend/requirements.txt` 修改
- 添加: `anthropic==0.35.0`
- 添加: `Pillow==11.0.0`

#### 4. `backend/.env` 修改
```
ANTHROPIC_API_KEY=sk-ant-v4-YOUR_KEY_HERE
```

### 前端

#### 1. `client/src/RecipeDetail.jsx` ✨ 新建
- React 组件用于显示食谱详情
- 支持显示原始食谱和烹饪指南两种视图
- 集成视频播放器

#### 2. `client/src/RecipeDetail.css` ✨ 新建
- 完整的样式表，包括:
  - 模态框样式
  - 视频播放器样式
  - 步骤卡片样式
  - 响应式设计

---

## 🔧 安装步骤

### 1️⃣ 获取 Anthropic API Key

访问 https://console.anthropic.com/account/keys 获取 API Key

### 2️⃣ 更新环境变量

编辑 `backend/.env`：
```bash
ANTHROPIC_API_KEY=sk-ant-v4-YOUR_ACTUAL_KEY
```

### 3️⃣ 安装系统依赖

#### Mac (使用 Homebrew)
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt-get install ffmpeg
```

#### Windows
```bash
choco install ffmpeg
```

### 4️⃣ 安装 Python 依赖

```bash
cd backend
pip install -r requirements.txt
```

或使用 Docker：
```bash
cd /Users/allan/Senior-design
docker-compose down
docker-compose up --build
```

---

## 🚀 使用方法

### 方法1: 本地开发（推荐快速测试）

#### 终端1 - 启动后端：
```bash
cd /Users/allan/Senior-design/backend
python app.py
```

#### 终端2 - 启动前端：
```bash
cd /Users/allan/Senior-design/client
npm start
```

访问: http://localhost:3000

### 方法2: Docker 方式

```bash
cd /Users/allan/Senior-design
docker-compose up --build
```

访问:
- 前端: http://localhost:3000
- 后端 API: http://localhost:5000
- API 文档: http://localhost:5000/docs

---

## 📝 API 使用示例

### 请求

```bash
curl -X POST http://localhost:5000/api/generate-cooking-guide \
  -H "Content-Type: application/json" \
  -d '{
    "recipe_name": "番茄炒蛋",
    "ingredients": ["番茄", "鸡蛋", "盐", "油"],
    "steps": ["打蛋", "炒番茄", "混合", "调味"]
  }'
```

### 响应 (示例)

```json
{
  "success": true,
  "enhanced_steps": {
    "steps": [
      {
        "step_num": 1,
        "title": "准备食材",
        "description": "准备所有需要的食材和调料...",
        "duration_minutes": 5,
        "tips": "确保所有食材已称重或测量",
        "tools": ["砧板", "刀"]
      },
      // ... 更多步骤
    ],
    "total_time_minutes": 20,
    "difficulty": "easy"
  },
  "video_url": "/videos/番茄炒蛋_1709292345.mp4"
}
```

---

## 🎯 前端集成示例

### 1. 在 App.jsx 中导入组件

```jsx
import { RecipeDetail } from './RecipeDetail';
```

### 2. 使用组件

```jsx
const [selectedRecipe, setSelectedRecipe] = useState(null);
const [showRecipeDetail, setShowRecipeDetail] = useState(false);

// 点击食谱时
const handleRecipeClick = (recipe) => {
  setSelectedRecipe(recipe);
  setShowRecipeDetail(true);
};

// 在 JSX 中渲染
<RecipeDetail
  recipe={selectedRecipe}
  show={showRecipeDetail}
  onHide={() => setShowRecipeDetail(false)}
/>
```

---

## 🧪 测试功能

### 方法1: 使用测试脚本

```bash
cd /Users/allan/Senior-design
python test_cooking_guide.py
```

### 方法2: 使用前端界面

1. 访问 http://localhost:3000
2. 在 "My Pantry" 中添加食材
3. 选择一个推荐的食谱
4. 点击 "🚀 Start Cooking - 生成AI教学视频"
5. 等待视频生成（大约30秒）
6. 观看生成的教学视频和详细步骤

---

## ⚙️ 系统架构

```
┌─────────────────────────────────────┐
│         前端 (React)                │
│  ┌──────────────────────────────┐   │
│  │   RecipeDetail Component      │   │
│  │  - 显示食谱详情              │   │
│  │  - 触发视频生成请求          │   │
│  │  - 播放生成的视频            │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
           ↓ HTTP POST
┌─────────────────────────────────────┐
│        后端 API (Flask)             │
│  /api/generate-cooking-guide         │
│  ┌──────────────────────────────┐   │
│  │  1. 接收食谱信息              │   │
│  │  2. 调用 Claude API           │   │
│  │  3. 生成详细步骤              │   │
│  │  4. 创建视频                  │   │
│  │  5. 返回视频 URL              │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
       ↓ Claude API      ↓ PIL+FFmpeg
   优化步骤            生成视频图片
       ↓                   ↓
   JSON 响应            MP4 视频文件
```

---

## 📊 生成的视频内容

每个步骤视频包括：
- **步骤编号和标题** （大标题，橙色）
- **详细说明** （可读的步骤描述）
- **💡 提示** （关键建议）
- **🔧 工具** （所需工具列表）
- **⏱️ 耗时** （该步骤所需时间）

每张幻灯片显示 **5 秒**，然后过渡到下一步。

---

## 🐛 常见问题

### Q: 视频生成很慢？
A: 这是正常的。第一次生成需要：
- Claude API 调用: 5-10秒
- 图片生成: 5-10秒
- FFmpeg 编码: 10-20秒
- **总计: 20-40秒**

### Q: 出现 "Claude API 错误"？
A: 检查：
1. `ANTHROPIC_API_KEY` 是否正确设置
2. API Key 是否有效和未过期
3. 网络连接是否正常

### Q: 出现 "ffmpeg 未找到"？
A: 需要安装 FFmpeg（见安装步骤）

### Q: 视频无法播放？
A:
- 检查浏览器是否支持 MP4 格式
- 检查文件是否生成: `ls backend/generated_videos/`
- 查看浏览器控制台错误信息

---

## 🔐 安全注意事项

- **API Key 安全**: 永远不要在代码中硬编码 API Key，使用 `.env` 文件
- **文件清理**: 定期清理 `generated_videos` 目录以节省空间
- **速率限制**: Claude API 有速率限制，生产环境需要添加缓存

---

## 📈 性能优化建议

### 1. 添加缓存
```python
# 缓存已生成的视频，避免重复生成
CACHE = {}

def get_or_generate_video(recipe_name, ingredients, steps):
    cache_key = f"{recipe_name}:{','.join(ingredients)}"
    if cache_key in CACHE:
        return CACHE[cache_key]
    # ... 生成逻辑
```

### 2. 异步处理
使用 Celery 或 RQ 进行后台任务处理

### 3. 流式处理
使用 Server-Sent Events (SSE) 向前端发送进度更新

---

## 📚 相关文档

- [Anthropic Claude API](https://docs.anthropic.com)
- [Flask 文档](https://flask.palletsprojects.com)
- [PIL/Pillow 文档](https://pillow.readthedocs.io)
- [FFmpeg 文档](https://ffmpeg.org/documentation.html)

---

## 🎉 总结

现在您已经有了一个完整的 **AI 烹饪教学视频系统**！

**下一步建议：**
- ✅ 添加用户账户和收藏功能
- ✅ 支持更多食材输入方式
- ✅ 优化视频质量和分辨率
- ✅ 添加多语言支持
- ✅ 集成实时厨师语音

祝你使用愉快！🍳✨
