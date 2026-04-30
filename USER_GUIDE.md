# 🍳 AI 烹饪教学视频 - 使用指南

## 🎬 功能演示

### 功能流程
```
1. 添加食材 → 2. 选择食谱 → 3. 点击"Start Cooking"
  ↓                              ↓
添加到食材库            打开食谱详情页面
                                 ↓
                    4. 等待 AI 生成教学视频 (30-60秒)
                                 ↓
                    5. 观看视频 + 阅读详细步骤
                                 ↓
                    6. 开始烹饪！🍳
```

---

## 📱 前端使用

### 第一步：进入应用

打开浏览器访问：**http://localhost:3000**

### 第二步：添加食材

1. 在 **"My Pantry"** 标签页
2. 输入食材名称（如：番茄、鸡蛋、油等）
3. 按 Enter 或点击 "+" 按钮添加

**或者：扫冰箱 📷**
- 点击 📷 按钮上传冰箱照片
- AI 会自动识别食材

### 第三步：查看推荐食谱

- 本地食谱会立即显示
- 网络食谱需要稍等片刻
- 每个食谱卡片显示匹配度

### 第四步：打开食谱详情

1. 点击任何食谱卡片
2. 会打开详情模态框
3. 显示：
   - 食材列表
   - 烹饪步骤
   - 匹配度

### 第五步：生成教学视频 ✨

1. 点击蓝色按钮：**"🚀 Start Cooking - 生成AI教学视频"**
2. 等待视频生成
   - 首次生成可能需要 30-60 秒
   - 请不要关闭页面

### 第六步：观看视频

视频生成完成后：
1. 播放器会显示视频
2. 下方显示详细步骤
3. 每个步骤包括：
   - 步骤编号和标题
   - 详细说明
   - 💡 关键提示
   - 🔧 所需工具
   - ⏱️ 耗时

### 返回食谱详情

点击 **"← 返回食谱详情"** 按钮可以回到原始食谱页面

---

## 🍜 Dine Out（外出用餐）

1. 点击 **"Dine Out"** 标签页
2. 输入你的位置或使用 GPS
3. 选择菜系
4. 查看附近餐厅
5. 查看评分和营业状态

---

## 🔌 API 使用（开发者）

### 生成烹饪指南

**请求：**
```bash
curl -X POST http://localhost:5000/api/generate-cooking-guide \
  -H "Content-Type: application/json" \
  -d '{
    "recipe_name": "番茄炒蛋",
    "ingredients": ["番茄", "鸡蛋", "盐", "油"],
    "steps": ["打蛋", "炒番茄", "混合", "调味"]
  }'
```

**响应 (成功)：**
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
      {
        "step_num": 2,
        "title": "烹饪",
        "description": "在热油中炒番茄...",
        "duration_minutes": 10,
        "tips": "保持中火，不要焦糊",
        "tools": ["锅", "铲子"]
      },
      {
        "step_num": 3,
        "title": "混合",
        "description": "将打好的蛋倒入番茄中...",
        "duration_minutes": 3,
        "tips": "快速搅拌避免结块",
        "tools": ["碗", "筷子"]
      },
      {
        "step_num": 4,
        "title": "调味",
        "description": "加入盐和其他调味料...",
        "duration_minutes": 2,
        "tips": "根据口味调整",
        "tools": []
      }
    ],
    "total_time_minutes": 20,
    "difficulty": "easy"
  },
  "video_url": "/videos/番茄炒蛋_1709292345.mp4"
}
```

**响应 (失败)：**
```json
{
  "success": false,
  "error": "Claude API 调用失败: API key invalid"
}
```

### 获取生成的视频

**请求：**
```bash
curl -o recipe_video.mp4 http://localhost:5000/videos/番茄炒蛋_1709292345.mp4
```

---

## ⚙️ 配置指南

### 1. 更新 Anthropic API Key

编辑 `backend/.env`：
```bash
ANTHROPIC_API_KEY=sk-ant-v4-YOUR_KEY_HERE
```

获取地址：https://console.anthropic.com/account/keys

### 2. Docker 配置

如需修改端口，编辑 `docker-compose.yml`：

```yaml
services:
  backend:
    ports:
      - "5000:5000"  # 修改外部端口

  frontend:
    ports:
      - "3000:80"    # 修改外部端口
```

### 3. 环境变量（可选）

```bash
# Flask 配置
FLASK_ENV=development
FLASK_DEBUG=true

