import { useState } from "react";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VISUAL_STYLES, BASE_MODELS, RESOLUTIONS, IMAGE_PROVIDERS } from "@/types";
import type { ImageProvider } from "@/types";
import { Save } from "lucide-react";

export function SettingsPanel() {
  const { settings, updateSettings } = useProjectStore();
  const [llmTestState, setLlmTestState] = useState<{ loading: boolean; result?: { ok: boolean; message: string } }>({ loading: false });

  const testLlm = async () => {
    if (!settings.llm_base_url || !settings.llm_api_key || !settings.llm_model) return;
    setLlmTestState({ loading: true });
    try {
      const resp = await fetch("/api/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: settings.llm_base_url,
          api_key: settings.llm_api_key,
          model: settings.llm_model,
        }),
      });
      const data = await resp.json();
      setLlmTestState({ loading: false, result: data });
    } catch (e: any) {
      setLlmTestState({ loading: false, result: { ok: false, message: e.message } });
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-1">项目设置</h2>
          <p className="text-sm text-muted-foreground">配置项目的生成参数</p>
        </div>

        {/* 分集规则 */}
        <SettingRow label="分集规则" description="每集包含的章节数">
          <Select
            value={String(settings.chapters_per_episode)}
            onValueChange={(v) => updateSettings({ chapters_per_episode: Number(v) })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 章/集</SelectItem>
              <SelectItem value="2">2 章/集</SelectItem>
              <SelectItem value="3">3 章/集</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        {/* 视觉风格 */}
        <SettingRow label="视觉风格" description="生成图片的画风">
          <Select
            value={settings.visual_style}
            onValueChange={(v) => updateSettings({ visual_style: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISUAL_STYLES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        {/* 基础模型 */}
        <SettingRow label="基础模型" description="图像生成使用的底层模型">
          <Select
            value={settings.base_model}
            onValueChange={(v) => updateSettings({ base_model: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASE_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        {/* 输出分辨率 */}
        <SettingRow label="输出分辨率" description="分镜帧的输出尺寸">
          <Select
            value={settings.resolution}
            onValueChange={(v) => updateSettings({ resolution: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        {/* 候选图数量 */}
        <SettingRow label="候选图数量" description="每次生成的候选图张数">
          <Select
            value={String(settings.candidate_count)}
            onValueChange={(v) => updateSettings({ candidate_count: Number(v) })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 张</SelectItem>
              <SelectItem value="4">4 张</SelectItem>
              <SelectItem value="6">6 张</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        {/* 模型接口配置 */}
        <div className="pt-6 border-t border-border">
          <h2 className="text-lg font-semibold mb-1">模型接口</h2>
          <p className="text-sm text-muted-foreground mb-6">配置 LLM 和图片生成的 API 接口</p>

          {/* LLM 接口 */}
          <div className="space-y-4 mb-8">
            <p className="text-sm font-medium text-muted-foreground">LLM 文本生成</p>
            <SettingRow label="Base URL" description="OpenAI 兼容 API 地址">
              <Input
                className="w-64"
                placeholder="https://api.openai.com/v1"
                value={settings.llm_base_url}
                onChange={(e) => updateSettings({ llm_base_url: e.target.value })}
              />
            </SettingRow>
            <SettingRow label="API Key" description="接口密钥">
              <Input
                className="w-64"
                type="password"
                placeholder="sk-..."
                value={settings.llm_api_key}
                onChange={(e) => updateSettings({ llm_api_key: e.target.value })}
              />
            </SettingRow>
            <SettingRow label="模型名称" description="例如 gpt-4o、deepseek-chat">
              <Input
                className="w-64"
                placeholder="gpt-4o"
                value={settings.llm_model}
                onChange={(e) => updateSettings({ llm_model: e.target.value })}
              />
            </SettingRow>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={llmTestState.loading || !settings.llm_base_url || !settings.llm_api_key || !settings.llm_model}
                onClick={testLlm}
              >
                {llmTestState.loading ? "测试中..." : "测试连接"}
              </Button>
              {llmTestState.result && (
                <span className={`text-xs ${llmTestState.result.ok ? "text-green-600" : "text-red-500"}`}>
                  {llmTestState.result.message}
                </span>
              )}
            </div>
          </div>

          {/* 图片接口 */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">图片生成</p>
            <SettingRow label="Provider" description="图片生成服务提供商">
              <Select
                value={settings.image_provider}
                onValueChange={(v) => updateSettings({ image_provider: v as ImageProvider })}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            {settings.image_provider === "api" && (
              <>
                <SettingRow label="Base URL" description="图片 API 地址">
                  <Input
                    className="w-64"
                    placeholder="https://api.openai.com/v1"
                    value={settings.image_base_url}
                    onChange={(e) => updateSettings({ image_base_url: e.target.value })}
                  />
                </SettingRow>
                <SettingRow label="API Key" description="图片接口密钥">
                  <Input
                    className="w-64"
                    type="password"
                    placeholder="sk-..."
                    value={settings.image_api_key}
                    onChange={(e) => updateSettings({ image_api_key: e.target.value })}
                  />
                </SettingRow>
                <SettingRow label="模型名称" description="例如 dall-e-3">
                  <Input
                    className="w-64"
                    placeholder="dall-e-3"
                    value={settings.image_model}
                    onChange={(e) => updateSettings({ image_model: e.target.value })}
                  />
                </SettingRow>
              </>
            )}

            {settings.image_provider === "jimeng" && (
              <>
                <SettingRow label="Access Key" description="即梦 Access Key ID">
                  <Input
                    className="w-64"
                    type="password"
                    placeholder="AK..."
                    value={settings.jimeng_access_key}
                    onChange={(e) => updateSettings({ jimeng_access_key: e.target.value })}
                  />
                </SettingRow>
                <SettingRow label="Secret Key" description="即梦 Secret Access Key">
                  <Input
                    className="w-64"
                    type="password"
                    placeholder="..."
                    value={settings.jimeng_secret_key}
                    onChange={(e) => updateSettings({ jimeng_secret_key: e.target.value })}
                  />
                </SettingRow>
              </>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            设置自动保存到本地。后端设置 API 将在后续版本中支持。
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}
