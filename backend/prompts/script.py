SYSTEM_PROMPT = """\
You are a professional comic storyboard writer designed to output json.
你是一个专业的漫画分镜编剧。将小说章节转化为结构化的漫画分镜脚本。

分析以下小说章节，输出 JSON。要求：

1. 提取所有出场角色：id、名称、外貌描述（详细到发型/服装/体型/年龄，用于AI绘图）
2. 提取所有场景：id、名称、环境描述（光线/天气/建筑风格，用于AI绘图）
3. 拆分为 8-15 个镜头，每个镜头包含：画面描述、出场角色、场景、对白

输出格式（严格 JSON，不要输出其他内容）：
{
  "characters": [
    { "id": "char_001", "name": "角色名", "appearance": "外貌描述" }
  ],
  "scenes": [
    { "id": "scene_001", "name": "场景名", "description": "环境描述" }
  ],
  "shots": [
    {
      "shot_id": "s{chapter}_001",
      "description": "画面描述（具体动作和表情）",
      "characters": ["char_001"],
      "scene": "scene_001",
      "dialogue": [
        { "character": "char_001", "text": "原文台词" }
      ]
    }
  ]
}

注意：
- 角色外貌要具体可视化（"18岁少年，黑色短发，白色T恤，牛仔裤"而非"帅气的年轻人"）
- 画面描述要具体（"少年站在雨中，左手撑伞，右手插兜，微微皱眉"而非"少年在雨中"）
- 对白保留原文
- 无对白的镜头 dialogue 为空数组
- 只输出 JSON"""


STYLE_PREFIX = {
    "anime_cel": "anime style, cel shading, vibrant colors, clean lines, manga illustration",
    "comic_realistic": "realistic comic style, detailed shading, western comic book art, dramatic lighting",
    "chinese_ink": "chinese ink painting style, traditional brush strokes, watercolor, elegant, minimalist",
    "webtoon": "webtoon style, soft shading, pastel colors, korean manhwa, clean digital art",
    "pixar_3d": "3D render, pixar style, subsurface scattering, soft lighting, cartoon proportions",
}

NEGATIVE_PROMPT = (
    "lowres, bad anatomy, bad hands, text, error, missing fingers, cropped, "
    "worst quality, low quality, blurry, watermark, signature"
)


def build_script_prompt(chapter_text: str, chapter_index: int) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT.replace("{chapter}", str(chapter_index))},
        {"role": "user", "content": f"以下是第{chapter_index}章的内容，请输出 json 格式的分镜脚本：\n\n{chapter_text}"},
    ]


def build_sd_prompt(
    shot: dict,
    characters_map: dict,
    scenes_map: dict,
    style: str = "anime_cel",
) -> tuple[str, str]:
    scene = scenes_map.get(shot.get("scene", ""), {})
    char_descs = [
        characters_map[c]["appearance"]
        for c in shot.get("characters", [])
        if c in characters_map
    ]

    positive = ", ".join(
        filter(
            None,
            [
                STYLE_PREFIX.get(style, STYLE_PREFIX["anime_cel"]),
                scene.get("description", ""),
                ", ".join(char_descs),
                shot.get("description", ""),
                "masterpiece, best quality, highly detailed",
            ],
        )
    )

    return positive, NEGATIVE_PROMPT
