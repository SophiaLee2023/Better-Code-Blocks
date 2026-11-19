/**
 * Color themes. Every theme has a dark and a light palette; the sidebar's Mode picks one.
 *
 * Each style value is "#rrggbb" optionally followed by flags: b = bold, i = italic.
 * Token types: comment keyword string number function type builtin constant operator
 * punctuation variable property tag attribute meta flag ros rosSub docker dockerSub
 *
 * ros / rosSub       -> ROS 2 CLI tools (ros2, colcon, rosdep, ...) and their subcommands,
 *                       plus ROS identifiers in Python / C++ / CMake / launch XML / params YAML.
 * docker / dockerSub -> docker / docker compose / podman and their subcommands,
 *                       plus Dockerfile instructions and docker-compose keys.
 *
 * Light palettes are meant for white or light gray pages, with or without the theme background:
 * every color in them has at least 4.5:1 contrast against light gray #e0e0e0
 * (test/check_themes.js enforces this).
 */
var THEMES = {
  one: {
    dark: {
      name: 'One Dark Pro', bg: '#282c34', fg: '#abb2bf',
      s: {
        comment: '#7f848e i', keyword: '#c678dd', string: '#98c379', number: '#d19a66',
        'function': '#61afef', type: '#e5c07b', builtin: '#56b6c2', constant: '#d19a66',
        operator: '#56b6c2', punctuation: '#abb2bf', variable: '#e06c75', property: '#e06c75',
        tag: '#e06c75', attribute: '#d19a66', meta: '#61afef', flag: '#d19a66',
        ros: '#e2584a b', rosSub: '#56b6c2', docker: '#2496ed b', dockerSub: '#c678dd'
      }
    },
    light: {
      name: 'One Light', bg: '#fafafa', fg: '#383a42',
      s: {
        comment: '#606168 i', keyword: '#a626a4', string: '#376e36', number: '#a8410a',
        'function': '#1054e8', type: '#7e5a00', builtin: '#016893', constant: '#a8410a',
        operator: '#016893', punctuation: '#383a42', variable: '#bb291c', property: '#bb291c',
        tag: '#bb291c', attribute: '#a8410a', meta: '#1054e8', flag: '#a8410a',
        ros: '#c11140 b', rosSub: '#016893', docker: '#00688d b', dockerSub: '#a626a4'
      }
    }
  },
  vscode: {
    dark: {
      name: 'VS Code Dark+', bg: '#1e1e1e', fg: '#d4d4d4',
      s: {
        comment: '#6a9955', keyword: '#569cd6', string: '#ce9178', number: '#b5cea8',
        'function': '#dcdcaa', type: '#4ec9b0', builtin: '#dcdcaa', constant: '#569cd6',
        operator: '#d4d4d4', punctuation: '#d4d4d4', variable: '#9cdcfe', property: '#9cdcfe',
        tag: '#569cd6', attribute: '#9cdcfe', meta: '#c586c0', flag: '#9cdcfe',
        ros: '#d13d3d b', rosSub: '#4ec9b0', docker: '#2496ed b', dockerSub: '#c586c0'
      }
    },
    light: {
      name: 'VS Code Light+', bg: '#ffffff', fg: '#000000',
      s: {
        comment: '#007300', keyword: '#0000ff', string: '#a31515', number: '#08704a',
        'function': '#795e26', type: '#1f697e', builtin: '#795e26', constant: '#0000ff',
        operator: '#000000', punctuation: '#000000', variable: '#001080', property: '#001080',
        tag: '#800000', attribute: '#c60000', meta: '#a300cc', flag: '#001080',
        ros: '#c00000 b', rosSub: '#1f697e', docker: '#0064ad b', dockerSub: '#a300cc'
      }
    }
  },
  github: {
    dark: {
      name: 'GitHub Dark', bg: '#0d1117', fg: '#e6edf3',
      s: {
        comment: '#8b949e', keyword: '#ff7b72', string: '#a5d6ff', number: '#79c0ff',
        'function': '#d2a8ff', type: '#ffa657', builtin: '#79c0ff', constant: '#79c0ff',
        operator: '#ff7b72', punctuation: '#e6edf3', variable: '#ffa657', property: '#79c0ff',
        tag: '#7ee787', attribute: '#79c0ff', meta: '#d2a8ff', flag: '#79c0ff',
        ros: '#da3633 b', rosSub: '#7ee787', docker: '#58a6ff b', dockerSub: '#ffa657'
      }
    },
    light: {
      name: 'GitHub Light', bg: '#ffffff', fg: '#1f2328',
      s: {
        comment: '#5b636b', keyword: '#bd1f2a', string: '#0a3069', number: '#0550ae',
        'function': '#743ddb', type: '#953800', builtin: '#0550ae', constant: '#0550ae',
        operator: '#bd1f2a', punctuation: '#1f2328', variable: '#953800', property: '#0550ae',
        tag: '#116329', attribute: '#0550ae', meta: '#743ddb', flag: '#0550ae',
        ros: '#82071e b', rosSub: '#116329', docker: '#0d6b84 b', dockerSub: '#953800'
      }
    }
  },
  solarized: {
    dark: {
      name: 'Solarized Dark', bg: '#002b36', fg: '#839496',
      s: {
        comment: '#6c7a89 i', keyword: '#859900', string: '#2aa198', number: '#d33682',
        'function': '#268bd2', type: '#b58900', builtin: '#268bd2', constant: '#cb4b16',
        operator: '#859900', punctuation: '#839496', variable: '#268bd2', property: '#268bd2',
        tag: '#268bd2', attribute: '#93a1a1', meta: '#cb4b16', flag: '#cb4b16',
        ros: '#dc322f b', rosSub: '#cb4b16', docker: '#6c71c4 b', dockerSub: '#d33682'
      }
    },
    light: {
      name: 'Solarized Light', bg: '#fdf6e3', fg: '#073642',
      s: {
        comment: '#566363 i', keyword: '#596600', string: '#1c6c66', number: '#b4276b',
        'function': '#1c669a', type: '#7a5d00', builtin: '#1c669a', constant: '#ab3f13',
        operator: '#596600', punctuation: '#50646b', variable: '#1c669a', property: '#1c669a',
        tag: '#1c669a', attribute: '#50646b', meta: '#ab3f13', flag: '#ab3f13',
        ros: '#b0281a b', rosSub: '#ab3f13', docker: '#5157b9 b', dockerSub: '#b4276b'
      }
    }
  },
  monokai: {
    dark: {
      name: 'Monokai', bg: '#272822', fg: '#f8f8f2',
      s: {
        comment: '#75715e', keyword: '#f92672', string: '#e6db74', number: '#ae81ff',
        'function': '#a6e22e', type: '#66d9ef i', builtin: '#66d9ef', constant: '#ae81ff',
        operator: '#f92672', punctuation: '#f8f8f2', variable: '#fd971f', property: '#66d9ef',
        tag: '#f92672', attribute: '#a6e22e', meta: '#a6e22e', flag: '#ae81ff',
        ros: '#e8423f b', rosSub: '#66d9ef', docker: '#2496ed b', dockerSub: '#fd971f'
      }
    },
    light: {
      name: 'Monokai Light', bg: '#fafafa', fg: '#272822',
      s: {
        comment: '#656252 i', keyword: '#be1954', string: '#6b6300', number: '#652eff',
        'function': '#3c6d00', type: '#00698d i', builtin: '#00698d', constant: '#652eff',
        operator: '#be1954', punctuation: '#272822', variable: '#9e4800', property: '#00698d',
        tag: '#be1954', attribute: '#3c6d00', meta: '#3c6d00', flag: '#652eff',
        ros: '#bb2727 b', rosSub: '#00698d', docker: '#0a63ae b', dockerSub: '#9e4800'
      }
    }
  },
  dracula: {
    dark: {
      name: 'Dracula', bg: '#282a36', fg: '#f8f8f2',
      s: {
        comment: '#6272a4', keyword: '#ff79c6', string: '#f1fa8c', number: '#bd93f9',
        'function': '#50fa7b', type: '#8be9fd i', builtin: '#8be9fd', constant: '#bd93f9',
        operator: '#ff79c6', punctuation: '#f8f8f2', variable: '#f8f8f2', property: '#ffb86c',
        tag: '#ff79c6', attribute: '#50fa7b', meta: '#50fa7b', flag: '#bd93f9',
        ros: '#ff5555 b', rosSub: '#8be9fd', docker: '#3b9dff b', dockerSub: '#ffb86c'
      }
    },
    light: {
      name: 'Alucard (Dracula Light)', bg: '#fffbeb', fg: '#1f1f1f',
      s: {
        comment: '#676248', keyword: '#a3144d', string: '#725f12', number: '#644ac9',
        'function': '#14710a', type: '#036894 i', builtin: '#036894', constant: '#644ac9',
        operator: '#a3144d', punctuation: '#1f1f1f', variable: '#1f1f1f', property: '#9c4a13',
        tag: '#a3144d', attribute: '#14710a', meta: '#14710a', flag: '#644ac9',
        ros: '#b43325 b', rosSub: '#036894', docker: '#1e5ebf b', dockerSub: '#9c4a13'
      }
    }
  },
  nord: {
    dark: {
      name: 'Nord', bg: '#2e3440', fg: '#d8dee9',
      s: {
        comment: '#8b8f99 i', keyword: '#81a1c1', string: '#a3be8c', number: '#b48ead',
        'function': '#88c0d0', type: '#ebcb8b', builtin: '#88c0d0', constant: '#81a1c1',
        operator: '#81a1c1', punctuation: '#eceff4', variable: '#d8dee9', property: '#8fbcbb',
        tag: '#81a1c1', attribute: '#8fbcbb', meta: '#d08770', flag: '#b48ead',
        ros: '#bf616a b', rosSub: '#8fbcbb', docker: '#5e81ac b', dockerSub: '#d08770'
      }
    },
    light: {
      name: 'Nord Light', bg: '#eceff4', fg: '#2e3440',
      s: {
        comment: '#5a6274 i', keyword: '#476489', string: '#4f6a39', number: '#7c5577',
        'function': '#396775', type: '#765e22', builtin: '#396775', constant: '#476489',
        operator: '#476489', punctuation: '#2e3440', variable: '#2e3440', property: '#346968',
        tag: '#476489', attribute: '#346968', meta: '#925034', flag: '#7c5577',
        ros: '#a1444e b', rosSub: '#346968', docker: '#0b5fa5 b', dockerSub: '#925034'
      }
    }
  },
  gruvbox: {
    dark: {
      name: 'Gruvbox Dark', bg: '#282828', fg: '#ebdbb2',
      s: {
        comment: '#928374 i', keyword: '#fb4934', string: '#b8bb26', number: '#d3869b',
        'function': '#8ec07c', type: '#fabd2f', builtin: '#fabd2f', constant: '#d3869b',
        operator: '#ebdbb2', punctuation: '#ebdbb2', variable: '#d3869b', property: '#83a598',
        tag: '#8ec07c', attribute: '#fabd2f', meta: '#fe8019', flag: '#d3869b',
        ros: '#ff6f61 b', rosSub: '#fe8019', docker: '#83a598 b', dockerSub: '#fabd2f'
      }
    },
    light: {
      name: 'Gruvbox Light', bg: '#fbf1c7', fg: '#3c3836',
      s: {
        comment: '#6b6056 i', keyword: '#9d0006', string: '#67620c', number: '#8f3f71',
        'function': '#3a6c4d', type: '#87580f', builtin: '#87580f', constant: '#8f3f71',
        operator: '#3c3836', punctuation: '#3c3836', variable: '#8f3f71', property: '#076678',
        tag: '#3a6c4d', attribute: '#87580f', meta: '#af3a03', flag: '#8f3f71',
        ros: '#af3a03 b', rosSub: '#076678', docker: '#076678 b', dockerSub: '#87580f'
      }
    }
  },
  tokyonight: {
    dark: {
      name: 'Tokyo Night', bg: '#1a1b26', fg: '#c0caf5',
      s: {
        comment: '#737aa2 i', keyword: '#bb9af7', string: '#9ece6a', number: '#ff9e64',
        'function': '#7aa2f7', type: '#2ac3de', builtin: '#7dcfff', constant: '#ff9e64',
        operator: '#89ddff', punctuation: '#a9b1d6', variable: '#e0af68', property: '#73daca',
        tag: '#f7768e', attribute: '#bb9af7', meta: '#e0af68', flag: '#ff9e64',
        ros: '#db4b4b b', rosSub: '#73daca', docker: '#2496ed b', dockerSub: '#bb9af7'
      }
    },
    light: {
      name: 'Tokyo Night Light', bg: '#e6e7ed', fg: '#343b58',
      s: {
        comment: '#606268 i', keyword: '#5a4a78', string: '#485e30', number: '#944f26',
        'function': '#34548a', type: '#166775', builtin: '#0f4b6e', constant: '#944f26',
        operator: '#0f4b6e', punctuation: '#343b58', variable: '#865814', property: '#33635c',
        tag: '#8c4351', attribute: '#5a4a78', meta: '#865814', flag: '#944f26',
        ros: '#8c4351 b', rosSub: '#33635c', docker: '#2959aa b', dockerSub: '#5a4a78'
      }
    }
  },
  catppuccin: {
    dark: {
      name: 'Catppuccin Mocha', bg: '#1e1e2e', fg: '#cdd6f4',
      s: {
        comment: '#9399b2 i', keyword: '#cba6f7', string: '#a6e3a1', number: '#fab387',
        'function': '#89b4fa', type: '#f9e2af', builtin: '#89dceb', constant: '#fab387',
        operator: '#89dceb', punctuation: '#9399b2', variable: '#f2cdcd', property: '#b4befe',
        tag: '#89b4fa', attribute: '#f9e2af', meta: '#fab387', flag: '#eba0ac',
        ros: '#d20f39 b', rosSub: '#94e2d5', docker: '#74c7ec b', dockerSub: '#f9e2af'
      }
    },
    light: {
      name: 'Catppuccin Latte', bg: '#eff1f5', fg: '#2c2f40',
      s: {
        comment: '#5f6173 i', keyword: '#7e28ee', string: '#2d701e', number: '#aa3f01',
        'function': '#0a54e8', type: '#895712', builtin: '#036992', constant: '#aa3f01',
        operator: '#036992', punctuation: '#5f6173', variable: '#b72e2e', property: '#2949fc',
        tag: '#0a54e8', attribute: '#895712', meta: '#aa3f01', flag: '#c01a28',
        ros: '#c10e34 b', rosSub: '#116c71', docker: '#156a78 b', dockerSub: '#895712'
      }
    }
  }
};

