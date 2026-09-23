#!/usr/bin/env node
/* ============================================================
 * Worker 上线前静态检查
 * ------------------------------------------------------------
 * 起因是一次真实事故（2026-09-23）：
 *   `CURRENT_CTX = ctx` 这行被提交进 `_worker.js`，但**全文没有声明**。
 *   ES module 必然是严格模式，于是第一个请求就抛
 *   `ReferenceError: CURRENT_CTX is not defined` ——
 *   整个 Worker（音乐 + 影视）线上 **500**，Cloudflare 报 error 1101。
 *
 * 这种错 `new Function(src)` 查不出来（语法是合法的，是**运行期**才炸），
 * 所以专门写这个检查：**赋值了但没声明**的标识符。
 *
 * 用法：
 *   node tools/check-worker.js                     # 检查默认路径
 *   node tools/check-worker.js <文件> [更多文件…]
 * 退出码非 0 表示有问题，可以直接串在部署前面。
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const DEFAULT_FILES = [
  '../cloudflare/music-api/_worker.js',
  '../cloudflare/tv-gate/src/index.js',
];

/* 运行环境自带的全局，赋值给它们不算错 */
const KNOWN_GLOBALS = new Set([
  'globalThis', 'window', 'self', 'global', 'caches', 'fetch', 'Request', 'Response',
  'Headers', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'AbortController',
  'AbortSignal', 'ReadableStream', 'WritableStream', 'TransformStream', 'Blob', 'FormData',
  'console', 'JSON', 'Math', 'Date', 'Promise', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Error', 'TypeError', 'RangeError', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'RegExp', 'Symbol', 'BigInt', 'Proxy', 'Reflect', 'Intl', 'Buffer', 'process',
  'crypto', 'atob', 'btoa', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'queueMicrotask', 'structuredClone', 'performance', 'navigator', 'location', 'document',
  'module', 'exports', 'require', 'undefined', 'NaN', 'Infinity', 'arguments',
]);

/** 把注释和字符串字面量替换成等长空白，避免里面的内容被当成代码。
 *
 *  ⚠️ 必须处理**正则字面量**。第一版没有处理，结果 `/.../ ` 里的 `/`
 *  被当成注释开头，把后面一大段代码整段吞掉 —— 于是检查器对着真正的
 *  bug 报了「全部通过」（假阴性，比没有检查器更危险）。
 *
 *  判断「这个 / 是正则还是除号」用业界通行的启发式：看**前一个有意义字符**，
 *  是 `( , = : [ ! & | ? { } ;` 之一、或前面是 return/typeof/case 这类关键字、
 *  或它就是行首 —— 那它就是正则开头。
 */
function blankOut(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let prev = '';              /* 前一个「有意义」的字符或关键字 */
  let prevWord = '';
  const REGEX_PREFIX_CHARS = '(,=:[!&|?{};+-*%^~<>';

  const pushSig = (ch) => { prev = ch; if (/[A-Za-z_$]/.test(ch)) prevWord += ch; else prevWord = ''; };

  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    /* 行注释 */
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    /* 块注释 */
    if (c === '/' && c2 === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
      continue;
    }
    /* 正则字面量 */
    if (c === '/' && (prev === '' || REGEX_PREFIX_CHARS.indexOf(prev) >= 0 ||
        /^(return|typeof|case|in|of|delete|void|instanceof|new|do|else|yield|await)$/.test(prevWord))) {
      out += ' '; i++;
      let inClass = false;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { out += '  '; i += 2; continue; }
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { out += ' '; i++; break; }
        else if (d === '\n') { break; }   /* 正则不能跨行，兜底 */
        out += ' '; i++;
      }
      /* 跳过 flags */
      while (i < n && /[a-z]/.test(src[i])) { out += ' '; i++; }
      prev = ')'; prevWord = '';
      continue;
    }
    /* 字符串 / 模板串 */
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += ' '; i++;
      while (i < n) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        if (src[i] === quote) { out += ' '; i++; break; }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      prev = quote; prevWord = '';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) pushSig(c);
    i++;
  }
  return out;
}

