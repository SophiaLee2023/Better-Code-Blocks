# Code Highlighter for Google Docs

A Google Docs add-on that syntax-highlights the **selected text in place**. It only changes text
formatting (font, font size, text color, bold/italic, and text background) and never inserts tables
or other wrappers.

## Features

- **Themes:** One Dark Pro (default), One Light, VS Code Dark+ / Light+, Monokai, Dracula,
  GitHub Dark / Light, Solarized Dark / Light, Nord, Gruvbox Dark, Tokyo Night, Catppuccin Mocha
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

## Install (as your own unpublished add-on)

### Option A: clasp (recommended)

```bash
npm install -g @google/clasp
clasp login
# Creates a new Google Doc with a bound script project. Use --type standalone for a standalone project.
clasp create --type docs --title "Code Highlighter" --rootDir src
clasp push
```

### Option B: copy and paste

1. Open a Google Doc, then go to **Extensions → Apps Script**.
2. Create script files `code`, `highlighter`, and `themes`, and paste in the matching `src/*.js`
   files.
3. Create an HTML file called `sidebar` and paste in `src/sidebar.html`.
4. Turn on **Project Settings → Show "appsscript.json"**, then paste in `src/appsscript.json`.

### Running it

- **Bound script:** reload the doc and use **Extensions → Code Highlighter → Open highlighter**.
- **Any doc:** in the Apps Script editor, go to **Deploy → Test deployments → Editor add-on** and
  choose a test document.

## Usage

1. Select the code in the doc.
2. In the sidebar, pick a language (or **Auto-detect**) and a theme.
3. Click **Highlight selection**.

**Preview** renders the selection in the sidebar without changing the doc. **Clear** removes the
formatting again.

The sidebar remembers your last settings. The menu item **Highlight selection (last settings)**
skips the sidebar entirely.

## Development

```
src/                     Apps Script project (what clasp pushes)
  appsscript.json        manifest and OAuth scopes
  code.js                menu, sidebar endpoints, applies formatting to the selection
  highlighter.js         dependency-free tokenizer and language detection
  themes.js              color themes
  sidebar.html           sidebar UI
test/
  run_samples.js         tokenizes every sample and writes test/out/preview.html
  apply_selection.js     runs highlightSelection() against a mocked DocumentApp
  samples/               one sample file per language
```

The tokenizer has no dependencies and runs in Node:

```bash
npm test                               # both test scripts
node test/run_samples.js --all         # preview every theme in test/out/preview.html
node test/run_samples.js --dump bash   # print the tokens for one sample
```

To add a theme, add an entry to `THEMES` in `src/themes.js`. To add a language, add a spec to
`SPECS` (or a custom tokenizer) and register it in `LANGS` in `src/highlighter.js`. Name sample
files `<language_id>.<ext>`.

Apps Script loads files alphabetically, so a top-level statement must not depend on a constant
defined in a later file.
