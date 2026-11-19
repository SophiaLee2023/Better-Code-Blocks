/**
 * Dependency-free syntax tokenizer. Runs in Apps Script (V8) and in Node (for tests).
 *
 * Highlighter.tokenize(code, langId) -> [{s, e, t}]  (s inclusive, e exclusive, t = token type)
 * Highlighter.detect(code)           -> langId
 * Highlighter.LANGUAGES              -> [{id, name}]
 */
var Highlighter = (function () {
  'use strict';

  function set(s) { return new Set(s.trim().split(/\s+/)); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ---------------------------------------------------------------- ROS 2 / Docker vocab

  var ROS_CLI = set('ros2 colcon rosdep rqt rviz2 rqt_graph gazebo gz ign vcs bloom-generate rosidl ros2cli');
  var ROS_SUB = set(
    // ros2 verbs
    'run launch topic node service param bag pkg interface action doctor daemon lifecycle component ' +
    'multicast security wtf control extension_points extensions test trace ' +
    // ros2 second-level verbs
    'list echo pub info hz bw type find call record play get set dump load show create executables prefix ' +
    'xml describe delay reindex convert proto package packages kill start stop status send_goal unload ' +
    'standalone types nodes delete send receive generate_artifacts create_keystore create_enclave ' +
    // colcon
    'build test-result graph mixin metadata clean ' +
    // rosdep
    'install init update resolve check keys db where-defined'
  );
  var ROS_ARG_WORDS = set('--ros-args ament_cmake ament_python ament_cmake_python');
  var ROS_CODE_IDS = set(
    'rclpy rclcpp rclcpp_action rclpy_action rclcpp_components rcl rmw rosidl launch launch_ros ament_index_python ' +
    'ament_index_cpp LaunchDescription LaunchConfiguration DeclareLaunchArgument IncludeLaunchDescription ' +
    'PythonLaunchDescriptionSource FindPackageShare PathJoinSubstitution TextSubstitution ExecuteProcess ' +
    'ComposableNodeContainer ComposableNode LoadComposableNodes GroupAction PushRosNamespace SetParameter ' +
    'get_package_share_directory QoSProfile ReliabilityPolicy DurabilityPolicy HistoryPolicy MultiThreadedExecutor ' +
    'SingleThreadedExecutor ActionServer ActionClient RCLCPP_INFO RCLCPP_WARN RCLCPP_ERROR RCLCPP_DEBUG ' +
    'RCLCPP_FATAL RCLCPP_COMPONENTS_REGISTER_NODE'
  );
  var ROS_METHODS = set(
    'init spin spin_once spin_some spin_until_future_complete shutdown ok create_publisher create_subscription ' +
    'create_timer create_wall_timer create_service create_client get_logger declare_parameter declare_parameters ' +
    'get_parameter get_parameters set_parameters get_clock add_on_set_parameters_callback destroy_node ' +
    'wait_for_service call_async get_node_names'
  );
  var ROS_PKG_RE = /^[a-z][a-z0-9_]*_(msgs|srvs|interfaces)$/;
  var ROS_MSG_RE = /^[a-z][a-z0-9_]*\/(msg|srv|action)\/[A-Za-z]\w*$/;
  var ROS_PATH_RE = /^(\/opt\/ros\/|ros-[a-z]+-)/;

  var DOCKER_CLI = set('docker docker-compose podman podman-compose nerdctl buildah');
  var DOCKER_SUB = set(
    'run build pull push exec ps images image rm rmi stop start restart kill logs network volume compose up down ' +
    'tag login logout inspect container system prune create cp commit attach port top stats history save load ' +
    'import export info version search buildx builder context manifest plugin secret service stack swarm node ' +
    'config trust scan init wait pause unpause rename update events diff ls watch bake scout'
  );
  var DOCKER_INSTR = set('FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL');
  var COMPOSE_KEYS = set(
    'services version volumes networks configs secrets image build context dockerfile ports environment env_file ' +
    'depends_on command entrypoint container_name restart healthcheck deploy network_mode privileged runtime devices ' +
    'working_dir user labels extra_hosts cap_add cap_drop tty stdin_open profiles platform logging ulimits shm_size ' +
    'ipc pid expose links args target init stop_signal hostname dns develop'
  );

  // ---------------------------------------------------------------- helpers

  function ctxOf(code, base, out) { return { code: code, n: code.length, i: 0, base: base || 0, out: out || [] }; }
  function push(ctx, s, e, t) { if (t && e > s) ctx.out.push({ s: s + ctx.base, e: e + ctx.base, t: t }); }
  function at(ctx, re) { re.lastIndex = ctx.i; var m = re.exec(ctx.code); return m && m[0].length ? m : null; }
  function emit(ctx, s, len, t) {
    if (Array.isArray(t)) {
      var p = s;
      t.forEach(function (part) { push(ctx, p, p + part[0], part[1]); p += part[0]; });
    } else {
      push(ctx, s, s + len, t);
    }
  }
  function nextNonSpace(code, j) { while (j < code.length && (code[j] === ' ' || code[j] === '\t')) j++; return code[j] || ''; }
  function prevNonSpace(code, j) { j--; while (j >= 0 && (code[j] === ' ' || code[j] === '\t')) j--; return j >= 0 ? code[j] : '\n'; }

  /** Splits a string literal into string / variable parts for interpolation. */
  function interpParts(str, varRe, varType) {
    var parts = [], last = 0, m;
    varRe.lastIndex = 0;
    while ((m = varRe.exec(str))) {
      if (!m[0].length) { varRe.lastIndex++; continue; }
      if (m.index > last) parts.push([m.index - last, 'string']);
      parts.push([m[0].length, varType || 'variable']);
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push([str.length - last, 'string']);
    return parts;
  }

  // ---------------------------------------------------------------- generic (C-like / Python / etc.)

  var NUM = /0[xX][\da-fA-F_]+[uUlLnN]*|0[bB][01_]+[uUlLnN]*|0[oO][0-7_]+|(?:\d[\d_]*(?:\.(?!\.)[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?[fFdDmMuUlLnNjJ]*/y;
  var OP = /[+\-*\/%=&|^!<>?:~]+/y;
  var PUNCT = /[{}()\[\];,.@#\\]/y;
  var IDENT = /[A-Za-z_]\w*/y;
  var IDENT_JS = /[A-Za-z_$][\w$]*/y;

  function classify(spec, code, s, e, word, prevWord) {
    var lw = spec.ci ? word.toLowerCase() : word;
    var next = nextNonSpace(code, e);
    var prevC = prevNonSpace(code, s);
    if (spec.classify) {
      var r = spec.classify(word, lw, { next: next, prevC: prevC, prevWord: prevWord });
      if (r !== undefined) return r;
    }
    var p = s - 1; while (p >= 0 && (code[p] === ' ' || code[p] === '\t')) p--;
    var arrow = prevC === '>' && code[p - 1] === '-';
    var scope = prevC === ':' && code[p - 1] === ':';
    if ((prevC === '.' || arrow || scope) && spec.ros && (ROS_METHODS.has(word) || ROS_CODE_IDS.has(word) || ROS_PKG_RE.test(word))) return 'ros';
    if ((prevC === '.' || arrow) && !(spec.keywords && spec.keywords.has(lw))) {
      return next === '(' ? 'function' : 'property';
    }
    if (spec.keywords && spec.keywords.has(lw)) return 'keyword';
    if (spec.constants && spec.constants.has(lw)) return 'constant';
    if (spec.types && spec.types.has(lw)) return 'type';
    if (spec.ros && (ROS_CODE_IDS.has(word) || ROS_PKG_RE.test(word))) return 'ros';
    if (prevWord && spec.funcAfter && spec.funcAfter.has(prevWord)) return 'function';
    if (prevWord && spec.typeAfter && spec.typeAfter.has(prevWord)) return 'type';
    if (spec.builtins && spec.builtins.has(word)) return 'builtin';
    if (next === '(' || (spec.macroBang && next === '!')) return 'function';
    // `self` / `cls` look like `this` in the C-like languages, so they share its keyword color
    if (spec.selfWords && spec.selfWords.has(word)) return 'keyword';
    if (!spec.noCaps) {
      if (/^[A-Z][A-Z0-9_]+$/.test(word)) return 'constant';
      if (/^[A-Z]\w*[a-z]\w*$/.test(word)) return 'type';
    }
    return null;
  }

  function tokenizeGeneric(code, spec, base, out) {
    var ctx = ctxOf(code, base, out);
    var prevWord = null;
    var rules = spec.rules || [];
    var ident = spec.ident || IDENT;
    outer:
    while (ctx.i < ctx.n) {
      var c = code[ctx.i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f') { ctx.i++; continue; }
      for (var k = 0; k < rules.length; k++) {
        var m = at(ctx, rules[k][0]);
        if (!m) continue;
        var t = rules[k][1];
        if (typeof t === 'function') t = t(m, ctx);
        if (t === false) continue;
        emit(ctx, ctx.i, m[0].length, t);
        ctx.i += m[0].length;
        prevWord = null;
        continue outer;
      }
      var w = at(ctx, ident);
      if (w) {
        var end = ctx.i + w[0].length;
        push(ctx, ctx.i, end, classify(spec, code, ctx.i, end, w[0], prevWord));
        prevWord = spec.ci ? w[0].toLowerCase() : w[0];
        ctx.i = end;
        continue;
      }
      prevWord = null;
      var nm = at(ctx, NUM);
      if (nm) { push(ctx, ctx.i, ctx.i + nm[0].length, 'number'); ctx.i += nm[0].length; continue; }
      var op = at(ctx, OP);
      if (op) { push(ctx, ctx.i, ctx.i + op[0].length, 'operator'); ctx.i += op[0].length; continue; }
      var p = at(ctx, PUNCT);
      if (p) { push(ctx, ctx.i, ctx.i + 1, 'punctuation'); ctx.i += 1; continue; }
      ctx.i++;
    }
    return ctx.out;
  }

  // shared rules
  var R = {
    lineSlash: [/\/\/[^\n]*/y, 'comment'],
    block: [/\/\*[\s\S]*?(?:\*\/|$)/y, 'comment'],
    hash: [/#[^\n]*/y, 'comment'],
    dq: [/"(?:[^"\\\n]|\\.)*"?/y, 'string'],
    sq: [/'(?:[^'\\\n]|\\.)*'?/y, 'string'],
    chr: [/'(?:[^'\\\n]|\\.)'/y, 'string'],
    backtick: [/`(?:[^`\\]|\\[\s\S])*`?/y, 'string'],
    annotation: [/@[A-Za-z_][\w.]*/y, 'meta'],
    include: [/#[ \t]*(?:include|import)[ \t]*(?:<[^>\n]*>|"[^"\n]*")/y, function (m) {
      var k = /^#[ \t]*\w+[ \t]*/.exec(m[0])[0].length;
      return [[k, 'meta'], [m[0].length - k, 'string']];
    }],
    preproc: [/#[ \t]*[A-Za-z]+/y, function (m, ctx) {
      return prevNonSpace(ctx.code, ctx.i) === '\n' ? 'meta' : false;
    }],
    jsRegex: [/\/(?![*\/])(?:[^\/\\\n\[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuyv]*/y, function (m, ctx) {
      var p = prevNonSpace(ctx.code, ctx.i);
      if ('(,=:[!&|?{};+-*%<>~^\n'.indexOf(p) >= 0) return 'string';
      var before = ctx.code.slice(Math.max(0, ctx.i - 8), ctx.i);
      return /\b(return|typeof|case|of|in)\s*$/.test(before) ? 'string' : false;
    }]
  };

  var C_KW = 'auto break case const continue default do else enum extern for goto if inline register restrict ' +
    'return sizeof static struct switch typedef union volatile while _Alignas _Alignof _Atomic _Bool _Generic ' +
    '_Noreturn _Static_assert _Thread_local';
  var C_TYPES = 'char double float int long short signed unsigned void bool size_t ssize_t ptrdiff_t FILE ' +
    'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t intptr_t uintptr_t';
  var C_BUILTINS = 'printf scanf fprintf sprintf snprintf puts gets fgets fputs malloc calloc realloc free ' +
    'memcpy memmove memset memcmp strlen strcpy strncpy strcmp strncmp strcat strstr fopen fclose fread fwrite ' +
    'exit abort assert atoi atof qsort';

  var JS_KW = 'break case catch class const continue debugger default delete do else export extends finally ' +
    'for function if import in instanceof let new return super switch this throw try typeof var void while ' +
    'with yield async await of static get set from as';
  var JS_BUILTINS = 'console window document Math JSON Object Array String Number Boolean Promise Map Set ' +
    'WeakMap WeakSet Date RegExp Error TypeError Symbol BigInt Intl Reflect Proxy parseInt parseFloat isNaN ' +
    'require module exports process setTimeout setInterval clearTimeout clearInterval fetch globalThis structuredClone';
  var TS_EXTRA_KW = 'abstract declare enum implements interface keyof namespace private protected public ' +
    'readonly type infer is asserts satisfies override unique module';

  var SPECS = {};

  SPECS.python = {
    rules: [
      R.hash,
      [/(?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)/y, 'string'],
      [/@[A-Za-z_][\w.]*/y, 'meta']
    ],
    keywords: set('and as assert async await break class continue def del elif else except finally for from ' +
      'global if import in is lambda nonlocal not or pass raise return try while with yield'),
    constants: set('True False None NotImplemented Ellipsis __name__ __file__ __main__'),
    builtins: set('print len range enumerate zip map filter sorted reversed sum min max abs open input int ' +
      'float str bool list dict set tuple frozenset bytes bytearray type isinstance issubclass hasattr getattr ' +
      'setattr delattr super object property staticmethod classmethod iter next any all repr format round id ' +
      'hash dir vars callable chr ord bin hex oct pow divmod globals locals Exception BaseException ValueError ' +
      'TypeError KeyError IndexError AttributeError RuntimeError NotImplementedError StopIteration ImportError ' +
      'OSError FileNotFoundError KeyboardInterrupt'),
    selfWords: set('self cls'),
    funcAfter: set('def'),
    typeAfter: set('class'),
    ros: true
  };

  SPECS.java = {
    rules: [R.lineSlash, R.block, [/"""[\s\S]*?(?:"""|$)/y, 'string'], R.dq, R.chr, R.annotation],
    keywords: set('abstract assert break case catch class continue default do else enum extends final finally ' +
      'for if implements import instanceof interface native new package private protected public return static ' +
      'strictfp super switch synchronized this throw throws transient try volatile while var record sealed ' +
      'permits yield'),
    types: set('boolean byte char double float int long short void'),
    constants: set('true false null'),
    builtins: set('System String Object Integer Long Double Float Boolean Character Math List ArrayList Map ' +
      'HashMap Set HashSet Arrays Collections Optional Stream'),
    typeAfter: set('class interface enum extends implements new record throws')
  };

  SPECS.c = {
    rules: [R.lineSlash, R.block, R.include, R.preproc, [/(?:u8|[uUL])?"(?:[^"\\\n]|\\.)*"?/y, 'string'], R.chr],
    keywords: set(C_KW),
    types: set(C_TYPES),
    constants: set('NULL true false EOF stdin stdout stderr'),
    builtins: set(C_BUILTINS),
    typeAfter: set('struct enum union')
  };

  SPECS.cpp = {
    rules: [
      R.lineSlash, R.block, R.include, R.preproc,
      [/R"([^(\s]{0,16})\([\s\S]*?\)\1"/y, 'string'],
      [/(?:u8|[uUL])?"(?:[^"\\\n]|\\.)*"?/y, 'string'], R.chr
    ],
    keywords: set(C_KW + ' alignas alignof and asm catch class concept consteval constexpr constinit const_cast ' +
      'co_await co_return co_yield decltype delete dynamic_cast explicit export friend mutable namespace new ' +
      'noexcept not operator or override final private protected public reinterpret_cast requires static_assert ' +
      'static_cast template this thread_local throw try typeid typename using virtual xor'),
    types: set(C_TYPES + ' wchar_t char8_t char16_t char32_t string vector map unordered_map set unordered_set ' +
      'array deque list pair tuple optional variant shared_ptr unique_ptr weak_ptr function'),
    constants: set('true false nullptr NULL'),
    builtins: set(C_BUILTINS + ' std cout cin cerr endl make_shared make_unique move forward swap'),
    typeAfter: set('class struct enum union namespace new typename'),
    ros: true
  };

  SPECS.csharp = {
    rules: [
      R.lineSlash, R.block, R.preproc,
      [/\$?@\$?"(?:[^"]|"")*"?/y, 'string'],
      [/\$?"(?:[^"\\\n]|\\.)*"?/y, 'string'], R.chr
    ],
    keywords: set('abstract as base break case catch checked class const continue default delegate do else enum ' +
      'event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace ' +
      'new operator out override params private protected public readonly ref return sealed sizeof stackalloc ' +
      'static struct switch this throw try typeof unchecked unsafe using virtual volatile while async await get ' +
      'set value yield record init required where when nameof partial global'),
    types: set('bool byte char decimal double float int long object sbyte short string uint ulong ushort void ' +
      'dynamic var nint nuint'),
    constants: set('true false null'),
    builtins: set('Console Math String List Dictionary Task Exception DateTime Guid Enumerable'),
    typeAfter: set('class interface enum struct record new namespace')
  };

  SPECS.javascript = {
    ident: IDENT_JS,
    rules: [R.lineSlash, R.block, R.dq, R.sq, R.backtick, R.jsRegex, R.annotation],
    keywords: set(JS_KW),
    constants: set('true false null undefined NaN Infinity'),
    builtins: set(JS_BUILTINS),
    funcAfter: set('function'),
    typeAfter: set('class extends new')
  };

  SPECS.typescript = Object.assign({}, SPECS.javascript, {
    keywords: set(JS_KW + ' ' + TS_EXTRA_KW),
    types: set('string number boolean any unknown never void object bigint symbol'),
    typeAfter: set('class extends new interface type enum implements namespace')
  });

  SPECS.go = {
    rules: [R.lineSlash, R.block, R.dq, R.chr, R.backtick],
    keywords: set('break case chan const continue default defer else fallthrough for func go goto if import ' +
      'interface map package range return select struct switch type var'),
    types: set('bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string ' +
      'uint uint8 uint16 uint32 uint64 uintptr any'),
    constants: set('true false nil iota'),
    builtins: set('append cap clear close complex copy delete imag len make max min new panic print println real recover'),
    funcAfter: set('func'),
    typeAfter: set('type')
  };

  SPECS.rust = {
    rules: [R.lineSlash, R.block, [/#!?\[[^\]\n]*\]/y, 'meta'], [/b?r#*"[\s\S]*?"#*/y, 'string'], R.dq,
      [/b?'(?:[^'\\\n]|\\.)'/y, 'string']],
    keywords: set('as async await break const continue crate dyn else enum extern fn for if impl in let loop ' +
      'match mod move mut pub ref return self Self static struct super trait type unsafe use where while'),
    types: set('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option ' +
      'Result Box Rc Arc HashMap'),
    constants: set('true false None Some Ok Err'),
    funcAfter: set('fn'),
    typeAfter: set('struct enum trait impl type'),
    macroBang: true
  };

  SPECS.sql = {
    ci: true, noCaps: true,
    rules: [[/--[^\n]*/y, 'comment'], R.block, [/'(?:[^']|'')*'?/y, 'string'], [/"[^"\n]*"?|`[^`\n]*`?/y, 'property']],
    keywords: set('select from where and or not insert into values update set delete create table alter drop ' +
      'index view join inner left right outer full cross on as group by order having limit offset union all ' +
      'distinct case when then else end is in exists between like ilike primary key foreign references default ' +
      'constraint unique with returning asc desc database schema if begin commit rollback transaction grant ' +
      'revoke truncate replace procedure function trigger declare'),
    types: set('int integer bigint smallint tinyint varchar char text boolean bool date time timestamp ' +
      'timestamptz float real double decimal numeric serial bigserial uuid json jsonb blob'),
    constants: set('true false null'),
    builtins: set('count sum avg min max coalesce now cast lower upper substring length round concat ifnull nullif')
  };

  SPECS.json = {
    noCaps: true,
    rules: [R.lineSlash, R.block, [/"(?:[^"\\\n]|\\.)*"?/y, function (m, ctx) {
      return nextNonSpace(ctx.code, ctx.i + m[0].length) === ':' ? 'property' : 'string';
    }]],
    constants: set('true false null')
  };

  var CMAKE_KW = set('if elseif else endif foreach endforeach while endwhile function endfunction macro endmacro ' +
    'return break continue block endblock');
  SPECS.cmake = {
    ci: true,
    rules: [
      [/#\[\[[\s\S]*?(?:\]\]|$)/y, 'comment'], R.hash,
      [/"(?:[^"\\]|\\[\s\S])*"?/y, function (m) { return interpParts(m[0], /\$(?:ENV|CACHE)?\{[^}\n]*\}/g); }],
      [/\$(?:ENV|CACHE)?\{[^}\n]*\}/y, 'variable'],
      [/\$<[^>\n]*>/y, 'meta'],
      // unquoted paths and source files: src/talker.cpp, launch/sim.launch.py, msg/Num.msg
      [/[A-Za-z_][\w.+-]*(?:\/[\w.+*-]+)+|[A-Za-z_][\w-]*(?:\.[\w-]+)*\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx|py|msg|srv|action|xml|ya?ml|txt|cmake|json|in)\b/y, 'string']
    ],
    classify: function (w, lw, info) {
      if (info.next === '(') {
        if (CMAKE_KW.has(lw)) return 'keyword';
        if (/^(ament_|rosidl_|rclcpp_|catkin_)/.test(lw)) return 'ros';
        return 'function';
      }
      if (/^(ament|rclcpp|rclpy|rosidl|rcl|rmw)(_\w+)?$/.test(lw) || ROS_PKG_RE.test(lw)) return 'ros';
      if (/^[A-Z][A-Z0-9_]+$/.test(w)) return 'constant';
      return null;
    }
  };

  // ---------------------------------------------------------------- shell (bash / sh / zsh)

  var SH_KW = set('if then else elif fi for while until do done case esac in function select time return break ' +
    'continue local export declare readonly unset source alias eval exec trap shift let typeset');
  var SH_KW_KEEP = set('if then else elif do while until time ! {');
  var SH_PREFIX = set('sudo nohup env xargs watch nice command builtin timeout stdbuf');
  var SH_VAR_IN_STR = /\$\{[^}\n]*\}|\$[A-Za-z_]\w*|\$[0-9@#?$!*-]/g;

  /** Classifies a command-position word (shared by bash, PowerShell and Dockerfile RUN). */
  function commandWord(st, w) {
    if (ROS_CLI.has(w)) { st.cmd = 'ros'; return 'ros'; }
    if (DOCKER_CLI.has(w)) { st.cmd = 'docker'; return 'docker'; }
    st.cmd = w;
    return 'function';
  }

  /** Classifies an argument word; returns a type or null. */
  function argumentWord(st, w) {
    if (st.cmd === 'ros' && st.arg === 1) st.rosVerb = w;
    if (st.cmd === 'ros' && st.arg <= 2 && ROS_SUB.has(w)) return 'rosSub';
    if (st.cmd === 'docker' && st.arg <= 2 && DOCKER_SUB.has(w)) return 'dockerSub';
    if (ROS_ARG_WORDS.has(w) || ROS_PATH_RE.test(w)) return 'rosSub';
    if (ROS_MSG_RE.test(w)) return 'type';
    if (st.cmd === 'docker' && /^[\w.\/-]+:[\w.-]+$/.test(w) && !/^\d/.test(w)) return 'type';
    // package name in `ros2 run <pkg> ...` / `ros2 launch <pkg> ...`
    if (st.cmd === 'ros' && st.arg === 2 && (st.rosVerb === 'run' || st.rosVerb === 'launch') &&
        /^[A-Za-z_][\w-]*$/.test(w)) return 'type';
    if (PATH_ARG_RE.test(w)) return 'string';
    return null;
  }

  /** Unquoted file paths, URLs and file names (`src/main.cpp`, `~/.bashrc`, `setup.bash`). */
  var PATH_ARG_RE = /\/|^~|^[\w-]+\.[A-Za-z][\w.]*$/;

  /** Pushes a shell argument, splitting ROS launch arguments `name:=value`. */
  function pushArgument(ctx, st, i, w) {
    var la = /^([A-Za-z_][\w.]*)(:=)(.*)$/.exec(w);
    if (!la) { push(ctx, i, i + w.length, argumentWord(st, w)); return; }
    var p = i + la[1].length;
    push(ctx, i, p, 'property');
    push(ctx, p, p + 2, 'operator');
    var v = la[3];
    push(ctx, p + 2, p + 2 + v.length,
      /^(true|false|True|False)$/.test(v) ? 'constant' : /^-?\d+(\.\d+)?$/.test(v) ? 'number' : 'string');
  }

  function tokenizeShell(code, base, out) {
    var ctx = ctxOf(code, base, out);
    var st = { cmdPos: true, cmd: null, arg: 0, assign: false, heredoc: null };
    function reset() { st.cmdPos = true; st.cmd = null; st.arg = 0; }
    function argStep() {
      if (st.assign) { st.assign = false; return; }
      if (st.cmdPos) { st.cmdPos = false; st.cmd = st.cmd || '?'; st.arg = 0; } else { st.arg++; }
    }
    var m;
    while (ctx.i < ctx.n) {
      var i = ctx.i, c = code[i];

      if (c === '\n') {
        if (st.heredoc) {
          var endRe = new RegExp('^[ \\t]*' + escRe(st.heredoc) + '[ \\t]*$', 'mg');
          endRe.lastIndex = i + 1;
          var em = endRe.exec(code);
          var stop = em ? em.index : ctx.n;
          push(ctx, i + 1, stop, 'string');
          if (em) push(ctx, em.index, em.index + em[0].length, 'keyword');
          ctx.i = em ? em.index + em[0].length : ctx.n;
          st.heredoc = null;
          reset();
          continue;
        }
        ctx.i++; reset(); st.assign = false; continue;
      }
      if (c === ' ' || c === '\t' || c === '\r') { ctx.i++; st.assign = false; continue; }
      if (c === '\\') { ctx.i += 2; continue; }
      if (c === '#' && (i === 0 || /[\s;|&(]/.test(code[i - 1]))) {
        m = at(ctx, /#[^\n]*/y); push(ctx, i, i + m[0].length, 'comment'); ctx.i += m[0].length; continue;
      }
      if ((m = at(ctx, /<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1/y))) {
        push(ctx, i, i + m[0].length, 'operator'); st.heredoc = m[2]; ctx.i += m[0].length; continue;
      }
      if (c === "'") {
        m = at(ctx, /'[^']*'?/y); push(ctx, i, i + m[0].length, 'string'); ctx.i += m[0].length; argStep(); continue;
      }
      if (c === '$' && code[i + 1] === "'") {
        m = at(ctx, /\$'(?:[^'\\]|\\.)*'?/y); push(ctx, i, i + m[0].length, 'string'); ctx.i += m[0].length; argStep(); continue;
      }
      if (c === '"') {
        m = at(ctx, /"(?:[^"\\]|\\[\s\S])*"?/y);
        emit(ctx, i, m[0].length, interpParts(m[0], SH_VAR_IN_STR));
        ctx.i += m[0].length; argStep(); continue;
      }
      if (c === '$') {
        if (code[i + 1] === '(') {
          var len = code[i + 2] === '(' ? 3 : 2;
          push(ctx, i, i + len, 'punctuation'); ctx.i += len;
          if (len === 2) reset();
          continue;
        }
        m = at(ctx, /\$\{[^}\n]*\}?|\$[A-Za-z_]\w*|\$[0-9@#?$!*-]?/y);
        push(ctx, i, i + m[0].length, 'variable'); ctx.i += m[0].length; argStep(); continue;
      }
      if (c === '`') { push(ctx, i, i + 1, 'punctuation'); ctx.i++; reset(); continue; }
      if ((m = at(ctx, /\d*(?:&>>?|>>|>&|<&|<<<|<>|>\||<|>)\d*-?/y))) {
        push(ctx, i, i + m[0].length, 'operator'); ctx.i += m[0].length; continue;
      }
      if ((m = at(ctx, /&&|\|\||;;&?|\|&|[|;&]/y))) {
        push(ctx, i, i + m[0].length, 'operator'); ctx.i += m[0].length; reset(); continue;
      }
      if (c === '(' || c === '{') { push(ctx, i, i + 1, 'punctuation'); ctx.i++; reset(); continue; }
      if (c === ')' || c === '}') { push(ctx, i, i + 1, 'punctuation'); ctx.i++; continue; }
      if (c === '-' && (i === 0 || /\s/.test(code[i - 1]))) {
        m = at(ctx, /--?[\w][\w.-]*|--?/y);
        push(ctx, i, i + m[0].length, ROS_ARG_WORDS.has(m[0]) ? 'rosSub' : 'flag');
        ctx.i += m[0].length;
        if (code[ctx.i] === '=') { push(ctx, ctx.i, ctx.i + 1, 'operator'); ctx.i++; st.assign = true; }
        continue;
      }
      if ((m = at(ctx, /\d+(?:\.\d+)*(?=$|[\s;|&)<>])/y))) {
        push(ctx, i, i + m[0].length, 'number'); ctx.i += m[0].length; argStep(); continue;
      }
      if ((m = at(ctx, /[^\s|&;<>()`"'$\\{}]+/y))) {
        var w = m[0], end = i + w.length;
        ctx.i = end;
        if (st.assign) { st.assign = false; continue; }
        if (st.cmdPos) {
          var am = /^([A-Za-z_]\w*)(\+?=)/.exec(w);
          if (am) {
            push(ctx, i, i + am[1].length, 'variable');
            push(ctx, i + am[1].length, i + am[0].length, 'operator');
            if (am[0].length === w.length) st.assign = true;
            continue;
          }
          if (w === '[' || w === '[[') { push(ctx, i, end, 'punctuation'); st.cmdPos = false; st.cmd = 'test'; continue; }
          if (SH_KW.has(w)) {
            push(ctx, i, end, 'keyword');
            if (!SH_KW_KEEP.has(w)) { st.cmdPos = false; st.cmd = w; st.arg = 0; }
            continue;
          }
          if (SH_PREFIX.has(w)) { push(ctx, i, end, 'function'); continue; }
          push(ctx, i, end, commandWord(st, w));
          st.cmdPos = false; st.arg = 0;
          continue;
        }
        st.arg++;
        if (w === ']' || w === ']]') { push(ctx, i, end, 'punctuation'); continue; }
        var dm = /^(export|local|declare|readonly|typeset)$/.test(st.cmd) && /^([A-Za-z_]\w*)(\+?=)?/.exec(w);
        if (dm && (dm[2] || dm[0] === w)) {
          push(ctx, i, i + dm[1].length, 'variable');
          if (dm[2]) push(ctx, i + dm[1].length, i + dm[0].length, 'operator');
          if (dm[2] && dm[0].length === w.length) st.assign = true;
          continue;
        }
        if (w === 'in' && (st.cmd === 'for' || st.cmd === 'case' || st.cmd === 'select')) { push(ctx, i, end, 'keyword'); continue; }
        pushArgument(ctx, st, i, w);
        continue;
      }
      ctx.i++;
    }
    return ctx.out;
  }

  // ---------------------------------------------------------------- PowerShell

  var PS_KW = set('begin break catch class continue data define do dynamicparam else elseif end enum exit filter ' +
    'finally for foreach from function if in param process return switch throw trap try until using while ' +
    'workflow parallel hidden static');
  var PS_KW_ANY = set('in else elseif catch finally until while');
  var PS_KW_KEEP = set('return throw else elseif do try finally');
  var PS_OPS = set('-eq -ne -gt -ge -lt -le -like -notlike -match -notmatch -contains -notcontains -in -notin ' +
    '-replace -split -join -and -or -not -xor -band -bor -bxor -bnot -shl -shr -is -isnot -as -f -ieq -ine -ceq ' +
    '-cne -imatch -cmatch -ilike -clike -creplace -ireplace');
  var PS_VAR = /\$(?:\{[^}]*\}|(?:global|local|script|private|env|using|variable):[A-Za-z_]\w*|[A-Za-z_]\w*|[$?^_])/gi;

  function tokenizePowerShell(code, base, out) {
    var ctx = ctxOf(code, base, out);
    var st = { cmdPos: true, cmd: null, arg: 0, member: false };
    function reset() { st.cmdPos = true; st.cmd = null; st.arg = 0; }
    function argStep() { if (st.cmdPos) { st.cmdPos = false; st.cmd = '?'; st.arg = 0; } else st.arg++; }
    var m;
    while (ctx.i < ctx.n) {
      var i = ctx.i, c = code[i];
      if (c === '\n') { ctx.i++; reset(); continue; }
      if (c === ' ' || c === '\t' || c === '\r') { ctx.i++; continue; }
      if ((m = at(ctx, /<#[\s\S]*?(?:#>|$)/y))) { push(ctx, i, i + m[0].length, 'comment'); ctx.i += m[0].length; continue; }
      if (c === '#') { m = at(ctx, /#[^\n]*/y); push(ctx, i, i + m[0].length, 'comment'); ctx.i += m[0].length; continue; }
      if (c === '`') { ctx.i += 2; continue; }
      if ((m = at(ctx, /@"[\s\S]*?(?:\n"@|$)/y))) {
        emit(ctx, i, m[0].length, interpParts(m[0], new RegExp(PS_VAR.source, 'gi'))); ctx.i += m[0].length; argStep(); continue;
      }
      if ((m = at(ctx, /@'[\s\S]*?(?:\n'@|$)/y))) { push(ctx, i, i + m[0].length, 'string'); ctx.i += m[0].length; argStep(); continue; }
      if (c === '"') {
        m = at(ctx, /"(?:[^"`]|`[\s\S]|"")*"?/y);
        emit(ctx, i, m[0].length, interpParts(m[0], new RegExp(PS_VAR.source, 'gi'))); ctx.i += m[0].length; argStep(); continue;
      }
      if (c === "'") { m = at(ctx, /'(?:[^']|'')*'?/y); push(ctx, i, i + m[0].length, 'string'); ctx.i += m[0].length; argStep(); continue; }
      if (c === '$' && code[i + 1] === '(') { push(ctx, i, i + 2, 'punctuation'); ctx.i += 2; reset(); continue; }
      if (c === '@' && (code[i + 1] === '(' || code[i + 1] === '{')) {
        push(ctx, i, i + 2, 'punctuation'); ctx.i += 2;
        if (code[i + 1] === '(') reset(); else { st.cmdPos = false; st.cmd = '@{'; }
        continue;
      }
      if ((m = at(ctx, new RegExp(PS_VAR.source, 'yi')))) {
        var lv = m[0].toLowerCase();
        push(ctx, i, i + m[0].length, (lv === '$true' || lv === '$false' || lv === '$null') ? 'constant' : 'variable');
        ctx.i += m[0].length; argStep(); continue;
      }
      if ((m = at(ctx, /\[[A-Za-z_][\w.`]*(?:\[[\w.,\s]*\])*\]/y))) {
        push(ctx, i, i + m[0].length, 'type'); ctx.i += m[0].length; if (st.cmdPos) st.cmdPos = false; continue;
      }
      if (code.startsWith('::', i)) { push(ctx, i, i + 2, 'punctuation'); ctx.i += 2; st.member = true; continue; }
      if (c === '.' && i > 0 && /[\w)\]]/.test(code[i - 1]) && /[A-Za-z_]/.test(code[i + 1] || '')) {
        push(ctx, i, i + 1, 'punctuation'); ctx.i++; st.member = true; continue;
      }
      if (st.member && (m = at(ctx, /[A-Za-z_]\w*/y))) {
        st.member = false;
        push(ctx, i, i + m[0].length, code[i + m[0].length] === '(' ? 'function' : 'property');
        ctx.i += m[0].length; continue;
      }
      st.member = false;
      if (c === '-' && (i === 0 || /[\s(,]/.test(code[i - 1])) && (m = at(ctx, /-[A-Za-z][\w-]*/y))) {
        push(ctx, i, i + m[0].length, PS_OPS.has(m[0].toLowerCase()) ? 'keyword' : (m[0] === '-ros-args' ? 'rosSub' : 'flag'));
        ctx.i += m[0].length; continue;
      }
      if (c === '-' && code[i + 1] === '-' && /\s/.test(code[i - 1] || ' ') && (m = at(ctx, /--[\w][\w.-]*/y))) {
        push(ctx, i, i + m[0].length, ROS_ARG_WORDS.has(m[0]) ? 'rosSub' : 'flag'); ctx.i += m[0].length; continue;
      }
      if ((m = at(ctx, /\d+(?:\.\d+)?(?:[kmgtp]b)?(?![\w.])/yi))) {
        push(ctx, i, i + m[0].length, 'number'); ctx.i += m[0].length; argStep(); continue;
      }
      if ((m = at(ctx, /&&|\|\||[|;]/y))) { push(ctx, i, i + m[0].length, 'operator'); ctx.i += m[0].length; reset(); continue; }
      if (c === '&' || c === '.' && /\s/.test(code[i + 1] || '')) { push(ctx, i, i + 1, 'operator'); ctx.i++; continue; }
      if ((m = at(ctx, /[+\-*\/%]?=(?!=)/y))) { push(ctx, i, i + m[0].length, 'operator'); ctx.i += m[0].length; reset(); continue; }
      if ((m = at(ctx, /[+\-*\/%!<>]+/y))) { push(ctx, i, i + m[0].length, 'operator'); ctx.i += m[0].length; continue; }
      if (c === '{' || c === '(') { push(ctx, i, i + 1, 'punctuation'); ctx.i++; reset(); continue; }
      if ('})[],'.indexOf(c) >= 0) { push(ctx, i, i + 1, 'punctuation'); ctx.i++; continue; }
      if ((m = at(ctx, /[^\s|;&(){}\[\],"'`$=<>#@]+/y))) {
        var w = m[0], lw = w.toLowerCase(), end = i + w.length, t = null;
        ctx.i = end;
        if (st.cmdPos) {
          if (PS_KW.has(lw)) {
            t = 'keyword';
            if (!PS_KW_KEEP.has(lw)) { st.cmdPos = false; st.cmd = lw; st.arg = 0; }
          } else {
            t = commandWord(st, lw); st.cmdPos = false; st.arg = 0;
          }
        } else {
          st.arg++;
          if (PS_KW_ANY.has(lw)) t = 'keyword';
          else if (code[end] === '(') t = 'function';
          else t = argumentWord(st, w);
          if (t === 'keyword' && PS_KW_KEEP.has(lw)) reset();
        }
        push(ctx, i, end, t);
        continue;
      }
      ctx.i++;
    }
    return ctx.out;
  }

  // ---------------------------------------------------------------- Dockerfile

  function logicalLineEnd(code, i) {
    var n = code.length, first = true;
    while (i < n) {
      var nl = code.indexOf('\n', i);
      if (nl < 0) return n;
      var line = code.slice(i, nl);
      if (!first && /^\s*#/.test(line)) { i = nl + 1; continue; } // comment inside continuation
      first = false;
      if (/\\\s*$/.test(line)) { i = nl + 1; continue; }
      return nl;
    }
    return n;
  }

  function tokenizeDockerArgs(ins, rest, base, out) {
    var ctx = ctxOf(rest, base, out), m;
    var keyFirst = (ins === 'ENV' || ins === 'ARG' || ins === 'LABEL');
    var sawWord = false, afterAs = false;
    while (ctx.i < ctx.n) {
      var i = ctx.i, c = rest[i];
      if (/\s/.test(c)) { ctx.i++; continue; }
      if (c === '\\') { ctx.i += 2; continue; }
      if (c === '#' && /^\s*#/.test(rest.slice(rest.lastIndexOf('\n', i) + 1, i + 1))) {
        m = at(ctx, /#[^\n]*/y); push(ctx, i, i + m[0].length, 'comment'); ctx.i += m[0].length; continue;
      }
      if (c === '"') { m = at(ctx, /"(?:[^"\\]|\\.)*"?/y); emit(ctx, i, m[0].length, interpParts(m[0], SH_VAR_IN_STR)); ctx.i += m[0].length; continue; }
      if (c === "'") { m = at(ctx, /'[^']*'?/y); push(ctx, i, i + m[0].length, 'string'); ctx.i += m[0].length; continue; }
      if (c === '$') { m = at(ctx, /\$\{[^}\n]*\}?|\$[A-Za-z_]\w*/y); if (m) { push(ctx, i, i + m[0].length, 'variable'); ctx.i += m[0].length; continue; } }
      if (c === '-' && rest[i + 1] === '-') {
        m = at(ctx, /--[\w-]+/y); push(ctx, i, i + m[0].length, 'flag'); ctx.i += m[0].length;
        if (rest[ctx.i] === '=') { push(ctx, ctx.i, ctx.i + 1, 'operator'); ctx.i++; m = at(ctx, /[^\s]+/y); if (m) ctx.i += m[0].length; }
        continue;
      }
      if (c === '=') { push(ctx, i, i + 1, 'operator'); ctx.i++; continue; }
      if ((m = at(ctx, /\d+(?:[\/-]\w+)?(?=\s|$)/y)) && ins === 'EXPOSE') { push(ctx, i, i + m[0].length, 'number'); ctx.i += m[0].length; continue; }
      if ((m = at(ctx, /[^\s="'$\\]+/y))) {
        var w = m[0], t = null;
        if (keyFirst && (rest[i + w.length] === '=' || !sawWord)) t = 'variable';
        else if (ins === 'FROM') {
          if (/^as$/i.test(w)) { t = 'keyword'; afterAs = true; }
          else if (afterAs) t = 'variable';
          else t = 'type';
        }
        sawWord = true;
        push(ctx, i, i + w.length, t);
        ctx.i += w.length;
        continue;
      }
      ctx.i++;
    }
  }

  function tokenizeDockerfile(code, base, out) {
    var ctx = ctxOf(code, base, out), i = 0, n = code.length;
    while (i < n) {
      while (i < n && /[ \t\r]/.test(code[i])) i++;
      if (i >= n) break;
      if (code[i] === '\n') { i++; continue; }
      if (code[i] === '#') {
        var ce = code.indexOf('\n', i); if (ce < 0) ce = n;
        push(ctx, i, ce, 'comment'); i = ce; continue;
      }
      var end = logicalLineEnd(code, i);
      var im = /^[A-Za-z]+/.exec(code.slice(i, end));
      if (im && DOCKER_INSTR.has(im[0].toUpperCase())) {
        var ins = im[0].toUpperCase(), rs = i + im[0].length, rest = code.slice(rs, end);
        push(ctx, i, rs, 'docker');
        if (ins === 'RUN' || ins === 'CMD' || ins === 'ENTRYPOINT' || ins === 'SHELL') {
          if (/^\s*\[/.test(rest)) tokenizeGeneric(rest, SPECS.json, ctx.base + rs, ctx.out);
          else tokenizeShell(rest, ctx.base + rs, ctx.out);
        } else if (ins === 'HEALTHCHECK') {
          var cm = /\bCMD\b/.exec(rest);
          if (cm) {
            tokenizeDockerArgs(ins, rest.slice(0, cm.index), ctx.base + rs, ctx.out);
            push(ctx, rs + cm.index, rs + cm.index + 3, 'docker');
            tokenizeShell(rest.slice(cm.index + 3), ctx.base + rs + cm.index + 3, ctx.out);
          } else tokenizeDockerArgs(ins, rest, ctx.base + rs, ctx.out);
        } else if (ins === 'ONBUILD') {
          tokenizeDockerfile(rest.replace(/^\s+/, function (s) { return s.replace(/./g, ' '); }), ctx.base + rs, ctx.out);
        } else {
          tokenizeDockerArgs(ins, rest, ctx.base + rs, ctx.out);
        }
      } else {
        tokenizeShell(code.slice(i, end), ctx.base + i, ctx.out);
      }
      i = end;
    }
    return ctx.out;
  }

  // ---------------------------------------------------------------- YAML

  var YAML_CONST = /^(?:true|false|yes|no|on|off|null|~)$/i;
  var YAML_NUM = /^[-+]?(?:\d[\d_]*(?:\.\d*)?(?:[eE][-+]?\d+)?|0x[\da-fA-F]+|\.inf|\.nan)$/i;

  function tokenizeYaml(code, base, out) {
    var ctx = ctxOf(code, base, out);
    var compose = /^services\s*:/m.test(code);
    var block = null; // {indent, shell}
    var pos = 0, n = code.length;
    while (pos <= n) {
      var le = code.indexOf('\n', pos); if (le < 0) le = n;
      var line = code.slice(pos, le);
      var indent = /^[ \t]*/.exec(line)[0].length;
      if (block) {
        if (!line.trim() || indent > block.indent) {
          if (line.trim()) {
            if (block.shell) tokenizeShell(line, ctx.base + pos, ctx.out);
            else push(ctx, pos + indent, le, 'string');
          }
          pos = le + 1; continue;
        }
        block = null;
      }
      var j = pos + indent, m, key = null;
      if (/^(?:---|\.\.\.)(?:\s|$)/.test(line)) { push(ctx, pos, pos + 3, 'meta'); j = pos + 3; }
      while (code[j] === '-' && (code[j + 1] === ' ' || j + 1 === le)) {
        push(ctx, j, j + 1, 'punctuation'); j++;
        while (code[j] === ' ') j++;
      }
      var km = /^(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^\s#'"\[\]{},:&*!|>-][^\n#]*?|-[^\s][^\n#]*?)[ \t]*:(?=[ \t]|$)/.exec(code.slice(j, le));
      if (km) {
        var keyText = km[0].replace(/[ \t]*:$/, '');
        key = keyText;
        var kt = 'property';
        if (compose && COMPOSE_KEYS.has(keyText)) kt = 'docker';
        else if (keyText === 'ros__parameters') kt = 'ros';
        push(ctx, j, j + keyText.length, kt);
        push(ctx, j + km[0].length - 1, j + km[0].length, 'punctuation');
        j += km[0].length;
      }
      // value part
      var shellValue = compose && (key === 'command' || key === 'entrypoint');
      while (j < le) {
        var c = code[j];
        if (c === ' ' || c === '\t' || c === '\r') { j++; continue; }
        if (c === '#' && /\s/.test(code[j - 1] || ' ')) { push(ctx, j, le, 'comment'); break; }
        var rest = code.slice(j, le);
        if (c === '"') { m = /^"(?:[^"\\]|\\.)*"?/.exec(rest); push(ctx, j, j + m[0].length, 'string'); j += m[0].length; continue; }
        if (c === "'") { m = /^'(?:[^']|'')*'?/.exec(rest); push(ctx, j, j + m[0].length, 'string'); j += m[0].length; continue; }
        if ((c === '&' || c === '*') && (m = /^[&*][\w-]+/.exec(rest))) { push(ctx, j, j + m[0].length, 'variable'); j += m[0].length; continue; }
        if (c === '!' && (m = /^!!?[\w\/:-]*/.exec(rest))) { push(ctx, j, j + m[0].length, 'type'); j += m[0].length; continue; }
        if ((c === '|' || c === '>') && /^[|>][-+\d]*\s*(?:#.*)?$/.test(rest)) {
          m = /^[|>][-+\d]*/.exec(rest); push(ctx, j, j + m[0].length, 'operator'); j += m[0].length;
          block = { indent: indent, shell: shellValue }; continue;
        }
        if ('[]{},'.indexOf(c) >= 0) { push(ctx, j, j + 1, 'punctuation'); j++; continue; }
        m = /^[^,\[\]{}]+?(?=\s+#|[,\[\]{}]|\s*$)/.exec(rest);
        if (!m) { j++; continue; }
        var val = m[0].replace(/\s+$/, '');
        if (YAML_NUM.test(val)) push(ctx, j, j + val.length, 'number');
        else if (YAML_CONST.test(val)) push(ctx, j, j + val.length, 'constant');
        else if (shellValue) tokenizeShell(val, ctx.base + j, ctx.out);
        else push(ctx, j, j + val.length, 'string');
        j += m[0].length;
      }
      pos = le + 1;
    }
    return ctx.out;
  }

  // ---------------------------------------------------------------- CSS / SCSS

  function looksLikeSelector(code, i) {
    for (var j = i; j < code.length; j++) {
      var c = code[j];
      if (c === '{') return true;
      if (c === ';' || c === '}') return false;
    }
    return false;
  }

  function tokenizeCss(code, base, out) {
    var ctx = ctxOf(code, base, out), inValue = false, m;
    while (ctx.i < ctx.n) {
      var i = ctx.i, c = code[i];
      if (/\s/.test(c)) { ctx.i++; continue; }
      var hit = null;
      if ((m = at(ctx, /\/\*[\s\S]*?(?:\*\/|$)/y))) hit = 'comment';
      else if (!inValue && (m = at(ctx, /\/\/[^\n]*/y))) hit = 'comment';
      else if ((m = at(ctx, /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/y))) hit = 'string';
      else if ((m = at(ctx, /@[\w-]+/y))) hit = 'keyword';
      if (hit) { push(ctx, i, i + m[0].length, hit); ctx.i += m[0].length; continue; }
      if (c === '{' || c === '}' || c === ';') { push(ctx, i, i + 1, 'punctuation'); ctx.i++; inValue = false; continue; }
      if (inValue) {
        if ((m = at(ctx, /url\(([^)]*)\)?/y))) { emit(ctx, i, m[0].length, [[4, 'function'], [m[1].length, 'string'], [m[0].length - 4 - m[1].length, 'punctuation']]); ctx.i += m[0].length; continue; }
        if ((m = at(ctx, /#[\da-fA-F]{3,8}\b/y))) hit = 'number';
        else if ((m = at(ctx, /-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?/y))) hit = 'number';
        else if ((m = at(ctx, /!important/y))) hit = 'keyword';
        else if ((m = at(ctx, /--[\w-]+|\$[\w-]+/y))) hit = 'variable';
        else if ((m = at(ctx, /[\w-]+(?=\()/y))) hit = 'function';
        else if ((m = at(ctx, /[A-Za-z_-][\w-]*/y))) hit = 'constant';
        else if ((m = at(ctx, /[,\/*+()]/y))) hit = 'punctuation';
        if (hit) { push(ctx, i, i + m[0].length, hit); ctx.i += m[0].length; continue; }
        ctx.i++; continue;
      }
      if (!looksLikeSelector(code, i)) {
        if ((m = at(ctx, /--[\w-]+|\$[\w-]+/y))) { push(ctx, i, i + m[0].length, 'variable'); ctx.i += m[0].length; continue; }
        if ((m = at(ctx, /[A-Za-z-][\w-]*/y))) { push(ctx, i, i + m[0].length, 'property'); ctx.i += m[0].length; continue; }
        if (c === ':') { push(ctx, i, i + 1, 'punctuation'); ctx.i++; inValue = true; continue; }
        ctx.i++; continue;
      }
      if ((m = at(ctx, /\.[\w-]+/y))) hit = 'type';
      else if ((m = at(ctx, /#[\w-]+/y))) hit = 'constant';
      else if ((m = at(ctx, /::?[\w-]+/y))) hit = 'keyword';
      else if ((m = at(ctx, /\[[^\]]*\]?/y))) hit = 'attribute';
      else if ((m = at(ctx, /[A-Za-z][\w-]*|&|\*/y))) hit = 'tag';
      else if ((m = at(ctx, /[>+~,()]/y))) hit = 'operator';
      if (hit) { push(ctx, i, i + m[0].length, hit); ctx.i += m[0].length; continue; }
      ctx.i++;
    }
    return ctx.out;
  }

  // ---------------------------------------------------------------- HTML / XML

  var ROS_XML_TAGS = set('launch node include arg let param remap group executable set_env unset_env ' +
    'push-ros-namespace push_ros_namespace set_remap set_parameter set_parameters_from_file composable_node ' +
    'node_container load_composable_nodes depend build_depend exec_depend buildtool_depend ' +
    'buildtool_export_depend build_export_depend test_depend doc_depend member_of_group build_type');
  var ROS_SUBST = /\$\((?:find-pkg-share|find-pkg-prefix|find-exec|exec-in-pkg|var|env|arg|eval|dirname|anon|command|optenv)\b[^)]*\)/g;

  function tokenizeMarkup(code, html, base, out) {
    var ctx = ctxOf(code, base, out), m;
    while (ctx.i < ctx.n) {
      var i = ctx.i, c = code[i];
      if (c === '<') {
        if ((m = at(ctx, /<!--[\s\S]*?(?:-->|$)/y))) { push(ctx, i, i + m[0].length, 'comment'); ctx.i += m[0].length; continue; }
        if ((m = at(ctx, /<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/y))) { push(ctx, i, i + m[0].length, 'string'); ctx.i += m[0].length; continue; }
        if ((m = at(ctx, /<![^>]*>?|<\?[\s\S]*?(?:\?>|$)/y))) { push(ctx, i, i + m[0].length, 'meta'); ctx.i += m[0].length; continue; }
        if ((m = at(ctx, /(<\/?)([A-Za-z][\w:.-]*)/y))) {
          var closing = m[1] === '</', name = m[2], selfClose = false, lastEq = false;
          push(ctx, i, i + m[1].length, 'punctuation');
          push(ctx, i + m[1].length, i + m[0].length, (!html && ROS_XML_TAGS.has(name)) ? 'ros' : 'tag');
          ctx.i += m[0].length;
          while (ctx.i < ctx.n) {
            var j = ctx.i, a = code[j], m2;
            if (/\s/.test(a)) { ctx.i++; continue; }
            if (a === '>') { push(ctx, j, j + 1, 'punctuation'); ctx.i++; break; }
            if (code.startsWith('/>', j)) { push(ctx, j, j + 2, 'punctuation'); ctx.i += 2; selfClose = true; break; }
            if (a === '=') { push(ctx, j, j + 1, 'operator'); ctx.i++; lastEq = true; continue; }
            if (a === '"' || a === "'") {
              m2 = at(ctx, a === '"' ? /"[^"]*"?/y : /'[^']*'?/y);
              emit(ctx, j, m2[0].length, html ? 'string' : interpParts(m2[0], new RegExp(ROS_SUBST.source, 'g'), 'rosSub'));
              ctx.i += m2[0].length; lastEq = false; continue;
            }
            if ((m2 = at(ctx, /[^\s=>\/"']+/y))) {
              push(ctx, j, j + m2[0].length, lastEq ? 'string' : 'attribute');
              ctx.i += m2[0].length; lastEq = false; continue;
            }
            ctx.i++;
          }
          if (html && !closing && !selfClose && /^(script|style)$/i.test(name)) {
            var closeRe = new RegExp('</' + name + '\\s*>', 'ig');
            closeRe.lastIndex = ctx.i;
            var cm = closeRe.exec(code);
            var stop = cm ? cm.index : ctx.n;
            var inner = code.slice(ctx.i, stop);
            if (/script/i.test(name)) tokenizeGeneric(inner, SPECS.javascript, ctx.base + ctx.i, ctx.out);
            else tokenizeCss(inner, ctx.base + ctx.i, ctx.out);
            ctx.i = stop;
          }
          continue;
        }
      }
      if (c === '&' && (m = at(ctx, /&(?:#\d+|#x[\da-fA-F]+|\w+);/y))) { push(ctx, i, i + m[0].length, 'constant'); ctx.i += m[0].length; continue; }
      var nx = i + 1;
      while (nx < ctx.n && code[nx] !== '<' && code[nx] !== '&') nx++;
      ctx.i = nx;
    }
    return ctx.out;
  }

  // ---------------------------------------------------------------- registry

  function gen(id) { return function (code, base, out) { return tokenizeGeneric(code, SPECS[id], base, out); }; }

  var LANGS = [
    { id: 'python', name: 'Python', fn: gen('python') },
    { id: 'java', name: 'Java', fn: gen('java') },
    { id: 'c', name: 'C', fn: gen('c') },
    { id: 'cpp', name: 'C++', fn: gen('cpp') },
    { id: 'csharp', name: 'C#', fn: gen('csharp') },
    { id: 'javascript', name: 'JavaScript', fn: gen('javascript') },
    { id: 'typescript', name: 'TypeScript', fn: gen('typescript') },
    { id: 'html', name: 'HTML', fn: function (c, b, o) { return tokenizeMarkup(c, true, b, o); } },
    { id: 'css', name: 'CSS / SCSS', fn: tokenizeCss },
    { id: 'bash', name: 'Bash / Shell (ROS 2 + Docker aware)', fn: tokenizeShell },
    { id: 'powershell', name: 'PowerShell (ROS 2 + Docker aware)', fn: tokenizePowerShell },
    { id: 'dockerfile', name: 'Dockerfile', fn: tokenizeDockerfile },
    { id: 'yaml', name: 'YAML (docker-compose / ROS 2 params)', fn: tokenizeYaml },
    { id: 'xml', name: 'XML (ROS 2 launch / package.xml)', fn: function (c, b, o) { return tokenizeMarkup(c, false, b, o); } },
    { id: 'json', name: 'JSON', fn: gen('json') },
    { id: 'cmake', name: 'CMake (ament aware)', fn: gen('cmake') },
    { id: 'sql', name: 'SQL', fn: gen('sql') },
    { id: 'go', name: 'Go', fn: gen('go') },
    { id: 'rust', name: 'Rust', fn: gen('rust') },
    { id: 'plaintext', name: 'Plain text', fn: function () { return []; } }
  ];
  var BY_ID = {};
  LANGS.forEach(function (l) { BY_ID[l.id] = l; });

  function detect(code) {
    var c = code;
    var tests = [
      ['dockerfile', /^\s*FROM\s+\S+/im.test(c) && /^\s*(RUN|COPY|CMD|ENTRYPOINT|WORKDIR|ENV)\s/m.test(c)],
      ['xml', /^\s*<\?xml|<launch[\s>]|<package[\s>]/.test(c)],
      ['html', /<!DOCTYPE html|<html[\s>]|<(div|span|body|head|script|p|a)[\s>]/i.test(c)],
      ['powershell', /\b(Get|Set|New|Remove|Write|Invoke|Start|Stop|Test|Import)-[A-Z]\w+|\$env:|\[string\]|\$PSScriptRoot/.test(c)],
      ['bash', /^#!.*\b(ba|z)?sh\b/.test(c) || /^\s*(\$\s+)?(ros2|colcon|rosdep|docker|docker-compose|sudo|apt(-get)?|cd|source|echo|pip3?|git|mkdir|chmod|curl|wget|npm|ls)\s/m.test(c) || /^\s*export\s+\w+=/m.test(c)],
      ['cmake', /cmake_minimum_required|find_package\s*\(|add_executable\s*\(|ament_package\s*\(/i.test(c)],
      ['csharp', /\busing System|Console\.Write|\bpublic (static )?(async )?Task\b/.test(c)],
      ['java', /\bpublic\s+(static\s+)?(final\s+)?class\b|System\.out\.|\bpackage [\w.]+;|import java\./.test(c)],
      ['python', /^\s*(def \w+\(|from [\w.]+ import |import \w+\s*$|class \w+.*:\s*$|if __name__ ==)/m.test(c) || /\bprint\(|self\.\w+/.test(c) && !/;\s*$/m.test(c)],
      ['cpp', /#include\s*<(iostream|vector|string|memory|map)>|std::|rclcpp|\bnamespace\s+\w+|template\s*</.test(c)],
      ['c', /#include\s*[<"]|\bprintf\s*\(|\bmalloc\s*\(/.test(c)],
      ['go', /^package \w+\s*$|\bfunc (\(\w+ \*?\w+\) )?\w+\(|:= /m.test(c)],
      ['rust', /\bfn \w+\s*\(|\blet mut\b|println!|\bimpl\b.*\{/.test(c)],
      ['typescript', /^\s*(export\s+)?(interface|type)\s+\w+|:\s*(string|number|boolean|void)\b|<\w+>\(/m.test(c)],
      ['javascript', /\b(function|const|let|var)\s+\w+|=>|console\.log|require\(|document\./.test(c)],
      ['sql', /\b(SELECT\s[\s\S]+\sFROM|INSERT\s+INTO|CREATE\s+TABLE|UPDATE\s+\w+\s+SET)\b/i.test(c)],
      ['css', /^\s*[@.#]?[\w-]+[^{\n]*\{[^}]*:[^}]*;/m.test(c)],
      ['json', /^\s*[\[{]/.test(c) && (function () { try { JSON.parse(c); return true; } catch (e) { return false; } })()],
      ['yaml', /^[ \t]*[\w.-]+:(\s|$)/m.test(c) && !/[;{}]\s*$/m.test(c)]
    ];
    for (var k = 0; k < tests.length; k++) if (tests[k][1]) return tests[k][0];
    return 'bash';
  }

  function tokenize(code, lang) {
    var norm = code.replace(/[\r\u000b]/g, '\n'); // Docs soft line breaks; length is preserved
    var l = BY_ID[lang] || BY_ID.plaintext;
    var toks = l.fn(norm, 0, []);
    toks.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var res = [], last = 0;
    for (var k = 0; k < toks.length; k++) {
      var t = toks[k];
      if (t.s < last) continue; // drop overlaps
      res.push(t);
      last = t.e;
    }
    return res;
  }

  return {
    LANGUAGES: LANGS.map(function (l) { return { id: l.id, name: l.name }; }),
    tokenize: tokenize,
    detect: detect,
    langName: function (id) { return (BY_ID[id] || BY_ID.plaintext).name; }
  };
})();
