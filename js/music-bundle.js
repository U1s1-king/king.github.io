const MUSIC_API_BASE = '';
const MUSIC_BASE = "https://sakura-music.pages.dev/music/";
const DB_NAME = 'SakuraMusicDB';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';
function openDB() {
return new Promise((resolve, reject) => {
const request = indexedDB.open(DB_NAME, DB_VERSION);
request.onupgradeneeded = (e) => {
const db = e.target.result;
if (!db.objectStoreNames.contains(STORE_NAME)) {
db.createObjectStore(STORE_NAME, { keyPath: 'id' });
}
};
request.onsuccess = () => resolve(request.result);
request.onerror = () => reject(request.error);
});
}
async function addUploadedFile(file, name, artist) {
const db = await openDB();
return new Promise((resolve, reject) => {
const tx = db.transaction(STORE_NAME, 'readwrite');
const store = tx.objectStore(STORE_NAME);
const record = {
id: 'up_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
name: name,
artist: artist || '本地音乐喵',
file: file,
timestamp: Date.now()
};
store.add(record);
tx.oncomplete = () => resolve(record.id);
tx.onerror = () => reject(tx.error);
});
}
async function getAllUploadedFiles() {
const db = await openDB();
return new Promise((resolve, reject) => {
const tx = db.transaction(STORE_NAME, 'readonly');
const store = tx.objectStore(STORE_NAME);
const request = store.getAll();
request.onsuccess = () => resolve(request.result || []);
request.onerror = () => reject(request.error);
});
}
async function clearUploadCache() {
const db = await openDB();
return new Promise((resolve, reject) => {
const tx = db.transaction(STORE_NAME, 'readwrite');
tx.objectStore(STORE_NAME).clear();
tx.oncomplete = resolve;
tx.onerror = reject;
});
}
let playlist = [
{ name: "Don't say \"lazy\"", artist: "放課後ティータイム", path: MUSIC_BASE + "放課後ティータイム - Dont saylazy.mp3" },
{ name: "ふわふわ時間 (轻飘飘时间)(映画「けいおん!」Mix)", artist: "放課後ティータイム", path: MUSIC_BASE + "放課後ティータイム - ふわふわ時間 (轻飘飘时间)(映画「けいおん!」Mix).mp3" },
{ name: "天使にふれたよ!", artist: "放課後ティータイム", path: MUSIC_BASE + "放課後ティータイム - 天使にふれたよ!.mp3" },
{ name: "あのバンド", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - あのバンド.mp3" },
{ name: "ギターと孤独と蒼い惑星 (吉他与孤独与蓝色星球)", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - ギターと孤独と蒼い惑星 (吉他与孤独与蓝色星球).mp3" },
{ name: "ひとりぼっち東京", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - ひとりぼっち東京.mp3" },
{ name: "ひみつ基地 (秘密基地)", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - ひみつ基地 (秘密基地).mp3" },
{ name: "忘れてやらない (绝不会忘记)", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - 忘れてやらない (绝不会忘记).mp3" },
{ name: "星座になれたら", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - 星座になれたら.mp3" },
{ name: "Lemon", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - Lemon.mp3" },
{ name: "LOSER", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - LOSER.mp3" },
{ name: "M八七", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - M八七.mp3" },
{ name: "Pale Blue", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - Pale Blue.mp3" },
{ name: "感電", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - 感電.mp3" },
{ name: "海の幽霊", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - 海の幽霊.mp3" },
{ name: "死神", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - 死神.mp3" },
{ name: "打上花火", artist: "米津玄師、Daoko", path: MUSIC_BASE + "米津玄師、Daoko - 打上花火.mp3" },
{ name: "Promise", artist: "Da-iCE", path: MUSIC_BASE + "Da-iCE_-_Promise.mp3" },
{ name: "KiLLKiSS", artist: "Ave Mujica", path: MUSIC_BASE + "Ave Mujica - KiLLKiSS.mp3" },
{ name: "白日", artist: "King Gnu", path: MUSIC_BASE + "King Gnu - 白日.mp3" },
{ name: "世末歌者", artist: "", path: MUSIC_BASE + "世末歌者.mp3" },
{ name: "Re_Re_", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - Re_Re_.mp3" },
{ name: "Starlight", artist: "超特急", path: MUSIC_BASE + "超特急_-_Starlight.mp3" },
{ name: "恋ひ恋う縁 (以恋结缘)", artist: "KOTOKO", path: MUSIC_BASE + "KOTOKO - 恋ひ恋う縁 (以恋结缘).mp3" },
{ name: "Tori No Uta", artist: "Lia", path: MUSIC_BASE + "Lia - Tori No Uta.mp3" },
{ name: "ウルトラマンギンガの歌", artist: "voyager/千紗/マリア春菜/竹内浩明/根岸拓哉/宮武美桜/大野瑞生/雲母/草川拓弥", path: MUSIC_BASE + "voyager_千紗_マリア春菜_竹内浩明_根岸拓哉_宮武美桜_大野瑞生_雲母_草川拓弥 - ウルトラマンギンガの歌.mp3" },
{ name: "顔", artist: "Ave Mujica", path: MUSIC_BASE + "Ave Mujica - 顔.mp3" },
{ name: "キボウノカケラ", artist: "ボイジャー", path: MUSIC_BASE + "ボイジャー - キボウノカケラ.mp3" },
{ name: "反乌托邦", artist: "", path: MUSIC_BASE + "反乌托邦.mp3" },
{ name: "恋愛サーキュレーション", artist: "花澤香菜", path: MUSIC_BASE + "花澤香菜 - 恋愛サーキュレーション.mp3" },
{ name: "九重现实", artist: "洛天依/言和/乐正绫", path: MUSIC_BASE + "洛天依、言和、乐正绫 - 九重现实.mp3" },
{ name: "secret base ~君がくれたもの~", artist: "茅野愛衣/戸松遥/早見沙織", path: MUSIC_BASE + "茅野愛衣_戸松遥_早見沙織 - secret base ~君がくれたもの~.mp3" },
{ name: "One Last Kiss", artist: "宇多田ヒカル", path: MUSIC_BASE + "宇多田ヒカル - One Last Kiss.mp3" },
{ name: "僕が死のうと思ったのは", artist: "中岛美嘉", path: MUSIC_BASE + "中岛美嘉_-_僕が死のうと思ったのは.mp3" },
{ name: "AIscream", artist: "", path: MUSIC_BASE + "AIscream.mp3" },
{ name: "TWO_AS_ONE", artist: "Da-iCE", path: MUSIC_BASE + "Da-iCE_-_TWO_AS_ONE.mp3" },
{ name: "サヨナラサヨナラサヨナラ", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - サヨナラサヨナラサヨナラ (再见再见再见).mp3" },
{ name: "ダレモ", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - ダレモ.mp3" },
{ name: "闇に溶けてく", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 闇に溶けてく.mp3" },
{ name: "爆ぜて咲く", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 爆ぜて咲く (爆裂绽放).mp3" },
{ name: "蝶に結いた赤い糸", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 蝶に結いた赤い糸.mp3" },
{ name: "飛べない蝶は夢を見る", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 飛べない蝶は夢を見る.mp3" },
{ name: "極私的極彩色アンサー", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 極私的極彩色アンサー.mp3" },
{ name: "空の箱", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 空の箱.mp3" },
{ name: "空白とカタルシス", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 空白とカタルシス.mp3" },
{ name: "黎明を穿つ", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 黎明を穿つ.mp3" },
{ name: "理想的パラドクスとは", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 理想的パラドクスとは.mp3" },
{ name: "名もなき何もかも", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 名もなき何もかも.mp3" },
{ name: "気鬱、白濁す", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 気鬱、白濁す (white drizzle in gloom).mp3" },
{ name: "傷つき傷つけ痛くて辛い", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 傷つき傷つけ痛くて辛い.mp3" },
{ name: "視界の隅 朽ちる音", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 視界の隅 朽ちる音.mp3" },
{ name: "声なき魚", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 声なき魚.mp3" },
{ name: "誰にもなれない私だから", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 誰にもなれない私だから.mp3" },
{ name: "偽りの理", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 偽りの理.mp3" },
{ name: "心象的フラクタル", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 心象的フラクタル.mp3" },
{ name: "運命に賭けたい論理", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 運命に賭けたい論理.mp3" },
{ name: "運命の華", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 運命の華.mp3" },
{ name: "雑踏、僕らの街", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "トゲナシトゲアリ - 雑踏、僕らの街.mp3" },
{ name: "碧いif", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "碧いif.mp3" },
{ name: "吹き消した灯火", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "吹き消した灯火.mp3" },
{ name: "無知のち私", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "無知のち私.mp3" },
{ name: "臆病な白夜", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "臆病な白夜.mp3" },
{ name: "最期の禱り", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "最期の禱り.mp3" },
{ name: "猛独が襲う (Deathly Loneliness Attacks)", artist: "MyGO!!!!!", path: MUSIC_BASE + "MyGO!!!!! - 猛独が襲う (Deathly Loneliness Attacks).mp3" },
{ name: "迷星叫", artist: "MyGO!!!!!", path: MUSIC_BASE + "MyGO!!!!! - 迷星叫.mp3" },
{ name: "壱雫空", artist: "MyGO!!!!!", path: MUSIC_BASE + "MyGO!!!!! - 壱雫空.mp3" },
{ name: "影色舞", artist: "MyGO!!!!!", path: MUSIC_BASE + "MyGO!!!!! - 影色舞.mp3" },
{ name: "春日影 (MyGO!!!!! ver.)", artist: "MyGO!!!!!", path: MUSIC_BASE + "MyGO!!!!! - 春日影 (MyGO!!!!! ver.).mp3" },
{ name: "スパークル", artist: "RADWIMPS", path: MUSIC_BASE + "RADWIMPS - スパークル.mp3" },
{ name: "なんでもないや", artist: "RADWIMPS", path: MUSIC_BASE + "RADWIMPS - なんでもないや.mp3" },
{ name: "夢灯籠", artist: "RADWIMPS", path: MUSIC_BASE + "RADWIMPS - 夢灯籠.mp3" },
{ name: "前前前世", artist: "RADWIMPS", path: MUSIC_BASE + "RADWIMPS - 前前前世.mp3" },
{ name: "Watch me!", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - Watch me!.mp3" },
{ name: "あの夢をなぞって", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - あの夢をなぞって.mp3" },
{ name: "アンコール (安可)", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - アンコール (安可).mp3" },
{ name: "ラブレター", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - ラブレター.mp3" },
{ name: "大正浪漫", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - 大正浪漫.mp3" },
{ name: "怪物", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - 怪物.mp3" },
{ name: "群青", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - 群青.mp3" },
{ name: "夜に駆ける", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - 夜に駆ける.mp3" },
{ name: "ずっとずっとずっと", artist: "緑黄色社会", path: MUSIC_BASE + "緑黄色社会 - ずっとずっとずっと.mp3" },
{ name: "妄想感傷代償連盟", artist: "初音未来", path: MUSIC_BASE + "DECO×27、初音ミク_-_妄想感傷代償連盟.mp3" },
{ name: "可愛くてごめん", artist: "HoneyWorks、早見沙織", path: MUSIC_BASE + "HoneyWorks、早見沙織 - 可愛くてごめん.mp3" },
{ name: "Sinos De Natal", artist: "MGD、MXZHPHXNK", path: MUSIC_BASE + "MGD、MXZHPHXNK - Sinos De Natal.mp3" },
{ name: "NIGHT DANCER", artist: "imase", path: MUSIC_BASE + "NIGHT DANCER - imase.mp3" },
{ name: "テト - うそつきマカロン", artist: "重音", path: MUSIC_BASE + "暴飲暴食P、重音テト - うそつきマカロン.mp3" },
{ name: "鏡音リン、ピノキオピー_-_ねぇねぇねぇ。", artist: "初音未来", path: MUSIC_BASE + "初音ミク、鏡音リン、ピノキオピー_-_ねぇねぇねぇ。.mp3" },
{ name: "青春コンプレックス", artist: "結束バンド", path: MUSIC_BASE + "結束バンド - 青春コンプレックス.mp3" },
{ name: "優しい彗星", artist: "YOASOBI", path: MUSIC_BASE + "YOASOBI - 優しい彗星.mp3" },
{ name: "unravel", artist: "TK from 凛冽时雨", path: MUSIC_BASE + "TK_from_凛冽时雨_-_unravel.mp3" },
{ name: "真夜中のドア/Stay With Me (深夜门扉/留在我身边)", artist: "松原みき", path: MUSIC_BASE + "真夜中のドアStay With Me (深夜门扉留在我身边).mp3" },
{ name: "Barricades", artist: "澤野弘之", path: MUSIC_BASE + "澤野弘之 - Barricades.mp3" },
{ name: "Call of Silence", artist: "澤野弘之", path: MUSIC_BASE + "澤野弘之 - Call of Silence.mp3" },
{ name: "theDOGS", artist: "澤野弘之", path: MUSIC_BASE + "澤野弘之 - theDOGS.mp3" },
{ name: "Daydream_SQ", artist: "AxR", path: MUSIC_BASE + "AxR_-_Daydream_SQ.mp3" },
{ name: "desolate", artist: "ByErik ヵ", path: MUSIC_BASE + "ByErik ヵ - desolate.mp3" },
{ name: "Instruments of Retribution", artist: "Daniel Deluxe", path: MUSIC_BASE + "Daniel_Deluxe_-_Instruments_of_Retribution.mp3" },
{ name: "天气之子幻(钢琴版)", artist: "dylanf", path: MUSIC_BASE + "dylanf_-_天气之子幻(钢琴版).mp3" },
{ name: "HEAVENLY JUMPSTYLE(西蒙海耶小曲)", artist: "INFINITY ICE", path: MUSIC_BASE + "INFINITY ICE - HEAVENLY JUMPSTYLE.mp3" },
{ name: "Money So Big", artist: "Muppet DJ、SECA Records", path: MUSIC_BASE + "Muppet DJ、SECA Records - Money So Big.mp3" },
{ name: "Melodic Minor(感觉至上）", artist: "Park Choi", path: MUSIC_BASE + "Park Choi - Melodic Minor.mp3" },
{ name: "Heroes 2.0", artist: "RJ Pasin", path: MUSIC_BASE + "RJ_Pasin_-_Heroes_2.0.mp3" },
{ name: "「ねえ！○○ちゃんまだぁ〜？？？？」", artist: "さんうさぎ", path: MUSIC_BASE + "さんうさぎ_-_「ねえ！○○ちゃんまだぁ〜？？？？」.mp3" },
{ name: "3：30PM", artist: "しゃろう", path: MUSIC_BASE + "しゃろう_-_3：30PM.mp3" },
{ name: "おはなばたけ (花田)", artist: "近藤浩治", path: MUSIC_BASE + "近藤浩治_-_おはなばたけ_(花田).mp3" },
{ name: "怪物之歌", artist: "酸电池", path: MUSIC_BASE + "酸电池_-_怪物之歌.mp3" },
{ name: "愛♡スクリ～ム！", artist: "AIscream", path: MUSIC_BASE + "AIscream_-_愛♡スクリ～ム！.mp3" },
{ name: "Where Did Your Love Go?", artist: "Dawid Podsiadlo", path: MUSIC_BASE + "Dawid_Podsiadlo_-_Where_Did_Your_Love_Go_.mp3" },
{ name: "Cry For Me (feat. Ami)", artist: "Michita", path: MUSIC_BASE + "Michita - Cry For Me (feat. Ami).mp3" },
{ name: "あーあーあーあーあー", artist: "agehasprings", path: MUSIC_BASE + "agehasprings - あーあーあーあーあー.mp3" },
{ name: "渇く、憂う", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "渇く、憂う.mp3" },
{ name: "生きて生きていく", artist: "トゲナシトゲアリ", path: MUSIC_BASE + "生きて生きていく.mp3" },
{ name: "おしんこ_SQ", artist: "田中ユウスケ", path: MUSIC_BASE + "田中ユウスケ - おしんこ_SQ.mp3" },
{ name: "ココロのウーロン茶_SQ", artist: "田中ユウスケ", path: MUSIC_BASE + "田中ユウスケ - ココロのウーロン茶_SQ.mp3" },
{ name: "袋小路", artist: "田中ユウスケ", path: MUSIC_BASE + "田中ユウスケ - 袋小路.mp3" },
{ name: "雑踏、僕らの街 (Wrong World)(彷徨う)_SQ", artist: "田中ユウスケ", path: MUSIC_BASE + "田中ユウスケ - 雑踏、僕らの街 (Wrong World)(彷徨う)_SQ.mp3" },
{ name: "SHAZAI（謝）", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - SHAZAI（謝）.mp3" },
{ name: "ありがとう。ベニショーガ魂", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - ありがとう。ベニショーガ魂.mp3" },
{ name: "たぶん気分（ねぎぬき）", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - たぶん気分（ねぎぬき）.mp3" },
{ name: "むかしからの老舗〜持ち時間20分", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - むかしからの老舗〜持ち時間20分.mp3" },
{ name: "フェスで人気でそうなバンドの曲", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - フェスで人気でそうなバンドの曲.mp3" },
{ name: "十七歳三月", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - 十七歳三月.mp3" },
{ name: "嘘とconfuse", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - 嘘とconfuse.mp3" },
{ name: "孤孤孤孤独（腰痛）", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - 孤孤孤孤独（腰痛）.mp3" },
{ name: "恍惚の定理", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - 恍惚の定理.mp3" },
{ name: "誤解と高卒", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - 誤解と高卒.mp3" },
{ name: "雨と疾走とマニフェスト", artist: "田中ユウスケ/agehasprings", path: MUSIC_BASE + "田中ユウスケ_agehasprings - 雨と疾走とマニフェスト.mp3" },
{ name: "BOW AND ARROW", artist: "米津玄師", path: MUSIC_BASE + "米津玄師 - BOW AND ARROW.mp3" },
];
let currentIndex = 0;
let isPlaying = false;
let playMode = "normal";
let shuffleIndices = [];
let playbackRateVal = 1.0;
let playFailCount = 0;
const DEFAULT_COVER = "img/mortis.webp";
const audio = document.getElementById('nativeAudio');
const playBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playPauseIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressFill = document.getElementById('progressFill');
const progressBg = document.getElementById('progressBg');
const curTimeSpan = document.getElementById('currentTime');
const totalDurSpan = document.getElementById('totalDuration');
const volumeRange = document.getElementById('volumeRange');
const coverImg = document.getElementById('coverImg');
const coverInner = document.getElementById('coverInner');
const trackNameSpan = document.getElementById('trackName');
const trackArtistSpan = document.getElementById('trackArtist');
const playlistContainer = document.getElementById('playlistContainer');
const songCountSpan = document.getElementById('songCount');
const lyricBox = document.getElementById('lyricBox');
const repeatBtn = document.getElementById('repeatModeBtn');
const shuffleBtn = document.getElementById('shuffleModeBtn');
const speedValSpan = document.getElementById('speedVal');
let spectrumBars = [];
let spectrumInterval = null;
function formatTime(sec) { if(isNaN(sec)) return '0:00'; let m = Math.floor(sec/60), s = Math.floor(sec%60); return `${m}:${s<10?'0'+s:s}`; }
function showMsg(msg) { let t = document.getElementById('toastMsg'); t.textContent = msg; t.style.display='block'; setTimeout(()=>t.style.display='none',2000); }
function escapeHtml(str) { return str.replace(/[&<>]/g, function(m){return m==='&'?'&amp;':m==='<'?'&lt;':'&gt;';}); }
function initSpectrum() {
const container = document.getElementById('spectrumBars');
if (!container) return;
container.innerHTML = '';
const barCount = window.innerWidth < 700 ? 20 : 28;
for(let i = 0; i < barCount; i++) {
let bar = document.createElement('div');
bar.className = 'spectrum-bar';
container.appendChild(bar);
spectrumBars.push(bar);
}
}
function startSpectrum() {
if (spectrumInterval) clearInterval(spectrumInterval);
spectrumInterval = setInterval(() => {
if (!isPlaying) return;
const vol = audio.volume || 0.7;
for (let i = 0; i < spectrumBars.length; i++) {
const randomPeak = Math.random() * 45 * vol;
const sineFactor = Math.sin(Date.now() / 180 + i * 0.25) * 12;
let height = 6 + randomPeak + sineFactor;
height = Math.min(62, Math.max(6, height));
spectrumBars[i].style.height = height + 'px';
}
}, 85);
}
function stopSpectrum() {
if (spectrumInterval) {
clearInterval(spectrumInterval);
spectrumInterval = null;
}
for (let bar of spectrumBars) {
bar.style.height = '6px';
}
}
/* ===== 收藏 / 歌单删除（UX 增强；删除为本次访问生效，刷新后歌单还原）===== */
let favOnly = false;
let favList = [];
try { favList = JSON.parse(localStorage.getItem('sakuraFavs') || '[]') || []; } catch (e) { favList = []; }
function favKey(s) { return (s.name || '') + '\u0001' + (s.artist || ''); }
function isFav(s) { return favList.indexOf(favKey(s)) >= 0; }
function toggleFav(s) {
if (!s) return;
var k = favKey(s);
var i = favList.indexOf(k);
if (i >= 0) favList.splice(i, 1); else favList.push(k);
try { localStorage.setItem('sakuraFavs', JSON.stringify(favList)); } catch (err) {}
updateList();
}
function canDeleteTrack(s) { return !!(s && (s.isUserUploaded || s.online || s.uploaded)); }
function removeFromPlaylist(idx) {
if (idx < 0 || idx >= playlist.length) return;
var wasCurrent = idx === currentIndex;
var name = playlist[idx] ? playlist[idx].name : '';
playlist.splice(idx, 1);
if (currentIndex > idx) currentIndex--;
if (wasCurrent) {
if (playlist.length === 0) {
audio.pause();
audio.removeAttribute('src');
audio.load();
trackNameSpan.innerText = '🌸 空空的喵';
trackArtistSpan.innerText = '点击 添加音乐';
totalDurSpan.innerText = '0:00';
curTimeSpan.innerText = '0:00';
playIcon.className = 'fas fa-play';
coverInner.classList.remove('playing');
stopSpectrum();
setMediaPlaybackState('paused');
} else {
if (currentIndex >= playlist.length) currentIndex = playlist.length - 1;
play(currentIndex);
}
} else {
updateList();
}
showMsg('已从歌单删除：' + name);
}
var favOnlyBtn = document.getElementById('favOnlyBtn');
if (favOnlyBtn) favOnlyBtn.addEventListener('click', function () {
favOnly = !favOnly;
favOnlyBtn.classList.toggle('active', favOnly);
updateList();
showMsg(favOnly ? '只看收藏 ♥' : '显示全部歌单');
});
function updateList() {
var showing = favOnly ? playlist.filter(isFav) : playlist;
let html = '';
showing.forEach((s) => {
var realIdx = playlist.indexOf(s);
let active = realIdx === currentIndex ? 'active' : '';
var favCls = isFav(s) ? 'on' : '';
var delBtn = canDeleteTrack(s) ? '<button class="track-del" data-del="' + realIdx + '" title="从歌单删除"><i class="fas fa-times"></i></button>' : '';
html += `<div class="track-item ${active}" data-idx="${realIdx}">
<div class="track-info"><i class="fas fa-music" style="color:#db8faa;"></i> ${escapeHtml(s.name)}</div>
<div class="track-duration">${s.dur || '0:00'}</div>
<button class="track-fav ${favCls}" data-fav="${realIdx}" title="收藏"><i class="fas fa-heart"></i></button>
${delBtn}
</div>`;
});
if(showing.length === 0) {
playlistContainer.innerHTML = favOnly ? '<div style="text-align:center;color:#b98297;padding:20px;">还没有收藏的歌曲喵～点歌单里的 ♥ 试试</div>' : '<div style="text-align:center;color:#b98297;padding:20px;">🌸 暂无歌曲，点击右上角上传喵~</div>';
} else {
playlistContainer.innerHTML = html;
}
songCountSpan.innerText = `${playlist.length} 首`;
document.querySelectorAll('.track-item').forEach(el => {
el.addEventListener('click', (e) => {
if (e.target.closest && (e.target.closest('.track-del') || e.target.closest('.track-fav'))) return;
let idx = parseInt(el.dataset.idx); if(!isNaN(idx)) play(idx);
});
});
document.querySelectorAll('.track-del').forEach(el => {
el.addEventListener('click', (e) => { e.stopPropagation(); removeFromPlaylist(parseInt(el.dataset.del)); });
});
document.querySelectorAll('.track-fav').forEach(el => {
el.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(playlist[parseInt(el.dataset.fav)]); });
});
var act = playlistContainer.querySelector('.track-item.active');
if (act) { try { act.scrollIntoView({ block: 'nearest' }); } catch (err) { act.scrollIntoView(); } }
}
function play(idx) {
if(playlist.length === 0) {
showMsg('歌单空空如也，请先添加音乐喵~');
return;
}
if(idx < 0 || idx >= playlist.length) return;
currentIndex = idx;
let s = playlist[currentIndex];
trackNameSpan.innerText = s.name;
trackArtistSpan.innerText = s.artist;
coverImg.src = DEFAULT_COVER;
audio.src = s.path;
audio.load();
audio.playbackRate = playbackRateVal;
audio.addEventListener('loadedmetadata', function onLoad() {
playFailCount = 0;
totalDurSpan.innerText = formatTime(audio.duration);
if(playlist[currentIndex] && !playlist[currentIndex].durFixed) {
playlist[currentIndex].dur = formatTime(audio.duration);
playlist[currentIndex].durFixed = true;
updateList();
}
audio.removeEventListener('loadedmetadata', onLoad);
}, { once: true });
if(isPlaying) audio.play().catch((err)=>{
if (err && err.name === 'NotAllowedError') { showMsg('自动播放被浏览器拦截，请点击播放按钮喵～'); return; }
/* 真正的加载失败由 audio error 事件统一处理（细分文案 + 自动跳歌） */
});
progressFill.style.width = '0%';
curTimeSpan.innerText = '0:00';
updateList();
lyricBox.innerHTML = ` 正在播放: ${s.name} · ${s.artist} 🌸 wink喵~`;
updateMediaSession(s);
}
/* ===== 断点续播 / 键盘快捷键（UX 增强） ===== */
const PLAY_STATE_KEY = 'sakuraPlay';
let lastSavePlayAt = 0;
function savePlayState() {
var s = playlist[currentIndex];
if (!s || !audio || !audio.src) return;
try {
localStorage.setItem(PLAY_STATE_KEY, JSON.stringify({ name: s.name, artist: s.artist, t: audio.currentTime || 0 }));
} catch (err) {}
}
function restorePlayback() {
var saved = null;
try { saved = JSON.parse(localStorage.getItem(PLAY_STATE_KEY) || 'null'); } catch (e) {}
if (!saved || !saved.name || playlist.length === 0) return;
var idx = -1;
for (var i = 0; i < playlist.length; i++) {
if (playlist[i] && playlist[i].name === saved.name && (playlist[i].artist || '') === (saved.artist || '')) { idx = i; break; }
}
if (idx < 0) return;
currentIndex = idx;
var s = playlist[idx];
trackNameSpan.innerText = s.name;
trackArtistSpan.innerText = s.artist;
coverImg.src = DEFAULT_COVER;
audio.src = s.path;
audio.load();
audio.addEventListener('loadedmetadata', function onMeta() {
var t = Math.min(saved.t || 0, Math.max(0, (audio.duration || 1) - 1));
audio.currentTime = t;
progressFill.style.width = ((t / (audio.duration || 1)) * 100) + '%';
curTimeSpan.innerText = formatTime(t);
totalDurSpan.innerText = formatTime(audio.duration);
audio.removeEventListener('loadedmetadata', onMeta);
}, { once: true });
updateMediaSession(s);
updateList();
showMsg('上次听到「' + s.name + '」' + formatTime(saved.t || 0) + '，点播放继续喵～');
}
function adjustVolume(delta) {
if (!audio) return;
var v = Math.min(1, Math.max(0, (audio.volume || 0) + delta));
audio.volume = v;
volumeRange.value = v;
try { localStorage.setItem('sakuraVol', String(v)); } catch (err) {}
}
document.addEventListener('keydown', function (e) {
var tag = (e.target && e.target.tagName) ? e.target.tagName : '';
if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (typeof playPause === 'function') playPause(); }
else if (e.key === 'ArrowRight') { if (typeof next === 'function') next(); }
else if (e.key === 'ArrowLeft') { if (typeof prev === 'function') prev(); }
else if (e.key === 'ArrowUp') { adjustVolume(0.05); }
else if (e.key === 'ArrowDown') { adjustVolume(-0.05); }
});
function playPause() {
if(playlist.length === 0){ showMsg('请先添加一些歌曲，点击右侧'); return; }
if(isPlaying) {
audio.pause();
isPlaying=false;
playIcon.className='fas fa-play';
coverInner.classList.remove('playing');
stopSpectrum();
setMediaPlaybackState('paused');
} else {
if(!audio.src || audio.ended) {
if(currentIndex >= playlist.length) currentIndex = 0;
if(playlist[currentIndex]) play(currentIndex);
else return;
}
audio.play().then(()=>{
isPlaying=true;
playIcon.className='fas fa-pause';
coverInner.classList.add('playing');
startSpectrum();
setMediaPlaybackState('playing');
}).catch((e)=>{ showMsg(e && e.name === 'NotAllowedError' ? '自动播放被浏览器拦截，请点击播放按钮喵～' : '播放失败喵～'); });
}
}
/* ===== MediaSession 锁屏/系统媒体控制（体验增强） ===== */
function updateMediaSession(song) {
if (!('mediaSession' in navigator) || !('MediaMetadata' in window) || !song) return;
try {
navigator.mediaSession.metadata = new MediaMetadata({
title: song.name || '未知歌曲',
artist: song.artist || '未知歌手',
album: '音乐',
artwork: [{ src: new URL(DEFAULT_COVER, location.href).href, sizes: '512x512', type: 'image/png' }]
});
navigator.mediaSession.setActionHandler('play', function () { if (typeof playPause === 'function') playPause(); });
navigator.mediaSession.setActionHandler('pause', function () { if (typeof playPause === 'function') playPause(); });
navigator.mediaSession.setActionHandler('previoustrack', function () { if (typeof prev === 'function') prev(); });
navigator.mediaSession.setActionHandler('nexttrack', function () { if (typeof next === 'function') next(); });
} catch (err) {}
}
function setMediaPlaybackState(state) {
if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = state; } catch (err) {} }
}
function next() {
if(playlist.length === 0) return;
if(playMode === 'shuffle'){
if(shuffleIndices.length !== playlist.length) reshuffle();
let pos = (shuffleIndices.indexOf(currentIndex)+1) % shuffleIndices.length;
play(shuffleIndices[pos]);
} else {
play((currentIndex+1) % playlist.length);
}
}
function prev() {
if(playlist.length === 0) return;
if(playMode === 'shuffle'){
if(shuffleIndices.length !== playlist.length) reshuffle();
let pos = (shuffleIndices.indexOf(currentIndex)-1+shuffleIndices.length) % shuffleIndices.length;
play(shuffleIndices[pos]);
} else {
play((currentIndex-1+playlist.length) % playlist.length);
}
}
function reshuffle() {
shuffleIndices = [...Array(playlist.length).keys()];
for(let i=shuffleIndices.length-1;i>0;i--){
let j=Math.floor(Math.random()*(i+1));
[shuffleIndices[i],shuffleIndices[j]]=[shuffleIndices[j],shuffleIndices[i]];
}
}
function updateProgress() {
if(!audio.src || isNaN(audio.duration)) return;
let p = (audio.currentTime / audio.duration) * 100;
progressFill.style.width = `${p}%`;
curTimeSpan.innerText = formatTime(audio.currentTime);
if(totalDurSpan.innerText === '0:00' && audio.duration>0) totalDurSpan.innerText = formatTime(audio.duration);
if (audio.currentTime - lastSavePlayAt >= 10) { lastSavePlayAt = audio.currentTime; savePlayState(); }
}
let pendingFiles = [];
const uploadModal = document.getElementById('uploadModal');
document.getElementById('uploadTrigger').onclick = () => uploadModal.style.display = 'flex';
document.getElementById('closeUploadModal').onclick = () => uploadModal.style.display = 'none';
document.getElementById('dropArea').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = (e) => {
pendingFiles = Array.from(e.target.files);
document.getElementById('filePreviewList').innerHTML = pendingFiles.map(f => `<span class="file-chip" style="background:#FCEAF1; padding:2px 12px; border-radius:30px; margin:2px;"> ${escapeHtml(f.name)}</span>`).join('');
};
document.getElementById('confirmUploadBtn').onclick = async () => {
if(pendingFiles.length === 0){ showMsg('请选择音乐文件喵'); return; }
let addedCount = 0;
for(let f of pendingFiles){
let url = URL.createObjectURL(f);
let name = f.name.replace(/\.[^/.]+$/, '');
let temp = new Audio();
temp.src = url;
let dur = '0:00';
await new Promise(resolve => {
temp.addEventListener('loadedmetadata', () => { dur = formatTime(temp.duration); resolve(); }, { once: true });
setTimeout(resolve, 400);
});
try {
await addUploadedFile(f, name, '本地音乐喵');
} catch (e) {
console.warn('保存到 IndexedDB 失败：', e);
showMsg('缓存保存失败，本次播放不受影响，但刷新后可能需要重新上传');
}
playlist.push({
name: name,
artist: '本地音乐喵',
path: url,
dur: dur,
durFixed: true,
cover: null,
isUserUploaded: true
});
addedCount++;
}
updateList();
if(playlist.length > 0 && (!audio.src || audio.ended)) {
play(0);
}
uploadModal.style.display = 'none';
pendingFiles = [];
document.getElementById('filePreviewList').innerHTML = '';
document.getElementById('fileInput').value = '';
showMsg(` 成功添加 ${addedCount} 首歌曲~ ヽ(=^･ω･^=)丿`);
};
window.onclick = (e) => { if(e.target.classList.contains('modal-global')) e.target.style.display = 'none'; };
playBtn.addEventListener('click', playPause);
prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);
volumeRange.addEventListener('input', (e) => { audio.volume = e.target.value; try { localStorage.setItem('sakuraVol', String(e.target.value)); } catch (err) {} });
progressBg.addEventListener('click', (e) => { if(audio.duration && !isNaN(audio.duration)){ let rect = progressBg.getBoundingClientRect(); let p = (e.clientX - rect.left) / rect.width; audio.currentTime = p * audio.duration; } });
audio.addEventListener('timeupdate', updateProgress);
var audioErrLastSrc = '';
audio.addEventListener('error', function () {
if (!audio.src || audioErrLastSrc === audio.src) return;
audioErrLastSrc = audio.src;
var code = audio.error ? audio.error.code : -1;
var msg = '播放出错喵～';
if (code === 4) msg = '文件格式不支持或已损坏喵～';
else if (code === 2) msg = '网络错误，歌曲加载失败喵～';
else if (code === 3) msg = '音频解码失败喵～';
else if (code === 1) msg = '播放被浏览器中止喵～';
if (isPlaying && typeof next === 'function') {
playFailCount++;
if (playFailCount >= Math.max(1, playlist.length)) {
playFailCount = 0;
showMsg('歌单中的歌曲可能都无法播放喵～请检查网络或换一批歌');
return;
}
showMsg(msg + '，自动切到下一首');
setTimeout(function () { if (typeof next === 'function') next(); }, 300);
} else {
showMsg(msg);
}
});
audio.addEventListener('pause', function () { savePlayState(); });
audio.addEventListener('ended', () => {
if(playMode === 'repeat'){
audio.currentTime = 0;
audio.play().catch(() => showMsg('自动重播失败'));
} else {
next();
}
});
repeatBtn.addEventListener('click', () => { playMode = playMode==='repeat'?'normal':'repeat'; repeatBtn.classList.toggle('active',playMode==='repeat'); shuffleBtn.classList.remove('active'); showMsg(playMode==='repeat'?' 单曲循环' : ' 顺序播放'); });
shuffleBtn.addEventListener('click', () => { if(playMode!=='shuffle'){ playMode='shuffle'; reshuffle(); shuffleBtn.classList.add('active'); repeatBtn.classList.remove('active'); showMsg(' 随机模式'); } else { playMode='normal'; shuffleBtn.classList.remove('active'); showMsg(' 顺序模式'); } });
document.getElementById('speedBtn').addEventListener('click', () => { let rates=[0.8,1.0,1.2,1.5]; let idx=rates.indexOf(playbackRateVal); playbackRateVal=rates[(idx+1)%rates.length]; audio.playbackRate=playbackRateVal; speedValSpan.innerText=playbackRateVal.toFixed(2)+'x'; });
var savedVol = 0.7;
try { var _v = parseFloat(localStorage.getItem('sakuraVol')); if (!isNaN(_v)) savedVol = Math.min(1, Math.max(0, _v)); } catch (err) {}
audio.volume = savedVol;
volumeRange.value = savedVol;
async function loadLocalSongs() {
try {
const records = await getAllUploadedFiles();
if (!records || records.length === 0) return;
records.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
let loadedCount = 0;
for (let rec of records) {
let url = URL.createObjectURL(rec.file);
playlist.push({
name: rec.name,
artist: rec.artist || '本地音乐喵',
path: url,
dur: '0:00',
durFixed: false,
cover: null,
isUserUploaded: true,
idbKey: rec.id
});
loadedCount++;
}
updateList();
if (loadedCount > 0) {
showMsg(` 已自动恢复 ${loadedCount} 首本地音乐~`);
}
} catch (e) {
console.warn('恢复本地音乐失败：', e);
}
}
document.getElementById('clearUploadCacheBtn')?.addEventListener('click', async () => {
if (!confirm('确定要清空所有已上传的本地音乐缓存吗？')) return;
try {
await clearUploadCache();
playlist = playlist.filter(s => !s.isUserUploaded);
if (currentIndex >= playlist.length) currentIndex = 0;
if (playlist.length > 0) {
if (!audio.src || playlist[currentIndex]?.path !== audio.src) {
play(0);
}
} else {
audio.pause();
audio.removeAttribute('src');
audio.load();
trackNameSpan.innerText = '🌸 空空的喵';
trackArtistSpan.innerText = '点击 添加音乐';
totalDurSpan.innerText = '0:00';
curTimeSpan.innerText = '0:00';
playIcon.className = 'fas fa-play';
coverInner.classList.remove('playing');
stopSpectrum();
}
updateList();
showMsg('已清空本地音乐缓存');
} catch (e) {
showMsg('清空失败喵');
}
});
updateList();
coverImg.src = DEFAULT_COVER;
initSpectrum();
loadLocalSongs().then(restorePlayback);
/*花瓣动画与 Service Worker 注册已统一移至 common.js */
(function () {
var grid = document.getElementById('worksGrid');
var filterTabs = document.getElementById('filterTabs');
if (!grid || !filterTabs) return;
var currentFilter = 'all';
var works = [];
var palettes = [
['#fbd9e4','#f0a0ba'],['#fce4ec','#f8bbd0'],['#f3e5f5','#e1bee7'],
['#e8eaf6','#c5cae9'],['#e0f7fa','#b2ebf2'],['#f1f8e9','#dcedc8'],
['#fff8e1','#ffecb3'],['#fbe9e7','#ffccbc'],['#fce4ec','#f48fb1'],
['#f3e5f5','#ce93d8'],['#e8eaf6','#9fa8da'],['#e0f2f1','#80cbc4'],
['#fff3e0','#ffcc80'],['#fbe9e7','#ffab91'],['#f1f8e9','#aed581'],
['#fff8e1','#ffd54f'],['#e0f7fa','#4dd0e1'],['#fce4ec','#ec407a'],
['#f3e5f5','#ab47bc'],['#e8eaf6','#5c6bc0']
];
function gradient(i) { var p = palettes[i % palettes.length]; return p[0] + ',' + p[1]; }
function getArtists(data) {
var set = {};
data.forEach(function (d) { if (d.artist && d.artist.trim()) set[d.artist.trim()] = 1; });
return Object.keys(set).sort();
}
function esc(s) {
if (!s) return '';
return String(s).replace(/[&<>]/g, function (m) {
return m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;';
});
}
function renderWorks(filter) {
var data = filter === 'all' ? works : works.filter(function (w) { return w.artist === filter; });
if (data.length === 0) {
grid.innerHTML = '<div class="empty-works"><i class="fas fa-cherry-blossom" style="font-size:2rem;opacity:0.5;"></i><p style="margin-top:10px;">🌸 没有找到作品喵～</p></div>';
return;
}
var html = '';
data.forEach(function (w, idx) {
html += '<div class="work-card" data-idx="' + w._idx + '">' +
'<div class="card-cover" style="background:linear-gradient(145deg,' + gradient(w._idx) + ');">' +
'<i class="fas fa-compact-disc"></i>' +
'<div class="play-overlay"><div class="play-circle"><i class="fas fa-play"></i></div></div>' +
'</div>' +
'<div class="card-body">' +
'<div class="card-title" title="' + esc(w.name) + '">' + esc(w.name) + '</div>' +
'<div class="card-artist" title="' + esc(w.artist || '未知') + '">' + esc(w.artist || '未知') + '</div>' +
'<div class="card-footer">' +
'<span class="card-tag"><i class="fas fa-tag"></i> ' + esc(w.artist || '未知') + '</span>' +
'<span class="card-dur"><i class="far fa-clock"></i> ' + (w.dur || '0:00') + '</span>' +
'</div></div></div>';
});
grid.innerHTML = html;
var cards = grid.querySelectorAll('.work-card');
Array.prototype.forEach.call(cards, function (el) {
el.addEventListener('click', function () {
var realIdx = parseInt(this.dataset.idx);
if (isNaN(realIdx)) return;
if (typeof play === 'function') play(realIdx);
if (typeof isPlaying !== 'undefined') isPlaying = true;
if (typeof playIcon !== 'undefined') playIcon.className = 'fas fa-pause';
if (typeof coverInner !== 'undefined') coverInner.classList.add('playing');
if (typeof startSpectrum === 'function') startSpectrum();
if (typeof audio !== 'undefined' && audio && audio.src) {
audio.play().catch(function () {
if (typeof showMsg === 'function') showMsg('文件无法播放喵，可能路径失效');
});
}
Array.prototype.forEach.call(cards, function (c) { c.classList.remove('playing'); });
this.classList.add('playing');
});
});
}
function buildFilters() {
var artists = getArtists(works);
var html = '<span class="filter-tab active" data-filter="all">🌸 全部 (' + works.length + ')</span>';
artists.forEach(function (a) {
var count = works.filter(function (w) { return w.artist === a; }).length;
html += '<span class="filter-tab" data-filter="' + esc(a) + '">' + esc(a) + ' (' + count + ')</span>';
});
filterTabs.innerHTML = html;
Array.prototype.forEach.call(filterTabs.querySelectorAll('.filter-tab'), function (tab) {
tab.addEventListener('click', function () {
Array.prototype.forEach.call(filterTabs.querySelectorAll('.filter-tab'), function (t) { t.classList.remove('active'); });
this.classList.add('active');
currentFilter = this.dataset.filter;
renderWorks(currentFilter);
});
});
}
function updateStats() {
document.getElementById('totalWorks').textContent = works.length;
document.getElementById('totalArtists').textContent = getArtists(works).length;
var totalSec = 0;
works.forEach(function (w) {
if (w.dur) {
var parts = String(w.dur).split(':');
if (parts.length === 2) totalSec += parseInt(parts[0]) * 60 + parseInt(parts[1]);
}
});
var m = Math.floor(totalSec / 60), s = totalSec % 60;
document.getElementById('statsTotalDuration').textContent = m + ':' + (s < 10 ? '0' + s : s);
}
function initWorks() {
if (typeof playlist === 'undefined') return;
works = playlist.map(function (item, idx) {
return { name: item.name, artist: item.artist, path: item.path, dur: item.dur || '0:00', _idx: idx };
});
currentFilter = 'all';
buildFilters();
renderWorks('all');
updateStats();
}
Array.prototype.forEach.call(document.querySelectorAll('.page-tab'), function (tab) {
tab.addEventListener('click', function () {
Array.prototype.forEach.call(document.querySelectorAll('.page-tab'), function (t) { t.classList.remove('active'); });
this.classList.add('active');
var target = this.dataset.tab;
var player = document.getElementById('tab-player');
var cards = document.getElementById('tab-cards');
var netease = document.getElementById('tab-netease');
if (player) player.style.display = target === 'player' ? 'block' : 'none';
if (cards) {
cards.style.display = target === 'cards' ? 'block' : 'none';
if (target === 'cards' && !window._worksInit) {
window._worksInit = true;
initWorks();
}
}
if (netease) netease.style.display = target === 'netease' ? 'block' : 'none';
});
});
})();
;
(function () {
var searchBox = document.getElementById('ns-search');
var searchBtn = document.getElementById('ns-btn');
var resultBox = document.getElementById('ns-results');
var platformSel = document.getElementById('ns-platform');
if (!searchBox || !resultBox) return;
var API = 'https://api.qijieya.cn/meting/';
var ALL_PLATFORMS = [
['netease', '网易云'],
['tencent', 'QQ音乐'],
['kugou', '酷狗'],
['migu', '咪咕'],
['bilibili', 'B站'],
['itunes', 'iTunes']
];
var API_BACKUP = 'https://musicapi.qijieya.cn/meting/';
function fmt(t) {
if (!t) return '0:00';
var m = Math.floor(t / 60), s = Math.round(t % 60);
return m + ':' + (s < 10 ? '0' + s : s);
}
function esc2(s) {
if (!s) return '';
return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function norm(s, platform) {
return {
platform: platform,
name: s.name || s.title || '未知歌曲',
artist: s.artist || s.author || '',
url: s.url || '',
pic: s.pic || s.cover || '',
duration: s.duration || 0,
lrc: s.lrc || s.lyric || ''
};
}
function apiSearch(api, platform, kw, cb) {
if (platform === 'itunes') {
/* iTunes Search API：免费、无 key、支持 CORS；结果带 30 秒官方试听 */
fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(kw) + '&entity=song&limit=20')
.then(function (r) { return r.json(); })
.then(function (j) {
var arr = j && j.results;
if (!arr || !arr.length) return cb(null);
cb(arr.map(function (s) {
return {
name: s.trackName || '未知歌曲',
artist: s.artistName || '',
url: s.previewUrl || '',
pic: (s.artworkUrl100 || '').replace('100x100', '300x300'),
duration: Math.round((s.trackTimeMillis || 0) / 1000),
lrc: ''
};
}));
})
.catch(function () { cb(null, true); });
return;
}
fetch(api + '?server=' + platform + '&type=search&id=' + encodeURIComponent(kw) + '&limit=20')
.then(function (r) { return r.json(); })
.then(function (j) {
var arr = Array.isArray(j) ? j : (j && j.data ? j.data : null);
cb(arr ? arr.map(function (s) { return norm(s, platform); }) : null);
})
.catch(function () { cb(null, true); });
}
function trySearch(apis, i, platform, kw, done) {
var netFail = false;
(function step(n) {
if (n >= apis.length) return done(null, netFail);
apiSearch(apis[n], platform, kw, function (songs, fail) {
if (fail) netFail = true;
if (songs && songs.length) return done(songs);
step(n + 1);
});
})(i);
}
function resolveUrl(u, cb) {
cb(u && u.indexOf('http') === 0 ? u : '');
}
function probeExt(buf) {
if (window.UMCrypto && buf && buf.length > 8) {
try {
var t = UMCrypto.detectAudioType(new Uint8Array(buf.slice(0, 1024)));
var at = t && t.audioType;
if (at && at !== 'bin') return at;
} catch (e) {}
}
var b = new Uint8Array(buf.slice(0, 12));
if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'mp3';
if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return 'flac';
if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'ogg';
if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'wav';
return '';
}
function downloadSong(url, name, artist) {
if (!url) { if (typeof showMsg === 'function') showMsg('无法下载喵～'); return; }
if (typeof showMsg === 'function') showMsg('开始下载喵…');
fetch(url)
.then(function (r) {
if (!r.ok) throw new Error('fail');
return r.arrayBuffer();
})
.then(function (buf) {
var ext = probeExt(buf);
if (!ext || buf.byteLength < 4096) {
if (typeof showMsg === 'function') showMsg('该曲受版权/VIP限制，下载不了喵～');
return;
}
var fn = (name + ' - ' + artist + '.' + ext).replace(/[\\/:*?"<>|]/g, '_');
var blob = new Blob([buf], { type: 'audio/' + ext });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = fn;
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
if (typeof showMsg === 'function') showMsg('下载完成喵～');
})
.catch(function () { if (typeof showMsg === 'function') showMsg('下载失败喵～'); });
}
function bindItem(el) {
el.addEventListener('click', function (e) {
if (e.target.closest && e.target.closest('.ns-dl')) return;
playSong(el);
});
var add = el.querySelector('.ns-add');
if (add) add.addEventListener('click', function (e) {
e.stopPropagation();
addNsSong({ name: el.dataset.name, artist: el.dataset.artist, url: el.dataset.url, lrc: el.dataset.lrc });
});
var dl = el.querySelector('.ns-dl');
if (dl) dl.addEventListener('click', function (e) {
e.stopPropagation();
downloadSong(el.dataset.url, el.dataset.name, el.dataset.artist);
});
}
function playSong(el) {
var self = el;
var name = el.dataset.name, artist = el.dataset.artist;
Array.prototype.forEach.call(resultBox.querySelectorAll('.ns-item'), function (c) { c.classList.remove('playing'); });
el.classList.add('playing');
el.querySelector('.ns-play i').className = 'fas fa-spinner fa-spin';
resolveUrl(el.dataset.url, function (u) {
self.querySelector('.ns-play i').className = 'fas fa-play';
if (!u) {
if (typeof showMsg === 'function') showMsg('这首暂时听不了（版权限制）喵～');
self.classList.remove('playing');
return;
}
if (typeof audio !== 'undefined' && audio) {
audio.src = u;
audio.play().catch(function () {
if (typeof showMsg === 'function') showMsg('播放失败喵～');
});
if (typeof currentIndex !== 'undefined') currentIndex = -1;
if (typeof isPlaying !== 'undefined') isPlaying = true;
if (typeof playIcon !== 'undefined') playIcon.className = 'fas fa-pause';
if (typeof coverInner !== 'undefined') coverInner.classList.add('playing');
if (typeof trackNameSpan !== 'undefined') trackNameSpan.textContent = name;
if (typeof trackArtistSpan !== 'undefined') trackArtistSpan.textContent = artist;
if (window.LyricHelper && typeof lyricBox !== 'undefined' && lyricBox) {
if (el.dataset.lrc) {
LyricHelper.show(el.dataset.lrc, audio, lyricBox);
} else if (name && artist) {
/* Lyrics.ovh 自动补歌词：免费、无 key、支持 CORS（纯文本静态显示） */
fetch('https://api.lyrics.ovh/v1/' + encodeURIComponent(artist) + '/' + encodeURIComponent(name))
.then(function (r) { return r.json(); })
.then(function (j) {
if (j && j.lyrics && window.LyricHelper && typeof lyricBox !== 'undefined' && lyricBox) {
var lines = j.lyrics.split('\n').filter(function (t) { return t.trim(); });
lyricBox.innerHTML = lines.map(function (t) { return '<div class="lyr-line">' + esc2(t) + '</div>'; }).join('');
} else if (typeof showMsg === 'function') {
showMsg('暂无歌词喵～');
}
})
.catch(function () {});
}
}
}
});
}
function addNsSong(song) {
if (!song || !song.url) { if (typeof showMsg === 'function') showMsg('这首暂时没有可播链接，加不了喵～'); return; }
if (typeof playlist === 'undefined' || typeof play !== 'function') return;
playlist.push({ name: song.name || '未知歌曲', artist: song.artist || '', path: song.url, online: true, lrcSrc: song.lrc });
if (typeof showMsg === 'function') showMsg('已加入歌单喵～');
if (typeof updateList === 'function') updateList();
}
function itemHtml(s) {
return '<div class="ns-item" data-name="' + esc2(s.name) + '" data-artist="' + esc2(s.artist) + '" data-url="' + esc2(s.url) + '" data-pic="' + esc2(s.pic) + '" data-lrc="' + esc2(s.lrc) + '">' +
'<div class="ns-info">' +
'<div class="ns-name">' + esc2(s.name) + '</div>' +
'<div class="ns-artist">' + esc2(s.artist) + '</div>' +
'</div>' +
'<div class="ns-dur">' + fmt(s.duration) + '</div>' +
'<div class="ns-actions">' +
'<button class="ns-add" title="加入歌单"><i class="fas fa-heart"></i></button>' +
'<button class="ns-dl" title="下载"><i class="fas fa-download"></i></button>' +
'<div class="ns-play"><i class="fas fa-play"></i></div>' +
'</div>' +
'</div>';
}
function render(songs) {
if (!songs) {
resultBox.innerHTML = '<div class="ns-empty">没有找到歌曲喵～换个关键词试试</div>';
return;
}
resultBox.innerHTML = songs.map(itemHtml).join('');
Array.prototype.forEach.call(resultBox.querySelectorAll('.ns-item'), function (el) { bindItem(el); });
}
function renderGrouped(groups, anyNetFail) {
var html = '';
var total = 0;
groups.forEach(function (g) {
if (!g.songs || !g.songs.length) return;
total += g.songs.length;
html += '<div class="ns-group"><div class="ns-group-title"> ' + esc2(g.name) + '</div>';
html += g.songs.map(itemHtml).join('');
html += '</div>';
});
if (!total) {
resultBox.innerHTML = anyNetFail ? '<div class="ns-empty">搜索接口暂时不可用喵～请稍后再试</div>' : '<div class="ns-empty">没有找到歌曲喵～换个关键词试试</div>';
return;
}
resultBox.innerHTML = html;
Array.prototype.forEach.call(resultBox.querySelectorAll('.ns-item'), function (el) { bindItem(el); });
}
function doSearch() {
var kw = searchBox.value.trim();
if (!kw) { resultBox.innerHTML = '<div class="ns-empty">输入歌名或歌手喵～</div>'; return; }
var platform = platformSel ? platformSel.value : 'netease';
if (platform === 'all') {
resultBox.innerHTML = '<div class="ns-loading">六个平台同时搜索喵…</div>';
var groups = [];
var done = 0;
var anyNetFail = false;
ALL_PLATFORMS.forEach(function (pf) {
trySearch([API, API_BACKUP], 0, pf[0], kw, function (songs, fail) {
if (fail) anyNetFail = true;
groups.push({ name: pf[1], songs: songs });
done++;
if (done === ALL_PLATFORMS.length) renderGrouped(groups, anyNetFail);
});
});
} else {
resultBox.innerHTML = '<div class="ns-loading">正在搜索喵…</div>';
trySearch([API, API_BACKUP], 0, platform, kw, function (songs) {
if (songs) render(songs);
else resultBox.innerHTML = '<div class="ns-empty">搜索失败喵～网络或接口问题，稍后再试</div>';
});
}
}
if (searchBtn) searchBtn.addEventListener('click', doSearch);
searchBox.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
})();
;
window.LyricHelper = {
timer: null,
parse: function (txt) {
if (!txt) return [];
var lines = [];
var re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)/g;
var m;
while ((m = re.exec(txt)) !== null) {
var sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 1000 : 0);
var t = (m[4] || '').trim();
if (t) lines.push({ time: sec, text: t });
}
return lines;
},
show: function (url, audio, box) {
this.stop();
if (!url || !box) return;
box.innerHTML = '歌词加载中…';
var self = this;
fetch(url)
.then(function (r) { return r.text(); })
.then(function (txt) {
self.lines = self.parse(txt);
if (!self.lines.length) { box.innerHTML = '暂无歌词喵～'; return; }
box.innerHTML = self.lines.map(function (l, i) {
return '<div class="lyr-line" data-i="' + i + '">' + l.text + '</div>';
}).join('');
self.timer = setInterval(function () {
var t = audio.currentTime || 0;
var idx = -1;
for (var i = 0; i < self.lines.length; i++) {
if (self.lines[i].time <= t) idx = i; else break;
}
var ls = box.querySelectorAll('.lyr-line');
for (var j = 0; j < ls.length; j++) ls[j].classList.toggle('active', j === idx);
if (idx >= 0 && ls[idx]) {
var top = ls[idx].offsetTop - box.clientHeight / 2;
box.scrollTop = top;
}
}, 300);
})
.catch(function () { box.innerHTML = '歌词加载失败喵～'; });
},
stop: function () {
if (this.timer) { clearInterval(this.timer); this.timer = null; }
this.lines = [];
}
};
;
"use strict";
var UMCrypto = (() => {
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
if (typeof require !== "undefined") return require.apply(this, arguments);
throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
try {
return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
} catch (e) {
throw mod = 0, e;
}
};
var require_loader_inline = __commonJS({
"../um-crypto/package/dist/loader-inline.js"(exports) {
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function _loadWasmModule(sync, filepath, src, imports) {
var buf = null;
var isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
if (isNode) {
buf = Buffer.from(src, "base64");
} else {
var raw = globalThis.atob(src);
var rawLength = raw.length;
buf = new Uint8Array(new ArrayBuffer(rawLength));
for (var i = 0; i < rawLength; i++) {
buf[i] = raw.charCodeAt(i);
}
}
{
var mod = new WebAssembly.Module(buf);
return mod;
}
}
function umWasm(imports) {
return _loadWasmModule(1, null, "AGFzbQEAAAABlgImYAJ/fwF/YAJ/fwBgAX8AYAN/f38AYAN/f38Bf2AAA39/f2ABfwF/YAACf39gAn9/A39/f2AEf39/fwBgAABgBX9/f29/AGAABH9/f39gBX9/f39/AGABfwJ/f2AEf39/fwF/YAZ/f39/f38AYAN/f38Df39/YAN/f28Cf39gA39+fwBgAAF/YAV/f39/fwF/YAJ/fwR/f39/YAR/f39/A39/f2AEf39/bwN/f39gA39/bwBgAn9/AW9gAAFvYAJ/bwBgB39/f39/f38AYAZ/f39/f38Bf2ACf34AYAx/f39/f39/f39/f38Cf39gA39/bwR/f39/YAV/f39vfwJ/f2ABfwN/f39gBH9/b38AYAR/f39vAALlAQcDd2JnHl9fd2JpbmRnZW5fY29weV90b190eXBlZF9hcnJheQAZA3diZxRfX3diaW5kZ2VuX2Vycm9yX25ldwAaA3diZxpfX3diZ19uZXdfOGE2ZjIzOGE2ZWNlODZlYQAbA3diZxxfX3diZ19zdGFja18wZWQ3NWQ2ODU3NWIwZjNjABwDd2JnHF9fd2JnX2Vycm9yXzc1MzRiOGU5YTM2ZjFhYjQAAQN3YmcQX193YmluZGdlbl90aHJvdwABA3diZx9fX3diaW5kZ2VuX2luaXRfZXh0ZXJucmVmX3RhYmxlAAoDqgKoAgMGAR0DAwEDAwMDAw0QAw0ACQkeAgIDAgICAQQDARMDBA8CAAEBARADAQMDAwAJAQEDFAMBCQEJCQMDAAAAAAABAxMDAQYBAwYVDQEQCQMDAQIGCQADFAMABgYBAQEBAAMDAwIBAwIBAAEKHwIJAAEBCQIBAQMACgEBAQEBAQYNAAEBAQECAwIEBAQEBAkABgACAgMBBgYGAwogAgICAAACABUCAgICAgICAgYGBgYGBgYGDwAhAhYWFxcYGAICAgICERERIg0ICAgICAgICAgICAgIEiMSEgYFAQ4ODg4OAg8ACgIBAQELCwsLCwsDACQlAwQADwAAAAEABAMEBAQEBAICAgMCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEKCgEBAAQBAQEKBAkCcAFoaG8AgAEFAwEAEQYJAX8BQYCAwAALB7gNTQZtZW1vcnkCAA9fX3diZ19xbWMyX2ZyZWUAaxRfX3diZ19xbWNmb290ZXJfZnJlZQBiC2RlY3J5cHRRTUMxAPcBDHFtYzJfZGVjcnlwdADvAQhxbWMyX25ldwDPAQ5xbWNmb290ZXJfZWtleQDjARNxbWNmb290ZXJfbWVkaWFOYW1lAOIBD3FtY2Zvb3Rlcl9wYXJzZQDOAQ5xbWNmb290ZXJfc2l6ZQCyARFfX3diZ19taWd1M2RfZnJlZQCJARVfX3diZ19xaW5ndGluZ2ZtX2ZyZWUAigEOZGVjcnlwdFFSQ0ZpbGUAvAERZGVjcnlwdFFSQ05ldHdvcmsAvgEObWlndTNkX2RlY3J5cHQA8AESbWlndTNkX2Zyb21GaWxlS2V5ANEBEW1pZ3UzZF9mcm9tSGVhZGVyANABEnFpbmd0aW5nZm1fZGVjcnlwdADxARdxaW5ndGluZ2ZtX2dldERldmljZUtleQChARRxaW5ndGluZ2ZtX2dldEZpbGVJVgC/AQ5xaW5ndGluZ2ZtX25ldwDAARVfX3diZ19rdXdvaGVhZGVyX2ZyZWUAgQEWX193Ymdfa3dtZGVjaXBoZXJfZnJlZQBjGF9fd2JnX2t3bWRlY2lwaGVydjFfZnJlZQCLARdrdXdvQm9kaWFuQ2lwaGVyRmFjdG9yeQDTARNrdXdvVjJDaXBoZXJGYWN0b3J5ANQBEGt1d29oZWFkZXJfcGFyc2UA0gEUa3V3b2hlYWRlcl9xdWFsaXR5SWQAswEVa3V3b2hlYWRlcl9yZXNvdXJjZUlkALQBE2t3bWRlY2lwaGVyX2RlY3J5cHQA8gEZa3dtZGVjaXBoZXJfbWFrZV9kZWNpcGhlcgDJARVrd21kZWNpcGhlcnYxX2RlY3J5cHQA8wEQX193Ymdfa3Vnb3VfZnJlZQBkFl9fd2JnX2t1Z291aGVhZGVyX2ZyZWUAdg1rdWdvdV9kZWNyeXB0APQBFWt1Z291X2RlY3J5cHREYXRhYmFzZQDbARJrdWdvdV9mcm9tSGVhZGVyVjUAygERa3Vnb3VfZnJvbV9oZWFkZXIA1gEVa3Vnb3VoZWFkZXJfYXVkaW9IYXNoAOQBD2t1Z291aGVhZGVyX25ldwDVARhrdWdvdWhlYWRlcl9vZmZzZXRUb0RhdGEAtQETa3Vnb3VoZWFkZXJfdmVyc2lvbgC2ARpfX3diZ19hdWRpb3R5cGVyZXN1bHRfZnJlZQCCASNfX3diZ19nZXRfYXVkaW90eXBlcmVzdWx0X2F1ZGlvVHlwZQDlASJfX3diZ19nZXRfYXVkaW90eXBlcmVzdWx0X25lZWRNb3JlAN8BI19fd2JnX3NldF9hdWRpb3R5cGVyZXN1bHRfYXVkaW9UeXBlAGwiX193Ymdfc2V0X2F1ZGlvdHlwZXJlc3VsdF9uZWVkTW9yZQDhARBfX3diZ194aWFtaV9mcmVlAIMBD2RldGVjdEF1ZGlvVHlwZQDXARV4aWFtaV9jb3B5UGxhaW5MZW5ndGgAtwENeGlhbWlfZGVjcnlwdAD4ARF4aWFtaV9mcm9tX2hlYWRlcgDYARJfX3diZ19uY21maWxlX2ZyZWUAeg1pbml0UGFuaWNIb29rAK4CE25jbWZpbGVfYXVkaW9PZmZzZXQA3AEPbmNtZmlsZV9kZWNyeXB0AMwBC25jbWZpbGVfbmV3AOABDG5jbWZpbGVfb3BlbgDLARNfX3diZ19qb294ZmlsZV9mcmVlAIQBEV9fd2JnX3htbHlwY19mcmVlAHcQZGVjcnlwdFgyTUhlYWRlcgDdARBkZWNyeXB0WDNNSGVhZGVyAN4BFWpvb3hmaWxlX2J1ZmZlckxlbmd0aACWARBqb294ZmlsZV9kZWNyeXB0AMIBDmpvb3hmaWxlX3BhcnNlAMEBEnhtbHlwY19hdWRpb0hlYWRlcgDmAQ54bWx5cGNfZGVjcnlwdADDARx4bWx5cGNfZW5jcnlwdGVkSGVhZGVyT2Zmc2V0ALgBGnhtbHlwY19lbmNyeXB0ZWRIZWFkZXJTaXplALkBFHhtbHlwY19nZXRIZWFkZXJTaXplANkBCnhtbHlwY19uZXcA2gEPX193YmluZGdlbl9mcmVlAPkBEV9fd2JpbmRnZW5fbWFsbG9jAKYBEl9fd2JpbmRnZW5fcmVhbGxvYwC6ARNfX3diaW5kZ2VuX2V4cG9ydF8zAQEZX19leHRlcm5yZWZfdGFibGVfZGVhbGxvYwBYEF9fd2JpbmRnZW5fc3RhcnQABgnFAQEAQQELZ40CjwFDggKOAq0CrQKtAv0BdY0CjwFDjwKNAo8BQ5AClAKTAusBkgFFhAKVAv0BlgKWApYCmAKaApkC6QGXApcBZp0ClgKbApcCnAKYApYCnwKWAp4C6QGYAusBkAFEhQLrAZABRKAClgKWAukBmAKiAqEClwL9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BXdqQaSGkYcHayIHIAhBHnciBCAGQR53IgNzcSADIARxc2ogBSBDaiACIANzIAhxIAIgA3FzaiAHQQV3akGkhpGHB2siBUEFd2pBpIaRhwdrIgZBHnciCGogBCBEaiAFQR53IgkgB0EedyICcyAGc2ogAyBBaiAFIAIgBHNxIAIgBHFzaiAGQQV3akGkhpGHB2siBEEFd2pBqvz0rANrIgNBHnciBSAEQR53IgZzIAIgPmogCCAJcyAEc2ogA0EFd2pBqvz0rANrIgJzaiAJIEJqIAYgCHMgA3NqIAJBBXdqQar89KwDayIEQQV3akGq/PSsA2siA0EedyIIaiAFIEdqIARBHnciByACQR53IgJzIANzaiAGIEZqIAIgBXMgBHNqIANBBXdqQar89KwDayIEQQV3akGq/PSsA2siA0EedyIFIARBHnciBnMgAiBLaiAHIAhzIARzaiADQQV3akGq/PSsA2siAnNqIAcgSWogBiAIcyADc2ogAkEFd2pBqvz0rANrIgRBBXdqQar89KwDayIDQR53IghqIAUgSmogBEEedyIHIAJBHnciAnMgA3NqIAYgTGogAiAFcyAEc2ogA0EFd2pBqvz0rANrIgRBBXdqQar89KwDayIDQR53IgUgBEEedyIGcyACIDwgQ3MgRXMgTXNBAXciAmogByAIcyAEc2ogA0EFd2pBqvz0rANrIgRzaiAHIFFqIAYgCHMgA3NqIARBBXdqQar89KwDayIDQQV3akGq/PSsA2siCEEedyIHaiAFIFJqIANBHnciCSAEQR53IgRzIAhzaiA9IERzIEtzIAJzQQF3IhkgBmogBCAFcyADc2ogCEEFd2pBqvz0rANrIgNBBXdqQar89KwDayIFQR53IgYgA0EedyIIcyBCIERzIE1zIFNzQQF3IhogBGogByAJcyADc2ogBUEFd2pBqvz0rANrIgNzaiA+IEVzIExzIBlzQQF3IAlqIAcgCHMgBXNqIANBBXdqQar89KwDayIFQQV3akGq/PSsA2siB2ohBCAWIEUgR3MgAnMgGnNBAXdqIAhqIANBHnciAiAGcyAFc2ogB0EFd2pBqvz0rANrIRYgBUEedyARaiERIAIgFWohFSAGIB5qIR4gAUFAayIBIFBHDQALCyAAIB42AhAgACAVNgIMIAAgETYCCCAAIAQ2AgQgACAWNgIA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ACABIAIgBE9BA3RqIQEgAiAJQQN0agUgAgsgBEcgASAAQQhqR3INAiAKQQN0IgBFDQAgAyAMIAD8CgAACyAMQYACaiQADAILAAtB87bBAEGZAUHAt8EAEJ8BAAsL2wgBB38CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAFQX9HDQAgAiADTyIGIAIgA2sgAyACayACIANLGyIHQQFHckUEQAJAIAEgA0EBayIHSwRAIARBfHEiAiADaiIGIAJJIAEgBklyDQEgAgRAIAAgA2ogACAHai0AACAC/AsACyAGQQFrIQIMEgsgByABQeTuwAAQjQEACyADIAYgAUH07sAAED4ACyAGDQAgB0EDSw0BCyAEQQRPDQEgAyEGDA4LIARBBE8NASADIQYMDQsgBEECdiELIAAgA2ohDEEAIQcDQCACIAdqIgkgBXEiCCABTw0CIAMgB2oiBiABTw0DIAcgDGoiCiAAIAhqLQAAOgAAIAlBAWoiCSAFcSIIIAFPDQQgBkEBaiABTw0FIApBAWogACAIai0AADoAACAJQQFqIgkgBXEiCCABTw0GIAZBAmogAU8NByAKQQJqIAAgCGotAAA6AAAgCUEBaiAFcSIIIAFPDQggASAGQQNqSwRAIApBA2ogACAIai0AADoAACAHQQRqIQcgC0EBayILRQ0NDAELCyAGQQNqIAFB9O/AABCNAQALIARBAnYhByABQQRrIQogAyEGA0AgAkEDaiABTw0IIAJBfE8NCSAGIApLDQogACAGaiAAIAJqKAAANgAAIAZBBGohBiACQQRqIQIgB0EBayIHDQALDAsLIAggAUGE78AAEI0BAAsgBiABQZTvwAAQjQEACyAIIAFBpO/AABCNAQALIAZBAWogAUG078AAEI0BAAsgCCABQcTvwAAQjQEACyAGQQJqIAFB1O/AABCNAQALIAggAUHk78AAEI0BAAtBACACQQNqIAFBxPHAABA+AAsgAiACQQRqIAFBxPHAABA+AAtB1PHAAEErQcTxwAAQnwEACyADIAdqIQYgAiAHaiECCwJAAkACQAJAAkACQAJAAkACQAJAAkACQCAEQQNxQQFrDgMAAQILCyACIAVxIgcgAUkNCCAHIAFBhPDAABCNAQALIAIgBXEiAyABTw0BIAEgBk0EQCAGIAFBtPDAABCNAQALIAAg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AkAgACgCACIDLQAKQYABcUUEQCAFQQFxRQ0BIAMoAgBBzrTBAEECIAMoAgQoAgwRBABFDQEMAgsgBUEBcUUEQCADKAIAQdC0wQBBASADKAIEKAIMEQQADQILIAJBAToADyACQdS0wQA2AhQgAiADKQIANwIAIAIgAykCCDcCGCACIAJBD2o2AgggAiACNgIQIAEgAkEQakG0mcEAKAIAEQAADQEgAigCEEHRtMEAQQIgAigCFCgCDBEEACEEDAELIAEgA0G0mcEAKAIAEQAAIQQLIABBAToABSAAIAQ6AAQgAkEgaiQAC/MEAQV/IwBBMGsiAyQAIANBADYCHCADQoCAgIAQNwIUIANB2MXAADYCJCADQqCAgIAGNwIoIAMgA0EUajYCICADQSBqIQIjAEEQayIBJAACfwJAAkACQAJAAkACQAJAIAAtAABBAWsOBgECAwQFBgALIAEgAEEEajYCBCABIAFBBGqtQoCAgIDgBIQ3AwggAigCACACKAIEQZuwwAAgAUEIahAoDAYLIAEgAEEBajYCBCABIAFBBGqtQoCAgIDwBIQ3AwggAigCACACKAIEQbGFwAAgAUEIahAoDAULIAJBsYHBAEEUEPoBDAQLIAEgAEEEajYCBCABIAFBBGqtQoCAgIDgBIQ3AwggAigCACACKAIEQfeCwAAgAUEIahAoDAMLIAEgAEEEajYCBCABIAFBBGqtQoCAgICABYQ3AwggAigCACACKAIEQeWLwAAgAUEIahAoDAILIAEgAEEEajYCBCABIAFBBGqtQoCAgICQBYQ3AwggAigCACACKAIEQeeMwAAgAUEIahAoDAELIAEgAEEEajYCBCABIAFBBGqtQoCAgICgBYQ3AwggAigCACACKAIEQayLwAAgAUEIahAoCyABQRBqJABFBEAgA0EQaiADQRxqKAIAIgE2AgAgAyADKQIUNwMIIAMoAgwgARD2ASADQQhqEHMCQCAALQAAQQZJDQAgAC0ABEEDRw0AIAAoAggiACgCACEBIAAoAgQiAigCACIEBEAgASAEEQIACyACKAIEIgQEQCABIAQgAigCCBCDAgsgAEEMQQQQgwILIANBMGokAA8LQYDGwABBNyADQQhqQfDFwABBuMbAABCGAQAL/AECA38BfiMAQTBrIgIkACABKAIAQYCAgIB4RgRAIAEoAgwhAyACQSxqIgRBADYCACACQoCAgIAQNwIkIAJBJGpB2KXBACADKAIAIgMoAgAgAygCBBAoGiACQSBqIAQoAgAiAzYCACACIAIpAiQiBTcDGCABQQhqIAM2AgAgASAFNwIACyABKQIAIQUgAUKAgICAEDcCACACQRBqIgMgAUEIaiIBKAIANgIAIAFBADYCACACIAU3AwhBDEEEEJECIgFFBEBBBEEMEKgCAAsgASACKQMINwIAIAFBCGogAygCADYCACAAQYyowQA2AgQgACABNgIAIAJBMGokAAugBAELfyMAQTBrIgQkAEEBIQkgBEEBOgAgIARBATYCHCAEIAE2AhQgBCABIAJqNgIYIARBCGohBSMAQRBrIgEkAAJAAkACQAJAQQAgBEEUaiIDKAIIIgIgAy0ADBsiBiADKAIEIgsgAygCACIDa08NACADIAZqIgctAAAiCkUNAEEIQQEQkQIiCEUNAiAIIAo6AAAgAUEBNgIMIAEgCDYCCCABQQg2AgQCQCACIAsgB0EBamtPDQAgAkEBaiEKIAIgBmogA2pBAWohBkEBIQMDQCAGLQAAIgxFDQEgAiAHaiIHQQJqIQ0gB0EBaiEHIAEoAgQgA0YEQCABQQRqIANBARBVIAEoAgghCAsgAyAIaiAMOgAAIAEgA0EBaiIDNgIMIAYgCmohBiACIAsgDWtJDQALCyAFIAEpAgQ3AgAgBUEIaiABQQxqKAIANgIADAELIAVBADYCCCAFQoCAgIAQNwIACyABQRBqJAAMAQtBAUEIEO4BAAsgBEEkaiAEKAIMIgUgBCgCEBAmQQAhAgJAIAQoAiwiAUEASA0AIAQoAighAyABBEBBASECIAFBARCRAiIJRQ0BCyABBEAgCSADIAH8CgAACyAAIAE2AgggACAJNgIEIAAgATYCACAEKAIIIgAEQCAFIABBARCDAgsgBCgCJCIAQYCAgIB4ckGAgICAeEcEQCADIABBARCDAgsgBEEwaiQADwsgAiABEO4BAAuVBgEEfyMAQTBrIgMkACADQQA2AhwgA0KAgICAEDcCFCADQbi0wAA2AiQgA0KggICABjcCKCADIANBFGo2AiAgA0EgaiECIwBBEGsiASQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQEEKIAAoAgAiBEGAgICAeHMgBEEAThtBAWsODAECAwQFBgcICQoLDAALIAEgAEEEajYCBCABIAFBBGqtQoCAgICwBYQ3AwggAigCACACKAIEQbStwAAgAUEIahAoDAwLIAEgAEEEajYCBCABIAFBBGqtQoCAgIDABYQ3AwggAigCACACKAIEQfeEwAAgAUEIahAoDAsLIAEgAEEEajYCBCABIAFBBGqtQoCAgIDQBYQ3AwggAigCACACKAIEQYKHwAAgAUEIahAoDAoLIAJByI3BAEEREPoBDAkLIAJB2Y3BAEEdEPoBDAgLIAJB9o3BAEElEPoBDAcLIAEgADYCBCABIAFBBGqtQoCAgIDgBYQ3AwggAigCACACKAIEQcSLwAAgAUEIahAoDAYLIAEgAEEEajYCBCABIAFBBGqtQoCAgICwBYQ3AwggAigCACACKAIEQeqIwAAgAUEIahAoDAULIAJBm47BAEEpEPoBDAQLIAJBxI7BAEEcEPoBDAMLIAEgADYCBCABIAFBBGqtQoCAgIDwBYQ3AwggAigCACACKAIEQZOGwAAgAUEIahAoDAILIAEgAEEEajYCBCABIAFBBGqtQoCAgICABoQ3AwggAigCACACKAIEQe+FwAAgAUEIahAoDAELIAEgAEEEajYCBCABIAFBBGqtQoCAgICwBYQ3AwggAigCACACKAIEQc6IwAAgAUEIahAoCyABQRBqJABFBEAgA0EQaiADQRxqKAIAIgE2AgAgAyADKQIUNwMIIAMoAgwgARD2ASADQQhqEHMCQAJAAkBBCiAAKAIAIgJBgICAgHhzIAJBAE4bQQprDgIAAQILIAAQcwwBCyAAQQRqEI4BCyADQTBqJAAPC0HgtMAAQTcgA0EIakHQtMAAQZi1wAAQhgEAC6oBAgN+An8gA0H4////AXEEQCAAIAAgA0EDdiIDQQV0IghqIAAgA0E4bCIJaiADIAQQUCEAIAEgASAIaiABIAlqIAMgBBBQIQEgAiACIAhqIAIgCWogAyAEEFAhAgsgACACIAEgACkDACIFQj+HQgGIIAWFIgUgASkDACIGQj+HQgGIIAaFIgZTIgAgBiACKQMAIgdCP4dCAYggB4UiB1NzGyAAIAUgB1NzGwuUAgECfyMAQSBrIgUkAEHYicIAQdiJwgAoAgAiBkEBajYCAAJAAn9BACAGQQBIDQAaQQFB1InCAC0AAA0AGkHUicIAQQE6AABB0InCAEHQicIAKAIAQQFqNgIAQQILQf8BcSIGQQJHBEAgBkEBcUUNASAFQQhqIAAgASgCGBEBAAwBC0HcicIAKAIAIgZBAEgNAEHcicIAIAZBAWo2AgBB4InCACgCAARAIAUgACABKAIUEQEAIAUgBDoAHSAFIAM6ABwgBSACNgIYIAUgBSkDADcCEEHgicIAKAIAIAVBEGpB5InCACgCACgCFBEBAAtB3InCAEHcicIAKAIAQQFrNgIAQdSJwgBBADoAACADRQ0AAAsAC8cBAgF+A38gASgCGCIFBH8CQCABKQMAIgJQRQRAIAEoAhAhAwwBCyABKAIQIQMgASgCCCEEA0AgA0FAaiEDIAQpAwAgBEEIaiEEQoCBgoSIkKDAgH+DIgJCgIGChIiQoMCAf1ENAAsgASADNgIQIAEgBDYCCCACQoCBgoSIkKDAgH+FIQILIAEgBUEBazYCGCABIAJCAX0gAoM3AwAgAyACeqdB+ABxayIBQQRrIQMgAUEIawVBAAshBCAAIAM2AgQgACAENgIAC6oBAgJ/AX5BASEHQQQhBgJAIAQgBWpBAWtBACAEa3GtIAOtfiIIQiCIUEUEQEEAIQMMAQsgCKciA0GAgICAeCAEa0sEQEEAIQMMAQsCQAJAAn8gAQRAIAIgASAFbCAEIAMQ/AEMAQsgA0UEQCAEIQYMAgsgAyAEEJECCyIGDQAgACAENgIEDAELIAAgBjYCBEEAIQcLQQghBgsgACAGaiADNgIAIAAgBzYCAAusAQMCfwJ+AXwCQAJAIAIEQCAAKAIEIgRFDQIgBK0hBiAAKwMIIQggACgCACEAA0AgBCAAIAMgBHBqMQAAIgdQBH5CAAUgCCADrUIBfCAHfrqjRAAAAAAAAFlAovwHCyAGgqciBU0NAiABIAEtAAAgACAFai0AAHM6AAAgA0EBaiEDIAFBAWohASACQQFrIgINAAsLDwsgBSAEQYiSwQAQjQEAC0H4kcEAEIsCAAuJAQEBfyMAQRBrIgMkACACIAEgAmoiAUsEQEEAQQAQ7gEACyADQQRqIAAoAgAiAiAAKAIEQQggASACQQF0IgIgASACSxsiASABQQhNGyIBQQFBARBTIAMoAgRBAUYEQCADKAIIIAMoAgwQ7gEACyADKAIIIQIgACABNgIAIAAgAjYCBCADQRBqJAALjwECAX8BfiAAAn8CQCABrSIEQiCIUARAIASnIgNB/////wdNDQELIABBADYCBEEBDAELIANFBEAgAEEBNgIIIABBADYCBEEADAELAn8gAkUEQCADQQEQkQIMAQsgA0EBEJICCyICRQRAIAAgAzYCCCAAQQE2AgRBAQwBCyAAIAI2AgggACABNgIEQQALNgIAC4YBAgJ/AX4CQCABrSIEQiCIUARAIASnIgJB/////wdNDQELIABBADYCBCAAQQE2AgAPCyACRQRAIABBATYCCCAAQQA2AgQgAEEANgIADwsgAkEBEJECIgNFBEAgACACNgIIIABBATYCBCAAQQE2AgAPCyAAIAM2AgggACABNgIEIABBADYCAAvbAQEEfwJAAkAgAEGEAUkNACAA0G8mAUHohcIALQAAQQFHBEAQfgtB2IXCACgCACECQdiFwgBBBDYCAEHUhcIAKAIAIQNB1IXCAEEANgIAIABB5IXCACgCACIBSQ0BIAAgAWsiAEHchcIAKAIAIgRPDQEgAiAAQQJ0akHghcIAKAIANgIAQdyFwgAgBDYCAEHghcIAIAA2AgBB5IXCACABNgIAQdSFwgAoAgAhAEHUhcIAIAM2AgBB2IXCACgCAEHYhcIAIAI2AgAgAEUNACAAQQJ0QQQQgwILDwsAC+YCAQR/IwBBMGsiASQAIAFBADYCHCABQoCAgIAQNwIUIAFBuLTAADYCJCABQqCAgIAGNwIoIAEgAUEUajYCICABQSBqIQMjAEEQayICJAACfwJAAkACQAJAQQEgACgCACIEQYCAgIB4cyAEQQBOG0EBaw4DAQIDAAsgA0G7zsAAQSUQ+gEMAwsgAiAANgIEIAIgAkEEaq1CgICAgLAChDcDCCADKAIAIAMoAgRBrYnAACACQQhqECgMAgsgAiAAQQRqNgIEIAIgAkEEaq1CgICAgMAChDcDCCADKAIAIAMoAgRB2YTAACACQQhqECgMAQsgA0HgzsAAQR4Q+gELIAJBEGokAEUEQCABQRBqIAFBHGooAgAiAjYCACABIAEpAhQ3AwggASgCDCACEPYBIAFBCGoQcyAAKAIAQQBOBEAgABBzCyABQTBqJAAPC0HgtMAAQTcgAUEIakHQtMAAQZi1wAAQhgEAC60BAgJ/A34gASgCBCIErSEGAkACQCAEQv////8PIAEpAwgiByAHQv////8PWhunayIF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QQI6AAAMAQsCQCAJRQRAIAVBAjoAACAFQQQ2AgQMAQsgBQJ/IAlBrAJNBEBBACEGIARBIGpBAEGAAfwLAANAIARBIGogBmogCyAGIAZsQa6sBGogCXAiDWotAAAiDyANQQdxQQRzIg10IA8gDXZyOgAAIAZBAWoiBkGAAUcNAAtBAAwBCyAEQQhqIAsgCRAdIARBN2ogBEEYaikDADcAACAEQS9qIARBEGopAwA3AAAgBCAEKQMINwAnQQELOgAAIAVBAWogBEEgakGAAfwKAAALIAxFDQAgCyAMQQEQgwILIARBoAFqJAAgAy0A+AEiBEECRw0CIANBmANqIANBhAJqKQIANwMAIAMgAykC/AE3A5ADIANBADYCqAMgA0KAgICAEDcCoAMgA0HIj8EANgKUASADQqCAgIAGNwKYASADIANBoANqNgKQASADQZADaiADQZABahB9RQ0BQfCPwQBBNyADQa8DakHgj8EAQaiQwQAQhgEACyAHQQQ6AAAgB0GDgICAeDYCBAwDCyADQcMBaiADQagDaigCACIBNgAAIAMgAykCoAMiGjcAuwEgB0EMaiABNgAAIAcgGjcABCAHQQQ6AAAgCEUNAyAOIAhBARCDAgwDCyADIAMpAPkBNwPoASADIANBgAJqKQAANwDvASADQRhqIANBiAJqQfgA/AoAACADIAMpAO8BNwDfASADIAMpA+gBNwPYASADIAMpAN8BNwDPASADIAMpA9gBNwPIASADIAMpAM8BNwC/ASADIAMpA8gBNwO4ASADQRBqIAMpAL8BNwAAIAMgAykDuAE3AAkgAyAEOgAIIAgEQCAOIAhBARCDAgsgA0GYAWogAUEwaikAADcDACADIAEpACg3A5ABQQEhCSAEQQFxBEBBACEFIANBEGoiBCADQZABakEQQQAQVCAEIANBoAFqQQBBEBA1QQAhCQwBCyADIAMtAAkgAy0AkAFzOgCQASADIAMtAAogAy0AkQFzOgCRASADIAMtAAsgAy0AkgFzOgCSASADIAMtAAwgAy0AkwFzOgCTASADIAMtAA0gAy0AlAFzOgCUASADIAMtAA4gAy0AlQFzOgCVASADIAMtAA8gAy0AlgFzOgCWASADIAMtABAgAy0AlwFzOgCXASADIAMtABEgAy0AmAFzOgCYASADIAMtABIgAy0AmQFzOgCZASADIAMtABMgAy0AmgFzOgCaASADIAMtABQgAy0AmwFzOgCbASADIAMtABUgAy0AnAFzOgCcASADIAMtABYgAy0AnQFzOgCdASADIAMtABcgAy0AngFzOgCeASADIAMtABggAy0AnwFzOgCfAUEAIQULIANBgAJqIAFB0ABqKQAANwMAIAMgASkASDcD+AEgA0GQAWogA0H4AWpBEBCRAUUEQCAHIANBCGpBiAH8CgAAIAUgAigCACIBQYCAgIB4R3FFIAFFcg0CIAIoAgQgAUEBEIMCDAILIAdBBDoAACAHQYWAgIB4NgIEIAVFBEAgCQ0CIAMoAhQiAQRAIAMoAhAgAUEBEIMCCyADKAIgQYAsQQEQgwIMAgsLIAIoAgAiAUGAgICAeEYgAUVyDQAgAigCBCABQQEQgwILIANBsANqJAACQCAKLQAIIgJBBEYEQCAKQZgBaiAKQRRqKAIANgIAIAogCikCDDcDkAEgCkGQAWoQTyEBDAELIAAgCi8ACTsAASAAQQNqIAotAAs6AAAgCigCDCEBIABBCGogCkEQakGAAfwKAAALIAAgAjoAACAAIAE2AgQgCkGgAWokAAuJAQEDfyMAQRBrIgMkAEEDIQIgAC0AACIAIQQgAEEKTwRAIAMgACAAQeQAbiIEQeQAbGtB/wFxQQF0LwDTskE7AA5BASECC0EAIAAgBBtFBEAgAkEBayICIANBDWpqIARBAXQtANSyQToAAAsgAUEBQQFBACADQQ1qIAJqQQMgAmsQGiADQRBqJAALwAQBA38jAEEwayICJAAgAkEANgIcIAJCgICAgBA3AhQgAkG4tMAANgIkIAJCoICAgAY3AiggAiACQRRqNgIgIAJBIGohAyMAQRBrIgEkAAJ/AkACQAJAAkACQAJAAkAgAC0AAEEBaw4GAQIDBAUGAAsgASAAQQRqNgIEIAEgAUEEaq1CgICAgLAIhDcDCCADKAIAIAMoAgRBhq3AACABQQhqECgMBgsgASAAQQRqNgIEIAEgAUEEaq1CgICAgLAIhDcDCCADKAIAIAMoAgRBs6zAACABQQhqECgMBQsgASAAQQRqNgIEIAEgAUEEaq1CgICAgLAIhDcDCCADKAIAIAMoAgRB3azAACABQQhqECgMBAsgASAAQQFqNgIEIAEgAUEEaq1CgICAgMAIhDcDCCADKAIAIAMoAgRBuJnBACABQQhqECgMAwsgASAAQQFqNgIEIAEgAUEEaq1CgICAgNAIhDcDCCADKAIAIAMoAgRB3JnBACABQQhqECgMAgsgASAAQQFqNgIEIAEgAUEEaq1CgICAgOAIhDcDCCADKAIAIAMoAgRBpYbAACABQQhqECgMAQsgASAAQQFqNgIEIAEgAUEEaq1CgICAgPAIhDcDCCADKAIAIAMoAgRB1IXAACABQQhqECgLIAFBEGokAARAQeC0wABBNyACQQhqQdC0wABBmLXAABCGAQALIAJBEGogAkEcaigCACIANgIAIAIgAikCFDcDCCACKAIMIAAQ9gEgAkEIahBzIAJBMGokAAueAwEDfyMAQTBrIgEkACABQQA2AhwgAUKAgICAEDcCFCABQbi0wAA2AiQgAUKggICABjcCKCABIAFBFGo2AiAgAUEgaiECIwBBEGsiAyQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAIAAoAgBBAWsOCgECAwQFBgcICQoACyACQaD0wABBFRD6AQwKCyADIABBBGo2AgQgAyADQQRqrUKAgICAsAOENwMIIAIoAgAgAigCBEHwr8AAIANBCGoQKAwJCyACQbX0wABBLhD6AQwICyACQeP0wABBIRD6AQwHCyACQYT1wABBKBD6AQwGCyACQaz1wABBHhD6AQwFCyACQcr1wABBIxD6AQwECyACQe31wABBJhD6AQwDCyACQZP2wABBIBD6AQwCCyACQbP2wABBIxD6AQwBCyACQdb2wABBJhD6AQsgA0EQaiQABEBB4LTAAEE3IAFBCGpB0LTAAEGYtcAAEIYBAAsgAUEQaiABQRxqKAIAIgA2AgAgASABKQIUNwMIIAEoAgwgABD2ASABQQhqEHMgAUEwaiQAC48CAQJ/IwBBMGsiAiQAAkACQCABRQRAIwBBQGoiASQAAkACQCAABEAgAEEIayIDKAIAQQFHDQEgAUEIaiAAQTj8CgAAIANBADYCAAJAIANBf0YNACAAQQRrIgAgACgCAEEBayIANgIAIAANACADQcAAQQgQgwILIAIgAUEQakEw/AoAACABQUBrJAAMAgsQpQIAC0G0s8AAQT8QpAIACyACKAIgQYCAgIB4RwRAIAJBIGoQcwsCQAJAIAIoAgBBAWsOAwADAQMLIAJBBHIQcwsgAkEQahBzDAELIABF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gICAgHg2AgAMAwsgA0HwAGogBRBwIAMoAnQhCCADKAJwIgFBjYCAgHhHBEAgBCADKAJ4NgIMIAQgCDYCCCAEIAE2AgQgBEGAgICAeDYCAAwDCyADQfAAaiAFIANBIGpBEBCUASADLQBwQQRHBEAgBCADKQNwNwIIIARCgICAgLiBgICAfzcCAAwDCyADQfAAaiAFIANBMGpBEBCUASADLQBwQQRHBEAgBCADKQNwNwIIIARCgICAgLiBgICAfzcCAAwDCyALQQVGBEAgA0IANwNQIANB8ABqIAUgA0HQAGpBCBCUASADLQBwQQRHBEAgBCADKQNwNwIIIARCgICAgLiBgICAfzcCAAwECyADQfAAaiAFEHAgAygCdCECIAMoAnAiAUGNgICAeEcEQCAEIAMoAng2AgwgBCACNgIIIAQgATYCBCAEQYCAgIB4NgIADAQLIAJBIEcNAkEgQQEQkgIiAUUEQEEBQSAQ7gEACyADQdgAaiIJQSA2AgggCSABNgIEIAlBIDYCACADQfAAaiAFIAMoAlwiAiADKAJgIgEQlAEgAy0AcEEERwRAIAQgAykDcDcCCCAEQoCAgIC4gYCAgH83AgAgCRBzDAQLIANB5ABqIAIgARAmIAMoAmghASADQfAAaiADKAJsIgVBABBWIAMoAnQhCSADKAJwQQFGDQQgAygCeCECIAUEQCACIAEgBfwKAAALIANBxABqEHMgAyAFNgJMIAMgAjYCSCADIAk2AkQgAygCZEGAgICAeEcEQCADQeQAahBzCyADQdgAahBzCyAEIAMpAyA3ACggBCADKQMwNwA4IAQgAy8BHDsASCADQYQBaiADQRBqKQMANwIAIARBMGogA0EoaikDADcAACAEQUBrIANBOGopAwA3AAAgA0H4AGoiASADQcwAaigCADYCACAEQcoAaiADQR5qLQAAOgAAIAMgAykDCDcCfCADIAMpAkQ3A3AgBCAKOgBXIAQgDjcATyAEIAw2AEsgBCAINgIkIAQgCzYCICAEIA02AhwgBEEYaiADQYgBaigCADYCACAEQRBqIANBgAFqKQMANwIAIARBCGogASkDADcCACAEIAMpA3A3AgAMBAsgBEKAgICAyICAgIB/NwIADAMLIAQgAjYCCCAEQoCAgIDIgYCAgH83AgALIANBxABqEHMMAQsgCSADKAJ4EO4BAAsgA0GQAWokACAGKAIYIgFFDQEgBigCFCABQQEQgwIMAQsgBEHAADYCCCAEQoCAgICIgICAgH83AgALIAZBMGokAAJAIAcoAggiAkGAgICAeEYEQCAHQegAaiAHQQxqIgFBCGooAgA2AgAgByABKQIANwNgIAdB4ABqEE8hAQwBCyAHKAIMIQEgAEEIaiAHQRBqQdAA/AoAAAsgACACNgIAIAAgATYCBCAHQfAAaiQAC4UBAQF/IwBBEGsiAyQAIAIgASACaiIBSwRAQQBBABDuAQALIANBBGogACgCACICIAAoAgRBCCABIAJBAXQiAiABIAJLGyIBIAFBCE0bIgEQeCADKAIEQQFGBEAgAygCCCADKAIMEO4BAAsgAygCCCECIAAgATYCACAAIAI2AgQgA0EQaiQAC/UBAQR/IwBBEGsiAyQAIAIgASACaiIBSwRAQQBBABDuAQALIANBBGohBCAAKAIEIQYCf0EIIAEgACgCACICQQF0IgUgASAFSxsiASABQQhNGyIFIgFBAEgEQEEBIQJBACEBQQQMAQsCfwJAAn8gAgRAIAYgAkEBIAEQ/AEMAQsgAUUEQEEBIQIMAgsgAUEBEJECCyICDQAgBEEBNgIEQQEMAQsgBCACNgIEQQALIQJBCAsgBGogATYCACAEIAI2AgAgAygCBEEBRgRAIAMoAgggAygCDBDuAQALIAMoAgghASAAIAU2AgAgACABNgIEIANBEGokAAuLAQEDfwJAAkACQAJAAkAgAC0AAA4MBAEEBAQEBAQCAwQEAAsgAEEEahBzDAMLIAAtAARBA0cNAiAAKAIIIgAoAgAhAiAAKAIEIgMoAgAiAQRAIAIgARECAAsgAygCBCIBBEAgAiABIAMoAggQgwILIABBDEEEEIMCDwsgAEEEahBzDwsgAEEEahBzCwuQAgEDfyMAQZABayICJAACQAJAIAFFBEAgAkEIaiEEIwBBkAFrIgEkAAJAAkAgAARAIABBCGsiAygCAEEBRw0BIAEgAEGQAfwKAAAgA0EANgIAAkAgA0F/Rg0AIABBBGsiACAAKAIAQQFrIgA2AgAgAA0AIANBmAFBCBCDAgsgBCABQQhqQYgB/AoAACABQZABaiQADAILEKUCAAtBtLPAAEE/EKQCAAsgAi0ACEUNASACKAIUIgAEQCACKAIQIABBARCDAgsgAigCIEGALEEBEIMCDAELIABFDQEgAiAAQQhrIgA2AgggACAAKAIAQQFrIgA2AgAgAA0AIAJBCGoQqgELIAJBkAFqJAAPCxClAgALhQEBAX8jAEEgayIDJAACQCAABEAgAyACNgIcIAMgATYCGCADIAI2AhQgA0EIaiADQRRqEHsgACgCAA0BIAMoAgwhASADKAIIIQIgAEF/NgIAIABBBGoQcyAAIAE2AgwgACACNgIIIAAgATYCBCAAQQA2AgAgA0EgaiQADwsQpQIACxCmAgALegEBfwJAIAAoAgAiACgCDEGAgICAeEYNACAAQQxqEHMgAEEYahBzIAAoAiRBgICAgHhHBEAgAEEkahBzCyAAKAIwQYCAgIB4Rg0AIABBMGoQcwsCQCAAQX9GDQAgACAAKAIEQQFrIgE2AgQgAQ0AIABBxAJBBBCDAgsLhQEBAn8gASgCAEGAgICAeEcEQCAAIAEpAgA3AgAgAEEIaiABQQhqKAIANgIADwsgASgCBCEDAkACQCABKAIIIgFFBEBBASECDAELIAFBARCRAiICRQ0BCyABBEAgAiADIAH8CgAACyAAIAE2AgggACACNgIEIAAgATYCAA8LQQEgARDuAQALbAEDfyMAQRBrIgIkACAALQAAIQNBACEAA0AgACACakEPaiADQQ9xQay0wQBqLQAAOgAAIABBAWshACADIgRBBHYhAyAEQQ9LDQALIAFBAUG8tMEAQQIgACACakEQakEAIABrEBogAkEQaiQAC4cBAgF/AX4jAEEQayICJAAgAkEANgIEIAJBCGogASACQQRqQQQQlAECQAJAAn8gAi0ACEEERgRAIAIoAgQMAQsgAikDCCIDQv8Bg0IEUg0BIANCIIinCyEBIABBjYCAgHg2AgAgACABNgIEDAELIAAgAzcCBCAAQYuAgIB4NgIACyACQRBqJAALqQECA38CfiMAQRBrIgAkACMAQRBrIgEkACABQQA6AA9BAUEBEJECIgJFBEBBAUEBEKgCAAsgACABQQ9qrTcDACAAIAKtNwMIIAJBAUEBEIMCIAFBEGokACAAKQMAIQMgACkDCCEEQcCJwgAtAABBAkYEQEG4/8AAQf0AQfj/wAAQnwEAC0HAicIAQQE6AABBuInCACAENwMAQbCJwgAgAzcDACAAQRBqJAALSQEDfiAAIAFC/////w+D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AAJAIAFBf0YNACAAQQRrIgAgACgCAEEBayIANgIAIAANACABQRhBBBCDAgsMAwsQpQIAC0GYxcAAQT8QpAIACyAARQ0BIAIgAEEIayIANgIEIAAgACgCAEEBayIANgIAIAANACACQQRqEMgBCyACQRBqJAAPCxClAgAL4AEBA38jAEGAA2siAiQAAkACQCABRQRAIAJBCGohBCMAQYADayIBJAACQCAABEAgAEEIayIDKAIAQQFHDQEgASAAQYAD/AoAACADQQA2AgACQCADQX9GDQAgAEEEayIAIAAoAgBBAWsiADYCACAADQAgA0GIA0EIEIMCCyAEIAFBCGpB+AL8CgAAIAFBgANqJAAMAwsQpQIAC0H8zcAAQT8QpAIACyAARQ0BIAIgAEEIayIANgIIIAAgACgCAEEBayIANgIAIAANACACQQhqEMUBCyACQYADaiQADwsQpQIAC2sBAn8gACgCACEBIABBgIDEADYCAAJAIAFBgIDEAEcNAEGAgMQAIQEgACgCBCICIAAoAghGDQAgACACQQFqNgIEIAAgACgCDCIAIAItAAAiAUEPcWotAAA2AgAgACABQQR2ai0AACEBCyABC1wBAX8jAEEgayIFJAAgBSABNgIEIAUgADYCACAFIAM2AgwgBSACNgIIIAUgBUEIaq1CgICAgMAMhDcDGCAFIAWtQoCAgICgDIQ3AxBB44zAACAFQRBqIAQQnwEAC0kBAX8jAEEQayICJAAgASAAKAIAIgBBf3NBH3ZBAUEAIAAgAEEfdSIBcyABayACQQZqIgEQKiIAIAFqQQogAGsQGiACQRBqJAALWwECfyABKAIEIQMCQAJAIAEoAggiAUUEQEEBIQIMAQsgAUEBEJECIgJFDQELIAEEQCACIAMgAfwKAAALIAAgATYCCCAAIAI2AgQgACABNgIADwtBASABEO4BAAuvAgIFfwF+IwBBIGsiAiQAAkACQCABRQRAIwBBIGsiASQAAkAgAARAIABBCGsiAygCAEEBRw0BIAFBGGoiBCAAQRxqKQIANwMAIAFBEGoiBSAAQRRqKQIANwMAIAFBCGoiBiAAQQxqKQIANwMAIAApAgQhByADQQA2AgAgASAHNwMAAkAgA0F/Rg0AIABBBGsiACAAKAIAQQFrIgA2AgAgAA0AIANBLEEEEIMCCyACIAEpAwA3AAAgAkEYaiAEKQMANwAAIAJBEGogBSkDADcAACACQQhqIAYpAwA3AAAgAUEgaiQADAMLEKUCAAtB18HAAEE/EKQCAAsgAEUNASACIABBCGsiADYCACAAIAAoAgBBAWsiADYCACAADQAgAhDEAQsgAkEgaiQADwsQpQIAC9kBAQJ/IwBBkANrIgIkAAJAAkAgAUUEQCMAQaADayIBJAACQCAABEAgAEEIayIDKAIAQQFHDQEgAUEIaiAAQZgD/AoAACADQQA2AgACQCADQX9GDQAgAEEEayIAIAAoAgBBAWsiADYCACAADQAgA0GgA0EIEIMCCyACIAFBEGpBkAP8CgAAIAFBoANqJAAMAwsQpQIAC0HXwcAAQT8QpAIACyAARQ0BIAIgAEEIayIANgIAIAAgACgCAEEBayIANgIAIAANACACEMcBCyACQZADaiQADwsQpQIAC68CAgV/AX4jAEEgayICJAACQAJAIAFFBEAjAEEgayIBJAACQCAABEAgAEEIayIDKAIAQQFHDQEgAUEYaiIEIABBHGopAgA3AwAgAUEQaiIFIABBFGopAgA3AwAgAUEIaiIGIABBDGopAgA3AwAgACkCBCEHIANBADYCACABIAc3AwACQCADQX9GDQAgAEEEayIAIAAoAgBBAWsiADYCACAADQAgA0EsQQQQgwILIAIgASkDADcAACACQRhqIAQpAwA3AAAgAkEQaiAFKQMANwAAIAJBCGogBikDADcAACABQSBqJAAMAwsQpQIAC0GzwsAAQT8QpAIACyAARQ0BIAIgAEEIayIANgIAIAAgACgCAEEBayIANgIAIAANACACEMQBCyACQSBqJAAPCxClAgALSQACQCAAKAIAQYCAgIB4Rg0AIAAQcyAAQQxqEHMgACgCGEGAgICAeEcEQCAAQRhqEHMLIAAoAiRBgICAgHhGDQAgAEEkahBzCwtQAgF/AX4jAEEgayIDJAAgAyABNgIMIAMgADYCCCADQoCAgICwBCIEIANBCGqthDcDGCADIAQgA0EMaq2ENwMQQZyCwAAgA0EQaiACEJ8BAAtQAQN/IAAtAABBA0YEQCAAKAIEIgAoAgAhAiAAKAIEIgMoAgAiAQRAIAIgARECAAsgAygCBCIBBEAgAiABIAMoAggQgwILIABBDEEEEIMCCwtIAQF/IAAoAgAgACgCCCIDayAC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ASgCAEGmxcEAQQIgASgCBCgCDBEEAA0AIABBBGogARBCIQILIAILngUBCX8jAEEQayIHJAAQOSIGIAImASMAQUBqIgMkACADIAE2AjggAyAANgI0IAMgATYCMCADQQhqIANBMGoiChB7IAMgBjYCHCADIAMoAgwiBTYCGCADIAMoAggiADYCFCADQSBqIQkCQAJAAkAgBUELSQ0AIABBoNDAAEELEJEBDQAgBUELayIGDQEgCUEBQQAQMwwCCyAJQYOAgIB4NgIADAELIAZBARCRAiIBBEAgBgRAIAEgAEELaiAG/AoAAAsgASEAIAVBDEcEQCAGQX5xIQtBCyEFQQwhAANAIAEgBGoiCCAEQQsgBUH//wFuQQtqIARB9f8BSRtqQf8AcUGgz8AAai0AACAILQAAczoAACAIQQFqIgggBEEMIABB//8BbkEMaiAEQQFqQfX/AUkbakH/AHFBoM/AAGotAAAgCC0AAHM6AAAgBUECaiEFIABBAmohACAEQQJqIgQgC0cNAAsgASAEaiEACyAGQQFxBEAgACAEQQtqIgUgBUH//wFwIARB9f8BSRtB/wBxLQCgz0AgAC0AAHM6AAALIAkgASAGEDMgASAGQQEQgwIMAQtBASAGEO4BAAsgBwJ/AkACQCADKAIgQYSAgIB4RwRAIANBOGogA0EoaikCADcDACADIAMpAiA3AzAgChBZIQEgA0EUahCnAQwBCyADKAIkIQAgAygCLCEEIAMoAighASADQRRqEKcBIABBgICAgHhHDQELQQAhBUEAIQBBAQwBCyADIAQ2AjggAyABNgI0IAMgADYCMCADIANBMGoQe0EAIQEgAygCACEFIAMoAgQhAEEACzYCDCAHIAE2AgggByAANgIEIAcgBTYCACADQUBrJAAgBygCACAHKAIEIAcoAgggBygCDCAHQRBqJAALLwEBfyAALQAABEAgACgCDCIBBEAgACgCCCABQQEQgwILIAAoAhhBgCxBARCDAgsLkQgBDH8jAEEQayIGJAAjAEEwayIDJAAgAyABNgIoIAMgADYCJCADIAE2AiAgA0EIaiADQSBqIgwQeyADQRBqIQggAygCCCINIQAgAygCDCILIQQjAEHgAGsiAiQAAkACQAJAAkACQAJAAkACQCAEQQFxBEBBgIDEACEBDAELIAJBgoDEADYCICACQgI3AjAgAiAENgIsIAIgADYCKCACIAJBIGo2AjggAkEYaiACQShqEDYCQCACLQAYBEAgAi0AGSEBAkAgAigCOCgCAEGCgMQARw0AIAIoAixFDQAgAigCMEUNBwtBCEEBEJECIgBFDQcgACABOgAAIAJBATYCRCACIAA2AkAgAkEINgI8IAJB2ABqIAJBOGooAgA2AgAgAkHQAGogAkEwaikCADcDACACIAIpAig3A0ggAkEQaiACQcgAahA2An8gAi0AEARAIAItABEhAUEBIQQDQCACKAI8IARGBEACQCACKAJYKAIAQYKAxABHDQAgAigCTEUNACACKAJQRQ0NCyMAQRBrIgAkACAAQQRqIAJBPGoiBSgCACIHIAUoAgRBCCAEQQFqIgogB0EBdCIHIAcgCkkbIgcgB0EITRsiBxB4IAAoAgRBAUYEQCAAKAIIIAAoAgwQ7gEACyAAKAIIIQogBSAHNgIAIAUgCjYCBCAAQRBqJAAgAigCQCEACyAAIARqIAE6AAAgAiAEQQFqIgQ2AkQgAkEIaiACQcgAahA2IAItAAkhASACLQAIDQALIAIoAkAhACACKAI8IQUgAigCICIBQYKAxABGDQMgAigCJCIEIAUNARoMBAsgAigCICIBQYKAxABGBEAgCCAAQQEQM0EIIQUMBgtBCCEFIAIoAiQLIQQgACAFQQEQgwIMAgsgAigCICIBQYKAxABGBEAgCEEBQQAQMwwFCyACKAIkIQQMAQsgBUGAgICAeEcNASAAIQELIAggBDYCCCAIIAE2AgQgCEGCgICAeDYCAAwCCyAIIAAgBBAzIAVFDQELIAAgBUEBEIMCCyACQeAAaiQADAMLQYjbwAAQiQIAC0EBQQgQ7gEAC0GI28AAEIkCAAsCfyADKAIQQYSAgIB4RwRAIANBKGogA0EYaikCADcDACADIAMpAhA3AyBBgICAgHghACAMEFkMAQsgAygCHCEJIAMoAhQhACADKAIYCyEBIAsEQCANIAtBARCDAgsgBgJ/IABBgICAgHhGBEBBACEAQQAhCUEBDAELIAMgCTYCKCADIAE2AiQgAyAANgIgIAMgA0EgahB7QQAhASADKAIAIQAgAygCBCEJQQALNgIMIAYgATYCCCAGIAk2AgQgBiAANgIAIANBMGokACAGKAIAIAYoAgQgBigCCCAGKAIMIAZBEGokAAv0CgIDfg5/IwBBEGsiCiQAIwBBMGsiBSQAIAUgATYCKCAFIAA2AiQgBSABNgIgIAVBCGogBUEgahB7IAVBFGohDSAFKAIIIg8hCSAFKAIMIg4hBkEAIQAjAEEgayIIJAAgCEEIaiEMIwBBMGsiByQAIAYgCWohEAJAA0AgACAGakUEQCAJIQEMAgsgAEEBayIAIBBqIgEtAAAiC0HcAEcgC0EvR3ENAAtBACAAayEGCyAGQQRJBH9BAAUgAUEAIAEgBkEEayILaigAAEGu4tGLBkYbCyEAQgQhAgJAAkACQCALIAYgABsiCUEDSQ0AIAAgASAAGyIAQbDCwABBAxCRAUUEQCAHQRhqQajJwAAgAEEDaiAJQQNrEDwgBykCHCECIAcoAhgiAEGAgICAeEYNAQwCCyAJQQNGDQAgACgAAEGu4PmLAkcNACAHQRhqQeXGwAAgAEEEaiAJQQRrEDwgBykCHCECIAcoAhgiAEGAgICAeEcNAQsgDEEBOgAAIAwgAjcCBAwBCyAHIAA2AgwgByACNwIQIAKnIQlBACEAAkAgAkKAgICAEFQNACACQiCIpyEBA0AgACAJai0AAEHAAEYNASABIABBAWoiAEcNAAsgASEACwJ+QgAhAkIAIABFDQAaIABBA3EhAQJAIABBBEkEQEEAIQYMAQsgAEH8////B3EhC0EAIQYDQCACIAYgCWoiADEAAIVCs4OAgIAgfiAAQQFqMQAAhUKzg4CAgCB+IABBAmoxAACFQrODgICAIH4gAEEDajEAAIVCs4OAgIAgfiECIAsgBkEEaiIGRw0ACwsgAQRAIAYgCWohBgNAIAIgBjEAAIVCs4OAgIAgfiECIAZBAWohBiABQQFrIgENAAsLIAILIQIgB0EgaiIAQgA3AwAgB0IANwMYIAcgAkI4hiACQoD+A4NCKIaEIAJCgID8B4NCGIYgAkKAgID4D4NCCIaEhCACQgiIQoCAgPgPgyACQhiIQoCA/AeDhCACQiiIQoD+A4MgAkI4iISEhDcDKCAHQRhqQQggB0EoakEIQZjCwAAQzQEgDEEJaiAAKQMANwAAIAwgBykDGDcAASAMQQA6AAAgB0EMahBzCyAHQTBqJAACQAJAAkAgCC0ACEEBRgRAIAggCCkCDDcDCCMAQTBrIgAkACAAQQA2AhwgAEKAgICAEDcCFCAAQbi0wAA2AiQgAEKggICABjcCKCAAIABBFGo2AiACfyAAQSBqIQEgDC0AAEEERgRAIAFBm/3AAEErEPoBDAELIAFBgP3AAEEbEPoBCwRAQeC0wABBNyAAQQhqQdC0wABBmLXAABCGAQALIABBEGogAEEcaigCACIBNgIAIAAgACkCFDcDCCAAKAIMIAEQ9gEhASAAQQhqEHMgAEEwaiQAIA1BgICAgHg2AgAgDSABNgIEDAELIAhBBmoiASAILQALOgAAIAggCC8ACTsBBCAIQRhqMQAAIQIgCDUCFCEDIAgpAgwhBEEQQQEQkQIiAEUNASAAIAMgAkIghoQiAj4ACyAAIAgvAQQ7AAAgACAENwADIA1BEDYCCCANIAA2AgQgDUEQNgIAIABBD2ogAkIgiDwAACAAQQJqIAEtAAA6AAALIAhBIGokAAwBC0EBQRAQ7gEACyAOBEAgDyAOQQEQgwILAn8gBSgCFEGAgICAeEYEQEEBIQAgBSgCGCERQQAMAQsgBUEoaiAFQRxqKAIANgIAIAUgBSkCFDcDICAFIAVBIGoQeyAFKAIEIRJBACEAIAUoAgALIQEgCiAANgIMIAogETYCCCAKIBI2AgQgCiABNgIAIAVBMGokACAKKAIAIAooAgQgCigCCCAKKAIMIApBEGokAAu5BAIEfwJ+IwBBEGsiBSQAIwBBwAZrIgQkACAEIAE2ArADIAQgADYCrAMgBCABNgKoAyAEQQhqIARBqANqIgAQeyAEKAIMIQYgBCgCCCEHIAQgAzYCsAMgBCACNgKsAyAEIAM2AqgDIAQgABB7IAQoAgAhAiAEKAIEIQMgBEEQaiIBAn8gBkEQRwRAIAEQXTYCBEEBDAELIANBEEcEQCABEF02AgRBAQwBCyMAQfACayIAJAAgAEEQaiAHEAkgAEEIakIANwMAIABCADcDACACKQAIIQggAikAACEJIAFBCGoiASAAQfAC/AoAACABQQA6AIgDIAFCADcDgAMgASAJNwPwAiABIAhCOIYgCEKA/gODQiiGhCAIQoCA/AeDQhiGIAhCgICA+A+DQgiGhIQgCEIIiEKAgID4D4MgCEIYiEKAgPwHg4QgCEIoiEKA/gODIAhCOIiEhIQ3A/gCIABB8AJqJABBAAs2AgAgAwRAIAIgA0EBEIMCCyAGBEAgByAGQQEQgwILQQEhAAJ/IAQoAhBBAUYEQCAEKAIUDAELIARBsANqIARBGGpBkAP8CgAAQQAhACAEQQA2AqgDAn9BoANBCBCRAiIBBEAgAUKBgICAEDcDACABQQhqIARBqANqQZgD/AoAACABDAELQQhBoAMQqAIAC0EIagshASAFIAA2AgggBSABQQAgABs2AgQgBUEAIAEgABs2AgAgBEHABmokACAFKAIAIAUoAgQgBSgCCCAFQRBqJAALyBcCKH8EfiMAQRBrIgokACMAQaAGayIFJAAgBSABNgKoAyAFIAA2AqQDIAUgATYCoAMgBUEIaiAFQaADaiIAEHsgBSgCDCEVIAUoAgghFiAFIAM2AqgDIAUgAjYCpAMgBSADNgKgAyAFIAAQeyAFIAUoAgQiADYCHCAFIAUoAgA2AhggBSAANgIUIAVBIGohFyMAQZADayILJAAgC0EIaiEGIAVBFGoiGCgCBCECIBgoAgghASMAQSBrIgckAAJAAkAgFUEMTwRAIAdBADYCDCAHQQxqQQQgFkEEQYjFwAAQzQECQAJAIActAAxBxQBHDQAgBy0ADUEhRw0AIActAA5BMEYNAQtCAyEsIAc1AgwhLQwCCyAHMQAPIi1CNFIEQEIEISwMAgsgFikABCEsIAdBEGohGSMAQeADayIEJAAgBEEYakIANwMAIARBEGpCADcDACAEQQhqQgA3AwAgBEIANwMAIARB0ABqIwBBkANrIgAkACAAQQhqQQBBwAD8CwACQCABQcEATwRAIABB6ABqIgNBAEHBAPwLACAAQeAAaiIMQfDDy558NgIAIABB2ABqIhpC/rnrxemOlZkQNwMAIABCgcaUupbx6uZvNwNQIAAgAUEGdiIIrTcDSCAAQdAAaiACIAgQByADIAFBP3EiAyACIAFBwP///wdxaiADQfC1wAAQzQEgACADOgCoASAAQbABaiAAQcgAakHoAPwKAAAgAEGoAmpBADYCACAAQaACakIANwMAIABCADcDmAIgACkDsAEhLSAALQCQAiEBIABBwAJqIAwoAgA2AgAgAEG4AmogGikDADcDACAAIAApA1A3A7ACIAEgAEHQAWoiAmoiA0GAAToAACAAIAGtIi5CO4YgLUIJhiIvIC5CA4aEIi5CgP4Dg0IohoQgLkKAgPwHg0IYhiAuQoCAgPgPg0IIhoSEIC1CAYZCgICA+A+DIC1CD4hCgID8B4OEIC1CH4hCgP4DgyAvQjiIhISENwPIAgJAAkAgAUE/RwRAIAFBP3MiDARAIANBAWpBACAM/AsACyABQThzQQdLDQELIABBsAJqIgEgAkEBEAcgAEHQAmoiAkEAQcAA/AsAIABBiANqQQggAEHIAmpBCEGQtsAAEM0BIAEgAkEBEAcMAQsgAEGIAmpBCCAAQcgCakEIQYC2wAAQzQEgAEGwAmogAkEBEAcLQQAhASAAQQA6AJACA0AgACAAQbACaiABaigCACICQRh0IAJBgP4DcUEIdHIgAkEIdkGA/gNxIAJBGHZycjYC0AIgAEGYAmogAWpBBCAAQdACaiICQQRBwLbAABDNASABQQRqIgFBFEcNAAsgAEHYAmogAEGgAmopAwA3AwAgAEHgAmogAEGoAmooAgA2AgAgACAAKQOYAjcD0AIgAEEIakEUIAJBFEGgtsAAEM0BDAELIABBCGogASACIAFBsLbAABDNAQsgAEEIakHAAPwKAAAgAEGQA2okAEEAIQEDQCAEQdAAaiIAIAFqIgIgAi0AAEE2czoAACABQQFqIgFBwABHDQALIARB8MPLnnw2ArgDIARC/rnrxemOlZkQNwOwAyAEQoHGlLqW8ermbzcDqAMgBEIBNwOgAyAEQagDaiAAQQEQB0EAIQEDQCAEQdAAaiIAIAFqIgIgAi0AAEHqAHM6AAAgAUEBaiIBQcAARw0ACyAEQdgDaiIBQfDDy558NgIAIARB0ANqIhtC/rnrxemOlZkQNwMAIARByANqIhBCgcaUupbx6uZvNwMAIARCATcDwAMgECAAQQEQByAEQZACaiABKQMANwMAIARBiAJqIBspAwA3AwAgBEGAAmogECkDADcDACAEQeABaiIeIARBqANqIhEpAwA3AwAgBEHoAWoiHyAEQbADaiISKQMANwMAIARB8AFqIiAgBEG4A2opAwA3AwAgBCAEKQPAAzcD+AEgBCAEKQOgAzcD2AEgBEHgAmogBEHYAWpBwAD8CgAAQSAhCSAEQYADaiEPIARBoAFqISEgBEH4AWohCCAEQZgCaiEOIARBkAFqIRMgBCEAQYCAgAghAQNAQRQgCSAJQRRPGyICBEAgAEEAIAL8CwALIB4gBEHoAmoiIikDADcDACAfIARB8AJqIiMpAwA3AwAgICAEQfgCaiIkKQMANwMAIAhBGGoiJSAPQRhqIiYpAwA3AwAgCEEQaiInIA9BEGoiKCkDADcDACAIQQhqIikgD0EIaiIqKQMANwMAIAggDykDADcDACAEIAQpA+ACNwPYASATQQBBwAD8CwAgBEHQAGoiDCAEQdgBaiIDQcAA/AoAACAEQQA6ANABIBNBEEHoxMAAQRBB5MPAABDNASAEQRA6ANABIAQgATYC2AEgIUEEIANBBEHkw8AAEM0BIARBFDoA0AEgAyAMQYgB/AoAACASQQA2AgAgEUIANwMAIARCADcDoAMgG0EANgIAIBBCADcDACAEQgA3A8ADIAMgDiAEQcADaiIBEC8gBEEAOgDYAiAOQRQgAUEUQeTDwAAQzQEgBEEUOgDYAiAIIA4gBEGgA2oQLyAEQUBrIhQgESkDADcDACAEQcgAaiIcIBIoAgA2AgAgBCAEKQOgAzcDOCAJBEAgBEE4aiENIAIhAyAAIQEDQCABIAEtAAAgDS0AAHM6AAAgDUEBaiENIAFBAWohASADQQFrIgMNAAsLIAkgAmsgACACaiAEQTBqIisgHCgCADYCACAEQShqIhwgFCkDADcDACAEIAQpAzg3AyBBASEUA0AgJSAmKQMANwMAICcgKCkDADcDACApICopAwA3AwAgCCAPKQMANwMAIB4gIikDADcDACAfICMpAwA3AwAgICAkKQMANwMAIAQgBCkD4AI3A9gBIBNBAEHAAPwLACAEQdAAaiIDIARB2AFqIgFBwAD8CgAAIARBADoA0AEgE0EUIARBIGoiDUEUQeTDwAAQzQEgBEEUOgDQASABIANBiAH8CgAAIBJBADYCACARQgA3AwAgBEIANwOgAyAbQQA2AgAgEEIANwMAIARCADcDwAMgASAOIARBwANqIgEQLyAEQQA6ANgCIA5BFCABQRRB5MPAABDNASAEQRQ6ANgCIAggDiAEQaADahAvIBwgESkDADcDACArIBIoAgA2AgAgBCAEKQOgAzcDICAJBEAgAiEDIAAhAQNAIAEgAS0AACANLQAAczoAACANQQFqIQ0gAUEBaiEBIANBAWsiAw0ACwsgFEEBaiIUQegHRw0ACyAdIQJBgICAECEBQQEhHSEAIQkgAkUNAAsgBEHgAWoiAEIANwMAIARCADcD2AEgBEHYAWpBECAEQRBB+MTAABDNASAZQQhqIAApAwA3AAAgGSAEKQPYATcAACAEQeADaiQAIAZBCGogGRAJIAZBNDoA/AIgBkGAgMAANgL4AiAGQoyAgICAgoAINwPwAiAGQQA2AgAgBiAsQjiGICxCgP4Dg0IohoQgLEKAgPwHg0IYhiAsQoCAgPgPg0IIhoSEICxCCIhCgICA+A+DICxCGIhCgID8B4OEICxCKIhCgP4DgyAsQjiIhISENwPoAgwCCyAGQQE2AgAgBkKAgICAwAE3AgQMAQsgBkEBNgIAIAYgLUIIhiAshDcCBAsgB0EgaiQAQQEhAAJAIAsoAghBAUYEQCALIAspAgw3A4gDIBcgC0GIA2oQYDYCBCAYEHMMAQsgF0EIaiALQRBqQfgC/AoAACAYEHNBACEACyAXIAA2AgAgC0GQA2okACAVBEAgFiAVQQEQgwILQQEhAQJ/IAUoAiBBAUYEQCAFKAIkDAELIAVBqANqIAVBKGpB+AL8CgAAQQAhASAFQQA2AqADAn9BiANBCBCRAiIABEAgAEKBgICAEDcDACAAQQhqIAVBoANqQYAD/AoAACAADAELQQhBiAMQqAIAC0EIagshACAKIAE2AgggCiAAQQAgARs2AgQgCkEAIAAgARs2AgAgBUGgBmokACAKKAIAIAooAgQgCigCCCAKQRBqJAALvQUBCn8jAEEQayIHJAAQOSIFIAMmASACIQQjAEFAaiICJAAgAkEcaiILIAAQfyACKAIcIQkgAiAENgI8IAIgATYCOCACIAQ2AjQgAkEQaiACQTRqEHsgAiAFNgIwIAIgAigCFCIANgIsIAIgAigCECIBNgIoIwBBIGsiCCQAIwBBQGoiBCQAIAhBDGoiCgJ/IAAgCSgC8AIiBSAJKALsAiIGIAUgBksbIgVJBEAgCiAFNgIIIApBATYCBEEBDAELAkACQCAFQQ9xDQAgBUEgTwRAIAVBBXYhBiABIQADQCAEQSBqIAkgABAOIABBGGogBEE4aikAADcAACAAQRBqIARBMGopAAA3AAAgAEEIaiAEQShqKQAANwAAIAAgBCkAIDcAACAAQSBqIQAgBkEBayIGDQALCwJAIAVBEHEEQCAEQRhqQgA3AwAgBEEIaiABIAVBYHFqIgBBCGoiBikAADcDACAEQgA3AxAgBCAAKQAANwMAIARBIGogCSAEEA4gBiAEQShqKQAANwAAIAAgBCkAIDcAAAwBCyAFRQ0BCyABIAVBBHZBAWsiCUEEdGoiBi0ADyIFQRFrQf8BcUHwAUkNAEEQIAVrQf8BcSIMIQADQCAAQQ9GDQIgACAGaiAAQQFqIQAtAAAgBUYNAAsLIApBBTYCBEEBDAELIAogATYCBCAKIAlBBHQgDGo2AghBAAs2AgAgBEFAayQAQQEhACACQQhqIgECfyAIKAIMQQFGBEAgCCAIKQIQNwMYIAhBGGoQYAwBC0EAIQAgCCgCFAs2AgQgASAANgIAIAhBIGokACACKAIMIQAgAigCCCEBIAJBKGoQpwEgCxCxASAHIAE2AgggByAAQQAgAUEBcSIBGzYCBCAHQQAgACABGzYCACACQUBrJAAgBygCACAHKAIEIAcoAgggB0EQaiQAC6BmAi5/A34jAEEQayIpJAAQOSIEIAMmASMAQUBqIhckACAXQRxqIi8gABCAASAXKAIcIR8gFyACNgI8IBcgATYCOCAXIAI2AjQgF0EQaiAXQTRqEHsgFyAENgIwIBcgFygCFCIcNgIsIBcgFygCECIgNgIoIBdBCGohLiMAQRBrIiokACAqQQRqISEjAEHAB2siASQAIAFBGGpB3PfAACkAADcDACABQRBqQdT3wAApAAA3AwAgAUEIakHM98AAKQAANwMAIAFBxPfAACkAADcDACABQSBqIQIjAEHgA2siACQAQcAAIQUgAEFAa0EAQaAD/AsAIAAgASgADCIEQQF2IARzQdWq1aoFcSIRIARzIgcgASgACCIIQQF2IAhzQdWq1aoFcSIQIAhzIhNBAnZzQbPmzJkDcSISIAdzIgsgASgABCIHQQF2IAdzQdWq1aoFcSIUIAdzIg8gASgAACIKQQF2IApzQdWq1aoFcSIVIApzIhZBAnZzQbPmzJkDcSIZIA9zIhpBBHZzQY+evPgAcSIbIAtzNgIcIAAgASgAHCILQQF2IAtzQdWq1aoFcSIiIAtzIgwgASgAGCIPQQF2IA9zQdWq1aoFcSIjIA9zIiRBAnZzQbPmzJkDcSIlIAxzIh0gASgAFCIMQQF2IAxzQdWq1aoFcSIeIAxzIhggASgAECIOQQF2IA5zQdWq1aoFcSImIA5zIidBAnZzQbPmzJkDcSIoIBhzIhhBBHZzQY+evPgAcSIrIB1zNgI8IAAgBCARQQF0cyIEIAggEEEBdHMiCEECdnNBs+bMmQNxIhEgBHMiBCAHIBRBAXRzIgcgCiAVQQF0cyIKQQJ2c0Gz5syZA3EiECAHcyIHQQR2c0GPnrz4AHEiFCAEczYCGCAAIBJBAnQgE3MiBCAZQQJ0IBZzIhNBBHZzQY+evPgAcSISIARzNgIUIAAgG0EEdCAaczYCDCAAIAsgIkEBdHMiBCAPICNBAXRzIgtBAnZzQbPmzJkDcSIPIARzIgQgDCAeQQF0cyIMIA4gJkEBdHMiDkECdnNBs+bMmQNxIhUgDHMiDEEEdnNBj568+ABxIhYgBHM2AjggACAlQQJ0ICRzIgQgKEECdCAncyIZQQR2c0GPnrz4AHEiGiAEczYCNCAAICtBBHQgGHM2AiwgACARQQJ0IAhzIgQgEEECdCAKcyIIQQR2c0GPnrz4AHEiCiAEczYCECAAIBRBBHQgB3M2AgggACASQQR0IBNzNgIEIAAgD0ECdCALcyIEIBVBAnQgDnMiB0EEdnNBj568+ABxIgsgBHM2AjAgACAWQQR0IAxzNgIoIAAgGkEEdCAZczYCJCAAIApBBHQgCHM2AgAgACALQQR0IAdzNgIgQQghBwNAIABB+AAgBxA6IAAgBmoiBEFAayIIECAgCCAIKAIAQX9zNgIAIARBxABqIgggCCgCAEF/czYCACAEQdQAaiIIIAgoAgBBf3M2AgAgBEHYAGoiCCAIKAIAQX9zNgIAIAAgBWoiCCAIKAIAQYCAA3M2AgAgAEH4ACAHQQhqIghBEEEOEBYgBkGAA0YEQEEAIQYDQCAAIAZqIgRBQGsiBSAFKAIAIgVBBHYgBXNBgJ6A+ABxQRFsIAVzNgIAIARBIGoiBSAFKAIAIgVBBHYgBXNBgJi8GHFBEWwgBXMiBUECdiAFc0GA5oCYA3FBBWwgBXM2AgAgBEEkaiIFIAUoAgAiBUEEdiAFc0GAmLwYcUERbCAFcyIFQQJ2IAVzQYDmgJgDcUEFbCAFczYCACAEQShqIgUgBSgCACIFQQR2IAVzQYCYvBhxQRFsIAVzIgVBAnYgBXNBgOaAmANxQQVsIAVzNgIAIARBLGoiBSAFKAIAIgVBBHYgBXNBgJi8GHFBEWwgBXMiBUECdiAFc0GA5oCYA3FBBWwgBXM2AgAgBEEwaiIFIAUoAgAiBUEEdiAFc0GAmLwYcUERbCAFcyIFQQJ2IAVzQYDmgJgDcUEFbCAFczYCACAEQTRqIgUgBSgCACIFQQR2IAVzQYCYvBhxQRFsIAVzIgVBAnYgBXNBgOaAmANxQQVsIAVzNgIAIARBOGoiBSAFKAIAIgVBBHYgBXNBgJi8GHFBEWwgBXMiBUECdiAFc0GA5oCYA3FBBWwgBXM2AgAgBEE8aiIFIAUoAgAiBUEEdiAFc0GAmLwYcUERbCAFcyIFQQJ2IAVzQYDmgJgDcUEFbCAFczYCACAEQcQAaiIFIAUoAgAiBUEEdiAFc0GAnoD4AHFBEWwgBXM2AgAgBEHIAGoiBSAFKAIAIgVBBHYgBXNBgJ6A+ABxQRFsIAVzNgIAIARBzABqIgUgBSgCACIFQQR2IAVzQYCegPgAcUERbCAFczYCACAEQdAAaiIFIAUoAgAiBUEEdiAFc0GAnoD4AHFBEWwgBXM2AgAgBEHUAGoiBSAFKAIAIgVBBHYgBXNBgJ6A+ABxQRFsIAVzNgIAIARB2ABqIgUgBSgCACIFQQR2IAVzQYCegPgAcUERbCAFczYCACAEQdwAaiIFIAUoAgAiBUEEdiAFc0GAnoD4AHFBEWwgBXM2AgAgBEHgAGoiBSAFKAIAIgVBBHYgBXNBgIa84ABxQRFsIAVzIgVBAnYgBXNBgOaAmANxQQVsIAVzNgIAIARB5ABqIgUgBSgCACIFQQR2IAVzQYCGvOAAcUERbCAFcyIFQQJ2IAVzQYDmgJgDcUEFbCAFczYCACAEQegAaiIFIAUoAgAiBUEEdiAFc0GAhrzgAHFBEWwgBXMiBUECdiAFc0GA5oCYA3FBBWwgBXM2AgAgBEHsAGoiBSAFKAIAIgVBBHYgBXNBgIa84ABxQRFsIAVzIgVBAnYgBXNBgOaAmANxQQVsIAVzNgIAIARB8ABqIgUgBSgCACIFQQR2IAVzQYCGvOAAcUERbCAFcyIFQQJ2IAVzQYDmgJgDcUEFbCAFczYCACAEQfQAaiIFIAUoAgAiBUEEdiAFc0GAhrzgAHFBEWwgBXMiBUECdiAFc0GA5oCYA3FBBWwgBXM2AgAgBEH4AGoiBSAFKAIAIgVBBHYgBXNBgIa84ABxQRFsIAVzIgVBAnYgBXNBgOaAmANxQQVsIAVzNgIAIARB/ABqIgQgBCgCACIEQQR2IARzQYCGvOAAcUERbCAEcyIEQQJ2IARzQYDmgJgDcUEFbCAEczYCACAGQYABaiIGQYADRw0ACyAAIAAoAiBBf3M2AiAgACAAKAIkQX9zNgIkIAAgACgCNEF/czYCNCAAIAAoAqgDIgRBBHYgBHNBgJi8GHFBEWwgBHMiBEECdiAEc0GA5oCYA3FBBWwgBHM2AqgDIAAgACgCrAMiBEEEdiAEc0GAmLwYcUERbCAEcyIEQQJ2IARzQYDmgJgDcUEFbCAEczYCrAMgACAAKAKwAyIEQQR2IARzQYCYvBhxQRFsIARzIgRBAnYgBHNBgOaAmANxQQVsIARzNgKwAyAAIAAoArwDIgRBBHYgBHNBgJi8GHFBEWwgBHMiBEECdiAEc0GA5oCYA3FBBWwgBHM2ArwDIAAoAqADIQQgACgCpAMhBiAAKAK0AyEFIAAoArgDIQggACAAKAI4QX9zNgI4IAAgACgCQEF/czYCQCAAIAAoAkRBf3M2AkQgACAAKAJUQX9zNgJUIAAgACgCWEF/czYCWCAAIAAoAmBBf3M2AmAgACAAKAJkQX9zNgJkIAAgACgCdEF/czYCdCAAIAAoAnhBf3M2AnggACAAKAKAAUF/czYCgAEgACAAKAKEAUF/czYChAEgACAAKAKUAUF/czYClAEgACAAKAKYAUF/czYCmAEgACAAKAKgAUF/czYCoAEgACAAKAKkAUF/czYCpAEgACAAKAK0AUF/czYCtAEgACAAKAK4AUF/czYCuAEgACAAKALAAUF/czYCwAEgACAAKALEAUF/czYCxAEgACAAKALUAUF/czYC1AEgACAAKALYAUF/czYC2AEgACAAKALgAUF/czYC4AEgACAAKALkAUF/czYC5AEgACAAKAL0AUF/czYC9AEgACAAKAL4AUF/czYC+AEgACAAKAKAAkF/czYCgAIgACAAKAKEAkF/czYChAIgACAAKAKUAkF/czYClAIgACAAKAKYAkF/czYCmAIgACAAKAKgAkF/czYCoAIgACAAKAKkAkF/czYCpAIgACAAKAK0AkF/czYCtAIgACAAKAK4AkF/czYCuAIgACAAKALAAkF/czYCwAIgACAAKALEAkF/czYCxAIgACAAKALUAkF/czYC1AIgACAAKALYAkF/czYC2AIgACAAKALgAkF/czYC4AIgACAAKALkAkF/czYC5AIgACAAKAL0AkF/czYC9AIgACAAKAL4AkF/czYC+AIgACAAKAKAA0F/czYCgAMgACAAKAKEA0F/czYChAMgACAAKAKUA0F/czYClAMgACgCmAMhByAAIAggCCAIQQR2c0GAmLwYcUERbHMiCEECdiAIc0GA5oCYA3FBBWwgCHNBf3M2ArgDIAAgBSAFIAVBBHZzQYCYvBhxQRFscyIFQQJ2IAVzQYDmgJgDcUEFbCAFc0F/czYCtAMgACAGIAYgBkEEdnNBgJi8GHFBEWxzIgZBAnYgBnNBgOaAmANxQQVsIAZzQX9zNgKkAyAAIAQgBCAEQQR2c0GAmLwYcUERbHMiBEECdiAEc0GA5oCYA3FBBWwgBHNBf3M2AqADIAAgB0F/czYCmAMgACAAKALAA0F/czYCwAMgACAAKALEA0F/czYCxAMgACAAKALUA0F/czYC1AMgACAAKALYA0F/czYC2AMgAiAAQeAD/AoAACAAQeADaiQABSAAQfgAIAgQOiAEQeAAaiIHECAgByAHKAIAQX9zNgIAIARB5ABqIgcgBygCAEF/czYCACAEQfQAaiIHIAcoAgBBf3M2AgAgBEH4AGoiBCAEKAIAQX9zNgIAIABB+AAgCEEIaiIHQRBBBhAWIAVBxABqIQUgBkFAayEGDAELCyABQYgEaiAfQRxqKQIANwIAIAEgHykCFDcCgARBBiEIAkACQCAcQQ9xDQAgASAgNgKUBCABICA2ApAEIAEgHEEEdiIJNgKYBEEAIQYjAEHQAGsiACQAIAJB4ANqIQcgAUGQBGoiBCgCCCIMQQFxIAQoAgQhESAEKAIAIRAgDEECTwRAIAxBAXYhBSAAQUBrIQoDQCAGIBBqIgRBD2otAAAhDiAEQQ5qLQAAIRIgBEENai0AACEUIARBDGotAAAhFSAEQQtqLQAAIRYgBEEKai0AACEZIARBCWotAAAhGiAEQQhqIgstAAAhGyAEQQdqLQAAISIgBEEGai0AACEjIARBBWotAAAhJCAEQQRqLQAAISUgBEEDai0AACEdIARBAmotAAAhHiAEQQFqLQAAIRggBC0AACEmIABBKGoiJyAEQRhqIg8pAAA3AwAgACAEQRBqIigpAAA3AyAgCiAoKQAANwAAIApBCGogDykAADcAACAEKQAAITIgAEEIaiIEIAspAAA3AwAgAEEQaiILIAopAwA3AwAgAEEYaiIPIABByABqIigpAwA3AwAgACAyNwMAIABBMGogAiAAEA8gDyAoKQAANwMAIAsgCikAADcDACAEIABBOGopAAA3AwAgACAAKQAwIjI3AwAgACACLQDgAyAyp3M6AAAgACAALQABIAItAOEDczoAASAAIAAtAAIgAi0A4gNzOgACIAAgAC0AAyACLQDjA3M6AAMgACAALQAEIAItAOQDczoABCAAIAAtAAUgAi0A5QNzOgAFIAAgAC0ABiACLQDmA3M6AAYgACAALQAHIAItAOcDczoAByAEIAQtAAAgAi0A6ANzOgAAIAAgAC0ACSACLQDpA3M6AAkgACAALQAKIAItAOoDczoACiAAIAAtAAsgAi0A6wNzOgALIAAgAC0ADCACLQDsA3M6AAwgACAALQANIAItAO0DczoADSAAIAAtAA4gAi0A7gNzOgAOIAAgAC0ADyACLQDvA3M6AA8gCyAmIAstAABzOgAAIAAgGCAALQARczoAESAAIB4gAC0AEnM6ABIgACAdIAAtABNzOgATIAAgJSAALQAUczoAFCAAICQgAC0AFXM6ABUgACAjIAAtABZzOgAWIAAgIiAALQAXczoAFyAPIBsgDy0AAHM6AAAgACAaIAAtABlzOgAZIAAgGSAALQAaczoAGiAAIBYgAC0AG3M6ABsgACAVIAAtABxzOgAcIAAgFCAALQAdczoAHSAAIBIgAC0AHnM6AB4gACAOIAAtAB9zOgAfIAYgEWoiDkEQaiALKQMANwAAIA5BGGogDykDADcAACAOQQhqIAQpAwA3AAAgDiAAKQMANwAAIAdBCGogJykDADcCACAHIAApAyA3AgAgBkEgaiEGIAVBAWsiBQ0ACwsEQCAAQShqIgYgECAMQf7///8AcUEEdCIEaiIFQQhqKQAAIjI3AwAgACAFKQAAIjM3AyAgAEEYakIANwAAIABCADcAECAAIDI3AAggACAzNwAAIABBMGogAiAAEA8gAC0AMCEFIAAtADEhCiAALQAyIQsgAC0AMyEPIAAtADQhDCAALQA1IQ4gAC0ANiEQIAAtADchEyAALQA4IRIgAC0AOSEUIAAtADohFSAALQA7IRYgAC0APCEZIAAtAD0hGiAALQA+IRsgAi0A4AMhIiACLQDhAyEjIAItAOIDISQgAi0A4wMhJSACLQDkAyEdIAItAOUDIR4gAi0A5gMhGCACLQDnAyEmIAItAOgDIScgAi0A6QMhKCAC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IABBEGoiDSAFKQMANwMAIABBGGoiByAAQcgAaiIYKQMANwMAIAAgMzcDACAAQTBqIAIgABAQIAcgGCkAADcDACANIAUpAAA3AwAgBCAAQThqKQAANwMAIAAgACkAMCIzNwMAIAAgAi0AoAMgM6dzOgAAIAAgAC0AASACLQChA3M6AAEgACAALQACIAItAKIDczoAAiAAIAAtAAMgAi0AowNzOgADIAAgAC0ABCACLQCkA3M6AAQgACAALQAFIAItAKUDczoABSAAIAAtAAYgAi0ApgNzOgAGIAAgAC0AByACLQCnA3M6AAcgBCAELQAAIAItAKgDczoAACAAIAAtAAkgAi0AqQNzOgAJIAAgAC0ACiACLQCqA3M6AAogACAALQALIAItAKsDczoACyAAIAAtAAwgAi0ArANzOgAMIAAgAC0ADSACLQCtA3M6AA0gACAALQAOIAItAK4DczoADiAAIAAtAA8gAi0ArwNzOgAPIA0gHSANLQAAczoAACAAICUgAC0AEXM6ABEgACAkIAAtABJzOgASIAAgIyAALQATczoAEyAAICIgAC0AFHM6ABQgACAbIAAtABVzOgAVIAAgGiAALQAWczoAFiAAIBkgAC0AF3M6ABcgByAWIActAABzOgAAIAAgFSAALQAZczoAGSAAIBQgAC0AGnM6ABogACASIAAtABtzOgAbIAAgEyAALQAcczoAHCAAIBAgAC0AHXM6AB0gACARIAAtAB5zOgAeIAAgCiAALQAfczoAHyAGIAtqIgpBEGogDSkDADcAACAKQRhqIAcpAwA3AAAgCkEIaiAEKQMANwAAIAogACkDADcAACAJQQhqIB4pAwA3AgAgCSAAKQMgNwIAIAZBIGohBiAIQQFrIggNAAsLBEAgAEEoaiIGIA8gH0H+////AHFBBHQiBGoiBUEIaikAACIzNwMAIAAgBSkAACI0NwMgIABBGGpCADcAACAAQgA3ABAgACAzNwAIIAAgNDcAACAAQTBqIAIgABAQIAAtADAhBSAALQAxIQggAC0AMiENIAAtADMhByAALQA0IR8gAC0ANSEKIAAtADYhDyAALQA3IQ4gAC0AOCERIAAtADkhECAALQA6IRMgAC0AOyESIAAtADwhFCAALQA9IRUgAC0APiEWIAItAKADIRkgAi0AoQMhGiACLQCiAyEbIAItAKMD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gPAANwMACyACKAIEIgFBgICAgHhyQYCAgIB4Rg0AIBQgAUEBEIMCCyACQeAAaiQAIABBOGoiASAAQawBaikCADcDACAAIAApAqQBNwMwIAAoAqABIgJBBUYEQCAGIAApAzA3AgQgBkEFNgIAIAZBDGogASkDADcCAAwBCyAAQdgAaiIDIABBzAFqKAIANgIAQRAhASAAQdAAaiIEIABBxAFqKQIANwMAIABByABqIgUgAEG8AWopAgA3AwAgACAAKQK0ATcDQCACQQRHBEAgBiACNgIAIAYgACkDMDcCBCAGIAApA0A3AhQgBkEMaiAAQThqKQMANwIAIAZBHGogBSkDADcCACAGQSRqIAQpAwA3AgAgBkEsaiADKAIANgIADAELAkACQAJAAkAgDEEQSQR/QQAFIAsgDGpBCGspAABB6YzAACkAAFINBCALIAxBDGsiAmooAAAiAUEBRg0BQQMLIQIgACABNgKoASAAIAI2AqQBIABBoAFqQQRyIQEMAQsgAEGgAWohAyMAQfACayIBJAACQAJAAkAgAkEDSwRAIAsgAkEEayIEaigAACIFQcABRw0BIAJBtAFrIQIgBEGwAUkNAiABQdgBaiACIAtqIgJBGGopAAA3AwAgAUHgAWogAkEgaikAADcDACABQegBaiACQShqKQAANwMAIAFB8AFqIAJBMGopAAA3AwAgAUH4AWogAkE4aikAADcDACABQYACaiACQUBrKQAANwMAIAEgAikAEDcD0AEgAikAACEVIAIpAAghFiABQYgCaiACQcgAakHkAPwKAAAgAigArAEhAiABQRhqIAFB0AFqQZwB/AoAACABIAI2ArQBIAEgFjcDECABIBU3AwggAUG4AWogAUEUakE8EEogAUHEAWogAUHQAGpB5AAQSiADQQE2AgAgA0HAATYCLCADQYCAgIB4NgIgIAMgASkCuAE3AgQgA0EMaiABQcABaikCADcCACADQRRqIAFByAFqKQIANwIADAMLQeiSwQBBE0H0ksEAEJ8BAAsgAyAFNgIIIANChYCAgMAANwMADAELIAIgBCAEQYSTwQAQPgALIAFB8AJqJAAgA0EEciEBIAAoAqABIgJBBUcNAQsgAEHoAGogAUEIaikCACIVNwMAIAAgASkCACIWNwNgIAZBDGogFTcCACAGIBY3AgQgBkEFNgIADAILIABB6ABqIgMgAUEIaikCADcDACAAQfgAaiIEIABBvAFqKQIANwMAIABBgAFqIgUgAEHEAWopAgA3AwAgAEGIAWoiByAAQcwBaigCADYCACAAIAApArQBNwNwIAAgASkCADcDYCACQQRGDQAgBiACNgIAIAYgACkDYDcCBCAGIAApA3A3AhQgBkEMaiADKQMANwIAIAZBHGogBCkDADcCACAGQSRqIAUpAwA3AgAgBkEsaiAHKAIANgIADAELIABBoAFqIQMjAEEwayICJAACQAJAIAxBCE8EQCALIAxBBGsiBWoiBygAACIEQYAKSw0BIAQgBUsEQCADQgU3AwAgAyAEQQRqNgIIDAMLQQAhASACQQA6ACAgAiAHNgIcIAIgCyAFIARrajYCGCACQQxqIAJBGGoQRyACQSRqIAIoAhAiByACKAIUECYgAigCLCENIAIoAighCiACKAIkIQgCQANAIAEgDUYNASABIApqIAFBAWohAS0AACIFQT1GIAVB+wFxQStGciAFQTBrQf8BcUEKSSAFQd8BcUHBAGtB/wFxQRpJcnINAAsgA0KFgICAIDcDACAIQYCAgIB4ckGAgICAeEcEQCAKIAhBARCDAgsgAigCDCIBRQ0DIAcgAUEBEIMCDAMLIANBIGogAkEkahBuIAMgBEEEajYCLCADQQA2AgAgAigCDCIBRQ0CIAcgAUEBEIMCDAILIANBCDYCCCADQgU3AwAMAQsgAyAENgIIIANChYCAgBA3AwALIAJBMGokACAAQZgBaiICIABBrAFqKQIANwMAIAAgACkCpAE3A5ABIAAoAqABIgFBBUYEQCAGIAApA5ABNwIEIAZBBTYCACAGQQxqIAIpAwA3AgAMAQsgAEHoAWoiAiAAQcwBaigCADYCACAAQeABaiIDIABBxAFqKQIANwMAIABB2AFqIgQgAEG8AWopAgA3AwAgACAAKQK0ATcD0AEgAUEERwRAIAYgATYCACAGIAApA5ABNwIEIAYgACkD0AE3AhQgBkEMaiAAQZgBaikDADcCACAGQRxqIAQpAwA3AgAgBkEkaiADKQMANwIAIAZBLGogAigCADYCAAwBCyAGQQQ2AgALIABB8AFqJAAMAQsgASACKAIwEO4BAAsCQAJAAkACQCAGKAIAQQRrDgIBAgALIBIgBkEw/AoAAAwCCyASQQQ2AgAM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AAAMAgsgAyAFOgADIAMgCzoAAiADIAxBP3FBgH9yOgABIAMgAUESdkFwcjoAAAwBCyADIAE6AAALIAAgAiAHaiICNgIMIABBEGoQhQEiAUGAgMQARw0ACwsgCEEPaiEBIAZBBGoiAiAAKQIENwIAIAJBCGogAEEMaigCADYCACAAQSBqJABBASEAQQEhAiAGKAIMQSBGBEAgASAGKAIIIgApAAE3AAIgAUEKaiAAQQlqKQAANwAAIAFBEmogAEERaikAADcAACABQRlqIABBGGopAAA3AABBACECIAAtAAAhAAsgBigCBCIDBEAgBigCCCADQQEQgwILIARBCGohAyABIAI6AAAgASAAOgABIAZBMGokAEEBIQEgCC0AECECAkAgCC0AD0EBRgRAIwBBMGsiACQAIAAgAkEBcToAByAAQQA2AhwgAEKAgICAEDcCFCAAQbi0wAA2AiQgAEKggICABjcCKCAAIABBFGo2AiACfyAAQSBqIQIgAEEHai0AAEEBRgRAIAJBl4DBAEEZEPoBDAELIAJBiIDBAEEPEPoBCwRAQeC0wABBNyAAQQhqQdC0wABBmLXAABCGAQALIABBEGogAEEcaigCACICNgIAIAAgACkCFDcDCCAAKAIMIAIQ9gEhAiAAQQhqEHMgAEEwaiQAIAMgAjYCBAwBCyADIAgpABE3AAIgA0EZaiAIQShqKQAANwAAIANBEmogCEEhaikAADcAACADQQpqIAhBGWopAAA3AAAgAyACOgABQQAhAQsgAyABOgAAIAhBMGokACAKBEAgDSAKQQEQgwILQQEhAAJ/IAQtAAhBAUYEQCAEKAIMDAELIARByABqIARBIWopAAA3AgAgBEFAayAEQRlqKQAANwIAIARBOGogBEERaikAADcCACAEIAQpAAk3AjBBACEAIARBADYCLCAEQSxqEJ4BQQhqCyEBIAkgADYCCCAJIAFBACAAGzYCBCAJQQAgASAAGzYCACAEQdAAaiQAIAkoAgAgCSgCBCAJKAIIIAlBEGokAAu3CQIKfwF+IwBBEGsiBSQAIwBBkAFrIgIkACACIAE2AlggAiAANgJUIAIgATYCUCACQQhqIAJB0ABqEHsgAkEQaiEGIAIoAggiCiEDIAIoAgwhByMAQeAAayIEJAAgBEEIaiEBIwBB0ABrIgAkACAAQgA3AwggACAHNgIEIAAgAzYCACAAQRhqQgA3AwAgAEIANwMQIABBIGogACAAQRBqQRAQWgJAIAAtACBBBEcEQCABIAApAyA3AgggAUEGOgAEIAFBATYCAAwBCyAAQQA2AjggAEEgaiAAIABBOGpBBBBaAkAgAC0AIEEERgRAIAAoAjghAwwBCyAAKQMgIgxCIIinIQMgDEL/AYNCBFENACABIAM2AgwgASAMPAAIIAFBBjoABCABQQE2AgAgAUELaiAMpyIDQRh2OgAAIAEgA0EIdjsACQwBCyAAQQA2AjggAEEgaiAAIABBOGpBBBBaAkAgAC0AIEEERgRAIAAoAjghCAwBCyAAKQMgIgxCIIinIQggDEL/AYNCBFENACABIAg2AgwgASAMPAAIIAFBBjoABCABQQE2AgAgAUELaiAMpyIDQRh2OgAAIAEgA0EIdjsACQwBCyAAQQA2AjggAEEgaiAAIABBOGpBBBBaAkAgAC0AIEEERgRAIAAoAjghCQwBCyAAKQMgIgxCIIinIQkgDEL/AYNCBFENACABIAk2AgwgASAMPAAIIAFBBjoABCABQQE2AgAgAUELaiAMpyIDQRh2OgAAIAEgA0EIdjsACQwBCyAAQTBqQQA2AgAgAEEoakIANwMAIABCADcDICAAQThqIAAgAEEgakEUEFogAC0AOEEERwRAIAEgACkDODcCCCABQQY6AAQgAUEBNgIADAELIABBQGtBADYCACAAQgA3AzggAEHIAGogACAAQThqQQwQWgJAIAAtAEhBBEcEQCABIAApA0g3AgggAUEGOgAEDAELAkAgAEEQaiILQZSzwABBEBCRAQRAIAtBpLPAAEEQEJEBDQELIAEgACkDEDcABCABIAApAyA3ACAgASAAKQM4NwA0IAEgCTYCHCABIAg2AhggASADNgIUIAFBDGogAEEYaikDADcAACABQShqIABBKGopAwA3AAAgAUEwaiAAQTBqKAIANgAAIAFBPGogAEFAaygCADYAACABQQA2AgAMAgsgASAAKQMQNwAFIAFBAToABCABQQ1qIABBGGopAwA3AAALIAFBATYCAAsgAEHQAGokAEEBIQECQCAEKAIIQQFGBEAgBEHYAGogBEEMaiIAQRBqKAIANgIAIARB0ABqIABBCGopAgA3AwAgBCAAKQIANwNIIARByABqEEwhAAwBCyAEKAIM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QTBqJAAMAQsgBiABKAIMNgIMIAYgBDYCCEEAIQgLIAYgCDYCACAGIAM2AgQgAUEQaiQAIAcEQCAJIAdBARCDAgtBASEAAn8gAigCEEEBRgRAIAIoAhQMAQsgAkEsaiACQRRqIgFBCGooAgA2AgBBACEAIAJBADYCICACIAEpAgA3AiRBGEEEEJECIgFFBEBBBEEYEKgCAAsgAUKBgICAEDcCACABIAJBIGoiAykCADcCCCABQRBqIANBCGopAgA3AgAgAUEIagshASAFIAA2AgggBSABQQAgABs2AgQgBUEAIAEgABs2AgAgAkEwaiQAIAUoAgAgBSgCBCAFKAIIIAVBEGokAAu8AgEFfyMAQRBrIgMkACMAQSBrIgIkACACIAE2AhwgAiAANgIYIAIgATYCFCACQQhqIAJBFGoQeyACKAIIIgYhASACKAIMIgUhBCMAQdAAayIAJAAgAEEEaiABIAQQEQJAIAAoAgRBgICAgHhGBEBBASEBIAAoAghBAUYEQEEAIQEgACgCDCEEDAILIABByABqIABBCGoiBEEIaigCADYCACAAIAQpAgA3A0AgAEFAaxBhIQQMAQsgACgCECEEIABBBGoQc0EAIQELIAIgBDYCBCACIAE2AgAgAEHQAGokACACKAIEIQAgAigCACEBIAUEQCAGIAVBARCDAgsgAyABNgIIIAMgAEEAIAFBAXEiARs2AgQgA0EAIAAgARs2AgAgAkEgaiQAIAMoAgAgAygCBCADKAIIIANBEGokAAuCAwEHfyMAQRBrIgMkACMAQZABayICJAAgAiABNgJYIAIgADYCVCACIAE2AlAgAkEIaiACQdAAahB7IAJBFGohASACKAIIIQUgAigCDCEEIwBB0ABrIgAkACAAQRBqIgYgBSAEEBEgAEEIaiIHIABBHGooAgA2AgAgACAAKQIUNwMAAkAgACgCECIIQYCAgIB4RgRAIABBGGogBygCADYCACAAIAApAwA3AxAgASAGEGE2AgQMAQsgAUEQaiAAQSBqQSz8CgAAIAFBDGogAEEIaigCADYCACABIAApAwA3AgQLIAEgCDYCACAAQdAAaiQAIAQEQCAFIARBARCDAgsCfyACKAIUQYCAgIB4RgRAQQEhACACKAIYDAELQQAhACACQQA2AlAgAkHUAGogAkEUakE8/AoAACACQdAAahCdAUEIagshASADIAA2AgggAyABQQAgABs2AgQgA0EAIAEgABs2AgAgAkGQAWokACADKAIAIAMoAgQgAygCCCADQRBqJAAL1AYCCn8BfiMAQRBrIgokABA5IgUgAiYBIAEhAyMAQTBrIgEkACABIAM2AiwgASAANgIoIAEgAzYCJCABQRBqIAFBJGoQeyABIAU2AiAgASABKAIUIgM2AhwgASABKAIQIgA2AhggAUEIaiELIwBBIGsiCCQAIAhBBGohCSMAQRBrIgUkAAJAAkACQCAAIANBo6zAAEEQEOgBRQRAQQAgAyADQf8HcRtFBEAgCSADNgIEIAlBh4CAgHg2AgAMBAsgA0H/B00NASAFQQRqIQYjAEEgayIEJAACQAJAAkAgACgAECIHQQh0IgxBgP4DcSAHQRB0QYCAgHhxciIHIAxB//8DanENACAAKAAUQYCAgYECRw0AIAdBgARrQYH8A0kNAQsgBkGJgICAeDYCAAwBCyAAKQAQIQ0gACAAKQAINwAQIAQgDTcDCCAEQRRqIABBEGoiB0HwB0EBEBkgBCgCFEGNgICAeEcEQCAGIAQpAhQ3AgAgBkEIaiAEQRxqKAIANgIADAELIAcpAAAgBCkDCFEEQCAGQY2AgIB4NgIAIABBCGpBq6zAACkAADcAACAAQaOswAApAAA3AAAMAQsgBkGIgICAeDYCAAsgBEEgaiQAIAUoAgRBjYCAgHhHBEAgCSAFKQIENwIAIAlBCGogBUEMaigCADYCAAwECyADQYAQSQ0CIANBCnYhB0ECIQZBgAghBANAIAMgBEH/B2pNBEAgBCAEQYAIaiADQZzNwAAQPgALIAVBBGogACAEakGACCAGEBkgBSgCBEGNgICAeEcEQCAJIAUpAgQ3AgAgCUEIaiAFQQxqKAIANgIADAULIAYgB08NAyAEQYAIaiEEIAYgBiAHSWoiBiAHTQ0ACwwCCyAJQY2AgIB4NgIADAILQQBBgAggA0GMzcAAED4ACyAJQY2AgIB4NgIACyAFQRBqJAAgCCgCBEGNgICAeEYEf0EABSAIQRhqIAhBDGooAgA2AgAgCCAIKQIENwMQIAhBEGoQTyEAQQELIQMgCyAANgIEIAsgAzYCACAIQSBqJAAgASgCDCEDIAEoAgghACABQRhqEKcBIAogADYCBCAKIANBACAAQQFxGzYCACABQTBqJAAgCigCACAKKAIEIApBEGokAAuXAQEDfyMAQRBrIgEkACMAQRBrIgIkACACQQRqIAAQgAECfyACKAIEIgAoAgBBgICAgHhHBEAgACgCsAIhA0EADAELQfHMwABBGBD2ASEDQQELIQAgAkEEahCvASABIAA2AgggASADQQAgABs2AgQgAUEAIAMgABs2AgAgAkEQaiQAIAEoAgAgASgCBCABKAIIIAFBEGokAAvZAQEDfyMAQRBrIgQkABA5IgUgAiYBIAEhAyMAQTBrIgEkACABIAM2AiwgASAANgIoIAEgAzYCJCABQRBqIAFBJGoQeyABIAU2AiAgASABKAIUIgU2AhwgASABKAIQIgA2AhggAUEIaiEDAn8gBUGACEcEQBBdIQBBAQwBC0EAIAAQMEEACyEFIAMgADYCBCADIAU2AgAgASgCDCEDIAEoAgghACABQRhqEKcBIAQgADYCBCAEIANBACAAQQFxGzYCACABQTBqJAAgBCgCACAEKAIEIARBEGokAAvZAQEDfyMAQRBrIgQkABA5IgUgAiYBIAEhAyMAQTBrIgEkACABIAM2AiwgASAANgIoIAEgAzYCJCABQRBqIAFBJGoQeyABIAU2AiAgASABKAIUIgU2AhwgASABKAIQIgA2AhggAUEIaiEDAn8gBUGACEcEQBBdIQBBAQwBC0EBIAAQMEEACyEFIAMgADYCBCADIAU2AgAgASgCDCEDIAEoAgghACABQRhqEKcBIAQgADYCBCAEIANBACAAQQFxGzYCACABQTBqJAAgBCgCACAEKAIEIARBEGokAAsiAAJAIAAEQCAAKAIAQX9GDQEgACgCEA8LEKUCAAsQpgIAC5UBAQR/IwBBEGsiACQAIwBBwAJrIgEkACABQoCAgICAgICAgH83AgQCfyABQQRqIQNBxAJBBBCRAiICBEAgAkKBgICAEDcCACACQQhqIANBvAL8CgAAIAIMAQtBBEHEAhCoAgALIQIgAEIANwIEIAAgAkEIajYCACABQcACaiQAIAAoAgAgACgCBCAAKAIIIABBEGokAAshAAJAIAAEQCAAKAIADQEgACABNgIQDwsQpQIACxCmAgALxAEBBH8jAEEQayICJAAjAEEwayIBJAAgAUEgaiIDIAAQfyACAn8gASgCICIAKAIAQQFHBEAgAxCrAUEAIQBBAAwB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ACAAQRQ2AgwgACACNgIIIABBFDYCBCAAIACtQoCAgICgCYQ3AxggACAAQQRqrUKAgICAsAmENwMQIAEoAgAgASgCBEHjscAAIABBEGoQKCEBIAAoAgQiAkUNAyAAKAIIIAJBARCDAgwDCyAAIAItAAFBAnQiAigCnKhBNgIIIAAgAigCxKlBNgIEIAAgAEEEaq1CgICAgMAJhDcDECABKAIAIAEoAgRB54zAACAAQRBqECghAQwCCyACKAIEIgIoAgAgAigCBCABEKoCIQEMAQsgAigCBCICKAIAIAEgAigCBCgCEBEAACEBCyAAQSBqJAAgAQwBC0EBQRQQ7gEACwsLACAAKAIAIAEQXwsLACAAKAIAIAEQdQvvBAIDfwF+IAAoAgAhAiMAQRBrIgAkACABKAIEIQMgASgCACEBIAAgAjYCBCAAIABBBGqtQoCAgIDQBIQiBTcDCEEBIQQCQCABIANBxYHBACAAQQhqECgNACAAIAJBAWo2AgQgACAFNwMIIAEgA0HFgcEAIABBCGoQKA0AIAAgAkECajYCBCAAIAU3AwggASADQcWBwQAgAEEIahAoDQAgACACQQNqNgIEIAAgBTcDCCABIANBxYHBACAAQQhqECgNACAAIAJBBGo2AgQgACAFNwMIIAEgA0HFgcEAIABBCGoQKA0AIAAgAkEFajYCBCAAIAU3AwggASADQcWBwQAgAEEIahAoDQAgACACQQZqNgIEIAAgBTcDCCABIANBxYHBACAAQQhqECgNACAAIAJBB2o2AgQgACAFNwMIIAEgA0HFgcEAIABBCGoQKA0AIAAgAkEIajYCBCAAIAU3AwggASADQcWBwQAgAEEIahAoDQAgACACQQlqNgIEIAAgBTcDCCABIANBxYHBACAAQQhqECgNACAAIAJBCmo2AgQgACAFNwMIIAEgA0HFgcEAIABBCGoQKA0AIAAgAkELajYCBCAAIAU3AwggASADQcWBwQAgAEEIahAoDQAgACACQQxqNgIEIAAgBTcDCCABIANBxYHBACAAQQhqECgNACAAIAJBDWo2AgQgACAFNwMIIAEgA0HFgcEAIABBCGoQKA0AIAAgAkEOajYCBCAAIAU3AwggASADQcWBwQAgAEEIahAoDQAgACACQQ9qNgIEIAAgBTcDCCABIANBxYHBACAAQQhqECghBAsgAEEQ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bWFnaWMgYnl0ZXM6IMAAGEFFUyBCdWZmZXIgc2V0dXAgZXJyb3I6IMAAIVBhcnNlIEtHTSBoZWFkZXIgd2l0aCBpL28gZXJyb3I6IMAAD1FNQzJFS2V5RXJyb3I6IMAAHEFFUyBEZWNyeXB0aW9uIFVucGFkIEVycm9yOiDAABBGaWxlIEkvTyBFcnJvcjogwAAoTWV0YWRhdGE6IEludmFsaWQgcHJlZml4IG9uIGZpbmFsIGpzb246IMAAHFVuc3VwcG9ydGVkIGNpcGhlciB2ZXJzaW9uOiDAACFVbnN1cHBvcnRlZCBjb3ZlciBpbWFnZSB2ZXJzaW9uOiDAAB9BbmRyb2lkL1NUYWc6IEludmFsaWQgVmVyc2lvbjogwAAfQW5kcm9pZC9RVGFnOiBJbnZhbGlkIFZlcnNpb246IMAAFkludmFsaWQgaW5wdXQgbGVuZ3RoOiDAAClNZXRhZGF0YTogSW52YWxpZCBwcmVmaXggd2hpbGUgZGVjb2Rpbmc6IMAAGUludmFsaWQgYXVkaW8gaGFzaCBzaXplOiDAABdJbnZhbGlkIGRhdGFiYXNlIHNpemU6IMAAJlBDdjIvTXVzaWNFeDogSW52YWxpZCBgTXVzaWNFeGAgc2l6ZTogwAAYUVJDOiBGYWlsZWQgdG8gaW5mbGF0ZTogwAAqaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZTogwAAiQW5kcm9pZC9RVGFnOiBJbnZhbGlkIEVLZXkgZmllbGQ6IMAAIEFuZHJvaWQvU1RhZzogSW52YWxpZCBJRCBmaWVsZDogwAAgQW5kcm9pZC9RVGFnOiBJbnZhbGlkIElEIGZpZWxkOiDAACJNZXRhZGF0YTogRGVjb2RlIG1ldGFkYXRhIGZhaWxlZDogwAAkQW5kcm9pZC9TVGFnOiBJbnZhbGlkIENTViBtZXRhZGF0YTogwAAVRmFpbGVkIHRvIHJlYWQgZGF0YTogwAAeRmFpbGVkIGRlY3J5cHQga3Vnb3UgZGIgZGF0YTogwAAZRmFpbGVkIHRvIGRlY29kZSBiYXNlNjQ6IMAAH0Vycm9yIHdoZW4gZGVjcnlwdGluZyBla2V5IHYyOiDAAB9FcnJvciB3aGVuIGRlY3J5cHRpbmcgZWtleSB2MTogwAAbRmFpbGVkIHRvIHBhcnNlIE11c2ljRXhWMTogwADAAjogwABtdXNpY2V4AC9oX19fX19fX19fX19fX18vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9sYXp5X3N0YXRpYy0xLjUuMC9zcmMvaW5saW5lX2xhenkucnMAdW1fY3J5cHRvL3FtYy9zcmMvZWtleS5ycwAvaF9fX19fX19fX19fX19fLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvYmFzZTY0LTAuMjIuMS9zcmMvZW5naW5lL2dlbmVyYWxfcHVycG9zZS9kZWNvZGVfc3VmZml4LnJzAC9ydXN0Yy80YTRlZjQ5M2UzYTE0ODhjNmUzMjE1NzAyMzgwODRiMzg5NDhmNmRiL2xpYnJhcnkvY29yZS9zcmMvc2xpY2Uvc29ydC9zaGFyZWQvc21hbGxzb3J0LnJzAC9ydXN0Yy80YTRlZjQ5M2UzYTE0ODhjNmUzMjE1NzAyMzgwODRiMzg5NDhmNmRiL2xpYnJhcnkvYWxsb2Mvc3JjL2ZtdC5ycwB1bV9jcnlwdG8vcXRmbS9zcmMvc2VjcmV0LnJzAC9oX19fX19fX19fX19fX18vLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvc3RkL3NyYy9pby9pbXBscy5ycwB1bV9jcnlwdG8vcXJjL3NyYy9kZXMvdXRpbHMucnMAdW1fY3J5cHRvL3FtYy9zcmMvZm9vdGVyL3V0aWxzLnJzAC9oX19fX19fX19fX19fX18vLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvc3RkL3NyYy9zeXMvdGhyZWFkX2xvY2FsL25vX3RocmVhZHMucnMAL2hfX19fX19fX19fX19fXy8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9pdGVyLnJzAHVtX2NyeXB0by9xbWMvc3JjL3YyX3JjNC9jaXBoZXIucnMAL2hfX19fX19fX19fX19fXy8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL21pbml6X294aWRlLTAuOC4wL3NyYy9pbmZsYXRlL291dHB1dF9idWZmZXIucnMAL2hfX19fX19fX19fX19fXy8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9zdGQvc3JjL2lvL2J1ZmZlcmVkL2J1ZnJlYWRlci5ycwB1bV9jcnlwdG8vam9veC9zcmMvaGVhZGVyLnJzAHVtX2NyeXB0by9uY20vc3JjL2hlYWRlci5ycwAvaF9fX19fX19fX19fX19fLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LWFwcGxlLWRhcndpbi9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL3N0ci9wYXR0ZXJuLnJzAC9ydXN0Yy80YTRlZjQ5M2UzYTE0ODhjNmUzMjE1NzAyMzgwODRiMzg5NDhmNmRiL2xpYnJhcnkvY29yZS9zcmMvZm10L251bS5ycwAvaF9fX19fX19fX19fX19fLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LWFwcGxlLWRhcndpbi9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5ycwB1bV9jcnlwdG8va3V3by9zcmMvZGVzL2NvcmUucnMAL2hfX19fX19fX19fX19fXy8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL21pbml6X294aWRlLTAuOC4wL3NyYy9pbmZsYXRlL2NvcmUucnMAL3J1c3RjLzRhNGVmNDkzZTNhMTQ4OGM2ZTMyMTU3MDIzODA4NGIzODk0OGY2ZGIvbGlicmFyeS9jb3JlL3NyYy91bmljb2RlL3ByaW50YWJsZS5ycwAvaF9fX19fX19fX19fX19fLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvYmFzZTY0LTAuMjIuMS9zcmMvZW5naW5lL2dlbmVyYWxfcHVycG9zZS9kZWNvZGUucnMAL2hfX19fX19fX19fX19fXy8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9zdGQvc3JjL3N5bmMvb25jZS5ycwAvcnVzdC9kZXBzL2hhc2hicm93bi0wLjE2LjEvc3JjL3Jhdy9tb2QucnMAdW1fY3J5cHRvL2tnbS9zcmMvcGNfZGJfZGVjcnlwdC9tb2QucnMAdW1fY3J5cHRvL2t1d28vc3JjL2Rlcy9tb2QucnMAL2hfX19fX19fX19fX19fXy8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC1hcHBsZS1kYXJ3aW4vbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9zdGQvc3JjL2lvL21vZC5ycwAvaF9fX19fX19fX19fX19fLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvYmFzZTY0LTAuMjIuMS9zcmMvZW5naW5lL21vZC5ycwAvcnVzdGMvNGE0ZWY0OTNlM2ExNDg4YzZlMzIxNTcwMjM4MDg0YjM4OTQ4ZjZkYi9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjL21vZC5ycwAvaF9fX19fX19fX19fX19fLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LWFwcGxlLWRhcndpbi9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvbW9kLnJzAHVtX2NyeXB0by94bWx5L3NyYy9hbmRyb2lkLnJzAC9oX19fX19fX19fX19fX18vLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtYXBwbGUtZGFyd2luL2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvYWxsb2Mvc3JjL3ZlYy9zcGVjX2Zyb21faXRlcl9uZXN0ZWQucnMAdW1fY3J5cHRvL3htbHkvc3JjL3BjLnJzAC9ydXN0L2RlcHMvZGxtYWxsb2MtMC4yLjExL3NyYy9kbG1hbGxvYy5ycwAvaF9fX19fX19fX19fX19fLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvdGNfdGVhLTAuMi4xL3NyYy9jYmMucnMAdW1fYXVkaW8vc3JjL2xpYi5ycwAvaF9fX19fX19fX19fX19fLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvY29uc29sZV9lcnJvcl9wYW5pY19ob29rLTAuMS43L3NyYy9saWIucnMAL2hfX19fX19fX19fX19fXy8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3NoYTEtMC4xMC42L3NyYy9saWIucnMAL2hfX19fX19fX19fX19fXy8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL2Jsb2NrLWJ1ZmZlci0wLjEwLjQvc3JjL2xpYi5ycwAvaF9fX19fX19fX19fX19fLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvaGV4LTAuNC4zL3NyYy9saWIucnMAL2hfX19fX19fX19fX19fXy8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL2htYWMtMC4xMi4xL3NyYy9saWIucnMAL2hfX19fX19fX19fX19fXy8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL2J5dGVvcmRlci0xLjUuMC9zcmMvbGliLnJzAHVtX2F1ZGlvL3NyYy9tZXRhZGF0YS5ycwB1bV9jcnlwdG8vbWczZC9zcmMvZ3Vlc3NfbTRhLnJzAHVtX2NyeXB0by9xbWMvc3JjL3YyX3JjNC9yYzQucnMAdW1fY3J5cHRvL3V0aWxzL3NyYy9iYXNlNjQucnMAdW1fYXVkaW8vc3JjL21wMy5ycwAvaF9fX19fX19fX19fX19fLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvYWVzLTAuOC40L3NyYy9zb2Z0L2ZpeHNsaWNlMzIucnMAdW1fY3J5cHRvL3FtYy9zcmMvZm9vdGVyL211c2ljZXhfdjEucnMAFUhlYWRlciBuZWVkIGF0IGxlYXN0IMALIG1vcmUgYnl0ZXMAK0Zvb3RlcjogQnVmZmVyIHRvbyBzbWFsbCwgcmVxdWlyZSBhdCBsZWFzdCDABiBieXRlcwAjaGVhZGVyIHRvbyBzbWFsbCwgcmVxdWlyZSBhdCBsZWFzdCDABiBieXRlcwAqS2V5IHNpemUgbWlzbWF0Y2guIFJlcXVpcmVkIDE2IGJ5dGVzLCBnb3QgwAYgYnl0ZXMAH1BhcnNlOiBGYWlsZWQgdG8gcGFyc2Ugc3RyaW5nICfADCcgYXMgaW50ZWdlcgBTUUxpdGUgZm9ybWF0IDMAH091dHB1dCBidWZmZXIgcmVxdWlyZSBhdCBsZWFzdCDAByBieXRlcy4AHklucHV0IGJ1ZmZlciByZXF1aXJlIGF0IGxlYXN0IMAHIGJ5dGVzLgAjSGVhZGVyIHRvbyBzbWFsbCwgcmVxdWlyZSBhdCBsZWFzdCDAByBieXRlcy4AIEhlYWRlciB0b28gc21hbGwsIG5lZWQgYXQgbGVhc3QgwAcgYnl0ZXMuABpDaXBoZXIgdGV4dCBzaXplIGludmFsaWQuIMAMIG1vZCA4ICE9IDAuADVFbmNyeXB0IGJ1ZmZlciBzaXplIHRvbyBzbWFsbCwgaXQgc2hvdWxkIGJlIGF0IGxlYXN0IMAPIGJ5dGVzIChhY3R1YWw9wAggYnl0ZXMpLgA1RGVjcnlwdCBidWZmZXIgc2l6ZSB0b28gc21hbGwsIGl0IHNob3VsZCBiZSBhdCBsZWFzdCDADyBieXRlcyAoYWN0dWFsPcAIIGJ5dGVzKS4AFEludmFsaWQgbGFzdCBzeW1ib2wgwAksIG9mZnNldCDAAS4AD0ludmFsaWQgc3lt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lfMTIyNDI1Rjg/P4ChAAHAAAACIAAAAMAAAA+AoQABwAAAAtAAAADwAAAGF0dGVtcHRlZCB0byB0YWtlIG93bmVyc2hpcCBvZiBSdXN0IHZhbHVlIHdoaWxlIGl0IHdhcyBib3Jyb3dlZAALAAAADAAAAAQAAAAMAAAADQAAAAQAQfjFwAALmQYBAAAADgAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkA8QsQAG8AAABmCwAADgAAAEVycm9yVVZGTmRYTnBZeUJGYm1OV01peExaWGs2AQAAQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODktX////////////////////////////////////////////////////////////z7//zQ1Njc4OTo7PD3/////////AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBn/////P/8aGxwdHh8gISIjJCUmJygpKissLS4vMDEyM/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8BAABBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsv/////////////////////////////////////////////////////////z7///8/NDU2Nzg5Ojs8Pf////////8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGf///////xobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIz/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wDWERAAbwAA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AIB0AACA9AAAgAwAAICMAACATAAAgMwAAIAsAACArAAAgGwAAIDsAACAHAAAgJwAAIBcAACA3AAAgDwAAIC8AACAfAAAgPwAAIACAACAggAAgEIAAIDCAACAIgAAgKIAAIBiAACA4gAAgBIAAICSAACAUgAAgNIAAIAyAACAsgAAgHIAAIDyAACACgAAgIoAAIBKAACAygAAgCoAAICqAACAagAAgOoAAIAaAACAmgAAgFoAAIDaAACAOgAAgLoAAIB6AACA+gAAgAYAAICGAACARgAAgMYAAIAmAACApgAAgGYAAIDmAACAFgAAgJYAAIBWAACA1gAAgDYAAIC2AACAdgAAgPYAAIAOAACAjgAAgE4AAIDOAACALgAAgK4AAIBuAACA7gAAgB4AAICeAACAXgAAgN4AAIA+AACAvgAAgH4AAID+AACAAQAAgIEAAIBBAACAwQAAgCEAAIChAACAYQAAgOEAAIARAACAkQAAgFEAAIDRAACAMQAAgLEAAIBxAACA8QAAgAkAAICJAACASQAAgMkAAIApAACAqQAAgGkAAIDpAACAGQAAgJkAAIBZAACA2QAAgDkAAIC5AACAeQAAgPkAAIAFAACAhQAAgEUAAIDFAACAJQAAgKUAAIBlAACA5QAAgBUAAICVAACAVQAAgNUAAIA1AACAtQAAgHUAAID1AACADQAAgI0AAIBNAACAzQAAgC0AAICtAACAbQAAgO0AAIAdAACAnQAAgF0AAIDdAACAPQAAgL0AAIB9AACA/QAAgAMAAICDAACAQwAAgMMAAIAjAACAowAAgGMAAIDjAACAEwAAgJMAAIBTAACA0wAAgDMAAICzAACAcwAAgPMAAIALAACAiwAAgEsAAIDLAACAKwAAgKsAAIBrAACA6wAAgBsAAICbAACAWwAAgNsAAIA7AACAuwAAgHsAAID7AACABwAAgIcAAIBHAACAxwAAgCcAAICnAACAZwAAgOcAAIAXAACAlwAAgFcAAIDXAACANwAAgLcAAIB3AACA9wAAgA8AAICPAACATwAAgM8AAIAvAACArwAAgG8AAIDvAACAHwAAgJ8AAIBfAACA3wAAgD8AAIC/AACAfwAAgP/NDBAAawAAAA4CAAAdAAAAzQwQAGsAAABqAwAAFAAAAM0MEABrAAAAbQMAABIAAADNDBAAawAAAHoDAAAiAAAAzQwQAGsAAAB6AwAADQAAAM0MEABrAAAAewMAACYAAADNDBAAawAAAHsDAAANAAAAzQwQAGsAAAB8AwAAJgAAAM0MEABrAAAAfAMAAA0AAADNDBAAawAAAH0DAAAmAAAAzQwQAGsAAAB9AwAADQAAAM0MEABrAAAAhQMAACMAAADNDBAAawAAAIUDAAAOAAAAzQwQAGsAAACHAwAAIgAAAM0MEABrAAAAhwMAAA0AAADNDBAAawAAAIgDAAAmAAAAzQwQAGsAAACIAwAADQAAAM0MEABrAAAAiwMAACIAAADNDBAAawAAAIsDAAANAAAAzQwQAGsAAACMAwAAJgAAAM0MEABrAAAAjAMAAA0AAADNDBAAawAAAI0DAAAmAAAAzQwQAGsAAACNAwAADQAAAM0MEABrAAAAdAMAABcAAABkZXN0IGlzIG91dCBvZiBib3VuZHNUcnVuY2F0ZWQgaW5wdXQgc3RyZWFtSW52YWxpZCBvdXRwdXQgYnVmZmVyIHNpemVBZGxlcjMyIGNoZWNrc3VtIG1pc21hdGNoSW52YWxpZCBpbnB1dCBkYXRhT3V0cHV0IHNpemUgZXhjZWVkZWQgdGhlIHNwZWNpZmllZCBsaW1pdAoKU3RhY2s6CgoAABUAAAAMAAAABAAAABYAAAAXAAAAGABBmPPAAAvDDQEAAAAZAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQDxCxAAbwAAAGYLAAAOAAAARXJyb3JWZWMgaXMgc2l6ZWQgY29uc2VydmF0aXZlbHntORAAGwAAAFcPEABlAAAAAQEAABkAAABFeHBlY3RlZCBJRDMgbWV0YWRhdGFGYWlsZWQgdG8gZXh0cmFjdCBlbmNyeXB0ZWQgYXVkaW8gc2VnbWVudCBzaXplRmFpbGVkIHRvIGV4dHJhY3QgU3RhZ2UgMSBJViBkYXRhRmFpbGVkIHRvIGV4dHJhY3QgU3RhZ2UgMiBkZWNyeXB0aW9uIGtleUZhaWxlZCB0byBleHRyYWN0IGF1ZGlvIGhlYWRlckRlY3J5cHRpb24gc3RhZ2UgMSBmYWlsZWQgKHBhZGRpbmcpRGVjcnlwdGlvbiBzdGFnZSAxIGZhaWxlZCAoYjY0IGRlY29kZSlEZWNyeXB0aW9uIHN0YWdlIDIgZmFpbGVkIChpbml0KURlY3J5cHRpb24gc3RhZ2UgMiBmYWlsZWQgKHBhZGRpbmcpRGVjcnlwdGlvbiBzdGFnZSAyIGZhaWxlZCAoYjY0IGRlY29kZSlxBhAAagAAAB4AAAAQAAAAMTIzNDU2NzgxMjM0NTY3ODEyMzQ1Njc4IBEQABgAAABsAAAAGAAAACAREAAYAAAAUQAAAB8AAAB4aW1hbGF5YXhpbWFsYXlheGltYWxheWF4aW1hbGF5YSAREAAYAAAAhwAAAC0AAAAgERAAGAAAAJMAAAAtAAAAY291bGQgbm90IGZpbmQgaXRlbQB/EBAAHQAAABcAAAAOAAAAeG1seXhtbHl4bWx5eG1seXhtbHl4bWx5eG1seXhtbHkzOTg5ZDExMWFhZDU2MTM5NDBmNGZjNDRiNjM5YjI5Mn8QEAAdAAAAMgAAABAAAABwCRAAcgAAAPEFAAAiAAAAehQQAB0AAAAnAAAACQAAAAEAAEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky//////////////////////////////////////////////////////////Pv///z80NTY3ODk6Ozw9/////////wABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZ////////GhscHR4fICEiIyQlJicoKSorLC0uLzAxMjP/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////T25jZSBpbnN0YW5jZSBoYXMgcHJldmlvdXNseSBiZWVuIHBvaXNvbmVkb25lLXRpbWUgaW5pdGlhbGl6YXRpb24gbWF5IG5vdCBiZSBwZXJmb3JtZWQgcmVjdXJzaXZlbHkAAAAIDhAAcAAAAJ8AAAAyAAAACBMQAFoAAADHAAAAJQAAAAgTEABaAAAAxwAAAEEAAABub3QgYSB4aWFtaSBmaWxlRmFpbGVkIHRvIGRlY29kZSBmaWxlIG5hbWUu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AAAAzQEAADcAAABRTUMgVjIvTWFwIENpcGhlcjogS2V5IGlzIGVtcHR5ADELEABzAAAAzQEAADcAAABtaWQgPiBsZW4AAAATFRAAJgAAAD0AAAApAAAAExUQACYAAABFAAAAGwAAAFoUEAAfAAAAEQAAAA8AAABaFBAAHwAAACIAAAApAAAAAQAAQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrL/////////////////////////////////////////////////////////8+////PzQ1Njc4OTo7PD3/////////AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBn///////8aGxwdHh8gISIjJCUmJygpKissLS4vMDEyM/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9taWQgPiBsZW5WZWMgaXMgc2l6ZWQgY29uc2VydmF0aXZlbHkAAEsQABsAAABXDxAAZQAAAAEBAAAZAAAARUtleSBpcyB0b28gc2hvcnQgZm9yIGRlY3J5cHRpb25xBhAAagAAAB4AAAAQAAAA3AYQABkAAAA0AAAAIQAAADM4NlpKWSFAIyokJV4mKSgqKiMhKCMkJSZeYTFjWixUY2FwYWNpdHkgb3ZlcmZsb3cAAACdEBAAggAAADkAAAASAAAADhAQAHAAAABvDwAADQAAAMsIEAAhAAAADQAAAB0AAADLCBAAIQAAAA0AAABFAAAASW52YWxpZCBkYXRhIHBhZGRpbmdTbGljZSBlcnJvci5kERAAXQAAAI8AAAAOAAAASW52YWxpZCBwYWRkaW5nAPYGEAB/AAAAVAAAAAkAAAD2BhAAfwAAAB8AAAAmAAAAjw0QAHgAAABlAAAAOAAAAI8NEAB4AAAAYQAAAA0AAACPDRAAeAAAAF4AAAAuAAAAjw0QAHgAAAA9AAAAJwAAAI8NEAB4AAAAOAAAACYAAACPDRAAeAAAAI0AAAAZAAAAAAAAAAQAAAAEAAAASAAAABtOb3QgSm9veCBlbmNyeXB0ZWQgaGVhZGVyOiDDIAAAagIAABpVbnN1cHBvcnRlZCBKb294IHZlcnNpb246IMMgAABoAgAAAKwUEABmAAAAFAUAACIAAACsFBAAZgAAABQFAAAJAAAArBQQAGYAAACJBAAAEgAAAKwUEABmAAAAiQQAAD0AAACsFBAAZgAAAB4BAAAtAAAArBQQAGYAAADyAQAALQAAAExlbmd0aCBvZiBpbnB1dCBzbGljZXMgaXMgbm90IGVxdWFsIHRvIGVhY2ggb3RoZXJVbnBhZCBFcnJvcm9nZ2FhY21wM200YW00Ym1wNHdtYW1rYWZsYWNkZmZ3YXZhcGViaW7CERAAEwAAABkAAAAiAAAAwhEQABMAAAAsAAAADwAAAMIREAATAAAALgAAACYAAADCERAAEwAAABcAAAAZAAAAmBQQABMAAAAPAAAARQAAAJgUEAATAAAASAAAABcAAACYFBAAEwAAAEoAAAAWAAAAmBQQABMAAABLAAAAEwAAAFRBR0lEMwAAIRQQABgAAAAxAAAAOQAAACEUEAAYAAAAIQAAABkAAAAoAAAAMAAAAEAAAAAwAAAAOAAAAGAAAAA4AAAAQAAAAIAAAABAAAAAUAAAAKAAAABQAAAAYAAAAMAAAABgAAAAcAAAAOAAAABwAAAAgAAAAAABAACAAAAAoAAAACABAACgAAAAwAAAAEABAADAAAAA4AAAAGABAADgAAAAAAEAAIABAAAAAQAAQAEAAKABAABudWxsIHBvaW50ZXIgcGFzc2VkIHRvIHJ1c3RyZWN1cnNpdmUgdXNlIG9mIGFuIG9iamVjdCBkZXRlY3RlZCB3aGljaCB3b3VsZCBsZWFkIHRvIHVuc2FmZSBhbGlhc2luZyBpbiBydXN0QXR0ZW1wdGVkIHRvIGluaXRpYWxpemUgdGhyZWFkLWxvY2FsIHdoaWxlIGl0IGlzIGJlaW5nIGRyb3BwZWTtCBAAggAAAGsAAAANAAAAbV3L1ixQ62N4QaZXcRuLuSPKO0qmd3yTQmNJr5dvsoRlbnRpdHkgbm90IGZvdW5kcGVybWlzc2lvbiBkZW5pZWRjb25uZWN0aW9uIHJlZnVzZWRjb25uZWN0aW9uIHJlc2V0aG9zdCB1bnJlYWNoYWJsZW5ldHdvcmsgdW5yZWFjaGFibGVjb25uZWN0aW9uIGFib3J0ZWRub3QgY29ubmVjdGVkYWRkcmVzcyBpbiB1c2VhZGRyZXNzIG5vdCBhdmFpbGFibGVuZXR3b3JrIGRvd25icm9rZW4gcGlwZWVudGl0eSBhbHJlYWR5IGV4aXN0c29wZXJhdGlvbiB3b3VsZCBibG9ja25vdCBhIGRpcmVjdG9yeWlzIGEgZGlyZWN0b3J5ZGlyZWN0b3J5IG5vdCBlbXB0eXJlYWQtb25seSBmaWxlc3lzdGVtIG9yIHN0b3JhZ2UgbWVkaXVtZmlsZXN5c3RlbSBsb29wIG9yIGluZGlyZWN0aW9uIGxpbWl0IChlLmcuIHN5bWxpbmsgbG9vcClzdGFsZSBuZXR3b3JrIGZpbGUgaGFuZGxlaW52YWxpZCBpbnB1dCBwYXJhbWV0ZXJpbnZhbGlkIGRhdGF0aW1lZCBvdXR3cml0ZSB6ZXJvbm8gc3RvcmFnZSBzcGFjZXNlZWsgb24gdW5zZWVrYWJsZSBmaWxlcXVvdGEgZXhjZWVkZWRmaWxlIHRvbyBsYXJnZXJlc291cmNlIGJ1c3lleGVjdXRhYmxlIGZpbGUgYnVzeWRlYWRsb2NrY3Jvc3MtZGV2aWNlIGxpbmsgb3IgcmVuYW1ldG9vIG1hbnkgbGlua3NpbnZhbGlkIGZpbGVuYW1lYXJndW1lbnQgbGlzdCB0b28gbG9uZ29wZXJhdGlvbiBpbnRlcnJ1cHRlZHVuc3VwcG9ydGVkdW5leHBlY3RlZCBlbmQgb2YgZmlsZW91dCBvZiBtZW1vcnlpbiBwcm9ncmVzc290aGVyIGVycm9ydW5jYXRlZ29yaXplZCBlcnJvcm9wZXJhdGlvbiBzdWNjZXNzZnVsAAAATgAAAAwAAAAEAAAATwAAAFAAAABRAAAAAAAAAAgAAAAEAAAAUgAAAFMAAABUAAAAVQAAAFYAAAAQAAAABAAAAFcAAABYAAAAWQAAAFoAAABjYW5ub3QgbW9kaWZ5IHRoZSBwYW5pYyBob29rIGZyb20gYSBwYW5pY2tpbmcgdGhyZWFkYQwQAEwAAACQAAAACQAAAHBhbmlja2VkIGF0IDoKAAAAAAAACAAAAAQAAABbAAAAYXNzZXJ0aW9uIGZhaWxlZDogcHNpemUgPj0gc2l6ZSArIG1pbl9vdmVyaGVh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DgoGRgodA0dJNwMOCAoGOQcKBiwECoD2GQc7Ax1VAQ8yDYObZnULgMSKTGMNhDAQFgqPmwWCR5q5OobGgjkHKgRcBiYKRgooBROBsDqAxlsFNCxLBDkHEUAFCwcJnNYpIGFzof2BMw8BHQYOBAiBjIkEawUNAwkHEI9ggP0DgbQGFw8RD0cJdDyA9gpzCHAVRnoUDBQMVwkZgIeBRwOFQg8VhFAfBgaA1SsFPiEBcC0DGgQCgUAfEToFAYHQKoDWKwQBgMA2CAKA4ID3KUwECgQCgxFETD2AwjwGAQRVBRs0AoEOLARkDFYKgK44HQ0sBAkHAg4GgJqD2QMRAw0DgNoGDAQBDwwEOAgKBigILAQCDgkngVgIHQMLAzsEHgQKB4D7hAUAAQMFBQYGAgcGCAcJEQocCxkMGQ0QDgwPBBADEhITCRYBFwQYARkDGgkbARwCHxYgAysCLQsuATAEMQIyAakCqgSrCPoC+wX+A/8JrXh5i42iMFdYi4yQHN0OD0tM+/wuLz9cXV/ihI2OkZKpsbq7xcbJyt7k5f8ABBESKTE0Nzo7PUlKXYSOkqmxtLq7xsrOz+TlAAQNDhESKTE0OjtFRklKXmRlhJGbncnOzw0RKTo7RUlXW15fZGWNkam0urvFyd/k5fANEUVJZGWAhLK8vr/V1/Dxg4WLpKa+v8XHz9rbSJi9zcbOz0lOT1dZXl+Jjo+xtre/wcbH1xEWF1tc9vf+/4Btcd7fDh9ubxwdX31+rq/e3027vBYXHh9GR05PWFpcXn5/tcXU1dzw8fVyc490dSYuL6evt7/Hz9ffmgBAl5gwjx/O/05PWlsHCA8QJy/u725vNz0/QkVTZ3XIydDR2Nnn/v8AIF8igt8EgkQIGwQGEYGsDoCrBSAHgRwDGQgBBC8ENAQHAwEHBgcRClAPEgdVBwMEHAoJAwgDBwMCAwMDDAQFAwsGAQ4VBU4HGwdXBwIFGAxQBEMDLQMBBBEGDww6BB0lXyBtBGolgMgFgrADGgaC/QNZBxYJGAkUDBQMagYKBhoGWQcrBUYKLAQMBAEDMQssBBoGCwOArAYKBkwUgPQIPAMPAz4FOAgrBYL/ERgILxEtAyIOIQ+AjASCmhYLFYiUBS8FOwcCDhgJgL4idAyA1hqBEAWA4QnyngM3CYFcFIC4CIDdFDwDCgY4CEYIDAZ0Cx4DWgRZCYCDGBwKFglMBICKBqukDBcEMaEEgdomBwwFBYKzICoGTASAjQSAvgMbAw8NOQ0QAFUAAAAKAAAAKwAAADkNEABVAAAAGgAAADYAAABhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvYXR0ZW1wdCB0byBjYWxjdWxhdGUgdGhlIHJlbWFpbmRlciB3aXRoIGEgZGl2aXNvciBvZiB6ZXJvLi4gICAgAHsJcHJvZHVjZXJzAghsYW5ndWFnZQEEUnVzdAAMcHJvY2Vzc2VkLWJ5AwVydXN0Yx0xLjk0LjAgKDRhNGVmNDkzZSAyMDI2LTAzLTAyKQZ3YWxydXMGMC4yMy4yDHdhc20tYmluZGdlbhIwLjIuOTkgKDA0Y2E2ZjM0YSkAaw90YXJnZXRfZmVhdHVyZXMGKw9tdXRhYmxlLWdsb2JhbHMrE25vbnRyYXBwaW5nLWZwdG9pbnQrC2J1bGstbWVtb3J5KwhzaWduLWV4dCsPcmVmZXJlbmNlLXR5cGVzKwptdWx0aXZhbHVl");
}
var wasm;
var cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: () => {
throw Error("TextDecoder not available");
} };
if (typeof TextDecoder !== "undefined") {
cachedTextDecoder.decode();
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
}
return cachedUint8ArrayMemory0;
}
function getStringFromWasm0(ptr, len) {
ptr = ptr >>> 0;
return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var WASM_VECTOR_LEN = 0;
var cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : { encode: () => {
throw Error("TextEncoder not available");
} };
var encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
return cachedTextEncoder.encodeInto(arg, view);
} : function(arg, view) {
const buf = cachedTextEncoder.encode(arg);
view.set(buf);
return {
read: arg.length,
written: buf.length
};
};
function passStringToWasm0(arg, malloc, realloc) {
if (realloc === void 0) {
const buf = cachedTextEncoder.encode(arg);
const ptr2 = malloc(buf.length, 1) >>> 0;
getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
WASM_VECTOR_LEN = buf.length;
return ptr2;
}
let len = arg.length;
let ptr = malloc(len, 1) >>> 0;
const mem = getUint8ArrayMemory0();
let offset = 0;
for (; offset < len; offset++) {
const code = arg.charCodeAt(offset);
if (code > 127) break;
mem[ptr + offset] = code;
}
if (offset !== len) {
if (offset !== 0) {
arg = arg.slice(offset);
}
ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
const ret = encodeString(arg, view);
offset += ret.written;
ptr = realloc(ptr, len, offset, 1) >>> 0;
}
WASM_VECTOR_LEN = offset;
return ptr;
}
var cachedDataViewMemory0 = null;
function getDataViewMemory0() {
if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
}
return cachedDataViewMemory0;
}
function getArrayU8FromWasm0(ptr, len) {
ptr = ptr >>> 0;
return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
function passArray8ToWasm0(arg, malloc) {
const ptr = malloc(arg.length * 1, 1) >>> 0;
getUint8ArrayMemory0().set(arg, ptr / 1);
WASM_VECTOR_LEN = arg.length;
return ptr;
}
function takeFromExternrefTable0(idx) {
const value = wasm.__wbindgen_export_3.get(idx);
wasm.__externref_table_dealloc(idx);
return value;
}
function decryptQMC1(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.decryptQMC1(ptr0, len0, buffer, offset);
}
function decryptQRCFile(buffer) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.decryptQRCFile(ptr0, len0, buffer);
if (ret[3]) {
throw takeFromExternrefTable0(ret[2]);
}
var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
return v2;
}
function decryptQRCNetwork(buffer) {
const ptr0 = passStringToWasm0(buffer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.decryptQRCNetwork(ptr0, len0);
if (ret[3]) {
throw takeFromExternrefTable0(ret[2]);
}
var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
return v2;
}
function _assertClass(instance, klass) {
if (!(instance instanceof klass)) {
throw new Error(`expected instance of ${klass.name}`);
}
}
function isLikeNone(x) {
return x === void 0 || x === null;
}
function kuwoBodianCipherFactory(ekey) {
const ptr0 = passStringToWasm0(ekey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.kuwoBodianCipherFactory(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return QMC2.__wrap(ret[0]);
}
function kuwoV2CipherFactory(ekey) {
const ptr0 = passStringToWasm0(ekey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.kuwoV2CipherFactory(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return QMC2.__wrap(ret[0]);
}
function detectAudioType(buffer) {
const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.detectAudioType(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return AudioTypeResult.__wrap(ret[0]);
}
function initPanicHook() {
wasm.initPanicHook();
}
function decryptX2MHeader(buffer) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.decryptX2MHeader(ptr0, len0, buffer);
if (ret[1]) {
throw takeFromExternrefTable0(ret[0]);
}
}
function decryptX3MHeader(buffer) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.decryptX3MHeader(ptr0, len0, buffer);
if (ret[1]) {
throw takeFromExternrefTable0(ret[0]);
}
}
var AudioTypeResultFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_audiotyperesult_free(ptr >>> 0, 1));
var AudioTypeResult = class _AudioTypeResult {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_AudioTypeResult.prototype);
obj.__wbg_ptr = ptr;
AudioTypeResultFinalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
AudioTypeResultFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_audiotyperesult_free(ptr, 0);
}
get needMore() {
const ret = wasm.__wbg_get_audiotyperesult_needMore(this.__wbg_ptr);
return ret >>> 0;
}
set needMore(arg0) {
wasm.__wbg_set_audiotyperesult_needMore(this.__wbg_ptr, arg0);
}
get audioType() {
let deferred1_0;
let deferred1_1;
try {
const ret = wasm.__wbg_get_audiotyperesult_audioType(this.__wbg_ptr);
deferred1_0 = ret[0];
deferred1_1 = ret[1];
return getStringFromWasm0(ret[0], ret[1]);
} finally {
wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
}
}
set audioType(arg0) {
const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
wasm.__wbg_set_audiotyperesult_audioType(this.__wbg_ptr, ptr0, len0);
}
};
var JooxFileFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_jooxfile_free(ptr >>> 0, 1));
var JooxFile = class _JooxFile {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_JooxFile.prototype);
obj.__wbg_ptr = ptr;
JooxFileFinalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
JooxFileFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_jooxfile_free(ptr, 0);
}
get bufferLength() {
const ret = wasm.jooxfile_bufferLength(this.__wbg_ptr);
return ret >>> 0;
}
static parse(header, uuid) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ptr1 = passStringToWasm0(uuid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len1 = WASM_VECTOR_LEN;
const ret = wasm.jooxfile_parse(ptr0, len0, ptr1, len1);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return _JooxFile.__wrap(ret[0]);
}
decrypt(buffer) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.jooxfile_decrypt(this.__wbg_ptr, ptr0, len0, buffer);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return ret[0] >>> 0;
}
};
var KWMDecipherFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_kwmdecipher_free(ptr >>> 0, 1));
var KWMDecipher = class {
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
KWMDecipherFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_kwmdecipher_free(ptr, 0);
}
constructor(header, ekey) {
_assertClass(header, KuwoHeader);
var ptr0 = isLikeNone(ekey) ? 0 : passStringToWasm0(ekey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.kwmdecipher_make_decipher(header.__wbg_ptr, ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
this.__wbg_ptr = ret[0] >>> 0;
KWMDecipherFinalization.register(this, this.__wbg_ptr, this);
return this;
}
decrypt(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.kwmdecipher_decrypt(this.__wbg_ptr, ptr0, len0, buffer, offset);
}
};
var KWMDecipherV1Finalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_kwmdecipherv1_free(ptr >>> 0, 1));
var KWMDecipherV1 = class {
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
KWMDecipherV1Finalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_kwmdecipherv1_free(ptr, 0);
}
decrypt(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.kwmdecipherv1_decrypt(this.__wbg_ptr, ptr0, len0, buffer, offset);
}
};
var KuGouFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_kugou_free(ptr >>> 0, 1));
var KuGou = class _KuGou {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_KuGou.prototype);
obj.__wbg_ptr = ptr;
KuGouFinalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
KuGouFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_kugou_free(ptr, 0);
}
static decryptDatabase(database) {
var ptr0 = passArray8ToWasm0(database, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.kugou_decryptDatabase(ptr0, len0, database);
if (ret[1]) {
throw takeFromExternrefTable0(ret[0]);
}
}
static from_header(header) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.kugou_from_header(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return _KuGou.__wrap(ret[0]);
}
static fromHeaderV5(header, ekey) {
_assertClass(header, KuGouHeader);
var ptr0 = isLikeNone(ekey) ? 0 : passStringToWasm0(ekey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.kugou_fromHeaderV5(header.__wbg_ptr, ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return _KuGou.__wrap(ret[0]);
}
decrypt(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.kugou_decrypt(this.__wbg_ptr, ptr0, len0, buffer, offset);
}
};
var KuGouHeaderFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_kugouheader_free(ptr >>> 0, 1));
var KuGouHeader = class {
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
KuGouHeaderFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_kugouheader_free(ptr, 0);
}
get audioHash() {
let deferred1_0;
let deferred1_1;
try {
const ret = wasm.kugouheader_audioHash(this.__wbg_ptr);
deferred1_0 = ret[0];
deferred1_1 = ret[1];
return getStringFromWasm0(ret[0], ret[1]);
} finally {
wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
}
}
get version() {
const ret = wasm.kugouheader_version(this.__wbg_ptr);
return ret >>> 0;
}
get offsetToData() {
const ret = wasm.kugouheader_offsetToData(this.__wbg_ptr);
return ret >>> 0;
}
constructor(header) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.kugouheader_new(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
this.__wbg_ptr = ret[0] >>> 0;
KuGouHeaderFinalization.register(this, this.__wbg_ptr, this);
return this;
}
};
var KuwoHeaderFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_kuwoheader_free(ptr >>> 0, 1));
var KuwoHeader = class _KuwoHeader {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_KuwoHeader.prototype);
obj.__wbg_ptr = ptr;
KuwoHeaderFinalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
KuwoHeaderFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_kuwoheader_free(ptr, 0);
}
get qualityId() {
const ret = wasm.kuwoheader_qualityId(this.__wbg_ptr);
return ret >>> 0;
}
get resourceId() {
const ret = wasm.kuwoheader_resourceId(this.__wbg_ptr);
return ret >>> 0;
}
static parse(header) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.kuwoheader_parse(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return _KuwoHeader.__wrap(ret[0]);
}
};
var Migu3DFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_migu3d_free(ptr >>> 0, 1));
var Migu3D = class _Migu3D {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_Migu3D.prototype);
obj.__wbg_ptr = ptr;
Migu3DFinalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
Migu3DFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_migu3d_free(ptr, 0);
}
static fromHeader(header) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.migu3d_fromHeader(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return _Migu3D.__wrap(ret[0]);
}
static fromFileKey(file_key) {
const ptr0 = passStringToWasm0(file_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.migu3d_fromFileKey(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return _Migu3D.__wrap(ret[0]);
}
decrypt(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.migu3d_decrypt(this.__wbg_ptr, ptr0, len0, buffer, offset);
}
};
var NCMFileFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_ncmfile_free(ptr >>> 0, 1));
var NCMFile = class {
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
NCMFileFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_ncmfile_free(ptr, 0);
}
get audioOffset() {
const ret = wasm.ncmfile_audioOffset(this.__wbg_ptr);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return ret[0] >>> 0;
}
constructor() {
const ret = wasm.ncmfile_new();
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
this.__wbg_ptr = ret[0] >>> 0;
NCMFileFinalization.register(this, this.__wbg_ptr, this);
return this;
}
open(header) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.ncmfile_open(this.__wbg_ptr, ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return ret[0];
}
decrypt(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.ncmfile_decrypt(this.__wbg_ptr, ptr0, len0, buffer, offset);
if (ret[1]) {
throw takeFromExternrefTable0(ret[0]);
}
}
};
var QMC2Finalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_qmc2_free(ptr >>> 0, 1));
var QMC2 = class _QMC2 {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_QMC2.prototype);
obj.__wbg_ptr = ptr;
QMC2Finalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
QMC2Finalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_qmc2_free(ptr, 0);
}
constructor(ekey) {
const ptr0 = passStringToWasm0(ekey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.qmc2_new(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
this.__wbg_ptr = ret[0] >>> 0;
QMC2Finalization.register(this, this.__wbg_ptr, this);
return this;
}
decrypt(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.qmc2_decrypt(this.__wbg_ptr, ptr0, len0, buffer, offset);
}
};
var QMCFooterFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_qmcfooter_free(ptr >>> 0, 1));
var QMCFooter = class _QMCFooter {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_QMCFooter.prototype);
obj.__wbg_ptr = ptr;
QMCFooterFinalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
QMCFooterFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_qmcfooter_free(ptr, 0);
}
get mediaName() {
const ret = wasm.qmcfooter_mediaName(this.__wbg_ptr);
let v1;
if (ret[0] !== 0) {
v1 = getStringFromWasm0(ret[0], ret[1]).slice();
wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
}
return v1;
}
get ekey() {
const ret = wasm.qmcfooter_ekey(this.__wbg_ptr);
let v1;
if (ret[0] !== 0) {
v1 = getStringFromWasm0(ret[0], ret[1]).slice();
wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
}
return v1;
}
get size() {
const ret = wasm.qmcfooter_size(this.__wbg_ptr);
return ret >>> 0;
}
static parse(footer) {
const ptr0 = passArray8ToWasm0(footer, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.qmcfooter_parse(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return ret[0] === 0 ? void 0 : _QMCFooter.__wrap(ret[0]);
}
};
var QingTingFMFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_qingtingfm_free(ptr >>> 0, 1));
var QingTingFM = class {
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
QingTingFMFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_qingtingfm_free(ptr, 0);
}
static getFileIV(file_name) {
const ptr0 = passStringToWasm0(file_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.qingtingfm_getFileIV(ptr0, len0);
if (ret[3]) {
throw takeFromExternrefTable0(ret[2]);
}
var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
return v2;
}
static getDeviceKey(product, device, manufacturer, brand, board, model) {
const ptr0 = passStringToWasm0(product, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len0 = WASM_VECTOR_LEN;
const ptr1 = passStringToWasm0(device, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len1 = WASM_VECTOR_LEN;
const ptr2 = passStringToWasm0(manufacturer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len2 = WASM_VECTOR_LEN;
const ptr3 = passStringToWasm0(brand, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len3 = WASM_VECTOR_LEN;
const ptr4 = passStringToWasm0(board, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len4 = WASM_VECTOR_LEN;
const ptr5 = passStringToWasm0(model, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len5 = WASM_VECTOR_LEN;
const ret = wasm.qingtingfm_getDeviceKey(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
var v7 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
return v7;
}
constructor(device_key, file_iv) {
const ptr0 = passArray8ToWasm0(device_key, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ptr1 = passArray8ToWasm0(file_iv, wasm.__wbindgen_malloc);
const len1 = WASM_VECTOR_LEN;
const ret = wasm.qingtingfm_new(ptr0, len0, ptr1, len1);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
this.__wbg_ptr = ret[0] >>> 0;
QingTingFMFinalization.register(this, this.__wbg_ptr, this);
return this;
}
decrypt(buffer, offset) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.qingtingfm_decrypt(this.__wbg_ptr, ptr0, len0, buffer, offset);
}
};
var XiamiFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_xiami_free(ptr >>> 0, 1));
var Xiami = class _Xiami {
static __wrap(ptr) {
ptr = ptr >>> 0;
const obj = Object.create(_Xiami.prototype);
obj.__wbg_ptr = ptr;
XiamiFinalization.register(obj, obj.__wbg_ptr, obj);
return obj;
}
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
XiamiFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_xiami_free(ptr, 0);
}
static from_header(header) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.xiami_from_header(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return _Xiami.__wrap(ret[0]);
}
get copyPlainLength() {
const ret = wasm.xiami_copyPlainLength(this.__wbg_ptr);
return ret >>> 0;
}
decrypt(buffer) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
wasm.xiami_decrypt(this.__wbg_ptr, ptr0, len0, buffer);
}
};
var XmlyPCFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_xmlypc_free(ptr >>> 0, 1));
var XmlyPC = class {
__destroy_into_raw() {
const ptr = this.__wbg_ptr;
this.__wbg_ptr = 0;
XmlyPCFinalization.unregister(this);
return ptr;
}
free() {
const ptr = this.__destroy_into_raw();
wasm.__wbg_xmlypc_free(ptr, 0);
}
static getHeaderSize(buffer) {
const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.xmlypc_getHeaderSize(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return ret[0] >>> 0;
}
get audioHeader() {
const ret = wasm.xmlypc_audioHeader(this.__wbg_ptr);
var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
return v1;
}
get encryptedHeaderSize() {
const ret = wasm.xmlypc_encryptedHeaderSize(this.__wbg_ptr);
return ret >>> 0;
}
get encryptedHeaderOffset() {
const ret = wasm.xmlypc_encryptedHeaderOffset(this.__wbg_ptr);
return ret >>> 0;
}
constructor(header) {
const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
const len0 = WASM_VECTOR_LEN;
const ret = wasm.xmlypc_new(ptr0, len0);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
this.__wbg_ptr = ret[0] >>> 0;
XmlyPCFinalization.register(this, this.__wbg_ptr, this);
return this;
}
decrypt(buffer) {
var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
var len0 = WASM_VECTOR_LEN;
const ret = wasm.xmlypc_decrypt(this.__wbg_ptr, ptr0, len0, buffer);
if (ret[2]) {
throw takeFromExternrefTable0(ret[1]);
}
return ret[0] >>> 0;
}
};
async function __wbg_load(module2, imports) {
if (typeof Response === "function" && module2 instanceof Response) {
if (typeof WebAssembly.instantiateStreaming === "function") {
try {
return await WebAssembly.instantiateStreaming(module2, imports);
} catch (e) {
if (module2.headers.get("Content-Type") != "application/wasm") {
console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
} else {
throw e;
}
}
}
const bytes = await module2.arrayBuffer();
return await WebAssembly.instantiate(bytes, imports);
} else {
const instance = await WebAssembly.instantiate(module2, imports);
if (instance instanceof WebAssembly.Instance) {
return { instance, module: module2 };
} else {
return instance;
}
}
}
function __wbg_get_imports() {
const imports = {};
imports.wbg = {};
imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
let deferred0_0;
let deferred0_1;
try {
deferred0_0 = arg0;
deferred0_1 = arg1;
console.error(getStringFromWasm0(arg0, arg1));
} finally {
wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
}
};
imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
const ret = new Error();
return ret;
};
imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
const ret = arg1.stack;
const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
const len1 = WASM_VECTOR_LEN;
getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};
imports.wbg.__wbindgen_copy_to_typed_array = function(arg0, arg1, arg2) {
new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
};
imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
const ret = new Error(getStringFromWasm0(arg0, arg1));
return ret;
};
imports.wbg.__wbindgen_init_externref_table = function() {
const table = wasm.__wbindgen_export_3;
const offset = table.grow(4);
table.set(0, void 0);
table.set(offset + 0, void 0);
table.set(offset + 1, null);
table.set(offset + 2, true);
table.set(offset + 3, false);
};
imports.wbg.__wbindgen_throw = function(arg0, arg1) {
throw new Error(getStringFromWasm0(arg0, arg1));
};
return imports;
}
function __wbg_finalize_init(instance, module2) {
wasm = instance.exports;
__wbg_init.__wbindgen_wasm_module = module2;
cachedDataViewMemory0 = null;
cachedUint8ArrayMemory0 = null;
wasm.__wbindgen_start();
return wasm;
}
function initSync(module2) {
if (wasm !== void 0) return wasm;
if (typeof module2 !== "undefined") {
if (Object.getPrototypeOf(module2) === Object.prototype) {
({ module: module2 } = module2);
} else {
console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
}
}
const imports = __wbg_get_imports();
if (!(module2 instanceof WebAssembly.Module)) {
module2 = new WebAssembly.Module(module2);
}
const instance = new WebAssembly.Instance(module2, imports);
return __wbg_finalize_init(instance, module2);
}
async function __wbg_init(module_or_path) {
if (wasm !== void 0) return wasm;
if (typeof module_or_path !== "undefined") {
if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
({ module_or_path } = module_or_path);
} else {
console.warn("using deprecated parameters for the initialization function; pass a single object instead");
}
}
if (typeof module_or_path === "undefined") {
module_or_path = new URL("um_wasm_bg.wasm", typeof document === "undefined" ? __require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.src || new URL("loader-inline.js", document.baseURI).href);
}
const imports = __wbg_get_imports();
if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
module_or_path = fetch(module_or_path);
}
const { instance, module: module2 } = await __wbg_load(await module_or_path, imports);
return __wbg_finalize_init(instance, module2);
}
function loader() {
{
initSync({ module: umWasm() });
initPanicHook();
return Promise.resolve(true);
}
}
function getUmcVersion() {
return "0.1.12";
}
var ready = loader();
exports.AudioTypeResult = AudioTypeResult;
exports.JooxFile = JooxFile;
exports.KWMDecipher = KWMDecipher;
exports.KWMDecipherV1 = KWMDecipherV1;
exports.KuGou = KuGou;
exports.KuGouHeader = KuGouHeader;
exports.KuwoHeader = KuwoHeader;
exports.Migu3D = Migu3D;
exports.NCMFile = NCMFile;
exports.QMC2 = QMC2;
exports.QMCFooter = QMCFooter;
exports.QingTingFM = QingTingFM;
exports.Xiami = Xiami;
exports.XmlyPC = XmlyPC;
exports.__wbg_init = __wbg_init;
exports.decryptQMC1 = decryptQMC1;
exports.decryptQRCFile = decryptQRCFile;
exports.decryptQRCNetwork = decryptQRCNetwork;
exports.decryptX2MHeader = decryptX2MHeader;
exports.decryptX3MHeader = decryptX3MHeader;
exports.detectAudioType = detectAudioType;
exports.getUmcVersion = getUmcVersion;
exports.initPanicHook = initPanicHook;
exports.initSync = initSync;
exports.kuwoBodianCipherFactory = kuwoBodianCipherFactory;
exports.kuwoV2CipherFactory = kuwoV2CipherFactory;
exports.ready = ready;
}
});
return require_loader_inline();
})();
;
/* ==== crypto-js 4.1.1 (minimal inline) ==== */

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory();
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define([], factory);
	}
	else {
		// Global (browser)
		root.CryptoJS = factory();
	}
}(this, function () {

	/*globals window, global, require*/

	/**
	 * CryptoJS core components.
	 */
	var CryptoJS = CryptoJS || (function (Math, undefined) {

	    var crypto;

	    // Native crypto from window (Browser)
	    if (typeof window !== 'undefined' && window.crypto) {
	        crypto = window.crypto;
	    }

	    // Native crypto in web worker (Browser)
	    if (typeof self !== 'undefined' && self.crypto) {
	        crypto = self.crypto;
	    }

	    // Native crypto from worker
	    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
	        crypto = globalThis.crypto;
	    }

	    // Native (experimental IE 11) crypto from window (Browser)
	    if (!crypto && typeof window !== 'undefined' && window.msCrypto) {
	        crypto = window.msCrypto;
	    }

	    // Native crypto from global (NodeJS)
	    if (!crypto && typeof global !== 'undefined' && global.crypto) {
	        crypto = global.crypto;
	    }

	    // Native crypto import via require (NodeJS)
	    if (!crypto && typeof require === 'function') {
	        try {
	            crypto = require('crypto');
	        } catch (err) {}
	    }

	    /*
	     * Cryptographically secure pseudorandom number generator
	     *
	     * As Math.random() is cryptographically not safe to use
	     */
	    var cryptoSecureRandomInt = function () {
	        if (crypto) {
	            // Use getRandomValues method (Browser)
	            if (typeof crypto.getRandomValues === 'function') {
	                try {
	                    return crypto.getRandomValues(new Uint32Array(1))[0];
	                } catch (err) {}
	            }

	            // Use randomBytes method (NodeJS)
	            if (typeof crypto.randomBytes === 'function') {
	                try {
	                    return crypto.randomBytes(4).readInt32LE();
	                } catch (err) {}
	            }
	        }

	        throw new Error('Native crypto module could not be used to get secure random number.');
	    };

	    /*
	     * Local polyfill of Object.create

	     */
	    var create = Object.create || (function () {
	        function F() {}

	        return function (obj) {
	            var subtype;

	            F.prototype = obj;

	            subtype = new F();

	            F.prototype = null;

	            return subtype;
	        };
	    }());

	    /**
	     * CryptoJS namespace.
	     */
	    var C = {};

	    /**
	     * Library namespace.
	     */
	    var C_lib = C.lib = {};

	    /**
	     * Base object for prototypal inheritance.
	     */
	    var Base = C_lib.Base = (function () {


	        return {
	            /**
	             * Creates a new object that inherits from this object.
	             *
	             * @param {Object} overrides Properties to copy into the new object.
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         field: 'value',
	             *
	             *         method: function () {
	             *         }
	             *     });
	             */
	            extend: function (overrides) {
	                // Spawn
	                var subtype = create(this);

	                // Augment
	                if (overrides) {
	                    subtype.mixIn(overrides);
	                }

	                // Create default initializer
	                if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
	                    subtype.init = function () {
	                        subtype.$super.init.apply(this, arguments);
	                    };
	                }

	                // Initializer's prototype is the subtype object
	                subtype.init.prototype = subtype;

	                // Reference supertype
	                subtype.$super = this;

	                return subtype;
	            },

	            /**
	             * Extends this object and runs the init method.
	             * Arguments to create() will be passed to init().
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var instance = MyType.create();
	             */
	            create: function () {
	                var instance = this.extend();
	                instance.init.apply(instance, arguments);

	                return instance;
	            },

	            /**
	             * Initializes a newly created object.
	             * Override this method to add some logic when your objects are created.
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         init: function () {
	             *             // ...
	             *         }
	             *     });
	             */
	            init: function () {
	            },

	            /**
	             * Copies properties into this object.
	             *
	             * @param {Object} properties The properties to mix in.
	             *
	             * @example
	             *
	             *     MyType.mixIn({
	             *         field: 'value'
	             *     });
	             */
	            mixIn: function (properties) {
	                for (var propertyName in properties) {
	                    if (properties.hasOwnProperty(propertyName)) {
	                        this[propertyName] = properties[propertyName];
	                    }
	                }

	                // IE won't copy toString using the loop above
	                if (properties.hasOwnProperty('toString')) {
	                    this.toString = properties.toString;
	                }
	            },

	            /**
	             * Creates a copy of this object.
	             *
	             * @return {Object} The clone.
	             *
	             * @example
	             *
	             *     var clone = instance.clone();
	             */
	            clone: function () {
	                return this.init.prototype.extend(this);
	            }
	        };
	    }());

	    /**
	     * An array of 32-bit words.
	     *
	     * @property {Array} words The array of 32-bit words.
	     * @property {number} sigBytes The number of significant bytes in this word array.
	     */
	    var WordArray = C_lib.WordArray = Base.extend({
	        /**
	         * Initializes a newly created word array.
	         *
	         * @param {Array} words (Optional) An array of 32-bit words.
	         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.create();
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
	         */
	        init: function (words, sigBytes) {
	            words = this.words = words || [];

	            if (sigBytes != undefined) {
	                this.sigBytes = sigBytes;
	            } else {
	                this.sigBytes = words.length * 4;
	            }
	        },

	        /**
	         * Converts this word array to a string.
	         *
	         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
	         *
	         * @return {string} The stringified word array.
	         *
	         * @example
	         *
	         *     var string = wordArray + '';
	         *     var string = wordArray.toString();
	         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
	         */
	        toString: function (encoder) {
	            return (encoder || Hex).stringify(this);
	        },

	        /**
	         * Concatenates a word array to this word array.
	         *
	         * @param {WordArray} wordArray The word array to append.
	         *
	         * @return {WordArray} This word array.
	         *
	         * @example
	         *
	         *     wordArray1.concat(wordArray2);
	         */
	        concat: function (wordArray) {
	            // Shortcuts
	            var thisWords = this.words;
	            var thatWords = wordArray.words;
	            var thisSigBytes = this.sigBytes;
	            var thatSigBytes = wordArray.sigBytes;

	            // Clamp excess bits
	            this.clamp();

	            // Concat
	            if (thisSigBytes % 4) {
	                // Copy one byte at a time
	                for (var i = 0; i < thatSigBytes; i++) {
	                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
	                }
	            } else {
	                // Copy one word at a time
	                for (var j = 0; j < thatSigBytes; j += 4) {
	                    thisWords[(thisSigBytes + j) >>> 2] = thatWords[j >>> 2];
	                }
	            }
	            this.sigBytes += thatSigBytes;

	            // Chainable
	            return this;
	        },

	        /**
	         * Removes insignificant bits.
	         *
	         * @example
	         *
	         *     wordArray.clamp();
	         */
	        clamp: function () {
	            // Shortcuts
	            var words = this.words;
	            var sigBytes = this.sigBytes;

	            // Clamp
	            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
	            words.length = Math.ceil(sigBytes / 4);
	        },

	        /**
	         * Creates a copy of this word array.
	         *
	         * @return {WordArray} The clone.
	         *
	         * @example
	         *
	         *     var clone = wordArray.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone.words = this.words.slice(0);

	            return clone;
	        },

	        /**
	         * Creates a word array filled with random bytes.
	         *
	         * @param {number} nBytes The number of random bytes to generate.
	         *
	         * @return {WordArray} The random word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.random(16);
	         */
	        random: function (nBytes) {
	            var words = [];

	            for (var i = 0; i < nBytes; i += 4) {
	                words.push(cryptoSecureRandomInt());
	            }

	            return new WordArray.init(words, nBytes);
	        }
	    });

	    /**
	     * Encoder namespace.
	     */
	    var C_enc = C.enc = {};

	    /**
	     * Hex encoding strategy.
	     */
	    var Hex = C_enc.Hex = {
	        /**
	         * Converts a word array to a hex string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The hex string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var hexChars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                hexChars.push((bite >>> 4).toString(16));
	                hexChars.push((bite & 0x0f).toString(16));
	            }

	            return hexChars.join('');
	        },

	        /**
	         * Converts a hex string to a word array.
	         *
	         * @param {string} hexStr The hex string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
	         */
	        parse: function (hexStr) {
	            // Shortcut
	            var hexStrLength = hexStr.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < hexStrLength; i += 2) {
	                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
	            }

	            return new WordArray.init(words, hexStrLength / 2);
	        }
	    };

	    /**
	     * Latin1 encoding strategy.
	     */
	    var Latin1 = C_enc.Latin1 = {
	        /**
	         * Converts a word array to a Latin1 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Latin1 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var latin1Chars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                latin1Chars.push(String.fromCharCode(bite));
	            }

	            return latin1Chars.join('');
	        },

	        /**
	         * Converts a Latin1 string to a word array.
	         *
	         * @param {string} latin1Str The Latin1 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
	         */
	        parse: function (latin1Str) {
	            // Shortcut
	            var latin1StrLength = latin1Str.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < latin1StrLength; i++) {
	                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
	            }

	            return new WordArray.init(words, latin1StrLength);
	        }
	    };

	    /**
	     * UTF-8 encoding strategy.
	     */
	    var Utf8 = C_enc.Utf8 = {
	        /**
	         * Converts a word array to a UTF-8 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The UTF-8 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            try {
	                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
	            } catch (e) {
	                throw new Error('Malformed UTF-8 data');
	            }
	        },

	        /**
	         * Converts a UTF-8 string to a word array.
	         *
	         * @param {string} utf8Str The UTF-8 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
	         */
	        parse: function (utf8Str) {
	            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
	        }
	    };

	    /**
	     * Abstract buffered block algorithm template.
	     *
	     * The property blockSize must be implemented in a concrete subtype.
	     *
	     * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
	     */
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
	        /**
	         * Resets this block algorithm's data buffer to its initial state.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm.reset();
	         */
	        reset: function () {
	            // Initial values
	            this._data = new WordArray.init();
	            this._nDataBytes = 0;
	        },

	        /**
	         * Adds new data to this block algorithm's buffer.
	         *
	         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm._append('data');
	         *     bufferedBlockAlgorithm._append(wordArray);
	         */
	        _append: function (data) {
	            // Convert string to WordArray, else assume WordArray already
	            if (typeof data == 'string') {
	                data = Utf8.parse(data);
	            }

	            // Append
	            this._data.concat(data);
	            this._nDataBytes += data.sigBytes;
	        },

	        /**
	         * Processes available data blocks.
	         *
	         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
	         *
	         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
	         *
	         * @return {WordArray} The processed data.
	         *
	         * @example
	         *
	         *     var processedData = bufferedBlockAlgorithm._process();
	         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
	         */
	        _process: function (doFlush) {
	            var processedWords;

	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;
	            var dataSigBytes = data.sigBytes;
	            var blockSize = this.blockSize;
	            var blockSizeBytes = blockSize * 4;

	            // Count blocks ready
	            var nBlocksReady = dataSigBytes / blockSizeBytes;
	            if (doFlush) {
	                // Round up to include partial blocks
	                nBlocksReady = Math.ceil(nBlocksReady);
	            } else {
	                // Round down to include only full blocks,
	                // less the number of blocks that must remain in the buffer
	                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
	            }

	            // Count words ready
	            var nWordsReady = nBlocksReady * blockSize;

	            // Count bytes ready
	            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

	            // Process blocks
	            if (nWordsReady) {
	                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
	                    // Perform concrete-algorithm logic
	                    this._doProcessBlock(dataWords, offset);
	                }

	                // Remove processed words
	                processedWords = dataWords.splice(0, nWordsReady);
	                data.sigBytes -= nBytesReady;
	            }

	            // Return processed words
	            return new WordArray.init(processedWords, nBytesReady);
	        },

	        /**
	         * Creates a copy of this object.
	         *
	         * @return {Object} The clone.
	         *
	         * @example
	         *
	         *     var clone = bufferedBlockAlgorithm.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone._data = this._data.clone();

	            return clone;
	        },

	        _minBufferSize: 0
	    });

	    /**
	     * Abstract hasher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
	     */
	    var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         */
	        cfg: Base.extend(),

	        /**
	         * Initializes a newly created hasher.
	         *
	         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
	         *
	         * @example
	         *
	         *     var hasher = CryptoJS.algo.SHA256.create();
	         */
	        init: function (cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this hasher to its initial state.
	         *
	         * @example
	         *
	         *     hasher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-hasher logic
	            this._doReset();
	        },

	        /**
	         * Updates this hasher with a message.
	         *
	         * @param {WordArray|string} messageUpdate The message to append.
	         *
	         * @return {Hasher} This hasher.
	         *
	         * @example
	         *
	         *     hasher.update('message');
	         *     hasher.update(wordArray);
	         */
	        update: function (messageUpdate) {
	            // Append
	            this._append(messageUpdate);

	            // Update the hash
	            this._process();

	            // Chainable
	            return this;
	        },

	        /**
	         * Finalizes the hash computation.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} messageUpdate (Optional) A final message update.
	         *
	         * @return {WordArray} The hash.
	         *
	         * @example
	         *
	         *     var hash = hasher.finalize();
	         *     var hash = hasher.finalize('message');
	         *     var hash = hasher.finalize(wordArray);
	         */
	        finalize: function (messageUpdate) {
	            // Final message update
	            if (messageUpdate) {
	                this._append(messageUpdate);
	            }

	            // Perform concrete-hasher logic
	            var hash = this._doFinalize();

	            return hash;
	        },

	        blockSize: 512/32,

	        /**
	         * Creates a shortcut function to a hasher's object interface.
	         *
	         * @param {Hasher} hasher The hasher to create a helper for.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
	         */
	        _createHelper: function (hasher) {
	            return function (message, cfg) {
	                return new hasher.init(cfg).finalize(message);
	            };
	        },

	        /**
	         * Creates a shortcut function to the HMAC's object interface.
	         *
	         * @param {Hasher} hasher The hasher to use in this HMAC helper.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
	         */
	        _createHmacHelper: function (hasher) {
	            return function (message, key) {
	                return new C_algo.HMAC.init(hasher, key).finalize(message);
	            };
	        }
	    });

	    /**
	     * Algorithm namespace.
	     */
	    var C_algo = C.algo = {};

	    return C;
	}(Math));


	return CryptoJS;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.enc.Hex;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var C_enc = C.enc;

	    /**
	     * Base64 encoding strategy.
	     */
	    var Base64 = C_enc.Base64 = {
	        /**
	         * Converts a word array to a Base64 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Base64 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;
	            var map = this._map;

	            // Clamp excess bits
	            wordArray.clamp();

	            // Convert
	            var base64Chars = [];
	            for (var i = 0; i < sigBytes; i += 3) {
	                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
	                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
	                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

	                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

	                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
	                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
	                }
	            }

	            // Add padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                while (base64Chars.length % 4) {
	                    base64Chars.push(paddingChar);
	                }
	            }

	            return base64Chars.join('');
	        },

	        /**
	         * Converts a Base64 string to a word array.
	         *
	         * @param {string} base64Str The Base64 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
	         */
	        parse: function (base64Str) {
	            // Shortcuts
	            var base64StrLength = base64Str.length;
	            var map = this._map;
	            var reverseMap = this._reverseMap;

	            if (!reverseMap) {
	                    reverseMap = this._reverseMap = [];
	                    for (var j = 0; j < map.length; j++) {
	                        reverseMap[map.charCodeAt(j)] = j;
	                    }
	            }

	            // Ignore padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                var paddingIndex = base64Str.indexOf(paddingChar);
	                if (paddingIndex !== -1) {
	                    base64StrLength = paddingIndex;
	                }
	            }

	            // Convert
	            return parseLoop(base64Str, base64StrLength, reverseMap);

	        },

	        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
	    };

	    function parseLoop(base64Str, base64StrLength, reverseMap) {
	      var words = [];
	      var nBytes = 0;
	      for (var i = 0; i < base64StrLength; i++) {
	          if (i % 4) {
	              var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << ((i % 4) * 2);
	              var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> (6 - (i % 4) * 2);
	              var bitsCombined = bits1 | bits2;
	              words[nBytes >>> 2] |= bitsCombined << (24 - (nBytes % 4) * 8);
	              nBytes++;
	          }
	      }
	      return WordArray.create(words, nBytes);
	    }
	}());


	return CryptoJS.enc.Base64;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.enc.Utf8;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Check if typed arrays are supported
	    if (typeof ArrayBuffer != 'function') {
	        return;
	    }

	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;

	    // Reference original init
	    var superInit = WordArray.init;

	    // Augment WordArray.init to handle typed arrays
	    var subInit = WordArray.init = function (typedArray) {
	        // Convert buffers to uint8
	        if (typedArray instanceof ArrayBuffer) {
	            typedArray = new Uint8Array(typedArray);
	        }

	        // Convert other array views to uint8
	        if (
	            typedArray instanceof Int8Array ||
	            (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray) ||
	            typedArray instanceof Int16Array ||
	            typedArray instanceof Uint16Array ||
	            typedArray instanceof Int32Array ||
	            typedArray instanceof Uint32Array ||
	            typedArray instanceof Float32Array ||
	            typedArray instanceof Float64Array
	        ) {
	            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
	        }

	        // Handle Uint8Array
	        if (typedArray instanceof Uint8Array) {
	            // Shortcut
	            var typedArrayByteLength = typedArray.byteLength;

	            // Extract bytes
	            var words = [];
	            for (var i = 0; i < typedArrayByteLength; i++) {
	                words[i >>> 2] |= typedArray[i] << (24 - (i % 4) * 8);
	            }

	            // Initialize this word array
	            superInit.call(this, words, typedArrayByteLength);
	        } else {
	            // Else call normal init
	            superInit.apply(this, arguments);
	        }
	    };

	    subInit.prototype = WordArray;
	}());


	return CryptoJS.lib.WordArray;

}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./evpkdf"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./evpkdf"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Cipher core components.
	 */
	CryptoJS.lib.Cipher || (function (undefined) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var WordArray = C_lib.WordArray;
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
	    var C_enc = C.enc;
	    var Utf8 = C_enc.Utf8;
	    var Base64 = C_enc.Base64;
	    var C_algo = C.algo;
	    var EvpKDF = C_algo.EvpKDF;

	    /**
	     * Abstract base cipher template.
	     *
	     * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
	     * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
	     * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
	     * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
	     */
	    var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {WordArray} iv The IV to use for this operation.
	         */
	        cfg: Base.extend(),

	        /**
	         * Creates this cipher in encryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createEncryptor: function (key, cfg) {
	            return this.create(this._ENC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Creates this cipher in decryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createDecryptor: function (key, cfg) {
	            return this.create(this._DEC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Initializes a newly created cipher.
	         *
	         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
	         */
	        init: function (xformMode, key, cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Store transform mode and key
	            this._xformMode = xformMode;
	            this._key = key;

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this cipher to its initial state.
	         *
	         * @example
	         *
	         *     cipher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-cipher logic
	            this._doReset();
	        },

	        /**
	         * Adds data to be encrypted or decrypted.
	         *
	         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.process('data');
	         *     var encrypted = cipher.process(wordArray);
	         */
	        process: function (dataUpdate) {
	            // Append
	            this._append(dataUpdate);

	            // Process available blocks
	            return this._process();
	        },

	        /**
	         * Finalizes the encryption or decryption process.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after final processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.finalize();
	         *     var encrypted = cipher.finalize('data');
	         *     var encrypted = cipher.finalize(wordArray);
	         */
	        finalize: function (dataUpdate) {
	            // Final data update
	            if (dataUpdate) {
	                this._append(dataUpdate);
	            }

	            // Perform concrete-cipher logic
	            var finalProcessedData = this._doFinalize();

	            return finalProcessedData;
	        },

	        keySize: 128/32,

	        ivSize: 128/32,

	        _ENC_XFORM_MODE: 1,

	        _DEC_XFORM_MODE: 2,

	        /**
	         * Creates shortcut functions to a cipher's object interface.
	         *
	         * @param {Cipher} cipher The cipher to create a helper for.
	         *
	         * @return {Object} An object with encrypt and decrypt shortcut functions.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
	         */
	        _createHelper: (function () {
	            function selectCipherStrategy(key) {
	                if (typeof key == 'string') {
	                    return PasswordBasedCipher;
	                } else {
	                    return SerializableCipher;
	                }
	            }

	            return function (cipher) {
	                return {
	                    encrypt: function (message, key, cfg) {
	                        return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
	                    },

	                    decrypt: function (ciphertext, key, cfg) {
	                        return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
	                    }
	                };
	            };
	        }())
	    });

	    /**
	     * Abstract base stream cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
	     */
	    var StreamCipher = C_lib.StreamCipher = Cipher.extend({
	        _doFinalize: function () {
	            // Process partial blocks
	            var finalProcessedBlocks = this._process(!!'flush');

	            return finalProcessedBlocks;
	        },

	        blockSize: 1
	    });

	    /**
	     * Mode namespace.
	     */
	    var C_mode = C.mode = {};

	    /**
	     * Abstract base block cipher mode template.
	     */
	    var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
	        /**
	         * Creates this mode for encryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
	         */
	        createEncryptor: function (cipher, iv) {
	            return this.Encryptor.create(cipher, iv);
	        },

	        /**
	         * Creates this mode for decryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
	         */
	        createDecryptor: function (cipher, iv) {
	            return this.Decryptor.create(cipher, iv);
	        },

	        /**
	         * Initializes a newly created mode.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
	         */
	        init: function (cipher, iv) {
	            this._cipher = cipher;
	            this._iv = iv;
	        }
	    });

	    /**
	     * Cipher Block Chaining mode.
	     */
	    var CBC = C_mode.CBC = (function () {
	        /**
	         * Abstract base CBC mode.
	         */
	        var CBC = BlockCipherMode.extend();

	        /**
	         * CBC encryptor.
	         */
	        CBC.Encryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // XOR and encrypt
	                xorBlock.call(this, words, offset, blockSize);
	                cipher.encryptBlock(words, offset);

	                // Remember this block to use with next block
	                this._prevBlock = words.slice(offset, offset + blockSize);
	            }
	        });

	        /**
	         * CBC decryptor.
	         */
	        CBC.Decryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // Remember this block to use with next block
	                var thisBlock = words.slice(offset, offset + blockSize);

	                // Decrypt and XOR
	                cipher.decryptBlock(words, offset);
	                xorBlock.call(this, words, offset, blockSize);

	                // This block becomes the previous block
	                this._prevBlock = thisBlock;
	            }
	        });

	        function xorBlock(words, offset, blockSize) {
	            var block;

	            // Shortcut
	            var iv = this._iv;

	            // Choose mixing block
	            if (iv) {
	                block = iv;

	                // Remove IV for subsequent blocks
	                this._iv = undefined;
	            } else {
	                block = this._prevBlock;
	            }

	            // XOR blocks
	            for (var i = 0; i < blockSize; i++) {
	                words[offset + i] ^= block[i];
	            }
	        }

	        return CBC;
	    }());

	    /**
	     * Padding namespace.
	     */
	    var C_pad = C.pad = {};

	    /**
	     * PKCS #5/7 padding strategy.
	     */
	    var Pkcs7 = C_pad.Pkcs7 = {
	        /**
	         * Pads data using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to pad.
	         * @param {number} blockSize The multiple that the data should be padded to.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
	         */
	        pad: function (data, blockSize) {
	            // Shortcut
	            var blockSizeBytes = blockSize * 4;

	            // Count padding bytes
	            var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

	            // Create padding word
	            var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

	            // Create padding
	            var paddingWords = [];
	            for (var i = 0; i < nPaddingBytes; i += 4) {
	                paddingWords.push(paddingWord);
	            }
	            var padding = WordArray.create(paddingWords, nPaddingBytes);

	            // Add padding
	            data.concat(padding);
	        },

	        /**
	         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to unpad.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
	         */
	        unpad: function (data) {
	            // Get number of padding bytes from last byte
	            var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

	            // Remove padding
	            data.sigBytes -= nPaddingBytes;
	        }
	    };

	    /**
	     * Abstract base block cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
	     */
	    var BlockCipher = C_lib.BlockCipher = Cipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Mode} mode The block mode to use. Default: CBC
	         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
	         */
	        cfg: Cipher.cfg.extend({
	            mode: CBC,
	            padding: Pkcs7
	        }),

	        reset: function () {
	            var modeCreator;

	            // Reset cipher
	            Cipher.reset.call(this);

	            // Shortcuts
	            var cfg = this.cfg;
	            var iv = cfg.iv;
	            var mode = cfg.mode;

	            // Reset block mode
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                modeCreator = mode.createEncryptor;
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                modeCreator = mode.createDecryptor;
	                // Keep at least one block in the buffer for unpadding
	                this._minBufferSize = 1;
	            }

	            if (this._mode && this._mode.__creator == modeCreator) {
	                this._mode.init(this, iv && iv.words);
	            } else {
	                this._mode = modeCreator.call(mode, this, iv && iv.words);
	                this._mode.__creator = modeCreator;
	            }
	        },

	        _doProcessBlock: function (words, offset) {
	            this._mode.processBlock(words, offset);
	        },

	        _doFinalize: function () {
	            var finalProcessedBlocks;

	            // Shortcut
	            var padding = this.cfg.padding;

	            // Finalize
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                // Pad data
	                padding.pad(this._data, this.blockSize);

	                // Process final blocks
	                finalProcessedBlocks = this._process(!!'flush');
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                // Process final blocks
	                finalProcessedBlocks = this._process(!!'flush');

	                // Unpad data
	                padding.unpad(finalProcessedBlocks);
	            }

	            return finalProcessedBlocks;
	        },

	        blockSize: 128/32
	    });

	    /**
	     * A collection of cipher parameters.
	     *
	     * @property {WordArray} ciphertext The raw ciphertext.
	     * @property {WordArray} key The key to this ciphertext.
	     * @property {WordArray} iv The IV used in the ciphering operation.
	     * @property {WordArray} salt The salt used with a key derivation function.
	     * @property {Cipher} algorithm The cipher algorithm.
	     * @property {Mode} mode The block mode used in the ciphering operation.
	     * @property {Padding} padding The padding scheme used in the ciphering operation.
	     * @property {number} blockSize The block size of the cipher.
	     * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
	     */
	    var CipherParams = C_lib.CipherParams = Base.extend({
	        /**
	         * Initializes a newly created cipher params object.
	         *
	         * @param {Object} cipherParams An object with any of the possible cipher parameters.
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.lib.CipherParams.create({
	         *         ciphertext: ciphertextWordArray,
	         *         key: keyWordArray,
	         *         iv: ivWordArray,
	         *         salt: saltWordArray,
	         *         algorithm: CryptoJS.algo.AES,
	         *         mode: CryptoJS.mode.CBC,
	         *         padding: CryptoJS.pad.PKCS7,
	         *         blockSize: 4,
	         *         formatter: CryptoJS.format.OpenSSL
	         *     });
	         */
	        init: function (cipherParams) {
	            this.mixIn(cipherParams);
	        },

	        /**
	         * Converts this cipher params object to a string.
	         *
	         * @param {Format} formatter (Optional) The formatting strategy to use.
	         *
	         * @return {string} The stringified cipher params.
	         *
	         * @throws Error If neither the formatter nor the default formatter is set.
	         *
	         * @example
	         *
	         *     var string = cipherParams + '';
	         *     var string = cipherParams.toString();
	         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
	         */
	        toString: function (formatter) {
	            return (formatter || this.formatter).stringify(this);
	        }
	    });

	    /**
	     * Format namespace.
	     */
	    var C_format = C.format = {};

	    /**
	     * OpenSSL formatting strategy.
	     */
	    var OpenSSLFormatter = C_format.OpenSSL = {
	        /**
	         * Converts a cipher params object to an OpenSSL-compatible string.
	         *
	         * @param {CipherParams} cipherParams The cipher params object.
	         *
	         * @return {string} The OpenSSL-compatible string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
	         */
	        stringify: function (cipherParams) {
	            var wordArray;

	            // Shortcuts
	            var ciphertext = cipherParams.ciphertext;
	            var salt = cipherParams.salt;

	            // Format
	            if (salt) {
	                wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
	            } else {
	                wordArray = ciphertext;
	            }

	            return wordArray.toString(Base64);
	        },

	        /**
	         * Converts an OpenSSL-compatible string to a cipher params object.
	         *
	         * @param {string} openSSLStr The OpenSSL-compatible string.
	         *
	         * @return {CipherParams} The cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
	         */
	        parse: function (openSSLStr) {
	            var salt;

	            // Parse base64
	            var ciphertext = Base64.parse(openSSLStr);

	            // Shortcut
	            var ciphertextWords = ciphertext.words;

	            // Test for salt
	            if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
	                // Extract salt
	                salt = WordArray.create(ciphertextWords.slice(2, 4));

	                // Remove salt from ciphertext
	                ciphertextWords.splice(0, 4);
	                ciphertext.sigBytes -= 16;
	            }

	            return CipherParams.create({ ciphertext: ciphertext, salt: salt });
	        }
	    };

	    /**
	     * A cipher wrapper that returns ciphertext as a serializable cipher params object.
	     */
	    var SerializableCipher = C_lib.SerializableCipher = Base.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
	         */
	        cfg: Base.extend({
	            format: OpenSSLFormatter
	        }),

	        /**
	         * Encrypts a message.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Encrypt
	            var encryptor = cipher.createEncryptor(key, cfg);
	            var ciphertext = encryptor.finalize(message);

	            // Shortcut
	            var cipherCfg = encryptor.cfg;

	            // Create and return serializable cipher params
	            return CipherParams.create({
	                ciphertext: ciphertext,
	                key: key,
	                iv: cipherCfg.iv,
	                algorithm: cipher,
	                mode: cipherCfg.mode,
	                padding: cipherCfg.padding,
	                blockSize: cipher.blockSize,
	                formatter: cfg.format
	            });
	        },

	        /**
	         * Decrypts serialized ciphertext.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Decrypt
	            var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);

	            return plaintext;
	        },

	        /**
	         * Converts serialized ciphertext to CipherParams,
	         * else assumed CipherParams already and returns ciphertext unchanged.
	         *
	         * @param {CipherParams|string} ciphertext The ciphertext.
	         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
	         *
	         * @return {CipherParams} The unserialized ciphertext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
	         */
	        _parse: function (ciphertext, format) {
	            if (typeof ciphertext == 'string') {
	                return format.parse(ciphertext, this);
	            } else {
	                return ciphertext;
	            }
	        }
	    });

	    /**
	     * Key derivation function namespace.
	     */
	    var C_kdf = C.kdf = {};

	    /**
	     * OpenSSL key derivation function.
	     */
	    var OpenSSLKdf = C_kdf.OpenSSL = {
	        /**
	         * Derives a key and IV from a password.
	         *
	         * @param {string} password The password to derive from.
	         * @param {number} keySize The size in words of the key to generate.
	         * @param {number} ivSize The size in words of the IV to generate.
	         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
	         *
	         * @return {CipherParams} A cipher params object with the key, IV, and salt.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
	         */
	        execute: function (password, keySize, ivSize, salt) {
	            // Generate random salt
	            if (!salt) {
	                salt = WordArray.random(64/8);
	            }

	            // Derive key and IV
	            var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);

	            // Separate key and IV
	            var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
	            key.sigBytes = keySize * 4;

	            // Return params
	            return CipherParams.create({ key: key, iv: iv, salt: salt });
	        }
	    };

	    /**
	     * A serializable cipher wrapper that derives the key from a password,
	     * and returns ciphertext as a serializable cipher params object.
	     */
	    var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
	         */
	        cfg: SerializableCipher.cfg.extend({
	            kdf: OpenSSLKdf
	        }),

	        /**
	         * Encrypts a message using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Encrypt
	            var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);

	            // Mix in derived params
	            ciphertext.mixIn(derivedParams);

	            return ciphertext;
	        },

	        /**
	         * Decrypts serialized ciphertext using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Decrypt
	            var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);

	            return plaintext;
	        }
	    });
	}());


}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Electronic Codebook block mode.
	 */
	CryptoJS.mode.ECB = (function () {
	    var ECB = CryptoJS.lib.BlockCipherMode.extend();

	    ECB.Encryptor = ECB.extend({
	        processBlock: function (words, offset) {
	            this._cipher.encryptBlock(words, offset);
	        }
	    });

	    ECB.Decryptor = ECB.extend({
	        processBlock: function (words, offset) {
	            this._cipher.decryptBlock(words, offset);
	        }
	    });

	    return ECB;
	}());


	return CryptoJS.mode.ECB;

}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.pad.Pkcs7;

}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var BlockCipher = C_lib.BlockCipher;
	    var C_algo = C.algo;

	    // Lookup tables
	    var SBOX = [];
	    var INV_SBOX = [];
	    var SUB_MIX_0 = [];
	    var SUB_MIX_1 = [];
	    var SUB_MIX_2 = [];
	    var SUB_MIX_3 = [];
	    var INV_SUB_MIX_0 = [];
	    var INV_SUB_MIX_1 = [];
	    var INV_SUB_MIX_2 = [];
	    var INV_SUB_MIX_3 = [];

	    // Compute lookup tables
	    (function () {
	        // Compute double table
	        var d = [];
	        for (var i = 0; i < 256; i++) {
	            if (i < 128) {
	                d[i] = i << 1;
	            } else {
	                d[i] = (i << 1) ^ 0x11b;
	            }
	        }

	        // Walk GF(2^8)
	        var x = 0;
	        var xi = 0;
	        for (var i = 0; i < 256; i++) {
	            // Compute sbox
	            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
	            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
	            SBOX[x] = sx;
	            INV_SBOX[sx] = x;

	            // Compute multiplication
	            var x2 = d[x];
	            var x4 = d[x2];
	            var x8 = d[x4];

	            // Compute sub bytes, mix columns tables
	            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
	            SUB_MIX_0[x] = (t << 24) | (t >>> 8);
	            SUB_MIX_1[x] = (t << 16) | (t >>> 16);
	            SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
	            SUB_MIX_3[x] = t;

	            // Compute inv sub bytes, inv mix columns tables
	            var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
	            INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
	            INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
	            INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
	            INV_SUB_MIX_3[sx] = t;

	            // Compute next counter
	            if (!x) {
	                x = xi = 1;
	            } else {
	                x = x2 ^ d[d[d[x8 ^ x2]]];
	                xi ^= d[d[xi]];
	            }
	        }
	    }());

	    // Precomputed Rcon lookup
	    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

	    /**
	     * AES block cipher algorithm.
	     */
	    var AES = C_algo.AES = BlockCipher.extend({
	        _doReset: function () {
	            var t;

	            // Skip reset of nRounds has been set before and key did not change
	            if (this._nRounds && this._keyPriorReset === this._key) {
	                return;
	            }

	            // Shortcuts
	            var key = this._keyPriorReset = this._key;
	            var keyWords = key.words;
	            var keySize = key.sigBytes / 4;

	            // Compute number of rounds
	            var nRounds = this._nRounds = keySize + 6;

	            // Compute number of key schedule rows
	            var ksRows = (nRounds + 1) * 4;

	            // Compute key schedule
	            var keySchedule = this._keySchedule = [];
	            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
	                if (ksRow < keySize) {
	                    keySchedule[ksRow] = keyWords[ksRow];
	                } else {
	                    t = keySchedule[ksRow - 1];

	                    if (!(ksRow % keySize)) {
	                        // Rot word
	                        t = (t << 8) | (t >>> 24);

	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

	                        // Mix Rcon
	                        t ^= RCON[(ksRow / keySize) | 0] << 24;
	                    } else if (keySize > 6 && ksRow % keySize == 4) {
	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
	                    }

	                    keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
	                }
	            }

	            // Compute inv key schedule
	            var invKeySchedule = this._invKeySchedule = [];
	            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
	                var ksRow = ksRows - invKsRow;

	                if (invKsRow % 4) {
	                    var t = keySchedule[ksRow];
	                } else {
	                    var t = keySchedule[ksRow - 4];
	                }

	                if (invKsRow < 4 || ksRow <= 4) {
	                    invKeySchedule[invKsRow] = t;
	                } else {
	                    invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
	                                               INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
	                }
	            }
	        },

	        encryptBlock: function (M, offset) {
	            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
	        },

	        decryptBlock: function (M, offset) {
	            // Swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;

	            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

	            // Inv swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;
	        },

	        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
	            // Shortcut
	            var nRounds = this._nRounds;

	            // Get input, add round key
	            var s0 = M[offset]     ^ keySchedule[0];
	            var s1 = M[offset + 1] ^ keySchedule[1];
	            var s2 = M[offset + 2] ^ keySchedule[2];
	            var s3 = M[offset + 3] ^ keySchedule[3];

	            // Key schedule row counter
	            var ksRow = 4;

	            // Rounds
	            for (var round = 1; round < nRounds; round++) {
	                // Shift rows, sub bytes, mix columns, add round key
	                var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
	                var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
	                var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
	                var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

	                // Update state
	                s0 = t0;
	                s1 = t1;
	                s2 = t2;
	                s3 = t3;
	            }

	            // Shift rows, sub bytes, add round key
	            var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
	            var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
	            var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
	            var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

	            // Set output
	            M[offset]     = t0;
	            M[offset + 1] = t1;
	            M[offset + 2] = t2;
	            M[offset + 3] = t3;
	        },

	        keySize: 256/32
	    });

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
	     */
	    C.AES = BlockCipher._createHelper(AES);
	}());


	return CryptoJS.AES;

}));

/* ==== crypto-js 4.1.1 (minimal inline for NCM) ==== */

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory();
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define([], factory);
	}
	else {
		// Global (browser)
		root.CryptoJS = factory();
	}
}(this, function () {

	/*globals window, global, require*/

	/**
	 * CryptoJS core components.
	 */
	var CryptoJS = CryptoJS || (function (Math, undefined) {

	    var crypto;

	    // Native crypto from window (Browser)
	    if (typeof window !== 'undefined' && window.crypto) {
	        crypto = window.crypto;
	    }

	    // Native crypto in web worker (Browser)
	    if (typeof self !== 'undefined' && self.crypto) {
	        crypto = self.crypto;
	    }

	    // Native crypto from worker
	    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
	        crypto = globalThis.crypto;
	    }

	    // Native (experimental IE 11) crypto from window (Browser)
	    if (!crypto && typeof window !== 'undefined' && window.msCrypto) {
	        crypto = window.msCrypto;
	    }

	    // Native crypto from global (NodeJS)
	    if (!crypto && typeof global !== 'undefined' && global.crypto) {
	        crypto = global.crypto;
	    }

	    // Native crypto import via require (NodeJS)
	    if (!crypto && typeof require === 'function') {
	        try {
	            crypto = require('crypto');
	        } catch (err) {}
	    }

	    /*
	     * Cryptographically secure pseudorandom number generator
	     *
	     * As Math.random() is cryptographically not safe to use
	     */
	    var cryptoSecureRandomInt = function () {
	        if (crypto) {
	            // Use getRandomValues method (Browser)
	            if (typeof crypto.getRandomValues === 'function') {
	                try {
	                    return crypto.getRandomValues(new Uint32Array(1))[0];
	                } catch (err) {}
	            }

	            // Use randomBytes method (NodeJS)
	            if (typeof crypto.randomBytes === 'function') {
	                try {
	                    return crypto.randomBytes(4).readInt32LE();
	                } catch (err) {}
	            }
	        }

	        throw new Error('Native crypto module could not be used to get secure random number.');
	    };

	    /*
	     * Local polyfill of Object.create

	     */
	    var create = Object.create || (function () {
	        function F() {}

	        return function (obj) {
	            var subtype;

	            F.prototype = obj;

	            subtype = new F();

	            F.prototype = null;

	            return subtype;
	        };
	    }());

	    /**
	     * CryptoJS namespace.
	     */
	    var C = {};

	    /**
	     * Library namespace.
	     */
	    var C_lib = C.lib = {};

	    /**
	     * Base object for prototypal inheritance.
	     */
	    var Base = C_lib.Base = (function () {


	        return {
	            /**
	             * Creates a new object that inherits from this object.
	             *
	             * @param {Object} overrides Properties to copy into the new object.
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         field: 'value',
	             *
	             *         method: function () {
	             *         }
	             *     });
	             */
	            extend: function (overrides) {
	                // Spawn
	                var subtype = create(this);

	                // Augment
	                if (overrides) {
	                    subtype.mixIn(overrides);
	                }

	                // Create default initializer
	                if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
	                    subtype.init = function () {
	                        subtype.$super.init.apply(this, arguments);
	                    };
	                }

	                // Initializer's prototype is the subtype object
	                subtype.init.prototype = subtype;

	                // Reference supertype
	                subtype.$super = this;

	                return subtype;
	            },

	            /**
	             * Extends this object and runs the init method.
	             * Arguments to create() will be passed to init().
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var instance = MyType.create();
	             */
	            create: function () {
	                var instance = this.extend();
	                instance.init.apply(instance, arguments);

	                return instance;
	            },

	            /**
	             * Initializes a newly created object.
	             * Override this method to add some logic when your objects are created.
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         init: function () {
	             *             // ...
	             *         }
	             *     });
	             */
	            init: function () {
	            },

	            /**
	             * Copies properties into this object.
	             *
	             * @param {Object} properties The properties to mix in.
	             *
	             * @example
	             *
	             *     MyType.mixIn({
	             *         field: 'value'
	             *     });
	             */
	            mixIn: function (properties) {
	                for (var propertyName in properties) {
	                    if (properties.hasOwnProperty(propertyName)) {
	                        this[propertyName] = properties[propertyName];
	                    }
	                }

	                // IE won't copy toString using the loop above
	                if (properties.hasOwnProperty('toString')) {
	                    this.toString = properties.toString;
	                }
	            },

	            /**
	             * Creates a copy of this object.
	             *
	             * @return {Object} The clone.
	             *
	             * @example
	             *
	             *     var clone = instance.clone();
	             */
	            clone: function () {
	                return this.init.prototype.extend(this);
	            }
	        };
	    }());

	    /**
	     * An array of 32-bit words.
	     *
	     * @property {Array} words The array of 32-bit words.
	     * @property {number} sigBytes The number of significant bytes in this word array.
	     */
	    var WordArray = C_lib.WordArray = Base.extend({
	        /**
	         * Initializes a newly created word array.
	         *
	         * @param {Array} words (Optional) An array of 32-bit words.
	         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.create();
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
	         */
	        init: function (words, sigBytes) {
	            words = this.words = words || [];

	            if (sigBytes != undefined) {
	                this.sigBytes = sigBytes;
	            } else {
	                this.sigBytes = words.length * 4;
	            }
	        },

	        /**
	         * Converts this word array to a string.
	         *
	         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
	         *
	         * @return {string} The stringified word array.
	         *
	         * @example
	         *
	         *     var string = wordArray + '';
	         *     var string = wordArray.toString();
	         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
	         */
	        toString: function (encoder) {
	            return (encoder || Hex).stringify(this);
	        },

	        /**
	         * Concatenates a word array to this word array.
	         *
	         * @param {WordArray} wordArray The word array to append.
	         *
	         * @return {WordArray} This word array.
	         *
	         * @example
	         *
	         *     wordArray1.concat(wordArray2);
	         */
	        concat: function (wordArray) {
	            // Shortcuts
	            var thisWords = this.words;
	            var thatWords = wordArray.words;
	            var thisSigBytes = this.sigBytes;
	            var thatSigBytes = wordArray.sigBytes;

	            // Clamp excess bits
	            this.clamp();

	            // Concat
	            if (thisSigBytes % 4) {
	                // Copy one byte at a time
	                for (var i = 0; i < thatSigBytes; i++) {
	                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
	                }
	            } else {
	                // Copy one word at a time
	                for (var j = 0; j < thatSigBytes; j += 4) {
	                    thisWords[(thisSigBytes + j) >>> 2] = thatWords[j >>> 2];
	                }
	            }
	            this.sigBytes += thatSigBytes;

	            // Chainable
	            return this;
	        },

	        /**
	         * Removes insignificant bits.
	         *
	         * @example
	         *
	         *     wordArray.clamp();
	         */
	        clamp: function () {
	            // Shortcuts
	            var words = this.words;
	            var sigBytes = this.sigBytes;

	            // Clamp
	            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
	            words.length = Math.ceil(sigBytes / 4);
	        },

	        /**
	         * Creates a copy of this word array.
	         *
	         * @return {WordArray} The clone.
	         *
	         * @example
	         *
	         *     var clone = wordArray.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone.words = this.words.slice(0);

	            return clone;
	        },

	        /**
	         * Creates a word array filled with random bytes.
	         *
	         * @param {number} nBytes The number of random bytes to generate.
	         *
	         * @return {WordArray} The random word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.random(16);
	         */
	        random: function (nBytes) {
	            var words = [];

	            for (var i = 0; i < nBytes; i += 4) {
	                words.push(cryptoSecureRandomInt());
	            }

	            return new WordArray.init(words, nBytes);
	        }
	    });

	    /**
	     * Encoder namespace.
	     */
	    var C_enc = C.enc = {};

	    /**
	     * Hex encoding strategy.
	     */
	    var Hex = C_enc.Hex = {
	        /**
	         * Converts a word array to a hex string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The hex string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var hexChars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                hexChars.push((bite >>> 4).toString(16));
	                hexChars.push((bite & 0x0f).toString(16));
	            }

	            return hexChars.join('');
	        },

	        /**
	         * Converts a hex string to a word array.
	         *
	         * @param {string} hexStr The hex string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
	         */
	        parse: function (hexStr) {
	            // Shortcut
	            var hexStrLength = hexStr.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < hexStrLength; i += 2) {
	                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
	            }

	            return new WordArray.init(words, hexStrLength / 2);
	        }
	    };

	    /**
	     * Latin1 encoding strategy.
	     */
	    var Latin1 = C_enc.Latin1 = {
	        /**
	         * Converts a word array to a Latin1 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Latin1 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var latin1Chars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                latin1Chars.push(String.fromCharCode(bite));
	            }

	            return latin1Chars.join('');
	        },

	        /**
	         * Converts a Latin1 string to a word array.
	         *
	         * @param {string} latin1Str The Latin1 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
	         */
	        parse: function (latin1Str) {
	            // Shortcut
	            var latin1StrLength = latin1Str.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < latin1StrLength; i++) {
	                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
	            }

	            return new WordArray.init(words, latin1StrLength);
	        }
	    };

	    /**
	     * UTF-8 encoding strategy.
	     */
	    var Utf8 = C_enc.Utf8 = {
	        /**
	         * Converts a word array to a UTF-8 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The UTF-8 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            try {
	                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
	            } catch (e) {
	                throw new Error('Malformed UTF-8 data');
	            }
	        },

	        /**
	         * Converts a UTF-8 string to a word array.
	         *
	         * @param {string} utf8Str The UTF-8 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
	         */
	        parse: function (utf8Str) {
	            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
	        }
	    };

	    /**
	     * Abstract buffered block algorithm template.
	     *
	     * The property blockSize must be implemented in a concrete subtype.
	     *
	     * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
	     */
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
	        /**
	         * Resets this block algorithm's data buffer to its initial state.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm.reset();
	         */
	        reset: function () {
	            // Initial values
	            this._data = new WordArray.init();
	            this._nDataBytes = 0;
	        },

	        /**
	         * Adds new data to this block algorithm's buffer.
	         *
	         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm._append('data');
	         *     bufferedBlockAlgorithm._append(wordArray);
	         */
	        _append: function (data) {
	            // Convert string to WordArray, else assume WordArray already
	            if (typeof data == 'string') {
	                data = Utf8.parse(data);
	            }

	            // Append
	            this._data.concat(data);
	            this._nDataBytes += data.sigBytes;
	        },

	        /**
	         * Processes available data blocks.
	         *
	         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
	         *
	         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
	         *
	         * @return {WordArray} The processed data.
	         *
	         * @example
	         *
	         *     var processedData = bufferedBlockAlgorithm._process();
	         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
	         */
	        _process: function (doFlush) {
	            var processedWords;

	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;
	            var dataSigBytes = data.sigBytes;
	            var blockSize = this.blockSize;
	            var blockSizeBytes = blockSize * 4;

	            // Count blocks ready
	            var nBlocksReady = dataSigBytes / blockSizeBytes;
	            if (doFlush) {
	                // Round up to include partial blocks
	                nBlocksReady = Math.ceil(nBlocksReady);
	            } else {
	                // Round down to include only full blocks,
	                // less the number of blocks that must remain in the buffer
	                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
	            }

	            // Count words ready
	            var nWordsReady = nBlocksReady * blockSize;

	            // Count bytes ready
	            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

	            // Process blocks
	            if (nWordsReady) {
	                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
	                    // Perform concrete-algorithm logic
	                    this._doProcessBlock(dataWords, offset);
	                }

	                // Remove processed words
	                processedWords = dataWords.splice(0, nWordsReady);
	                data.sigBytes -= nBytesReady;
	            }

	            // Return processed words
	            return new WordArray.init(processedWords, nBytesReady);
	        },

	        /**
	         * Creates a copy of this object.
	         *
	         * @return {Object} The clone.
	         *
	         * @example
	         *
	         *     var clone = bufferedBlockAlgorithm.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone._data = this._data.clone();

	            return clone;
	        },

	        _minBufferSize: 0
	    });

	    /**
	     * Abstract hasher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
	     */
	    var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         */
	        cfg: Base.extend(),

	        /**
	         * Initializes a newly created hasher.
	         *
	         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
	         *
	         * @example
	         *
	         *     var hasher = CryptoJS.algo.SHA256.create();
	         */
	        init: function (cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this hasher to its initial state.
	         *
	         * @example
	         *
	         *     hasher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-hasher logic
	            this._doReset();
	        },

	        /**
	         * Updates this hasher with a message.
	         *
	         * @param {WordArray|string} messageUpdate The message to append.
	         *
	         * @return {Hasher} This hasher.
	         *
	         * @example
	         *
	         *     hasher.update('message');
	         *     hasher.update(wordArray);
	         */
	        update: function (messageUpdate) {
	            // Append
	            this._append(messageUpdate);

	            // Update the hash
	            this._process();

	            // Chainable
	            return this;
	        },

	        /**
	         * Finalizes the hash computation.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} messageUpdate (Optional) A final message update.
	         *
	         * @return {WordArray} The hash.
	         *
	         * @example
	         *
	         *     var hash = hasher.finalize();
	         *     var hash = hasher.finalize('message');
	         *     var hash = hasher.finalize(wordArray);
	         */
	        finalize: function (messageUpdate) {
	            // Final message update
	            if (messageUpdate) {
	                this._append(messageUpdate);
	            }

	            // Perform concrete-hasher logic
	            var hash = this._doFinalize();

	            return hash;
	        },

	        blockSize: 512/32,

	        /**
	         * Creates a shortcut function to a hasher's object interface.
	         *
	         * @param {Hasher} hasher The hasher to create a helper for.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
	         */
	        _createHelper: function (hasher) {
	            return function (message, cfg) {
	                return new hasher.init(cfg).finalize(message);
	            };
	        },

	        /**
	         * Creates a shortcut function to the HMAC's object interface.
	         *
	         * @param {Hasher} hasher The hasher to use in this HMAC helper.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
	         */
	        _createHmacHelper: function (hasher) {
	            return function (message, key) {
	                return new C_algo.HMAC.init(hasher, key).finalize(message);
	            };
	        }
	    });

	    /**
	     * Algorithm namespace.
	     */
	    var C_algo = C.algo = {};

	    return C;
	}(Math));


	return CryptoJS;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.enc.Hex;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var C_enc = C.enc;

	    /**
	     * Base64 encoding strategy.
	     */
	    var Base64 = C_enc.Base64 = {
	        /**
	         * Converts a word array to a Base64 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Base64 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;
	            var map = this._map;

	            // Clamp excess bits
	            wordArray.clamp();

	            // Convert
	            var base64Chars = [];
	            for (var i = 0; i < sigBytes; i += 3) {
	                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
	                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
	                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

	                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

	                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
	                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
	                }
	            }

	            // Add padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                while (base64Chars.length % 4) {
	                    base64Chars.push(paddingChar);
	                }
	            }

	            return base64Chars.join('');
	        },

	        /**
	         * Converts a Base64 string to a word array.
	         *
	         * @param {string} base64Str The Base64 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
	         */
	        parse: function (base64Str) {
	            // Shortcuts
	            var base64StrLength = base64Str.length;
	            var map = this._map;
	            var reverseMap = this._reverseMap;

	            if (!reverseMap) {
	                    reverseMap = this._reverseMap = [];
	                    for (var j = 0; j < map.length; j++) {
	                        reverseMap[map.charCodeAt(j)] = j;
	                    }
	            }

	            // Ignore padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                var paddingIndex = base64Str.indexOf(paddingChar);
	                if (paddingIndex !== -1) {
	                    base64StrLength = paddingIndex;
	                }
	            }

	            // Convert
	            return parseLoop(base64Str, base64StrLength, reverseMap);

	        },

	        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
	    };

	    function parseLoop(base64Str, base64StrLength, reverseMap) {
	      var words = [];
	      var nBytes = 0;
	      for (var i = 0; i < base64StrLength; i++) {
	          if (i % 4) {
	              var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << ((i % 4) * 2);
	              var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> (6 - (i % 4) * 2);
	              var bitsCombined = bits1 | bits2;
	              words[nBytes >>> 2] |= bitsCombined << (24 - (nBytes % 4) * 8);
	              nBytes++;
	          }
	      }
	      return WordArray.create(words, nBytes);
	    }
	}());


	return CryptoJS.enc.Base64;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.enc.Utf8;

}));

;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Check if typed arrays are supported
	    if (typeof ArrayBuffer != 'function') {
	        return;
	    }

	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;

	    // Reference original init
	    var superInit = WordArray.init;

	    // Augment WordArray.init to handle typed arrays
	    var subInit = WordArray.init = function (typedArray) {
	        // Convert buffers to uint8
	        if (typedArray instanceof ArrayBuffer) {
	            typedArray = new Uint8Array(typedArray);
	        }

	        // Convert other array views to uint8
	        if (
	            typedArray instanceof Int8Array ||
	            (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray) ||
	            typedArray instanceof Int16Array ||
	            typedArray instanceof Uint16Array ||
	            typedArray instanceof Int32Array ||
	            typedArray instanceof Uint32Array ||
	            typedArray instanceof Float32Array ||
	            typedArray instanceof Float64Array
	        ) {
	            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
	        }

	        // Handle Uint8Array
	        if (typedArray instanceof Uint8Array) {
	            // Shortcut
	            var typedArrayByteLength = typedArray.byteLength;

	            // Extract bytes
	            var words = [];
	            for (var i = 0; i < typedArrayByteLength; i++) {
	                words[i >>> 2] |= typedArray[i] << (24 - (i % 4) * 8);
	            }

	            // Initialize this word array
	            superInit.call(this, words, typedArrayByteLength);
	        } else {
	            // Else call normal init
	            superInit.apply(this, arguments);
	        }
	    };

	    subInit.prototype = WordArray;
	}());


	return CryptoJS.lib.WordArray;

}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./evpkdf"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./evpkdf"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Cipher core components.
	 */
	CryptoJS.lib.Cipher || (function (undefined) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var WordArray = C_lib.WordArray;
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
	    var C_enc = C.enc;
	    var Utf8 = C_enc.Utf8;
	    var Base64 = C_enc.Base64;
	    var C_algo = C.algo;
	    var EvpKDF = C_algo.EvpKDF;

	    /**
	     * Abstract base cipher template.
	     *
	     * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
	     * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
	     * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
	     * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
	     */
	    var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {WordArray} iv The IV to use for this operation.
	         */
	        cfg: Base.extend(),

	        /**
	         * Creates this cipher in encryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createEncryptor: function (key, cfg) {
	            return this.create(this._ENC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Creates this cipher in decryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createDecryptor: function (key, cfg) {
	            return this.create(this._DEC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Initializes a newly created cipher.
	         *
	         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
	         */
	        init: function (xformMode, key, cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Store transform mode and key
	            this._xformMode = xformMode;
	            this._key = key;

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this cipher to its initial state.
	         *
	         * @example
	         *
	         *     cipher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-cipher logic
	            this._doReset();
	        },

	        /**
	         * Adds data to be encrypted or decrypted.
	         *
	         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.process('data');
	         *     var encrypted = cipher.process(wordArray);
	         */
	        process: function (dataUpdate) {
	            // Append
	            this._append(dataUpdate);

	            // Process available blocks
	            return this._process();
	        },

	        /**
	         * Finalizes the encryption or decryption process.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after final processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.finalize();
	         *     var encrypted = cipher.finalize('data');
	         *     var encrypted = cipher.finalize(wordArray);
	         */
	        finalize: function (dataUpdate) {
	            // Final data update
	            if (dataUpdate) {
	                this._append(dataUpdate);
	            }

	            // Perform concrete-cipher logic
	            var finalProcessedData = this._doFinalize();

	            return finalProcessedData;
	        },

	        keySize: 128/32,

	        ivSize: 128/32,

	        _ENC_XFORM_MODE: 1,

	        _DEC_XFORM_MODE: 2,

	        /**
	         * Creates shortcut functions to a cipher's object interface.
	         *
	         * @param {Cipher} cipher The cipher to create a helper for.
	         *
	         * @return {Object} An object with encrypt and decrypt shortcut functions.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
	         */
	        _createHelper: (function () {
	            function selectCipherStrategy(key) {
	                if (typeof key == 'string') {
	                    return PasswordBasedCipher;
	                } else {
	                    return SerializableCipher;
	                }
	            }

	            return function (cipher) {
	                return {
	                    encrypt: function (message, key, cfg) {
	                        return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
	                    },

	                    decrypt: function (ciphertext, key, cfg) {
	                        return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
	                    }
	                };
	            };
	        }())
	    });

	    /**
	     * Abstract base stream cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
	     */
	    var StreamCipher = C_lib.StreamCipher = Cipher.extend({
	        _doFinalize: function () {
	            // Process partial blocks
	            var finalProcessedBlocks = this._process(!!'flush');

	            return finalProcessedBlocks;
	        },

	        blockSize: 1
	    });

	    /**
	     * Mode namespace.
	     */
	    var C_mode = C.mode = {};

	    /**
	     * Abstract base block cipher mode template.
	     */
	    var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
	        /**
	         * Creates this mode for encryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
	         */
	        createEncryptor: function (cipher, iv) {
	            return this.Encryptor.create(cipher, iv);
	        },

	        /**
	         * Creates this mode for decryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
	         */
	        createDecryptor: function (cipher, iv) {
	            return this.Decryptor.create(cipher, iv);
	        },

	        /**
	         * Initializes a newly created mode.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
	         */
	        init: function (cipher, iv) {
	            this._cipher = cipher;
	            this._iv = iv;
	        }
	    });

	    /**
	     * Cipher Block Chaining mode.
	     */
	    var CBC = C_mode.CBC = (function () {
	        /**
	         * Abstract base CBC mode.
	         */
	        var CBC = BlockCipherMode.extend();

	        /**
	         * CBC encryptor.
	         */
	        CBC.Encryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // XOR and encrypt
	                xorBlock.call(this, words, offset, blockSize);
	                cipher.encryptBlock(words, offset);

	                // Remember this block to use with next block
	                this._prevBlock = words.slice(offset, offset + blockSize);
	            }
	        });

	        /**
	         * CBC decryptor.
	         */
	        CBC.Decryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // Remember this block to use with next block
	                var thisBlock = words.slice(offset, offset + blockSize);

	                // Decrypt and XOR
	                cipher.decryptBlock(words, offset);
	                xorBlock.call(this, words, offset, blockSize);

	                // This block becomes the previous block
	                this._prevBlock = thisBlock;
	            }
	        });

	        function xorBlock(words, offset, blockSize) {
	            var block;

	            // Shortcut
	            var iv = this._iv;

	            // Choose mixing block
	            if (iv) {
	                block = iv;

	                // Remove IV for subsequent blocks
	                this._iv = undefined;
	            } else {
	                block = this._prevBlock;
	            }

	            // XOR blocks
	            for (var i = 0; i < blockSize; i++) {
	                words[offset + i] ^= block[i];
	            }
	        }

	        return CBC;
	    }());

	    /**
	     * Padding namespace.
	     */
	    var C_pad = C.pad = {};

	    /**
	     * PKCS #5/7 padding strategy.
	     */
	    var Pkcs7 = C_pad.Pkcs7 = {
	        /**
	         * Pads data using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to pad.
	         * @param {number} blockSize The multiple that the data should be padded to.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
	         */
	        pad: function (data, blockSize) {
	            // Shortcut
	            var blockSizeBytes = blockSize * 4;

	            // Count padding bytes
	            var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

	            // Create padding word
	            var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

	            // Create padding
	            var paddingWords = [];
	            for (var i = 0; i < nPaddingBytes; i += 4) {
	                paddingWords.push(paddingWord);
	            }
	            var padding = WordArray.create(paddingWords, nPaddingBytes);

	            // Add padding
	            data.concat(padding);
	        },

	        /**
	         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to unpad.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
	         */
	        unpad: function (data) {
	            // Get number of padding bytes from last byte
	            var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

	            // Remove padding
	            data.sigBytes -= nPaddingBytes;
	        }
	    };

	    /**
	     * Abstract base block cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
	     */
	    var BlockCipher = C_lib.BlockCipher = Cipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Mode} mode The block mode to use. Default: CBC
	         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
	         */
	        cfg: Cipher.cfg.extend({
	            mode: CBC,
	            padding: Pkcs7
	        }),

	        reset: function () {
	            var modeCreator;

	            // Reset cipher
	            Cipher.reset.call(this);

	            // Shortcuts
	            var cfg = this.cfg;
	            var iv = cfg.iv;
	            var mode = cfg.mode;

	            // Reset block mode
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                modeCreator = mode.createEncryptor;
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                modeCreator = mode.createDecryptor;
	                // Keep at least one block in the buffer for unpadding
	                this._minBufferSize = 1;
	            }

	            if (this._mode && this._mode.__creator == modeCreator) {
	                this._mode.init(this, iv && iv.words);
	            } else {
	                this._mode = modeCreator.call(mode, this, iv && iv.words);
	                this._mode.__creator = modeCreator;
	            }
	        },

	        _doProcessBlock: function (words, offset) {
	            this._mode.processBlock(words, offset);
	        },

	        _doFinalize: function () {
	            var finalProcessedBlocks;

	            // Shortcut
	            var padding = this.cfg.padding;

	            // Finalize
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                // Pad data
	                padding.pad(this._data, this.blockSize);

	                // Process final blocks
	                finalProcessedBlocks = this._process(!!'flush');
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                // Process final blocks
	                finalProcessedBlocks = this._process(!!'flush');

	                // Unpad data
	                padding.unpad(finalProcessedBlocks);
	            }

	            return finalProcessedBlocks;
	        },

	        blockSize: 128/32
	    });

	    /**
	     * A collection of cipher parameters.
	     *
	     * @property {WordArray} ciphertext The raw ciphertext.
	     * @property {WordArray} key The key to this ciphertext.
	     * @property {WordArray} iv The IV used in the ciphering operation.
	     * @property {WordArray} salt The salt used with a key derivation function.
	     * @property {Cipher} algorithm The cipher algorithm.
	     * @property {Mode} mode The block mode used in the ciphering operation.
	     * @property {Padding} padding The padding scheme used in the ciphering operation.
	     * @property {number} blockSize The block size of the cipher.
	     * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
	     */
	    var CipherParams = C_lib.CipherParams = Base.extend({
	        /**
	         * Initializes a newly created cipher params object.
	         *
	         * @param {Object} cipherParams An object with any of the possible cipher parameters.
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.lib.CipherParams.create({
	         *         ciphertext: ciphertextWordArray,
	         *         key: keyWordArray,
	         *         iv: ivWordArray,
	         *         salt: saltWordArray,
	         *         algorithm: CryptoJS.algo.AES,
	         *         mode: CryptoJS.mode.CBC,
	         *         padding: CryptoJS.pad.PKCS7,
	         *         blockSize: 4,
	         *         formatter: CryptoJS.format.OpenSSL
	         *     });
	         */
	        init: function (cipherParams) {
	            this.mixIn(cipherParams);
	        },

	        /**
	         * Converts this cipher params object to a string.
	         *
	         * @param {Format} formatter (Optional) The formatting strategy to use.
	         *
	         * @return {string} The stringified cipher params.
	         *
	         * @throws Error If neither the formatter nor the default formatter is set.
	         *
	         * @example
	         *
	         *     var string = cipherParams + '';
	         *     var string = cipherParams.toString();
	         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
	         */
	        toString: function (formatter) {
	            return (formatter || this.formatter).stringify(this);
	        }
	    });

	    /**
	     * Format namespace.
	     */
	    var C_format = C.format = {};

	    /**
	     * OpenSSL formatting strategy.
	     */
	    var OpenSSLFormatter = C_format.OpenSSL = {
	        /**
	         * Converts a cipher params object to an OpenSSL-compatible string.
	         *
	         * @param {CipherParams} cipherParams The cipher params object.
	         *
	         * @return {string} The OpenSSL-compatible string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
	         */
	        stringify: function (cipherParams) {
	            var wordArray;

	            // Shortcuts
	            var ciphertext = cipherParams.ciphertext;
	            var salt = cipherParams.salt;

	            // Format
	            if (salt) {
	                wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
	            } else {
	                wordArray = ciphertext;
	            }

	            return wordArray.toString(Base64);
	        },

	        /**
	         * Converts an OpenSSL-compatible string to a cipher params object.
	         *
	         * @param {string} openSSLStr The OpenSSL-compatible string.
	         *
	         * @return {CipherParams} The cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
	         */
	        parse: function (openSSLStr) {
	            var salt;

	            // Parse base64
	            var ciphertext = Base64.parse(openSSLStr);

	            // Shortcut
	            var ciphertextWords = ciphertext.words;

	            // Test for salt
	            if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
	                // Extract salt
	                salt = WordArray.create(ciphertextWords.slice(2, 4));

	                // Remove salt from ciphertext
	                ciphertextWords.splice(0, 4);
	                ciphertext.sigBytes -= 16;
	            }

	            return CipherParams.create({ ciphertext: ciphertext, salt: salt });
	        }
	    };

	    /**
	     * A cipher wrapper that returns ciphertext as a serializable cipher params object.
	     */
	    var SerializableCipher = C_lib.SerializableCipher = Base.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
	         */
	        cfg: Base.extend({
	            format: OpenSSLFormatter
	        }),

	        /**
	         * Encrypts a message.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Encrypt
	            var encryptor = cipher.createEncryptor(key, cfg);
	            var ciphertext = encryptor.finalize(message);

	            // Shortcut
	            var cipherCfg = encryptor.cfg;

	            // Create and return serializable cipher params
	            return CipherParams.create({
	                ciphertext: ciphertext,
	                key: key,
	                iv: cipherCfg.iv,
	                algorithm: cipher,
	                mode: cipherCfg.mode,
	                padding: cipherCfg.padding,
	                blockSize: cipher.blockSize,
	                formatter: cfg.format
	            });
	        },

	        /**
	         * Decrypts serialized ciphertext.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Decrypt
	            var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);

	            return plaintext;
	        },

	        /**
	         * Converts serialized ciphertext to CipherParams,
	         * else assumed CipherParams already and returns ciphertext unchanged.
	         *
	         * @param {CipherParams|string} ciphertext The ciphertext.
	         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
	         *
	         * @return {CipherParams} The unserialized ciphertext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
	         */
	        _parse: function (ciphertext, format) {
	            if (typeof ciphertext == 'string') {
	                return format.parse(ciphertext, this);
	            } else {
	                return ciphertext;
	            }
	        }
	    });

	    /**
	     * Key derivation function namespace.
	     */
	    var C_kdf = C.kdf = {};

	    /**
	     * OpenSSL key derivation function.
	     */
	    var OpenSSLKdf = C_kdf.OpenSSL = {
	        /**
	         * Derives a key and IV from a password.
	         *
	         * @param {string} password The password to derive from.
	         * @param {number} keySize The size in words of the key to generate.
	         * @param {number} ivSize The size in words of the IV to generate.
	         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
	         *
	         * @return {CipherParams} A cipher params object with the key, IV, and salt.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
	         */
	        execute: function (password, keySize, ivSize, salt) {
	            // Generate random salt
	            if (!salt) {
	                salt = WordArray.random(64/8);
	            }

	            // Derive key and IV
	            var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);

	            // Separate key and IV
	            var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
	            key.sigBytes = keySize * 4;

	            // Return params
	            return CipherParams.create({ key: key, iv: iv, salt: salt });
	        }
	    };

	    /**
	     * A serializable cipher wrapper that derives the key from a password,
	     * and returns ciphertext as a serializable cipher params object.
	     */
	    var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
	         */
	        cfg: SerializableCipher.cfg.extend({
	            kdf: OpenSSLKdf
	        }),

	        /**
	         * Encrypts a message using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Encrypt
	            var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);

	            // Mix in derived params
	            ciphertext.mixIn(derivedParams);

	            return ciphertext;
	        },

	        /**
	         * Decrypts serialized ciphertext using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Decrypt
	            var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);

	            return plaintext;
	        }
	    });
	}());


}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Electronic Codebook block mode.
	 */
	CryptoJS.mode.ECB = (function () {
	    var ECB = CryptoJS.lib.BlockCipherMode.extend();

	    ECB.Encryptor = ECB.extend({
	        processBlock: function (words, offset) {
	            this._cipher.encryptBlock(words, offset);
	        }
	    });

	    ECB.Decryptor = ECB.extend({
	        processBlock: function (words, offset) {
	            this._cipher.decryptBlock(words, offset);
	        }
	    });

	    return ECB;
	}());


	return CryptoJS.mode.ECB;

}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.pad.Pkcs7;

}));

;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var BlockCipher = C_lib.BlockCipher;
	    var C_algo = C.algo;

	    // Lookup tables
	    var SBOX = [];
	    var INV_SBOX = [];
	    var SUB_MIX_0 = [];
	    var SUB_MIX_1 = [];
	    var SUB_MIX_2 = [];
	    var SUB_MIX_3 = [];
	    var INV_SUB_MIX_0 = [];
	    var INV_SUB_MIX_1 = [];
	    var INV_SUB_MIX_2 = [];
	    var INV_SUB_MIX_3 = [];

	    // Compute lookup tables
	    (function () {
	        // Compute double table
	        var d = [];
	        for (var i = 0; i < 256; i++) {
	            if (i < 128) {
	                d[i] = i << 1;
	            } else {
	                d[i] = (i << 1) ^ 0x11b;
	            }
	        }

	        // Walk GF(2^8)
	        var x = 0;
	        var xi = 0;
	        for (var i = 0; i < 256; i++) {
	            // Compute sbox
	            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
	            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
	            SBOX[x] = sx;
	            INV_SBOX[sx] = x;

	            // Compute multiplication
	            var x2 = d[x];
	            var x4 = d[x2];
	            var x8 = d[x4];

	            // Compute sub bytes, mix columns tables
	            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
	            SUB_MIX_0[x] = (t << 24) | (t >>> 8);
	            SUB_MIX_1[x] = (t << 16) | (t >>> 16);
	            SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
	            SUB_MIX_3[x] = t;

	            // Compute inv sub bytes, inv mix columns tables
	            var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
	            INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
	            INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
	            INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
	            INV_SUB_MIX_3[sx] = t;

	            // Compute next counter
	            if (!x) {
	                x = xi = 1;
	            } else {
	                x = x2 ^ d[d[d[x8 ^ x2]]];
	                xi ^= d[d[xi]];
	            }
	        }
	    }());

	    // Precomputed Rcon lookup
	    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

	    /**
	     * AES block cipher algorithm.
	     */
	    var AES = C_algo.AES = BlockCipher.extend({
	        _doReset: function () {
	            var t;

	            // Skip reset of nRounds has been set before and key did not change
	            if (this._nRounds && this._keyPriorReset === this._key) {
	                return;
	            }

	            // Shortcuts
	            var key = this._keyPriorReset = this._key;
	            var keyWords = key.words;
	            var keySize = key.sigBytes / 4;

	            // Compute number of rounds
	            var nRounds = this._nRounds = keySize + 6;

	            // Compute number of key schedule rows
	            var ksRows = (nRounds + 1) * 4;

	            // Compute key schedule
	            var keySchedule = this._keySchedule = [];
	            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
	                if (ksRow < keySize) {
	                    keySchedule[ksRow] = keyWords[ksRow];
	                } else {
	                    t = keySchedule[ksRow - 1];

	                    if (!(ksRow % keySize)) {
	                        // Rot word
	                        t = (t << 8) | (t >>> 24);

	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

	                        // Mix Rcon
	                        t ^= RCON[(ksRow / keySize) | 0] << 24;
	                    } else if (keySize > 6 && ksRow % keySize == 4) {
	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
	                    }

	                    keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
	                }
	            }

	            // Compute inv key schedule
	            var invKeySchedule = this._invKeySchedule = [];
	            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
	                var ksRow = ksRows - invKsRow;

	                if (invKsRow % 4) {
	                    var t = keySchedule[ksRow];
	                } else {
	                    var t = keySchedule[ksRow - 4];
	                }

	                if (invKsRow < 4 || ksRow <= 4) {
	                    invKeySchedule[invKsRow] = t;
	                } else {
	                    invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
	                                               INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
	                }
	            }
	        },

	        encryptBlock: function (M, offset) {
	            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
	        },

	        decryptBlock: function (M, offset) {
	            // Swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;

	            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

	            // Inv swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;
	        },

	        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
	            // Shortcut
	            var nRounds = this._nRounds;

	            // Get input, add round key
	            var s0 = M[offset]     ^ keySchedule[0];
	            var s1 = M[offset + 1] ^ keySchedule[1];
	            var s2 = M[offset + 2] ^ keySchedule[2];
	            var s3 = M[offset + 3] ^ keySchedule[3];

	            // Key schedule row counter
	            var ksRow = 4;

	            // Rounds
	            for (var round = 1; round < nRounds; round++) {
	                // Shift rows, sub bytes, mix columns, add round key
	                var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
	                var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
	                var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
	                var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

	                // Update state
	                s0 = t0;
	                s1 = t1;
	                s2 = t2;
	                s3 = t3;
	            }

	            // Shift rows, sub bytes, add round key
	            var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
	            var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
	            var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
	            var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

	            // Set output
	            M[offset]     = t0;
	            M[offset + 1] = t1;
	            M[offset + 2] = t2;
	            M[offset + 3] = t3;
	        },

	        keySize: 256/32
	    });

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
	     */
	    C.AES = BlockCipher._createHelper(AES);
	}());


	return CryptoJS.AES;

}));

window.UnlockCore = (function () {
function ready() {
if (!window.UMCrypto) return Promise.reject(new Error('解密库未加载'));
var p = UMCrypto.ready || UMCrypto.default;
if (typeof p === 'function') {
try { return Promise.resolve(p()); } catch (e) { return Promise.reject(e); }
}
return Promise.resolve();
}
function detectExt(u8) {
try {
var r = UMCrypto.detectAudioType(u8.slice(0, 1024));
var t = r && r.audioType;
if (t && t !== 'bin') return t;
} catch (e) {}
return 'mp3';
}
function bytesHasPrefix(data, prefix) {
  if (prefix.length > data.length) return false;
  for (var i = 0; i < prefix.length; i++) if (data[i] !== prefix[i]) return false;
  return true;
}
function wordToU8(wa) {
  var out = new Uint8Array(wa.sigBytes), words = wa.words;
  for (var i = 0; i < wa.sigBytes; i++) out[i] = (words[i >>> 2] >>> ((3 - (i % 4)) * 8)) & 0xff;
  return out;
}
function sniffExt(data) {
  if (bytesHasPrefix(data, [0x49, 0x44, 0x33])) return 'mp3';
  if (bytesHasPrefix(data, [0x66, 0x4c, 0x61, 0x43])) return 'flac';
  if (bytesHasPrefix(data, [0x4f, 0x67, 0x67, 0x53])) return 'ogg';
  if (data.length >= 8 && bytesHasPrefix(data.slice(4), [0x66, 0x74, 0x79, 0x70])) return 'm4a';
  if (bytesHasPrefix(data, [0x52, 0x49, 0x46, 0x46])) return 'wav';
  return '';
}
function decryptNCM(u8) {
  var CJ = window.CryptoJS;
  if (!CJ) throw new Error('解密库未加载');
  var EncHex = CJ.enc.Hex, EncUtf8 = CJ.enc.Utf8, EncBase64 = CJ.enc.Base64;
  var AES = CJ.AES, WordArray = CJ.lib.WordArray;
  var CORE_KEY = EncHex.parse('687a4852416d736f356b496e62617857');
  var META_KEY = EncHex.parse('2331346C6A6B5F215C5D2630553C2728');
  if (!bytesHasPrefix(u8, [0x43,0x54,0x45,0x4e,0x46,0x44,0x41,0x4d])) throw new Error('此ncm文件已损坏');
  var offset = 10, view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  var keyLen = view.getUint32(offset, true); offset += 4;
  var cipherText = new Uint8Array(u8.subarray(offset, offset + keyLen)).map(function (b) { return b ^ 0x64; }); offset += keyLen;
  var plainKey = AES.decrypt({ ciphertext: WordArray.create(cipherText) }, CORE_KEY, { mode: CJ.mode.ECB, padding: CJ.pad.Pkcs7 });
  var keyData = wordToU8(plainKey).slice(17);
  var box = new Uint8Array(256); for (var i = 0; i < 256; i++) box[i] = i; var j = 0;
  for (var k = 0; k < 256; k++) { j = (box[k] + j + keyData[k % keyData.length]) & 0xff; var t = box[k]; box[k] = box[j]; box[j] = t; }
  var keyBox = new Uint8Array(256);
  for (var m = 0; m < 256; m++) { var mi = (m + 1) & 0xff, si = box[mi], sj = box[(mi + si) & 0xff]; keyBox[m] = box[(si + sj) & 0xff]; }
  var metaLen = view.getUint32(offset, true); offset += 4;
  var oriFormat = '';
  if (metaLen !== 0) {
    var mc = new Uint8Array(u8.subarray(offset, offset + metaLen)).map(function (b) { return b ^ 0x63; });
    var mSt = EncUtf8.stringify(wordToU8(mc.slice(22))).replace(/\s+/g, '');
    while (mSt.length % 4 !== 0) mSt += '=';
    var mp = AES.decrypt(EncBase64.parse(mSt), META_KEY, { mode: CJ.mode.ECB, padding: CJ.pad.Pkcs7 }).toString(EncUtf8);
    var li = mp.indexOf(':'); var obj = {};
    try { obj = JSON.parse(mp.slice(li + 1)); } catch (e) {}
    if (li >= 0 && mp.slice(0, li) === 'dj' && obj.mainMusic) obj = obj.mainMusic;
    oriFormat = (obj && obj.format) || '';
  }
  offset += metaLen;
  var coverLen = view.getUint32(offset + 9, true);
  offset += 13 + coverLen;
  var audioData = new Uint8Array(u8.buffer, u8.byteOffset + offset, u8.byteLength - offset);
  for (var cur = 0; cur < audioData.length; ++cur) audioData[cur] ^= keyBox[cur & 0xff];
  return { data: audioData, ext: oriFormat || sniffExt(audioData), name: '' };
}
/* ==== QMC/KWM/XM 纯JS解密（移植自 unlock-music v1.10.0，替换 wasm 路径） ==== */
function _b64ToBytes(b64) {
  var bin = atob(b64), arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
// ---- TEA cipher (golang.org/x/crypto/tea port) ----
function _TeaCipher(key, rounds) {
  if (key.length !== 16) throw new Error('incorrect key size');
  if (rounds === undefined) rounds = 64;
  if ((rounds & 1) !== 0) throw new Error('odd number of rounds specified');
  var k = new DataView(key.buffer, key.byteOffset, key.byteLength);
  this.k0 = k.getUint32(0, false); this.k1 = k.getUint32(4, false);
  this.k2 = k.getUint32(8, false); this.k3 = k.getUint32(12, false);
  this.rounds = rounds;
}
function _TeaDecrypt(self, dst, src) {
  var v0 = src.getUint32(0, false), v1 = src.getUint32(4, false);
  var sum = (0x9e3779b9 * self.rounds) / 2;
  for (var i = 0; i < self.rounds / 2; i++) {
    v1 -= ((v0 << 4) + self.k2) ^ (v0 + sum) ^ ((v0 >>> 5) + self.k3);
    v0 -= ((v1 << 4) + self.k0) ^ (v1 + sum) ^ ((v1 >>> 5) + self.k1);
    sum -= 0x9e3779b9;
  }
  dst.setUint32(0, v0, false); dst.setUint32(4, v1, false);
}
// ---- QMC key derivation ----
function _qmcSimpleMakeKey(salt, length) {
  var keyBuf = [];
  for (var i = 0; i < length; i++) {
    var tmp = Math.tan(salt + i * 0.1);
    keyBuf[i] = 0xff & (Math.abs(tmp) * 100.0);
  }
  return keyBuf;
}
function _qmcDecryptTencentTea(inBuf, key) {
  if (inBuf.length % 8 !== 0) throw new Error('inBuf size not a multiple of the block size');
  if (inBuf.length < 16) throw new Error('inBuf size too small');
  var blk = new _TeaCipher(key, 32);
  var tmpBuf = new Uint8Array(8), tmpView = new DataView(tmpBuf.buffer);
  _TeaDecrypt(blk, tmpView, new DataView(inBuf.buffer, inBuf.byteOffset, 8));
  var nPadLen = tmpBuf[0] & 0x7;
  var outLen = inBuf.length - 1 - nPadLen - 2 - 7;
  var outBuf = new Uint8Array(outLen);
  var ivPrev = new Uint8Array(8), ivCur = inBuf.slice(0, 8), inBufPos = 8;
  var tmpIdx = 1 + nPadLen;
  var cryptBlock = function () {
    ivPrev = ivCur;
    ivCur = inBuf.slice(inBufPos, inBufPos + 8);
    for (var q = 0; q < 8; q++) tmpBuf[q] ^= ivCur[q];
    _TeaDecrypt(blk, tmpView, tmpView);
    inBufPos += 8; tmpIdx = 0;
  };
  for (var i = 1; i <= 2;) { if (tmpIdx < 8) { tmpIdx++; i++; } else cryptBlock(); }
  var outBufPos = 0;
  while (outBufPos < outLen) {
    if (tmpIdx < 8) { outBuf[outBufPos] = tmpBuf[tmpIdx] ^ ivPrev[tmpIdx]; outBufPos++; tmpIdx++; }
    else cryptBlock();
  }
  for (i = 1; i <= 7; i++) { if (tmpBuf[tmpIdx] !== ivPrev[tmpIdx]) throw new Error('zero check failed'); }
  return outBuf;
}
function _qmcDeriveKey(raw) {
  var textDec = new TextDecoder();
  var rawDec = _b64ToBytes(textDec.decode(raw));
  var n = rawDec.length;
  if (n < 16) throw new Error('key length is too short');
  var simpleKey = _qmcSimpleMakeKey(106, 8);
  var teaKey = new Uint8Array(16);
  for (var i = 0; i < 8; i++) { teaKey[i << 1] = simpleKey[i]; teaKey[(i << 1) + 1] = rawDec[i]; }
  var sub = _qmcDecryptTencentTea(rawDec.subarray(8), teaKey);
  rawDec.set(sub, 8);
  return rawDec.subarray(0, 8 + sub.length);
}
// ---- QMC ciphers ----
var _QMC_STATIC_BOX = new Uint8Array([0x77,0x48,0x32,0x73,0xDE,0xF2,0xC0,0xC8,0x95,0xEC,0x30,0xB2,0x51,0xC3,0xE1,0xA0,0x9E,0xE6,0x9D,0xCF,0xFA,0x7F,0x14,0xD1,0xCE,0xB8,0xDC,0xC3,0x4A,0x67,0x93,0xD6,0x28,0xC2,0x91,0x70,0xCA,0x8D,0xA2,0xA4,0xF0,0x08,0x61,0x90,0x7E,0x6F,0xA2,0xE0,0xEB,0xAE,0x3E,0xB6,0x67,0xC7,0x92,0xF4,0x91,0xB5,0xF6,0x6C,0x5E,0x84,0x40,0xF7,0xF3,0x1B,0x02,0x7F,0xD5,0xAB,0x41,0x89,0x28,0xF4,0x25,0xCC,0x52,0x11,0xAD,0x43,0x68,0xA6,0x41,0x8B,0x84,0xB5,0xFF,0x2C,0x92,0x4A,0x26,0xD8,0x47,0x6A,0x7C,0x95,0x61,0xCC,0xE6,0xCB,0xBB,0x3F,0x47,0x58,0x89,0x75,0xC3,0x75,0xA1,0xD9,0xAF,0xCC,0x08,0x73,0x17,0xDC,0xAA,0x9A,0xA2,0x16,0x41,0xD8,0xA2,0x06,0xC6,0x8B,0xFC,0x66,0x34,0x9F,0xCF,0x18,0x23,0xA0,0x0A,0x74,0xE7,0x2B,0x27,0x70,0x92,0xE9,0xAF,0x37,0xE6,0x8C,0xA7,0xBC,0x62,0x65,0x9C,0xC2,0x08,0xC9,0x88,0xB3,0xF3,0x43,0xAC,0x74,0x2C,0x0F,0xD4,0xAF,0xA1,0xC3,0x01,0x64,0x95,0x4E,0x48,0x9F,0xF4,0x35,0x78,0x95,0x7A,0x39,0xD6,0x6A,0xA0,0x6D,0x40,0xE8,0x4F,0xA8,0xEF,0x11,0x1D,0xF3,0x1B,0x3F,0x3F,0x07,0xDD,0x6F,0x5B,0x19,0x30,0x19,0xFB,0xEF,0x0E,0x37,0xF0,0x0E,0xCD,0x16,0x49,0xFE,0x53,0x47,0x13,0x1A,0xBD,0xA4,0xF1,0x40,0x19,0x60,0x0E,0xED,0x68,0x09,0x06,0x5F,0x4D,0xCF,0x3D,0x1A,0xFE,0x20,0x77,0xE4,0xD9,0xDA,0xF9,0xA4,0x2B,0x76,0x1C,0x71,0xDB,0x00,0xBC,0xFD,0x0C,0x6C,0xA5,0x47,0xF7,0xF6,0x00,0x79,0x4A,0x11]);
function _QmcStaticCipher() {}
_QmcStaticCipher.prototype.getMask = function (offset) {
  if (offset > 0x7fff) offset %= 0x7fff;
  return _QMC_STATIC_BOX[(offset * offset + 27) & 0xff];
};
_QmcStaticCipher.prototype.decrypt = function (buf, offset) {
  for (var i = 0; i < buf.length; i++) buf[i] ^= this.getMask(offset + i);
};
function _QmcMapCipher(key) {
  if (key.length === 0) throw new Error('qmc/cipher_map: invalid key size');
  this.key = key; this.n = key.length;
}
_QmcMapCipher.prototype._rotate = function (value, bits) {
  var rotate = (bits + 4) % 8, left = value << rotate, right = value >> rotate;
  return (left | right) & 0xff;
};
_QmcMapCipher.prototype.getMask = function (offset) {
  if (offset > 0x7fff) offset %= 0x7fff;
  var idx = (offset * offset + 71214) % this.n;
  return this._rotate(this.key[idx], idx & 0x7);
};
_QmcMapCipher.prototype.decrypt = function (buf, offset) {
  for (var i = 0; i < buf.length; i++) buf[i] ^= this.getMask(offset + i);
};
function _QmcRC4Cipher(key) {
  if (key.length === 0) throw new Error('invalid key size');
  this.key = key; this.N = key.length;
  this.S = new Uint8Array(this.N);
  for (var i = 0; i < this.N; ++i) this.S[i] = i & 0xff;
  var j = 0;
  for (i = 0; i < this.N; ++i) {
    j = (this.S[i] + j + this.key[i % this.N]) % this.N;
    var t = this.S[i]; this.S[i] = this.S[j]; this.S[j] = t;
  }
  this.hash = 1;
  for (i = 0; i < this.N; i++) {
    var value = this.key[i];
    if (!value) continue;
    var next_hash = (this.hash * value) >>> 0;
    if (next_hash === 0 || next_hash <= this.hash) break;
    this.hash = next_hash;
  }
}
_QmcRC4Cipher.prototype._segKey = function (id) {
  var seed = this.key[id % this.N];
  var idx = Math.floor((this.hash / ((id + 1) * seed)) * 100.0);
  return idx % this.N;
};
_QmcRC4Cipher.prototype.decrypt = function (buf, offset) {
  var FIRST = 0x80, SEG = 5120;
  var toProcess = buf.length, processed = 0;
  var post = function (len) { toProcess -= len; processed += len; offset += len; return toProcess === 0; };
  if (offset < FIRST) {
    var l0 = Math.min(buf.length, FIRST - offset);
    var kb = this.key, self = this;
    for (var a = 0; a < l0; a++) buf[a] ^= kb[self._segKey(offset + a)];
    if (post(l0)) return;
  }
  if (offset % SEG !== 0) {
    var l1 = Math.min(SEG - (offset % SEG), toProcess);
    this._seg(buf.subarray(processed, processed + l1), offset);
    if (post(l1)) return;
  }
  while (toProcess > SEG) { this._seg(buf.subarray(processed, processed + SEG), offset); post(SEG); }
  if (toProcess > 0) this._seg(buf.subarray(processed), offset);
};
_QmcRC4Cipher.prototype._seg = function (buf, offset) {
  var S = this.S.slice(0), N = this.N;
  var skipLen = (offset % 5120) + this._segKey(Math.floor(offset / 5120));
  var j = 0, k = 0;
  for (var i = -skipLen; i < buf.length; i++) {
    j = (j + 1) % N; k = (S[j] + k) % N;
    var t = S[k]; S[k] = S[j]; S[j] = t;
    if (i >= 0) buf[i] ^= S[(S[j] + S[k]) % N];
  }
};
// ---- QMC decoder ----
function _qmcDecoder(u8) {
  var file = u8, size = u8.length, cipher = null, audioSize = 0;
  var textDec = new TextDecoder();
  var last4 = file.slice(-4);
  if (textDec.decode(last4) === 'QTag') {
    var sizeBuf = file.slice(-8, -4);
    var sizeView = new DataView(sizeBuf.buffer, sizeBuf.byteOffset);
    var keySize = sizeView.getUint32(0, false);
    audioSize = size - keySize - 8;
    var rawKey = file.subarray(audioSize, size - 8);
    var keyEnd = _findComma(rawKey);
    if (keyEnd < 0) throw new Error('invalid key: search raw key failed');
    cipher = _qmcSetCipher(rawKey.subarray(0, keyEnd));
  } else {
    var dv = new DataView(last4.buffer, last4.byteOffset);
    var ks = dv.getUint32(0, true);
    if (ks < 0x300) {
      audioSize = size - ks - 4;
      var rk = file.subarray(audioSize, size - 4);
      cipher = _qmcSetCipher(rk);
    } else {
      audioSize = size;
      cipher = new _QmcStaticCipher();
    }
  }
  if (!cipher || !audioSize) throw new Error('no cipher found');
  var audioBuf = file.subarray(0, audioSize);
  cipher.decrypt(audioBuf, 0);
  return audioBuf;
}
function _findComma(arr) {
  for (var i = 0; i < arr.length; i++) if (arr[i] === 44) return i;
  return -1;
}
function _qmcSetCipher(keyRaw) {
  var keyDec = _qmcDeriveKey(keyRaw);
  if (keyDec.length > 300) return new _QmcRC4Cipher(keyDec);
  return new _QmcMapCipher(keyDec);
}
function decryptQMC1(u8) {
  var data = _qmcDecoder(u8);
  return { data: data, ext: sniffExt(data) || 'mp3', name: '' };
}
function decryptQMC2(u8) {
  var data = _qmcDecoder(u8);
  return { data: data, ext: sniffExt(data) || 'ogg', name: '' };
}
// ---- KWM (酷我) ----
var _KWM_MAGIC = [0x79,0x65,0x65,0x6C,0x69,0x6F,0x6E,0x2D,0x6B,0x75,0x77,0x6F,0x2D,0x74,0x6D,0x65];
var _KWM_KEY = 'MoOtOiTvINGwd2E6n0E1i7L5t2IoOoNk';
function _kwmTrimKey(k) { if (k.length > 32) return k.slice(0, 32); if (k.length < 32) return k.padEnd(32, k); return k; }
function _kwmCreateMask(keyBytes) {
  var kv = new DataView(keyBytes.buffer, keyBytes.byteOffset, keyBytes.byteLength);
  var keyStr = kv.getBigUint64(0, true).toString();
  var keyStrTrim = _kwmTrimKey(keyStr);
  var key = new Uint8Array(32);
  for (var i = 0; i < 32; i++) key[i] = _KWM_KEY.charCodeAt(i) ^ keyStrTrim.charCodeAt(i);
  return key;
}
function decryptKWM(u8) {
  if (!bytesHasPrefix(u8, _KWM_MAGIC)) throw new Error('not a valid kwm file');
  var fileKey = u8.slice(0x18, 0x20);
  var mask = _kwmCreateMask(fileKey);
  var audioData = u8.slice(0x400);
  for (var cur = 0; cur < audioData.length; ++cur) audioData[cur] ^= mask[cur % 0x20];
  return { data: audioData, ext: sniffExt(audioData) || 'mp3', name: '' };
}
// ---- XM (虾米) ----
var _XM_FILE_TYPE = { ' WAV': 'wav', FLAC: 'flac', ' MP3': 'mp3', ' A4M': 'm4a' };
function decryptXM(u8) {
  if (!bytesHasPrefix(u8, [0x69,0x66,0x6d,0x74]) || !bytesHasPrefix(u8.slice(8, 12), [0xfe,0xfe,0xfe,0xfe])) throw new Error('此xm文件已损坏');
  var typeText = new TextDecoder().decode(u8.slice(4, 8));
  var ext = _XM_FILE_TYPE[typeText];
  if (!ext) throw new Error('未知的.xm文件类型');
  var key = u8[0xf];
  var dataOffset = u8[0xc] | (u8[0xd] << 8) | (u8[0xe] << 16);
  var audioData = u8.slice(0x10);
  for (var cur = dataOffset; cur < audioData.length; ++cur) audioData[cur] = (audioData[cur] - key) ^ 0xff;
  return { data: audioData, ext: ext, name: '' };
}
/* ==== END QMC/KWM/XM 纯JS ==== */

function _kgmMaskUrl() {
  var base = 'js/';
  try { if (document.currentScript && document.currentScript.src) base = document.currentScript.src.replace(/[^/]*$/, ''); } catch (e) {}
  return base + 'kgm.mask';
}
var KGM_MASK_PREDEF = [ 0xb8, 0xd5, 0x3d, 0xb2, 0xe9, 0xaf, 0x78, 0x8c, 0x83, 0x33, 0x71, 0x51, 0x76, 0xa0, 0xcd, 0x37, 0x2f, 0x3e, 0x35, 0x8d, 0xa9, 0xbe, 0x98, 0xb7, 0xe7, 0x8c, 0x22, 0xce, 0x5a, 0x61, 0xdf, 0x68, 0x69, 0x89, 0xfe, 0xa5, 0xb6, 0xde, 0xa9, 0x77, 0xfc, 0xc8, 0xbd, 0xbd, 0xe5, 0x6d, 0x3e, 0x5a, 0x36, 0xef, 0x69, 0x4e, 0xbe, 0xe1, 0xe9, 0x66, 0x1c, 0xf3, 0xd9, 0x02, 0xb6, 0xf2, 0x12, 0x9b, 0x44, 0xd0, 0x6f, 0xb9, 0x35, 0x89, 0xb6, 0x46, 0x6d, 0x73, 0x82, 0x06, 0x69, 0xc1, 0xed, 0xd7, 0x85, 0xc2, 0x30, 0xdf, 0xa2, 0x62, 0xbe, 0x79, 0x2d, 0x62, 0x62, 0x3d, 0x0d, 0x7e, 0xbe, 0x48, 0x89, 0x23, 0x02, 0xa0, 0xe4, 0xd5, 0x75, 0x51, 0x32, 0x02, 0x53, 0xfd, 0x16, 0x3a, 0x21, 0x3b, 0x16, 0x0f, 0xc3, 0xb2, 0xbb, 0xb3, 0xe2, 0xba, 0x3a, 0x3d, 0x13, 0xec, 0xf6, 0x01, 0x45, 0x84, 0xa5, 0x70, 0x0f, 0x93, 0x49, 0x0c, 0x64, 0xcd, 0x31, 0xd5, 0xcc, 0x4c, 0x07, 0x01, 0x9e, 0x00, 0x1a, 0x23, 0x90, 0xbf, 0x88, 0x1e, 0x3b, 0xab, 0xa6, 0x3e, 0xc4, 0x73, 0x47, 0x10, 0x7e, 0x3b, 0x5e, 0xbc, 0xe3, 0x00, 0x84, 0xff, 0x09, 0xd4, 0xe0, 0x89, 0x0f, 0x5b, 0x58, 0x70, 0x4f, 0xfb, 0x65, 0xd8, 0x5c, 0x53, 0x1b, 0xd3, 0xc8, 0xc6, 0xbf, 0xef, 0x98, 0xb0, 0x50, 0x4f, 0x0f, 0xea, 0xe5, 0x83, 0x58, 0x8c, 0x28, 0x2c, 0x84, 0x67, 0xcd, 0xd0, 0x9e, 0x47, 0xdb, 0x27, 0x50, 0xca, 0xf4, 0x63, 0x63, 0xe8, 0x97, 0x7f, 0x1b, 0x4b, 0x0c, 0xc2, 0xc1, 0x21, 0x4c, 0xcc, 0x58, 0xf5, 0x94, 0x52, 0xa3, 0xf3, 0xd3, 0xe0, 0x68, 0xf4, 0x00, 0x23, 0xf3, 0x5e, 0x0a, 0x7b, 0x93, 0xdd, 0xab, 0x12, 0xb2, 0x13, 0xe8, 0x84, 0xd7, 0xa7, 0x9f, 0x0f, 0x32, 0x4c, 0x55, 0x1d, 0x04, 0x36, 0x52, 0xdc, 0x03, 0xf3, 0xf9, 0x4e, 0x42, 0xe9, 0x3d, 0x61, 0xef, 0x7c, 0xb6, 0xb3, 0x93, 0x50, ];
var KGM_MASK = null;
var KGM_MASK_PROMISE = null;
var KGM_VPR_DIFF = [0x25,0xDF,0xE8,0xA6,0x75,0x1E,0x75,0x0E,0x2F,0x80,0xF3,0x2D,0xB8,0xB6,0xE3,0x11,0x00];
function loadKgmMask() {
  if (KGM_MASK) return Promise.resolve(KGM_MASK);
  if (KGM_MASK_PROMISE) return KGM_MASK_PROMISE;
  KGM_MASK_PROMISE = fetch(_kgmMaskUrl()).then(function (resp) {
    if (!resp.ok) throw new Error('KGM mask 加载失败');
    return resp.arrayBuffer();
  }).then(function (buf) {
    KGM_MASK = new Uint8Array(buf);
    return KGM_MASK;
  });
  return KGM_MASK_PROMISE;
}
function _kgmMask(pos, mask) { return KGM_MASK_PREDEF[pos % 272] ^ mask[pos >> 4]; }
function _kgmDecryptData(u8, isVpr) {
  var view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  var headerLen = view.getUint32(0x10, true);
  var audioData = u8.slice(headerLen);
  var key1 = new Uint8Array(17);
  key1.set(u8.slice(0x1c, 0x2c), 0);
  var n = audioData.length;
  for (var i = 0; i < n; i++) {
    var med8 = key1[i % 17] ^ audioData[i];
    med8 ^= (med8 & 0xf) << 4;
    var msk8 = _kgmMask(i, KGM_MASK);
    msk8 ^= (msk8 & 0xf) << 4;
    audioData[i] = med8 ^ msk8;
  }
  if (isVpr) { for (var j = 0; j < n; j++) audioData[j] ^= KGM_VPR_DIFF[j % 17]; }
  return audioData;
}
function decryptKGM(u8) {
  var isVpr = bytesHasPrefix(u8, [0x05,0x28,0xBC,0x96,0xE9,0xE4,0x5A,0x43,0x91,0xAA,0xBD,0xD0,0x7A,0xF5,0x36,0x31]);
  if (!isVpr && !bytesHasPrefix(u8, [0x7C,0xD5,0x32,0xEB,0x86,0x02,0x7F,0x4B,0xA8,0xAF,0xA6,0x8E,0x0F,0xFF,0x99,0x14])) throw new Error('不是有效的 KGM 文件');
  return loadKgmMask().then(function () {
    var data = _kgmDecryptData(u8, isVpr);
    var ext = sniffExt(data) || 'mp3';
    return { data: data, ext: ext, name: '' };
  });
}


function decryptMG3D(u8) {
var mg = UMCrypto.Migu3D.fromHeader(u8.slice(0, 0x100));
mg.decrypt(u8, 0);
return { data: u8, ext: detectExt(u8), name: '' };
}
var EXT_MAP = {
ncm: decryptNCM,
qmc0: decryptQMC1, qmc3: decryptQMC1, qmcflac: decryptQMC1, qmcogg: decryptQMC1,
qmc: decryptQMC2, mflac: decryptQMC2, mgg: decryptQMC2, mflac0: decryptQMC2, mgg1: decryptQMC2,
kgm: decryptKGM, vpr: decryptKGM, kgma: decryptKGM,
kwm: decryptKWM,
xm: decryptXM,
mg3d: decryptMG3D
};
function decryptFile(arrayBuffer, filename) {
return ready().then(function () {
var ext = (filename.split('.').pop() || '').toLowerCase();
var fn = EXT_MAP[ext];
if (!fn) return Promise.reject(new Error('暂不支持的格式: .' + ext));
var u8 = new Uint8Array(arrayBuffer);
try {
var res = fn(u8);
return res;
} catch (e) {
return Promise.reject(e);
}
});
}
return { decryptFile: decryptFile, detectExt: detectExt };
})();
;
(function () {
var area = document.getElementById('unlock-drop');
var input = document.getElementById('unlock-file');
var list = document.getElementById('unlock-results');
var btn = document.getElementById('unlock-btn');
if (!area || !input) return;
function esc3(s) {
if (!s) return '';
return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function handleFiles(files) {
Array.prototype.forEach.call(files, function (file) {
var item = document.createElement('div');
item.className = 'ul-item';
list.appendChild(item);
var isKgm = /\.kgm[a]?$/i.test(file.name);
function bindItem(url, displayName, base, blobOrFile, isKgm) {
item.querySelector('[data-url]').addEventListener('click', function () {
if (typeof audio !== 'undefined' && audio) {
audio.src = this.dataset.url;
audio.play().catch(function () {});
if (typeof isPlaying !== 'undefined') isPlaying = true;
if (typeof playIcon !== 'undefined') playIcon.className = 'fas fa-pause';
if (typeof trackNameSpan !== 'undefined') trackNameSpan.textContent = displayName;
}
});
item.querySelector('[data-add]').addEventListener('click', function () {
try {
if (typeof addUploadedFile === 'function') {
addUploadedFile(blobOrFile, base, isKgm ? '解锁音乐' : '上传音乐').then(function () {
if (typeof playlist !== 'undefined' && typeof updateList === 'function') {
playlist.push({ name: base, artist: isKgm ? '解锁音乐' : '上传音乐', path: URL.createObjectURL(blobOrFile), uploaded: true });
updateList();
}
if (typeof showMsg === 'function') showMsg('已加入歌单喵～');
});
} else if (typeof showMsg === 'function') {
showMsg('加入失败喵～');
}
} catch (e) {
if (typeof showMsg === 'function') showMsg('加入失败喵～');
}
});
}
if (isKgm) {
/* ===== KGM 加密文件：解密后播放 ===== */
item.innerHTML = '<div class="ul-info"><div class="ul-name">' + esc3(file.name) + '</div><div class="ul-status">解密中…</div></div>';
var reader = new FileReader();
reader.onload = function (e) {
UnlockCore.decryptFile(e.target.result, file.name).then(function (res) {
var base = file.name.replace(/\.[^.]+$/, '');
var outName = base + '.' + res.ext;
var blob = new Blob([res.data], { type: 'audio/' + res.ext });
var url = URL.createObjectURL(blob);
item.className = 'ul-item done';
item.innerHTML = '<div class="ul-info"><div class="ul-name"> ' + esc3(outName) + '</div><div class="ul-status">' + (res.data.length / 1024 / 1024).toFixed(1) + ' MB</div></div>' +
'<div class="ul-actions">' +
'<button class="ul-btn" data-url="' + url + '" title="播放"><i class="fas fa-play"></i></button>' +
'<button class="ul-btn" data-add="1" data-name="' + esc3(base) + '" title="加入歌单"><i class="fas fa-heart"></i></button>' +
'<a class="ul-btn" href="' + url + '" download="' + esc3(outName) + '" title="下载"><i class="fas fa-download"></i></a>' +
'</div>';
bindItem(url, outName, base, new File([res.data], outName, { type: 'audio/' + res.ext }), true);
}).catch(function (err) {
item.className = 'ul-item err';
item.innerHTML = '<div class="ul-info"><div class="ul-name"> ' + esc3(file.name) + '</div><div class="ul-status">' + esc3(err.message || '解密失败') + '</div></div>';
});
};
reader.onerror = function () {
item.className = 'ul-item err';
item.querySelector('.ul-status').textContent = '读取失败';
};
reader.readAsArrayBuffer(file);
} else {
/* ===== 普通音频文件（mp3/flac/wav/ogg/m4a…）直接播放 ===== */
var base = file.name.replace(/\.[^.]+$/, '');
var url = URL.createObjectURL(file);
item.className = 'ul-item done';
item.innerHTML = '<div class="ul-info"><div class="ul-name"> ' + esc3(file.name) + '</div><div class="ul-status">' + (file.size / 1024 / 1024).toFixed(1) + ' MB</div></div>' +
'<div class="ul-actions">' +
'<button class="ul-btn" data-url="' + url + '" title="播放"><i class="fas fa-play"></i></button>' +
'<button class="ul-btn" data-add="1" data-name="' + esc3(base) + '" title="加入歌单"><i class="fas fa-heart"></i></button>' +
'<a class="ul-btn" href="' + url + '" download="' + esc3(file.name) + '" title="下载"><i class="fas fa-download"></i></a>' +
'</div>';
bindItem(url, file.name, base, file, false);
}
});
}
if (btn) btn.addEventListener('click', function () { input.click(); });
input.addEventListener('change', function () { handleFiles(input.files); input.value = ''; });
['dragover', 'drop'].forEach(function (ev) {
area.addEventListener(ev, function (e) {
e.preventDefault();
if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
area.classList.toggle('over', ev === 'dragover');
});
});
})();
;
(function () {
var PO_API = 'https://api.qijieya.cn/meting/';
var PO_BACKUP = 'https://musicapi.qijieya.cn/meting/';
function esc4(s) {
if (!s) return '';
return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt4(t) {
if (!t) return '0:00';
var m = Math.floor(t / 60), s = Math.round(t % 60);
return m + ':' + (s < 10 ? '0' + s : s);
}
function norm4(s) {
return {
name: s.name || s.title || '未知歌曲',
artist: s.artist || s.author || '',
url: s.url || '',
pic: s.pic || s.cover || '',
lrc: s.lrc || s.lyric || '',
duration: s.duration || 0
};
}
function apiSearch(api, platform, kw, cb) {
fetch(api + '?server=' + platform + '&type=search&id=' + encodeURIComponent(kw) + '&limit=10')
.then(function (r) { return r.json(); })
.then(function (j) {
var arr = Array.isArray(j) ? j : (j && j.data ? j.data : null);
cb(arr ? arr.map(norm4) : null);
})
.catch(function () { cb(null, true); });
}
function trySearch(apis, i, platform, kw, done) {
var netFail = false;
(function step(n) {
if (n >= apis.length) return done(null, netFail);
apiSearch(apis[n], platform, kw, function (songs, fail) {
if (fail) netFail = true;
if (songs && songs.length) return done(songs);
step(n + 1);
});
})(i);
}
function pickPlatform() {
var ps = ['netease', 'tencent', 'kugou', 'migu', 'bilibili'];
return ps[Math.floor(Math.random() * ps.length)];
}
function addToPlaylist(song) {
if (typeof playlist === 'undefined' || typeof play !== 'function') return false;
playlist.push({ name: song.name, artist: song.artist, path: song.url, online: true });
play(playlist.length - 1);
if (typeof updateList === 'function') updateList();
return true;
}
function probeExt4(buf) {
if (window.UMCrypto && buf && buf.byteLength > 8) {
try {
var t = UMCrypto.detectAudioType(new Uint8Array(buf.slice(0, 1024)));
var at = t && t.audioType;
if (at && at !== 'bin') return at;
} catch (e) {}
}
var b = new Uint8Array(buf.slice(0, 12));
if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'mp3';
if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return 'flac';
if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'ogg';
if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'wav';
return '';
}
function downloadSong4(url, name, artist) {
if (!url) return;
fetch(url)
.then(function (r) {
if (!r.ok) throw new Error('fail');
return r.arrayBuffer();
})
.then(function (buf) {
var ext = probeExt4(buf);
if (!ext || buf.byteLength < 4096) {
if (typeof showMsg === 'function') showMsg('该曲受版权/VIP限制，下载不了喵～');
return;
}
var fn = (name + ' - ' + artist + '.' + ext).replace(/[\\/:*?"<>|]/g, '_');
var blob = new Blob([buf], { type: 'audio/' + ext });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = fn;
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
if (typeof showMsg === 'function') showMsg('下载完成喵～');
})
.catch(function () { if (typeof showMsg === 'function') showMsg('下载失败喵～'); });
}
const SEARCH_HIST_KEY = 'sakuraSearchHist';
function saveSearchHist(q) {
if (!q) return;
var arr = [];
try { arr = JSON.parse(localStorage.getItem(SEARCH_HIST_KEY) || '[]') || []; } catch (e) {}
arr = arr.filter(function (x) { return x !== q; });
arr.unshift(q);
if (arr.length > 10) arr = arr.slice(0, 10);
try { localStorage.setItem(SEARCH_HIST_KEY, JSON.stringify(arr)); } catch (e) {}
}
function renderSearchHist(resEl, inputEl) {
if (!resEl) return;
var arr = [];
try { arr = JSON.parse(localStorage.getItem(SEARCH_HIST_KEY) || '[]') || []; } catch (e) {}
if (!arr.length) return;
var html = '<div class="po-hist">最近搜索：';
arr.forEach(function (q) {
html += '<span class="po-hist-chip" data-q="' + esc4(q) + '">' + esc4(q) + '</span>';
});
html += '<span class="po-hist-clear" title="清空历史">清空</span></div>';
resEl.innerHTML = html;
Array.prototype.forEach.call(resEl.querySelectorAll('.po-hist-chip'), function (c) {
c.addEventListener('click', function () {
var q = c.dataset.q;
if (inputEl) inputEl.value = q;
doSearch(q, inputEl, resEl, false);
});
});
var cl = resEl.querySelector('.po-hist-clear');
if (cl) cl.addEventListener('click', function () {
try { localStorage.removeItem(SEARCH_HIST_KEY); } catch (e) {}
resEl.innerHTML = '';
});
}
function doSearch(kw, input, results, isCards) {
var q = kw.trim();
if (!q) { results.innerHTML = '<div class="po-empty">输入歌名或歌手喵～</div>'; return; }
saveSearchHist(q);
results.innerHTML = '<div class="po-loading">正在搜索喵…</div>';
trySearch([PO_API, PO_BACKUP], 0, pickPlatform(), q, function (songs, netFail) {
if (!songs || !songs.length) {
results.innerHTML = netFail ? '<div class="po-empty">搜索接口暂时不可用喵～请稍后再试</div>' : '<div class="po-empty">没搜到喵～换个关键词试试</div>';
return;
}
if (isCards) {
var html = '';
songs.forEach(function (s) {
html += '<div class="po-card" data-i="' + esc4(JSON.stringify({ name: s.name, artist: s.artist, url: s.url, lrc: s.lrc })) + '">' +
'<div class="po-card-cover">' + (s.pic ? '<img src="' + esc4(s.pic) + '" onerror="this.remove()"><i class="fas fa-music"></i>' : '<i class="fas fa-music"></i>') + '</div>' +
'<div class="po-card-info">' +
'<div class="po-card-name">' + esc4(s.name) + '</div>' +
'<div class="po-card-artist">' + esc4(s.artist) + '</div>' +
'</div>' +
'<div class="po-card-actions">' +
'<button class="po-card-dl" title="下载"><i class="fas fa-download"></i></button>' +
'<button class="po-card-play" title="播放"><i class="fas fa-play"></i></button>' +
'</div></div>';
});
results.innerHTML = '<div class="po-group-title"> 在线搜到 ' + songs.length + ' 首（点击播放/下载）</div>' + html;
Array.prototype.forEach.call(results.querySelectorAll('.po-card'), function (el) {
el.querySelector('.po-card-play').addEventListener('click', function () {
var d = JSON.parse(el.dataset.i);
addToPlaylist({ name: d.name, artist: d.artist, url: d.url });
if (window.LyricHelper && typeof lyricBox !== 'undefined' && lyricBox) LyricHelper.show(d.lrc, audio, lyricBox);
});
el.querySelector('.po-card-dl').addEventListener('click', function () {
var d = JSON.parse(el.dataset.i);
downloadSong4(d.url, d.name, d.artist);
});
});
} else {
var html = '';
songs.forEach(function (s) {
html += '<div class="po-item" data-i="' + esc4(JSON.stringify({ name: s.name, artist: s.artist, url: s.url, lrc: s.lrc })) + '">' +
'<div class="po-cover">' + (s.pic ? '<img src="' + esc4(s.pic) + '" loading="lazy" onerror="this.remove()"><i class="fas fa-music"></i>' : '<i class="fas fa-music"></i>') + '</div>' +
'<div class="po-info"><div class="po-name">' + esc4(s.name) + '</div><div class="po-artist">' + esc4(s.artist) + '</div></div>' +
'<div class="po-dur">' + fmt4(s.duration) + '</div>' +
'<div class="po-actions">' +
'<button class="po-dl" title="下载"><i class="fas fa-download"></i></button>' +
'<button class="po-play" title="播放"><i class="fas fa-play"></i></button>' +
'</div></div>';
});
results.innerHTML = '<div class="po-group-title"> 在线搜到 ' + songs.length + ' 首（点击播放会加进歌单）</div>' + html;
Array.prototype.forEach.call(results.querySelectorAll('.po-item'), function (el) {
el.querySelector('.po-play').addEventListener('click', function () {
var d = JSON.parse(el.dataset.i);
addToPlaylist({ name: d.name, artist: d.artist, url: d.url });
if (window.LyricHelper && typeof lyricBox !== 'undefined' && lyricBox) LyricHelper.show(d.lrc, audio, lyricBox);
});
el.querySelector('.po-dl').addEventListener('click', function () {
var d = JSON.parse(el.dataset.i);
downloadSong4(d.url, d.name, d.artist);
});
});
}
});
}
var in1 = document.getElementById('po-search');
var btn1 = document.getElementById('po-btn');
var res1 = document.getElementById('po-results');
if (in1 && btn1 && res1) {
function s1() { doSearch(in1.value, in1, res1, false); }
btn1.addEventListener('click', s1);
in1.addEventListener('keydown', function (e) { if (e.key === 'Enter') s1(); });
renderSearchHist(res1, in1);
}
var in2 = document.getElementById('pc-search');
var btn2 = document.getElementById('pc-btn');
var res2 = document.getElementById('pc-results');
if (in2 && btn2 && res2) {
function s2() { doSearch(in2.value, in2, res2, true); }
btn2.addEventListener('click', s2);
in2.addEventListener('keydown', function (e) { if (e.key === 'Enter') s2(); });
}
})();
