# Code Highlighter for Google Docs

A Google Docs add-on that syntax-highlights the **selected text in place**. It only changes
formatting (font, font size, text color, bold/italic, text background, and optionally paragraph
shading) and never inserts tables or other wrappers.

> **Note:** This is a Google Apps Script add-on, not a Chrome extension. Loading this folder in
> `chrome://extensions` fails with "Manifest file is missing or unreadable". Install it in Google
> Docs as described below.

## Features

- **Themes, each with a Light and a Dark mode:** One (Dark Pro / Light, default), VS Code
  (Dark+ / Light+), GitHub, Solarized, Monokai, Dracula (Dracula / Alucard), Nord, Gruvbox,
  Tokyo Night, Catppuccin (Mocha / Latte)
- **Light mode works on gray pages.** Every light-mode color has at least 4.5:1 contrast against
  light gray (`#e0e0e0`), so code stays readable on white or gray backgrounds even with the theme
  background turned off.
- **Full-width code blocks.** Optionally shades whole lines in the theme background from the left
  margin to the right, so the code looks like a block instead of highlighted text.
- **Languages:** Python, Java, C, C++, C#, JavaScript, TypeScript, HTML, CSS/SCSS, Bash/Shell,
  PowerShell, Dockerfile, YAML, XML, JSON, CMake, SQL, Go, Rust, plus auto-detection
- **ROS 2 awareness.** These get their own `ros` color, bold for the tool and regular weight for
  subcommands:
  - Shell: `ros2 topic echo`, `colcon build`, `rosdep install`, `--ros-args`, `ros-humble-*`
    packages, and `/opt/ros/...`
  - Message types such as `geometry_msgs/msg/Twist`, in the `type` color
  - Python / C++: `rclpy`, `rclcpp`, `create_publisher`, `*_msgs`, `RCLCPP_INFO`, and similar
  - Launch XML tags and `$(find-pkg-share ...)` substitutions
  - CMake `ament_*` / `rosidl_*` commands, and `ros__parameters` in YAML
- **Docker awareness.** These get their own `docker` color:
  - Shell: `docker` / `docker compose` / `podman` and their subcommands, with image tags in the
    `type` color
  - Dockerfile instructions; `RUN` / `CMD` bodies are highlighted as shell, so the ROS commands
    inside them are highlighted too
  - docker-compose keys, with `command:` values highlighted as shell

## Install

You paste the files from `src/` into an Apps Script project attached to a Google Doc. No tools
or command line needed.

### 1. Open the Apps Script editor

1. Open the Google Doc you want to use it in (or create a new one).
2. Go to **Extensions → Apps Script**. A new tab opens with a project that contains one file,
   `Code.gs`.
3. Optional: click **Untitled project** at the top and rename it to `Code Highlighter`.

### 2. Add the script files

Apps Script adds the `.gs` extension for you, so type only the name shown.

| Apps Script file | Paste in the contents of |
| ---------------- | ------------------------ |
| `code`           | `src/code.js`            |
| `highlighter`    | `src/highlighter.js`     |
| `themes`         | `src/themes.js`          |

1. Rename the existing `Code.gs` to `code` (click the **⋮** next to it → **Rename**). Delete its
   placeholder `function myFunction() {}`, then paste in all of `src/code.js`.
2. Click **+** next to **Files** → **Script**, name it `highlighter`, and paste in
   `src/highlighter.js`.
3. Click **+** → **Script**, name it `themes`, and paste in `src/themes.js`.

### 3. Add the sidebar

1. Click **+** → **HTML**, and name it `sidebar` (it becomes `sidebar.html`).
2. Replace the starter HTML with all of `src/sidebar.html`.

The name must be exactly `sidebar`, because `code.js` loads the sidebar by that name.

### 4. Replace the manifest

1. Click the gear icon (**Project Settings**) in the left bar.
2. Check **Show "appsscript.json" manifest file in editor**.
3. Go back to the **Editor** (`< >` icon), open `appsscript.json`, and replace its contents with
   `src/appsscript.json`:

