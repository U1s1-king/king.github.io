/* ===== 粒子背景配置 ===== */
(function () {
  var isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  /* 让 body 背景透明，渐变移至伪元素，这样粒子 canvas 能显示在背景之上 */
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  if (!document.getElementById('particles-bg-layer')) {
    var bg = document.createElement('div');
    bg.id = 'particles-bg-layer';
    bg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;background:linear-gradient(145deg,#fff9f7 0%,#ffeef4 100%);pointer-events:none;';
    document.body.prepend(bg);
  }

  /* 粒子容器 — z-index:0 在背景之上，pointer-events:none 不阻挡页面交互 */
  var container = document.createElement('div');
  container.id = 'particles-js';
  container.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  document.body.prepend(container);

  function init() {
    if (typeof particlesJS === 'undefined') return;
    particlesJS('particles-js', {
      particles: {
        number: {
          value: isMobile ? 45 : 90,
          density: { enable: true, value_area: 600 }
        },
        color: { value: ['#ff6b8a', '#ff8fab', '#ff4d7a', '#ff3366', '#ff7096'] },
        shape: { type: 'circle' },
        opacity: {
          value: 0.55,
          random: true,
          anim: { enable: true, speed: 0.3, opacity_min: 0.25, sync: false }
        },
        size: {
          value: isMobile ? 1.8 : 2.2,
          random: true,
          anim: { enable: true, speed: 1, size_min: 1.2, sync: false }
        },
        line_linked: {
          enable: false,
          distance: isMobile ? 100 : 150,
          color: '#ff4d7a',
          opacity: 0.45,
          width: 1.2
        },
        move: {
          enable: true,
          speed: 1,
          direction: 'none',
          random: true,
          straight: false,
          out_mode: 'out',
          bounce: false
        }
      },
      interactivity: {
        detect_on: 'window',
        events: {
          onhover: { enable: true, mode: 'grab' },
          onclick: { enable: false },
          resize: true
        },
        modes: {
          grab: {
            distance: isMobile ? 100 : 160,
            line_linked: { opacity: 0.6 }
          }
        }
      },
      retina_detect: true
    });
  }

  if (typeof particlesJS === 'undefined') {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js';
    s.onload = init;
    s.onerror = function () {};
    document.head.appendChild(s);
  } else {
    init();
  }
})();
