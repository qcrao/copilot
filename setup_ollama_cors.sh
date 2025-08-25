#!/bin/bash
set -euo pipefail

# ------------------------------------------------------------------------------
# Ollama CORS Setup Script for Roam Copilot (v0.4, macOS-focused)
# - Forces OLLAMA_ORIGINS to comma-separated Roam domains (updates old values)
# - Persists via shell config + launchctl (login persistence)
# - Restarts Ollama (prefer launchctl service; fallback to CLI with env)
# - Verifies CORS using realistic preflight + actual requests
# - Diagnostic fallback to OLLAMA_ORIGINS="*" if domain-locked check fails
# ------------------------------------------------------------------------------

echo "🚀 Setting up Ollama CORS for Roam Copilot..."

# ---- Desired defaults (comma-separated!) ----
ORIGINS_DEFAULT="https://roamresearch.com,https://app.roamresearch.com"
HOST_DEFAULT="127.0.0.1:11434"

# Normalize any pre-set OLLAMA_ORIGINS (replace spaces with commas, trim)
normalize_origins() {
  local raw="${1:-}"
  # replace spaces with commas; collapse duplicate commas; trim commas
  raw="${raw// /,}"
  raw="$(printf "%s" "$raw" | sed -E 's/,+/,/g;s/^,|,$//g')"
  printf "%s" "$raw"
}

# Decide final ORIGINS to enforce (we UPGRADE/OVERRIDE old single-domain values)
ORIGINS_ENV_RAW="${OLLAMA_ORIGINS:-}"
ORIGINS_ENV_NORM="$(normalize_origins "$ORIGINS_ENV_RAW")"
if [[ -z "$ORIGINS_ENV_NORM" || "$ORIGINS_ENV_NORM" != *"roamresearch.com"* ]]; then
  ORIGINS="$ORIGINS_DEFAULT"
else
  # If user had something else, ensure commas and include app.roamresearch.com
  if [[ "$ORIGINS_ENV_NORM" != *"app.roamresearch.com"* ]]; then
    ORIGINS="$ORIGINS_ENV_NORM,https://app.roamresearch.com"
    ORIGINS="$(normalize_origins "$ORIGINS")"
  else
    ORIGINS="$ORIGINS_ENV_NORM"
  fi
fi

HOST="${OLLAMA_HOST:-$HOST_DEFAULT}"
BASE_URL="http://${HOST}"
PLIST_FILE="$HOME/Library/LaunchAgents/com.ollama.environment.plist"
PRIMARY_ORIGIN="https://roamresearch.com"
ALT_ORIGIN="https://app.roamresearch.com"

# ---- Sanity ----
if ! command -v ollama >/dev/null 2>&1; then
  echo "❌ Ollama is not installed. Please install: https://ollama.ai"
  exit 1
fi
SHELL_NAME=$(basename "${SHELL:-zsh}")
echo "🔍 Detected shell: $SHELL_NAME"

# ---- Helpers ----
replace_or_insert_export() {
  # Usage: replace_or_insert_export /path/to/file  "export VAR=VALUE"
  local file="$1"
  local line="$2"
  local varname
  varname="$(printf "%s" "$line" | awk -F= '{print $1}' | awk '{print $2}')"

  if [[ ! -f "$file" ]]; then
    printf '%s\n' "$line" > "$file"
    echo "✅ Created $file with $varname"
    return 0
  fi

  if grep -Eq '^[[:space:]]*export[[:space:]]+OLLAMA_ORIGINS=' "$file"; then
    # Replace the whole export line to enforce new value
    sed -i.bak -E 's|^[[:space:]]*export[[:space:]]+OLLAMA_ORIGINS=.*|'"$line"'|' "$file"
    echo "✅ Replaced existing OLLAMA_ORIGINS in $file"
  else
    printf '\n# Ollama CORS for Roam Copilot\n%s\n' "$line" >> "$file"
    echo "✅ Added OLLAMA_ORIGINS to $file"
  fi
}

start_or_restart_ollama() {
  echo "🔄 Restarting Ollama..."

  # Try to stop tray app (to avoid old env) - best effort
  pkill -f "Ollama.app" 2>/dev/null || true

  # Prefer launchd service if present
  if launchctl print "gui/$(id -u)/ai.ollama" >/dev/null 2>&1; then
    # Ensure launchctl env has the new value
    launchctl setenv OLLAMA_ORIGINS "$OLLAMA_ORIGINS"
    launchctl kickstart -k "gui/$(id -u)/ai.ollama" && echo "✅ Ollama restarted via launchctl" || true
  else
    # Fallback CLI: kill old and start with env injected
    pkill -f "ollama serve" 2>/dev/null || true
    sleep 1
    env OLLAMA_ORIGINS="$OLLAMA_ORIGINS" nohup ollama serve >/dev/null 2>&1 &
    echo "✅ Ollama started via 'ollama serve' (env passed)"
  fi

  # Wait for readiness
  for i in {1..10}; do
    if curl -fsS "$BASE_URL/" >/dev/null 2>&1; then
      echo "✅ Ollama is responding at $BASE_URL"
      return 0
    fi
    sleep 0.5
  done
  echo "⚠️  Ollama may not be responding on $BASE_URL"
  return 1
}

