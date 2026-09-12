/* ============================================================
 * 看板娘跟着唱（music.html 专用）
 * ------------------------------------------------------------
 * 音乐播放时，偶尔让看板娘把当前这一句歌词"唱"出来：
 *   气泡里显示这句歌词 + 模型摆动 + 引擎自带的 idle 动作。
 *
 * 为什么不直接调 L2D.showMessage：
 *   widget.js 的提示是写进它自己的 #waifu-tips 的，而 waifu.js 注入的
 *   CSS 里有 '#waifu-tool,#waifu-tips{display:none!important}'
 *   —— 也就是那个元素被彻底藏起来了，写进去什么也看不见。
 *   页面上真正可见的气泡是 waifu.js 的 #waifu-fab .wf-bubble，
 *   所以这里沿用它的气泡，复刻内部 say() 的显示/隐藏逻辑。
 *
 * 为什么用 CSS 摆动而不是去驱动口型：
 *   引擎是可用的（L2D.playRandomIdle 能触发动作），但直接 setParamFloat
 *   改口型会被 Cubism 自己的动作/眨眼控制器每帧覆盖掉，效果不可靠。
 *   容器上的 CSS 动画则一定生效，且与引擎互不干扰（不动 transform 之外的属性，
 *   也不碰 waifu.js 拖拽用的 left/top）。
 * ============================================================ */
(function () {
  'use strict';
  if (window.waifuSing) return;

  var COOLDOWN   = 22000;   /* 两次开口至少隔多久 */
  var CHANCE      = 0.34;   /* 冷却结束后，每换一句的触发概率 */
  var BUBBLE_MS   = 3200;   /* 气泡停留时长 */
  var MIN_LEN     = 2;
  var MAX_LEN     = 42;     /* 太长的一句话塞进气泡会溢出来 */

  var lastAt = 0, lastText = '', okCount = 0, skipCount = 0;

  /* 制作人员 / 纯符号这类不适合当台词的行，跟歌词面板用同一套判断 */
  var BAD = new RegExp(
    '^(作词|作詞|作曲|编曲|編曲|制作人|製作人|制作|製作|混音|母带|母帶|录音|錄音|' +
    '监制|監製|出品|发行|發行|统筹|統籌|企划|企劃|策划|策劃|原唱|演唱|配唱|' +
    '合声|合聲|吉他|贝斯|貝斯|鼓|键盘|鍵盤|和声|和聲|弦乐|弦樂|OP|SP|词|詞|曲)' +
    '[^:：]{0,4}[:：]'
  );

  function fab() { return document.getElementById('waifu-fab'); }

  function bubbleEl() {
    var f = fab();
    return f ? f.querySelector('.wf-bubble') : null;
  }

  /* 这句适不适合让看板娘念 */
  function singable(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t || t.length < MIN_LEN || t.length > MAX_LEN) return null;
    if (BAD.test(t)) return null;
    if (t === lastText) return null;                       /* 同一句不重复 */
    if (!/[\u4e00-\u9fa5A-Za-z0-9]/.test(t)) return null;  /* 纯符号/纯假名标点 */
    return t;
  }

  function showBubble(text, ms) {
    var b = bubbleEl();
    if (!b) return false;
    /* 看板娘自己在说话时不打断（点她会出 TIPS 台词） */
    if (b.classList.contains('show') && !b.classList.contains('wf-sing')) return false;
    b.textContent = text;
    b.classList.add('show', 'wf-sing');
    clearTimeout(b._t); clearTimeout(b._singT);
    b._t = setTimeout(function () { b.classList.remove('show'); }, ms);
    b._singT = setTimeout(function () { b.classList.remove('wf-sing'); }, ms + 240);
    return true;
  }

  /* 模型晃动 + 引擎 idle 动作，双保险 */
  function wiggle(ms) {
    var f = fab();
    if (!f) return;
    f.classList.add('wf-singing');
    clearTimeout(f._singTO);
    f._singTO = setTimeout(function () { f.classList.remove('wf-singing'); }, ms);
    try {
      if (window.L2D && typeof window.L2D.playRandomIdle === 'function') window.L2D.playRandomIdle();
    } catch (e) { /* 引擎没准备好就算了，CSS 摆动仍在 */ }
  }

  /* 供音乐页调用；audio 传进来是为了确认"真的在放" */
  window.waifuSing = function (text, audio) {
    if (audio && audio.paused) { skipCount++; return false; }
    var f = fab();
    if (!f || f.classList.contains('wf-hidden')) { skipCount++; return false; }
    if (Date.now() - lastAt < COOLDOWN) { skipCount++; return false; }
    var t = singable(text);
    if (!t) { skipCount++; return false; }
    if (Math.random() > CHANCE) { skipCount++; return false; }
    if (!showBubble(t, BUBBLE_MS)) { skipCount++; return false; }
    lastAt = Date.now();
    lastText = t;
    okCount++;
    wiggle(BUBBLE_MS);
    return true;
  };

  /* 调试/自检用 */
  window.waifuSingInfo = function () {
    return { 唱过: okCount, 跳过: skipCount, 冷却中: Date.now() - lastAt < COOLDOWN, 上次: lastText };
  };

  /* 手动触发一次（自检用，不受冷却与概率限制） */
  window.waifuSingNow = function (text) {
    var t = String(text == null ? '' : text).trim() || '测试一句歌词喵～';
    lastAt = 0;
    var r = showBubble(t, BUBBLE_MS);
    wiggle(BUBBLE_MS);
    return r;
  };
})();
