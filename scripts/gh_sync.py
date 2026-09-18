# -*- coding: utf-8 -*-
"""抓取 GitHub 用户数据快照。

为什么需要这个脚本（而不是浏览器直连）：
  api.github.com 未鉴权时限 60 次/小时/IP，而且是按**出口 IP**计的。
  Cloudflare / GitHub Pages 的出口 IP 是共享的，配额早被别人用光了 ——
  实测从浏览器请求稳定拿到 403 "API rate limit exceeded"，
  首页的「GitHub 开源」卡片因此长期显示「加载失败」。

  这和 data/bili/stats.json 是同一个思路：
  抓取放到 Actions 里（有 GITHUB_TOKEN，配额 5000 次/小时），
  页面只读同源的静态 JSON。既绕开配额，也绕开了出口 IP 共享的问题。

用法：
    GITHUB_TOKEN=xxx python scripts/gh_sync.py
"""
import json
import os
import sys
import urllib.request

USER = 'U1s1-king'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'github', 'stats.json')


def fetch(url, token=None):
    req = urllib.request.Request(url, headers={
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'king-blog-sync',
    })
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise SystemExit(
                '[FAIL] 403：GitHub API 配额用尽（未鉴权 60 次/小时/IP）。\n'
                '       这个脚本必须在 Actions 里跑（自动带 GITHUB_TOKEN，5000 次/小时），\n'
                '       本地裸跑几乎必然撞到这个上限。带上 token 再试：\n'
                '         $env:GITHUB_TOKEN="ghp_..." ; python scripts/gh_sync.py')
        raise


def main():
    token = os.environ.get('GITHUB_TOKEN') or None

    user = fetch('https://api.github.com/users/' + USER, token)
    # 只留首页真正要用的字段，别把整个响应塞进仓库
    data = {
        'login': user.get('login'),
        'public_repos': user.get('public_repos'),
        'followers': user.get('followers'),
        'following': user.get('following'),
    }

    # 顺带把 Archives 页要的仓库列表也抓了（同样受 60/hr 限制）
    try:
        repos = fetch('https://api.github.com/users/%s/repos?sort=updated&per_page=8' % USER, token)
        data['repos'] = [{
            'name': r.get('name'),
            'html_url': r.get('html_url'),
            'description': r.get('description'),
            'stargazers_count': r.get('stargazers_count'),
            'language': r.get('language'),
            'updated_at': r.get('updated_at'),
        } for r in repos]
    except Exception as e:
        print('[warn] repos 抓取失败: %s' % e, file=sys.stderr)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print('[ok] %s  repos=%s followers=%s' % (
        os.path.relpath(OUT, ROOT), data.get('public_repos'), data.get('followers')))


if __name__ == '__main__':
    main()
