#!/usr/bin/env node
/* ============================================================
 * 前端脚本上线前静态检查
 * ------------------------------------------------------------
 * 起因是两次**真实事故**，同一次提交（7c68f97「修复了部分函数过于冗余的
 * 问题」，2026-10-12）留下的，而且都直接上了线：
 *
 *   1) `js/music-bundle.js` 里 `const w = pending[i++];` 被复制成相邻两行。
 *      同一作用域里重复声明 const 是**解析期**错误 —— 整个文件一行都不执行
 *      （不是部分失效）。music.html 的播放、解锁、搜索、断点续播全挂。
 *
 *   2) `const CryptoJS = CryptoJS || (…)` 在自身初始化式里引用自己，
 *      触发 TDZ：`ReferenceError: Cannot access 'CryptoJS' before
 *      initialization`。这个是**运行期**错误 —— 任何 parse 检查都拦不住，
 *      但错误点之后的整段代码（crypto-js、解锁、KGM）全部不执行。
 *
 * 当时仓库里的守卫（sync_nav / check_links / check-worker）一个都没覆盖 `js/`，
 * 所以两个错误是在 CI 全绿的情况下上的线。这个检查补上这个缺口：
 *
 *   检查 1  解析         —— 用 vm.Script 真编译一遍，等价 node --check，但能一次
 *                           跑完所有文件、报出全部问题。拦得住上面第 1 类。
 *   检查 2  自引用声明   —— `const/let X = X …`。这是 TDZ 的**充分形态**，
 *                           拦得住上面第 2 类。var 不做此检查（var 提升后合法）。
 *   检查 3  相邻重复声明 —— 相邻两行完全相同的 const/let。同作用域时检查 1 已能拦，
 *                           这里额外给出比 V8 报错更直白的诊断，并兜住跨作用域的
 *                           复制粘贴（那种情况语法合法，检查 1 看不见）。
 *
 * 三个检查在当前仓库上**零误报**（已实测），所以都按错误级处理：有命中即退出码 1。
 *
 * 用法：
 *   node tools/check-js-syntax.js              # 检查默认范围（js/ + sw.js）
 *   node tools/check-js-syntax.js <文件> […]   # 只检查指定文件
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { blankOut } = require('./lib/blank-out');

const ROOT = path.resolve(__dirname, '..');

/* 默认检查范围：js/ 整个目录（含 vendor/）+ 根目录的 sw.js。
 * vendor/ 也一起查 —— 第三方脚本解析不过，页面一样是白屏，没有理由放过。 */
const DEFAULT_DIRS = ['js'];
const DEFAULT_FILES = ['sw.js'];

function walkJs(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJs(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** 只去掉开头的 shebang（`#!` 不是合法 JS，但 Node 脚本允许） */
function stripShebang(src) {
  return src.startsWith('#!') ? '//' + src.slice(2) : src;
}

function checkFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/') || file;
  const raw = fs.readFileSync(file, 'utf8');
  const src = stripShebang(raw);
  const findings = [];

  /* 检查 1：真编译一遍（不执行）。重复声明、括号不配平都在这一步暴露。 */
  let moduleLike = false;
  try {
    new vm.Script(src, { filename: rel });
  } catch (e) {
    if (/Cannot use import statement|Unexpected token 'export'|await is only valid/.test(e.message)) {
      moduleLike = true;   /* 是 ES module，交给按 module 解析的地方去管 */
    } else {
      findings.push({
        kind: '解析失败',
        line: lineOfStack(e),
        detail: e.message,
        why: '整个文件一行都不会执行（解析期错误），引用它的页面直接功能全失。',
      });
    }
  }

  /* 模块文件不做基于「script」语义的模式检查，避免误报。 */
  if (moduleLike) return { rel, findings, moduleLike };

  const code = blankOut(src);
  const lines = src.split(/\r?\n/);

  /* 检查 2：`const/let X = X …` —— 自身初始化式里引用自己，必然 TDZ。 */
  const selfRe = /\b(const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\2\b(?![\w$])/g;
  let m;
  while ((m = selfRe.exec(code)) !== null) {
    const ln = code.slice(0, m.index).split('\n').length;
    findings.push({
      kind: '自引用声明',
      line: ln,
      detail: m[1] + ' ' + m[2] + ' = ' + m[2] + ' …',
      text: (lines[ln - 1] || '').trim().slice(0, 100),
      why: 'const/let 有 TDZ：右侧的 ' + m[2] + ' 指向的就是正在初始化的这个绑定，' +
           '运行到这一行会抛 ReferenceError，该行之后整段代码都不执行。改成 var。',
    });
  }

  /* 检查 3：相邻两行完全相同的 const/let 声明。 */
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1].trim(), b = lines[i].trim();
    if (a && a === b && /^(const|let)\s/.test(a)) {
      findings.push({
        kind: '相邻重复声明',
        line: i + 1,
        detail: a.slice(0, 100),
        why: '同一行内容连续出现两次，几乎总是拆分语句时复制出来的。' +
             '同作用域时是解析期错误；跨作用域时语法合法但同样是复制粘贴事故。',
      });
    }
  }

  return { rel, findings, moduleLike };
}

/** 从 V8 的 stack 里取出行号（`rel:12` 或 `rel:12:5`） */
function lineOfStack(e) {
  const s = String(e.stack || '');
  const m = s.match(/\(?[^()\s]*:(\d+)(?::\d+)?\)?/);
  return m ? Number(m[1]) : 0;
}

/* ---------------- 主流程 ---------------- */
const args = process.argv.slice(2);
let files;
if (args.length) {
  files = args.map(a => path.resolve(a));
} else {
  files = [];
  for (const d of DEFAULT_DIRS) walkJs(path.join(ROOT, d), files);
  for (const f of DEFAULT_FILES) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) files.push(p);
  }
}

if (!files.length) {
  console.log('❌ 没有找到任何要检查的 .js 文件 —— 检查范围配置可能被改坏了。');
  process.exit(1);
}

let total = 0, passed = 0;
const modules = [];

for (const f of files.sort()) {
  if (!fs.existsSync(f)) {
    console.log('❌ 文件不存在：' + path.relative(ROOT, f));
    total++;
    continue;
  }
  const { rel, findings, moduleLike } = checkFile(f);
  if (moduleLike) { modules.push(rel); continue; }
  if (!findings.length) { passed++; continue; }
  total += findings.length;
  console.log('❌ ' + rel);
  for (const b of findings) {
    console.log('   第 ' + b.line + ' 行  [' + b.kind + ']  ' + b.detail);
    if (b.text) console.log('      ' + b.text);
    console.log('      → ' + b.why);
  }
}

if (modules.length) {
  console.log('⚠️  以下文件是 ES module，未做 script 语义的模式检查（不是通过，是没查）：');
  modules.forEach(r => console.log('   ' + r));
  console.log('');
}

if (total) {
  console.log('\n共 ' + total + ' 处问题（' + passed + ' 个文件通过）。**不要部署**。');
  process.exit(1);
}
console.log('✅ ' + passed + ' 个文件全部通过（解析 / 自引用声明 / 相邻重复声明）。');