```json
{
  "timeZone": "America/New_York",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "dependencies": {
    "enabledAdvancedServices": [
      { "userSymbol": "Docs", "version": "v1", "serviceId": "docs" }
    ]
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

The `dependencies` entry turns on the Google Docs API service, which the full-width code block
needs: the regular Apps Script document API can't set paragraph shading. The Docs API requires the
`documents` scope, so the authorization screen asks for access to all your Google Docs. The script
still only edits the document you run it in. The second scope lets it show a sidebar.

After you save the manifest, **Docs** appears under **Services** in the left bar. If it doesn't,
click **+** next to **Services**, pick **Google Docs API**, and click **Add**.

When you're done, the file list should look like this:

```
Files
  appsscript.json
  code.gs
  highlighter.gs
  sidebar.html
  themes.gs
```

### 5. Save and authorize

1. Press **Ctrl+S** (**⌘S** on macOS) to save the project.
2. Go back to the Doc and reload the page.
3. Open **Extensions → Code Highlighter → Open highlighter**.
4. The first time, Google asks you to authorize the script. Choose your account. If you see
   **Google hasn't verified this app**, click **Advanced → Go to Code Highlighter (unsafe)**. This
   is expected for your own unpublished script. Then click **Allow**.
5. Run the menu item again. The sidebar opens.

### Using it in other docs

A script attached this way only shows up in that one doc. To try it on a different doc, open the
Apps Script editor and go to **Deploy → Test deployments → Editor add-on**, then pick the test
document.

### Updating

When the files in `src/` change, paste the new contents over the matching Apps Script file, save,
and reload the doc. If `appsscript.json` changed its scopes, Google asks you to authorize again the
next time you run it.

## Usage

1. Select the code in the doc.
2. In the sidebar, pick a language (or **Auto-detect**), a theme and a mode. Use **Light** for
   white or light gray pages, and **Dark** together with **Theme background color on text** or
   **Full-width code block**.
3. Click **Highlight selection**.

With **Full-width code block** checked, every line the selection touches is highlighted in full,
even if you only selected part of it. Each line gets paragraph shading in the theme background
from the left margin to the right, plus a border of the same color as padding and no spacing
between lines, so consecutive lines join into one block.

**Preview** renders the selection in the sidebar without changing the doc. **Clear** removes the
formatting again, including the block shading on the selected lines.

The sidebar remembers your last settings. The **Extensions → Code Highlighter** menu also has:

- **Highlight selection (last settings)** skips the sidebar entirely.
- **Clear code formatting** removes the highlighting from the selection.

## Development

```
src/                     Apps Script project (the files you paste in)
  appsscript.json        manifest and OAuth scopes
  code.js                menu, sidebar endpoints, applies formatting to the selection
  highlighter.js         dependency-free tokenizer and language detection
  themes.js              color themes
  sidebar.html           sidebar UI
test/
  run_samples.js         tokenizes every sample and writes test/out/preview.html
  apply_selection.js     runs highlightSelection() against a mocked DocumentApp
  check_themes.js        contrast and "colors look alike" checks for every palette
  color_variety.js       fails if too many sample lines end up mostly one color
  samples/               one sample file per language
```

The tokenizer has no dependencies and runs in Node:

```bash
npm test                                   # all test scripts
node test/run_samples.js --all             # preview every theme in test/out/preview.html
node test/run_samples.js --dump bash       # print the tokens for one sample
node test/color_variety.js nord light      # list the lines that are mostly one color
```

To add a theme, add an entry with a `dark` and a `light` palette to `THEMES` in `src/themes.js`,
then run `node test/check_themes.js`. To add a language, add a spec to
`SPECS` (or a custom tokenizer) and register it in `LANGS` in `src/highlighter.js`. Name sample
files `<language_id>.<ext>`.

Apps Script loads files alphabetically, so a top-level statement must not depend on a constant
defined in a later file.

If you'd rather push from the command line than paste files, [clasp](https://github.com/google/clasp)
works too: `clasp create --type docs --title "Code Highlighter" --rootDir src`, then `clasp push`.
