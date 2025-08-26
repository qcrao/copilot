# Roam Copilot

Roam Copilot is a powerful AI assistant designed to seamlessly integrate with Roam Research. It provides a context-aware chat interface that helps you brainstorm, analyze, and connect your ideas directly within your Roam graph.

**A key feature of this extension is its support for local AI models**, allowing you to use powerful language models privately and offline.

<!-- TODO: Add a hero screenshot or a short GIF of Roam Copilot in action. -->

## Features

- **Context-Aware Chat**: Roam Copilot automatically reads the content of your current Roam page to provide relevant and intelligent responses.
- **Local First**: Full support for local AI models running on your machine via Ollama.
- **Floating, Draggable, and Resizable Interface**: The chat window is designed to be non-intrusive. You can move it, resize it, and minimize it as needed.
- **Conversation History**: All your conversations are saved, allowing you to revisit and continue them at any time.
- **Multi-Provider Support**: Switch between different AI providers, including OpenAI, Anthropic, and Grok, in addition to local models.
- **Prompt Templates**: Get started quickly with a variety of pre-built prompt templates for common tasks.
- **Date-Based Note Analysis**: Ask questions about your notes from a specific date.
- **Command Palette Integration**: Control Roam Copilot using the Roam Command Palette.

## Getting Started

### Prerequisites

- [Roam Research](https://roamresearch.com/)
- A modern web browser
- (Optional) [Ollama](https://ollama.ai/) for running local models.

### Installation

1.  **Enable the extension**: Follow the standard procedure for enabling a Roam Research extension.
2.  **Configure API Keys**: For cloud-based models, open the settings and add your API keys.

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

## How to Use

### Opening and Closing the Copilot

You can open, close, and toggle the Roam Copilot in two ways:

1.  **Click the Icon**: A lightbulb icon will appear in the bottom-right corner of your Roam window. Click it to open the Copilot.
2.  **Command Palette**: Open the Roam Command Palette (`Cmd+P` or `Ctrl+P`) and search for "Roam Copilot" to find the `Toggle`, `Open`, and `Close` commands.

<!-- TODO: Add screenshot of the command palette with the Roam Copilot commands. -->

### The Chat Interface

The chat interface is designed to be intuitive and powerful.

<!-- TODO: Add screenshot of the main chat interface. -->

- **Chat History**: On the left, you can browse and select previous conversations.
- **New Chat**: Start a new conversation at any time.
- **Minimize**: Minimize the chat window to the icon.
- **Context-Awareness**: The Copilot automatically uses the content of your current Roam page as context for the conversation.

### Using Prompt Templates

When you start a new chat, you'll see a grid of prompt templates. Click on a template to start a conversation with a pre-defined prompt.

**Available Templates:**

- **Creative Writing** - Transform notes into publishable content with strategic analysis
- **Knowledge Network** - Discover hidden connections and relationships between ideas
- **Task Planner** - Convert ideas into executable action plans with priorities
- **Learning Review** - Consolidate learning and identify knowledge gaps
- **Meeting Insights** - Extract decisions and action items from meeting notes
- **Research Assistant** - Expand research directions based on current notes
- **Idea Synthesizer** - Combine different concepts to generate new insights

<!-- TODO: Add screenshot of the prompt templates grid. -->

### Settings

You can configure the AI models and other settings from the settings panel.

<!-- TODO: Add screenshot of the settings panel. -->

## Development

To get started with development:

1.  Clone the repository.
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Build the extension:
    ```bash
    sh build.sh
    ```
4.  Load the extension in Roam Research.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the [MIT License](LICENSE).
