# Novel2Toon AI — 实施计划（V1 完整版）

> 本文档为 V1 完整版实施计划。V0 最小验证版见 [FEATURES_V0.md](./FEATURES_V0.md)。
> 开发顺序：先完成 V0 验证核心假设，再按 V0 → V1 升级路径逐步迭代。

## 项目定位

**TXT → AI 漫剧视频** 全自动化平台。

输入一本小说 TXT，经过 4 个阶段的管线处理，输出带配音、口型同步、特效、BGM 的漫剧风格视频。每个阶段支持暂停、用户审核、手动调整后继续。

---

## 一、业务流程总览

```
TXT 上传（支持多卷，用户排序后合并）
  │
  ▼
┌─────────────────────────────────────────────────────┐
│ 阶段 0：项目初始化                                    │
│  · 用户上传 TXT（单卷或多卷拖拽排序）                  │
│  · 用户设置：分集规则 / 风格 / 字幕开关 / BGM 来源     │
│  · 章节识别预览，用户可手动调整分集边界                 │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ 阶段 1：剧本解析（LLM）                               │
│  · 章节切分 → 分集（支持多种章节格式，失败降级字数切分）│
│  · 故事分析 → 角色/场景/道具提取（建立全局注册表）      │
│  · 结构化剧本生成（含对白+情感标签+旁白标记）           │
│  · 分镜脚本生成（含镜头时长、运镜、VFX 标记）           │
│  ⏸ 用户审核：可修改剧本、调整镜头、增删角色              │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ 阶段 2a：资产生成（ComfyUI + SD）                     │
│  · 角色/场景/道具：生成候选图 或 用户直接上传           │
│  · 用户从候选图中选择并锁定基准图                      │
│  · 支持解锁→保存到资产库/移除→重新锁定                 │
│  ⏸ 资产库随时可进入（不设门控），但 2b 渲染按钮在有未锁定资产时置灰 │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ 阶段 2b：分镜渲染（ComfyUI + SD）                     │
│  · 分镜渲染：IP-Adapter + ControlNet + Img2Img        │
│  · 多角色同框：分区域生成                              │
│  · I2V 微动视频：静态帧 → 2-3 秒动画                   │
│  ⏸ 用户审核：可重新生成不满意的图/视频                  │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ 阶段 3：配音 + 口型同步                               │
│  · TTS：GPT-SoVITS，按角色音色+情感标签生成语音         │
│  · 多对白合并：同镜头多条对白顺序拼接（300ms 停顿间隔）  │
│  · 口型同步：InsightFace 定位人脸 + SadTalker          │
│  ⏸ 用户审核：可重新生成某条语音                        │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ 阶段 4：视频合成（FFmpeg）                             │
│  · 镜头时长 = 合并音频时长 + 留白 / LLM 建议时长        │
│  · 叠加口型 → 混入语音 → VFX 特效 → 拼接 → BGM        │
│  · 可选：烧录字幕                                     │
│  ⏸ 用户审核：可调整 BGM、字幕样式、重新合成              │
└──────────────────────┬──────────────────────────────┘
                       ▼
                  最终 MP4 输出
```

---

## 二、用户可控参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| 分集规则 | 1章/集、2章/集、3章/集 | 1章/集 |
| 视觉风格 | anime_cel / comic_realistic / chinese_ink / webtoon / pixar_3d | anime_cel |
| 风格作用域 | 全片统一 或 按集选择 | 全片统一 |
| 输出分辨率 | 1920×1080 (16:9) / 1080×1920 (9:16竖屏) / 1080×1080 (1:1) | 1920×1080 |
| 字幕开关 | 是否在视频中烧录字幕 | 关闭 |
| 字幕样式 | 底部居中 / 对话气泡 / 画面内嵌 | 底部居中 |
| BGM 来源 | 预设曲库 / 用户上传 / AI 生成 | 预设曲库 |
| 基础模型 | SDXL 1.0 / Flux.1-dev | SDXL 1.0 |

---

## 三、阶段 1 详细流程 — 剧本解析

### 3.1 章节切分与分集

