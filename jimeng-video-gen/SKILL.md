---
name: jimeng-video-gen
description: 使用即梦AI视频生成3.0 Pro（火山引擎）生成视频，支持文生视频和图生视频。触发词：即梦视频、即梦生成视频、jimeng video、text to video、image to video、t2v、i2v。当用户需要生成短视频、将图片动态化、或在 Novel2Toon 流水线中为分镜生成动态视频时使用。
---

# 即梦视频生成 3.0 Pro

通过火山引擎 API 生成 5~10 秒视频，支持文生视频和图生视频（首帧），1080P 输出。

## 配置

`config.json` 放在 skill 根目录，包含火山引擎凭证：

```json
{
  "access_key_id": "AKLT...",
  "secret_access_key": "..."
}
```

凭证获取：[火山引擎控制台](https://console.volcengine.com/iam/keymanage/) → 密钥管理。
需在控制台开通「即梦AI-视频生成3.0 Pro」服务。

## 使用

运行 `scripts/generate_video.py`：

```bash
# 文生视频
python scripts/generate_video.py --prompt "一个动漫少年站在城市街头，微笑转头"

# 图生视频（首帧）
python scripts/generate_video.py --image photo.png --prompt "人物微笑转头看向镜头"

# 10秒视频 + 竖屏
python scripts/generate_video.py --prompt "..." --frames 241 --aspect-ratio 9:16

# 图片 URL
python scripts/generate_video.py --image "https://example.com/img.png" --prompt "镜头缓慢推近"
```

参数：
- `--prompt`：视频描述（文生视频必填，图生视频可选）
- `--image`：图片路径或 URL（不传则为文生视频）
- `--output`：输出目录，默认当前目录
- `--frames`：总帧数，121=5秒，241=10秒（默认 121）
- `--aspect-ratio`：宽高比，默认 `16:9`（可选 4:3, 1:1, 3:4, 9:16, 21:9）
- `--seed`：随机种子，-1 为随机
- `--timeout`：最大等待秒数，默认 300

输出 JSON：
```json
{"success": true, "video_path": "./jimeng_video_20260307_120000.mp4", "video_url": "https://...", "task_id": "..."}
```

## 提示词示例

| 场景 | prompt |
|------|--------|
| 人物说话 | `人物微笑说话，嘴部自然张合` |
| 镜头推近 | `镜头缓慢推近，背景微微虚化` |
| 风吹效果 | `头发随风飘动，衣服轻微摆动` |
| 转头动作 | `人物缓慢转头看向镜头` |
| 静态场景 | `树叶轻微摇晃，光影变化` |
| 多镜头叙事 | `少年走过街角，镜头跟随，切到近景特写` |

## 错误处理

| code | 含义 | 处理 |
|------|------|------|
| 401 / 50400 | 未开通服务 | 在火山引擎控制台开通即梦视频生成 3.0 Pro |
| 50411-50413 | 输入审核失败 | 修改图片或提示词 |
| 50516 | 输出视频审核失败 | 可重试 |
| 50429/50430 | QPS/并发超限 | 稍后重试 |
| 50500/50501 | 内部错误 | 可重试 |

## API 细节

- 端点：`https://visual.volcengineapi.com`
- 签名：HMAC-SHA256（Region=cn-north-1, Service=cv）
- 提交：`CVSync2AsyncSubmitTask`，req_key=`jimeng_ti2v_v30_pro`
- 轮询：`CVSync2AsyncGetResult`，间隔 5s
- 返回：`data.video_url`（有效期 1 小时）
- 图片限制：JPEG/PNG，最大 4.7MB，分辨率最大 4096x4096，长短边比 ≤3

## 与即梦图片生成联动

先用 `jimeng-image-gen` 生成静态图，再转为视频：

```bash
# 1. 生成图片
python ~/.claude/skills/jimeng-image-gen/scripts/generate.py --prompt "动漫少年站在街头"
# 2. 图片转视频
python scripts/generate_video.py --image output/jimeng_xxx.png --prompt "少年微笑转头"
```