var DEFAULT_THEME = 'one';
var DEFAULT_MODE = 'light';

/** Theme ids from before themes had light/dark modes, so saved settings keep working. */
var LEGACY_THEMES = {
  onedarkpro: ['one', 'dark'], onelight: ['one', 'light'],
  darkplus: ['vscode', 'dark'], lightplus: ['vscode', 'light'],
  githubdark: ['github', 'dark'], githublight: ['github', 'light'],
  solarizeddark: ['solarized', 'dark'], solarizedlight: ['solarized', 'light'],
  monokai: ['monokai', 'dark'], dracula: ['dracula', 'dark'], nord: ['nord', 'dark'],
  gruvboxdark: ['gruvbox', 'dark'], tokyonight: ['tokyonight', 'dark'], catppuccinmocha: ['catppuccin', 'dark']
};

/** Returns a theme palette with every style parsed into {c, b, i}. mode is 'light' or 'dark'. */
function resolveTheme(id, mode) {
  if (!THEMES[id] && LEGACY_THEMES[id]) { mode = mode || LEGACY_THEMES[id][1]; id = LEGACY_THEMES[id][0]; }
  if (!THEMES[id]) id = DEFAULT_THEME;
  if (mode !== 'light' && mode !== 'dark') mode = DEFAULT_MODE;
  var t = THEMES[id][mode];
  var styles = {};
  Object.keys(t.s).forEach(function (k) {
    var parts = t.s[k].split(/\s+/);
    var flags = parts[1] || '';
    styles[k] = { c: parts[0], b: flags.indexOf('b') >= 0, i: flags.indexOf('i') >= 0 };
  });
  return { id: id, mode: mode, dark: mode === 'dark', name: t.name, bg: t.bg, fg: t.fg, styles: styles };
}

/** Style for a token type, or null when the token should keep the default foreground. */
function styleFor(theme, type) {
  return theme.styles[type] || null;
}
