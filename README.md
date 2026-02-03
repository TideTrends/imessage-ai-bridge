# iMessage AI Bridge

Text your AI. Get responses via iMessage.

**Gemini • ChatGPT • Grok** — all through iMessage, completely free.


## What It Does

Send a text message → Get an AI response back. That's it.

- **No API costs** - Uses web interfaces directly
- **Multiple AIs** - Switch between Gemini, ChatGPT, and Grok
- **Images** - Send photos for AI analysis
- **Smart models** - Begin message with `.` for thinking mode, `..` for max power

## How It Works

1. Watches your iMessage database for new texts
2. Routes to the right AI based on your message
3. Automates the web interface using Puppeteer + Chrome
4. Sends the AI response back via iMessage

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
npm run build
npm start
```

## Commands

```bash
npm start            # Run the bridge
npm start -- --setup # Re-configure phone number
npm run build        # Rebuild after changes
```

## Configuration

Settings are stored in `~/imessage-ai-bridge/config.json`:

```json
{
  "targetPhone": "5551234567",
  "targetPhoneFull": "+15551234567",
  "messagePrefix": "[be brief, respond like a text message]\n\n"
}
```

**messagePrefix** - Text prepended to the first message of each new conversation. Default instructs AI to be brief and text-like. Set to `""` to disable.

## Text Commands

Send these as iMessages:

| Command | Description |
|---------|-------------|
| `reset` | Clear all AI conversations |
| `status` | Check which AIs are logged in |
| (blank line + message) | Start new conversation |

## AI Selection

| Prefix | AI |
|--------|-----|
| (none) | Gemini (default) |
| `chatgpt` | ChatGPT |
| `grok` | Grok |

## Model Power

| Prefix | Mode |
|--------|------|
| (none) | Fast/Auto |
| `.` | Thinking/Pro |
| `..` | Maximum |

**Examples:**
- `What's the weather?` → Fast Gemini
- `.Explain black holes` → Gemini Deep Think
- `..chatgpt Write code` → ChatGPT o1/o3

## Update

Pull latest from GitHub:

```bash
bash scripts/update.sh
```

## Troubleshooting

**"Not logged in"** → Sign into each AI in the browser windows that open

**No response** → Check browser windows for captchas/popups

**Permission errors** → Ensure Terminal has Full Disk Access

## License

MIT

## Disclaimer

Automating web interfaces may violate terms of service. This can result in bans or rate limits. Use at your own risk.
