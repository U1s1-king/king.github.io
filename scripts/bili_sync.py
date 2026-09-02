# -*- coding: utf-8 -*-
"""Tomo Ebizuka · B站数据同步脚本
抓取粉丝/关注、用户资料卡、全站在线人数、视频播放数据 -> data/bili/stats.json
供 GitHub Actions 定时运行；本地手动运行亦可 (python scripts/bili_sync.py)
任一接口失败不影响其他数据；全部失败时保留旧文件。
"""
import datetime
import json
import os
import sys
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

API = 'https://api.bilibili.com'
MID = '1113834956'
BVIDS = ['BV1KbQ1YGEY8', 'BV1cuLdzUECX', 'BV1JzQpYTEft']
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'bili', 'stats.json')


def get(url, timeout=15):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def main():
    data = {}

    # 1. 粉丝/关注数
    try:
        d = get(f'{API}/x/relation/stat?vmid={MID}')['data']
        data['relation'] = {'follower': d.get('follower', 0), 'following': d.get('following', 0)}
        print('relation: 粉丝', data['relation']['follower'])
    except Exception as e:
        print('[skip] relation:', e)

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
        print('[skip] card:', e)

    # 3. 全站在线人数（各分区在线求和）
    try:
        d = get(f'{API}/x/web-interface/online')['data']
        data['online'] = {'total': sum(d.get('region_count', {}).values())}
        print('online:', data['online']['total'])
    except Exception as e:
        print('[skip] online:', e)

    # 4. 视频数据（标题/封面/播放/点赞/投币/收藏）
    vids = []
    for bv in BVIDS:
        try:
            d = get(f'{API}/x/web-interface/view?bvid={bv}')['data']
            st = d.get('stat', {}) or {}
            vids.append({
                'bvid': bv,
                'title': d.get('title', ''),
                'pic': d.get('pic', ''),
                'view': st.get('view', 0),
                'like': st.get('like', 0),
                'coin': st.get('coin', 0),
                'favorite': st.get('favorite', 0),
            })
            print('view:', bv, d.get('title', '')[:20])
        except Exception as e:
            print('[skip] view', bv, e)
    data['videos'] = vids

    data['updated_at'] = datetime.datetime.now().astimezone().isoformat(timespec='minutes')

    # 容错：全部失败则保留旧数据
    if not data.get('relation') and not data.get('card') and not data.get('videos'):
        print('所有接口均失败，保留旧数据不动')
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print('已写入:', OUT)


if __name__ == '__main__':
    main()
