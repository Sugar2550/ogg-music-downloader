(function () {
  var BGM_LABELS = {
    'BGM_Title_00001': 'タイトル',
    'BGM_OpeningMovie_00001': 'オープニングムービー',
    'BGM_Home_00001': 'ホーム 1',
    'BGM_Home_00002': 'ホーム 2',
    'BGM_Home_00003': 'ホーム 3',
    'BGM_MainStage_00001': 'メインステージ 1',
    'BGM_MainStage_00003': 'メインステージ 3',
    'BGM_MainStage_00004': 'メインステージ 4',
    'BGM_Cooking_00001': '料理',
    'BGM_Eating_00001': '食事',
    'BGM_Minigame_00001': 'ミニゲーム',
    'BGM_Taxi_00001': 'タクシー',
    'BGM_CostumeShop_Closet_00001': 'きせかえショップ・クローゼット'
  };
  var BGM_ORDER = Object.keys(BGM_LABELS);

  var SE_CAT_LABELS = {
    GM: 'ギミック', Assist: 'アシスト', FacilityArrangement: '施設配置', InGame: 'パズル',
    Reward: '報酬', Minigame: 'ミニゲーム', Field: 'フィールド', OrderdeliveryStage: '配達ステージ',
    Piece: 'ピース', StarGacha: 'スターガチャ', BattleRoyale: 'バトルロイヤル', Cooking: '料理',
    BalloonRace: 'バルーンレース', SeasonPass: 'シーズンパス', Decide: '決定', Cancel: 'キャンセル',
    AreaMap: 'エリアマップ', Gauge: 'ゲージ', Talk: '会話', PictureBook: '図鑑', Booster: 'ブースター'
  };

  var PL_KEY = 'bcMusicPlaylist';
  var VOL_KEY = 'bcMusicVolume';
  var SAVED_KEY = 'bcMusicSavedPlaylists';
  // 曲のデータはすべてこの1ファイル(サイトのルートに置く)にまとめています
  var TRACKS_JSON = 'tracks.json';
  // 音声ファイルの置き場所(vercel.json の /api/music/ → GitHub の music/ フォルダ)。
  // tracks.json の mp3 / ogg / file / dl は、ここからの相対パスで書きます(例: mp3/000.mp3)。
  // 「/」や「http」で始まるパスは、そのまま使います
  var MUSIC_BASE = '/api/music/';
  var BC_FMTS = ['mp3', 'ogg'];
  // 大戦争の分類名(tracks.json の bc の cat)の表示名と並び順
  var BC_CATS = {
    bgm: [
      ['regular', '恒常BGM'], ['limited', '限定BGM'], ['shometsu', '消滅都市コラボ'], ['pawapuro', 'パワプロコラボ'],
      ['eva', 'エヴァンゲリオンコラボ'], ['sf', 'ストリートファイターコラボ'], ['miku', '初音ミクコラボ'], ['godzilla', 'ゴジラコラボ'],
      ['tos', '神魔之塔コラボ'], ['sonic', 'ソニックコラボ'], ['mura', 'にゃんこ村コラボ']
    ],
    se: [
      ['battle', '戦闘'], ['cannon', 'にゃんこ砲'], ['ability', '効果・能力'], ['god', '神様'],
      ['system', 'メニュー・ガチャなど'], ['gamatoto', 'ガマトト探検隊'], ['ranking', 'ネコ道場・ランキング'], ['collab', 'コラボ・イベント']
    ]
  };
  function bcCatLabel(c) {
    var all = BC_CATS.bgm.concat(BC_CATS.se);
    for (var i = 0; i < all.length; i++) if (all[i][0] === c) return all[i][1];
    return c;
  }
  var LOOP_STEPS = [1, 2, 3, 5, 10, 0];

  var ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  var ICON_DL = '<svg viewBox="0 0 24 24"><path d="M11 4h2v9l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13V4zM5 18h14v2H5z"/></svg>';
  var ICON_ADD = '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>';
  var ICON_UP = '<svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.4 1.4L12 10.8l4.6 4.6L18 14z"/></svg>';
  var ICON_DOWN = '<svg viewBox="0 0 24 24"><path d="M12 16l6-6-1.4-1.4L12 13.2 7.4 8.6 6 10z"/></svg>';
  var ICON_REMOVE = '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/></svg>';

  var tracks = {};
  var bgmList = [], seList = [];
  var playlist = [];
  var shared = [];
  var bcList = [];
  var otherList = [];
  var bcQuery = '';
  var bcCat = 'all';
  var BC_KIND_NAMES = { bgm: 'BGM', se: '効果音' };
  var seCat = 'all';
  var seQuery = '';

  var queue = [];
  var queueName = '';
  var queuePos = -1;
  var playCount = 1;
  var shuffle = false;
  var repeat = 'off';
  var seeking = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtShort(sec) {
    return sec < 10 ? sec.toFixed(1) + '秒' : fmt(sec);
  }
  function loopLabel(loop) {
    return loop === 0 ? '∞' : '×' + loop;
  }
  function toast(msg, action) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.toggle('has-action', !!action);
    if (action) {
      var b = document.createElement('button');
      b.className = 'toast-action';
      b.textContent = '取り消す';
      b.onclick = function () {
        t.classList.remove('show', 'has-action');
        action();
      };
      t.appendChild(b);
    }
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show', 'has-action'); }, action ? 4000 : 1600);
  }
  function normEntry(e) {
    if (typeof e === 'string') return { id: e, loop: 1 };
    if (!e || typeof e.id !== 'string') return null;
    var loop = LOOP_STEPS.indexOf(e.loop) !== -1 ? e.loop : 1;
    return { id: e.id, loop: loop };
  }
  function loadPlaylist() {
    try {
      var v = JSON.parse(localStorage.getItem(PL_KEY) || '[]');
      return Array.isArray(v) ? v.map(normEntry).filter(Boolean) : [];
    } catch (e) { return []; }
  }
  function savePlaylist() {
    try { localStorage.setItem(PL_KEY, JSON.stringify(playlist)); } catch (e) {}
  }
  function countInPlaylist(id) {
    return playlist.filter(function (e) { return e.id === id; }).length;
  }
  function label(t) {
    if (t.title) return t.title;
    if (t.type === 'bgm') return BGM_LABELS[t.id] || t.id;
    return t.id;
  }
  function subLabel(t) {
    var p = [];
    if (t.type === 'bgm') p.push(t.id);
    else if (t.type === 'bc') {
      p.push(t.fmt.toUpperCase());
      if (t.ver) p.push('追加Ver. ' + t.ver);
      if (t.cat) p.push(bcCatLabel(t.cat));
    } else if (t.type === 'other') p.push(APP_NAMES[t.app] || t.app || '');
    else if (SE_CAT_LABELS[t.cat]) p.push(SE_CAT_LABELS[t.cat]);
    if (t.dur) p.push(fmtShort(t.dur));
    if (t.loopEdited) p.push('ループ調整版');
    return p.filter(Boolean).join('・');
  }
  function totalTime(entries) {
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].loop === 0) return '∞';
      if (!tracks[entries[i].id].dur) return '';
      total += tracks[entries[i].id].dur * entries[i].loop;
    }
    return fmt(total);
  }
  function countLabel(entries) {
    var t = totalTime(entries);
    return entries.length + '件' + (t ? '・' + t : '');
  }

  function rowHtml(t, opts) {
    var html = '<li class="track" data-id="' + esc(t.id) + '" data-src="' + opts.src + '"' +
      (opts.idx !== undefined ? ' data-idx="' + opts.idx + '"' : '') + '>' +
      '<div class="track-info"><div class="track-title">' + esc(label(t)) + '</div>' +
      '<div class="track-sub">' + esc(subLabel(t)) +
      (opts.src === 'shared' && opts.loop !== 1 ? '・' + (opts.loop === 0 ? '無限ループ' : opts.loop + '回ループ') : '') +
      '</div></div>' +
      '<div class="track-actions">' +
      '<button class="icon-btn play" data-act="play" title="再生" aria-label="再生">' + ICON_PLAY + '</button>';
    if (opts.src === 'pl') {
      html += '<button class="loop-btn' + (opts.loop !== 1 ? ' on' : '') + '" data-act="loop" title="ループ回数（押すたびに切り替え）" aria-label="ループ回数 ' + loopLabel(opts.loop) + '">' + loopLabel(opts.loop) + '</button>' +
        '<button class="icon-btn small" data-act="up" title="上へ" aria-label="上へ"' + (opts.first ? ' disabled' : '') + '>' + ICON_UP + '</button>' +
        '<button class="icon-btn small" data-act="down" title="下へ" aria-label="下へ"' + (opts.last ? ' disabled' : '') + '>' + ICON_DOWN + '</button>' +
        '<button class="icon-btn small" data-act="remove" title="プレイリストから削除" aria-label="プレイリストから削除">' + ICON_REMOVE + '</button>';
    } else {
      var n = countInPlaylist(t.id);
      html += '<button class="icon-btn add-btn' + (n ? ' added' : '') + '" data-act="add" title="プレイリストに追加' + (n ? '（' + n + '件追加済み）' : '') + '" aria-label="プレイリストに追加">' + ICON_ADD +
        (n ? '<span class="add-count">' + n + '</span>' : '') + '</button>';
    }
    html += '<a class="icon-btn" href="' + esc(t.dl || t.file) + '" download="' + esc(dlName(t)) + '" title="ダウンロード" aria-label="ダウンロード">' + ICON_DL + '</a>' +
      '</div></li>';
    return html;
  }

  function extOf(t) {
    var m = /\.([a-z0-9]+)(?:$|[?#])/i.exec(t.dl || t.file);
    return m ? m[1] : 'mp3';
  }
  function dlName(t) {
    var safe = function (s) { return String(s).replace(/[\\/:*?"<>|]/g, '_'); };
    if (t.type === 'bc') return safe(t.title) + '.' + extOf(t);
    if (t.type === 'other') return safe((APP_NAMES[t.app] || t.app) + '_' + label(t)) + '.' + extOf(t);
    return (t.dl || t.file).split('/').pop();
  }

  function filteredSe() {
    var q = seQuery.toLowerCase();
    return seList.filter(function (t) {
      return (seCat === 'all' || t.cat === seCat) && (!q || t.id.toLowerCase().indexOf(q) !== -1);
    });
  }

  function renderBgm() {
    $('bgm-list').innerHTML = bgmList.map(function (t) { return rowHtml(t, { src: 'bgm' }); }).join('');
    $('bgm-count').textContent = bgmList.length + '曲';
  }

  function renderSeCats() {
    var counts = {};
    seList.forEach(function (t) { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    var html = optionHtml('all', 'すべて', seList.length, seCat);
    cats.forEach(function (c) {
      var jp = SE_CAT_LABELS[c];
      html += optionHtml(c, c + (jp ? '（' + jp + '）' : ''), counts[c], seCat);
    });
    $('se-cat').innerHTML = html;
  }

  function optionHtml(value, text, n, selected) {
    return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' +
      esc(text) + '（' + n + '）</option>';
  }

  var APP_NAMES = { burgle: 'にゃんこ大泥棒', shinnihon: 'にゃんこ新日本', quest: 'にゃんこクエスト', hopping: 'ネコホッピング' };
  function renderOther() {
    var html = '';
    Object.keys(APP_NAMES).forEach(function (app) {
      var list = otherList.filter(function (t) { return t.app === app; });
      if (!list.length) return;
      html += '<li class="track-group">' + esc(APP_NAMES[app]) + '<span class="n">' + list.length + '曲</span></li>';
      html += list.map(function (t) { return rowHtml(t, { src: 'other' }); }).join('');
    });
    $('other-list').innerHTML = html;
    $('other-count').textContent = otherList.length + '曲';
    $('other-box').hidden = !otherList.length || !$('panel-playlist').hidden;
  }

  var bcFmt = 'mp3';
  var bcKind = 'bgm';
  function bcHasKinds() {
    return bcList.some(function (t) { return t.kind; });
  }
  function bcOfFmt() {
    return bcList.filter(function (t) { return t.fmt === bcFmt; });
  }
  function bcOfView() {
    var hasKinds = bcHasKinds();
    return bcOfFmt().filter(function (t) { return !hasKinds || t.kind === bcKind; });
  }
  function filteredBc() {
    var q = bcQuery.toLowerCase();
    return bcOfView().filter(function (t) {
      return (bcCat === 'all' || t.cat === bcCat) && (!q || t.title.toLowerCase().indexOf(q) !== -1);
    });
  }
  // 分類(cat)がある曲があれば、絞り込みメニューを自動で出す
  function renderBcCats() {
    var sel = $('bc-cat'), items = bcOfView(), counts = {}, found = [];
    items.forEach(function (t) {
      if (!t.cat) return;
      if (!counts[t.cat]) { counts[t.cat] = 0; found.push(t.cat); }
      counts[t.cat]++;
    });
    var order = (BC_CATS[bcKind] || []).map(function (c) { return c[0]; });
    found.sort(function (x, y) {
      var ix = order.indexOf(x), iy = order.indexOf(y);
      return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
    });
    if (found.indexOf(bcCat) === -1) bcCat = 'all';
    sel.hidden = !found.length;
    var html = optionHtml('all', 'すべて', items.length, bcCat);
    found.forEach(function (c) { html += optionHtml(c, bcCatLabel(c), counts[c], bcCat); });
    sel.innerHTML = html;
  }
  function renderBcKinds() {
    // 形式 (MP3 / OGG)
    var fmts = BC_FMTS.filter(function (f) { return bcList.some(function (t) { return t.fmt === f; }); });
    $('bc-fmts').hidden = fmts.length < 2;
    $('bc-fmts').innerHTML = fmts.map(function (f) {
      return '<button class="chip' + (bcFmt === f ? ' active' : '') + '" data-fmt="' + f + '">' + f.toUpperCase() + '</button>';
    }).join('');
    // 種類 (BGM / 効果音)
    var kinds = ['bgm', 'se'].filter(function (k) { return bcOfFmt().some(function (t) { return t.kind === k; }); });
    if (kinds.length && kinds.indexOf(bcKind) === -1) bcKind = kinds[0];
    $('bc-kinds').hidden = kinds.length < 2;
    $('bc-kinds').innerHTML = kinds.map(function (k) {
      var n = bcOfFmt().filter(function (t) { return t.kind === k; }).length;
      return '<button class="chip' + (bcKind === k ? ' active' : '') + '" data-kind="' + k + '">' +
        BC_KIND_NAMES[k] + '<span class="n">' + n + '</span></button>';
    }).join('');
    $('bc-heading').textContent = 'にゃんこ大戦争 ' + (bcHasKinds() ? BC_KIND_NAMES[bcKind] + ' ' : '') + bcFmt.toUpperCase();
    renderBcCats();
  }
  function bcName() {
    return 'にゃんこ大戦争 ' + (bcHasKinds() ? BC_KIND_NAMES[bcKind] + ' ' : '') + bcFmt.toUpperCase() +
      (bcCat !== 'all' ? '・' + bcCatLabel(bcCat) : '');
  }

  function renderBc() {
    var list = filteredBc();
    $('bc-list').innerHTML = list.length
      ? list.map(function (t) { return rowHtml(t, { src: 'bc' }); }).join('')
      : '<li class="track"><div class="track-info track-sub">該当する曲はありません</div></li>';
    var all = bcOfView().length;
    $('bc-count').textContent = list.length + ' / ' + all + (bcHasKinds() && bcKind === 'se' ? '個' : '曲');
  }

  function renderSe() {
    var list = filteredSe();
    $('se-list').innerHTML = list.length
      ? list.map(function (t) { return rowHtml(t, { src: 'se' }); }).join('')
      : '<li class="track"><div class="track-info track-sub">該当する効果音はありません</div></li>';
    $('se-count').textContent = list.length + ' / ' + seList.length + '個';
  }

  function renderPlaylist() {
    playlist = playlist.filter(function (e) { return tracks[e.id]; });
    var n = playlist.length;
    $('pl-list').innerHTML = playlist.map(function (e, i) {
      return rowHtml(tracks[e.id], { src: 'pl', idx: i, loop: e.loop, first: i === 0, last: i === n - 1 });
    }).join('');
    $('pl-list').hidden = n === 0;
    $('pl-empty').hidden = n !== 0;
    $('pl-badge').textContent = n;
    $('pl-count').textContent = n ? countLabel(playlist) : '0件';
    ['pl-play', 'pl-shuffle-play', 'pl-share', 'pl-clear'].forEach(function (b) { $(b).disabled = n === 0; });
  }

  function renderShared() {
    $('shared-box').hidden = shared.length === 0;
    if (!shared.length) return;
    $('shared-list').innerHTML = shared.map(function (e, i) {
      return rowHtml(tracks[e.id], { src: 'shared', idx: i, loop: e.loop });
    }).join('');
    $('shared-count').textContent = countLabel(shared);
  }

  function renderAll() {
    renderBgm();
    renderSe();
    renderBc();
    renderOther();
    renderShared();
    renderPlaylist();
    markPlaying();
  }

  function decodeIds(str) {
    return String(str || '').split('.').map(function (s) {
      if (s.charAt(0) === 'B') return 'BGM_' + s.slice(1);
      if (s.charAt(0) === 'S') return 'SE_' + s.slice(1);
      return '';
    }).filter(function (id) { return tracks[id]; })
      .map(function (id) { return { id: id, loop: 1 }; });
  }
  var byNum = {};
  var byPn = {};   // 元サイトの共有リンク(?p=)で使われていた曲番号 → 曲ID
  function pushVarint(bytes, n) {
    while (n >= 0x80) { bytes.push((n & 0x7f) | 0x80); n = Math.floor(n / 0x80); }
    bytes.push(n);
  }
  function packEntries(entries) {
    var bytes = [];
    entries.forEach(function (e) {
      var hasLoop = e.loop !== 1;
      pushVarint(bytes, tracks[e.id].n * 2 + (hasLoop ? 1 : 0));
      if (hasLoop) pushVarint(bytes, e.loop);
    });
    var bin = String.fromCharCode.apply(null, bytes);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unpackEntries(str) {
    var bin;
    try { bin = atob(String(str || '').replace(/-/g, '+').replace(/_/g, '/')); } catch (e) { return []; }
    var nums = [], n = 0, shift = 1;
    for (var i = 0; i < bin.length; i++) {
      var b = bin.charCodeAt(i);
      n += (b & 0x7f) * shift;
      if (b & 0x80) { shift *= 0x80; continue; }
      nums.push(n);
      n = 0; shift = 1;
    }
    var entries = [];
    for (var k = 0; k < nums.length; k++) {
      var v = nums[k], loop = 1;
      if (v % 2 === 1) {
        if (k + 1 >= nums.length) break;
        loop = nums[++k];
        if (LOOP_STEPS.indexOf(loop) === -1) loop = 1;
      }
      var id = byPn[Math.floor(v / 2)];
      if (id) entries.push({ id: id, loop: loop });
    }
    return entries;
  }
  // 共有リンク: ?sd=12,5x2,100003,7x0
  //   曲番号 = tracks.json の n(大戦争は bc の n、OGG は n+1000、にゃんこ村などは 100000 以降。34_0 のように文字入りも可)
  //   xN   = ループ回数(省略すると1回、x0 は無限ループ)
  function shareUrl() {
    var ids = playlist.map(function (e) {
      return tracks[e.id].n + (e.loop !== 1 ? 'x' + e.loop : '');
    }).join(',');
    return location.origin + location.pathname + '?sd=' + ids;
  }
  function parseSd(str) {
    return String(str || '').split(',').map(function (tok) {
      var m = /^(\w+?)(?:x(\d+))?$/.exec(tok.trim());
      if (!m) return null;
      var id = byNum[m[1]];
      if (!id || !tracks[id]) return null;
      var loop = m[2] === undefined ? 1 : Number(m[2]);
      return { id: id, loop: LOOP_STEPS.indexOf(loop) !== -1 ? loop : 1 };
    }).filter(Boolean);
  }
  function copyByExec(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    if (copyByExec(text)) return Promise.resolve();
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return Promise.reject();
  }
  function closeShared() {
    shared = [];
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    queue.forEach(function (q) { if (q.src === 'shared') q.idx = -1; });
    renderShared();
  }

  var actx = null, gainNode = null;
  var bufCache = {}, bufOrder = [];
  var BUF_CACHE_BYTES = 160 * 1024 * 1024;
  var bufBytes = {};
  var source = null;
  var curBuf = null;
  var playing = false;
  var startAt = 0;
  var startAbs = 0;
  var pausedAbs = 0;
  var loadToken = 0;
  var switching = false;
  var pendingPlay = false;
  function audioActive() { return playing || switching || (pendingPlay && !curBuf); }

  var ctxStale = false;

  function ensureCtx() {
    clearTimeout(sleepTimer);
    if (actx && actx.state !== 'running' && (ctxStale || actx.state === 'interrupted' || actx.state === 'closed')) {
      var old = actx;
      old.onstatechange = null;
      if (playing) { pausedAbs = absNow(); playing = false; }
      stopSource();
      try { old.close(); } catch (e) {}
      actx = null;
    }
    ctxStale = false;
    if (!actx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      try { actx = new Ctx({ sampleRate: 44100 }); } catch (e) { actx = new Ctx(); }
      gainNode = actx.createGain();
      gainNode.gain.value = volume;
      gainNode.connect(actx.destination);
      var ctx = actx;
      ctx.onstatechange = function () {
        if (ctx === actx && ctx.state !== 'running' && playing) {
          pausedAbs = absNow();
          stopSource();
          playing = false;
          markPlaying();
        }
      };
    }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (actx.state !== 'running') resumeCtx();
  }

  var sleepTimer = null;
  function sleepCtx() {
    clearTimeout(sleepTimer);
    var token = loadToken;
    sleepTimer = setTimeout(function () {
      if (playing || token !== loadToken || !actx || actx.state !== 'running') return;
      var p = actx.suspend();
      if (p && p.catch) p.catch(function () {});
      try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) {}
    }, 1000);
  }

  function resumeCtx() {
    var p = actx.resume();
    if (p && p.catch) p.catch(function () {});
  }

  function getBuffer(file) {
    if (bufCache[file]) {
      bufOrder.splice(bufOrder.indexOf(file), 1);
      bufOrder.push(file);
      return bufCache[file];
    }
    var p = fetch(file)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(function (ab) {
        return new Promise(function (resolve, reject) { actx.decodeAudioData(ab, resolve, reject); });
      })
      .then(function (buf) {
        bufBytes[file] = buf.length * buf.numberOfChannels * 4;
        trimCache();
        return buf;
      });
    p.catch(function () {
      if (bufCache[file] === p) {
        delete bufCache[file];
        var i = bufOrder.indexOf(file);
        if (i !== -1) bufOrder.splice(i, 1);
      }
    });
    bufCache[file] = p;
    bufOrder.push(file);
    return p;
  }

  function trimCache() {
    var keep = {};
    var cur = current(), nx = queue[queuePos + 1];
    if (cur && tracks[cur.id]) keep[tracks[cur.id].file] = true;
    if (nx && tracks[nx.id]) keep[tracks[nx.id].file] = true;
    var total = 0;
    bufOrder.forEach(function (f) { total += bufBytes[f] || 0; });
    for (var i = 0; i < bufOrder.length && total > BUF_CACHE_BYTES; ) {
      var f = bufOrder[i];
      if (keep[f] || !bufBytes[f]) { i++; continue; }
      total -= bufBytes[f] || 0;
      delete bufCache[f];
      delete bufBytes[f];
      bufOrder.splice(i, 1);
    }
  }

  function current() { return queue[queuePos]; }

  function totalPlays() {
    var cur = current();
    if (!cur) return 1;
    return cur.loop === 0 || repeat === 'one' ? Infinity : cur.loop;
  }

  function introLen() {
    var cur = current(), t = cur && tracks[cur.id];
    return t && t.loopStart ? t.loopStart : 0;
  }
  function bodyLen() { return curBuf.duration - introLen(); }
  function passLen() { return introLen() || curBuf.duration; }
  function totalLen(total) {
    var a = introLen(), b = bodyLen();
    return a ? a + (total - 1) * b : total * b;
  }
  function passAt(abs) {
    var a = introLen(), b = bodyLen(), k, r;
    if (a) {
      if (abs < a) return { count: 1, pos: abs, offset: abs };
      k = Math.floor((abs - a) / b); r = abs - a - k * b;
      return { count: k + 2, pos: r, offset: a + r };
    }
    k = Math.floor(abs / b); r = abs - k * b;
    return { count: k + 1, pos: r, offset: r };
  }
  function absFor(count, pos) {
    var a = introLen(), b = bodyLen();
    if (a) return count === 1 ? pos : a + (count - 2) * b + pos;
    return (count - 1) * b + pos;
  }

  function absNow() {
    return playing && actx ? startAbs + (actx.currentTime - startAt) : pausedAbs;
  }

  function stopSource() {
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch (e) {}
    source.disconnect();
    source = null;
  }

  function startSource(abs) {
    stopSource();
    var total = totalPlays();
    var end = totalLen(total);
    if (abs >= end) {
      playing = false;
      pausedAbs = 0;
      next(true);
      return;
    }
    var s = actx.createBufferSource();
    s.buffer = curBuf;
    s.loop = total > 1;
    if (introLen()) {
      s.loopStart = introLen();
      s.loopEnd = curBuf.duration;
    }
    s.connect(gainNode);
    var now = actx.currentTime;
    s.start(now, passAt(abs).offset);
    if (isFinite(end)) s.stop(now + (end - abs));
    s.onended = function () {
      if (source !== s) return;
      source = null;
      playing = false;
      pausedAbs = 0;
      next(true);
    };
    source = s;
    startAt = now;
    startAbs = abs;
    playing = true;
    markPlaying();
  }

  function reschedule() {
    if (playing && curBuf) startSource(absNow());
  }

  function isCurrentRow(li) {
    var cur = current();
    if (!cur) return false;
    var src = li.getAttribute('data-src');
    if (src === 'pl' || src === 'shared') {
      return cur.src === src && String(cur.idx) === li.getAttribute('data-idx');
    }
    return li.getAttribute('data-id') === cur.id;
  }

  function markPlaying() {
    var on_ = !!current() && playing;
    document.querySelectorAll('.track[data-src]').forEach(function (li) {
      var on = isCurrentRow(li);
      li.classList.toggle('playing', on);
      var btn = li.querySelector('[data-act="play"]');
      if (btn) {
        btn.innerHTML = on && on_ ? ICON_PAUSE : ICON_PLAY;
        btn.title = on && on_ ? '一時停止' : '再生';
      }
    });
    $('pp-toggle').innerHTML = on_ ? ICON_PAUSE : ICON_PLAY;
    keepAlive(audioActive());
    updateMediaState();
  }

  var silenceSrc = null;
  function silenceUrl() {
    if (silenceSrc) return silenceSrc;
    var rate = 8000, n = rate, buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer);
    function w(o, s) { for (var i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); }
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true);
    dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
    buf.fill(128, 44);
    silenceSrc = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    return silenceSrc;
  }
  var keeper = null, keeperWant = false;
  function keepAlive(on) {
    if (!MS) return;
    keeperWant = on;
    if (on) {
      if (!keeper) {
        keeper = new Audio(silenceUrl());
        keeper.loop = true;
        keeper.addEventListener('pause', function () {
          if (!keeperWant || !playing) return;
          pausedAbs = absNow();
          stopSource();
          playing = false;
          markPlaying();
          sleepCtx();
        });
      }
      if (keeper.paused) {
        var p = keeper.play();
        if (p && p.catch) p.catch(function () {});
      }
    } else if (keeper && !keeper.paused) {
      keeper.pause();
    }
  }

  var MS = 'mediaSession' in navigator ? navigator.mediaSession : null;
  function artKey(t) {
    if (t.type === 'bc') return 'bc';
    if (t.type === 'other') return t.app;
    return 'mura';
  }
  function updateMediaMeta() {
    var cur = current(), t = cur && tracks[cur.id];
    if (!MS || !t || !window.MediaMetadata) return;
    var app = t.type === 'bc' ? 'にゃんこ大戦争' : t.type === 'other' ? APP_NAMES[t.app] : 'パズルで豊作！にゃんこ村';
    try {
      MS.metadata = new MediaMetadata({
        title: label(t),
        artist: app,
        album: queueName,
        artwork: [{ src: new URL('images/default.png', location.href).href, sizes: '512x512', type: 'image/png' }]
      });
    } catch (e) {}
  }
  function refreshMediaMeta() {
    if (!MS) return;
    try { MS.metadata = null; } catch (e) {}
    updateMediaMeta();
    if (keeper && !keeper.paused) { try { keeper.currentTime = 0; } catch (e) {} }
    updateMediaPos();
  }
  function updateMediaState() {
    if (!MS) return;
    try { MS.playbackState = !current() ? 'none' : audioActive() ? 'playing' : 'paused'; } catch (e) {}
    updateMediaPos();
  }
  function updateMediaPos() {
    if (!MS || !MS.setPositionState || !curBuf) return;
    var p = passAt(absNow());
    var len = p.count === 1 ? passLen() : bodyLen();
    try { MS.setPositionState({ duration: len, position: Math.min(p.pos, len), playbackRate: 1 }); } catch (e) {}
  }
  if (MS) {
    var msHandlers = {
      play: function () { if (!playing) togglePlay(); },
      pause: function () { if (playing || switching) togglePlay(); },
      previoustrack: function () { prev(); },
      nexttrack: function () { next(); },
      seekto: function (d) { if (d && typeof d.seekTime === 'number') { seekTo(d.seekTime); updateMediaPos(); } }
    };
    Object.keys(msHandlers).forEach(function (k) {
      try { MS.setActionHandler(k, msHandlers[k]); } catch (e) {}
    });
  }

  function updateSource() {
    var cur = current();
    if (!cur) return;
    var s = queueName + '（' + (queuePos + 1) + ' / ' + queue.length + '）';
    if (!curBuf) s += '・読み込み中…';
    else if (cur.loop === 0) s += '・∞ループ ' + playCount + '回目';
    else if (cur.loop > 1) s += '・ループ ' + playCount + ' / ' + cur.loop;
    $('pp-source').textContent = s;
  }

  function playQueue(items, startIdx, name) {
    if (!items.length) return;
    queue = items.slice();
    queueName = name;
    if (shuffle) {
      var first = queue.splice(startIdx, 1)[0];
      shuffleArray(queue);
      queue.unshift(first);
      startIdx = 0;
    }
    queuePos = startIdx;
    loadCurrent(true);
  }

  function shuffleArray(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function loadCurrent(autoplay) {
    var cur = current();
    var t = cur && tracks[cur.id];
    if (!t) return;
    ensureCtx();
    var token = ++loadToken;
    pendingPlay = autoplay;
    switching = autoplay && playing && !!source;
    if (switching) source.onended = null; else stopSource();
    playing = false;
    pausedAbs = 0;
    curBuf = null;
    playCount = 1;
    $('pp-title').textContent = label(t);
    updateMediaMeta();
    updateSource();
    $('pp-dur').textContent = fmt(t.dur);
    $('pp-cur').textContent = '0:00';
    $('pp-seek').value = 0;
    document.body.classList.add('player-open');
    markPlaying();
    if (autoplay) keepAlive(true);
    getBuffer(t.file).catch(function () {
      if (token !== loadToken) throw new Error('stale');
      trimCache();
      return new Promise(function (r) { setTimeout(r, 600); }).then(function () { return getBuffer(t.file); });
    }).then(function (buf) {
      if (token !== loadToken) return;
      switching = false;
      if (actx.state !== 'running') resumeCtx();
      curBuf = buf;
      if (!t.dur) t.dur = buf.duration;
      $('pp-dur').textContent = fmt(passLen());
      updateSource();
      if (pendingPlay) startSource(0); else markPlaying();
      refreshMediaMeta();
      preloadNext();
    }, function (err) {
      if (token !== loadToken) return;
      switching = false;
      pendingPlay = false;
      stopSource();
      console.warn('音声の読み込みに失敗:', t.file, err);
      toast('読み込みに失敗しました' + (err && err.message ? '（' + err.message + '）' : ''));
      markPlaying();
    });
  }

  function preloadNext() {
    var n = queue[queuePos + 1] || (repeat === 'all' ? queue[0] : null);
    if (n && tracks[n.id]) getBuffer(tracks[n.id].file);
  }

  function next(auto) {
    if (!queue.length) return;
    if (queuePos < queue.length - 1) {
      queuePos++;
    } else if (repeat === 'all' || !auto) {
      queuePos = 0;
    } else {
      markPlaying();
      sleepCtx();
      return;
    }
    loadCurrent(true);
  }

  function seekTo(pos) {
    if (!curBuf) return;
    var p = passAt(absNow());
    var len = p.count === 1 ? passLen() : bodyLen();
    var abs = absFor(p.count, Math.min(Math.max(pos, 0), len - 0.01));
    if (playing) startSource(abs); else pausedAbs = abs;
  }

  function prev() {
    if (!queue.length) return;
    if (curBuf && passAt(absNow()).pos > 3) { seekTo(0); return; }
    queuePos = queuePos > 0 ? queuePos - 1 : queue.length - 1;
    loadCurrent(true);
  }

  function togglePlay() {
    if (!queue.length) {
      var ds = bgmList.length ? 'bgm' : 'bc';
      playQueue(listItems(ds), 0, ds === 'bc' ? bcName() : SRC_NAMES.bgm);
      return;
    }
    ensureCtx();
    if (switching) {
      switching = false;
      stopSource();
      pendingPlay = false;
      markPlaying();
      return;
    }
    if (!curBuf) return;
    if (playing) {
      pausedAbs = absNow();
      stopSource();
      playing = false;
      markPlaying();
      sleepCtx();
    } else {
      startSource(pausedAbs);
    }
  }

  function listItems(src) {
    if (src === 'bgm') return bgmList.map(function (t, i) { return { id: t.id, loop: 1, src: 'bgm', idx: i }; });
    if (src === 'se') return filteredSe().map(function (t, i) { return { id: t.id, loop: 1, src: 'se', idx: i }; });
    if (src === 'bc') return filteredBc().map(function (t, i) { return { id: t.id, loop: 1, src: 'bc', idx: i }; });
    if (src === 'other') return otherList.map(function (t, i) { return { id: t.id, loop: 1, src: 'other', idx: i }; });
    var list = src === 'shared' ? shared : playlist;
    return list.map(function (e, i) { return { id: e.id, loop: e.loop, src: src, idx: i }; });
  }
  var SRC_NAMES = { bgm: 'にゃんこ村 BGM', se: 'にゃんこ村 効果音', bc: 'にゃんこ大戦争', other: 'その他のアプリ BGM', pl: 'プレイリスト', shared: '共有プレイリスト' };

  function syncQueueAfterEdit(mapIdx) {
    queue.forEach(function (q) {
      if (q.src !== 'pl') return;
      var ni = mapIdx(q.idx);
      if (ni === -1) q.idx = -1;
      else { q.idx = ni; q.loop = playlist[ni].loop; }
    });
  }

  function onListClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'A') return;
    var li = btn.closest('.track');
    var id = li.getAttribute('data-id');
    var src = li.getAttribute('data-src');
    var idx = Number(li.getAttribute('data-idx'));
    var act = btn.getAttribute('data-act');

    if (act === 'play') {
      if (isCurrentRow(li)) { togglePlay(); return; }
      var items = listItems(src);
      var start = (src === 'pl' || src === 'shared') ? idx
        : Math.max(0, items.map(function (q) { return q.id; }).indexOf(id));
      playQueue(items, start, src === 'bc' ? bcName() : SRC_NAMES[src]);
    } else if (act === 'add') {
      var loop = src === 'shared' ? shared[idx].loop : 1;
      var added = { id: id, loop: loop };
      playlist.push(added);
      savePlaylist();
      renderAll();
      var n = countInPlaylist(id);
      toast(n > 1 ? 'プレイリストに追加しました（' + n + '件目）' : 'プレイリストに追加しました', function () {
        var at = playlist.indexOf(added);
        if (at === -1) return;
        playlist.splice(at, 1);
        syncQueueAfterEdit(function (i) { return i === at ? -1 : i > at ? i - 1 : i; });
        savePlaylist();
        renderAll();
        toast('追加を取り消しました');
      });
    } else if (act === 'remove') {
      playlist.splice(idx, 1);
      syncQueueAfterEdit(function (i) { return i === idx ? -1 : i > idx ? i - 1 : i; });
      savePlaylist();
      renderAll();
      toast('プレイリストから削除しました');
    } else if (act === 'up' || act === 'down') {
      var j = act === 'up' ? idx - 1 : idx + 1;
      if (j < 0 || j >= playlist.length) return;
      var tmp = playlist[idx]; playlist[idx] = playlist[j]; playlist[j] = tmp;
      syncQueueAfterEdit(function (i) { return i === idx ? j : i === j ? idx : i; });
      savePlaylist();
      renderPlaylist();
      markPlaying();
    } else if (act === 'loop') {
      var entry = playlist[idx];
      entry.loop = LOOP_STEPS[(LOOP_STEPS.indexOf(entry.loop) + 1) % LOOP_STEPS.length];
      syncQueueAfterEdit(function (i) { return i; });
      savePlaylist();
      renderPlaylist();
      markPlaying();
      updateSource();
      var cur = current();
      if (cur && cur.src === 'pl' && cur.idx === idx) reschedule();
      toast(entry.loop === 0 ? '無限ループ' : entry.loop === 1 ? 'ループなし' : entry.loop + '回ループ');
    }
  }

  ['bgm-list', 'se-list', 'bc-list', 'other-list', 'shared-list', 'pl-list'].forEach(function (id) {
    $(id).addEventListener('click', onListClick);
  });

  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var tab = b.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
      ['mura', 'bc', 'playlist'].forEach(function (p) { $('panel-' + p).hidden = p !== tab; });
      $('other-box').hidden = tab === 'playlist';
      try { sessionStorage.setItem('bcMusicTab', tab); } catch (e) {}
    });
  });

  $('se-cat').addEventListener('change', function (e) {
    seCat = e.target.value;
    renderSe();
    markPlaying();
  });
  $('se-search').addEventListener('input', function (e) {
    seQuery = e.target.value.trim();
    renderSe();
    markPlaying();
  });

  var muraKind = 'bgm';
  function renderMuraKinds() {
    var counts = { bgm: bgmList.length, se: seList.length };
    $('mura-kinds').innerHTML = ['bgm', 'se'].filter(function (k) { return counts[k] > 0; }).map(function (k) {
      return '<button class="chip' + (muraKind === k ? ' active' : '') + '" data-kind="' + k + '">' +
        BC_KIND_NAMES[k] + '<span class="n">' + counts[k] + '</span></button>';
    }).join('');
    $('mura-bgm').hidden = muraKind !== 'bgm';
    $('mura-se').hidden = muraKind !== 'se';
  }
  $('mura-kinds').addEventListener('click', function (e) {
    var c = e.target.closest('[data-kind]');
    if (!c) return;
    muraKind = c.getAttribute('data-kind');
    renderMuraKinds();
    try { sessionStorage.setItem('bcMusicKind', muraKind); } catch (err) {}
  });

  $('bc-fmts').addEventListener('click', function (e) {
    var c = e.target.closest('[data-fmt]');
    if (!c) return;
    bcFmt = c.getAttribute('data-fmt');
    bcCat = 'all';
    renderBcKinds();
    renderBc();
    markPlaying();
  });
  $('bc-kinds').addEventListener('click', function (e) {
    var c = e.target.closest('[data-kind]');
    if (!c) return;
    bcKind = c.getAttribute('data-kind');
    bcCat = 'all';
    renderBcKinds();
    renderBc();
    markPlaying();
  });
  $('bc-cat').addEventListener('change', function (e) {
    bcCat = e.target.value;
    renderBc();
    markPlaying();
  });
  $('bc-search').addEventListener('input', function (e) {
    bcQuery = e.target.value.trim();
    renderBc();
    markPlaying();
  });
  $('bc-play-all').addEventListener('click', function () {
    playQueue(listItems('bc'), 0, bcName());
  });

  $('bgm-play-all').addEventListener('click', function () {
    playQueue(listItems('bgm'), 0, SRC_NAMES.bgm);
  });
  $('other-play-all').addEventListener('click', function () {
    playQueue(listItems('other'), 0, SRC_NAMES.other);
  });
  $('bgm-add-all').addEventListener('click', function () { addAll(bgmList); });
  $('other-add-all').addEventListener('click', function () { addAll(otherList); });
  function addAll(list) {
    var added = 0;
    list.forEach(function (t) {
      if (!countInPlaylist(t.id)) { playlist.push({ id: t.id, loop: 1 }); added++; }
    });
    savePlaylist();
    renderAll();
    toast(added ? added + '曲を追加しました' : 'すべて追加済みです');
  }
  $('pl-play').addEventListener('click', function () {
    var s = shuffle; shuffle = false;
    playQueue(listItems('pl'), 0, 'プレイリスト');
    shuffle = s;
  });
  $('pl-shuffle-play').addEventListener('click', function () {
    playQueue(shuffleArray(listItems('pl')), 0, 'プレイリスト（シャッフル）');
  });
  $('pl-share').addEventListener('click', function () {
    if (!playlist.length) { toast('プレイリストが空です'); return; }
    var url = shareUrl();
    copyText(url).then(function () {
      toast('共有URLをコピーしました');
    }, function () {
      prompt('このURLをコピーしてください', url);
    });
  });

  $('shared-play').addEventListener('click', function () {
    playQueue(listItems('shared'), 0, '共有プレイリスト');
  });
  $('shared-append').addEventListener('click', function () {
    shared.forEach(function (e) { playlist.push({ id: e.id, loop: e.loop }); });
    savePlaylist();
    renderAll();
    toast(shared.length + '件を追加しました');
  });
  $('shared-replace').addEventListener('click', function () {
    if (playlist.length && !confirm('自分のプレイリスト（' + playlist.length + '件）を、共有されたプレイリストで置き換えますか？')) return;
    playlist = shared.map(function (e) { return { id: e.id, loop: e.loop }; });
    syncQueueAfterEdit(function () { return -1; });
    savePlaylist();
    renderAll();
    toast('プレイリストを置き換えました');
  });
  $('shared-close').addEventListener('click', function () {
    closeShared();
    markPlaying();
  });

  $('pl-clear').addEventListener('click', function () {
    if (!confirm('プレイリストをすべて削除しますか？')) return;
    playlist = [];
    syncQueueAfterEdit(function () { return -1; });
    savePlaylist();
    renderAll();
  });

  $('pp-toggle').addEventListener('click', togglePlay);
  $('pp-next').addEventListener('click', function () { next(false); });
  $('pp-prev').addEventListener('click', prev);
  $('pp-shuffle').addEventListener('click', function () {
    shuffle = !shuffle;
    this.classList.toggle('mode-on', shuffle);
    if (shuffle && queue.length) {
      var cur = queue.splice(queuePos, 1)[0];
      shuffleArray(queue);
      queue.unshift(cur);
      queuePos = 0;
      updateSource();
    }
    toast(shuffle ? 'シャッフル: オン' : 'シャッフル: オフ');
  });
  $('pp-repeat').addEventListener('click', function () {
    repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    this.classList.toggle('mode-on', repeat !== 'off');
    var mark = this.querySelector('.repeat-one-mark');
    if (repeat === 'one') {
      if (!mark) this.insertAdjacentHTML('beforeend', '<span class="repeat-one-mark">1</span>');
    } else if (mark) {
      mark.remove();
    }
    reschedule();
    toast({ off: 'リピート: オフ', all: 'リピート: すべて', one: 'リピート: 1曲' }[repeat]);
  });

  var seek = $('pp-seek');
  seek.addEventListener('input', function () {
    seeking = true;
    var d = curBuf ? passLen() : 0;
    $('pp-cur').textContent = fmt(seek.value / 1000 * d);
  });
  seek.addEventListener('change', function () {
    if (curBuf) seekTo(seek.value / 1000 * passLen());
    seeking = false;
  });

  var vol = $('pp-vol');
  try {
    var v = localStorage.getItem(VOL_KEY);
    if (v !== null) vol.value = v;
  } catch (e) {}
  var volume = vol.value / 100;
  vol.addEventListener('input', function () {
    volume = vol.value / 100;
    if (gainNode) gainNode.gain.value = volume;
    try { localStorage.setItem(VOL_KEY, vol.value); } catch (e) {}
  });

  setInterval(function () {
    if (!curBuf) return;
    var dur = passLen();
    var p = passAt(absNow());
    var pc = Math.min(p.count, totalPlays());
    if (pc !== playCount) { playCount = pc; updateSource(); updateMediaPos(); }
    if (seeking) return;
    var pos = pc === p.count ? p.pos : dur;
    seek.value = Math.round(Math.min(pos / dur, 1) * 1000);
    $('pp-cur').textContent = fmt(pos);
  }, 200);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) ctxStale = true;
  });

  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' || /^(INPUT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName)) return;
    if (!queue.length) return;
    e.preventDefault();
    togglePlay();
  });

  // ===== 名前を付けて保存するプレイリスト =====
  var fileMap = {};     // 曲ファイルのパス -> 曲ID (旧サイトの保存データの引き継ぎ用)

  function entriesFromLegacy(tracksArr) {
    return (tracksArr || []).map(function (x) {
      var id = x && fileMap[x.file];
      return id ? { id: id, loop: 1 } : null;
    }).filter(Boolean);
  }
  function getSaved() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); } catch (e) {}
    if (!s || typeof s !== 'object') {
      s = {};
      try {
        var old = JSON.parse(localStorage.getItem('savedPlaylists') || '{}');
        Object.keys(old).forEach(function (name) {
          var entries = entriesFromLegacy(old[name] && old[name].tracks);
          if (entries.length) s[name] = { entries: entries, createdAt: old[name].createdAt };
        });
      } catch (e) {}
      setSaved(s);
    }
    return s;
  }
  function setSaved(s) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function renderSaved() {
    var saved = getSaved(), names = Object.keys(saved);
    var box = $('saved-box');
    if (!names.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="saved-playlists"><h3>保存済みプレイリスト</h3>' + names.map(function (name) {
      var item = saved[name], enc = encodeURIComponent(name);
      var date = item.createdAt ? new Date(item.createdAt).toLocaleString('ja-JP') : '';
      return '<div class="saved-playlist-item">' +
        '<div class="saved-playlist-name"><strong>' + esc(name) + '</strong> (' + item.entries.length + '曲)' +
        (date ? '<br><small>' + esc(date) + '</small>' : '') + '</div>' +
        '<div class="saved-playlist-actions">' +
        '<button class="text-btn" data-sact="load" data-name="' + enc + '">読込</button>' +
        '<button class="text-btn danger" data-sact="del" data-name="' + enc + '">削除</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }
  $('saved-box').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sact]');
    if (!b) return;
    var name = decodeURIComponent(b.getAttribute('data-name'));
    var saved = getSaved();
    if (!saved[name]) return;
    if (b.getAttribute('data-sact') === 'load') {
      if (playlist.length && !confirm('いまのプレイリストを「' + name + '」で置き換えますか？')) return;
      playlist = saved[name].entries.map(normEntry).filter(function (x) { return x && tracks[x.id]; });
      syncQueueAfterEdit(function () { return -1; });
      savePlaylist();
      renderAll();
      toast('「' + name + '」を読み込みました');
    } else if (confirm('「' + name + '」を削除しますか？')) {
      delete saved[name];
      setSaved(saved);
      renderSaved();
    }
  });
  $('save-btn').addEventListener('click', function () {
    var input = $('save-name'), name = input.value.trim();
    if (!name) { toast('プレイリスト名を入力してください'); return; }
    if (!playlist.length) { toast('プレイリストが空です'); return; }
    var saved = getSaved();
    if (saved[name] && !confirm('「' + name + '」は既に存在します。上書きしますか？')) return;
    saved[name] = { entries: playlist.map(function (e) { return { id: e.id, loop: e.loop }; }), createdAt: new Date().toISOString() };
    setSaved(saved);
    input.value = '';
    renderSaved();
    toast('「' + name + '」として保存しました');
  });

  // ===== データ読み込み =====
  function loadJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' : HTTP ' + r.status);
      return r.json();
    }).catch(function (e) { e.optional = true; return { __error: e }; });
  }
  function dataOf(res) { return res && !res.__error ? res : null; }

  // 曲ファイルのパス: 「/」「http」で始まるものはそのまま、それ以外は MUSIC_BASE からの相対パス
  function resolveFile(p) {
    return /^(\/|https?:)/.test(p) ? p : MUSIC_BASE + p;
  }
  // OGG の曲番号は、MP3 の番号に 1000 を足したもの (例: 5 → 1005、34_0 → 1034_0)
  function oggNum(n) {
    if (typeof n === 'number') return n + 1000;
    return String(n).replace(/^\d+/, function (d) { return String(1000 + Number(d)); });
  }

  // にゃんこ大戦争: tracks.json の bc。1曲に mp3 / ogg のファイルを書くと、それぞれ別の曲として並びます
  //   { "n": 0, "title": "…", "ver": "1.0", "kind": "bgm", "cat": "regular", "dur": 127.4,
  //     "mp3": "mp3/000.mp3", "ogg": "ogg/000.ogg" }
  function addBc(list) {
    (list || []).forEach(function (s) {
      BC_FMTS.forEach(function (fmt) {
        if (!s[fmt]) return;
        var n = fmt === 'ogg' ? (s.ogg_n !== undefined ? s.ogg_n : oggNum(s.n)) : s.n;
        var t = {
          id: 'BC' + fmt + '_' + n, n: n, type: 'bc', fmt: fmt,
          title: s.title, file: resolveFile(s[fmt]), ver: s.ver,
          dur: s.dur, cat: s.cat, kind: s.kind, loopStart: s.loopStart
        };
        tracks[t.id] = t;
        bcList.push(t);
        byNum[n] = t.id;
        fileMap[t.file] = t.id;
      });
    });
  }

  // にゃんこ村など: tracks.json の bgm / se / other
  function addNyanko(data) {
    var seq = 0;
    function prep(t, type) {
      t.type = type;
      t.file = resolveFile(t.file);
      if (t.dl) t.dl = resolveFile(t.dl);
      // 共有URL用の番号。大戦争の番号(0〜)とぶつからないよう 100000 以降を使う
      var orig = typeof t.n === 'number' ? t.n : seq;
      byPn[orig] = t.id;   // 元サイトの ?p= リンクの番号
      var want = 100000 + orig;
      while (byNum[want]) want++;
      t.n = want;
      byNum[want] = t.id;
      seq++;
      tracks[t.id] = t;
      return t;
    }
    bgmList = (data.bgm || []).map(function (t) { return prep(t, 'bgm'); })
      .sort(function (a, b) {
        var ia = BGM_ORDER.indexOf(a.id), ib = BGM_ORDER.indexOf(b.id);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    seList = (data.se || []).map(function (t) { return prep(t, 'se'); });
    otherList = (data.other || []).map(function (t) { return prep(t, 'other'); });
  }

  function sharedFromQuery(qs) {
    var packed = qs.get('p'), plain = qs.get('pl'), sd = qs.get('sd');
    if (packed !== null) return unpackEntries(packed);
    if (plain !== null) return decodeIds(plain);
    if (sd !== null) return parseSd(sd);   // ?sd=曲番号,曲番号xループ回数,...
    return null;
  }

  function showTab(tab) {
    var btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
    if (btn && !btn.hidden) btn.click();
  }

  loadJson(TRACKS_JSON).then(function (res) {
    var data = dataOf(res);
    if (!data) throw res.__error || new Error(TRACKS_JSON + ' がありません');
    addBc(data.bc);
    addNyanko(data);
    // 元サイトの ?p= リンクの、大戦争の曲の番号 (bc_start から bc_order の順に並んでいた)
    var lp = data.legacy_p || {};
    (lp.bc_order || []).forEach(function (n, i) {
      if (byNum[String(n)]) byPn[(lp.bc_start || 0) + i] = byNum[String(n)];
    });
    if (!bcList.some(function (t) { return t.fmt === 'mp3'; })) bcFmt = 'ogg';

    var firstRun = false;
    try { firstRun = localStorage.getItem(PL_KEY) === null; } catch (e) {}
    playlist = loadPlaylist();
    if (firstRun) {   // 旧サイトのプレイリストを引き継ぐ
      try {
        var old = JSON.parse(localStorage.getItem('playlist') || 'null');
        if (Array.isArray(old)) { playlist = entriesFromLegacy(old); savePlaylist(); }
      } catch (e) {}
    }

    var qs = new URLSearchParams(location.search);
    var sh = sharedFromQuery(qs);
    if (sh !== null) {
      shared = sh;
      if (!shared.length) {
        closeShared();
        toast('共有されたプレイリストを読み込めませんでした');
      }
    }
    var fmtParam = qs.get('fmt');
    if (fmtParam && BC_FMTS.indexOf(fmtParam) !== -1 && bcList.some(function (t) { return t.fmt === fmtParam; })) bcFmt = fmtParam;

    var hasMura = bgmList.length > 0 || seList.length > 0;
    if (!bgmList.length && seList.length) muraKind = 'se';
    try { if (sessionStorage.getItem('bcMusicKind') === 'se' && seList.length) muraKind = 'se'; } catch (e) {}
    document.querySelector('.tab-btn[data-tab="mura"]').hidden = !hasMura;
    $('panel-mura').hidden = true;
    $('panel-bc').hidden = true;
    $('panel-playlist').hidden = true;

    renderSeCats();
    renderMuraKinds();
    renderBcKinds();
    renderSaved();
    renderAll();

    var tab = shared.length ? 'playlist' : qs.get('tab');
    try { if (!tab) tab = sessionStorage.getItem('bcMusicTab'); } catch (e) {}
    if (tab !== 'mura' && tab !== 'bc' && tab !== 'playlist') tab = hasMura ? 'mura' : 'bc';
    if (tab === 'mura' && !hasMura) tab = 'bc';
    showTab(tab);
  }).catch(function (err) {
    console.error(err);
    $('bc-list').innerHTML = '<li class="track"><div class="track-info track-sub">データの読み込みに失敗しました（' +
      esc(err && err.message ? err.message : err) + '）</div></li>';
    $('panel-bc').hidden = false;
  });
})();
