#!/usr/bin/env bash
# 本地执行：同步代码到阿里云跳板机并重启服务
# 前置：ssh aliyun 可用；服务器已按 README 初始化（venv + systemd + Caddy）
set -euo pipefail
cd "$(dirname "$0")/.."

ssh aliyun 'mkdir -p /opt/wkeelilist/static'
scp app.py services.json aliyun:/opt/wkeelilist/
scp static/index.html static/style.css static/app.js aliyun:/opt/wkeelilist/static/

ssh aliyun 'systemctl restart wkeelilist && sleep 1 && systemctl is-active wkeelilist'
echo "deployed: https://wkeeli.cn/lst/"
