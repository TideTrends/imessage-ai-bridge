#!/bin/bash

# iMessage AI Bridge - One-Command Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/TideTrends/imessage-ai-bridge/main/install.sh | bash

set -e

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     iMessage AI Bridge Installer       ║"
echo "║     Gemini • ChatGPT • Grok           ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check for macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This tool only works on macOS (requires iMessage)"
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "   Install it from https://nodejs.org or run: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. You have $(node -v)"
    exit 1
fi

# Check for Chrome
if [ ! -d "/Applications/Google Chrome.app" ]; then
    echo "❌ Google Chrome is required but not installed."
    echo "   Download from https://google.com/chrome"
    exit 1
fi

echo "✓ Prerequisites checked"

# Install directory
INSTALL_DIR="$HOME/imessage-ai-bridge"

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
    echo "→ Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo "→ Cloning repository..."
    git clone https://github.com/TideTrends/imessage-ai-bridge.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo "→ Installing dependencies..."
npm install --silent

# Install Playwright Chrome
echo "→ Setting up browser automation..."
npx playwright install chromium --quiet 2>/dev/null || npx playwright install chromium

# Build
echo "→ Building..."
npm run build --silent

# Create directories
mkdir -p "$INSTALL_DIR/browser-data/gemini"
mkdir -p "$INSTALL_DIR/browser-data/chatgpt"
mkdir -p "$INSTALL_DIR/browser-data/grok"
mkdir -p "$INSTALL_DIR/state"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║         Installation Complete!         ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Grant permissions in System Settings:"
echo "     → Privacy & Security → Full Disk Access → Add Terminal"
echo ""
echo "  2. Start the bridge:"
echo "     cd ~/imessage-ai-bridge && npm start"
echo ""
echo "  3. On first run, enter your phone number"
echo ""
echo "  4. Log into AI services when browsers open"
echo ""
echo "That's it! Send a text to yourself to test."
echo ""
