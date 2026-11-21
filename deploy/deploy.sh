#!/usr/bin/env bash
# 本地执行：构建 Vue 前端（frontend/）+ 同步后端与静态产物到阿里云并重启
# 前置：ssh aliyun 可用；服务器已按 README 初始化（venv + systemd + Caddy）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> build frontend (Vue 3 + Vite)"
(cd frontend && npm install --no-audit --no-fund && npm run build)

echo "==> upload backend + frontend dist"
ssh aliyun 'mkdir -p /opt/wkeelilist/static'
scp app.py services.json aliyun:/opt/wkeelilist/
scp frontend/dist/index.html aliyun:/opt/wkeelilist/static/index.html
ssh aliyun 'find /opt/wkeelilist/static -maxdepth 1 -type f \( -name "*.js" -o -name "*.css" \) -delete'
scp -r frontend/dist/static/* aliyun:/opt/wkeelilist/static/

echo "==> restart service"
ssh aliyun 'systemctl restart wkeelilist && sleep 1 && systemctl is-active wkeelilist'
echo "deployed: https://wkeeli.cn/lst/"
