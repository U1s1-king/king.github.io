/* ============================================================
 * 内联 SVG 图标 (js/svg-icon.js)
 * ------------------------------------------------------------
 * 站点的 css/all.min.css 是「图标字体子集」：实测三页用到的 79 个图标没有字形
 * —— 影视分类的 电影/电视剧/动漫、游戏分类大半、工具页一批卡片，页面上就是一片空白
 * （同一排里只有 ★ </> A 🌐 ❤ 能画出来，看着更乱）。
 * 这里手写一套 24×24 的线性 SVG 顶上去：加载后自动把 <i class="fas fa-xxx"> 换成
 * 同色同尺寸的内联 SVG（currentColor + 1em，跟着原有字号和颜色走，不挑页面）。
 * 动态渲染出来的（工具卡、影视分类都是 JS 拼的）由 MutationObserver 补上。
 * ============================================================ */
(function () {
    'use strict';
    /* 全部用描边线性风格，和站点的粉色细线一致；每条路径都只写 24×24 视口内的几何。 */
    var P = {
        'fa-film': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14M3 9.2h4.5M3 14.8h4.5M16.5 9.2H21M16.5 14.8H21"/>',
        'fa-tv': '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M8.5 3.5L12 7.5l3.5-4M9 16.5h6"/>',
        'fa-dragon': '<path d="M4.5 9.5L4 4.5l4.5 2.5h7L20 4.5l-.5 5v4a7 7 0 01-14 0z"/><path d="M9.2 12.3h.01M14.8 12.3h.01M11 15.4c.7.7 1.3.7 2 0"/>',
        'fa-cat': '<path d="M5 9.5L4 4.5l4.5 2.5h7L20 4.5l-1 5v3.5a7 7 0 01-14 0z"/><path d="M9.2 12h.01M14.8 12h.01M11 15c.7.7 1.3.7 2 0"/>',
        'fa-star': '<path d="M12 3.6l2.7 5.5 6 .9-4.4 4.2 1 5.9L12 17.3l-5.3 2.8 1-5.9L3.3 10l6-.9z"/>',
        'fa-book': '<path d="M4 6a2 2 0 012-2h5v16H6a2 2 0 01-2-2z"/><path d="M20 6a2 2 0 00-2-2h-5v16h5a2 2 0 002-2z"/>',
        'fa-book-open': '<path d="M12 7C10 5.5 7.5 5 4.5 5.5V19c3-.5 5.5 0 7.5 1.5 2-1.5 4.5-2 7.5-1.5V5.5C16.5 5 14 5.5 12 7z"/><path d="M12 7v13.5"/>',
        'fa-bolt': '<path d="M13 2.5L5.5 13H10l-1 8.5L18 11h-4.5z"/>',
        'fa-futbol': '<circle cx="12" cy="12" r="9"/><path d="M12 7.4l3.6 2.6-1.4 4.2H9.8L8.4 10z"/><path d="M12 3v4.4M4.2 9.6l4.2.4M19.8 9.6l-4.2.4M6.6 19.4l3.2-5.2M17.4 19.4l-3.2-5.2"/>',
        'fa-clapperboard': '<path d="M3 9.5h18V19a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19z"/><path d="M3 9.5l1.8-4.4h4.7L7.7 9.5M11.2 9.5l1.8-4.4h4.7l-1.8 4.4"/>',
        'fa-border-all': '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M12 3.5v17M3.5 12h17"/>',
        'fa-layer-group': '<path d="M12 3.2l9 4.8-9 4.8-9-4.8z"/><path d="M4 13l8 4.3 8-4.3"/>',
        'fa-tower-broadcast': '<path d="M12 10.5L6 21M12 10.5L18 21M9 16.5h6"/><circle cx="12" cy="8" r="2.6"/><path d="M7.6 4.4a6 6 0 018.8 0"/>',
        'fa-magnifying-glass': '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L20.5 20.5"/>',
        'fa-search': '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L20.5 20.5"/>',
        'fa-chevron-left': '<path d="M15 4.5L7.5 12l7.5 7.5"/>',
        'fa-chevron-right': '<path d="M9 4.5L16.5 12 9 19.5"/>',
        /* 音乐页全屏播放页顶栏用到的两个。它们不在图标字体子集里 ——
           CSS 里 .fa-chevron-down:before / .fa-align-left:before 的 content
           是有的，但字体文件没有那个码位，页面上就是两个空白圆。
           实测：.fs-collapse（收起）与 .fs-lyric（切歌词）都是空白，
           .fs-more（fa-ellipsis-h 已在本表里）反而正常。 */
        'fa-chevron-down': '<path d="M5 9l7 7 7-7"/>',
        'fa-align-left': '<path d="M4 6.5h16M4 12h10M4 17.5h13"/>',
        'fa-chevron-up': '<path d="M5 15l7-7 7 7"/>',
        'fa-arrow-left': '<path d="M20.5 12H4M11 5L4 12l7 7"/>',
        'fa-arrow-up-right-from-square': '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5A2.5 2.5 0 0115.5 21h-9A2.5 2.5 0 014 18.5v-9A2.5 2.5 0 016.5 7H11"/>',
        'fa-calculator': '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M8 6.5h8"/><path d="M8.6 11h.01M12 11h.01M15.4 11h.01M8.6 15h.01M12 15h.01M15.4 15h.01M8.6 18.4h.01M12 18.4h.01M15.4 18.4h.01"/>',
        'fa-link': '<path d="M10.2 13.6a3.6 3.6 0 005.1 0l3.1-3.1a3.6 3.6 0 10-5.1-5.1L12 6.7"/><path d="M13.8 10.4a3.6 3.6 0 00-5.1 0l-3.1 3.1a3.6 3.6 0 105.1 5.1l1.3-1.3"/>',
        'fa-image': '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="M4 17.5l4.6-4.6 4 4 3-3L20 17.5"/>',
        'fa-images': '<rect x="3" y="6.5" width="14" height="12" rx="2.5"/><path d="M7 6.5V5a2 2 0 012-2h9.5a2 2 0 012 2v9a2 2 0 01-2 2h-1.5"/>',
        'fa-globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/>',
        'fa-heart': '<path d="M12 20.3s-7.2-4.5-7.2-9.7A4.6 4.6 0 0112 7.2a4.6 4.6 0 017.2 3.4c0 5.2-7.2 9.7-7.2 9.7z"/>',
        'fa-shield-alt': '<path d="M12 3l7 2.6v6.1c0 5-3.5 8-7 9.3-3.5-1.3-7-4.3-7-9.3V5.6z"/><path d="M9 12l2.2 2.2L15 10.5"/>',
        'fa-dice': '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8.4 8.4h.01M15.6 8.4h.01M12 12h.01M8.4 15.6h.01M15.6 15.6h.01"/>',
        'fa-puzzle-piece': '<path d="M10.3 4.6a1.9 1.9 0 013.4 1.3v1.6h3a1 1 0 011 1v3h-1.6a1.9 1.9 0 100 3.4h1.6v3a1 1 0 01-1 1h-3v-1.6a1.9 1.9 0 10-3.4 0V19h-3a1 1 0 01-1-1v-3h1.6a1.9 1.9 0 100-3.4H6v-3a1 1 0 011-1h3.3z"/>',
        'fa-crown': '<path d="M4 17.5L3 7l5.2 3.6L12 4.5l3.8 6.1L21 7l-1 10.5z"/><path d="M4.6 20.5h14.8"/>',
        'fa-chess': '<path d="M12 4a2.6 2.6 0 00-1.4 4.8C9.6 9.8 9 11.1 9 12.6h6c0-1.5-.6-2.8-1.6-3.8A2.6 2.6 0 0012 4z"/><path d="M8.4 18.5h7.2M9.5 12.6l-1.1 5.9h7.2l-1.1-5.9"/>',
        'fa-chess-board': '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
        'fa-brain': '<path d="M9.5 3.5A4 4 0 006 7.2a3 3 0 00-.6 5.8v2.5a3 3 0 003 3h1v1.5h5.2v-1.5h.9a3 3 0 003-3v-2.5a3 3 0 00-.6-5.8 4 4 0 00-3.5-3.7z"/><path d="M12 3.5v15.5"/>',
        'fa-keyboard': '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.4 9.6h.01M9.5 9.6h.01M12.6 9.6h.01M15.7 9.6h.01M18.4 9.6h.01M8.2 13.4h7.6"/>',
        'fa-smile': '<circle cx="12" cy="12" r="9"/><path d="M8.4 14.2c1 1.6 2.4 2.4 3.6 2.4s2.6-.8 3.6-2.4"/><path d="M9.2 9.6h.01M14.8 9.6h.01"/>',
        'fa-th': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
        'fa-table-cells': '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
        'fa-route': '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="6" r="2.6"/><path d="M8.6 18h4.9a3.5 3.5 0 003.5-3.5V8.6"/>',
        'fa-bomb': '<circle cx="11" cy="14.5" r="6"/><path d="M15.6 10.2l2-2M18.6 5.2l1 1M19.8 9.2l1.4-1.4"/>',
        'fa-compass': '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
        'fa-cube': '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
        'fa-road': '<path d="M7 3L4 21M17 3l3 18M12 5v3M12 11v3M12 17v3"/>',
        'fa-dove': '<path d="M4 14.5c5 0 8-3 8-8.5 3.4 1 5.5 3.4 5.5 6.5l3.2-1-2.2 3.4c0 3.6-3 5.6-7 5.6H5z"/><path d="M9 13.5h.01"/>',
        'fa-lemon': '<ellipse cx="12" cy="12" rx="6" ry="8.2" transform="rotate(38 12 12)"/><path d="M6.6 17.4L17.4 6.6"/>',
        'fa-bug': '<ellipse cx="12" cy="13" rx="5" ry="6"/><path d="M12 7V3.5M7.2 9.4L4.4 7M16.8 9.4L19.6 7M6.6 13.5H3M17.4 13.5H21M8 18.4l-2.4 2.4M16 18.4l2.4 2.4"/>',
        'fa-table-tennis-paddle-ball': '<circle cx="8.5" cy="8.5" r="5.2"/><path d="M12.2 12.2L19.5 19.5"/><circle cx="17.8" cy="17.8" r="2.3"/>',
        'fa-shapes': '<circle cx="7" cy="7" r="4"/><rect x="13" y="3" width="8" height="8" rx="1.6"/><path d="M7 13.5l4.2 7.5H2.8z"/>',
        'fa-hammer': '<path d="M13.6 3.8l6.6 6.6-3 3-6.6-6.6z"/><path d="M11.5 9.8L3.6 17.7l2.7 2.7 7.9-7.9"/>',
        'fa-circle': '<circle cx="12" cy="12" r="8.6"/>',
        'fa-candy-cane': '<path d="M9 21V9.5a4.2 4.2 0 018.4 0v3"/><path d="M9 13.5h8.4M9 17.5h8.4"/>',
        'fa-person-running': '<circle cx="15" cy="4.6" r="2"/><path d="M13.2 8.2L10 12.2l3 2.2-1.2 6.4M13.2 12.2l4.2 3 1.8 5.2M10 12.2l-4.2 1.2"/>',
        'fa-ghost': '<path d="M5 20.5V11a7 7 0 0114 0v9.5l-2.3-2-2.4 2-2.3-2-2.3 2z"/><path d="M9.6 10.4h.01M14.4 10.4h.01"/>',
        'fa-worm': '<path d="M3.5 16.5c2 0 2-4.5 4-4.5s2 4.5 4 4.5 2-4.5 4-4.5 2 4.5 4 4.5"/><circle cx="18.8" cy="9.6" r="2.6"/><path d="M19.4 7.2V4.8"/>',
        'fa-space-shuttle': '<path d="M12 2.5c3 3.2 4.2 7 4.2 11.2H7.8C7.8 9.5 9 5.7 12 2.5z"/><path d="M7.8 13.7l-3.3 4.3h15l-3.3-4.3M12 13.7V21"/>',
        'fa-square': '<rect x="4" y="4" width="16" height="16" rx="2.5"/>',
        'fa-circle-dot': '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.4"/>',
        'fa-circle-notch': '<path d="M12 3.4a8.6 8.6 0 108.6 8.6"/>',
        'fa-hand-scissors': '<path d="M6.2 9.8V6.4a1.6 1.6 0 013.2 0v4.6M9.4 11V5.4a1.6 1.6 0 013.2 0v5.6M12.6 11V6.6a1.6 1.6 0 013.2 0V13c0 4.4-2.6 7.6-6.2 7.6s-6.2-3.2-6.2-7.6v-1.4l2.8 2.2"/>',
        'fa-clone': '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 5.5A2.5 2.5 0 0013 3H5.5A2.5 2.5 0 003 5.5V13a2.5 2.5 0 002.5 2.5"/>',
        'fa-question-circle': '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 114.2 1.9c-.9.8-1.6 1.3-1.6 2.5"/><path d="M12 17.4h.01"/>',
        'fa-microphone': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6"/>',
        'fa-fingerprint': '<path d="M12 3a9 9 0 00-9 9M21 12A9 9 0 0016.6 4.3M12 7.2A4.8 4.8 0 007.2 12v3.2M16.8 12A4.8 4.8 0 0012 7.2M9.2 17.6c1.6 1.6 4.6 2 6.2.4"/>',
        'fa-ellipsis-h': '<circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/>',
        'fa-chart-bar': '<path d="M4 20.5V10M10 20.5V3.5M16 20.5v-6.6M20.5 20.5H3.5"/>',
        'fa-chart-line': '<path d="M4 20.5V4M4 20.5h16.5"/><path d="M7 15.5l3.6-4.2 3 3L20.5 7"/>',
        'fa-text-height': '<path d="M4 7V5h10v2M9 5v14M6.6 19h4.8M15 10V9h5.5v1M17.7 9v10M16 19h3.4"/>',
        'fa-sort-alpha-down': '<path d="M4 6h7M4 12h5M4 18h3M15 4.5v15M12 16.5l3 3 3-3"/>',
        'fa-user': '<circle cx="12" cy="8" r="4"/><path d="M4.6 21c1-4 3.6-6 7.4-6s6.4 2 7.4 6"/>',
        'fa-ruler': '<rect x="2.5" y="8" width="19" height="8" rx="1.8"/><path d="M7 8v3M11 8v3M15 8v3M19 8v3"/>',
        'fa-divide': '<circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="17" r="1.6"/><path d="M5 12h14"/>',
        'fa-eye-dropper': '<path d="M14.8 3.2l6 6-2.2 2.2-6-6z"/><path d="M13 5L4.2 13.8V19h5.2L18.2 10"/>',
        'fa-weight': '<circle cx="12" cy="6.2" r="3"/><path d="M9 9.2h6l3.4 11.6H5.6z"/>',
        'fa-tags': '<path d="M11 3.2H4v7l9.2 9.2 7-7z"/><circle cx="7.4" cy="6.6" r="1.6"/>',
        'fa-money-bill-wave': '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="3"/>',
        'fa-ticket-alt': '<path d="M3 8.5A2.5 2.5 0 015.5 6h13A2.5 2.5 0 0121 8.5v1.8a2.2 2.2 0 000 3.4v1.8A2.5 2.5 0 0118.5 18h-13A2.5 2.5 0 013 15.5v-1.8a2.2 2.2 0 000-3.4z"/><path d="M14 6v12"/>',
        'fa-compress': '<path d="M9 3.5v5.5H3.5M15 20.5V15h5.5M3.5 15H9v5.5M20.5 9H15V3.5"/>',
        'fa-crop-simple': '<path d="M6.5 3v15.5H22M2 6.5h15.5V22"/>',
        'fa-robot': '<rect x="4" y="8" width="16" height="11.5" rx="3.5"/><path d="M12 4v4M9.2 13h.01M14.8 13h.01M9.6 16.6h4.8M1.8 12v3.5M22.2 12v3.5"/>',
        'fa-cake-candles': '<path d="M4 20.5h16v-6a3 3 0 00-3-3H7a3 3 0 00-3 3z"/><path d="M8 11.5V7.5M12 11.5V7.5M16 11.5V7.5M8 5.6c0-1 1.1-1 1.1-2.1M12 5.6c0-1 1.1-1 1.1-2.1M16 5.6c0-1 1.1-1 1.1-2.1"/>',
        'fa-fire': '<path d="M12 21.5c4 0 6.2-2.6 6.2-6.2 0-4.2-3.1-6.3-4.1-9.4-2.1 2.1-3.1 4.2-3.1 6.3-1-1-1.9-2.1-1.9-3.2-1 2.1-3.3 4.2-3.3 7.3 0 3.2 2.2 5.2 6.2 5.2z"/>',
        'fa-file-invoice-dollar': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 9.5v7.5M10 11.5h4M10 15h4"/>',
        'fa-share-nodes': '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.7l7.4-4.3M8.3 13.3l7.4 4.3"/>',
        'fa-gamepad': '<path d="M7 8h10a5 5 0 015 5v1.2a3.1 3.1 0 01-5.4 2.1L15.4 15h-6.8l-1.2 1.3A3.1 3.1 0 012 14.2V13a5 5 0 015-5z"/><path d="M7 10.8v2.4M5.8 12h2.4M15.6 11.6h.01M17.6 13.2h.01"/>',
        'fa-toolbox': '<rect x="3" y="8" width="18" height="11.5" rx="2.5"/><path d="M9 8V6.2a2.2 2.2 0 012.2-2.2h1.6A2.2 2.2 0 0115 6.2V8M3 13.2h18"/>',
        'fa-music': '<path d="M9 18V6l10-2v12"/><circle cx="6.4" cy="18" r="2.6"/><circle cx="16.4" cy="16" r="2.6"/>',
        'fa-magic': '<path d="M4.5 19.5L16.5 7.5"/><path d="M14 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1L11 6.5l2.1-.9zM19 11.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>',
        'fa-spa': '<circle cx="12" cy="6.6" r="3"/><circle cx="6.8" cy="10.6" r="3"/><circle cx="17.2" cy="10.6" r="3"/><circle cx="9" cy="17" r="3"/><circle cx="15" cy="17" r="3"/>',
        'fa-fan': '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8c0-4 1.5-6.3 3.4-6.3 1.6 0 2.6 1.4 2.6 3.2 0 2.2-2 4-6 3.1zM14.2 12c4 0 6.3 1.5 6.3 3.4 0 1.6-1.4 2.6-3.2 2.6-2.2 0-4-2-3.1-6zM12 14.2c0 4-1.5 6.3-3.4 6.3-1.6 0-2.6-1.4-2.6-3.2 0-2.2 2-4 6-3.1zM9.8 12c-4 0-6.3-1.5-6.3-3.4C3.5 7 4.9 6 6.7 6c2.2 0 4 2 3.1 6z"/>',
        'fa-stopwatch': '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2.2 1.6M9.6 3.2h4.8M12 3.2v3.3M18.4 8l1.4-1.4"/>',
        'fa-key': '<circle cx="8" cy="14" r="4"/><path d="M11 11l8.5-8.5M16 6l2.2 2.2M18.4 3.6l2 2"/>',
        'fa-lock': '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 018 0V10M12 14v3"/>',
        'fa-shield': '<path d="M12 3l7 2.6v6.1c0 5-3.5 8-7 9.3-3.5-1.3-7-4.3-7-9.3V5.6z"/>',
        'fa-asterisk': '<path d="M12 4v16M5 8l14 8M19 8L5 16"/>',
        'fa-hashtag': '<path d="M9 3.5L7 20.5M17 3.5l-2 17M4 9h16M3 15h16"/>',
        'fa-clock': '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.4 2.4"/>',
        'fa-code': '<path d="M9 7.5L4 12l5 4.5M15 7.5L20 12l-5 4.5"/>',
        'fa-font': '<path d="M4 19.5L11 4l7 15.5M6.6 14h8.8"/>',
        'fa-envelope': '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
        'fa-info-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
        'fab fa-bilibili': '<rect x="3" y="7" width="18" height="12.5" rx="4"/><path d="M8 3.5l3 3.5M16 3.5l-3 3.5M9.6 12h.01M14.4 12h.01"/>',
        'fab fa-youtube': '<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10.4 9.6l4.8 2.4-4.8 2.4z"/>',
        'fab fa-twitter': '<path d="M20.5 6.4c-.8.4-1.6.6-2.5.7a4 4 0 001.9-2.2c-.9.5-1.9.9-2.9 1.1a4.3 4.3 0 00-7.4 3.9A12 12 0 013 5.3a4.3 4.3 0 001.3 5.7c-.7 0-1.4-.2-2-.5a4.3 4.3 0 003.4 4.2c-.6.2-1.3.3-2 .1a4.3 4.3 0 004 3A12 12 0 012.5 19.6 12 12 0 0019 8.4c.9-.6 1.6-1.4 2-2z"/>',
        'fab fa-instagram': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01"/>',
        'fab fa-github': '<path d="M9 20.5v-3c0-1 .4-1.8 1-2.2-2.6-.3-4.3-1.5-4.3-4.2 0-1 .3-1.9 1-2.6-.2-.6-.2-1.4.1-2.1 0 0 1 .1 2.1 1.1a7.4 7.4 0 013.8 0c1.1-1 2.1-1.1 2.1-1.1.3.7.3 1.5.1 2.1.7.7 1 1.6 1 2.6 0 2.7-1.7 3.9-4.3 4.2.6.4 1 1.2 1 2.2v3"/>',
        'fa-fire-alt': '<path d="M12 21.5c4 0 6.2-2.6 6.2-6.2 0-4.2-3.1-6.3-4.1-9.4-2.1 2.1-3.1 4.2-3.1 6.3-1-1-1.9-2.1-1.9-3.2-1 2.1-3.3 4.2-3.3 7.3 0 3.2 2.2 5.2 6.2 5.2z"/>'
    };

    /* 线性描边的统一风格；尺寸用 1em 跟着原有的字号走，颜色用 currentColor 跟着文字色走 */
    var CSS = '.svgico{width:1em;height:1em;display:inline-block;vertical-align:-.135em;'
        + 'fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;'
        + 'overflow:visible;flex:0 0 auto}';

    function styleOnce() {
        if (document.getElementById('svgico-style')) return;
        var s = document.createElement('style');
        s.id = 'svgico-style';
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
    }

    var CACHE = {};
    function make(name) {
        if (CACHE[name]) return CACHE[name].cloneNode(true);
        var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        el.setAttribute('viewBox', '0 0 24 24');
        el.setAttribute('class', 'svgico');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('focusable', 'false');
        el.innerHTML = P[name] || '';
        CACHE[name] = el;
        return el.cloneNode(true);
    }

    /* 把一棵子树里的 <i class="fas fa-xxx"> 换成 SVG；没有对应画法的原样留着 */
    function swap(root) {
        if (!root || !root.querySelectorAll) return 0;
        var list = root.querySelectorAll('i[class*="fa-"]');
        var n = 0;
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            var cls = String(it.className || '').split(/\s+/);
            var hit = '';
            for (var k = 0; k < cls.length; k++) {
                if (P[cls[k]]) { hit = cls[k]; break; }
                /* fab fa-x 这种两个 class 拼出来的名字 */
                if (cls[k] === 'fab' || cls[k] === 'fas' || cls[k] === 'far') {
                    for (var m = 0; m < cls.length; m++) {
                        var combo = cls[k] + ' ' + cls[m];
                        if (P[combo]) { hit = combo; break; }
                    }
                    if (hit) break;
                }
            }
            if (!hit) continue;
            var svg = make(hit);
            if (it.parentNode) { it.parentNode.replaceChild(svg, it); n++; }
        }
        return n;
    }

    function boot() {
        styleOnce();
        swap(document);
        /* 工具卡/影视分类/游戏分类都是 JS 拼出来的，动态加的也要补上 */
        try {
            var ob = new MutationObserver(function (muts) {
                for (var i = 0; i < muts.length; i++) {
                    var added = muts[i].addedNodes;
                    for (var k = 0; k < added.length; k++) {
                        var node = added[k];
                        if (node.nodeType === 1) swap(node.parentNode || node);
                    }
                }
            });
            ob.observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) {}
    }

    window.SVGIcon = { swap: swap, has: function (n) { return !!P[n] }, names: Object.keys(P) };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