function collectDeclared(code) {
  const d = new Set();
  let m;
  /* 注意 `let start, end` 这种一个关键字带多个名字 —— 只抓第一个会误报。
     所以先取到「let 后面的整段声明列表」，再按逗号拆。 */
  const declListRe = /\b(?:let|const|var)\s+([^;\n]*)/g;
  while ((m = declListRe.exec(code))) {
    m[1].split(',').forEach(part => {
      /* 去掉初始值、类型标注、解构符号，取出标识符 */
      let name = part.split('=')[0].trim();
      if (name.startsWith('{') || name.startsWith('[')) return;   /* 解构交给下面那组 */
      name = name.replace(/\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) d.add(name);
    });
  }
  const patterns = [
    /\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g,
    /\bimport\s+([A-Za-z_$][\w$]*)\s+from/g,
  ];
  for (const re of patterns) while ((m = re.exec(code))) d.add(m[1]);
  /* import { a, b as c } from … */
  const impRe = /\bimport\s*\{([^}]*)\}/g;
  while ((m = impRe.exec(code))) {
    m[1].split(',').forEach(part => {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) d.add(name);
    });
  }
  /* 解构声明：const { a, b } = … / const [a, b] = … */
  const deRe = /\b(?:let|const|var)\s*[[{]([^\]}]*)[\]}]/g;
  while ((m = deRe.exec(code))) {
    m[1].split(',').forEach(part => {
      const name = part.split(':').pop().replace(/=.*$/, '').replace(/\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) d.add(name);
    });
  }
  /* 函数 / catch 参数、for-of 绑定 —— 粗一点没关系，重点是别误报 */
  const paramRe = /(?:function\s*[\w$]*\s*|catch\s*|for\s*)\s*\(([^)]*)\)/g;
  while ((m = paramRe.exec(code))) {
    m[1].split(',').forEach(part => {
      const name = part.replace(/[={].*$/, '').replace(/\.\.\./, '').replace(/^\s*(?:let|const|var)\s+/, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) d.add(name);
    });
  }
  return d;
}

function check(file) {
  const src = fs.readFileSync(file, 'utf8');
  const code = blankOut(src);
  const declared = collectDeclared(code);
  const lines = src.split(/\r?\n/);
  /* 只看「语句起始位置」的赋值：行首（可含缩进）的 名字 = */
  const assignRe = /^[ \t]*([A-Za-z_$][\w$]*)\s*=\s*(?!=)/gm;
  const bad = [];
  let m;
  while ((m = assignRe.exec(code)) !== null) {
    const name = m[1];
    if (KNOWN_GLOBALS.has(name) || declared.has(name)) continue;
    const line = code.slice(0, m.index).split('\n').length;
    bad.push({ name, line, text: (lines[line - 1] || '').trim().slice(0, 100) });
  }
  return bad;
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : DEFAULT_FILES.map(f => path.resolve(__dirname, f)).filter(f => fs.existsSync(f));

if (!files.length) {
  console.log('没有可检查的文件');
  process.exit(0);
}

let total = 0;
for (const f of files) {
  const bad = check(f);
  const rel = path.relative(path.resolve(__dirname, '..'), f) || f;
  if (!bad.length) {
    console.log('✅ ' + rel);
  } else {
    total += bad.length;
    console.log('❌ ' + rel);
    bad.forEach(b => {
      console.log('   第 ' + b.line + ' 行：`' + b.name + '` 赋值了但全文没有声明');
      console.log('      ' + b.text);
      console.log('      → ES module 是严格模式，这一行会在运行期抛 ReferenceError，');
      console.log('        整个 Worker 直接 500（Cloudflare error 1101）。加 let/const 声明。');
    });
  }
}

if (total) {
  console.log('\n共 ' + total + ' 处未声明赋值。**不要部署**。');
  process.exit(1);
}
console.log('\n全部通过。');
