# Novel2Toon AI — V0 最小验证版

## 目标

用最粗糙的方式跑通 **TXT → 剧本 JSON → 分镜图** 的完整链路。

验证两个核心假设：
1. LLM 能否输出结构可用的剧本（角色/场景/对白/分镜描述）
2. ComfyUI 能否生成一致性可接受的角色图

不做任何精细交互，不做审核流程，不做资产管理。全自动一把梭，跑完看结果。

---

## 一、流程

```
上传 TXT
  → 章节切分（正则，失败则按字数切）
    → LLM 分析（提取角色/场景）
      → LLM 生成剧本 JSON（含对白+分镜描述）
        → ComfyUI 生成角色基准图
          → ComfyUI 渲染分镜帧
            → 输出：剧本 JSON + 分镜图文件夹
```

全程无用户交互，上传后一键跑完。

---

## 二、砍掉的功能

| 完整版功能 | V0 处理方式 |
|---|---|
| 多卷上传排序 | 只支持单文件上传 |
| 手动调整分集边界 | 自动切分，不可调 |
| 大纲生成（单独步骤） | 合并到剧本生成中，LLM 一步出剧本 |
| 用户审核/编辑剧本 | 不审核，直接用 |
| 资产库（候选图/锁定/解锁/版本） | 自动生成一张基准图直接用，无选择 |
| Prompt 预览编辑框 | 直接用 LLM 描述 |
| 分镜帧重新生成/批量标记 | 不支持，一次性生成 |
| 阶段门控 | 无门控，顺序执行 |
| WebSocket 进度推送 | 轮询或日志输出 |
| 项目设置面板 | 硬编码默认值 |
| 项目封面 | 不需要 |
| 断点续跑 | 不支持，失败重跑 |
| 底部状态栏/进度环 | 不需要 |

---

## 三、技术栈（精简）

```
┌─────────────────────────────────┐
│         FastAPI 后端             │
│         (port 8000)             │
└───┬──────────────┬──────────────┘
    │              │
    ▼              ▼
  LLM API       ComfyUI
(jimu.ffa)     (:8188)
```

- 无前端，纯 API + 命令行调用
- 无 Celery，同步执行（或简单 asyncio）
- 无 SQLite，纯文件系统
- 无 Redis

---

## 四、API（3 个端点）

```
POST   /api/projects                    创建项目 + 上传 TXT（multipart）
POST   /api/projects/{id}/run           一键跑完全流程
GET    /api/projects/{id}/status        查看状态（running/done/error）
```

---

## 五、LLM 链（简化为 2 步）

### 步骤 1：分析 + 剧本（合并）

```
输入：章节原文
输出：JSON
{
  "characters": [
    { "id": "char_001", "name": "李逍遥", "appearance": "18岁少年，白衣..." }
  ],
  "scenes": [
    { "id": "scene_001", "name": "客栈", "description": "古风客栈大堂..." }
  ],
  "episodes": [
    {
      "episode": 1,
      "shots": [
        {
          "shot_id": "s01_001",
          "description": "少年推门而入，环顾四周",
          "characters": ["char_001"],
          "scene": "scene_001",
          "dialogue": [
            { "character": "char_001", "text": "这里就是龙门客栈？" }
          ]
        }
      ]
    }
  ]
}
```

不需要情感标签、运镜、VFX、时长。只要画面描述 + 角色 + 对白。

### 步骤 2：生成图像 Prompt

```
输入：shot.description + character.appearance + scene.description + 风格关键词
输出：SD prompt（英文）
```

可以用 LLM 翻译+优化，也可以用模板拼接。V0 先用模板拼接，不够好再换 LLM。

---

## 六、图像生成（简化）

### 角色基准图

```
输入：character.appearance → SD prompt
方式：Text2Img，一个角色只生成 1 张
输出：assets/characters/{char_id}/ref.png
```

### 分镜帧

```
输入：角色基准图 + 场景描述 + 动作描述 → SD prompt
方式：IP-Adapter（角色基准图）+ Text2Img
输出：frames/episode_{n}/shot_{id}.png
```

不做：
- 多角色同框分区域生成（V0 直接在 prompt 里描述多角色）
- ControlNet 姿态控制
- 连续镜头 Img2Img
- I2V 微动视频

---

## 七、项目目录（精简）

```
projects/{project_id}/
  novel.txt                      # 上传的原文
  script.json                    # LLM 输出的剧本
  assets/
    characters/
      {char_id}/ref.png          # 角色基准图（1张）
    scenes/
      {scene_id}/ref.png         # 场景基准图（1张）
  frames/
    episode_01/
      shot_{id}.png              # 分镜帧
  status.json                    # { status, current_step, error }
```

---

## 八、项目结构（精简）

```
novel2toon/
├── main.py                      # FastAPI 入口（3 个端点）
├── config.py                    # 硬编码配置 + .env 覆盖
├── requirements.txt             # fastapi, uvicorn, aiohttp, Pillow
├── pipeline.py                  # 顺序执行：切分 → LLM → 生图
├── clients/
│   ├── llm.py                   # LLM 客户端
│   └── comfyui.py               # ComfyUI 客户端（含 mock 模式）
├── utils/
│   ├── chapter_split.py         # 章节切分
│   └── json_repair.py           # JSON 修复
└── prompts/
    └── script.py                # 剧本生成 prompt 模板
```

---

## 九、硬编码默认值

| 参数 | V0 默认值 |
|---|---|
| 分集规则 | 1 章 = 1 集 |
| 视觉风格 | anime_cel |
| 基础模型 | SDXL 1.0 |
| 输出分辨率 | 1024×1024（SD 原生，不做裁切） |
| 候选图数量 | 1（不选，直接用） |

---

## 十、验证标准

V0 成功的标准：

1. 上传一个 3 章短篇 TXT，系统自动输出 3 集的剧本 JSON
2. JSON 结构完整可解析，角色/场景/对白信息齐全
3. 每个角色有一张风格统一的基准图
4. 每个镜头有一张分镜帧，角色面部特征与基准图基本一致
5. 全流程无需人工干预，从上传到出图 < 30 分钟（3 章约 15-20 个镜头）

V0 不关心的：
- 角色在不同镜头间的姿态/服装一致性
- 多角色同框的质量
- 画面构图和美感
- 对白/情感的准确性

---

## 十一、V0 → V1 升级路径

V0 验证通过后，按以下顺序逐步升级到完整版：

| 优先级 | 升级项 | 原因 |
|---|---|---|
| 1 | 加前端（项目列表 + 工作台壳子） | 有了 UI 才能给人看 |
| 2 | 资产库（候选图选择 + 锁定） | 用户需要控制角色形象 |
| 3 | 剧本审核编辑 | 用户需要修正 LLM 错误 |
| 4 | 分镜重新生成 | 用户需要挑选满意的图 |
| 5 | 阶段门控 + 进度推送 | 流程控制 |
| 6 | 多角色同框 + ControlNet | 画面质量提升 |
| 7 | 配音 + 口型 + 视频合成 | 完整管线 |
