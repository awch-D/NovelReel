# NovelReel

AI 驱动的小说转漫剧视频工具，从文本到动态画面全流程自动化。

上传小说 TXT → AI 剧本拆解 → 角色/场景资产生成 → 分镜渲染 → 配音合成 → 漫剧视频输出

## 功能概览

### 已实现

- **小说管理** — 上传 TXT，自动识别章节（支持「第X章」「Chapter X」等多种格式），可手动调整分集
- **AI 剧本生成** — 调用 LLM 将每章转化为结构化分镜脚本，自动提取角色、场景、对白
- **资产库管理** — 角色/场景参考图的生成、候选选择、锁定机制，支持批量操作
- **分镜渲染** — 基于剧本和资产自动生成每个镜头的画面，支持 5 种视觉风格
- **图片预览** — Lightbox 全屏预览角色和场景图片
- **项目设置** — 可视化配置 LLM 接口、图像生成提供商、视觉风格等参数
- **LLM 连接测试** — 一键验证 API 可用性

### 规划中

- **配音** — TTS 语音合成 + 口型同步
- **视频合成** — FFmpeg 合成漫剧视频，支持 BGM、转场特效

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/ui |
| 状态管理 | Zustand |
| 后端 | FastAPI (Python) |
| LLM | OpenAI 兼容 API（支持任意兼容服务） |
| 图像生成 | 即梦 Seedream 4.0 / OpenAI Images API / Mock |
| 桌面端 | Electron（可选） |

## 快速开始

### 环境要求

- Node.js >= 18
- Python >= 3.10

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 API 密钥
uvicorn main:app --reload --port 8001
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:5174`

### 环境变量

在 `backend/.env` 中配置：

```env
# LLM 接口（OpenAI 兼容）
LLM_BASE_URL=https://api.openai.com
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4o

# 图像生成（可选 mock / api / jimeng）
IMAGE_PROVIDER=mock
IMAGE_BASE_URL=https://api.openai.com
IMAGE_API_KEY=sk-xxx
IMAGE_MODEL=dall-e-3

# 即梦 Seedream（当 IMAGE_PROVIDER=jimeng 时需要）
JIMENG_ACCESS_KEY_ID=
JIMENG_SECRET_ACCESS_KEY=
```

也可以在前端「项目设置」面板中直接配置，优先级高于 `.env`。

## 项目结构

```
NovelReel/
├── backend/
│   ├── main.py              # FastAPI 入口 + API 端点
│   ├── pipeline.py          # 管线编排（章节切分→脚本→资产→分镜）
│   ├── config.py            # 配置管理
│   ├── clients/
│   │   ├── llm.py           # LLM 客户端（重试 + JSON 模式）
│   │   └── comfyui.py       # 图像生成客户端（Mock/API/即梦）
│   ├── prompts/
│   │   └── script.py        # 剧本提示词 + SD Prompt 构建
│   └── utils/
│       ├── chapter_split.py # 章节识别（多格式 + 降级切分）
│       └── json_repair.py   # LLM JSON 输出修复
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── panels/      # 小说/剧本/资产/分镜/设置面板
│       │   └── dialogs/     # 新建项目/图片预览对话框
│       ├── stores/          # Zustand 状态管理
│       ├── services/        # API 调用层
│       └── components/      # 布局 + UI 组件
└── projects/                # 运行时项目数据（gitignore）
```

## 工作流程

```
1. 上传小说 TXT
2. 运行管线 → AI 自动拆解剧本、提取角色和场景
3. 在资产库中审核/重新生成角色和场景参考图，锁定满意的版本
4. 自动生成分镜帧
5. （后续）配音 + 视频合成 → 输出漫剧视频
```

## 支持的视觉风格

| 风格 | 说明 |
|---|---|
| anime_cel | 动漫赛璐璐风格 |
| comic_realistic | 写实漫画风格 |
| chinese_ink | 中国水墨风格 |
| webtoon | 韩漫风格 |
| pixar_3d | 3D 皮克斯风格 |

## 许可证

[Apache License 2.0](LICENSE)
