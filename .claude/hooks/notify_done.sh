#!/usr/bin/env bash
set -euo pipefail

TITLE="Claude Code"
MSG="任务已完成"
SOUND="/System/Library/Sounds/Glass.aiff"

# 优先用 terminal-notifier（更可靠、可在通知设置里单独放行）
if /opt/homebrew/bin/terminal-notifier -message "$MSG" -title "$TITLE" -appIcon "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ToolbarAdvanced.icns" -timeout 5 >/dev/null 2>&1; then
  :
else
  # 兜底：用 osascript（可能受权限/Focus 影响）
  /usr/bin/osascript -e 'display notification "'"$MSG"'" with title "'"$TITLE"'" subtitle "Session Done"'
fi

# 无论如何再播一声
/usr/bin/afplay "$SOUND" >/dev/null 2>&1 || true