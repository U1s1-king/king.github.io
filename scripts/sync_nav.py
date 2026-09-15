# -*- coding: utf-8 -*-
"""把 _partials/ 里的导航结构同步进所有页面。

侧边栏（.site-sidebar）与底部导航（.bot-tab）此前在 7 个页面里各写一份，
改一处导航要改 7 个文件，已经漂移过一次（music.html 的 loading="lazy" 漏了）。

现在：
  - 结构模板 -> _partials/sidebar.html、_partials/bot-tab.html
  - 链接数据 -> 本文件的 NAV        （桌面侧边栏，6 项，不变）
              -> 本文件的 NAV_MOBILE （移动端底部 tab，4 项，刻意不含首页/留言）
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

# 移动端底部 tab：5 项（主流通行上限 3~5，Material 允许）。
# 为什么不砍到 4 项：手机浏览器访客必须能一步回首页；一个没有文字标签的
# 图标不算「首页入口」。首页放第一格，归档保留一级 tab。
# 「留言」不进 tab —— 它是首页里的二级入口（首页 →「日常点滴」卡片）。
# 桌面侧边栏仍然是 NAV 那 6 项，两者互不影响
# （.bot-tab 在桌面端 display:none，所以改这里不会动到网页端）。
NAV_MOBILE = [
    ('index.html',     '首页', 'fa-cat'),
    ('Journal.html',   '日记', 'fa-book-open'),
    ('Archives.html',  '归档', 'fa-images'),
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
    # APP 外壳页：自带顶栏与底部 tab，但没有侧边栏，也没有「当前页」——
    # tab 高亮由 js/shell.js 在运行时按 iframe 实际加载到哪一页动态切。
    ('shell.html',     '',  None),
]

# 这些页面自己画导航，不生成侧边栏块
NO_SIDEBAR = {'shell.html'}

SIDEBAR_FALLBACK = re.compile(r'[ \t]*<aside class="site-sidebar".*?</aside>', re.S)
BOTTAB_FALLBACK = re.compile(r'[ \t]*<nav class="bot-tab".*?</nav>', re.S)
def read(path):
    with open(path, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def eol_of(text):
    """按文件自身的行尾生成。本地工作区是 CRLF，而 CI（Linux）checkout 出来是 LF
    （git 里存的就是 LF），写死任何一种都会让 --check 在另一种环境下误报失败。"""
    return '\r\n' if '\r\n' in text else '\n'


def norm(text, eol):
    """把模板的行尾统一成目标行尾，避免模板与页面行尾不一致。"""
    return text.replace('\r\n', '\n').replace('\n', eol)


def links(prefix, active, indent, eol, nav=NAV):
    out = []
    for href, label, icon in nav:
        act = ' class="active"' if href == active else ''
        out.append('%s<a href="%s%s"%s><i class="fas %s"></i><span>%s</span></a>'
                   % (indent, prefix, href, act, icon, label))
    return eol.join(out)


def sidebar_block(prefix, active, eol):
    body = norm(read(os.path.join(PARTIALS, 'sidebar.html')), eol)
    body = body.replace('{{PREFIX}}', prefix).replace('{{NAV}}', links(prefix, active, '        ', eol))
    return ('<!-- nav:sidebar:start - 由 scripts/sync_nav.py 生成，勿手改 -->' + eol
            + body.rstrip(eol) + eol + '<!-- nav:sidebar:end -->')


def bottab_block(prefix, eol, nav=NAV_MOBILE):
    body = norm(read(os.path.join(PARTIALS, 'bot-tab.html')), eol)
    body = body.replace('{{PREFIX}}', prefix).replace('{{NAV}}', links(prefix, None, '    ', eol, nav))
    body = eol.join('    ' + l for l in body.rstrip(eol).split(eol))
    return ('    <!-- nav:bot-tab:start - 由 scripts/sync_nav.py 生成，勿手改 -->' + eol
            + body + eol + '    <!-- nav:bot-tab:end -->')


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
        eol = eol_of(text)
        before = text
        # 404 例外：它没有「当前页」，而移动端 tab 里已经没有首页了，
        # 如果 404 也用 4 项，用户在错误页上就没有任何回首页的出口。
        # 404.html 过去要用 NAV 才够拿到「首页」入口，现在 NAV_MOBILE 里就有首页，
        # 所以不再需要任何特例 —— 全站移动端 tab 统一 5 项。
        if fname not in NO_SIDEBAR:
            text = apply_block(text, 'nav:sidebar', sidebar_block(prefix, active, eol), SIDEBAR_FALLBACK)
        text = apply_block(text, 'nav:bot-tab', bottab_block(prefix, eol, NAV_MOBILE), BOTTAB_FALLBACK)
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
