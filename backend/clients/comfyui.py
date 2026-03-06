import asyncio
import base64
import hashlib
import hmac
import json
import logging
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

# 即梦 API 常量
JIMENG_HOST = "visual.volcengineapi.com"
JIMENG_URL = "https://visual.volcengineapi.com"
JIMENG_SERVICE = "cv"
JIMENG_REGION = "cn-north-1"
JIMENG_VERSION = "2022-08-31"
JIMENG_REQ_KEY = "jimeng_t2i_v40"

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_RETRIES = 4
_BASE_DELAY = 2


class ImageClient:
    def __init__(
        self,
        base_url: str = "",
        api_key: str = "",
        model: str = "",
        provider: str = "mock",
        jimeng_ak: str = "",
        jimeng_sk: str = "",
    ):
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.api_key = api_key
        self.model = model
        self.provider = provider
        self.jimeng_ak = jimeng_ak
        self.jimeng_sk = jimeng_sk

    async def text2img(self, prompt: str, negative: str, output_path: Path) -> Path:
        if self.provider == "mock":
            return self._mock_image(prompt, output_path)
        if self.provider == "jimeng":
            return await self._jimeng_generate(prompt, output_path)
        return await self._api_generate(prompt, output_path)

    async def text2img_with_ref(
        self, prompt: str, negative: str, ref_path: Path, output_path: Path
    ) -> Path:
        if self.provider == "mock":
            return self._mock_image(prompt, output_path, ref_label=str(ref_path.stem))
        if self.provider == "jimeng":
            return await self._jimeng_generate(prompt, output_path, ref_path=ref_path)
        full_prompt = f"{prompt}, reference style from {ref_path.stem}"
        return await self._api_generate(full_prompt, output_path)

    # --- OpenAI Images API ---

    async def _api_generate(self, prompt: str, output_path: Path) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
            "response_format": "b64_json",
        }
        last_error = None
        for attempt in range(_MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(
                        f"{self.base_url}/v1/images/generations",
                        headers=headers,
                        json=body,
                    )
                if resp.status_code not in _RETRYABLE_STATUS:
                    resp.raise_for_status()
                    data = resp.json()
                    b64 = data["data"][0]["b64_json"]
                    output_path.write_bytes(base64.b64decode(b64))
                    logger.info("API image saved: %s", output_path)
                    return output_path
                last_error = httpx.HTTPStatusError(
                    f"{resp.status_code}", request=resp.request, response=resp
                )
                logger.warning("Image API request %d/%d failed: HTTP %d", attempt + 1, _MAX_RETRIES, resp.status_code)
            except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as e:
                last_error = e
                logger.warning("Image API request %d/%d failed: %s", attempt + 1, _MAX_RETRIES, e)
            if attempt < _MAX_RETRIES - 1:
                delay = _BASE_DELAY * (2 ** attempt)
                logger.info("Retrying in %ds...", delay)
                await asyncio.sleep(delay)
        raise RuntimeError(f"Image API request failed after {_MAX_RETRIES} attempts: {last_error}")

    # --- 即梦 Seedream 4.0 API ---

    async def _jimeng_generate(
        self, prompt: str, output_path: Path, ref_path: Path | None = None
    ) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        enhanced = _enhance_prompt(prompt, has_ref=ref_path is not None)

        body: dict = {"req_key": JIMENG_REQ_KEY, "prompt": enhanced}
        if ref_path and ref_path.exists():
            with open(ref_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            body["binary_data_base64"] = [b64]

        # 提交任务
        submit_data = await self._jimeng_request("CVSync2AsyncSubmitTask", body)
        if submit_data.get("code") != 10000:
            raise RuntimeError(f"Jimeng submit failed: {submit_data.get('message')}")

        task_id = submit_data["data"]["task_id"]

        # 轮询结果
        for _ in range(120):
            await asyncio.sleep(2)
            result = await self._jimeng_request(
                "CVSync2AsyncGetResult",
                {
                    "req_key": JIMENG_REQ_KEY,
                    "task_id": task_id,
                    "req_json": json.dumps({"return_url": True}),
                },
            )
            if result.get("code") != 10000:
                code = result.get("code")
                if code in (50411, 50412, 50413, 50511, 50512):
                    raise RuntimeError(f"Content moderation failed: {result.get('message')}")
                continue

            status = result.get("data", {}).get("status")
            if status == "done":
                data = result["data"]
                # 优先用 URL 下载
                urls = data.get("image_urls", [])
                if urls:
                    async with httpx.AsyncClient(timeout=120) as client:
                        resp = await client.get(urls[0])
                        resp.raise_for_status()
                        output_path.write_bytes(resp.content)
                else:
                    b64_list = data.get("binary_data_base64", [])
                    if b64_list:
                        output_path.write_bytes(base64.b64decode(b64_list[0]))
                    else:
                        raise RuntimeError("No image data in response")

                logger.info("Jimeng image saved: %s", output_path)
                return output_path

            if status in ("not_found", "expired"):
                raise RuntimeError(f"Jimeng task {status}")

        raise RuntimeError("Jimeng task timeout")

    async def _jimeng_request(self, action: str, body: dict) -> dict:
        last_error = None
        for attempt in range(_MAX_RETRIES):
            try:
                headers, body_str, query = _jimeng_sign("POST", action, body, self.jimeng_ak, self.jimeng_sk)
                url = f"{JIMENG_URL}/?{query}"
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(url, content=body_str.encode(), headers=headers)
                if resp.status_code not in _RETRYABLE_STATUS:
                    resp.raise_for_status()
                    return resp.json()
                last_error = httpx.HTTPStatusError(
                    f"{resp.status_code}", request=resp.request, response=resp
                )
                logger.warning("Jimeng request %d/%d failed: HTTP %d", attempt + 1, _MAX_RETRIES, resp.status_code)
            except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as e:
                last_error = e
                logger.warning("Jimeng request %d/%d failed: %s", attempt + 1, _MAX_RETRIES, e)
            if attempt < _MAX_RETRIES - 1:
                delay = _BASE_DELAY * (2 ** attempt)
                logger.info("Retrying in %ds...", delay)
                await asyncio.sleep(delay)
        raise RuntimeError(f"Jimeng request failed after {_MAX_RETRIES} attempts: {last_error}")

    # --- Mock ---

    @staticmethod
    def _mock_image(prompt: str, output_path: Path, ref_label: str | None = None) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img = Image.new("RGB", (1024, 1024), color=(40, 40, 60))
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
        except (OSError, IOError):
            font = ImageFont.load_default()

        lines = _wrap_text(prompt, 60)
        y = 40
        for line in lines[:15]:
            draw.text((30, y), line, fill=(200, 200, 200), font=font)
            y += 28
        if ref_label:
            draw.text((30, y + 20), f"[ref: {ref_label}]", fill=(100, 200, 100), font=font)
        draw.rectangle([0, 0, 1023, 1023], outline=(100, 100, 140), width=3)
        img.save(output_path)
        logger.info("Mock image saved: %s", output_path)
        return output_path


# --- 即梦签名工具 ---

def _sha256(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


def _hmac_sha256(key: str | bytes, msg: str | bytes) -> bytes:
    if isinstance(key, str):
        key = key.encode()
    if isinstance(msg, str):
        msg = msg.encode()
    return hmac.new(key, msg, hashlib.sha256).digest()


def _jimeng_sign(method: str, action: str, body: dict, ak: str, sk: str):
    now = datetime.now(timezone.utc)
    x_date = now.strftime("%Y%m%dT%H%M%SZ")
    short_date = x_date[:8]

    body_str = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    payload_hash = _sha256(body_str)

    query_params = {"Action": action, "Version": JIMENG_VERSION}
    canonical_query = "&".join(
        urllib.parse.quote(k, safe="~") + "=" + urllib.parse.quote(v, safe="~")
        for k, v in sorted(query_params.items())
    )

    signed_headers = "content-type;host;x-content-sha256;x-date"
    canonical_headers = (
        f"content-type:application/json\n"
        f"host:{JIMENG_HOST}\n"
        f"x-content-sha256:{payload_hash}\n"
        f"x-date:{x_date}\n"
    )

    canonical_request = "\n".join([
        method, "/", canonical_query, canonical_headers, signed_headers, payload_hash
    ])

    credential_scope = f"{short_date}/{JIMENG_REGION}/{JIMENG_SERVICE}/request"
    string_to_sign = "\n".join([
        "HMAC-SHA256", x_date, credential_scope, _sha256(canonical_request)
    ])

    k_date = _hmac_sha256(sk, short_date)
    k_region = _hmac_sha256(k_date, JIMENG_REGION)
    k_service = _hmac_sha256(k_region, JIMENG_SERVICE)
    k_signing = _hmac_sha256(k_service, "request")
    signature = _hmac_sha256(k_signing, string_to_sign).hex()

    authorization = (
        f"HMAC-SHA256 Credential={ak}/{credential_scope}"
        f", SignedHeaders={signed_headers}"
        f", Signature={signature}"
    )

    headers = {
        "Content-Type": "application/json",
        "Host": JIMENG_HOST,
        "X-Date": x_date,
        "X-Content-Sha256": payload_hash,
        "Authorization": authorization,
    }
    return headers, body_str, canonical_query


def _enhance_prompt(prompt: str, has_ref: bool = False) -> str:
    quality_kw = ["8k", "4k", "高清", "masterpiece", "best quality", "高质量", "精细", "detailed"]
    if any(kw in prompt.lower() for kw in quality_kw):
        return prompt
    suffix = "，高质量，精细细节，保持原图风格特征" if has_ref else "，高质量，精细细节，专业级渲染，光影自然"
    if len(prompt) < 20:
        suffix = "，画面精美，构图优秀，色彩丰富" + suffix
    return prompt + suffix


def _wrap_text(text: str, width: int) -> list[str]:
    lines = []
    for line in text.split("\n"):
        while len(line) > width:
            lines.append(line[:width])
            line = line[width:]
        lines.append(line)
    return lines
