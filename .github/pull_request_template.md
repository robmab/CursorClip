## What this changes

<!-- One or two sentences: what the user will notice, and why. Link the issue if there is one (Closes #123). -->

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] What gets copied (labels, CSS, outline…)
- [ ] Native helper / install scripts
- [ ] Docs (README, SVG)

## How I tested it

<!-- Load the extension unpacked (chrome://extensions → Load unpacked → copiar-elemento/) and say what you tried. -->

- Browser and version: <!-- e.g. Chrome 141, Brave 1.84 -->
- OS: <!-- Windows 11 / macOS 15 / Ubuntu 24.04 (X11 or Wayland) -->
- Helper installed? <!-- yes / no -->
- Pages tried: <!-- e.g. a local app, a page with cross-origin stylesheets, a huge element -->

<details>
<summary>Example of the copied <code>.md</code> (if the output changed)</summary>

```md
paste here
```
</details>

## Checklist

- [ ] `version` in `copiar-elemento/manifest.json` is bumped
- [ ] Every user-facing text is in English (code comments may stay as they are)
- [ ] Picking still works with click, `Enter`, drag to the common parent, `↑`/`↓` and `Esc`
- [ ] Clicks don't reach the page while picking
- [ ] If the helper changed: tested with `install.bat` (Windows) or `install.sh` (macOS/Linux), and `.sh` files keep LF line endings
- [ ] README and the SVG in `docs/` reflect the change
- [ ] No tokens, passwords or personal paths in the diff