# 其他 APIs（如已配置）
GOOGLE_API_KEY=...
GOOGLE_CSE_ID=...
VISION_API_KEY=...
```

---

## 🧪 测试和调试

### 运行自动测试

```bash
cd /Users/allan/Senior-design
python test_cooking_guide.py
```

**预期输出：**
```
==================================================
🍳 SmartEats 烹饪指南功能测试
==================================================

📊 测试健康检查...
✅ 状态: {'status': 'healthy', 'timestamp': '2024-03-01T...'}

🎬 测试烹饪指南生成...
✅ 烹饪指南生成成功！
   - 总耗时: 20 分钟
   - 难度: easy
   - 步骤数: 4
   - 视频 URL: /videos/番茄炒蛋_1709292345.mp4

...

🎉 所有测试通过！烹饪指南功能已就绪。
```

### 查看日志

**后端日志：**
```bash
docker-compose logs -f backend
```

**前端日志：**
```bash
docker-compose logs -f frontend
```

### 检查生成的文件

```bash
# 查看生成的视频
ls -lh backend/generated_videos/

# 查看特定视频信息
ffprobe backend/generated_videos/番茄炒蛋_1709292345.mp4
```

---

## 💡 常用技巧

### 1. 快速重启服务

```bash
docker-compose restart
```

### 2. 清空生成的视频

```bash
rm -rf backend/generated_videos/*
```

### 3. 查看 API 文档

访问：http://localhost:5000/docs

### 4. 获取实时进度

后端会在生成过程中输出日志：
```
INFO:app:生成步骤图片...
INFO:app:运行 FFmpeg...
INFO:app:视频生成成功: generated_videos/番茄炒蛋_1709292345.mp4
```

---

## 🎨 自定义功能

### 修改视频样式

编辑 `backend/services/cooking_guide.py` 中的 `create_video_from_steps()` 函数：

```python
# 修改背景颜色
bg_color = (255, 200, 150)  # RGB 值

# 修改文字颜色
text_color = (50, 50, 50)
title_color = (200, 100, 50)

# 修改字体大小
title_font = ImageFont.truetype(..., 60)  # 更大的标题
```

### 修改每步时长

编辑 `create_video_from_steps()` 中：
```python
f.write(f"file '{img_file}'\nDuration 5\n")  # 改为 Duration 10 = 每步 10 秒
```

### 修改视频分辨率

编辑 FFmpeg 命令中的 `scale=1280:720`：
```python
'-vf', 'scale=1920:1080'  # 改为 1080p
```

---

## 📊 性能优化

### 1. 启用缓存

添加到 `backend/services/cooking_guide.py`：
```python
VIDEO_CACHE = {}

def get_cached_video(recipe_name):
    return VIDEO_CACHE.get(recipe_name)

def cache_video(recipe_name, video_url):
    VIDEO_CACHE[recipe_name] = video_url
```

### 2. 后台任务处理

使用 Celery 进行异步处理：
```python
@app.task
def generate_cooking_guide_async(recipe_name, ingredients, steps):
    # 后台执行
    return generate_tutorial_video(...)
```

### 3. CDN 加速

将 `generated_videos/` 目录同步到 CDN

---

## 🔒 安全检查列表

- [ ] API Key 已正确配置
- [ ] 生产环境已禁用 DEBUG 模式
- [ ] 定期清理 `generated_videos` 目录
- [ ] 检查磁盘空间（视频会占用空间）
- [ ] 实施请求限流
- [ ] 定期备份数据库

---

## 📞 常见问题

### Q: 视频生成失败，显示"ffmpeg command not found"
A: FFmpeg 未安装。请运行：
- Mac: `brew install ffmpeg`
- Linux: `sudo apt-get install ffmpeg`
- 或使用 Docker（已预装）

### Q: 生成的视频很大
A: 这是正常的。可以通过调整 FFmpeg 参数优化：
```python
'-c:v', 'libx264',
'-preset', 'fast',  # 快速编码，文件更小
'-crf', '28',       # 质量权衡
```

### Q: 如何修改生成的食材列表
A: 在 `optimize_cooking_steps()` 中修改 Claude 提示词

### Q: 支持多语言吗
A: 支持！修改 Claude 提示词即可：
```python
prompt = f"""
请用中文/英文/日文生成烹饪步骤...
"""
```

---

## 📈 下一步

**建议阅读：**
1. 完整设置指南：`COOKING_GUIDE_SETUP.md`
2. 实现总结：`IMPLEMENTATION_SUMMARY.md`
3. 代码注释：`backend/services/cooking_guide.py`

**可以尝试的功能：**
- 为多个食谱生成视频
- 对比不同菜系的步骤
- 导出视频和打印步骤
- 分享给朋友

---

**祝你用餐愉快！🍳✨**
