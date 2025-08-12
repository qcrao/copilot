#!/usr/bin/env bash
set -euo pipefail

TITLE="Claude Code"
MSG="${1:-任务已完成}"   # ← 关键：优先用第一个参数

SOUND="/System/Library/Sounds/Glass.aiff"
TN="/opt/homebrew/bin/terminal-notifier"

# 发通知（优先 terminal-notifier，失败则 osascript 兜底）
if [ -x "$TN" ] && "$TN" -message "$MSG" -title "$TITLE" \
     -appIcon "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ToolbarAdvanced.icns" \
     -timeout 5 >/dev/null 2>&1; then
  :
else
  /usr/bin/osascript -e 'display notification "'"$MSG"'" with title "'"$TITLE"'" subtitle "Session Done"' || true
fi

# 再播一声（双保险）
/usr/bin/afplay "$SOUND" >/dev/null 2>&1 || true