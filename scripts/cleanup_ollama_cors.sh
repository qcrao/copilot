#!/bin/bash

# Ollama CORS Cleanup Script for Roam Copilot
# This script removes the CORS configuration set up by setup_ollama_cors.sh

echo "🧹 Cleaning up Ollama CORS configuration..."

# Determine the current shell
SHELL_NAME=$(basename "$SHELL")

# Function to remove environment variable from shell config
remove_from_shell_config() {
    local config_file="$1"
    
    if [ -f "$config_file" ]; then
        # Check if the line exists
        if grep -q "OLLAMA_ORIGINS.*roamresearch.com" "$config_file"; then
            # Create backup
            cp "$config_file" "${config_file}.backup"
            
            # Remove the lines
            sed -i.tmp '/# Ollama CORS for Roam Copilot/d' "$config_file"
            sed -i.tmp '/OLLAMA_ORIGINS.*roamresearch.com/d' "$config_file"
            sed -i.tmp '/# Auto-run Ollama CORS setup/d' "$config_file"
            sed -i.tmp '/ollama_cors_startup.sh/d' "$config_file"
            rm "${config_file}.tmp"
            
            echo "✅ Shell configuration updated"
        fi
    fi
}

# Remove from appropriate shell config files
case "$SHELL_NAME" in
    zsh)
        remove_from_shell_config "$HOME/.zshrc"
        ;;
    bash)
        remove_from_shell_config "$HOME/.bash_profile"
        remove_from_shell_config "$HOME/.bashrc"
        ;;
    *)
        echo "⚠️  Unknown shell: $SHELL_NAME"
        echo "Please manually remove: export OLLAMA_ORIGINS=\"https://roamresearch.com\" from your shell config"
        ;;
esac

# Unset environment variable for current session
unset OLLAMA_ORIGINS

# Remove environment variable from macOS launchctl
if [[ "$OSTYPE" == "darwin"* ]]; then
    launchctl unsetenv OLLAMA_ORIGINS 2>/dev/null
fi

# Remove launchd plist file on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLIST_FILE="$HOME/Library/LaunchAgents/com.ollama.environment.plist"
    
    if [ -f "$PLIST_FILE" ]; then
        # Unload the plist
        launchctl unload "$PLIST_FILE" 2>/dev/null
        
        # Remove the plist file
        rm "$PLIST_FILE"
        
        echo "✅ LaunchAgent removed"
    fi
fi

# Remove backup startup script
STARTUP_SCRIPT="$HOME/.ollama_cors_startup.sh"
if [ -f "$STARTUP_SCRIPT" ]; then
    rm "$STARTUP_SCRIPT"
fi

# Function to restart Ollama
restart_ollama() {
    echo "🔄 Restarting Ollama..."
    
    # Try to stop Ollama gracefully
    if pgrep -f "ollama serve" > /dev/null; then
        pkill -f "ollama serve"
        sleep 2
    fi
    
    # Kill any remaining Ollama processes
    pkill -f ollama 2>/dev/null || true
    sleep 1
    
    # Start Ollama in background
    ollama serve > /dev/null 2>&1 &
    sleep 3
    
    # Check if Ollama is running
    if curl -s http://localhost:11434/ > /dev/null; then
        echo "✅ Ollama restarted"
    else
        echo "⚠️  Please restart Ollama manually: ollama serve"
    fi
}

restart_ollama

# Verify cleanup
if [ -z "$OLLAMA_ORIGINS" ] && ! launchctl getenv OLLAMA_ORIGINS >/dev/null 2>&1; then
    echo "✅ Cleanup successful!"
else
    echo "⚠️  Some configuration may still be active"
fi

echo
echo "🎉 Cleanup complete!"
echo "📝 Restart terminal or run: source ~/.${SHELL_NAME}rc" 