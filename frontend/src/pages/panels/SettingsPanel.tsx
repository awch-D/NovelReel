import { useState, useEffect, useCallback } from "react";
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
import { VISUAL_STYLES, BASE_MODELS, RESOLUTIONS, IMAGE_PROVIDERS, VIDEO_PROVIDERS } from "@/types";
import type { ImageProvider, VideoProvider } from "@/types";
import { Save, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

export function SettingsPanel() {
  const { settings, updateSettings, systemSettings, systemSettingsLoaded, loadSystemSettings, updateSystemSettings, saveSystemSettings } = useProjectStore();
  const [llmTest, setLlmTest] = useState<{ loading: boolean; result?: { ok: boolean; message: string } }>({ loading: false });
  const [imageTest, setImageTest] = useState<{ loading: boolean; result?: { ok: boolean; message: string } }>({ loading: false });
  const [videoTest, setVideoTest] = useState<{ loading: boolean; result?: { ok: boolean; message: string } }>({ loading: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!systemSettingsLoaded) loadSystemSettings();
  }, [systemSettingsLoaded, loadSystemSettings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await saveSystemSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [saveSystemSettings]);

  const testLlm = async () => {
    if (!systemSettings.llm_base_url || !systemSettings.llm_api_key || !systemSettings.llm_model) return;
    setLlmTest({ loading: true });
    try {
      const resp = await fetch("/api/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: systemSettings.llm_base_url,
          api_key: systemSettings.llm_api_key,
          model: systemSettings.llm_model,
        }),
      });
      const data = await resp.json();
      setLlmTest({ loading: false, result: data });
    } catch (e: any) {
      setLlmTest({ loading: false, result: { ok: false, message: e.message } });
    }
  };

  const testImage = async () => {
    setImageTest({ loading: true });
    try {
      const resp = await fetch("/api/test-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: systemSettings.image_provider,
          base_url: systemSettings.image_base_url,
          api_key: systemSettings.image_api_key,
          model: systemSettings.image_model,
          jimeng_access_key: systemSettings.jimeng_image_access_key,
          jimeng_secret_key: systemSettings.jimeng_image_secret_key,
        }),
      });
      const data = await resp.json();
      setImageTest({ loading: false, result: data });
    } catch (e: any) {
      setImageTest({ loading: false, result: { ok: false, message: e.message } });
    }
  };

  const testVideo = async () => {
    setVideoTest({ loading: true });
    try {
      const resp = await fetch("/api/test-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: systemSettings.video_provider,
          jimeng_access_key: systemSettings.jimeng_video_access_key,
          jimeng_secret_key: systemSettings.jimeng_video_secret_key,
        }),
      });
      const data = await resp.json();
      setVideoTest({ loading: false, result: data });
    } catch (e: any) {
      setVideoTest({ loading: false, result: { ok: false, message: e.message } });
    }
  };

  if (!systemSettingsLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* ===== 系统级 API 接口配置 ===== */}
        <div>
          <h2 className="text-lg font-semibold mb-1">API 接口配置</h2>
          <p className="text-sm text-muted-foreground">配置文本、图片、视频生成的 API 接口（系统级，所有项目共享）</p>
        </div>

        {/* LLM 文本生成 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <p className="text-sm font-semibold">文本生成 LLM</p>
          </div>
          <SettingRow label="Base URL" description="OpenAI 兼容 API 地址">
            <Input
              className="w-72"
              placeholder="https://api.openai.com/v1"
              value={systemSettings.llm_base_url}
              onChange={(e) => updateSystemSettings({ llm_base_url: e.target.value })}
            />
          </SettingRow>
          <SettingRow label="API Key" description="接口密钥">
            <SecretInput
              placeholder="sk-..."
              value={systemSettings.llm_api_key}
              onChange={(v) => updateSystemSettings({ llm_api_key: v })}
            />
          </SettingRow>
          <SettingRow label="模型名称" description="例如 gpt-4o、deepseek-chat">
            <Input
              className="w-72"
              placeholder="gpt-4o"
              value={systemSettings.llm_model}
              onChange={(e) => updateSystemSettings({ llm_model: e.target.value })}
            />
          </SettingRow>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={llmTest.loading || !systemSettings.llm_base_url || !systemSettings.llm_api_key || !systemSettings.llm_model}
              onClick={testLlm}
            >
              {llmTest.loading ? "测试中..." : "测试连接"}
            </Button>
            {llmTest.result && (
              <span className={`text-xs ${llmTest.result.ok ? "text-green-600" : "text-red-500"}`}>
                {llmTest.result.message}
              </span>
            )}
          </div>
        </section>

        <div className="border-t border-border" />

        {/* 图片生成 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <p className="text-sm font-semibold">图片生成</p>
          </div>
          <SettingRow label="Provider" description="图片生成服务提供商">
            <Select
              value={systemSettings.image_provider}
              onValueChange={(v) => updateSystemSettings({ image_provider: v as ImageProvider })}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          {systemSettings.image_provider === "api" && (
            <>
              <SettingRow label="Base URL" description="图片 API 地址">
                <Input
                  className="w-72"
                  placeholder="https://api.openai.com/v1"
                  value={systemSettings.image_base_url}
                  onChange={(e) => updateSystemSettings({ image_base_url: e.target.value })}
                />
              </SettingRow>
              <SettingRow label="API Key" description="图片接口密钥">
                <SecretInput
                  placeholder="sk-..."
                  value={systemSettings.image_api_key}
                  onChange={(v) => updateSystemSettings({ image_api_key: v })}
                />
              </SettingRow>
              <SettingRow label="模型名称" description="例如 dall-e-3">
                <Input
                  className="w-72"
                  placeholder="dall-e-3"
                  value={systemSettings.image_model}
                  onChange={(e) => updateSystemSettings({ image_model: e.target.value })}
                />
              </SettingRow>
            </>
          )}

          {systemSettings.image_provider === "jimeng" && (
            <>
              <SettingRow label="Access Key" description="火山引擎 Access Key ID">
                <SecretInput
                  placeholder="AKLT..."
                  value={systemSettings.jimeng_image_access_key}
                  onChange={(v) => updateSystemSettings({ jimeng_image_access_key: v })}
                />
              </SettingRow>
              <SettingRow label="Secret Key" description="火山引擎 Secret Access Key">
                <SecretInput
                  placeholder="..."
                  value={systemSettings.jimeng_image_secret_key}
                  onChange={(v) => updateSystemSettings({ jimeng_image_secret_key: v })}
                />
              </SettingRow>
            </>
          )}

          {systemSettings.image_provider !== "mock" && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={imageTest.loading}
                onClick={testImage}
              >
                {imageTest.loading ? "测试中..." : "测试连接"}
              </Button>
              {imageTest.result && (
                <span className={`text-xs ${imageTest.result.ok ? "text-green-600" : "text-red-500"}`}>
                  {imageTest.result.message}
                </span>
              )}
            </div>
          )}
        </section>

        <div className="border-t border-border" />

        {/* 视频生成 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <p className="text-sm font-semibold">视频生成</p>
          </div>
          <SettingRow label="Provider" description="视频生成服务提供商">
            <Select
              value={systemSettings.video_provider}
              onValueChange={(v) => updateSystemSettings({ video_provider: v as VideoProvider })}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          {systemSettings.video_provider === "jimeng" && (
            <>
              <SettingRow label="Access Key" description="火山引擎 Access Key ID">
                <SecretInput
                  placeholder="AKLT..."
                  value={systemSettings.jimeng_video_access_key}
                  onChange={(v) => updateSystemSettings({ jimeng_video_access_key: v })}
                />
              </SettingRow>
              <SettingRow label="Secret Key" description="火山引擎 Secret Access Key">
                <SecretInput
                  placeholder="..."
                  value={systemSettings.jimeng_video_secret_key}
                  onChange={(v) => updateSystemSettings({ jimeng_video_secret_key: v })}
                />
              </SettingRow>
              <p className="text-xs text-muted-foreground pl-1">
                需在火山引擎控制台开通「即梦AI-视频生成3.0 Pro」服务
              </p>
            </>
          )}

          {systemSettings.video_provider !== "none" && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={videoTest.loading}
                onClick={testVideo}
              >
                {videoTest.loading ? "测试中..." : "测试连接"}
              </Button>
              {videoTest.result && (
                <span className={`text-xs ${videoTest.result.ok ? "text-green-600" : "text-red-500"}`}>
                  {videoTest.result.message}
                </span>
              )}
            </div>
          )}
        </section>

        {/* 保存按钮 */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : saved ? (
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "保存中..." : saved ? "已保存" : "保存接口配置"}
          </Button>
          <p className="text-xs text-muted-foreground">接口配置保存到系统，所有项目共享</p>
        </div>

        {/* ===== 项目级设置 ===== */}
        <div className="pt-4 border-t-2 border-border">
          <h2 className="text-lg font-semibold mb-1">项目设置</h2>
          <p className="text-sm text-muted-foreground mb-6">配置当前项目的生成参数（保存在本地）</p>
        </div>

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
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

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
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

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
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

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

        <div className="pb-8" />
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

function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  const head = value.slice(0, 4);
  const tail = value.slice(-4);
  return `${head}${"*".repeat(Math.min(value.length - 8, 16))}${tail}`;
}

function SecretInput({
  value,
  onChange,
  placeholder,
  className = "w-72",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const isMasked = value.includes("****");

  return (
    <div className={`relative ${className}`}>
      <Input
        className="pr-9 w-full font-mono text-sm"
        type="text"
        placeholder={placeholder}
        value={visible ? value : (value ? (isMasked ? value : maskSecret(value)) : "")}
        onChange={(e) => {
          if (visible) onChange(e.target.value);
        }}
        onFocus={() => {
          setVisible(true);
          // 后端返回的掩码值，focus 时清空让用户输入新值
          if (isMasked) onChange("");
        }}
      />
      {value && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "隐藏" : "显示"}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
