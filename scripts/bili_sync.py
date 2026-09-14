# -*- coding: utf-8 -*-
"""Tomo Ebizuka · B站数据同步脚本
抓取粉丝/关注、用户资料卡、全站在线人数、视频播放数据 -> data/bili/stats.json
供 GitHub Actions 定时运行；本地手动运行亦可 (python scripts/bili_sync.py)

容错原则（重要）：
  任何一段抓取失败都保留上一版数据，绝不把好数据覆盖成空。
  原先的写法在视频接口挂掉时会把 videos 写成 []，而只要粉丝数抓到了
  就不会触发「全部失败」的兜底，于是 CI 一路绿灯，页面上那三张视频卡片
  却永远停在「🌸 数据同步中...」。

为什么视频单独走回落方案：
  /x/web-interface/view 对数据中心 IP（GitHub Actions、云主机）返回 412 风控，
  而视频页 HTML 能正常打开、里面内嵌了同一份 stat 数据。
  所以顺序是：接口优先 -> 页面 HTML 回落 -> 沿用上一版。
"""
import datetime
import gzip
import json
import os
import re
import sys
import urllib.request
import zlib

sys.stdout.reconfigure(encoding='utf-8')

API = 'https://api.bilibili.com'
MID = '1113834956'
BVIDS = ['BV1KbQ1YGEY8', 'BV1cuLdzUECX', 'BV1JzQpYTEft']
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'bili', 'stats.json')


def fetch_text(url, timeout=20):
    """B站的 CDN 会对 urllib 返回 gzip 压缩体（实测 content-encoding: gzip）。
    不解压的话拿到的是一堆乱码，后面正则自然什么都匹配不到。
    注意 PowerShell 的 Invoke-WebRequest 会自动解压，所以命令行手测时看不出来。
    """
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        enc = (resp.headers.get('Content-Encoding') or '').lower()
    if enc == 'gzip':
        raw = gzip.decompress(raw)
    elif enc == 'deflate':
        try:
            raw = zlib.decompress(raw)
        except zlib.error:
            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
    return raw.decode('utf-8', 'replace')


def get(url, timeout=20):
    return json.loads(fetch_text(url, timeout))


def load_prev():
    """读上一版数据，用于「失败就保留旧值」。"""
    try:
        with open(OUT, 'r', encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def unescape_slash(s):
    r"""B站页面里的 URL 用 \u002F 表示 /，顺便兼容 \/ 写法。"""
    return s.replace('\\u002F', '/').replace('\\u002f', '/').replace('\\/', '/')


def video_from_api(bv):
    d = get(f'{API}/x/web-interface/view?bvid={bv}')['data']
    st = d.get('stat', {}) or {}
    return {
        'bvid': bv,
        'title': d.get('title', ''),
        'pic': d.get('pic', ''),
        'view': st.get('view', 0),
        'like': st.get('like', 0),
        'coin': st.get('coin', 0),
        'favorite': st.get('favorite', 0),
    }


def video_from_page(bv):
    """回落方案：解析视频页 HTML 内嵌的 __INITIAL_STATE__ 数据。"""
    html = fetch_text(f'https://www.bilibili.com/video/{bv}/')
    m = re.search(r'"stat":\{"aid":\d+[^}]*\}', html)
    if not m:
        raise ValueError('页面里没找到 stat 数据')
    st = json.loads(m.group(0)[len('"stat":'):])

    title = ''
    mt = re.search(r'<title[^>]*>(.*?)</title>', html, re.S)
    if mt:
        title = re.sub(r'\s*[-_]\s*哔哩哔哩.*$', '', mt.group(1)).strip()

    pic = ''
    mp = re.search(r'"pic":"([^"]*bfs[^"]*)"', html)
    if mp:
        pic = unescape_slash(mp.group(1))

    return {
        'bvid': bv,
        'title': title,
        'pic': pic,
        'view': st.get('view', 0),
        'like': st.get('like', 0),
        'coin': st.get('coin', 0),
        'favorite': st.get('favorite', 0),
    }


def main():
    prev = load_prev()
    data = {}

    # 1. 粉丝/关注数
    try:
        d = get(f'{API}/x/relation/stat?vmid={MID}')['data']
        data['relation'] = {'follower': d.get('follower', 0), 'following': d.get('following', 0)}
        print('relation: 粉丝', data['relation']['follower'])
    except Exception as e:
        print('[keep] relation 沿用上一版:', e)
        if prev.get('relation'):
            data['relation'] = prev['relation']

    # 2. 用户资料卡
    try:
        card = get(f'{API}/x/web-interface/card?mid={MID}')['data']['card']
        data['card'] = {
            'name': card.get('name', ''),
            'face': card.get('face', ''),
            'level': card.get('level_info', {}).get('current_level', 0),
            'sign': card.get('sign', ''),
            'fans': card.get('fans', 0),
            'attention': card.get('attention', 0),
        }
        print('card:', data['card']['name'], 'LV', data['card']['level'])
    except Exception as e:
        print('[keep] card 沿用上一版:', e)
        if prev.get('card'):
            data['card'] = prev['card']

    # 3. 全站在线人数（各分区在线求和）
    try:
        d = get(f'{API}/x/web-interface/online')['data']
        data['online'] = {'total': sum(d.get('region_count', {}).values())}
        print('online:', data['online']['total'])
    except Exception as e:
        print('[keep] online 沿用上一版:', e)
        if prev.get('online'):
            data['online'] = prev['online']

    # 4. 视频数据（标题/封面/播放/点赞/投币/收藏）
    old_by_bv = {}
    for v in (prev.get('videos') or []):
        if isinstance(v, dict) and v.get('bvid'):
            old_by_bv[v['bvid']] = v

    vids = []
    fresh = 0
    for bv in BVIDS:
        item = None
        try:
            item = video_from_api(bv)
        except Exception as e_api:
            try:
                item = video_from_page(bv)
            except Exception as e_page:
                print(f'[warn] 视频 {bv} 接口与页面均失败: {e_api} / {e_page}')

        if item:
            item['bvid'] = bv
            # B站封面给的是 http://，站点是 https，统一升级避免混合内容
            if str(item.get('pic', '')).startswith('http://'):
                item['pic'] = 'https://' + item['pic'][len('http://'):]
            vids.append(item)
            fresh += 1
            print('view:', bv, str(item.get('title', ''))[:22], '播放', item.get('view'))
        elif bv in old_by_bv:
            vids.append(old_by_bv[bv])
            print(f'[keep] 视频 {bv} 沿用上一版数据')

    if not vids and old_by_bv:
        vids = list(old_by_bv.values())

    # 关键：绝不把已有的视频数据覆盖成空数组
    if not vids and prev.get('videos'):
        vids = prev['videos']
    data['videos'] = vids

    if fresh < len(BVIDS):
        print(f'[warn] 本次仅刷新 {fresh}/{len(BVIDS)} 个视频的数据，其余沿用上一版'
              '（B站对数据中心 IP 有 412 风控，属预期内）')

    data['updated_at'] = datetime.datetime.now().astimezone().isoformat(timespec='minutes')

    # 容错：全部失败则保留旧文件
    if not data.get('relation') and not data.get('card') and not data.get('videos'):
        print('所有接口均失败，保留旧数据不动')
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print('已写入:', OUT)


if __name__ == '__main__':
    main()
