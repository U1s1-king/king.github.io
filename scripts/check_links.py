# -*- coding: utf-8 -*-
"""站内引用完整性检查。

体检发现的实际问题：文件下线后引用不会自动消失，长期累积成死链。
例如 Guestbook.html 并入 Journal.html#guestbook 后，README 里那条链接、
以及 player.html / App.html 等一批历史残留，都没有任何机制能拦住。

本脚本扫描根目录 HTML 与 js/ 下脚本里对本地 .html 的引用，
逐个校验目标文件存在，缺失即失败（供 CI 调用）。

设计上刻意只查 .html：
  - .js/.css 的引用带 ?v= 查询串，且 sw.js 的预缓存清单本身就需要单独核算；
  - 图片/字体数量庞大，误报率高，收益低。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', 'games', 'cloudflare', '.github', '.wrangler'}

# 引用形式：href="X.html" / src="X.html" / 'X.html' / 裸串
REF_RE = re.compile(r'''["'\(]([A-Za-z0-9_\-]+\.html)(?:[#?][^"'\)]*)?["'\)]''')
# 本地静态资源（用来核对 sw.js 的预缓存清单）
LOCAL_ASSET_RE = re.compile(r'\.(?:js|css)$', re.IGNORECASE)

# 故意不进预缓存清单的资源：sw.js 里有明确理由（体积过大、或只在空闲时段/二级视图
# 才需要），它们改走 stale-while-revalidate 按需缓存。列在这里免得检查器一直报噪音 ——
# 噪音会让真正该看的告警被忽略。
PRECACHE_EXEMPT = {
    '/js/music-bundle.js',      # 547KB，只在音乐页按需加载
    '/js/vendor/lunar.js',      # 434KB，只在用农历工具时加载
    '/js/vendor/anime.min.js',  # 由 anim.js 在 load 后空闲时段才拉起
    '/js/vendor/vivus.min.js',
    '/css/Guestbook.css',       # 留言板三件套：只在 Journal 的二级视图被点到时才需要
    '/js/Guestbook.js',
    '/js/guestbook-app.js',
}


def walk(root, exts):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if os.path.splitext(name)[1].lower() in exts:
                yield os.path.join(dirpath, name)


def check_sw_precache(root):
    """sw.js 的预缓存清单是否覆盖了各页面的本地静态依赖。

    体检发现的实际问题：TV.html 引用了 js/tv-store.js、js/tv-player.js、
    css/tv-player.css，但 sw.js 的 CORE 里只有 tv.css 和 tv.js。漏掉的三个
    只能靠 stale-while-revalidate 按需缓存，于是版本升级时会出现
    「HTML 的 ?v= 已改写、播放器脚本还停在旧版」的窗口。
    这里逐页比对，漏了就报出来。
    """
    sw_path = os.path.join(root, 'sw.js')
    if not os.path.exists(sw_path):
        return []
    with open(sw_path, 'r', encoding='utf-8', errors='ignore') as f:
        sw = f.read()

    # CORE 数组：从 'const CORE = [' 到第一个 ']'
    m = re.search(r'const\s+CORE\s*=\s*\[(.*?)\n\]', sw, re.S)
    if not m:
        return [('sw.js', 'CORE 数组没找到，无法核对预缓存清单')]
    core = m.group(1)

    # 从 CORE 里抽出本地资源路径（去掉 ?v= 和引号）
    cached = set()
    for mm in re.finditer(r"'(/[^'?]+)(?:\?v=[^']*)?'", core):
        cached.add(mm.group(1))

    problems = []
    for name in sorted(os.listdir(root)):
        if not name.endswith('.html'):
            continue
        # TV.html 故意不预缓存（门卫后面），它自身的依赖仍然要核对
        with open(os.path.join(root, name), 'r', encoding='utf-8', errors='ignore') as f:
            html = f.read()
        for mm in re.finditer(r'<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"', html, re.I):
            url = mm.group(1)
            if url.startswith(('http://', 'https://', '//', 'data:')):
                continue
            # 先剥掉 ?v= 查询串再判断后缀：LOCAL_ASSET_RE 是 $ 结尾锚定的，
            # 直接拿 "css/tv.css?v=20261026" 去测永远不匹配（实测踩过这个假阴性）。
            clean = url.split('?')[0].split('#')[0]
            if not LOCAL_ASSET_RE.search(clean):
                continue
            if not clean.startswith('/'):
                clean = '/' + clean
            if clean in PRECACHE_EXEMPT:
                continue
            if clean not in cached:
                problems.append((name, clean))
    return problems


def main():
    problems = []
    checked = 0
    for path in walk(ROOT, ('.html', '.js')):
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
        for m in REF_RE.finditer(text):
            target = m.group(1)
            checked += 1
            if not os.path.exists(os.path.join(ROOT, target)):
                problems.append((os.path.relpath(path, ROOT), target))

    precache = check_sw_precache(ROOT)

    if problems:
        print('[FAIL] 发现 %d 处指向不存在文件的站内引用：' % len(problems))
        for src, target in sorted(set(problems)):
            print('  %s -> %s' % (src, target))

    if precache:
        print('[FAIL] 有 %d 个本地静态依赖没进 sw.js 的预缓存清单：' % len(precache))
        for page, asset in precache:
            print('  %s 依赖 %s' % (page, asset))
        print('  这不会让页面报错，但版本升级时这些文件缺少缓存失效保护。')
        print('  确实不该预缓存的（体积大/按需加载），加进本文件的 PRECACHE_EXEMPT 并写明理由。')

    if problems or precache:
        return 1
    print('[ok] 站内引用完整（检查 %d 处），预缓存清单无遗漏' % checked)
    return 0

if __name__ == '__main__':
    sys.exit(main())
