---
name: Bug report
about: The picker, what gets copied, the options page or the native helper doesn't behave as documented
title: ""
labels: bug
assignees: ""
---

## What happened

<!-- A clear description of the problem. -->

## Steps to reproduce

1. 
2. 
3. 

## What you expected

## Environment

- CursorClip version: <!-- chrome://extensions → CursorClip → version, e.g. 1.19 -->
- Browser and version: <!-- e.g. Chrome 141, Brave 1.84, Edge 141 -->
- OS: <!-- Windows 11 24H2 / macOS 15 / Ubuntu 24.04 (X11 or Wayland) -->
- Helper installed? <!-- yes / no — the options page shows "✓ Helper installed" when it is -->
- Copy as: <!-- File / Text (Options → Copy as) -->
- Page where it happens: <!-- a URL, or "a local app" if it's private -->

## Diagnostics

<details>
<summary>The copied <code>.md</code></summary>

<!-- Remove anything private. -->

```md
paste here
```
</details>

<details>
<summary>Console errors</summary>

<!-- DevTools (F12) → Console on the page, and chrome://extensions → CursorClip → "service worker" → Console. -->

```
paste here
```
</details>

<details>
<summary>Helper files (only if the problem is the helper)</summary>

<!-- Windows: reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.copiar_elemento.helper"
     macOS:   cat "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.copiar_elemento.helper.json"
     Linux:   cat ~/.config/google-chrome/NativeMessagingHosts/com.copiar_elemento.helper.json
     On Linux, also say whether wl-copy or xclip is installed. -->

```
paste here
```
</details>

## Anything else

<!-- What you already tried, whether it happens on every page or only some, whether reloading the extension helps. -->