- 按章节标记识别切分，支持格式：`第X章`、`第X回`、`卷X`、`番外X`、`楔子`、`序章`、`尾声`、`Chapter X`、`Part X`
- 识别失败时（找不到任何章节标记）降级为按字数切分（默认每 5000 字一集，可配置）
- 前端在"小说管理"面板展示识别结果，用户可手动调整分集边界
- 根据用户设定的分集规则合并章节（1/2/3 章 = 1 集）
- 多卷上传：用户可上传多个 TXT，前端支持拖拽排序，确认后按序合并，卷间插入分隔标记

### 3.1.1 LLM 上下文管理策略

- 全局注册表：analyze 阶段建立全量角色/场景/道具注册表（含 ID）
- 按集过滤：每集 LLM 调用只携带当前集出场的角色和涉及的场景/道具，不携带全量数据
- 前情摘要：每集携带上一集的 200 字摘要作为上下文连贯性保障（第一集无前情摘要，该字段省略）
- 旁白角色：注册表中自动添加 `narrator`（旁白）角色，用于内心独白和叙述性文字的 TTS

### 3.2 LLM 链

```
原文 → analyze（故事线分析）
         → extract_assets（角色/场景/道具提取）
           → outline（每集大纲）
             → script（结构化剧本）
               → storyboard（分镜脚本）
```

### 3.2.1 LLM 输出截断处理

- 检测：JSON 解析失败且末尾无闭合括号时判定为截断
- 自动续写：携带已输出内容末尾 500 字作为上下文，请求 LLM 续写剩余部分
- 合并：将续写结果拼接到截断位置，再次尝试 JSON 解析 + json_repair
- 失败兜底：续写一次仍失败则报错，用户可手动点击重试

### 3.3 结构化剧本格式

每集输出一个 JSON，核心结构：

```json
{
  "episode": 1,
  "title": "初入江湖",
  "scenes": [
    {
      "scene_id": "s01",
      "location": "客栈大堂",
      "time": "夜晚",
      "shots": [
        {
          "shot_id": "s01_001",
          "type": "static",            // static | action | closeup
          "description": "少年推门而入，环顾四周",
          "camera": "medium_shot",     // wide / medium / close_up / extreme_close_up
          "camera_motion": "pan_left", // static / pan_left / pan_right / zoom_in / zoom_out / tilt_up / tilt_down
          "duration_hint": 3.0,        // LLM 建议时长（秒）
          "character_ids": ["char_001"],  // 引用 character_id，非名称
          "prop_ids": ["prop_001"],       // 引用 prop_id
          "vfx": [],                   // rain / fire / sparkle / speed_lines / screen_shake
          "multi_character": false,    // 是否多角色同框
          "character_positions": [     // 多角色同框时各角色的画面位置
            { "character_id": "char_001", "position": "left" }
            // position 合法值: left / center / right / left-back / right-back
            // 系统按角色数量给出默认布局，用户可调整
          ],
          "dialogue": [
            {
              "line_id": "line_001",
              "character_id": "char_001",
              "text": "这里就是传说中的龙门客栈？",
              "emotion": "surprised",
              "is_narration": false    // 旁白/内心独白标记
            }
          ],
          "prev_shot_ref": null        // 动作连续镜头引用前一帧 shot_id
        }
      ]
    }
  ]
}
```

### 3.4 情感标签集

`neutral` / `happy` / `sad` / `angry` / `fearful` / `surprised` / `determined` / `disgusted`

### 3.5 镜头时长规则

| 镜头类型 | 有对白 | 无对白 |
|---|---|---|
| 大场景 (wide) | 对白时长 + 1s 留白 | 3-5s（LLM 建议） |
| 中景 (medium) | 对白时长 + 0.5s | 2-3s |
| 特写 (close_up) | 对白时长 + 0.3s | 1.5-2s |
| 动作场面 | 对白时长 + 0.5s | 2-3s |

---

## 四、阶段 2 详细流程 — 视觉生成

### 4.1 技术栈

- 后端框架：**ComfyUI**（节点式工作流，保存为 JSON，Python 后端加载并替换参数）
- 基础模型：**SDXL 1.0**（默认）或 **Flux.1-dev**（高质量选项），由用户在项目设置中选择
- 一致性技术：**IP-Adapter** + **ControlNet** + **风格 LoRA**
- 姿态生成：**ControlNet Pose Editor**（AI 姿态生成，LLM 输出姿态关键词映射到预制骨架模板库）
- 人脸检测：**InsightFace**（多角色同框时定位各角色人脸区域，用于口型同步的面部裁剪）

