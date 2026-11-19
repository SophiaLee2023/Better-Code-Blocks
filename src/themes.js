/**
 * Color themes.
 *
 * Each style value is "#rrggbb" optionally followed by flags: b = bold, i = italic.
 * Token types: comment keyword string number function type builtin constant operator
 * punctuation variable property tag attribute meta flag ros rosSub docker dockerSub
 *
 * ros / rosSub       -> ROS 2 CLI tools (ros2, colcon, rosdep, ...) and their subcommands,
 *                       plus ROS identifiers in Python / C++ / CMake / launch XML / params YAML.
 * docker / dockerSub -> docker / docker compose / podman and their subcommands,
 *                       plus Dockerfile instructions and docker-compose keys.
 */
var THEMES = {
  onedarkpro: {
    name: 'One Dark Pro', dark: true, bg: '#282c34', fg: '#abb2bf',
    s: {
      comment: '#7f848e i', keyword: '#c678dd', string: '#98c379', number: '#d19a66',
      'function': '#61afef', type: '#e5c07b', builtin: '#56b6c2', constant: '#d19a66',
      operator: '#56b6c2', punctuation: '#abb2bf', variable: '#e06c75', property: '#e06c75',
      tag: '#e06c75', attribute: '#d19a66', meta: '#61afef', flag: '#d19a66',
      ros: '#be5046 b', rosSub: '#56b6c2', docker: '#2496ed b', dockerSub: '#c678dd'
    }
  },
  onelight: {
    name: 'One Light', dark: false, bg: '#fafafa', fg: '#383a42',
    s: {
      comment: '#a0a1a7 i', keyword: '#a626a4', string: '#50a14f', number: '#986801',
      'function': '#4078f2', type: '#c18401', builtin: '#0184bc', constant: '#986801',
      operator: '#0184bc', punctuation: '#383a42', variable: '#e45649', property: '#e45649',
      tag: '#e45649', attribute: '#986801', meta: '#4078f2', flag: '#986801',
      ros: '#ca1243 b', rosSub: '#0184bc', docker: '#007ba7 b', dockerSub: '#a626a4'
    }
  },
  darkplus: {
    name: 'VS Code Dark+', dark: true, bg: '#1e1e1e', fg: '#d4d4d4',
    s: {
      comment: '#6a9955', keyword: '#569cd6', string: '#ce9178', number: '#b5cea8',
      'function': '#dcdcaa', type: '#4ec9b0', builtin: '#dcdcaa', constant: '#569cd6',
      operator: '#d4d4d4', punctuation: '#d4d4d4', variable: '#9cdcfe', property: '#9cdcfe',
      tag: '#569cd6', attribute: '#9cdcfe', meta: '#c586c0', flag: '#9cdcfe',
      ros: '#d13d3d b', rosSub: '#4ec9b0', docker: '#2496ed b', dockerSub: '#c586c0'
    }
  },
  lightplus: {
    name: 'VS Code Light+', dark: false, bg: '#ffffff', fg: '#000000',
    s: {
      comment: '#008000', keyword: '#0000ff', string: '#a31515', number: '#098658',
      'function': '#795e26', type: '#267f99', builtin: '#795e26', constant: '#0000ff',
      operator: '#000000', punctuation: '#000000', variable: '#001080', property: '#001080',
      tag: '#800000', attribute: '#e50000', meta: '#af00db', flag: '#001080',
      ros: '#c00000 b', rosSub: '#267f99', docker: '#0070c1 b', dockerSub: '#af00db'
    }
  },
  monokai: {
    name: 'Monokai', dark: true, bg: '#272822', fg: '#f8f8f2',
    s: {
      comment: '#75715e', keyword: '#f92672', string: '#e6db74', number: '#ae81ff',
      'function': '#a6e22e', type: '#66d9ef i', builtin: '#66d9ef', constant: '#ae81ff',
      operator: '#f92672', punctuation: '#f8f8f2', variable: '#fd971f', property: '#f8f8f2',
      tag: '#f92672', attribute: '#a6e22e', meta: '#a6e22e', flag: '#ae81ff',
      ros: '#cc2a2a b', rosSub: '#66d9ef', docker: '#2496ed b', dockerSub: '#fd971f'
    }
  },
  dracula: {
    name: 'Dracula', dark: true, bg: '#282a36', fg: '#f8f8f2',
    s: {
      comment: '#6272a4', keyword: '#ff79c6', string: '#f1fa8c', number: '#bd93f9',
      'function': '#50fa7b', type: '#8be9fd i', builtin: '#8be9fd', constant: '#bd93f9',
      operator: '#ff79c6', punctuation: '#f8f8f2', variable: '#f8f8f2', property: '#f8f8f2',
      tag: '#ff79c6', attribute: '#50fa7b', meta: '#50fa7b', flag: '#bd93f9',
      ros: '#d2343e b', rosSub: '#8be9fd', docker: '#3b9dff b', dockerSub: '#ffb86c'
    }
  },
  githubdark: {
    name: 'GitHub Dark', dark: true, bg: '#0d1117', fg: '#e6edf3',
    s: {
      comment: '#8b949e', keyword: '#ff7b72', string: '#a5d6ff', number: '#79c0ff',
      'function': '#d2a8ff', type: '#ffa657', builtin: '#79c0ff', constant: '#79c0ff',
      operator: '#ff7b72', punctuation: '#e6edf3', variable: '#ffa657', property: '#79c0ff',
      tag: '#7ee787', attribute: '#79c0ff', meta: '#d2a8ff', flag: '#79c0ff',
      ros: '#da3633 b', rosSub: '#7ee787', docker: '#58a6ff b', dockerSub: '#ffa657'
    }
  },
  githublight: {
    name: 'GitHub Light', dark: false, bg: '#ffffff', fg: '#1f2328',
    s: {
      comment: '#6e7781', keyword: '#cf222e', string: '#0a3069', number: '#0550ae',
      'function': '#8250df', type: '#953800', builtin: '#0550ae', constant: '#0550ae',
      operator: '#cf222e', punctuation: '#1f2328', variable: '#953800', property: '#0550ae',
      tag: '#116329', attribute: '#0550ae', meta: '#8250df', flag: '#0550ae',
      ros: '#a40e26 b', rosSub: '#116329', docker: '#0969da b', dockerSub: '#953800'
    }
  },
  solarizeddark: {
    name: 'Solarized Dark', dark: true, bg: '#002b36', fg: '#839496',
    s: {
      comment: '#586e75 i', keyword: '#859900', string: '#2aa198', number: '#d33682',
      'function': '#268bd2', type: '#b58900', builtin: '#268bd2', constant: '#cb4b16',
      operator: '#859900', punctuation: '#839496', variable: '#268bd2', property: '#268bd2',
      tag: '#268bd2', attribute: '#93a1a1', meta: '#cb4b16', flag: '#cb4b16',
      ros: '#b0281a b', rosSub: '#6c71c4', docker: '#268bd2 b', dockerSub: '#d33682'
    }
  },
  solarizedlight: {
    name: 'Solarized Light', dark: false, bg: '#fdf6e3', fg: '#657b83',
    s: {
      comment: '#93a1a1 i', keyword: '#859900', string: '#2aa198', number: '#d33682',
      'function': '#268bd2', type: '#b58900', builtin: '#268bd2', constant: '#cb4b16',
      operator: '#859900', punctuation: '#657b83', variable: '#268bd2', property: '#268bd2',
      tag: '#268bd2', attribute: '#586e75', meta: '#cb4b16', flag: '#cb4b16',
      ros: '#b0281a b', rosSub: '#6c71c4', docker: '#268bd2 b', dockerSub: '#d33682'
    }
  },
  nord: {
    name: 'Nord', dark: true, bg: '#2e3440', fg: '#d8dee9',
    s: {
      comment: '#616e88 i', keyword: '#81a1c1', string: '#a3be8c', number: '#b48ead',
      'function': '#88c0d0', type: '#8fbcbb', builtin: '#88c0d0', constant: '#81a1c1',
      operator: '#81a1c1', punctuation: '#eceff4', variable: '#d8dee9', property: '#d8dee9',
      tag: '#81a1c1', attribute: '#8fbcbb', meta: '#d08770', flag: '#b48ead',
      ros: '#a3454f b', rosSub: '#ebcb8b', docker: '#5e81ac b', dockerSub: '#d08770'
    }
  },
  gruvboxdark: {
    name: 'Gruvbox Dark', dark: true, bg: '#282828', fg: '#ebdbb2',
    s: {
      comment: '#928374 i', keyword: '#fb4934', string: '#b8bb26', number: '#d3869b',
      'function': '#8ec07c', type: '#fabd2f', builtin: '#fabd2f', constant: '#d3869b',
      operator: '#ebdbb2', punctuation: '#ebdbb2', variable: '#d3869b', property: '#83a598',
      tag: '#8ec07c', attribute: '#fabd2f', meta: '#fe8019', flag: '#d3869b',
      ros: '#cc241d b', rosSub: '#fe8019', docker: '#83a598 b', dockerSub: '#fabd2f'
    }
  },
  tokyonight: {
    name: 'Tokyo Night', dark: true, bg: '#1a1b26', fg: '#c0caf5',
    s: {
      comment: '#565f89 i', keyword: '#bb9af7', string: '#9ece6a', number: '#ff9e64',
      'function': '#7aa2f7', type: '#2ac3de', builtin: '#7dcfff', constant: '#ff9e64',
      operator: '#89ddff', punctuation: '#a9b1d6', variable: '#e0af68', property: '#73daca',
      tag: '#f7768e', attribute: '#bb9af7', meta: '#e0af68', flag: '#ff9e64',
      ros: '#db4b4b b', rosSub: '#73daca', docker: '#2496ed b', dockerSub: '#bb9af7'
    }
  },
  catppuccinmocha: {
    name: 'Catppuccin Mocha', dark: true, bg: '#1e1e2e', fg: '#cdd6f4',
    s: {
      comment: '#9399b2 i', keyword: '#cba6f7', string: '#a6e3a1', number: '#fab387',
      'function': '#89b4fa', type: '#f9e2af', builtin: '#89dceb', constant: '#fab387',
      operator: '#89dceb', punctuation: '#9399b2', variable: '#f2cdcd', property: '#b4befe',
      tag: '#89b4fa', attribute: '#f9e2af', meta: '#fab387', flag: '#eba0ac',
      ros: '#d20f39 b', rosSub: '#94e2d5', docker: '#74c7ec b', dockerSub: '#f9e2af'
    }
  }
};

var DEFAULT_THEME = 'onedarkpro';

/** Returns a theme with every style parsed into {c, b, i}. */
function resolveTheme(id) {
  var t = THEMES[id] || THEMES[DEFAULT_THEME];
  var styles = {};
  Object.keys(t.s).forEach(function (k) {
    var parts = t.s[k].split(/\s+/);
    var flags = parts[1] || '';
    styles[k] = { c: parts[0], b: flags.indexOf('b') >= 0, i: flags.indexOf('i') >= 0 };
  });
  return { id: THEMES[id] ? id : DEFAULT_THEME, name: t.name, dark: t.dark, bg: t.bg, fg: t.fg, styles: styles };
}

/** Style for a token type, or null when the token should keep the default foreground. */
function styleFor(theme, type) {
  return theme.styles[type] || null;
}
