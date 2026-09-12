/* ============================================================
 * 音乐页动效（music.html 专用）
 * ------------------------------------------------------------
 * 只做三件事，都是纯观感，不参与任何播放逻辑：
 *   1. 给 body 挂 mc-playing —— CSS 靠它决定要不要显示
 *      播放按钮光环、进度条流光
 *   2. 曲名/封面变化时重播一次入场动画
 *   3. 按钮按下时的轻微缩放反馈
 * 单独成文件是为了不去动 500 多 KB 的 music-bundle.js。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__MUSIC_FX__) return;
  window.__MUSIC_FX__ = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---------- 1. 播放态 ---------- */
    var audio = document.getElementById('nativeAudio');
    if (audio) {
      var sync = function () {
        document.body.classList.toggle('mc-playing', !audio.paused && !audio.ended);
      };
      ['play', 'pause', 'ended', 'loadedmetadata'].forEach(function (ev) {
        audio.addEventListener(ev, sync);
      });
      sync();
    }

    /* ---------- 2. 曲名 / 封面变化时重播动画 ---------- */
    /* 去掉类 → 强制重排 → 加回类，动画才会重新播一遍；
       只 remove/add 而不触发重排的话，浏览器会认为是同一次动画，不会重播。 */
    function replay(el, cls, ms) {
      if (!el || reduce) return;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      clearTimeout(el['_fx' + cls]);
      el['_fx' + cls] = setTimeout(function () { el.classList.remove(cls); }, ms || 900);
    }

    if ('MutationObserver' in window) {
      var name = document.getElementById('trackName');
      if (name) {
        new MutationObserver(function () { replay(name, 'mc-title-in', 700); })
          .observe(name, { childList: true, characterData: true, subtree: true });
      }
      var cover = document.getElementById('coverImg');
      if (cover) {
        new MutationObserver(function () { replay(cover, 'mc-cover-in', 800); })
          .observe(cover, { attributes: true, attributeFilter: ['src'] });
      }
    }

    /* ---------- 3. 按钮按下反馈 ---------- */
    if (!reduce) {
      document.addEventListener('pointerdown', function (e) {
        var t = e.target;
        var b = t && t.closest ? t.closest('.btn-cherry,.ctrl-btn,.mode-chip,.glass-icon') : null;
        if (!b) return;
        b.classList.remove('mc-ripple');
        void b.offsetWidth;
        b.classList.add('mc-ripple');
        clearTimeout(b._fxRipple);
        b._fxRipple = setTimeout(function () { b.classList.remove('mc-ripple'); }, 520);
      }, true);
    }
  });
})();
