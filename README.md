# Roam Copilot

🚀 **Transform your Roam Research experience with AI-powered insights**

Roam Copilot brings the power of advanced AI directly into your Roam workspace. Get instant, context-aware assistance for brainstorming, analysis, and idea connections without ever leaving your graph.

✨ **Key Highlights:**

- 🧠 **Context-Aware Intelligence** - Automatically understands your current page content
- 🏠 **Privacy-First with Local AI** - Full support for local models via Ollama
- ⚡ **Multi-Provider Support** - OpenAI, Anthropic, Grok, DeepSeek, Qwen, Gemini, Groq, XAI, Ollama, and custom models
- 🎯 **User-friendly Interface** - Resizable and draggable window on the right side of your main workspace

<!-- TODO: Add a hero screenshot or a short GIF of Roam Copilot in action. -->

## ✨ What Makes Roam Copilot Special

### 🎯 **Smart Context Understanding**

- Automatically reads your current page content
- Uses visible blocks, including sidebar notes, as conversation context
- No manual copy-pasting required

### 🏠 **Privacy & Control**

- **Local AI Models** - Run powerful models privately via Ollama
- **Multiple Providers** - OpenAI, Anthropic, Grok, or custom endpoints
- Your data stays where you want it

### 💬 **Intuitive Chat Experience**

- **User-friendly Interface** - Draggable, resizable, and minimizable
- **Conversation History** - Never lose your AI conversations
- **Quick Templates** - Pre-built prompts for common workflows
- **Command Palette** - Keyboard shortcuts for power users
- **Smart Input Features** - @ to search pages, drag & drop blocks, / for templates

### 📝 **Powerful Templates**

- **Official Templates** - Pre-built prompts for common workflows
  - Insights
  - Writing assistance

- **Custom Templates** - Create your own templates
  - Define custom prompts
  - Add descriptions and icons
  - Organize by categories

<!-- TODO: Add screenshot of the prompt templates grid. -->

## 🚀 Quick Start

### Installation from Roam Depot

1. **Install from Roam Depot** - Search for "Roam Copilot" in your Roam Research extensions
2. **Configure Your AI Provider** - Add API keys for OpenAI, Anthropic, or Grok in settings
3. **Start Chatting** - Click the lightbulb icon in the bottom-right corner

### Prerequisites

- [Roam Research](https://roamresearch.com/) account
- API key from your preferred AI provider (or [Ollama](https://ollama.ai/) for local models)

### Using Local Models (Ollama)

To use Roam Copilot with a local Ollama instance, you must configure Ollama to accept requests from Roam Research. This is a critical security step required by Ollama. Here is a detailed guide to get it working:

**1. Check if Ollama is Running**

Open your terminal and run the following command. You should see a response from the Ollama server.

```bash
curl http://localhost:11434/
```

**2. List Your Installed Models**

Verify which models you have available locally.

```bash
ollama list
# or via the API
curl http://localhost:11434/api/tags
```

**3. Set the Allowed Origin for Roam Research**

This is the most important step. You need to tell Ollama to accept connections from `https://roamresearch.com`.

#### Option A: One-Click Setup Script (Recommended)

We provide scripts that automatically set up, test, and clean up CORS configuration. You can either download them from the repository or use our hosted versions:

**Download and run the setup script:**

```bash
# Option 1: Download from public URL
curl -fsSL https://public.qcrao.com/rr-copilot/setup_ollama_cors.sh | bash
```

This script will:

- Add the environment variable to your shell configuration file (`.zshrc`, `.bash_profile`, etc.)
- Create a persistent launchd configuration on macOS
- Restart Ollama automatically
- Verify the CORS configuration

**To test if CORS is working correctly:**

```bash
# Download and run the test script
curl -fsSL https://public.qcrao.com/rr-copilot/test_ollama_cors.sh | bash
```

**To remove the CORS configuration later:**

```bash
# Download and run the cleanup script
curl -fsSL https://public.qcrao.com/rr-copilot/cleanup_ollama_cors.sh | bash
```

#### Option B: Manual Setup (Persistent Configuration)

**For permanent configuration that survives restarts:**

1. **Add to your shell configuration file:**

```bash
# For zsh users (most common on macOS)
echo 'export OLLAMA_ORIGINS="https://roamresearch.com"' >> ~/.zshrc

# For bash users
echo 'export OLLAMA_ORIGINS="https://roamresearch.com"' >> ~/.bash_profile
```

2. **On macOS, create a persistent launchd configuration:**

```bash
# Create the plist file
cat > ~/Library/LaunchAgents/com.ollama.environment.plist << 'EOF'
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
        <string>launchctl setenv OLLAMA_ORIGINS "https://roamresearch.com"</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOF

# Load the plist
launchctl load ~/Library/LaunchAgents/com.ollama.environment.plist
```

3. **Apply the changes:**

```bash
# Reload your shell configuration
source ~/.zshrc  # or ~/.bash_profile for bash users

# Set for current session
export OLLAMA_ORIGINS="https://roamresearch.com"
launchctl setenv OLLAMA_ORIGINS "https://roamresearch.com"
```

#### Option C: Temporary Setup (Session Only)

_Note: This method requires re-running after each restart._

```bash
# On macOS:
launchctl setenv OLLAMA_ORIGINS "https://roamresearch.com"
```

**4. Verify the Environment Variable**

Confirm that the variable was set correctly.

```bash
# Check environment variable
echo $OLLAMA_ORIGINS

# On macOS, also check launchctl
launchctl getenv OLLAMA_ORIGINS
```

Both commands should output: `https://roamresearch.com`

**5. Restart Ollama**

For the changes to take effect, you must restart the Ollama server:

```bash
# Stop Ollama
pkill -f ollama

# Start Ollama (or simply run)
ollama serve
```

Alternatively, you can use Activity Monitor on macOS to find and quit the "Ollama" process, then restart the application.

**6. Verify CORS Configuration**

You can double-check that the CORS policy is correctly applied by sending a test request from the terminal.

```bash
curl -X OPTIONS http://localhost:11434 \
     -H "Origin: https://roamresearch.com" \
     -H "Access-Control-Request-Method: POST" -I
```

If successful, you should see headers like `Access-Control-Allow-Origin: https://roamresearch.com` in the response.

**7. Configure Roam Copilot Settings**

Finally, open the Roam Copilot settings in Roam Research and set the Ollama address to:

```
http://localhost:11434
```

<!-- TODO: Add screenshot of the settings panel showing the Ollama address field. -->

You should now be able to select and use your local Ollama models from within Roam Copilot.

## 💬 How to Use

### Getting Started

- **💡 Click the lightbulb icon** in the bottom-right corner, or
- **⌨️ Use Command Palette** (`Cmd+P` / `Ctrl+P`) → Search "Roam Copilot"

### Chat Interface

- **🔄 Auto-Context** - Your current page content is automatically included
- **📚 Chat History** - Access previous conversations from the sidebar
- **➕ New Conversations** - Start fresh chats anytime
- **🔽 Minimize/Expand** - Keep it out of the way when not needed

### Settings

You can configure the AI models and other settings from the settings panel.

<!-- TODO: Add screenshot of the settings panel. -->



## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the [MIT License](LICENSE).
