#!/bin/bash
# publish-ollama-scripts.sh

# Add Homebrew path to PATH variable
export PATH="/opt/homebrew/bin:$PATH"

# Configuration
DOMAIN="https://public.qcrao.com"
BUCKET="qcrao-public"
BASE_PATH="rr-copilot"

# Shell scripts to upload
SCRIPTS=(
    "setup_ollama_cors.sh"
    "test_ollama_cors.sh" 
    "cleanup_ollama_cors.sh"
)

echo "🚀 Uploading Ollama CORS scripts to R2..."

# Upload each script
for script in "${SCRIPTS[@]}"; do
    REMOTE_PATH="$BASE_PATH/$script"
    LOCAL_PATH="$script"
    
    echo "📤 Uploading $script..."
    
    if wrangler r2 object put "$BUCKET/$REMOTE_PATH" --file "$LOCAL_PATH"; then
        echo "✅ $script uploaded successfully!"
        echo "🔗 Access at: $DOMAIN/$REMOTE_PATH"
    else
        echo "❌ Error: Failed to upload $script"
        exit 1
    fi
    echo
done

echo "🎉 All scripts uploaded successfully!"
echo
echo "📋 Public URLs:"
for script in "${SCRIPTS[@]}"; do
    echo "   $script: $DOMAIN/$BASE_PATH/$script"
done

for script in "${SCRIPTS[@]}"; do
    echo "curl -fsSL https://public.qcrao.com/rr-copilot/$script | bash"
done