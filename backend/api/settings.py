"""系统级设置 API — 持久化到 system_settings.json"""

import hashlib
import hmac as hmac_mod
import json
import ssl
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from utils.crypto import encrypt, decrypt

router = APIRouter(prefix="/api", tags=["settings"])

SETTINGS_FILE = Path(__file__).parent.parent / "system_settings.json"

# 需要加密的字段名（以 _key 结尾的密钥字段）
_SECRET_FIELDS = {
    "llm_api_key", "image_api_key",
    "jimeng_image_access_key", "jimeng_image_secret_key",
    "jimeng_video_access_key", "jimeng_video_secret_key",
}

# 即梦 API 常量
_JIMENG_HOST = "visual.volcengineapi.com"
_JIMENG_URL = "https://visual.volcengineapi.com"
_JIMENG_REGION = "cn-north-1"
_JIMENG_SERVICE = "cv"
_JIMENG_VERSION = "2022-08-31"
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


class SystemSettings(BaseModel):
    # LLM
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""

    # 图片生成
    image_provider: Literal["mock", "api", "jimeng"] = "mock"
    image_base_url: str = ""
    image_api_key: str = ""
    image_model: str = ""
    jimeng_image_access_key: str = ""
    jimeng_image_secret_key: str = ""

    # 视频生成
    video_provider: Literal["none", "jimeng"] = "none"
    jimeng_video_access_key: str = ""
    jimeng_video_secret_key: str = ""


def _load() -> SystemSettings:
    if SETTINGS_FILE.exists():
        data = json.loads(SETTINGS_FILE.read_text("utf-8"))
        # 解密密钥字段
        for key in _SECRET_FIELDS:
            if key in data and data[key]:
                data[key] = decrypt(data[key])
        return SystemSettings(**data)
    return SystemSettings()


def _save(s: SystemSettings):
    data = s.model_dump()
    # 加密密钥字段
    for key in _SECRET_FIELDS:
        if key in data and data[key]:
            data[key] = encrypt(data[key])
    SETTINGS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _mask_secret(value: str) -> str:
    """掩码：保留前 3 字符和后 2 字符"""
    if not value:
        return ""
    if len(value) <= 5:
        return "****"
    return value[:3] + "****" + value[-2:]


@router.get("/settings")
def get_settings():
    data = _load().model_dump()
    # 返回掩码值
    for key in _SECRET_FIELDS:
        if key in data and data[key]:
            data[key] = _mask_secret(data[key])
    return data


@router.put("/settings")
def update_settings(body: SystemSettings):
    current = _load()
    new_data = body.model_dump()
    # 含 **** 的值保留原值（前端未修改）
    cur_data = current.model_dump()
    for key in _SECRET_FIELDS:
        val = new_data.get(key, "")
        if "****" in val:
            new_data[key] = cur_data.get(key, "")
    merged = SystemSettings(**new_data)
    _save(merged)
    # 返回掩码值
    result = merged.model_dump()
    for key in _SECRET_FIELDS:
        if key in result and result[key]:
            result[key] = _mask_secret(result[key])
    return result


# ---- 即梦 HMAC 签名 ----

