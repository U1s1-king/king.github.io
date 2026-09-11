# -*- coding: utf-8 -*-
"""版本号一键同步。

用法：
    python scripts/bump_version.py 20260912

会同步更新：
  1. js/version.js 的 __DSH_VERSION
  2. sw.js 的 VERSION（CACHE 与 CORE 的 ?v= 都由它生成）
  3. 所有 HTML 中静态资源的 ?v= 查询串（外部 Live2D CDN 不受影响）
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE2D_HOST = 'sakura-live2d.pages.dev'
URL_RE = re.compile(r'''(https?://[^"'\s>]+)''')
V_RE = re.compile(r'\?v=\d{6,}')


def read(p):
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, text):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


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
        if part.startswith('http') and LIVE2D_HOST in part:
            continue
        parts[i], k = V_RE.subn('?v=' + new, part)
        changed += k
    write(path, ''.join(parts))
    print('[ok] %s (%d 处)' % (os.path.relpath(path, ROOT), changed))


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r'\d{6,}', sys.argv[1]):
        raise SystemExit('用法: python scripts/bump_version.py <版本号，如 20260912>')
    new = sys.argv[1]
    bump_js_version(os.path.join(ROOT, 'js', 'version.js'), new)
    bump_sw(os.path.join(ROOT, 'sw.js'), new)
    for name in sorted(os.listdir(ROOT)):
        if name.endswith('.html'):
            bump_html(os.path.join(ROOT, name), new)
    print('\n全部同步为 %s。记得同步更新 sitemap.xml 的 <lastmod>。' % new)


if __name__ == '__main__':
    main()
