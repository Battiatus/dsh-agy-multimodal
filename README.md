<h1 align="center">dsh-gemini-antigravity-auth</h1>

<p align="center"><strong>Gemini for DeepSeek Harness, with your Google Antigravity subscription.</strong><br>
Sign in with Google, pick a Gemini model, and let your agent search the web and understand images, audio, video and PDFs.</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#faq">FAQ</a> ·
  <a href="README.fr.md">Français</a>
</p>

<p align="center">
  <img alt="DeepSeek Harness plugin" src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-4D6BFE">
  <img alt="Gemini" src="https://img.shields.io/badge/Gemini-Antigravity-1A73E8">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-green">
</p>

---

**dsh-gemini-antigravity-auth** is a [DeepSeek Harness](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) (DSH) plugin that adds Google **Gemini** models through **Google Antigravity** OAuth. No API key, no extra CLI: you log in with your Google account and the Gemini models appear in the DSH model picker, next to your other providers.

## Features

- 🔐 **Google sign-in (OAuth)**: one click from the settings screen or `/agy login`. No API key to copy.
- 🤖 **Your Antigravity models, as Google lists them**: the picker shows exactly the models Google offers your account (Gemini, and Claude or GPT-OSS when your plan includes them), with Google's own names, read from your account at sign-in.
- 👥 **Several Google accounts**: add, switch and remove accounts, and see the remaining quota of each one, with its reset time.
- 🖼️ **Multimodal attachments**: images, audio, video and PDF attached to a message go straight to Gemini.
- 🔎 **`agy_web_search` tool**: Google Search grounding with sources, usable by any agent.
- 🎬 **`agy_media` tool**: your agent can analyse an image, audio, video or PDF file from the working folder (up to ~36 MB).
- 🎛️ **Access switches**: turn the Gemini models, web search or media analysis on and off, and hide the models you don't use.
- 🧩 **Works with DSH tools**: full tool calling, with tool schemas adapted to what Gemini accepts.

## Install

Close DeepSeek Harness, then run:

```bash
dsh plugin --profile desktop add gemini-dsh
```

Restart DeepSeek Harness. That's it.

Installing from the app's plugin screen instead? Paste the full address:

```text
git+https://github.com/Battiatus/dsh-gemini-antigravity-auth.git
```

> **`dsh: command not found`?** The CLI ships inside the app:
> `"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"`.
> Use a different `--profile` (for example `web` or `tui`) to install it in another DSH profile.

**Update**

```bash
dsh plugin --profile desktop update gemini-dsh
```

**Uninstall**

```bash
dsh plugin --profile desktop remove gemini-dsh
```

## Usage

1. Open **Settings › Antigravity** and click **Sign in with Google** (or type `/agy login`).
2. Choose your Google account and approve access in the page that opens. If no page opens, click **Open Google sign-in**.
3. Pick an **Antigravity** model in the model picker and start chatting.

**Using DSH from another device** (DSH web on a server, a phone, another PC): after you approve, Google sends your browser to a `localhost:51121` page that does not load. Copy that page's full address from the address bar and paste it in the field under **Open Google sign-in**, or run `/agy login <address>`.

### `/agy` command

| Command | What it does |
| --- | --- |
| `/agy login` | Add a Google account: shows the sign-in link |
| `/agy login <address>` | Finish a sign-in from another device with the address Google sent you to |
| `/agy status` | List accounts, the active one is marked ● |
| `/agy use <email>` | Switch the active account |
| `/agy logout [email]` | Remove an account (the active one by default) |

### Agent tools

| Tool | What it does |
| --- | --- |
| `agy_web_search` | Searches Google and answers with its sources |
| `agy_media` | Describes, transcribes or analyses an image, audio, video or PDF file from the working folder |

## FAQ

**Is it official?**
No. It uses the same sign-in as Google Antigravity. Google has already suspended accounts used this way in third-party tools: use it at your own risk.

**Where are my tokens stored?**
On your machine only, in `~/.dsh/agy-multimodal/accounts.json` (permissions `0600`). They are never shown in the UI. Access settings live in `settings.json` next to it.

**Nothing happens after I approve in Google.**
Sign-in listens on `127.0.0.1:51121`, the port Google requires for this client, on the machine running DSH. If your browser is on another device, or another Antigravity tool holds that port, copy the address of the page Google sent you to and paste it in **Settings › Antigravity** (or run `/agy login <address>`).

**I get a 400 error about tool schemas.**
Update the plugin. Recent versions convert multi-type and tuple schemas into a form Gemini accepts.

## Development

```bash
git clone https://github.com/Battiatus/dsh-gemini-antigravity-auth.git
cd dsh-gemini-antigravity-auth && npm install && npm test
dsh plugin --profile desktop add link:$PWD
```

With `link:`, DSH loads the plugin from your clone, so code changes apply at the next DSH launch.

Built on [`@cortexkit/antigravity-auth-core`](https://www.npmjs.com/package/@cortexkit/antigravity-auth-core) (MIT).

## License

[MIT](LICENSE)

<sub>Keywords: DeepSeek Harness plugin, DSH plugin, Gemini provider, Google Antigravity, Google OAuth, Gemini 4, Gemini Flash, multimodal LLM, image understanding, audio transcription, video analysis, PDF analysis, Google Search grounding, AI agent tools.</sub>
