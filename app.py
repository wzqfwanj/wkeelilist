#!/usr/bin/env python3
"""wkeelilist —— wkeeli 在线服务列表

极简实现：
- GET /              单页列表
- GET /api/services  服务列表 + 在线状态（后台线程每 60 秒探测一次）
- GET /healthz       存活探针

状态判定：2xx/3xx 视为在线；401/403 视为「需登录」；5xx 或连接失败视为「异常」。
"""
from __future__ import annotations

import json
import os
import ssl
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICES_PATH = os.path.join(BASE_DIR, "services.json")
CHECK_INTERVAL = 60  # 探测间隔（秒）
PROBE_TIMEOUT = 6  # 单个服务探测超时（秒）
TZ = timezone(timedelta(hours=8))  # Asia/Shanghai

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.json.ensure_ascii = False

SSL_CTX = ssl.create_default_context()

_lock = threading.Lock()
_snapshot: dict = {"updated_at": None, "results": {}}


def load_groups() -> list[dict]:
    """读取服务清单（每次请求都读，改完 services.json 无需重启）。"""
    with open(SERVICES_PATH, encoding="utf-8") as fh:
        return json.load(fh)["groups"]


def probe(url: str) -> dict:
    """探测一个 URL，返回 state / code / latency_ms。"""
    started = time.monotonic()
    code = None
    try:
        request = urllib.request.Request(
            url,
            method="GET",
            headers={"User-Agent": "wkeelilist/1.0 (+https://wkeeli.cn/lst/)"},
        )
        with urllib.request.urlopen(request, timeout=PROBE_TIMEOUT, context=SSL_CTX) as response:
            code = response.status
    except urllib.error.HTTPError as exc:
        code = exc.code
    except Exception:  # 超时 / 拒绝连接 / TLS 失败
        code = None
    latency_ms = round((time.monotonic() - started) * 1000)

    if code is None:
        state = "down"
    elif code in (401, 403):
        state = "auth"
    elif code >= 500:
        state = "down"
    else:
        state = "online"
    return {"state": state, "code": code, "latency_ms": latency_ms}


def refresh_once() -> None:
    """探测全部服务并原子替换快照。"""
    services = [svc for group in load_groups() for svc in group["services"]]
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda svc: probe(svc.get("probe_url") or svc["url"]), services))

    snapshot = {
        "updated_at": datetime.now(TZ).isoformat(timespec="seconds"),
        "results": {svc["id"]: result for svc, result in zip(services, results)},
    }
    with _lock:
        global _snapshot
        _snapshot = snapshot


def background_loop() -> None:
    while True:
        try:
            refresh_once()
        except Exception as exc:  # 探测失败不影响页面
            print(f"[probe] {exc}", flush=True)
        time.sleep(CHECK_INTERVAL)


@app.get("/")
def index():
    return send_from_directory(os.path.join(BASE_DIR, "static"), "index.html")


@app.get("/api/services")
def api_services():
    groups = load_groups()
    with _lock:
        snapshot = _snapshot

    payload_groups = []
    counts = {"online": 0, "auth": 0, "down": 0}
    for group in groups:
        services = []
        for svc in group["services"]:
            result = snapshot["results"].get(
                svc["id"], {"state": "unknown", "code": None, "latency_ms": None}
            )
            state = result["state"]
            # 已知需要登录的服务：探测到 200（登录页）也统一显示「需登录」
            if svc.get("auth") and state == "online":
                state = "auth"
            if state in counts:
                counts[state] += 1
            item = {key: value for key, value in svc.items() if key != "probe_url"}
            item.update(result)
            item["state"] = state
            services.append(item)
        payload_groups.append({"id": group["id"], "label": group["label"], "services": services})

    response = jsonify(
        {"updated_at": snapshot["updated_at"], "counts": counts, "groups": payload_groups}
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/healthz")
def healthz():
    return {"ok": True}


def start_background() -> None:
    thread = threading.Thread(target=background_loop, daemon=True, name="status-probe")
    thread.start()


start_background()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8330, debug=False)