verify_cors_once() {
  local origin_try="$1"
  local preflight_out="/tmp/ollama_preflight_headers.txt"
  local tags_out="/tmp/ollama_tags_headers.txt"

  echo "🔍 Verifying CORS with Origin: $origin_try"

  echo "— Preflight (OPTIONS /api/generate) —"
  curl -s -i -X OPTIONS "$BASE_URL/api/generate" \
    -H "Origin: $origin_try" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" \
    | tee "$preflight_out" >/dev/null

  echo "— Actual (GET /api/tags) —"
  curl -s -i "$BASE_URL/api/tags" \
    -H "Origin: $origin_try" \
    | tee "$tags_out" >/dev/null

  if grep -qi "access-control-allow-origin:\s*\*" "$preflight_out" || \
     grep -qiF "Access-Control-Allow-Origin: $origin_try" "$preflight_out"; then :; else return 1; fi
  if grep -qi "access-control-allow-origin:\s*\*" "$tags_out" || \
     grep -qiF "Access-Control-Allow-Origin: $origin_try" "$tags_out"; then :; else return 1; fi

  return 0
}

verify_cors() {
  if verify_cors_once "$PRIMARY_ORIGIN"; then
    echo "🎉 CORS verification succeeded with $PRIMARY_ORIGIN"
    return 0
  elif verify_cors_once "$ALT_ORIGIN"; then
    echo "🎉 CORS verification succeeded with $ALT_ORIGIN"
    return 0
  else
    return 1
  fi
}

dump_last_headers() {
  echo
  echo "📄 Dump of last responses (for debugging):"
  echo "---- /api/generate (OPTIONS) headers ----"
  sed -n '1,80p' /tmp/ollama_preflight_headers.txt 2>/dev/null || true
  echo "---- /api/tags (GET) headers ----"
  sed -n '1,80p' /tmp/ollama_tags_headers.txt 2>/dev/null || true
}

# ---- 1) Persist OLLAMA_ORIGINS in shell profile (force-update!) ----
EXPORT_LINE="export OLLAMA_ORIGINS=\"$ORIGINS\""
case "$SHELL_NAME" in
  zsh)  replace_or_insert_export "$HOME/.zshrc" "$EXPORT_LINE" ;;
  bash) replace_or_insert_export "$HOME/.bash_profile" "$EXPORT_LINE"
        replace_or_insert_export "$HOME/.bashrc" "$EXPORT_LINE" ;;
  *)    echo "⚠️  Unknown shell: $SHELL_NAME"
        echo "   Please add this line to your shell profile: $EXPORT_LINE" ;;
esac

# ---- 2) Set for current session + launchctl persistence ----
export OLLAMA_ORIGINS="$ORIGINS"
echo "✅ Set OLLAMA_ORIGINS for current session: $OLLAMA_ORIGINS"

if [[ "${OSTYPE:-}" == darwin* ]]; then
  launchctl setenv OLLAMA_ORIGINS "$OLLAMA_ORIGINS"
  echo "✅ Set OLLAMA_ORIGINS for macOS launchctl"

  # Login persistence (re-apply env at login)
  cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ollama.environment</string>
    <key>ProgramArguments</key>
    <array>
        <string>sh</string>
        <string>-c</string>
        <string>launchctl setenv OLLAMA_ORIGINS "$ORIGINS"</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

  launchctl unload "$PLIST_FILE" >/dev/null 2>&1 || true
  if launchctl load "$PLIST_FILE" 2>/dev/null; then
    echo "✅ launchd plist loaded for persistent OLLAMA_ORIGINS"
  else
    echo "⚠️  launchd plist failed to load; env still set for this session/login"
  fi
fi

# ---- 3) Restart Ollama (kill tray, prefer launchd, fallback CLI) ----
start_or_restart_ollama

# ---- 4) Diagnostics & CORS verification ----
echo "🔎 Ollama version:"
ollama --version || true
echo "🔎 Effective OLLAMA_ORIGINS: '$OLLAMA_ORIGINS'"
echo "🔎 Checking OLLAMA_HOST: '${OLLAMA_HOST:-<not-set>}'"

echo "🔍 Verifying CORS configuration..."
if verify_cors; then
  :
else
  echo "⚠️  CORS with Roam domains failed. Trying wildcard '*' (diagnostic)…"
  SAVED_ORIGINS="${OLLAMA_ORIGINS:-}"
  export OLLAMA_ORIGINS="*"
  launchctl setenv OLLAMA_ORIGINS "*" 2>/dev/null || true
  start_or_restart_ollama || true

  if verify_cors_once "$PRIMARY_ORIGIN"; then
    echo "✅ Wildcard '*' works — server-side CORS is fine; earlier issue is likely env injection or origin mismatch."
  else
    echo "❌ Wildcard '*' still fails — likely an old binary/service is running or version is too old."
    echo "   - Ensure GUI app is not auto-starting an old daemon"
    echo "   - Prefer launchctl service or the CLI started by this script"
  fi

  if [ -n "$SAVED_ORIGINS" ]; then
    export OLLAMA_ORIGINS="$SAVED_ORIGINS"
    launchctl setenv OLLAMA_ORIGINS "$SAVED_ORIGINS" 2>/dev/null || true
  fi
fi

dump_last_headers

# ---- 5) Summary ----
echo
echo "🎉 Setup complete! Summary:"
echo "   - Shell config updated (old OLLAMA_ORIGINS replaced if present)"
echo "   - launchctl env set + LaunchAgent (macOS)"
echo "   - OLLAMA_ORIGINS: ${OLLAMA_ORIGINS}"
echo
echo "📝 Next steps:"
echo "   1) Open Roam Research"
echo "   2) In Roam Copilot settings, set Base URL to: $BASE_URL"
echo "   3) Pick a local model and start chatting"
echo
echo "🔄 For terminal sessions, run: source ~/.${SHELL_NAME}rc  (if you changed shell config)"