#!/usr/bin/env node
/* ============================================================
 * 把 JS 源码里的**注释、字符串、模板串、正则字面量**替换成等长空白。
 * ------------------------------------------------------------
 * 用途：让「基于正则的静态检查」只看得到真正的代码，不会被字面量里的
 * 文本骗到（假阳性），也不会被正则里的 `/` 误当成注释开头而吞掉后面
 * 一大段代码（假阴性 —— 比没有检查器更危险）。
 *
 * 由 tools/check-worker.js 与 tools/check-js-syntax.js 共用。
 *
 * ⚠️ 正则字面量的判断用业界通行的启发式：看**前一个有意义字符**，
 *    是 `( , = : [ ! & | ? { } ; + - * % ^ ~ < >` 之一、或前面是
 *    return/typeof/case 这类关键字、或它就是行首 —— 那它就是正则开头。
 * ============================================================ */

/** @param {string} src 源码 @returns {string} 等长的「只剩代码」文本 */
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

module.exports = { blankOut };
