import asyncio
import logging

import httpx

from utils.json_repair import repair_json

logger = logging.getLogger(__name__)

# 可重试的 HTTP 状态码
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_NETWORK_RETRIES = 4
_BASE_DELAY = 2  # 秒


class LLMClient:
    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def _request_with_retry(self, body: dict) -> dict:
        """带指数退避的 HTTP 请求，处理 503/429/超时等暂时性错误。"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        last_error = None

        for attempt in range(_MAX_NETWORK_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(
                        f"{self.base_url}/v1/chat/completions",
                        headers=headers,
                        json=body,
                    )
                if resp.status_code not in _RETRYABLE_STATUS:
                    resp.raise_for_status()
                    return resp.json()

                last_error = httpx.HTTPStatusError(
                    f"{resp.status_code}", request=resp.request, response=resp
                )
                logger.warning("LLM request %d/%d failed: HTTP %d", attempt + 1, _MAX_NETWORK_RETRIES, resp.status_code)

            except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as e:
                last_error = e
                logger.warning("LLM request %d/%d failed: %s", attempt + 1, _MAX_NETWORK_RETRIES, e)

            if attempt < _MAX_NETWORK_RETRIES - 1:
                delay = _BASE_DELAY * (2 ** attempt)  # 2s, 4s, 8s
                logger.info("Retrying in %ds...", delay)
                await asyncio.sleep(delay)

        raise RuntimeError(f"LLM request failed after {_MAX_NETWORK_RETRIES} attempts: {last_error}")

    async def chat(self, messages: list[dict], json_mode: bool = False) -> str:
        """Send chat completion via OpenAI-compatible API."""
        body: dict = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": messages,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        # json_mode 下额外重试 JSON 解析失败的情况
        last_error = None
        attempts = 3 if json_mode else 1

        for attempt in range(attempts):
            data = await self._request_with_retry(body)
            content = data["choices"][0]["message"]["content"]

            if not json_mode:
                return content

            try:
                repair_json(content)
                return content
            except (ValueError, Exception) as e:
                last_error = e
                logger.warning("JSON repair failed (attempt %d): %s", attempt + 1, e)

        raise ValueError(f"Failed to get valid JSON after {attempts} attempts: {last_error}")
