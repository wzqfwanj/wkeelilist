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

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICES_PATH = os.path.join(BASE_DIR, "services.json")
ORDER_PATH = os.path.join(BASE_DIR, "order.json")
CHECK_INTERVAL = 60  # 探测间隔（秒）
PROBE_TIMEOUT = 6  # 单个服务探测超时（秒）
HOST_INTERVAL = 10  # 主机指标采样间隔（秒）
DEV_METRICS_URL = "http://180.76.180.249:9100/metrics"  # dev 机 node_exporter
TZ = timezone(timedelta(hours=8))  # Asia/Shanghai

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.json.ensure_ascii = False

SSL_CTX = ssl.create_default_context()

_lock = threading.Lock()
_snapshot: dict = {"updated_at": None, "results": {}}

_host_lock = threading.Lock()
_host_stats: dict = {"updated_at": None, "hosts": []}
_prev_cpu: dict = {}

_order_lock = threading.Lock()


def load_order() -> list[str]:
    """读取用户拖拽保存的服务顺序（order.json），不存在则返回空列表。"""
    try:
        with open(ORDER_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        order = data.get("order", [])
        return [item for item in order if isinstance(item, str)]
    except Exception:
        return []


def save_order(order: list[str]) -> None:
    """原子写入顺序文件，避免半截文件。"""
    tmp = ORDER_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"order": order}, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, ORDER_PATH)


def _cpu_percent(host_id: str, cpu_total: float, cpu_idle: float) -> float | None:
    """用两次采样的累计 CPU 时间算利用率。"""
    prev = _prev_cpu.get(host_id)
    _prev_cpu[host_id] = (cpu_total, cpu_idle)
    if prev is None:
        return None
    d_total = cpu_total - prev[0]
    d_idle = cpu_idle - prev[1]
    if d_total <= 0:
        return None
    return round(max(0.0, min(100.0, (1 - d_idle / d_total) * 100)), 1)


def _mem_percent(mem_total: float | None, mem_available: float | None) -> float | None:
    if not mem_total or mem_available is None:
        return None
    return round(max(0.0, min(100.0, (mem_total - mem_available) / mem_total * 100)), 1)


def _read_local_cpu() -> tuple[float, float]:
    with open("/proc/stat", encoding="utf-8") as fh:
        values = [int(v) for v in fh.readline().split()[1:]]
    idle = values[3] + (values[4] if len(values) > 4 else 0)  # idle + iowait
    return float(sum(values)), float(idle)


def _read_local_mem() -> tuple[float, float]:
    total = available = None
    with open("/proc/meminfo", encoding="utf-8") as fh:
        for line in fh:
            key, _, rest = line.partition(":")
            if key == "MemTotal":
                total = float(rest.split()[0]) * 1024
            elif key == "MemAvailable":
                available = float(rest.split()[0]) * 1024
    return total, available


def _read_dev() -> tuple[float, float, float, float]:
    """从 dev 的 node_exporter 抓 CPU/内存指标。"""
    with urllib.request.urlopen(DEV_METRICS_URL, timeout=PROBE_TIMEOUT) as response:
        text = response.read().decode("utf-8", "ignore")

    cpu: dict[str, float] = {}
    mem_total = mem_available = None
    for line in text.splitlines():
        if line.startswith("node_cpu_seconds_total{"):
            try:
                mode = line.split('mode="', 1)[1].split('"', 1)[0]
                cpu[mode] = cpu.get(mode, 0.0) + float(line.rsplit(" ", 1)[1])
            except (IndexError, ValueError):
                continue
        elif line.startswith("node_memory_MemTotal_bytes "):
            mem_total = float(line.rsplit(" ", 1)[1])
        elif line.startswith("node_memory_MemAvailable_bytes "):
            mem_available = float(line.rsplit(" ", 1)[1])

    return sum(cpu.values()), cpu.get("idle", 0.0) + cpu.get("iowait", 0.0), mem_total, mem_available


def _host_entry(host_id: str, label: str, addr: str, reader) -> dict:
    try:
        cpu_total, cpu_idle, mem_total, mem_available = reader()
    except Exception:
        return {"id": host_id, "label": label, "addr": addr, "online": False}

    return {
        "id": host_id,
        "label": label,
        "addr": addr,
        "online": True,
        "cpu_percent": _cpu_percent(host_id, cpu_total, cpu_idle),
        "mem_percent": _mem_percent(mem_total, mem_available),
        "mem_total": mem_total,
        "mem_used": (mem_total - mem_available) if mem_total and mem_available is not None else None,
    }


def refresh_hosts() -> None:
    hosts = [
        _host_entry("aliyun", "阿里云", "8.133.209.25", lambda: (*_read_local_cpu(), *_read_local_mem())),
        _host_entry("dev", "dev", "180.76.180.249", _read_dev),
    ]
    with _host_lock:
        global _host_stats
        _host_stats = {
            "updated_at": datetime.now(TZ).isoformat(timespec="seconds"),
            "hosts": hosts,
        }


def host_loop() -> None:
    # 先采一次建立 CPU 时间基线，1 秒后再采样得到首个百分比
    try:
        refresh_hosts()
    except Exception as exc:
        print(f"[host] {exc}", flush=True)
    time.sleep(1)
    while True:
        try:
            refresh_hosts()
        except Exception as exc:
            print(f"[host] {exc}", flush=True)
        time.sleep(HOST_INTERVAL)


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
        {
            "updated_at": snapshot["updated_at"],
            "counts": counts,
            "order": load_order(),
            "groups": payload_groups,
        }
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@app.post("/api/order")
def api_save_order():
    """保存前端拖拽后的服务顺序。"""
    data = request.get_json(silent=True) or {}
    order = data.get("order")
    if not isinstance(order, list) or not all(isinstance(item, str) for item in order):
        return jsonify({"ok": False, "error": "order 必须是字符串数组"}), 400
    if len(order) > 500:
        return jsonify({"ok": False, "error": "order 过长"}), 400
    with _order_lock:
        try:
            save_order(order)
        except OSError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500
    return jsonify({"ok": True, "order": order})


@app.get("/api/host")
def api_host():
    with _host_lock:
        stats = _host_stats
    response = jsonify(stats)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/healthz")
def healthz():
    return {"ok": True}


def start_background() -> None:
    threading.Thread(target=background_loop, daemon=True, name="status-probe").start()
    threading.Thread(target=host_loop, daemon=True, name="host-metrics").start()


start_background()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8330, debug=False)
