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


def walk(root, exts):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if os.path.splitext(name)[1].lower() in exts:
                yield os.path.join(dirpath, name)


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

    if problems:
        print('[FAIL] 发现 %d 处指向不存在文件的站内引用：' % len(problems))
        for src, target in sorted(set(problems)):
            print('  %s -> %s' % (src, target))
        return 1
    print('[ok] 站内引用完整（检查 %d 处）' % checked)
    return 0


if __name__ == '__main__':
    sys.exit(main())