### 4.2 资产生成流程

#### 第一步：角色资产 (Character Asset)

```
输入：LLM 提取的角色外貌描述
      e.g. "18岁少年，黑色短发，蓝色校服，坚定的眼神"
技术：Text2Img + 风格 LoRA
输出：生成多张不同角度的候选图
动作：用户选择一张作为「角色基准图」→ 锁定
```

#### 第二步：场景资产 (Scene Asset)

```
输入：环境描述 e.g. "赛博朋克城市街道，霓虹灯，雨夜"
技术：Text2Img + 场景 LoRA
输出：不含人物的空镜背景
动作：用户确认 → 锁定为「场景基准图」
```

#### 第三步：道具/物体资产 (Prop Asset)

```
输入：道具描述 e.g. "古铜色长剑，剑柄缠红绳"
技术：Text2Img
输出：道具参考图 → 锁定
```

### 4.3 分镜渲染流程（核心循环）

对剧本中的每个镜头，根据 `type` 选择不同的生成策略：

#### 场景 A：静态对白镜头 (type: static)

```
输入：角色基准图 + 场景基准图 + 动作描述 + 表情描述
技术：
  · IP-Adapter（角色基准图）→ 锁定人脸
  · ControlNet OpenPose（AI 姿态生成）→ 锁定姿态
  · Prompt 描述表情和环境细节
输出：高质量对白分镜图
```

#### 场景 A2：多角色同框镜头 (type: static, multi_character: true)

```
输入：多个角色基准图 + 场景基准图 + 各角色位置/动作/表情描述
技术（分区域生成）：
  1. 先生成纯背景（场景基准图 Img2Img，低 denoising）
  2. 按 character_positions 逐个角色 Inpainting 到指定区域
     · 每个区域独立使用该角色的 IP-Adapter
     · ControlNet OpenPose 控制该角色姿态
  3. 最终合并为完整帧
注意：主角优先级高于配角，主角区域最后渲染（覆盖在上层）
输出：多角色同框分镜图
```

#### 场景 B：动作连续镜头 (type: action)

```
输入：前一帧图片 (prev_shot_ref) + 新动作描述
技术：
  · Img2Img（前一帧作为参考）
  · Denoising Strength: 0.5-0.6（改变动作，保留角色特征和环境）
  · ControlNet Canny/Depth → 锁定环境不乱跳
输出：保持角色+环境连续性的动作图
```

#### 场景 C：特写表情变化 (type: closeup)

```
输入：前一帧图片 + 新表情描述
技术：
  · Img2Img 局部重绘 (Inpainting)
  · 只选取脸部区域重绘
  · Denoising Strength: 0.3-0.4（只改表情细节）
输出：角色特征不变，表情已改变的图
```

### 4.4 I2V 微动视频

- 静态分镜帧 → 2-3 秒微动视频
- camera_motion 映射为 I2V prompt（pan/zoom/tilt）
- MVP 阶段用 mock（FFmpeg 循环+Ken Burns 效果），后续接 Runway/CogVideo

### 4.5 一致性保障原则

> **核心原则：一旦锁定基准图，所有后续生成必须严格参照基准图，确保视觉一致性。**

- 角色：IP-Adapter 注入角色基准图，每一帧都引用
- 场景：同一场景的所有镜头共享场景基准图
- 道具：出现道具的镜头通过 prompt + 参考图约束
- 连续镜头：Img2Img 以前一帧为输入，低 denoising 保持连续性

### 4.6 资产解锁与替换

- 用户可对已锁定的基准图执行「解锁」操作
- 解锁后可选择：**保存到资产库**（保留历史版本）或 **移除**（删除该基准图）
- 解锁并替换新基准图后，系统按 character_id / scene_id / prop_id 全局匹配所有集的关联分镜帧，标记为「需重新生成」
- 解锁前弹出确认弹窗，显示影响范围（X 集 Y 个镜头）
- 资产库中可保存多个版本，用户可随时切换使用哪个版本作为当前基准图

---

## 五、阶段 3 详细流程 — 配音 + 口型

### 5.1 TTS 语音生成

