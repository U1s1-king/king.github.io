# -*- coding: utf-8 -*-
"""把 _partials/ 里的导航结构同步进所有页面。

侧边栏（.site-sidebar）与底部导航（.bot-tab）此前在 7 个页面里各写一份，
改一处导航要改 7 个文件，已经漂移过一次（music.html 的 loading="lazy" 漏了）。

现在：
  - 结构模板 -> _partials/sidebar.html、_partials/bot-tab.html
  - 链接数据 -> 本文件的 NAV
  - 每页参数 -> 本文件的 PAGES（链接前缀、当前页高亮）

用法：
    python scripts/sync_nav.py            写入
    python scripts/sync_nav.py --check    只检查是否已同步（不同步则退出码 1）
"""
import argparse
import os
import re
import sys

try:  # 让中文提示在 Windows 控制台也能正常显示
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PARTIALS = os.path.join(ROOT, '_partials')

# (href, 文字, Font Awesome 图标)
NAV = [
    ('index.html',     '首页', 'fa-cat'),
    ('Journal.html',   '日记', 'fa-book-open'),
    ('Archives.html',  '归档', 'fa-images'),
    ('Guestbook.html', '留言', 'fa-comments'),
    ('music.html',     '音乐', 'fa-music'),
    ('Tools.html',     '工具', 'fa-toolbox'),
]

# (页面文件, 链接前缀, 当前页高亮的 href)
# 404.html 会在任意深度的路径下被命中，必须用根绝对路径，且没有「当前页」
PAGES = [
    ('index.html',     '',  'index.html'),
    ('Journal.html',   '',  'Journal.html'),
    ('Archives.html',  '',  'Archives.html'),
    ('Guestbook.html', '',  'Guestbook.html'),
    ('music.html',     '',  'music.html'),
    ('Tools.html',     '',  'Tools.html'),
    ('404.html',       '/', None),
]

SIDEBAR_FALLBACK = re.compile(r'[ \t]*<aside class="site-sidebar".*?</aside>', re.S)
BOTTAB_FALLBACK = re.compile(r'[ \t]*<nav class="bot-tab".*?</nav>', re.S)
LINE = '\r\n'


def read(path):
    with open(path, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def links(prefix, active, indent):
    out = []
    for href, label, icon in NAV:
        act = ' class="active"' if href == active else ''
        out.append('%s<a href="%s%s"%s><i class="fas %s"></i><span>%s</span></a>'
                   % (indent, prefix, href, act, icon, label))
    return LINE.join(out)


def sidebar_block(prefix, active):
    tpl = read(os.path.join(PARTIALS, 'sidebar.html'))
    body = tpl.replace('{{PREFIX}}', prefix).replace('{{NAV}}', links(prefix, active, '        '))
    return ('<!-- nav:sidebar:start - 由 scripts/sync_nav.py 生成，勿手改 -->' + LINE
            + body.rstrip(LINE) + LINE + '<!-- nav:sidebar:end -->')


def bottab_block(prefix):
    tpl = read(os.path.join(PARTIALS, 'bot-tab.html'))
    body = tpl.replace('{{PREFIX}}', prefix).replace('{{NAV}}', links(prefix, None, '    '))
    body = LINE.join('    ' + l for l in body.rstrip(LINE).split(LINE))
    return ('    <!-- nav:bot-tab:start - 由 scripts/sync_nav.py 生成，勿手改 -->' + LINE
            + body + LINE + '    <!-- nav:bot-tab:end -->')


def apply_block(text, kind, new, fallback):
    start_pat = re.compile(r'[ \t]*<!-- ' + re.escape(kind) + r':start[^\r\n]*-->')
    end_pat = re.compile(r'[ \t]*<!-- ' + re.escape(kind) + r':end -->')
    ms = start_pat.search(text)
    if ms:
        me = end_pat.search(text, ms.end())
        if not me:
            raise SystemExit('缺少 ' + kind + ':end 标记')
        return text[:ms.start()] + new + text[me.end():]
    m = fallback.search(text)
    if not m:
        raise SystemExit('找不到 ' + kind + ' 块，也没有开始标记')
    return text[:m.start()] + new + text[m.end():]


def main():
    ap = argparse.ArgumentParser(description='同步站点导航结构')
    ap.add_argument('--check', action='store_true', help='只检查是否已同步')
    args = ap.parse_args()

    changed = []
    for fname, prefix, active in PAGES:
        path = os.path.join(ROOT, fname)
        text = read(path)
        before = text
        text = apply_block(text, 'nav:sidebar', sidebar_block(prefix, active), SIDEBAR_FALLBACK)
        text = apply_block(text, 'nav:bot-tab', bottab_block(prefix), BOTTAB_FALLBACK)
        if text != before:
            changed.append(fname)
            if not args.check:
                with open(path, 'w', encoding='utf-8', newline='') as f:
                    f.write(text)

    if args.check:
        if changed:
            print('[未同步] ' + ', '.join(changed))
            print('请执行： python scripts/sync_nav.py')
            return 1
        print('[ok] 导航结构已同步')
        return 0

    if changed:
        for f in changed:
            print('[ok] ' + f)
    else:
        print('[ok] 无需改动')
    return 0


if __name__ == '__main__':
    sys.exit(main())
