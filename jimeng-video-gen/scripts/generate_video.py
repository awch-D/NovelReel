#!/usr/bin/env python3
"""
即梦 AI 视频生成 3.0 Pro (Jimeng Video Generation)
使用火山引擎 API，支持文生视频和图生视频。
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

# API 配置
API_HOST = "visual.volcengineapi.com"
API_URL = "https://visual.volcengineapi.com"
SERVICE = "cv"
REGION = "cn-north-1"
VERSION = "2022-08-31"
DEFAULT_REQ_KEY = "jimeng_ti2v_v30_pro"

# SSL 上下文（兼容部分系统证书链不完整的情况）
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def load_config():
    config_path = Path(__file__).parent.parent / "config.json"
    if not config_path.exists():
        return None
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


# === 签名 ===

def _sha256(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _hmac_sha256(key, msg):
    if isinstance(key, str):
        key = key.encode("utf-8")
    if isinstance(msg, str):
        msg = msg.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).digest()


def sign_request(method, action, body, ak, sk):
    now = datetime.now(timezone.utc)
    x_date = now.strftime("%Y%m%dT%H%M%SZ")
    short_date = x_date[:8]

    body_str = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    payload_hash = _sha256(body_str)

    query_params = {"Action": action, "Version": VERSION}
    canonical_query = "&".join(
        urllib.parse.quote(k, safe="~") + "=" + urllib.parse.quote(v, safe="~")
        for k, v in sorted(query_params.items())
    )

    signed_headers = "content-type;host;x-content-sha256;x-date"
    canonical_headers = (
        "content-type:application/json\n"
        + "host:" + API_HOST + "\n"
        + "x-content-sha256:" + payload_hash + "\n"
        + "x-date:" + x_date + "\n"
    )

    canonical_request = "\n".join([
        method, "/", canonical_query, canonical_headers, signed_headers, payload_hash
    ])

    credential_scope = short_date + "/" + REGION + "/" + SERVICE + "/request"
    string_to_sign = "\n".join([
        "HMAC-SHA256", x_date, credential_scope, _sha256(canonical_request)
    ])

    k_date = _hmac_sha256(sk, short_date)
    k_region = _hmac_sha256(k_date, REGION)
    k_service = _hmac_sha256(k_region, SERVICE)
    k_signing = _hmac_sha256(k_service, "request")
    signature = _hmac_sha256(k_signing, string_to_sign).hex()

    authorization = (
        "HMAC-SHA256 Credential=" + ak + "/" + credential_scope
        + ", SignedHeaders=" + signed_headers
        + ", Signature=" + signature
    )

    headers = {
        "Content-Type": "application/json",
        "Host": API_HOST,
        "X-Date": x_date,
        "X-Content-Sha256": payload_hash,
        "Authorization": authorization,
    }
    return headers, body_str, canonical_query


# === API 调用 ===

def api_call(action, body, ak, sk):
    headers, body_str, query = sign_request("POST", action, body, ak, sk)
    url = API_URL + "/?" + query
    req = urllib.request.Request(url, data=body_str.encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        return {"code": e.code, "message": "HTTP " + str(e.code) + ": " + error_body}
    except Exception as e:
        return {"code": -1, "message": str(e)}


def resolve_path(path):
    expanded = os.path.expanduser(path)
    if os.path.isabs(expanded):
        return os.path.normpath(expanded)
    return os.path.abspath(expanded)


def load_image(path):
    """读取图片文件并返回 base64 字符串。"""
    resolved = resolve_path(path)
    if not os.path.exists(resolved):
        return None, "File not found: " + resolved
    with open(resolved, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8"), None


def download_file(url, filepath):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180, context=SSL_CTX) as resp:
        with open(filepath, "wb") as f:
            f.write(resp.read())


def main():
    parser = argparse.ArgumentParser(description="Jimeng AI Video Generator (3.0 Pro)")
    parser.add_argument("--image", default=None, help="Input image path or URL (for image-to-video)")
    parser.add_argument("--prompt", default="", help="Text prompt for video generation")
    parser.add_argument("--output", default=".", help="Output directory")
    parser.add_argument("--req-key", default=DEFAULT_REQ_KEY, help="Model req_key")
    parser.add_argument("--frames", type=int, default=121, help="Total frames (121=5s, 241=10s)")
    parser.add_argument("--aspect-ratio", default="16:9", help="Aspect ratio (16:9, 4:3, 1:1, 3:4, 9:16, 21:9)")
    parser.add_argument("--seed", type=int, default=-1, help="Random seed (-1 for random)")
    parser.add_argument("--timeout", type=int, default=300, help="Max polling seconds")
    parser.add_argument("--access-key-id", help="AccessKeyId (overrides config)")
    parser.add_argument("--secret-access-key", help="SecretAccessKey (overrides config)")

    args = parser.parse_args()

    config = load_config() or {}
    ak = args.access_key_id or config.get("access_key_id", "")
    sk = args.secret_access_key or config.get("secret_access_key", "")

    if not ak or not sk:
        print(json.dumps({"success": False, "error": "NO_CREDENTIALS", "message": "Credentials not configured. Set in config.json or pass --access-key-id and --secret-access-key."}))
        sys.exit(1)

    output_dir = resolve_path(args.output)
    os.makedirs(output_dir, exist_ok=True)

    body = {
        "req_key": args.req_key,
        "seed": args.seed,
        "frames": args.frames,
    }

    # 图生视频 or 文生视频
    if args.image:
        image_path = args.image
        is_url = image_path.startswith("http://") or image_path.startswith("https://")
        if is_url:
            body["image_urls"] = [image_path]
        else:
            b64, err = load_image(image_path)
            if err:
                print(json.dumps({"success": False, "error": err}))
                sys.exit(1)
            body["binary_data_base64"] = [b64]
    else:
        # 文生视频需要 prompt 和 aspect_ratio
        body["aspect_ratio"] = args.aspect_ratio
        if not args.prompt:
            print(json.dumps({"success": False, "error": "Text-to-video requires --prompt"}))
            sys.exit(1)

    if args.prompt:
        body["prompt"] = args.prompt

    # 提交任务
    submit_result = api_call("CVSync2AsyncSubmitTask", body, ak, sk)

    if submit_result.get("code") != 10000:
        result = {
            "success": False,
            "error": submit_result.get("message", "Submit failed"),
            "code": submit_result.get("code"),
            "request_id": submit_result.get("request_id"),
        }
        # 特殊提示 401
        if submit_result.get("code") == 401 or submit_result.get("code") == 50400:
            result["hint"] = "Access Denied. 请确认已在火山引擎控制台开通即梦视频生成服务。"
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    task_id = submit_result.get("data", {}).get("task_id")
    if not task_id:
        print(json.dumps({"success": False, "error": "No task_id returned"}))
        sys.exit(1)

    # 轮询
    interval = 5
    elapsed = 0
    while elapsed < args.timeout:
        time.sleep(interval)
        elapsed += interval

        query_body = {
            "req_key": args.req_key,
            "task_id": task_id,
        }
        result = api_call("CVSync2AsyncGetResult", query_body, ak, sk)
        code = result.get("code")
        status = result.get("data", {}).get("status")

        if code != 10000:
            if code in [50411, 50412, 50413, 50511, 50512]:
                print(json.dumps({
                    "success": False,
                    "error": result.get("message", "Content moderation failed"),
                    "code": code,
                    "task_id": task_id,
                }, ensure_ascii=False))
                sys.exit(1)
            continue

        if status == "done":
            data = result.get("data", {})

            # 提取视频 URL（兼容多种返回字段）
            video_url = data.get("video_url")
            if not video_url:
                video_urls = data.get("video_urls", [])
                if video_urls:
                    video_url = video_urls[0]
            if not video_url:
                resp_data = data.get("resp_data")
                if resp_data and isinstance(resp_data, str):
                    try:
                        resp_data = json.loads(resp_data)
                    except Exception:
                        pass
                if isinstance(resp_data, dict):
                    video_url = resp_data.get("video_url") or (resp_data.get("video_urls", [None]) or [None])[0]

            if video_url:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = "jimeng_video_" + timestamp + ".mp4"
                filepath = os.path.join(output_dir, filename)
                try:
                    download_file(video_url, filepath)
                except Exception as e:
                    print(json.dumps({
                        "success": False,
                        "error": "Download failed: " + str(e),
                        "video_url": video_url,
                        "task_id": task_id,
                    }, ensure_ascii=False))
                    sys.exit(1)

                print(json.dumps({
                    "success": True,
                    "video_path": filepath,
                    "video_url": video_url,
                    "task_id": task_id,
                }, ensure_ascii=False))
                sys.exit(0)
            else:
                # 没有 video_url，输出完整 data 供调试
                print(json.dumps({
                    "success": False,
                    "error": "No video_url in response",
                    "task_id": task_id,
                    "data_keys": list(data.keys()),
                    "raw_data": data,
                }, ensure_ascii=False, indent=2))
                sys.exit(1)

        elif status in ["not_found", "expired"]:
            print(json.dumps({
                "success": False,
                "error": "Task " + status,
                "task_id": task_id,
            }))
            sys.exit(1)

    # 超时
    print(json.dumps({
        "success": False,
        "error": "Task timeout after " + str(args.timeout) + "s",
        "task_id": task_id,
    }))
    sys.exit(1)


if __name__ == "__main__":
    main()