```
输入：对白文本 + 角色音色配置 + 情感标签
服务：GPT-SoVITS (localhost:9880)
流程：
  1. 从 shots.json 提取所有 dialogue 行
  2. 按角色分组，每个角色绑定一个音色 (voice_id + 参考音频)
  3. 按 emotion 标签选择对应的情感参考音频
  4. POST /tts → 返回 WAV
  5. 同一镜头多条对白：顺序拼接，条间插入 300ms 静音
     → 合并为 shot_{id}_dialogue.wav
     → 镜头总时长 = 合并音频时长 + 镜头类型留白
输出：每条对白 line_{id}.wav + 每个镜头 shot_{id}_dialogue.wav
```

### 5.2 口型同步

```
输入：角色面部裁剪图 + 对应音频 WAV
服务：SadTalker Gradio API (localhost:7860)
参数：still_mode=True（保持漫画风格，不做头部大幅运动）
流程：
  1. InsightFace 检测分镜帧中的所有人脸，输出人脸边界框 + 角色匹配
  2. 根据 dialogue.character_id 找到对应角色的人脸区域并裁剪
  3. 多角色同框时：按对白顺序逐条处理，每条只处理说话角色的人脸
  4. 调用 SadTalker 生成口型视频
  5. 无人脸的镜头自动跳过
输出：line_{id}_lipsync.mp4
```

---

## 六、阶段 4 详细流程 — 视频合成

### 6.1 镜头时长计算

```
有对白：音频实际时长 + 留白（按镜头类型查表）
无对白：LLM 在分镜脚本中标注的 duration_hint
```

### 6.2 单镜头合成流水线

```
I2V 微动视频 / 静态图循环
  → 叠加口型视频（alpha blend 到人脸区域）
    → 混入对白音频
      → 应用 VFX 特效（FFmpeg filter chain）
        → 输出单镜头 clip
```

### 6.3 VFX 特效映射

| 关键词 | FFmpeg 实现 |
|---|---|
| rain | 半透明雨滴粒子叠加层 |
| fire | 火焰粒子 + 暖色调滤镜 |
| sparkle | 闪光粒子叠加 |
| speed_lines | 径向模糊 + 速度线叠加 |
| screen_shake | 随机位移 crop |

### 6.4 全集合成

```
所有镜头 clip 按顺序拼接 (concat)
  → 混入 BGM（淡入淡出，对白段自动降低 BGM 音量）
    → 可选：烧录字幕（样式由用户选择）
      → 输出 episode_{n}.mp4
```

### 6.5 字幕样式

| 样式 | 说明 |
|---|---|
| 底部居中 | 经典字幕条，半透明黑底白字 |
| 对话气泡 | 漫画风格气泡，指向说话角色 |
| 画面内嵌 | 文字直接渲染在画面中，带描边 |

### 6.6 BGM 来源

| 来源 | 实现 |
|---|---|
| 预设曲库 | 按情绪分类的 BGM 库（战斗/温馨/悲伤/日常/紧张） |
| 用户上传 | 支持 mp3/wav/flac，用户指定使用范围（全片/某集） |
| AI 生成 | 集成 AI 音乐生成服务，按场景情绪自动生成 |

---

## 七、ComfyUI 集成方案

### 7.1 架构

```
Novel2Toon 后端 (FastAPI)
  │
  │  HTTP API 调用
  ▼
ComfyUI Server (localhost:8188)
  │
  │  加载 workflow JSON → 替换参数 → 执行
  ▼
Stable Diffusion 推理
```

### 7.2 工作流模板

为每种生成场景预制 ComfyUI workflow JSON：

| 工作流 | 用途 |
|---|---|
| `wf_character_sheet.json` | 角色基准图生成（Text2Img + 风格 LoRA） |
| `wf_scene_ref.json` | 场景基准图生成 |
| `wf_prop_ref.json` | 道具参考图生成 |
| `wf_shot_static.json` | 静态镜头（IP-Adapter + ControlNet OpenPose） |
| `wf_shot_action.json` | 动作连续镜头（Img2Img + ControlNet Canny/Depth） |
| `wf_shot_closeup.json` | 特写表情变化（Inpainting） |

### 7.3 参数替换

Python 后端加载 workflow JSON，动态替换：
- Prompt 文本（正向/负向）
- 参考图路径（角色基准图、场景基准图、前一帧）
- LoRA 名称和权重
- ControlNet 模型和参数
- Denoising Strength
- 输出路径

---

