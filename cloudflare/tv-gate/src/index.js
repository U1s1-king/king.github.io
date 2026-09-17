/**
 * tv-gate —— 影视页门卫（独立 Cloudflare Worker）
 * ============================================================
 * 一个 Worker 同时干两件事：
 *
 *   1. 页面锁：拦在 zhaokening.ccwu.cc/TV* 前面。
 *      没登录 → 返回自带的登录页；已登录 → 透传给 GitHub Pages。
 *
 *   2. 数据锁：拦在 zhaokening.ccwu.cc/api/tv* 前面。
 *      验 cookie，通过后带上内部头 X-Gate-Secret 转发给
 *      sakura-music-api.pages.dev。上游 Worker 只认带这个头的请求，
 *      于是「公开的 pages.dev 直连」作废，数据必须走这道门。
 *
 * 为什么两道锁缺一不可：
 *   只锁页面挡不住 curl —— 数据在 pages.dev，那不是我们的 zone，挂不了路由；
 *   只锁数据则页面骨架公开。两道一起才闭环。
 *
 * 为什么坚持同源：
 *   cookie 才能是 HttpOnly（JS/XSS 都偷不走），而且完全没有 CORS 这一层。
 *
 * 失败策略（按用户要求）：门卫自己出错时【不放行】，返回 503 提示页，
 * 绝不把页面或数据漏出去。
 *
 * ── 环境变量 / 绑定（都走 Worker Secret，绝不入库）──
 *   TV_GATE_KEY    你输入的那串口令
 *   TV_GATE_SECRET 与 sakura-music-api 共享的内部头密钥（随机串）
 *   UPSTREAM       可选，默认 https://sakura-music-api.pages.dev
 *   KING_KV        KV 绑定，用于输错限速
 * ============================================================
 */

const COOKIE_NAME = 'tv_pass';
const TOKEN_VERSION = 'v1';

/* cookie 本身是 session cookie（关浏览器即失效），但浏览器会「恢复会话」——
   Chrome 开了「继续浏览上次打开的网页」时，会把 session cookie 一并恢复，
   于是重启浏览器后仍然免密。服务端分辨不出「同一个浏览会话」和「被恢复的会话」，
   唯一兜得住的就是把时间上限压短：页面开着时由 js/tv.js 定时心跳续期，
   页面一关心跳就停，2 小时后必然要重新输口令。 */
const SESSION_MAX_AGE = 2 * 60 * 60;

/* 限速：10 分钟窗口内错 5 次 → 锁 1 小时。
   关键：按【浏览器】分桶，不按 IP —— 一个出口 IP 后面可能站着很多人
   （公司、学校、手机运营商 CGNAT），按 IP 一刀切会让一个人输错
   就把同 IP 的其他人一起关在门外。 */
const FAIL_WINDOW = 10 * 60;
const FAIL_LIMIT = 5;
const LOCK_TIME = 60 * 60;

/* 同 IP 兜底桶：只有「每次故意丢 cookie 硬刷」才会撞到。
   门槛设得很高、锁得很短，正常用户（哪怕几百人共用一个出口 IP）碰不到。 */
const IP_FAIL_LIMIT = 30;
const IP_LOCK_TIME = 10 * 60;

/* 每台浏览器一个随机设备号，用来把限速分到具体的人头上 */
const DEVICE_COOKIE = 'tv_did';

const DEFAULT_UPSTREAM = 'https://sakura-music-api.pages.dev';

/* 转发时不能带过去的头（逐跳头 + 会让上游误判跨域的头 + 我们的 cookie） */
const STRIP_REQ_HEADERS = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
  'host', 'cookie', 'origin', 'referer',
  'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'cf-ew-via',
  'x-forwarded-proto', 'x-real-ip', 'x-gate-secret',
];

/* 回包时不能原样带回去的头 */
const STRIP_RES_HEADERS = [
  'set-cookie', 'content-encoding', 'content-length',
  'transfer-encoding', 'connection',
];

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      /* fail-closed：门卫坏了宁可锁死，也不放行 */
      return htmlPage(errorPage(err), 503, { 'Cache-Control': 'no-store' });
    }
  },
};

