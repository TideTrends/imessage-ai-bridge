# iMessage AI Bridge

Text your AI. Get responses via iMessage.

**Gemini • ChatGPT • Grok** — all through iMessage, completely free.


## What It Does

Send a text message → Get an AI response back. That's it.

- **No API costs** - Uses web interfaces directly
- **Multiple AIs** - Switch between Gemini, ChatGPT, and Grok
- **Images** - Send photos for AI analysis
- **Smart models** - Begin message with `.` for thinking mode, `..` for max power

It is recommended to create a new iCloud & macOS account for this to run. It will work if you do not do this, albeit in the text thread you will see the same message received and sent, which breaks the authenticity. Again, fully functional, but highly recommended to use an old Mac with it's own iCloud email to accomplish this, particularly because the computer needs to be on constantly. Use Amphetamine app to keep the mac on all the time. 

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/TideTrends/imessage-ai-bridge/main/install.sh | bash
```


## Quick Start

After installing:

```bash
cd ~/imessage-ai-bridge
npm start
```
1. Enter your personal phone number/iCloud Email when prompted
2. Log into AI services in the browser windows that open
3. Text your AI's iCloud email/your phone number to test!

## Usage

### Choose Your AI

| Message | AI |
|---------|-----|
| `Hello` | Gemini (default) |
| `chatgpt Hello` | ChatGPT |
| `grok Hello` | Grok |

### Model Power

| Prefix | Mode |
|--------|------|
| (none) | Fast/Auto |
| `.` | Thinking/Pro |
| `..` | Maximum |

**Examples:**
- `What's the weather?` → Fast Gemini
- `.Explain black holes` → Gemini Pro
- `..chatgpt Write code` → GPT-4

### Special

- **New chat**: Press Enter before your message
- **Reset all**: Send `reset`
- **Status check**: Send `status`

## Requirements

- macOS (iMessage required)
- Node.js 18+
- Google Chrome
- Accounts on ChatGPT/Gemini/Grok

## Permissions

Grant **Full Disk Access** to Terminal:
> System Settings → Privacy & Security → Full Disk Access → Add Terminal

## Manual Install

```bash
git clone https://github.com/TideTrends/imessage-ai-bridge.git
cd imessage-ai-bridge
npm install
npx playwright install chromium
npm run build
npm start
```

## Commands

```bash
npm start      # Run the bridge
npm run login  # Open browsers for login
npm run build  # Rebuild after changes
```

## How It Works

1. Watches your iMessage database for new texts
2. Routes to the right AI based on your message
3. Automates the web interface using Playwright + Chrome
4. Sends the AI response back via iMessage

## Troubleshooting

**"Not logged in"** → Run `npm run login` and sign into each service

**No response** → Check browser windows for captchas/popups

**Permission errors** → Ensure Terminal has Full Disk Access

## License

MIT

## Disclaimer

Automating web interfaces may violate terms of service. Use responsibly.
