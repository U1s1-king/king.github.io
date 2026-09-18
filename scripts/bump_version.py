# -*- coding: utf-8 -*-
"""版本号一键同步。

用法：
    python scripts/bump_version.py 20260912

会同步更新：
  1. js/version.js 的 __DSH_VERSION
  2. sw.js 的 VERSION（CACHE 与 CORE 的 ?v= 都由它生成）
  3. 所有 HTML 中静态资源的 ?v= 查询串（第三方 CDN 不受影响），
     并给从未带过版本的本地 .js/.css 引用补上 ?v=
     注意 sakura-live2d.pages.dev 是本站自己的 Pages 项目，不是第三方 CDN，
     它的 waifu.js 必须跟着版本走，否则外壳升版后客户端仍会拿旧脚本。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 本站自有 Pages 项目：它的资源要跟版本号，不属于「外部 CDN 豁免」的范围。
# 若将来 Live2D 真的迁到第三方托管，把域名挪进 EXEMPT_HOSTS 即可。
OWN_HOSTS = ('sakura-live2d.pages.dev',)
EXEMPT_HOSTS = ()
URL_RE = re.compile(r'''(https?://[^"'\s>]+)''')
V_RE = re.compile(r'\?v=\d{6,}')
TAG_RE = re.compile(r'(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"]+)(")', re.IGNORECASE)
LOCAL_ASSET_RE = re.compile(r'\.(?:js|css)$', re.IGNORECASE)


def read(p):
    # newline='' 保留原始行尾，避免读进来时把 CRLF 折叠成 LF 后写回，
    # 平白制造一个「整个文件都改了」的假 diff。
    with open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def write(p, text):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def add_missing_version(text, new):
    """给尚未带 ?v= 的本地 .js/.css 引用补上版本号。

    V_RE 只能替换「已存在」的 ?v=，对 js/particles-config.js 这种
    从未带过查询串的引用无能为力，于是它永远拿不到缓存失效保护。
    """
    added = 0

    def repl(m):
        nonlocal added
        url = m.group(2)
        if url.startswith(('http://', 'https://', '//', 'data:')):
            return m.group(0)
        if '?' in url or '#' in url:
            return m.group(0)
        if not LOCAL_ASSET_RE.search(url):
            return m.group(0)
        added += 1
        return m.group(1) + url + '?v=' + new + m.group(3)

    return TAG_RE.sub(repl, text), added


def bump_js_version(path, new):
    text = read(path)
    new_text, n = re.subn(r"(__DSH_VERSION\s*=\s*')[^']+(')", r'\g<1>' + new + r'\g<2>', text)
    if n != 1:
        raise SystemExit('[FAIL] %s: __DSH_VERSION 未找到或出现 %d 次' % (path, n))
    write(path, new_text)
    print('[ok] %s' % os.path.relpath(path, ROOT))


def bump_sw(path, new):
    text = read(path)
    new_text, n = re.subn(r"(const VERSION = ')[^']+(')", r'\g<1>' + new + r'\g<2>', text)
    if n != 1:
        raise SystemExit('[FAIL] %s: VERSION 未找到或出现 %d 次' % (path, n))
    write(path, new_text)
    print('[ok] %s' % os.path.relpath(path, ROOT))


def bump_html(path, new):
    text = read(path)
    parts = URL_RE.split(text)
    changed = 0
    for i, part in enumerate(parts):
        if part.startswith('http'):
            # 自有域名的资源照常升版；只有真正的第三方 CDN 才跳过。
            if any(h in part for h in EXEMPT_HOSTS):
                continue
            if not any(h in part for h in OWN_HOSTS):
                continue
        parts[i], k = V_RE.subn('?v=' + new, part)
        changed += k
    out, added = add_missing_version(''.join(parts), new)
    write(path, out)
    print('[ok] %s (%d 处替换, %d 处补全)' % (os.path.relpath(path, ROOT), changed, added))


def bump_sitemap(new):
    """把 sitemap.xml 的 <lastmod> 同步到本次发布。

    原先这一步要人工记着做（旧代码最后一行只打印一句提醒），
    实际结果就是 lastmod 长期停在某一天，对搜索引擎失真。
    直接由版本号推导日期：版本号本身形如 YYYYMMDD。
    """
    path = os.path.join(ROOT, 'sitemap.xml')
    if not os.path.exists(path):
        print('[skip] sitemap.xml 不存在')
        return
    if not re.fullmatch(r'\d{8}', new):
        print('[skip] sitemap.xml: 版本号 %s 不是 YYYYMMDD，无法推导日期' % new)
        return
    date = '%s-%s-%s' % (new[0:4], new[4:6], new[6:8])
    text = read(path)
    out, n = re.subn(r'<lastmod>[^<]*</lastmod>', '<lastmod>' + date + '</lastmod>', text)
    if n == 0:
        print('[skip] sitemap.xml: 未找到 <lastmod>')
        return
    write(path, out)
    print('[ok] sitemap.xml (%d 处 lastmod -> %s)' % (n, date))


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r'\d{6,}', sys.argv[1]):
        raise SystemExit('用法: python scripts/bump_version.py <版本号，如 20260912>')
    new = sys.argv[1]
    bump_js_version(os.path.join(ROOT, 'js', 'version.js'), new)
    bump_sw(os.path.join(ROOT, 'sw.js'), new)
    for name in sorted(os.listdir(ROOT)):
        if name.endswith('.html'):
            bump_html(os.path.join(ROOT, name), new)
    bump_sitemap(new)
    print('\n全部同步为 %s。' % new)


if __name__ == '__main__':
    main()