/* ============================================================ 路由 */

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  /* 登录接口自己处理 */
  if (path === '/api/tv/auth') {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: '只接受 POST' }, 405);
    }
    return handleAuth(request, env);
  }

  /* 心跳续期：页面开着时由 js/tv.js 定时调用，把会话往后推。
     必须放在下面那个「转发给上游」的分支之前 —— 上游没有这个接口。 */
  if (path === '/api/tv/keepalive') {
    const alive = await checkSession(request, env);
    if (!alive) return json({ ok: false, error: '需要影视口令', needGate: true }, 401);
    const token = await signToken(env.TV_GATE_KEY, Math.floor(Date.now() / 1000));
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) });
  }

  /* 其它 /api/tv* 一律要登录，然后转发给上游 */
  if (path.indexOf('/api/tv') === 0) {
    const passed = await checkSession(request, env);
    if (!passed) {
      return json({ ok: false, error: '需要影视口令', needGate: true }, 401);
    }
    return proxy(request, env, url);
  }

  /* 页面：没登录发登录页，登录了透传回源站 */
  const passed = await checkSession(request, env);
  /* 注意必须包成 Response —— Worker 直接 return 字符串会抛 1101 */
  if (!passed) return htmlPage(loginPage());

  return passThrough(request);
}

/* ============================================================ 会话 */

/** HMAC-SHA256 → 十六进制 */
async function hmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  const bytes = new Uint8Array(sig);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

/** 定长比较：长度不同直接否，长度相同逐字节异或累加（不提前 return） */
function safeEqual(a, b) {
  const x = String(a);
  const y = String(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/* 会话 cookie：不写 Max-Age / Expires → 浏览器关闭即失效（用户明确要求） */
function sessionCookie(token) {
  return COOKIE_NAME + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax';
}

/* 设备号 cookie：同样只在本次浏览会话内有效 */
function deviceCookie(id) {
  return DEVICE_COOKIE + '=' + id + '; Path=/; HttpOnly; Secure; SameSite=Lax';
}

function newDeviceId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let out = '';
  for (let i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, '0');
  return out;
}

function readCookie(header, name) {
  if (!header) return '';
  const parts = String(header).split(';');
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i].trim();
    if (seg.indexOf(name + '=') === 0) return seg.slice(name.length + 1);
  }
  return '';
}

/** 令牌形如 v1.<签发时间戳>.<签名>；签名密钥就是口令本身，
    于是「换口令 = 所有已发出的会话立刻失效」，这就是撤回手段。 */
async function signToken(key, iat) {
  const msg = TOKEN_VERSION + ':' + iat;
  return TOKEN_VERSION + '.' + iat + '.' + (await hmacHex(key, msg));
}