## 八、项目结构（更新）

```
novel2toon/
├── main.py                      # FastAPI 入口
├── config.py                    # Pydantic BaseSettings (.env)
├── requirements.txt
├── .env.example
├── core/
│   ├── pipeline.py              # 管线编排器（按阶段顺序执行，支持暂停/恢复）
│   ├── project.py               # 项目 CRUD + 目录布局
│   └── task_runner.py           # Celery 任务包装
├── models/
│   ├── project.py               # ProjectMeta, ProjectStatus, ProjectSettings
│   ├── character.py             # Character, VoiceProfile
│   ├── scene.py                 # Scene, Prop
│   ├── shot.py                  # Shot, CameraMotion, VFXOverlay
│   ├── audio.py                 # VoiceLine, LipSyncJob
│   └── video.py                 # VideoClip, AssemblyPlan
├── stages/
│   ├── s1_script.py             # 阶段1: LLM 剧本引擎
│   ├── s2_visual.py             # 阶段2: ComfyUI 视觉生成
│   ├── s3_audio.py              # 阶段3: TTS + 口型同步
│   └── s4_assembly.py           # 阶段4: FFmpeg 视频合成
├── clients/
│   ├── llm.py                   # OpenAI 兼容 LLM 客户端
│   ├── comfyui.py               # ComfyUI API 客户端
│   ├── video.py                 # I2V 视频客户端 (Runway/CogVideo/mock)
│   ├── tts.py                   # GPT-SoVITS 客户端
│   ├── lipsync.py               # SadTalker 客户端
│   ├── face_detect.py           # InsightFace 人脸检测客户端
│   └── bgm.py                   # BGM 服务客户端（AI 生成）
├── workflows/                   # ComfyUI 工作流模板
│   ├── wf_character_sheet.json
│   ├── wf_scene_ref.json
│   ├── wf_prop_ref.json
│   ├── wf_shot_static.json
│   ├── wf_shot_static_multi.json  # 多角色同框（分区域生成）
│   ├── wf_shot_action.json
│   └── wf_shot_closeup.json
├── api/
│   ├── projects.py              # /projects CRUD + 设置
│   ├── pipeline.py              # /run, /run/{stage}, /pause, /resume, /cancel
│   ├── assets.py                # 资产管理（查看/锁定/重新生成）
│   └── ws.py                    # WebSocket 进度推送
├── utils/
│   ├── file_io.py               # JSON/文本读写
│   ├── json_repair.py           # LLM JSON 输出修复
│   └── ffmpeg.py                # FFmpeg 子进程封装
├── prompts/
│   ├── analysis.py              # 小说分析提示词
│   ├── outline.py               # 大纲生成提示词
│   ├── script.py                # 剧本生成提示词（含情感标签）
│   ├── assets.py                # 角色/场景/道具资产提取提示词
│   └── storyboard.py            # 分镜生成提示词（含时长/运镜/VFX）
└── resources/
    └── bgm/                     # 预设 BGM 曲库
        ├── battle/
        ├── warm/
        ├── sad/
        ├── daily/
        └── tense/
```

### 运行时项目目录

```
projects/{project_id}/
  meta.json                      # 项目元数据 + 用户设置
  novels/                        # 上传的 .txt
  analysis/
    storyline.json               # 故事线分析
    characters.json              # 角色列表 + 外貌描述
    scenes.json                  # 场景列表
    props.json                   # 道具列表
  outlines/
    episode_01.json              # 每集大纲
  scripts/
    episode_01.json              # 结构化剧本（含对白+情感标签）
  storyboard/
    episode_01/
      shots.json                 # 分镜脚本
  assets/
    characters/
      {char_id}/                 # 用 ID 命名，非中文名
        meta.json                # { id, name, description, locked, current_ref }
        ref.png                  # 当前锁定的基准图
        library/                 # 资产库（历史版本，用户可保存多个）
          v1.png
          v2.png
        candidates/              # 最新一批候选图（供用户选择）
        voice/                   # 音色参考音频
    scenes/
      {scene_id}/
        meta.json
        ref.png
        library/
        candidates/
    props/
      {prop_id}/
        meta.json
        ref.png
        library/
        candidates/
  frames/
    episode_01/
      shot_{id}.png              # 分镜帧
  videos/
    episode_01/
      shot_{id}.mp4              # I2V 微动视频
  audio/
    episode_01/
      lines/
        line_{id}.wav            # TTS 语音
      lipsync/
        line_{id}_lipsync.mp4    # 口型视频
  bgm/                           # 本集使用的 BGM
  output/
    episode_01.mp4               # 最终成品
```

