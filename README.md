# Last Year Today

Last Year Today is a Roam Research extension that automatically shows you what you wrote on the same day in previous years. It helps you reflect on your past thoughts, track your progress, and rediscover valuable insights from your journal entries.

![historical-pages](https://github.com/qcrao/last-year-today/blob/main/assets/historical-pages.png?raw=true)

## Features

1. **Automatic Daily Updates**

   - Automatically opens your historical pages at a configurable time each day
   - Displays entries from previous years in the right sidebar
   - Customizable number of years to look back (1-10 years)

2. **Visual Distinction**

   - Historical pages are visually distinct with custom styling
   - Beautiful borders and hourglass icons for easy identification
   - Clean and intuitive interface

3. **Flexible Controls**
   - Command palette integration for manual control
   - Open and close historical pages on demand
   - Configurable settings through the Roam Research settings panel

## Installation

1. In Roam Research, go to Settings > Roam Depot > Community extensions
2. Search for "Last Year Today"
3. Click "Install"

## Configuration

After installation, configure the extension in the Roam Research settings panel:

1. **Years Back**: Choose how many years to look back (1-10 years)

   - Default: 1 year
   - Maximum: 10 years

2. **Hour to Open Last Year Today Page**: Set when the historical pages should automatically open
   - Default: 9 AM
   - Range: 0-23 (24-hour format)

![settings](https://github.com/qcrao/last-year-today/blob/main/assets/settings.png?raw=true)

## Usage

### Automatic Updates

The extension will automatically open your historical pages in the right sidebar at your configured time each day. Each historical page will be displayed in chronological order, from oldest to newest.

### Manual Controls

You can also control the extension manually through the command palette (Cmd/Ctrl + P):

1. **Open Last Year Today**

   - Opens historical pages in the right sidebar
   - Shows pages from previous years for the current date

2. **Close Last Year Today**
   - Closes all historical page windows
   - Cleans up the sidebar

![command-palette](https://github.com/qcrao/last-year-today/blob/main/assets/command-palette.png?raw=true)

### Visual Indicators

Historical pages are marked with:

- Distinctive borders
- Hourglass icon (⏳)
- Highlighted date headers
- Subtle shadows for depth

![historical-page](https://github.com/qcrao/last-year-today/blob/main/assets/historical-page.png?raw=true)

# Roam Copilot

A powerful AI companion for Roam Research that helps you discover insights from your notes and encourages your writing journey.

## Features

- **Multi-Provider AI Support**: OpenAI, Anthropic, Groq, xAI, and **Ollama (Local)**
- **Context-Aware Conversations**: Automatically includes your current page, selected text, and daily notes
- **Conversation Management**: Save, load, and organize your chat history
- **Prompt Templates**: Pre-built templates for common writing and analysis tasks
- **Historical Note Analysis**: Query notes from specific dates or date ranges
- **Clickable Source References**: Direct links back to your Roam blocks and pages

## AI Providers

### Cloud Providers

- **OpenAI**: GPT-4o-mini, GPT-3.5-turbo
- **Anthropic**: Claude 3 Haiku, Claude 3.5 Haiku
- **Groq**: Llama 3.1 8B, Gemma 2 9B (Ultra fast & cheap)
- **xAI**: Grok 3 Mini, Grok Beta

### Local Provider

- **Ollama**: Run AI models locally on your machine

## Setting Up Ollama (Local AI)

Ollama allows you to run AI models locally on your computer, providing privacy and no API costs.

### Installation

1. **Download Ollama**: Visit [ollama.com](https://ollama.com/) and download for your platform
2. **Install Ollama**: Follow the installation instructions for your operating system
3. **Start Ollama**: Run `ollama serve` in your terminal (usually starts automatically)

### Download Models

Choose from popular models:

```bash
# Lightweight models (good for most tasks)
ollama pull llama3.2:3b
ollama pull phi3:3.8b

# Medium models (balanced performance)
ollama pull llama3.1:8b
ollama pull qwen2.5:7b
ollama pull mistral:7b

# Large models (best quality, requires more RAM)
ollama pull llama3.1:70b
ollama pull qwen2.5:14b
```

### Configuration in Roam Copilot

1. Open Roam Research settings
2. Go to the "Roam Copilot" tab
3. Configure **Ollama Service URL** (default: `http://localhost:11434`)
4. Select an Ollama model from the dropdown in the chat interface

### CORS Configuration (Important!)

To allow Roam Research (web app) and browser extensions to access your local Ollama service, you need to configure CORS origins.

#### Temporary Setup (needs to be done after each restart)

```bash
# Set CORS origins to allow Roam Research and browser extensions
launchctl setenv OLLAMA_ORIGINS "https://roamresearch.com,chrome-extension://*"

# Restart Ollama (choose one method):

# Method 1: Force kill and restart (most reliable)
lsof -ti:11434 | xargs kill -9 && sleep 2 && ollama serve

# Method 2: If using Ollama desktop app
# Click menu bar Ollama icon → "Quit Ollama", then restart the app

# Method 3: Using pkill
sudo pkill -f ollama && sleep 2 && ollama serve
```

#### Permanent Setup (recommended)

Create a LaunchAgent to set the environment variable permanently:

```bash
# Create the LaunchAgent plist file
cat << 'EOF' > ~/Library/LaunchAgents/setenv.OLLAMA_ORIGINS.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>setenv.OLLAMA_ORIGINS</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/launchctl</string>
      <string>setenv</string>
      <string>OLLAMA_ORIGINS</string>
      <string>https://roamresearch.com,chrome-extension://*</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ServiceIPC</key>
    <false/>
  </dict>
</plist>
EOF

# Load the LaunchAgent
launchctl load ~/Library/LaunchAgents/setenv.OLLAMA_ORIGINS.plist

# Restart your Mac or restart Ollama app for changes to take effect
```

#### Verification

```bash
# Check if CORS is set correctly
launchctl getenv OLLAMA_ORIGINS

# Test CORS (should return 204 status code)
curl -X OPTIONS http://localhost:11434 \
  -H "Origin: https://roamresearch.com" \
  -H "Access-Control-Request-Method: GET" \
  -I

# Check if Ollama is running
curl http://localhost:11434/api/tags
```

**Note**: This step is essential for the extension to work with Ollama. Without proper CORS configuration, browser security policies will block requests to your local Ollama service.

### Supported Ollama Models

The extension includes presets for common models:

- **llama3.1:8b** / **llama3.1:70b** - Meta's Llama 3.1 (excellent general purpose)
- **llama3.2:3b** - Smaller, faster Llama model
- **qwen2.5:7b** / **qwen2.5:14b** - Alibaba's Qwen (great for multilingual)
- **mistral:7b** - Mistral AI's efficient model
- **codellama:7b** - Specialized for code and technical content
- **gemma2:9b** - Google's Gemma 2
- **phi3:3.8b** - Microsoft's compact but capable model

### Troubleshooting Ollama

If you encounter connection issues:

1. **Check Ollama is running**: `ollama list` should show your installed models
2. **Verify service URL**: Default is `http://localhost:11434`
3. **Ensure model is downloaded**: Use `ollama pull model-name` to download
4. **Check firewall**: Make sure port 11434 is not blocked
5. **Configure CORS**: Set `OLLAMA_ORIGINS` environment variable (see CORS Configuration above)
6. **Check browser console**: Look for CORS errors in browser developer tools
7. **Restart Ollama properly**:
   - Use `sudo pkill -f ollama` then wait 2 seconds, then `ollama serve`
   - Or quit the Ollama app and restart it manually
   - Make sure to set the environment variable before restarting

**Common Errors**:

- **CORS Error**: "Access to fetch at 'http://localhost:11434' from origin 'https://roamresearch.com' has been blocked by CORS policy"

  - **Solution**: Configure CORS origins as described above and ensure Ollama is properly restarted

- **Port Already in Use**: "Error: listen tcp 127.0.0.1:11434: bind: address already in use"

  - **Solution**: Kill the process using port 11434:

    ```bash
    # Method 1: Kill process by port
    lsof -ti:11434 | xargs kill -9 && sleep 2 && ollama serve

    # Method 2: Find and kill Ollama processes
    sudo pkill -f ollama && sleep 2 && ollama serve

    # Method 3: Check what's using the port
    lsof -i :11434
    ```

- **Environment Variable Not Persisting**: CORS settings reset after restart

  - **Solution**: Use the permanent setup with LaunchAgent as described above

- **Models Not Loading**: Extension shows "Loading models..." indefinitely

  - **Solution**: Check if Ollama is running and accessible:

    ```bash
    # Test basic connection
    curl http://localhost:11434/api/tags

    # Check if models are available
    ollama list
    ```

**Environment Variable Check**: Verify the CORS setting is applied:

```bash
# Check using launchctl (recommended)
launchctl getenv OLLAMA_ORIGINS

# Alternative check (may not work for GUI apps)
echo $OLLAMA_ORIGINS
```

Expected output: `https://roamresearch.com,chrome-extension://*`

## Installation

1. Download the extension files
2. In Roam Research, go to Settings → Extensions
3. Add the extension using the provided configuration
4. Configure your AI provider API keys or Ollama setup

## Usage

1. **Open Copilot**: Click the lightbulb icon in the bottom-right corner
2. **Select Model**: Choose your preferred AI model from the dropdown
3. **Start Chatting**: Ask questions about your notes or request writing help
4. **Use Context**: The AI automatically sees your current page and selected text
5. **Save Conversations**: Your chats are automatically saved and can be revisited

## Privacy & Security

- **Cloud Providers**: Your data is sent to the respective AI services
- **Ollama (Local)**: All processing happens on your machine - no data leaves your computer
- **API Keys**: Stored locally in your Roam Research settings

## Development

```bash
npm install
npm run build
```

## License

MIT License - see LICENSE file for details.