async function checkSession(request, env) {
  if (!env || !env.TV_GATE_KEY) return false;

  const raw = readCookie(request.headers.get('Cookie'), COOKIE_NAME);
  if (!raw) return false;

  const parts = raw.split('.');
  if (parts.length !== 3) return false;
  if (parts[0] !== TOKEN_VERSION) return false;

  const iat = Number(parts[1]);
  if (!Number.isInteger(iat) || iat <= 0) return false;

  const expect = await hmacHex(env.TV_GATE_KEY, TOKEN_VERSION + ':' + iat);
  if (!safeEqual(parts[2], expect)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (now - iat > SESSION_MAX_AGE) return false;
  if (iat > now + 300) return false; /* 容忍一点时钟漂移 */
  return true;
}

/* ============================================================ 登录 */

async function handleAuth(request, env) {
  if (!env || !env.TV_GATE_KEY) {
    return json({ ok: false, error: '门卫未配置口令（TV_GATE_KEY 缺失）' }, 503);
  }

  /* 同源校验：挡掉「别的网站用表单 POST 来这里试口令」 */
  const selfOrigin = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin && origin !== selfOrigin) {
    return json({ ok: false, error: '来源不允许' }, 403);
  }

  const now = Math.floor(Date.now() / 1000);
  const kv = env.KING_KV;

  /* 限速按「浏览器」为主，IP 只做一道很宽松的兜底。
     并且：拿不到 IP 时绝不退化成所有人共用一个桶 —— 那等于一个人输错、全站被锁。 */
  const ip = request.headers.get('CF-Connecting-IP') || '';
  let did = readCookie(request.headers.get('Cookie'), DEVICE_COOKIE);
  if (!/^[a-f0-9]{32}$/.test(did)) did = '';

  const devKey = did ? 'tv:fail:d:' + did : '';
  const ipKey = ip ? 'tv:fail:i:' + ip : '';

  function lockedOut(wait) {
    return json(
      { ok: false, error: '尝试次数过多，请稍后再试', locked: true, retryAfter: wait },
      429,
      { 'Retry-After': String(Math.max(1, wait)) },
    );
  }

  if (kv) {
    if (devKey) {
      const st = await readFail(kv, devKey);
      if (st.until > now) return lockedOut(st.until - now);
    }
    if (ipKey) {
      const st = await readFail(kv, ipKey);
      if (st.until > now) return lockedOut(st.until - now);
    }
  }

  let payload = {};
  try { payload = await request.json(); } catch (e) { /* 空 body 当空口令处理 */ }
  const key = payload && payload.key != null ? String(payload.key) : '';

  if (!safeEqual(key, env.TV_GATE_KEY)) {
    const cookies = [];
    /* 第一次来还没有设备号：发一个，从下一次起这次尝试就归到这台浏览器名下，
       于是「一个人输错」永远不会变成「一个 IP 下所有人被锁」。 */
    if (!did) {
      did = newDeviceId();
      cookies.push(deviceCookie(did));
    }

    let locked = false;
    let retry = 0;
    let left = FAIL_LIMIT;
    if (kv) {
      if (did) {
        const st = await bumpFail(kv, 'tv:fail:d:' + did, now, FAIL_LIMIT, LOCK_TIME);
        if (st.until > now) { locked = true; retry = Math.max(retry, st.until - now); }
        else left = Math.min(left, FAIL_LIMIT - st.fails);
      }
      if (ipKey) {
        /* 兜底桶：门槛高、锁得短。撞到它的只会是「每次丢 cookie 重新来」的硬刷 */
        const st = await bumpFail(kv, ipKey, now, IP_FAIL_LIMIT, IP_LOCK_TIME);
        if (st.until > now) { locked = true; retry = Math.max(retry, st.until - now); }
      }
    }

    return json({
      ok: false,
      error: locked ? '口令错误次数过多，请稍后再试' : '口令不正确',
      locked: locked,
      retryAfter: locked ? retry : 0,
      remaining: locked ? 0 : Math.max(0, left),
    }, locked ? 429 : 401, cookies.length ? { 'Set-Cookie': cookies } : undefined);
  }

  /* 登录成功：两个桶都清掉，别把之前的错误留给下一个用这台机器的人 */
  if (kv) {
    const keys = [devKey, ipKey, did ? 'tv:fail:d:' + did : ''];
    for (let i = 0; i < keys.length; i++) {
      if (!keys[i]) continue;
      try { await kv.delete(keys[i]); } catch (e) { /* 清不掉不影响登录 */ }
    }
  }

  const token = await signToken(env.TV_GATE_KEY, now);
  return json({ ok: true }, 200, {
    /* session cookie：浏览器关闭即失效。但浏览器「恢复会话」会把它一起恢复，
       所以服务端另有 SESSION_MAX_AGE 这道时间上限，并由 js/tv.js 心跳续期。 */
    'Set-Cookie': sessionCookie(token),
  });
}

/* ============================================================ 限速（KV） */

async function readFail(kv, key) {
  try {
    const raw = await kv.get(key);
    if (!raw) return { fails: 0, first: 0, until: 0 };
    const o = JSON.parse(raw);
    return { fails: Number(o.f) || 0, first: Number(o.t) || 0, until: Number(o.u) || 0 };
  } catch (e) {
    return { fails: 0, first: 0, until: 0 };
  }
}

async function bumpFail(kv, key, now, limit, lockTime) {
  const cur = await readFail(kv, key);
  const inWindow = cur.first > 0 && now - cur.first <= FAIL_WINDOW;
  const fails = inWindow ? cur.fails + 1 : 1;
  const first = inWindow ? cur.first : now;
  const until = fails >= limit ? now + lockTime : 0;
  try {
    await kv.put(key, JSON.stringify({ f: fails, t: first, u: until }), {
      expirationTtl: Math.max(FAIL_WINDOW, lockTime) + 120,
    });
  } catch (e) { /* KV 写失败时不阻断登录流程，只是这一轮没记上 */ }
  return { fails: fails, until: until };
}

/* ============================================================ 页面透传 */

