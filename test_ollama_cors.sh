#!/bin/bash

# Ollama CORS Test Script
# This script tests if Ollama CORS is properly configured for Roam Research

echo "🔍 Testing Ollama CORS configuration..."

# Check if Ollama is running
if ! curl -s http://localhost:11434/ > /dev/null; then
    echo "❌ Ollama is not running. Please start it with: ollama serve"
    exit 1
fi



CORS_RESPONSE=$(curl -s -X OPTIONS http://localhost:11434 \
     -H "Origin: https://roamresearch.com" \
     -H "Access-Control-Request-Method: POST" -I)

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS test passed!"
else
    echo "❌ CORS test failed!"
    echo "🔧 Try running: ./setup_ollama_cors.sh"
fi

 