def _sha256(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _hmac_sha256(key: str | bytes, msg: str | bytes) -> bytes:
    if isinstance(key, str):
        key = key.encode("utf-8")
    if isinstance(msg, str):
        msg = msg.encode("utf-8")
    return hmac_mod.new(key, msg, hashlib.sha256).digest()


def _jimeng_api_call(action: str, body: dict, ak: str, sk: str) -> dict:
    now = datetime.now(timezone.utc)
    x_date = now.strftime("%Y%m%dT%H%M%SZ")
    short_date = x_date[:8]

    body_str = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    payload_hash = _sha256(body_str)

    query_params = {"Action": action, "Version": _JIMENG_VERSION}
    canonical_query = "&".join(
        urllib.parse.quote(k, safe="~") + "=" + urllib.parse.quote(v, safe="~")
        for k, v in sorted(query_params.items())
    )

    signed_headers = "content-type;host;x-content-sha256;x-date"
    canonical_headers = (
        f"content-type:application/json\n"
        f"host:{_JIMENG_HOST}\n"
        f"x-content-sha256:{payload_hash}\n"
        f"x-date:{x_date}\n"
    )

    canonical_request = "\n".join([
        "POST", "/", canonical_query, canonical_headers, signed_headers, payload_hash
    ])

    credential_scope = f"{short_date}/{_JIMENG_REGION}/{_JIMENG_SERVICE}/request"
    string_to_sign = "\n".join([
        "HMAC-SHA256", x_date, credential_scope, _sha256(canonical_request)
    ])

    k_date = _hmac_sha256(sk, short_date)
    k_region = _hmac_sha256(k_date, _JIMENG_REGION)
    k_service = _hmac_sha256(k_region, _JIMENG_SERVICE)
    k_signing = _hmac_sha256(k_service, "request")
    signature = _hmac_sha256(k_signing, string_to_sign).hex()

    authorization = (
        f"HMAC-SHA256 Credential={ak}/{credential_scope}"
        f", SignedHeaders={signed_headers}"
        f", Signature={signature}"
    )

    headers = {
        "Content-Type": "application/json",
        "Host": _JIMENG_HOST,
        "X-Date": x_date,
        "X-Content-Sha256": payload_hash,
        "Authorization": authorization,
    }

    url = f"{_JIMENG_URL}/?{canonical_query}"
    req = urllib.request.Request(url, data=body_str.encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        return {"code": e.code, "message": f"HTTP {e.code}: {error_body}"}
    except Exception as e:
        return {"code": -1, "message": str(e)}


# ---- 测试连接端点 ----

class TestImageApiRequest(BaseModel):
    provider: str
    base_url: str = ""
    api_key: str = ""
    model: str = ""
    jimeng_access_key: str = ""
    jimeng_secret_key: str = ""


@router.post("/test-image")
def test_image(body: TestImageApiRequest):
    if body.provider == "mock":
        return {"ok": True, "message": "Mock 模式无需测试"}

    if body.provider == "api":
        import httpx
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{body.base_url.rstrip('/')}/models",
                    headers={"Authorization": f"Bearer {body.api_key}"},
                )
            if resp.status_code == 200:
                return {"ok": True, "message": "连接成功"}
            return {"ok": False, "message": f"HTTP {resp.status_code}: {resp.text[:200]}"}
        except Exception as e:
            return {"ok": False, "message": str(e)}

    if body.provider == "jimeng":
        # 查询一个不存在的 task_id，只验证签名/鉴权，不产生消耗
        result = _jimeng_api_call(
            "CVSync2AsyncGetResult",
            {"req_key": "jimeng_high_aes_general_v21_L", "task_id": "test_invalid_id"},
            body.jimeng_access_key,
            body.jimeng_secret_key,
        )
        code = result.get("code")
        if code in (401, 50400):
            return {"ok": False, "message": "凭证无效或未开通即梦图片生成服务"}
        # 能收到业务层响应（如 task not found）说明鉴权通过
        return {"ok": True, "message": "凭证有效，连接成功"}

    return {"ok": False, "message": f"未知 provider: {body.provider}"}


class TestVideoRequest(BaseModel):
    provider: str
    jimeng_access_key: str = ""
    jimeng_secret_key: str = ""


@router.post("/test-video")
def test_video(body: TestVideoRequest):
    if body.provider == "none":
        return {"ok": True, "message": "未启用视频生成"}

    if body.provider == "jimeng":
        # 查询一个不存在的 task_id，只验证签名/鉴权，不产生消耗
        result = _jimeng_api_call(
            "CVSync2AsyncGetResult",
            {"req_key": "jimeng_ti2v_v30_pro", "task_id": "test_invalid_id"},
            body.jimeng_access_key,
            body.jimeng_secret_key,
        )
        code = result.get("code")
        if code in (401, 50400):
            return {"ok": False, "message": "凭证无效或未开通即梦视频生成 3.0 Pro 服务"}
        return {"ok": True, "message": "凭证有效，连接成功"}

    return {"ok": False, "message": f"未知 provider: {body.provider}"}