async function passThrough(request) {
  const headers = new Headers();
  request.headers.forEach(function (v, k) {
    if (STRIP_REQ_HEADERS.indexOf(k.toLowerCase()) < 0) headers.set(k, v);
  });

  const res = await fetch(new Request(request.url, {
    method: request.method,
    headers: headers,
    redirect: 'manual',
  }));

  const out = new Headers();
  res.headers.forEach(function (v, k) {
    if (STRIP_RES_HEADERS.indexOf(k.toLowerCase()) < 0) out.set(k, v);
  });
  /* 关键：源站给的是 max-age=600，边缘一旦缓存就可能把「已登录的页面」
     喂给没登录的人。这里强制私有、不缓存。 */
  out.set('Cache-Control', 'private, no-store');
  out.set('X-Robots-Tag', 'noindex, nofollow');

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/* ============================================================ API 转发 */

async function proxy(request, env, url) {
  const base = String((env && env.UPSTREAM) || DEFAULT_UPSTREAM).replace(/\/+$/, '');
  const target = base + url.pathname + (url.search || '');

  const headers = new Headers();
  request.headers.forEach(function (v, k) {
    if (STRIP_REQ_HEADERS.indexOf(k.toLowerCase()) < 0) headers.set(k, v);
  });
  headers.set('X-Gate-Secret', String((env && env.TV_GATE_SECRET) || ''));

  const init = { method: request.method, headers: headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

  const res = await fetch(target, init);

  const out = new Headers();
  res.headers.forEach(function (v, k) {
    if (STRIP_RES_HEADERS.indexOf(k.toLowerCase()) < 0) out.set(k, v);
  });
  out.set('Cache-Control', cacheFor(url.pathname));
  out.set('X-Robots-Tag', 'noindex, nofollow');
  /* 上游的 CORS 头在同源下没有意义，去掉更干净 */
  out.delete('Access-Control-Allow-Origin');
  out.delete('Access-Control-Allow-Headers');
  out.delete('Access-Control-Allow-Methods');
  out.delete('Access-Control-Max-Age');
  out.delete('Vary');

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/** 海报可以给浏览器缓存（edge 不缓存 private），其余一律不缓存 */
function cacheFor(path) {
  if (path === '/api/tv/img') return 'private, max-age=21600';
  return 'private, no-store';
}

/* ============================================================ 响应工具 */

/* extra 的值允许是数组：一次响应里才能下发多个 Set-Cookie
   （会话 cookie + 设备号 cookie）。 */
function mergeHeaders(base, extra) {
  const headers = new Headers(base);
  if (extra) {
    Object.keys(extra).forEach(function (k) {
      const v = extra[k];
      if (Array.isArray(v)) v.forEach(function (one) { headers.append(k, one); });
      else if (v !== undefined && v !== null) headers.set(k, v);
    });
  }
  return headers;
}

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: mergeHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra),
  });
}

function htmlPage(body, status, extra) {
  return new Response(body, {
    status: status || 200,
    headers: mergeHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, extra),
  });
}

/* ============================================================ 页面 HTML */

const SHARED_CSS = [
  '*{box-sizing:border-box}',
  'html,body{margin:0;padding:0;min-height:100%}',
  'body{background:#fff5f8;color:#5c4a52;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}',
  '.card{width:100%;max-width:380px;background:#fff;border:1px solid #ffd9e4;border-radius:18px;padding:30px 26px 24px;box-shadow:0 12px 34px rgba(244,93,138,.14);text-align:center}',
  '.logo{font-size:38px;line-height:1;margin-bottom:10px}',
  'h1{margin:0 0 6px;font-size:19px;color:#f45d8a;font-weight:700}',
  '.sub{margin:0 0 20px;font-size:13px;color:#a08b95}',
  '.field{position:relative;margin-bottom:12px}',
  'input{width:100%;height:46px;padding:0 52px 0 14px;font-size:16px;letter-spacing:1px;border:1.5px solid #ffd0de;border-radius:12px;background:#fffafc;color:#5c4a52;outline:none;transition:border-color .15s,box-shadow .15s}',
  'input:focus{border-color:#f45d8a;box-shadow:0 0 0 3px rgba(244,93,138,.13)}',
  '.eye{position:absolute;right:6px;top:5px;width:38px;height:36px;border:0;background:none;color:#b9a2ac;cursor:pointer;font-size:15px;border-radius:9px}',
  '.eye:hover{color:#f45d8a}',
  'button.go{width:100%;height:46px;border:0;border-radius:12px;background:linear-gradient(135deg,#f45d8a,#ff8fb1);color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s}',
  'button.go:hover{opacity:.92}',
  'button.go:active{transform:scale(.99)}',
  'button.go[disabled]{opacity:.55;cursor:default}',
  '.msg{min-height:20px;margin:10px 0 0;font-size:13px;color:#d9534f}',
  '.msg.info{color:#a08b95}',
  '.back{display:inline-block;margin-top:16px;font-size:13px;color:#c08fa3;text-decoration:none}',
  '.back:hover{color:#f45d8a}',
  '.shake{animation:sk .32s}',
  '@keyframes sk{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}',
  '.hint{margin:14px 0 0;font-size:12px;color:#bda8b1}',
].join('');

