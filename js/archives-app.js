/* ============================================================
 * 归档页 App 化 (archives-app.js) —— 仅手机端
 * ------------------------------------------------------------
 * 三类卡片各自成立：
 *   · 视频卡（.video-wrapper > B站 iframe）→ 搬移，接续播放不重置
 *   · 音乐卡（.media-player > audio）      → 搬移，保住播放进度
 *   · 外链卡 / GitHub 仓库卡（只有 .card-info）→ 克隆即可
 * 入口不去劫持整张卡片的点击：视频卡里本来就有播放按钮，
 * 整卡可点必然打架。改为每张卡右下角一个明确的「详情」按钮。
 * GitHub 仓库卡是 fetch 之后才插进来的，所以用 MutationObserver 补按钮。
 * 桌面端不装饰、不拦截。
 * ============================================================ */
(function () {
  'use strict';

  function narrow() { return window.innerWidth <= 768; }

  function decorate(card) {
    if (card.getAttribute('data-mc-ready')) return;
    card.setAttribute('data-mc-ready', '1');
    var row = document.createElement('div');
    row.className = 'mc-detail-row';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-detail';
    btn.innerHTML = '<i class="fas fa-circle-info"></i> 详情';
    row.appendChild(btn);
    card.appendChild(row);
  }

  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll('.media-card'), decorate);
  }

  function appendBiliLink(box, url) {
    if (!url) return;
    var a = document.createElement('a');
    a.className = 'mcd-open';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = '<i class="fas fa-up-right-from-square"></i> 在 B 站打开';
    box.appendChild(a);
  }

  function openCard(card) {
    if (!narrow()) return;
    if (!window.AppShell || !window.AppShell.openDetail) return;
    if (window.AppShell.detailOpen()) return;

    var info = card.querySelector('.card-info');
    var video = card.querySelector('.video-wrapper');
    var audio = card.querySelector('.media-player');

    var wrap = document.createElement('div');
    wrap.className = 'mc-detail-wrap';
    var mediaBox = document.createElement('div');
    mediaBox.className = 'mcd-media';
    var infoBox = document.createElement('div');
    infoBox.className = 'mcd-info';
    wrap.appendChild(mediaBox);
    wrap.appendChild(infoBox);
    if (info) infoBox.innerHTML = info.innerHTML;

    var titleEl = info ? info.querySelector('.card-title') : null;
    var title = (titleEl ? titleEl.textContent : '').replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim() || '详情';

    window.AppShell.openDetail({ title: title, content: wrap });

    if (video) {
      window.AppShell.adopt(video, mediaBox);
      var frame = video.querySelector('iframe');
      var src = frame ? frame.getAttribute('src') || '' : '';
      var bv = /bvid=([A-Za-z0-9]+)/.exec(src);
      appendBiliLink(infoBox, bv ? 'https://www.bilibili.com/video/' + bv[1] : '');
    } else if (audio) {
      window.AppShell.adopt(audio, mediaBox);
    } else if (mediaBox.parentNode) {
      mediaBox.parentNode.removeChild(mediaBox);   /* 纯信息卡没有媒体区 */
    }
  }

  function init() {
    if (!narrow()) return;
    scan();

    /* GitHub 仓库卡片异步插入，300ms 去抖后再补按钮 */
    var timer = null;
    function schedule() {
      if (timer) return;
      timer = setTimeout(function () { timer = null; scan(); }, 300);
    }
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('.mc-detail')) return;
      var card = t.closest('.media-card');
      if (card) openCard(card);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  /* 视口从网页端切回手机端：把手机端的注入重新长回来。
     桌面端的残留由 AppShell 统一拆（见 app-shell.js 的 clearNarrowOnly）。 */
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) { if (isNarrow) init(); });
  }
})();
