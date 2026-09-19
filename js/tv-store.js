/* ============================================================
 * 影视页 · 本地数据层 (js/tv-store.js)
 * ------------------------------------------------------------
 * 三件事，全部只存在用户自己的浏览器里（localStorage），
 * 不上传、不联网、没有服务端：
 *
 *   1. 观看进度   每部片、每一集看到第几秒，下次进来自动续播
 *   2. 追剧列表   收藏的片（片名/海报/备注/来源），首页给一块「继续观看」
 *   3. 直链       记住每集的真实地址，详情页「原站打开」直接跳过去
 *
 * 为什么单独一个文件：js/tv.js 已经 900 多行、管着列表/详情/播放器三块，
 * 再往里塞存储逻辑会没法读。这里对外只暴露 window.TVStore 一个对象，
 * 依赖为零（不依赖 TVPlayer / AppShell），方便单独改。
 *
 * 关于容量：localStorage 一般 5MB。海报是以 URL 字符串存的（不是图片本体），
 * 一条记录约 200 字节，存几百部也没问题。但写入时仍然做了上限清理 ——
 * 免得长期使用后把配额写满、抛 QuotaExceededError 把整站搞坏。
 * ============================================================ */
(function () {
  'use strict';

  var K_PROG = 'tv.progress.v1';   /* { [key]: { t, d, at, name, pic, remark, src, ep } } */
  var K_FAV  = 'tv.fav.v1';        /* [ { id, name, pic, remark, src, at } ] */
  var MAX_PROG = 300;              /* 进度最多留 300 条，超出丢最旧的 */
  var MAX_FAV  = 200;

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      /* 存的内容坏了（手改、旧版本格式）就当没有，别让整页崩掉 */
      return fallback;
    }
  }

  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      /* 配额满了：把进度砍掉一半再试一次。
         进度是最不值钱的数据，丢了就丢了；追剧列表是用户主动存的，优先保它。 */
      try {
        if (key === K_PROG) {
          var cut = {};
          Object.keys(val || {}).slice(-Math.floor(MAX_PROG / 2)).forEach(function (k) { cut[k] = val[k]; });
          localStorage.setItem(key, JSON.stringify(cut));
          return true;
        }
      } catch (e2) { /* 还是不行就算了 */ }
      return false;
    }
  }

  /* 一部片 + 一集的唯一键。用 vod_id + 集数名，
     因为同一部片在不同源下 vod_id 可能不同，所以把源也带上。

     ⚠ 取源编号必须兼容三种形态（实测踩过的坑）：
       1. it._src          —— 列表条目自带（网关 tvAggregate 塞进去的）
       2. it.src           —— 追剧列表回读时用的字段名（renderMy 里那个对象）
       3. state 里的当前源 —— 详情接口【条目不返回 _src】，只有外层信封有；
                              调用方必须先用 srcOf() 把信封的 _src 补到条目上。
     以前只认第 1 种，而详情条目恰恰没有 _src，于是进度/追剧的键全都退化成
     "|<id>|<集>"，跨源打开同一部片时会串台。 */
  function srcOf(it) {
    if (!it) return '';
    if (typeof it._src === 'number') return it._src;
    if (typeof it.src === 'number') return it.src;
    return '';
  }
  function epKey(it, epName) {
    var id = String((it && it.vod_id) || '');
    return srcOf(it) + '|' + id + '|' + String(epName || '');
  }
  function vodKey(it) {
    var id = String((it && it.vod_id) || '');
    return srcOf(it) + '|' + id;
  }

  /* ---------------- 观看进度 ---------------- */

  var lastSave = {};

  /* 进度回写。故意做了节流：timeupdate 每 250ms 就来一次，
     每次都写 localStorage 会拖慢主线程（尤其手机上），10 秒存一次足够。 */
  function saveProgress(it, epName, t, d, force) {
    if (!it || !it.vod_id) return;
    /* 节流按【片+集】分别计时，不是全局一个开关。
       以前是单个 lastSave 变量：从 A 片切到 B 片时，如果距上次写盘不足 10 秒，
       B 片开头那几次 timeupdate 全被丢掉；而暂停/切后台的兜底补存也走这个判断，
       于是「刚播十几秒就暂停关页」这一集进度就是丢的。 */
    var k = epKey(it, epName);
    if (!force && Date.now() - (lastSave[k] || 0) < 10000) return;
    var all = read(K_PROG, {});
    /* 快看完了（剩不到 30 秒）就别记进度了，下次从头开始更合理 */
    if (d && t >= d - 30) { delete all[k]; }
    else if (!t || t < 5) { /* 刚开头也不用记：这一格不更新时间戳，
                              下次有意义的进度不会被这次空转挤掉 */ }
    else {
      lastSave[k] = Date.now();
      all[k] = {
        t: Math.floor(t), d: Math.floor(d || 0), at: Date.now(),
        id: String(it.vod_id),
        name: it.vod_name || '', pic: it.vod_pic || '',
        remark: it.vod_remarks || '', src: srcOf(it), ep: epName || '',
      };
    }
    /* 超上限：按时间留最新的 MAX_PROG 条 */
    var keys = Object.keys(all);
    if (keys.length > MAX_PROG) {
      keys.sort(function (a, b) { return (all[a].at || 0) - (all[b].at || 0); });
      var drop = keys.slice(0, keys.length - MAX_PROG);
      drop.forEach(function (x) { delete all[x]; delete lastSave[x]; });
    }
    write(K_PROG, all);
  }

  function getProgress(it, epName) {
    var all = read(K_PROG, {});
    return all[epKey(it, epName)] || null;
  }

  /* 这部片有没有任意一集的进度（详情页用来决定「续播」按钮显不显示） */
  function getVodProgress(it) {
    var all = read(K_PROG, {});
    var vk = vodKey(it) + '|';
    var best = null;
    Object.keys(all).forEach(function (k) {
      if (k.indexOf(vk) !== 0) return;
      var p = all[k];
      if (!best || (p.at || 0) > (best.at || 0)) best = p;
    });
    return best;
  }

  function clearProgress(it, epName) {
    var all = read(K_PROG, {});
    delete all[epKey(it, epName)];
    write(K_PROG, all);
  }

  /* 清空全部观看记录（追剧列表不动 —— 那是用户主动收藏的） */
  function clearAllProgress() { write(K_PROG, {}); }

  /* 最近在看的 N 部（同一部片只留最近的一集），首页「继续观看」用。
     去重键必须和 vodKey 一致（src|id）—— 以前这里用 src|片名，
     和进度/追剧的键规则不是一套：同名不同片会被合并成一条，
     改过名的同一部片又会拆成两条。 */
  function recent(limit) {
    var all = read(K_PROG, {});
    var seen = {}, out = [];
    Object.keys(all).map(function (k) { return all[k]; })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); })
      .forEach(function (p) {
        /* 进度记录里存了 vod_id 才算「一部片」；早期没存 id 的旧记录按名字兜底 */
        var vk = p.id ? (String(p.src == null ? '' : p.src) + '|' + String(p.id))
                      : (String(p.src) + '|name:' + String(p.name));
        if (seen[vk]) return;
        seen[vk] = 1;
        out.push(p);
      });
    return out.slice(0, limit || 12);
  }

  /* ---------------- 追剧列表 ---------------- */

  function favList() { return read(K_FAV, []); }

  function isFav(it) {
    var vk = vodKey(it);
    return favList().some(function (f) { return f.key === vk; });
  }

  /* 返回 true = 现在已收藏，false = 已取消 */
  function toggleFav(it) {
    if (!it || !it.vod_id) return false;
    var list = favList();
    var vk = vodKey(it);
    var i = -1;
    for (var k = 0; k < list.length; k++) { if (list[k].key === vk) { i = k; break; } }
    if (i >= 0) {
      list.splice(i, 1);
      write(K_FAV, list);
      return false;
    }
    list.unshift({
      key: vk,
      id: String(it.vod_id),
      name: it.vod_name || '',
      pic: it.vod_pic || '',
      remark: it.vod_remarks || '',
      src: srcOf(it),
      at: Date.now(),
    });
    if (list.length > MAX_FAV) list.length = MAX_FAV;
    write(K_FAV, list);
    return true;
  }

  function removeFav(key) {
    write(K_FAV, favList().filter(function (f) { return f.key !== key; }));
  }

  /* ---------------- 直链记忆 ----------------
     详情页知道每一集的真实地址，但列表页不知道。
     用户点过「原站打开」之后把地址记下来，收藏列表里就能再打开一次。
     只记最近一小批，避免无限增长。 */
  var K_URL = 'tv.url.v1';
  var MAX_URL = 120;

  function saveUrl(it, epName, url) {
    if (!it || !it.vod_id || !url) return;
    var all = read(K_URL, {});
    all[epKey(it, epName)] = { u: String(url), at: Date.now() };
    var keys = Object.keys(all);
    if (keys.length > MAX_URL) {
      keys.sort(function (a, b) { return (all[a].at || 0) - (all[b].at || 0); });
      keys.slice(0, keys.length - MAX_URL).forEach(function (x) { delete all[x]; });
    }
    write(K_URL, all);
  }

  function getUrl(it, epName) {
    var all = read(K_URL, {});
    var hit = all[epKey(it, epName)];
    return hit ? hit.u : '';
  }

  window.TVStore = {
    saveProgress: saveProgress,
    getProgress: getProgress,
    getVodProgress: getVodProgress,
    clearProgress: clearProgress,
    clearAllProgress: clearAllProgress,
    recent: recent,
    favList: favList,
    isFav: isFav,
    toggleFav: toggleFav,
    removeFav: removeFav,
    saveUrl: saveUrl,
    getUrl: getUrl,
    /* 存键规则对外暴露一份，方便调试和以后改格式。
       srcOf 也暴露出去：详情接口的条目没有 _src，只有外层信封有，
       调用方（tv.js 的 detail/openPlayer）要用它把真实源编号补回条目上。 */
    _keys: { epKey: epKey, vodKey: vodKey, srcOf: srcOf },
  };
})();