const SHARED_HEAD =
  '<meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="robots" content="noindex,nofollow">' +
  '<meta name="theme-color" content="#ffb6c1">' +
  '<style>' + SHARED_CSS + '</style>';

function loginPage() {
  return '<!DOCTYPE html><html lang="zh-CN"><head>' + SHARED_HEAD +
    '<title>🌸 影视 · 需要口令</title></head><body>' +
    '<div class="card" id="card">' +
    '<div class="logo">🌸</div>' +
    '<h1>影视区 · 需要口令</h1>' +
    '<p class="sub">输入口令后才能进入</p>' +
    '<form id="f" autocomplete="off">' +
    '<div class="field">' +
    '<input id="k" type="password" name="key" placeholder="请输入口令" autocomplete="current-password" autofocus aria-label="口令">' +
    '<button type="button" class="eye" id="eye" aria-label="显示或隐藏口令">👁</button>' +
    '</div>' +
    '<button type="submit" class="go" id="go">进 入</button>' +
    '</form>' +
    '<p class="msg" id="m"></p>' +
    '<a class="back" href="/home.html">← 返回首页</a>' +
    '<p class="hint">连续输错会被临时锁定</p>' +
    '</div>' +
    '<script>(function(){' +
    'var f=document.getElementById("f"),k=document.getElementById("k"),go=document.getElementById("go"),' +
    'm=document.getElementById("m"),eye=document.getElementById("eye"),card=document.getElementById("card");' +
    'eye.addEventListener("click",function(){var p=k.type==="password";k.type=p?"text":"password";k.focus();});' +
    'function say(t,info){m.textContent=t||"";m.className=info?"msg info":"msg";}' +
    'f.addEventListener("submit",function(e){' +
    'e.preventDefault();' +
    'var v=k.value;if(!v){say("请输入口令");k.focus();return;}' +
    'go.disabled=true;say("验证中…",true);' +
    'fetch("/api/tv/auth",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({key:v})})' +
    '.then(function(r){return r.json().catch(function(){return{};}).then(function(d){return{ok:r.ok,status:r.status,d:d};});})' +
    '.then(function(res){' +
    'if(res.ok&&res.d&&res.d.ok){say("口令正确，正在进入…",true);location.replace("/TV.html");return;}' +
    'go.disabled=false;' +
    'var d=res.d||{};' +
    'var t=d.error||("验证失败（HTTP "+res.status+"）");' +
    'if(d.remaining>0)t+="，还可以试 "+d.remaining+" 次";' +
    'say(t);' +
    'card.classList.remove("shake");void card.offsetWidth;card.classList.add("shake");' +
    'k.select();' +
    '})' +
    '.catch(function(){go.disabled=false;say("网络异常，请重试");});' +
    '});' +
    '})();<' + '/script>' +
    '</body></html>';
}

function errorPage(err) {
  const detail = err && err.message ? String(err.message).slice(0, 200) : String(err);
  return '<!DOCTYPE html><html lang="zh-CN"><head>' + SHARED_HEAD +
    '<title>🌸 影视 · 暂不可用</title></head><body>' +
    '<div class="card">' +
    '<div class="logo">🌧️</div>' +
    '<h1>影视区暂停开放</h1>' +
    '<p class="sub">门卫出了点问题，出于安全先不放行</p>' +
    '<p class="msg">' + escapeHtml(detail) + '</p>' +
    '<a class="back" href="/home.html">← 返回首页</a>' +
    '</div></body></html>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
