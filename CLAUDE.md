# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Roam Copilot" - a Roam Research extension that provides an AI-powered chat interface similar to Cursor IDE. The extension displays a floating chat window in the bottom-right corner that can be minimized or expanded, and uses page context to provide intelligent responses.

## Build Commands

### Development
```bash
npm run dev          # Watch mode development build
npm run build        # Production build
```

### Alternative Build Scripts
```bash
./build.sh           # npm-based build with roamjs-scripts
./bun-build.sh       # bun-based build with roamjs-scripts
```

Both build scripts use `roamjs-scripts build --depot` for Roam Research extension packaging.

## Architecture

### Core Components

- **Entry Point**: `src/index.tsx` - Main extension lifecycle and widget container management
- **Components**:
  - `CopilotWidget`: Main chat interface with minimize/expand functionality
- **Services**:
  - `AIService`: Handles API calls to OpenAI, Anthropic, and Grok
  - `RoamService`: Extracts page content and context for AI prompts
- **Settings**: AI provider configuration (API keys, models, parameters)
- **Types**: TypeScript definitions for AI providers, chat messages, and Roam data structures

### Key Architecture Patterns

1. **Extension Lifecycle**: Uses Roam's extension API with onload/onunload hooks
2. **Context-Aware AI**: Automatically extracts visible page content as context for AI conversations
3. **Multi-Provider Support**: Abstracts AI providers (OpenAI, Anthropic, Grok) behind unified interface
4. **React Components**: Uses Blueprint.js for consistent Roam styling with custom CSS
5. **Floating UI**: Fixed-position widget that doesn't interfere with Roam's interface

### Data Flow

1. Extension loads → Settings initialized → Commands registered → Widget rendered
2. User opens copilot → Page context extracted → Ready for conversation
3. User sends message → Context + message sent to AI → Response rendered as markdown
4. Real-time context updates when user changes pages or selects text

## Development Notes

### AI Providers
- **OpenAI**: Standard chat completions API with system messages
- **Anthropic**: Claude API with separate system/user message handling
- **Grok**: xAI API compatible with OpenAI format

### Context Extraction
- Extracts current page title and all blocks recursively
- Gets visible blocks in current viewport
- Includes selected text if any
- Formats as structured markdown for AI consumption

### Roam API Usage
- Uses Datalog queries via `roamAlphaAPI.q()` for page and block data
- DOM inspection for visible content detection
- Command palette integration for keyboard shortcuts

### UI Framework
- Blueprint.js components for consistency with Roam
- TailwindCSS for utility styling (with preflight disabled)
- Custom CSS for chat interface and animations
- Markdown rendering with syntax highlighting

### Build Output
- `extension.js` - Main bundle (CommonJS format)
- `extension.css` - Extracted styles with TailwindCSS
- External dependencies: React, ReactDOM, Blueprint.js from Roam environment

### TypeScript Configuration
- Target: ES2020 with strict mode enabled
- JSX: React (external dependency)
- Global Roam API types in `src/global.d.ts`
- Module system: ESNext with CommonJS output