---

## 九、关键技术决策

| 维度 | 方案 |
|---|---|
| LLM | OpenAI 兼容 API (jimu.ffa.chat) |
| 图像生成 | ComfyUI + SDXL 1.0 / Flux.1-dev |
| 一致性 | IP-Adapter + ControlNet + LoRA |
| 多角色同框 | 分区域生成（背景→逐角色 Inpainting） |
| 姿态生成 | ControlNet Pose Editor（AI 姿态，映射预制骨架模板库） |
| 人脸检测 | InsightFace（多角色人脸定位 + 角色匹配） |
| TTS | GPT-SoVITS 本地部署 (port 9880) |
| 多对白合并 | 顺序拼接 + 300ms 静音间隔，合并为单镜头音频 |
| 旁白 | narrator 角色，独立音色配置 |
| 口型 | SadTalker Gradio API (port 7860) |
| I2V | MVP: FFmpeg mock，后续: Runway/CogVideo |
| BGM | 预设曲库 + 用户上传 + AI 生成服务 |
| 任务队列 | Celery + Redis |
| 视频合成 | FFmpeg subprocess |
| 数据库 | SQLite（元数据）+ 文件系统（二进制资产） |
| 配置 | Pydantic BaseSettings + .env |
| 交互模式 | 每阶段可暂停，用户审核后继续；阶段门控防止跳步 |
| 资产 ID | 所有资产使用 ID 引用（char_001 等），名称仅作显示 |
| 章节识别 | 多格式支持，失败降级字数切分，前端可手动调整 |
| 候选图数量 | 默认 4 张，项目设置可调（2/4/6） |
| 项目封面 | 自动取第一集第一帧，用户可手动替换 |
| 用户上传资产 | 支持直接上传图片作为候选图，与生成候选图流程统一 |

---

## 十、待解决事项（后续记录）

| # | 事项 |
|---|---|
| 10 | ComfyUI 工作流版本管理：不同 SD 模型/插件版本的工作流不兼容，需版本锁定策略 |
| 11 | 生成成本估算：一集约多少镜头、多少次 SD 推理、多少次 LLM 调用，需给用户预期 |
| 12 | 旁白/内心独白：已通过 narrator 角色 + is_narration 字段处理，TTS 使用独立旁白音色 |

---

## 十一、实施步骤

| Step | 内容 | 依赖 |
|---|---|---|
| 1 | 项目骨架 + 配置 + 数据模型 + SQLite | — |
| 2 | 工具层（file_io / json_repair / ffmpeg） | Step 1 |
| 3 | 客户端层（llm / comfyui / tts / lipsync / video / bgm / face_detect） | Step 1 |
| 4 | 阶段1：剧本引擎 + 所有 prompts | Step 2, 3 |
| 5 | 阶段2a：资产生成（候选图生成 + 用户上传 + 锁定） | Step 3, 4 |
| 6 | 阶段2b：分镜渲染（依赖资产全部锁定） | Step 5 |
| 7 | 阶段3：TTS + 口型同步 | Step 3, 4 |
| 8 | 阶段4：FFmpeg 视频合成 | Step 6, 7 |
| 9 | 管线编排 + API + WebSocket | Step 4-8 |
| 10 | 集成测试 | Step 9 |

---

## 十二、验证方式

1. `uvicorn main:app --reload` 启动服务
2. `POST /api/projects` 创建项目，上传短篇 TXT，设置参数
3. `POST /api/projects/{id}/run/s1` 运行阶段1，审核剧本
4. `POST /api/projects/{id}/run/s2a` 运行阶段2a，锁定所有资产
5. `POST /api/projects/{id}/run/s2b` 运行阶段2b，审核/重新生成分镜帧
6. `POST /api/projects/{id}/run/s3` 运行阶段3，审核语音
7. `POST /api/projects/{id}/run/s4` 运行阶段4，获取最终视频
8. 通过 WebSocket `/ws/projects/{id}/progress` 实时观察进度
9. 检查中间产物完整性
