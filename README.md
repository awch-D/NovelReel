# NovelReel

AI 驱动的小说转漫剧视频工具，从文本到动态画面全流程自动化。

上传小说 TXT → AI 剧本拆解 → 角色/场景资产生成 → 分镜渲染 → 配音合成 → 漫剧视频输出

## 功能概览

- **小说管理** — 上传 TXT，自动识别章节（支持「第X章」「Chapter X」等多种格式），可手动调整分集，支持项目回收站
- **AI 剧本生成** — 调用 LLM 将每章转化为结构化分镜脚本，自动提取角色、场景、对白
- **资产库管理** — 角色/场景/道具参考图的生成、候选选择、锁定机制，支持批量操作
- **分镜渲染** — 基于剧本和资产自动生成每个镜头的画面，支持 5 种视觉风格，可选中批量重新生成
- **配音系统** — 角色参考音频上传、TTS 语音合成、情感标注、按集批量生成与合并
- **视频合成** — FFmpeg 合成漫剧视频，支持 BGM（预设/上传）、字幕叠加、按集或全量合成
- **系统设置** — LLM / 图像 / 视频三类 API 独立配置，一键测试连接，密钥加密存储
- **安全机制** — 输入验证（路径防遍历、文件类型/大小限制）、API 密钥 Fernet 加密、GET 接口掩码返回

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/ui |
| 状态管理 | Zustand |
| 后端 | FastAPI (Python) |
| LLM | OpenAI 兼容 API（支持任意兼容服务） |
| 图像生成 | 即梦 Seedream 4.0 / OpenAI Images API / Mock |
| 视频生成 | 即梦视频生成 3.0 Pro |
| TTS | GPT-SoVITS / 兼容 API |
| 视频合成 | FFmpeg |
| 加密 | cryptography (Fernet) |
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

在 `backend/.env` 中配置（也可在前端「系统设置」面板中配置，优先级更高，且密钥加密存储）：

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

# 即梦图像（当 IMAGE_PROVIDER=jimeng 时需要）
JIMENG_ACCESS_KEY_ID=
JIMENG_SECRET_ACCESS_KEY=

# 视频生成（可选 none / jimeng）
VIDEO_PROVIDER=none
JIMENG_VIDEO_ACCESS_KEY=
JIMENG_VIDEO_SECRET_KEY=
```

## 项目结构

```
NovelReel/
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── pipeline.py          # 管线编排（章节切分→脚本→资产→分镜）
│   ├── config.py            # 配置管理（.env + 系统设置合并）
│   ├── api/
│   │   ├── projects.py      # 项目 CRUD + 回收站
│   │   ├── script.py        # 剧本生成
│   │   ├── assets.py        # 资产管理（角色/场景/道具）
│   │   ├── frames.py        # 分镜渲染
│   │   ├── voice.py         # 配音（TTS + 参考音频）
│   │   ├── synthesis.py     # 视频合成（FFmpeg + BGM + 字幕）
│   │   └── settings.py      # 系统设置（加密存储）
│   ├── clients/
│   │   ├── llm.py           # LLM 客户端（重试 + JSON 模式）
│   │   ├── comfyui.py       # 图像生成客户端（Mock/API/即梦）
│   │   ├── tts.py           # TTS 客户端
│   │   └── lipsync.py       # 口型同步
│   ├── prompts/
│   │   └── script.py        # 剧本提示词 + SD Prompt 构建
│   └── utils/
│       ├── chapter_split.py # 章节识别（多格式 + 降级切分）
│       ├── json_repair.py   # LLM JSON 输出修复
│       ├── crypto.py        # API 密钥加密（Fernet）
│       ├── ffmpeg.py        # FFmpeg 视频处理
│       ├── audio.py         # 音频处理
│       └── project_helpers.py # 项目路径 + 输入验证
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── panels/      # 小说/剧本/资产/分镜/配音/合成/设置面板
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
4. 自动生成分镜帧，可选中重新生成不满意的画面
5. 配音 → 上传角色参考音频，批量生成 TTS 对白
6. 视频合成 → 选择 BGM、字幕设置，按集或全量合成漫剧视频
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
