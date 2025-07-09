#!/bin/bash

# Ollama CORS Test Script
# This script tests if Ollama CORS is properly configured for Roam Research

echo "🔍 Testing Ollama CORS configuration..."

# Check if Ollama is running
if ! curl -s http://localhost:11434/ > /dev/null; then
    echo "❌ Ollama is not running. Please start it with: ollama serve"
    exit 1
fi

echo "✅ Ollama is running"

# Check environment variable
if [ -n "$OLLAMA_ORIGINS" ]; then
    echo "✅ OLLAMA_ORIGINS is set to: $OLLAMA_ORIGINS"
else
    echo "⚠️  OLLAMA_ORIGINS is not set in current session"
fi

# Check launchctl (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if launchctl getenv OLLAMA_ORIGINS >/dev/null 2>&1; then
        LAUNCH_VALUE=$(launchctl getenv OLLAMA_ORIGINS 2>/dev/null)
        echo "✅ OLLAMA_ORIGINS is set in launchctl to: $LAUNCH_VALUE"
    else
        echo "⚠️  OLLAMA_ORIGINS is not set in launchctl"
    fi
fi

# Test CORS with actual request
echo "🔍 Testing CORS with actual request..."

CORS_RESPONSE=$(curl -s -X OPTIONS http://localhost:11434 \
     -H "Origin: https://roamresearch.com" \
     -H "Access-Control-Request-Method: POST" -I)

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS test passed! Ollama accepts requests from Roam Research"
    
    # Show the actual CORS headers
    echo ""
    echo "📋 CORS Headers:"
    echo "$CORS_RESPONSE" | grep -i "access-control" | sed 's/^/   /'
else
    echo "❌ CORS test failed! Ollama may not be configured correctly"
    echo ""
    echo "🔧 Try running: ./setup_ollama_cors.sh"
fi

echo ""
echo "📊 Configuration Summary:"
echo "   - Ollama Status: $(curl -s http://localhost:11434/ > /dev/null && echo "Running" || echo "Not running")"
echo "   - Environment Variable: $([ -n "$OLLAMA_ORIGINS" ] && echo "Set" || echo "Not set")"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   - launchctl Variable: $(launchctl getenv OLLAMA_ORIGINS >/dev/null 2>&1 && echo "Set" || echo "Not set")"
fi
echo "   - CORS Test: $(echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin" && echo "Passed" || echo "Failed")" 