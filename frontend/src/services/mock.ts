import type { Character, SceneAsset, StoryAnalysis, EpisodeOutline, Episode } from "@/types";

// SVG 占位图生成
function svgPlaceholder(w: number, h: number, bg: string, text: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="sans-serif" font-size="14" fill="#fff">${text}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function characterAvatar(name: string): string {
  return svgPlaceholder(256, 256, "#6366f1", name);
}

export function sceneImage(name: string): string {
  return svgPlaceholder(512, 288, "#0d9488", name);
}

export function frameImage(label: string, status: string): string {
  const bg = status === "generated" ? "#2563eb" : status === "generating" ? "#d97706" : "#52525b";
  return svgPlaceholder(512, 288, bg, label);
}

// Mock 剧本数据
export const mockScriptData: Record<string, Episode> = {
  E01: {
    episode_id: "E01",
    label: "第一集",
    scenes: [
      {
        scene_id: "E01S01",
        location: "古镇街道",
        time: "清晨",
        shots: [
          {
            shot_id: "E01S01_001",
            scene_id: "E01S01",
            description: "晨雾笼罩的古镇街道，石板路上泛着微光。远处传来鸡鸣声。",
            characters: ["林晓"],
            location: "古镇街道",
            dialogue: [],
            camera: "大远景 · 缓慢推进",
            duration: 5,
            frame_status: "generated",
          },
          {
            shot_id: "E01S01_002",
            scene_id: "E01S01",
            description: "林晓背着行囊走在街道上，脚步轻快。她停下来看向一家老茶馆。",
            characters: ["林晓"],
            location: "古镇街道",
            dialogue: [
              { character: "林晓", text: "就是这里了……外婆说的那家茶馆。", emotion: "determined" },
            ],
            camera: "中景 · 跟拍",
            duration: 4,
            frame_status: "generated",
          },
          {
            shot_id: "E01S01_003",
            scene_id: "E01S01",
            description: "茶馆门口的旧招牌特写，上面写着「云来茶庄」四个褪色的大字。",
            characters: [],
            location: "古镇街道",
            dialogue: [],
            camera: "特写",
            duration: 2,
            frame_status: "pending",
          },
        ],
      },
      {
        scene_id: "E01S02",
        location: "云来茶庄·内",
        time: "清晨",
        shots: [
          {
            shot_id: "E01S02_001",
            scene_id: "E01S02",
            description: "茶庄内部陈旧但整洁，木质柜台后站着老板赵伯。阳光从窗户斜射进来。",
            characters: ["赵伯"],
            location: "云来茶庄·内",
            dialogue: [],
            camera: "中景",
            duration: 3,
            frame_status: "pending",
          },
          {
            shot_id: "E01S02_002",
            scene_id: "E01S02",
            description: "林晓推门而入，赵伯抬头看向她，露出惊讶的表情。",
            characters: ["林晓", "赵伯"],
            location: "云来茶庄·内",
            dialogue: [
              { character: "赵伯", text: "你是……小云的孙女？", emotion: "surprised" },
              { character: "林晓", text: "赵伯伯，我是林晓。外婆让我来找您。", emotion: "happy" },
              { character: "赵伯", text: "哎呀，都长这么大了！快进来坐。", emotion: "happy" },
            ],
            camera: "正反打",
            duration: 6,
            frame_status: "pending",
          },
        ],
      },
      {
        scene_id: "E01S03",
        location: "茶庄后院",
        time: "上午",
        shots: [
          {
            shot_id: "E01S03_001",
            scene_id: "E01S03",
            description: "后院种满了茶树，陈墨正在修剪枝叶。他戴着草帽，动作利落。",
            characters: ["陈墨"],
            location: "茶庄后院",
            dialogue: [],
            camera: "中远景",
            duration: 3,
            frame_status: "pending",
          },
          {
            shot_id: "E01S03_002",
            scene_id: "E01S03",
            description: "林晓走到后院，看到陈墨。两人目光交汇，陈墨微微皱眉。",
            characters: ["林晓", "陈墨"],
            location: "茶庄后院",
            dialogue: [
              { character: "陈墨", text: "你是谁？这里不对外开放。", emotion: "neutral" },
              { character: "林晓", text: "我叫林晓，赵伯让我来的。", emotion: "neutral" },
            ],
            camera: "双人中景",
            duration: 4,
            frame_status: "pending",
          },
        ],
      },
    ],
  },
  E02: {
    episode_id: "E02",
    label: "第二集",
    scenes: [
      {
        scene_id: "E02S01",
        location: "云来茶庄·内",
        time: "午后",
        shots: [
          {
            shot_id: "E02S01_001",
            scene_id: "E02S01",
            description: "林晓在茶庄里翻看外婆留下的旧笔记本，上面记满了制茶配方。",
            characters: ["林晓"],
            location: "云来茶庄·内",
            dialogue: [
              { character: "林晓", text: "原来外婆一直在研究这些……", emotion: "surprised" },
            ],
            camera: "近景 · 俯拍",
            duration: 4,
            frame_status: "pending",
          },
          {
            shot_id: "E02S01_002",
            scene_id: "E02S01",
            description: "苏雅端着茶走进来，看到林晓在看笔记本，好奇地凑过来。",
            characters: ["林晓", "苏雅"],
            location: "云来茶庄·内",
            dialogue: [
              { character: "苏雅", text: "这是什么？看起来好古老。", emotion: "happy" },
              { character: "林晓", text: "我外婆的制茶笔记。她年轻时在这里学过茶艺。", emotion: "neutral" },
            ],
            camera: "双人近景",
            duration: 5,
            frame_status: "pending",
          },
        ],
      },
      {
        scene_id: "E02S02",
        location: "镇上集市",
        time: "傍晚",
        shots: [
          {
            shot_id: "E02S02_001",
            scene_id: "E02S02",
            description: "热闹的集市，各种摊位。林晓和苏雅一起逛街，周围人来人往。",
            characters: ["林晓", "苏雅"],
            location: "镇上集市",
            dialogue: [],
            camera: "大远景 · 航拍",
            duration: 3,
            frame_status: "pending",
          },
          {
            shot_id: "E02S02_002",
            scene_id: "E02S02",
            description: "她们在一个茶叶摊前停下，摊主老王热情地招呼。",
            characters: ["林晓", "苏雅", "老王"],
            location: "镇上集市",
            dialogue: [
              { character: "老王", text: "两位姑娘，尝尝我家的新茶！", emotion: "happy" },
              { character: "林晓", text: "这个香气……是金骏眉？", emotion: "surprised" },
              { character: "老王", text: "姑娘好眼力！你懂茶？", emotion: "surprised" },
            ],
            camera: "中景",
            duration: 5,
            frame_status: "pending",
          },
          {
            shot_id: "E02S02_003",
            scene_id: "E02S02",
            description: "陈墨远远地看着林晓和苏雅，若有所思地转身离开。",
            characters: ["陈墨"],
            location: "镇上集市",
            dialogue: [],
            camera: "远景 · 浅景深",
            duration: 3,
            frame_status: "pending",
          },
        ],
      },
    ],
  },
};

// Mock 角色
export const mockCharacters: Character[] = [
  {
    id: "char_1",
    name: "林晓",
    description: "女主角，23岁，大学刚毕业。性格开朗、好奇心强，对外婆的过去充满好奇。",
    appearance: "长发及肩，大眼睛，常穿白色棉麻衬衫搭配牛仔裤",
    locked: false,
    reference_image: characterAvatar("林晓"),
    candidates: [characterAvatar("林晓·A"), characterAvatar("林晓·B"), characterAvatar("林晓·C"), characterAvatar("林晓·D")],
  },
  {
    id: "char_2",
    name: "陈墨",
    description: "男主角，25岁，茶庄的年轻茶师。沉默寡言但内心细腻，对制茶有极高天赋。",
    appearance: "短发，轮廓分明，常穿深色中式立领衫",
    locked: false,
    reference_image: characterAvatar("陈墨"),
    candidates: [characterAvatar("陈墨·A"), characterAvatar("陈墨·B"), characterAvatar("陈墨·C"), characterAvatar("陈墨·D")],
  },
  {
    id: "char_3",
    name: "赵伯",
    description: "云来茶庄老板，60岁。和蔼可亲，是林晓外婆的老朋友。",
    appearance: "花白头发，圆脸，常穿灰色唐装",
    locked: false,
    reference_image: characterAvatar("赵伯"),
    candidates: [characterAvatar("赵伯·A"), characterAvatar("赵伯·B"), characterAvatar("赵伯·C"), characterAvatar("赵伯·D")],
  },
  {
    id: "char_4",
    name: "苏雅",
    description: "林晓的好友，22岁。活泼外向，是个美食博主，陪林晓来古镇旅行。",
    appearance: "短发波波头，爱穿色彩鲜艳的衣服，总带着相机",
    locked: false,
    reference_image: characterAvatar("苏雅"),
    candidates: [characterAvatar("苏雅·A"), characterAvatar("苏雅·B"), characterAvatar("苏雅·C"), characterAvatar("苏雅·D")],
  },
  {
    id: "char_5",
    name: "老王",
    description: "镇上集市的茶叶摊主，50岁。热情健谈，对本地茶叶了如指掌。",
    appearance: "黝黑皮肤，笑容爽朗，围着蓝色围裙",
    locked: false,
    reference_image: characterAvatar("老王"),
    candidates: [characterAvatar("老王·A"), characterAvatar("老王·B"), characterAvatar("老王·C"), characterAvatar("老王·D")],
  },
];

// Mock 场景
export const mockSceneAssets: SceneAsset[] = [
  {
    id: "scene_1",
    name: "古镇街道",
    description: "青石板铺就的老街，两旁是白墙黛瓦的徽派建筑，晨雾缭绕。",
    locked: false,
    reference_image: sceneImage("古镇街道"),
    candidates: [sceneImage("街道·A"), sceneImage("街道·B"), sceneImage("街道·C"), sceneImage("街道·D")],
  },
  {
    id: "scene_2",
    name: "云来茶庄·内",
    description: "传统中式茶馆内部，木质家具，墙上挂着书法作品，茶香弥漫。",
    locked: false,
    reference_image: sceneImage("茶庄内"),
    candidates: [sceneImage("茶庄·A"), sceneImage("茶庄·B"), sceneImage("茶庄·C"), sceneImage("茶庄·D")],
  },
  {
    id: "scene_3",
    name: "茶庄后院",
    description: "种满茶树的庭院，阳光透过树叶洒下斑驳光影，有石桌石凳。",
    locked: false,
    reference_image: sceneImage("茶庄后院"),
    candidates: [sceneImage("后院·A"), sceneImage("后院·B"), sceneImage("后院·C"), sceneImage("后院·D")],
  },
  {
    id: "scene_4",
    name: "镇上集市",
    description: "热闹的露天集市，各色摊位林立，人声鼎沸，充满生活气息。",
    locked: false,
    reference_image: sceneImage("镇上集市"),
    candidates: [sceneImage("集市·A"), sceneImage("集市·B"), sceneImage("集市·C"), sceneImage("集市·D")],
  },
];

// Mock 分析结果
export const mockAnalysis: StoryAnalysis = {
  theme: "传承与成长",
  tone: "温暖治愈",
  era: "当代",
  core_conflict: "林晓在探寻外婆过去的过程中，发现了茶庄背后隐藏的家族秘密，同时在传统与现代之间寻找自己的定位。",
  character_names: ["林晓", "陈墨", "赵伯", "苏雅", "老王"],
  scene_names: ["古镇街道", "云来茶庄·内", "茶庄后院", "镇上集市"],
};

// Mock 大纲
export const mockOutlines: EpisodeOutline[] = [
  {
    episode: 1,
    title: "初到古镇",
    summary: "林晓带着外婆的嘱托来到古镇，找到了云来茶庄。她见到了老板赵伯，并在后院初遇沉默寡言的茶师陈墨。古镇的宁静与茶香让她感到一种莫名的亲切。",
    chapters: "第1-2章",
  },
  {
    episode: 2,
    title: "外婆的笔记",
    summary: "林晓发现外婆留下的制茶笔记本，里面记载着失传的茶艺配方。她和好友苏雅一起逛集市，展现出对茶叶的天赋。陈墨开始注意到林晓的与众不同。",
    chapters: "第3-4章",
  },
];

// Mock pipeline 模拟
const PIPELINE_STEPS = [
  "正在分析小说文本...",
  "正在生成故事大纲...",
  "正在编写分集剧本...",
  "正在生成角色与场景资产...",
  "正在生成分镜脚本...",
];

export function runMockPipeline(
  onUpdate: (step: string, progress: number) => void,
  onComplete: () => void,
) {
  let i = 0;
  const next = () => {
    if (i >= PIPELINE_STEPS.length) {
      onComplete();
      return;
    }
    onUpdate(PIPELINE_STEPS[i], ((i + 1) / PIPELINE_STEPS.length) * 100);
    i++;
    setTimeout(next, 1000);
  };
  // 开始第一步
  setTimeout(next, 300);
}
