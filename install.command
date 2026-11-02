#!/bin/bash
# cursor-zh — macOS double-click installer
set -u

cd "$(dirname "$0")" || exit 1

echo "cursor-zh — Cursor 简体中文汉化"
echo "================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node.js 18 或更高版本："
  echo "  https://nodejs.org/"
  echo "  或：brew install node"
  echo
  read -r -p "按回车退出..." _
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 版本过低：$(node -v)，需要 18 或更高版本。"
  echo
  read -r -p "按回车退出..." _
  exit 1
fi

echo "Node.js: $(node -v)"
echo "仓库: $(pwd)"
echo

APP_ARGS=()
if [ -n "${CURSOR_ZH_APP:-}" ]; then
  APP_ARGS=(--app "$CURSOR_ZH_APP")
fi

node cli/index.js doctor "${APP_ARGS[@]}" || true
echo
node cli/index.js install "${APP_ARGS[@]}"
STATUS=$?

echo
if [ "$STATUS" -eq 0 ]; then
  echo "完成。请完全退出 Cursor（Cmd + Q）再重新打开。"
else
  echo "安装未完成（退出码 $STATUS）。"
  echo "如需回滚：node cli/index.js restore"
fi
echo
read -r -p "按回车关闭窗口..." _
exit "$STATUS"
