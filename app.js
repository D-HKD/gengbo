/* ============================================================
   更簿 · 執勤記錄  —  app.js
   純前端、零依賴、離線可用。資料只存 localStorage。
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 常數 ---------------- */
  var KEY = 'gengbo.v1';
  var DEFAULT_TARGET = 576; // 9 小時 36 分
  var STALE_MS = 16 * 3600 * 1000;

  var TYPES = {
    on:        { label: '返工',    icon: 'i-door-in',   color: '#2fd07e', point: true },
    off:       { label: '放工',    icon: 'i-door-out',  color: '#8b98ab', point: true },
    intake:    { label: '接案件',  icon: 'i-folder',    color: '#4c8dff' },
    statement: { label: '攞口供',  icon: 'i-pen',       color: '#b07cff' },
    casework:  { label: '處理案件', icon: 'i-briefcase', color: '#38d0e0' },
    patrol:    { label: '巡邏',    icon: 'i-shield',    color: '#ff8a3d' },
    traffic:   { label: '交通',    icon: 'i-car',       color: '#f2c531' },
    arrest:    { label: '拘捕',    icon: 'i-cuffs',     color: '#ff5d5d' },
    admin:     { label: '文書',    icon: 'i-doc',       color: '#7c8bff' },
    meeting:   { label: '開會',    icon: 'i-users',     color: '#ff6fb5' },
    training:  { label: '訓練',    icon: 'i-target',    color: '#2ec4b6' },
    meal:      { label: '用膳',    icon: 'i-cup',       color: '#e8a33d' },
    break:     { label: '小休',    icon: 'i-coffee',    color: '#9ccc4e' },
    other:     { label: '其他',    icon: 'i-dots',      color: '#93a2b8' }
  };

  var ACTION_TYPES = ['intake', 'statement', 'casework', 'patrol', 'traffic', 'arrest',
    'admin', 'meeting', 'training', 'meal', 'break', 'other'];

  var CASE_CATS = ['盜竊', '傷人 / 襲擊', '刑事毀壞', '交通', '家庭暴力', '詐騙', '毒品',
    '公眾秩序', '雜項', '其他'];

  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  var DAY = 86400000;

  /* 更表（Firebase Firestore，公開讀取） */
  var ROSTER = {
    project: 'daniel-shift',
    apiKey: 'AIzaSyBemgBWSqUa56Mlz_LlqZ-vQMxLvIALR2k',
    editorUrl: 'https://d-hkd.github.io/shift-roster/',
    ttl: 10 * 60000
  };
  var SHIFT_TYPE = {
    A: { name: 'A 更', cls: 'a' },
    B: { name: 'B 更', cls: 'b' },
    C: { name: 'C 更', cls: 'c' },
    E: { name: 'E 更', cls: 'e' },
    OFF: { name: '休息', cls: 'off' }
  };

  /* ---------------- 小工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function now() { return Date.now(); }
  function uid() {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ic(name, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + '><use href="#' + name + '"/></svg>';
  }
  function startOfDay(ms) {
    var d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function startOfWeek(ms) {
    var d = new Date(startOfDay(ms));
    var w = (d.getDay() + 6) % 7; // Monday = 0
    return d.getTime() - w * DAY;
  }
  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtHM(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(t / 3600) + ':' + pad(Math.floor((t % 3600) / 60));
  }
  function fmtHMS(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(t / 3600) + ':' + pad(Math.floor((t % 3600) / 60)) + ':' + pad(t % 60);
  }
  function fmtHuman(ms) {
    var t = Math.max(0, Math.floor(ms / 60000));
    var h = Math.floor(t / 60), m = t % 60;
    if (h && m) return h + '小時' + m + '分';
    if (h) return h + '小時';
    return m + '分';
  }
  function fmtTime(ms) {
    var d = new Date(ms);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtTimeS(ms) {
    var d = new Date(ms);
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function fmtDateLabel(ms) {
    var d = new Date(ms);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + WEEKDAYS[d.getDay()];
  }
  function fmtDateShort(ms) {
    var d = new Date(ms);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fmtDateInput(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtTimeInput(ms) { return fmtTime(ms); }
  function hmToStr(min) { return Math.floor(min / 60) + ':' + pad(min % 60); }

  function toast(msg, iconName) {
    var wrap = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = ic(iconName || 'i-check') + '<span>' + esc(msg) + '</span>';
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    }, 2100);
  }

  function haptic() {
    if (!state.settings.haptic) return;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
  }

  /* ---------------- 資料 ---------------- */
  function blankState() {
    return {
      v: 1,
      settings: {
        name: '', target: DEFAULT_TARGET, deductMeal: false,
        theme: 'auto', wake: false, haptic: true, seen: false
      },
      cases: [],
      entries: [],
      rosters: {}
    };
  }

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blankState();
      var d = JSON.parse(raw);
      var s = blankState();
      s.settings = Object.assign(s.settings, d.settings || {});
      s.cases = Array.isArray(d.cases) ? d.cases : [];
      s.entries = Array.isArray(d.entries) ? d.entries.sort(byStart) : [];
      s.rosters = d.rosters && typeof d.rosters === 'object' ? d.rosters : {};
      return s;
    } catch (e) {
      console.warn('讀取資料失敗', e);
      return blankState();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      toast('儲存失敗，請檢查瀏覽器儲存空間');
      return false;
    }
  }

  function byStart(a, b) { return a.s - b.s; }
  function targetMs() { return (Number(state.settings.target) || DEFAULT_TARGET) * 60000; }

  /* ---------------- 更表 ---------------- */
  function rosterFor(year) {
    var r = state.rosters[String(year)];
    return r && r.days ? r : null;
  }

  function shiftOn(dayMs) {
    var r = rosterFor(new Date(dayMs).getFullYear());
    if (!r) return null;
    return r.days[dayKey(dayMs)] || null;
  }

  function shiftMins(s) {
    if (!s || !s.start || !s.end) return null;
    var a = String(s.start).split(':');
    var b = String(s.end).split(':');
    if (a.length < 2 || b.length < 2) return null;
    var st = Number(a[0]) * 60 + Number(a[1]);
    var en = Number(b[0]) * 60 + Number(b[1]);
    if (en <= st) en += 1440;
    return en - st;
  }

  function shiftMs(s) {
    var m = shiftMins(s);
    return m == null ? null : m * 60000;
  }

  /* 該日嘅目標工時：有更份就用更份長度，休息日 = 0 */
  function dayTarget(dayStart) {
    var s = shiftOn(dayStart);
    if (s) {
      if (s.type === 'OFF') return 0;
      var ms = shiftMs(s);
      if (ms) return ms;
    }
    return targetMs();
  }

  function rosterLabel(s) {
    if (!s) return '未有更份';
    if (s.type === 'OFF') return '休息日';
    var t = SHIFT_TYPE[s.type];
    return (t ? t.name : s.type) + ' · ' + (s.start || '') + '–' + (s.end || '');
  }

  function parseRosterDoc(doc) {
    var days = {};
    var fields = (doc && doc.fields) || {};
    var map = fields.days && fields.days.mapValue && fields.days.mapValue.fields;
    if (!map) return days;
    Object.keys(map).forEach(function (k) {
      var v = (map[k].mapValue && map[k].mapValue.fields) || {};
      days[k] = {
        type: v.type ? v.type.stringValue : '',
        start: v.start ? v.start.stringValue : '',
        end: v.end ? v.end.stringValue : '',
        note: v.note ? v.note.stringValue : ''
      };
    });
    return days;
  }

  var rosterBusy = false;

  function fetchRoster(year, force) {
    var key = String(year);
    var cached = rosterFor(year);
    if (!force && cached && Date.now() - (cached.at || 0) < ROSTER.ttl) {
      return Promise.resolve(cached);
    }
    if (rosterBusy) return Promise.resolve(cached);
    rosterBusy = true;
    var url = 'https://firestore.googleapis.com/v1/projects/' + ROSTER.project +
      '/databases/(default)/documents/rosters/' + year + '?key=' + ROSTER.apiKey;
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (doc) {
        var days = parseRosterDoc(doc);
        if (!Object.keys(days).length) throw new Error('empty');
        state.rosters[key] = { days: days, at: Date.now() };
        save();
        return state.rosters[key];
      })
      .catch(function (err) {
        console.warn('更表讀取失敗：', err && err.message);
        return cached;
      })
      .then(function (out) {
        rosterBusy = false;
        return out;
      });
  }

  function ensureRoster(force) {
    var y = new Date().getFullYear();
    return fetchRoster(y, force).then(function (r) {
      // 12 月順便攞埋下一年，方便跨年睇
      var m = new Date().getMonth();
      if (m >= 10) return fetchRoster(y + 1, force).then(function () { return r; });
      return r;
    });
  }

  /* ---------------- 推導 ---------------- */
  function activeEntry() {
    for (var i = state.entries.length - 1; i >= 0; i--) {
      var e = state.entries[i];
      if (e.e == null && e.t !== 'on' && e.t !== 'off') return e;
    }
    return null;
  }

  function dutySessions() {
    var evs = state.entries.filter(function (e) { return e.t === 'on' || e.t === 'off'; });
    var out = [], cur = null, curOn = null;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.t === 'on') {
        if (cur != null) out.push({ start: cur, end: e.s, open: false, onId: curOn, offId: null });
        cur = e.s;
        curOn = e.id;
      } else if (e.t === 'off' && cur != null) {
        out.push({ start: cur, end: e.s, open: false, onId: curOn, offId: e.id });
        cur = null;
        curOn = null;
      }
    }
    if (cur != null) out.push({ start: cur, end: null, open: true, onId: curOn, offId: null });
    return out;
  }

  function lastSession() {
    var s = dutySessions();
    return s.length ? s[s.length - 1] : null;
  }

  /* 首頁聚焦嘅日子：進行中／剛完成嘅更次所屬嗰日 */
  function heroDay() {
    var t = now();
    var s = lastSession();
    if (!s) return startOfDay(t);
    if (s.open) return startOfDay(s.start);
    if (s.end && t - s.end < 12 * 3600e3 && startOfDay(s.start) !== startOfDay(t)) {
      return startOfDay(s.start);
    }
    return startOfDay(t);
  }

  /* 更表上該更嘅收工時間（跨夜會自動加一日） */
  function scheduleEndFor(sessionStart) {
    var sh = shiftOn(startOfDay(sessionStart));
    if (!sh || sh.type === 'OFF' || !sh.start || !sh.end) return null;
    var hm = String(sh.end).split(':');
    if (hm.length < 2) return null;
    var d = new Date(startOfDay(sessionStart));
    d.setHours(Number(hm[0]), Number(hm[1]), 0, 0);
    var t = d.getTime();
    if (t <= sessionStart) t += DAY;
    return t;
  }

  function isOnDuty() {
    var evs = state.entries.filter(function (e) { return e.t === 'on' || e.t === 'off'; });
    return evs.length ? evs[evs.length - 1].t === 'on' : false;
  }

  function openSession() {
    var s = dutySessions();
    return s.length && s[s.length - 1].open ? s[s.length - 1] : null;
  }

  function entryMs(e, at) {
    var end = e.e == null ? (at || now()) : e.e;
    return Math.max(0, end - e.s);
  }

  function mealMsBetween(from, arr) {
    var total = 0;
    arr.forEach(function (e) {
      if (e.t === 'meal' || e.t === 'break') total += entryMs(e);
    });
    return total;
  }

  /* 每日當值 / OT */
  function dayStats(dayStart) {
    var dayEnd = dayStart + DAY;
    var sess = dutySessions().filter(function (s) { return s.start >= dayStart && s.start < dayEnd; });
    var total = 0, meal = 0;
    var at = now();
    sess.forEach(function (s) {
      var end = s.end == null ? at : s.end;
      total += Math.max(0, end - s.start);
    });
    state.entries.forEach(function (e) {
      if (e.s >= dayStart && e.s < dayEnd && (e.t === 'meal' || e.t === 'break')) {
        meal += entryMs(e, at);
      }
    });
    var eff = Math.max(0, total - (state.settings.deductMeal ? meal : 0));
    var tgt = dayTarget(dayStart);
    return {
      total: total, meal: meal, effective: eff, open: sess.some(function (s) { return s.open; }),
      target: tgt, shift: shiftOn(dayStart),
      ot: Math.max(0, eff - tgt), under: Math.max(0, tgt - eff)
    };
  }

  function periodRange(period, custom) {
    var t = now(), from, to;
    if (period === 'today') {
      // 跨夜更：跟返首頁顯示嗰一日，唔會變咗 0
      from = heroDay();
      to = from + DAY;
    }
    else if (period === 'week') { from = startOfWeek(t); to = from + 7 * DAY; }
    else if (period === 'month') {
      var d = new Date(t); d.setDate(1); d.setHours(0, 0, 0, 0);
      from = d.getTime();
      var e = new Date(from); e.setMonth(e.getMonth() + 1);
      to = e.getTime();
    } else {
      from = custom && custom.from ? custom.from : startOfDay(t);
      to = (custom && custom.to ? custom.to : startOfDay(t)) + DAY;
    }
    return { from: from, to: to };
  }

  function statsFor(range) {
    var days = [], from = range.from, to = Math.min(range.to, now() + 60000);
    for (var d = from; d < to; d += DAY) days.push(d);

    var total = 0, ot = 0, workedDays = 0, targetTotal = 0, meal = 0;
    days.forEach(function (d) {
      var st = dayStats(d);
      if (st.total > 0 || st.open) {
        workedDays++;
        targetTotal += st.target;
        total += st.effective;
        ot += st.ot;
        meal += st.meal;
      }
    });

    var byType = {}, caseTime = {};
    state.entries.forEach(function (e) {
      if (e.s < from || e.s >= to) return;
      if (e.t === 'on' || e.t === 'off') return;
      var ms = entryMs(e);
      byType[e.t] = (byType[e.t] || 0) + ms;
      if (e.c) caseTime[e.c] = (caseTime[e.c] || 0) + ms;
    });

    return {
      days: days, total: total, ot: ot, workedDays: workedDays,
      targetTotal: targetTotal, meal: meal, byType: byType, caseTime: caseTime
    };
  }

  /* ---------------- 表情 / 主題 ---------------- */
  function applyTheme() {
    var mode = state.settings.theme || 'auto';
    var dark = mode === 'dark' ||
      (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b0f17' : '#eef2f8');
    var btn = $('#btnTheme');
    if (btn) btn.innerHTML = ic(mode === 'light' ? 'i-sun' : mode === 'dark' ? 'i-moon' : 'i-bolt');
  }
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', applyTheme);

  /* ---------------- 動作 ---------------- */
  function addEntry(data) {
    state.entries.push(data);
    state.entries.sort(byStart);
    save();
  }

  function closeActive(at) {
    var a = activeEntry();
    if (!a) return null;
    a.e = Math.max(at, a.s + 1000);
    save();
    return a;
  }

  function clockIn() {
    haptic();
    var stale = openSession();
    if (stale && now() - stale.start > STALE_MS) {
      var lastEnd = stale.start;
      for (var i = state.entries.length - 1; i >= 0; i--) {
        var e = state.entries[i];
        if (e.s <= now() && (e.e != null || e.t === 'on' || e.t === 'off')) {
          if (e.e != null && e.s >= stale.start) { lastEnd = Math.max(lastEnd, e.e); break; }
        }
      }
      addEntry({ id: uid(), t: 'off', s: lastEnd, e: lastEnd });
      toast('上次未放工，已自動補到 ' + fmtTime(lastEnd));
    } else if (isOnDuty()) {
      toast('你已經返咗工喇');
      return;
    }
    addEntry({ id: uid(), t: 'on', s: now(), e: now() });
    renderAll();
    wakeLock(true);
    toast('返工 ' + fmtTime(now()));
  }

  function clockOut(at) {
    at = at || now();
    haptic();
    if (!isOnDuty()) { toast('你未返工'); return; }
    var a = activeEntry();
    var extra = '';
    if (a) {
      closeActive(at);
      extra = '（已完結' + TYPES[a.t].label + '）';
    }
    addEntry({ id: uid(), t: 'off', s: at, e: at });
    renderAll();
    wakeLock(false);
    toast('放工 ' + fmtTime(at) + extra);
  }

  function askClockOut() {
    var sess = lastSession();
    var act = activeEntry();
    var t0 = now();
    var schedEnd = sess ? scheduleEndFor(sess.start) : null;
    var late = schedEnd && t0 - schedEnd > 60 * 60000;
    var tail = act ? '　進行中嘅「' + TYPES[act.t].label + '」會一併完結。' : '';

    if (late) {
      askConfirm({
        title: '放工',
        body: '更表寫 ' + fmtTime(schedEnd) + ' 收工，而家已經 ' + fmtTime(t0) +
          '（多咗 ' + fmtHM(t0 - schedEnd) + '）。' + tail,
        ok: '用更表時間 ' + fmtTime(schedEnd),
        alt: '用而家時間 ' + fmtTime(t0)
      }).then(function (c) {
        if (!c) return;
        clockOut(c === 'alt' ? now() : schedEnd);
      });
    } else {
      askConfirm({
        title: '放工',
        body: '確認 ' + fmtTime(t0) + ' 放工？' + tail,
        ok: '放工'
      }).then(function (yes) { if (yes) clockOut(t0); });
    }
  }

  function startActivity(type, caseId) {
    haptic();
    if (type === 'intake') { openCaseSheet(); return; }
    if ((type === 'statement' || type === 'casework') && caseId === undefined) {
      var open = state.cases.filter(function (c) { return c.status === 'open'; });
      if (open.length) { pickCaseSheet(type); return; }
    }
    var t = now();
    closeActive(t);
    addEntry({ id: uid(), t: type, s: t, e: null, c: caseId || null, n: '', p: '' });
    renderAll();
    if (!isOnDuty() && type !== 'meal' && type !== 'break') {
      toast('開始：' + TYPES[type].label + '（你未撳返工）');
    } else {
      toast('開始：' + TYPES[type].label);
    }
  }

  function stopActivity() {
    var a = activeEntry();
    if (!a) return;
    var ms = entryMs(a);
    closeActive(now());
    renderAll();
    toast(TYPES[a.t].label + ' 完結 · ' + fmtHuman(ms));
  }

  function tapType(type) {
    var a = activeEntry();
    if (a && a.t === type) { stopActivity(); return; }
    if (type === 'intake') { openCaseSheet(); return; }
    startActivity(type);
  }

  /* ---------------- 畫面：Home ---------------- */
  function statusOf() {
    if (isOnDuty()) return { on: true, text: '當值中' };
    var today = startOfDay(now());
    var last = null;
    for (var i = state.entries.length - 1; i >= 0; i--) {
      var e = state.entries[i];
      if (e.t === 'on' || e.t === 'off') { last = e; break; }
    }
    if (last && last.t === 'off' && last.s >= today) return { on: false, text: '已收工' };
    return { on: false, text: '未返工' };
  }

  function renderHome() {
    var t = now();
    var day = heroDay();
    var st = dayStats(day);
    var status = statusOf();
    var sh = st.shift;
    var hero = $('#hero');
    var isToday = day === startOfDay(t);

    if (!status.on && sh && sh.type === 'OFF' && isToday) status = { on: false, text: '今日休息' };

    hero.classList.toggle('is-on', status.on);

    var pill = $('#statusPill');
    pill.innerHTML = '<i class="pip"></i><span>' + status.text + '</span>';

    var chip = $('#shiftChip');
    if (sh && isToday) {
      var stype = SHIFT_TYPE[sh.type];
      chip.className = 'shift-chip t-' + (stype ? stype.cls : 'off');
      chip.textContent = rosterLabel(sh);
      chip.classList.remove('hidden');
    } else {
      chip.classList.add('hidden');
    }

    var total = st.total;
    var parts = fmtHMS(total).split(':');
    $('#dutyBig').textContent = parts[0] + ':' + parts[1];
    $('#dutySec').textContent = ':' + parts[2];
    $('#dutyUnit').textContent = status.on
      ? (isToday ? '今更' : '今更')
      : (isToday ? '今日總當值' : fmtDateShort(day) + ' 當值');

    var tgt = st.target;
    var pct = tgt > 0 ? Math.min(100, (total / tgt) * 100) : (total > 0 ? 100 : 0);
    var prog = $('#dutyProgress');
    $('#dutyBar').style.width = (total > 0 ? Math.max(1.5, pct) : 0) + '%';
    prog.classList.toggle('is-ot', tgt > 0 && total > tgt);

    // 返工–放工 時間（可撳入去改）
    var sess = lastSession();
    var sameDay = sess && startOfDay(sess.start) === day;
    var timesBtn = $('#shiftTimes');
    if (sameDay) {
      timesBtn.innerHTML = fmtTime(sess.start) + ' – ' +
        (sess.end != null ? fmtTime(sess.end) : '進行中') + ic('i-chevron');
    } else {
      timesBtn.innerHTML = '未開始' + ic('i-chevron');
    }

    if (tgt <= 0) {
      $('#legendTarget').innerHTML = total > 0
        ? '<b class="ot">休息日開工 · OT +' + fmtHM(total) + '</b>'
        : '休息日';
    } else if (total > tgt) {
      $('#legendTarget').innerHTML = '<b class="ot">OT +' + fmtHM(total - tgt) + '</b>';
    } else {
      $('#legendTarget').innerHTML = '目標 <b>' + fmtHM(tgt) + '</b> · 尚餘 ' + fmtHM(tgt - total);
    }

    $('#todayLabel').textContent = isToday ? fmtDateLabel(t) : fmtDateLabel(day);

    // active strip
    var a = activeEntry();
    var strip = $('#activeStrip');
    if (a) {
      strip.classList.remove('is-idle');
      $('#activeIcon').innerHTML = ic(TYPES[a.t].icon);
      $('#activeIcon').style.color = TYPES[a.t].color;
      $('#activeIcon').style.background = 'color-mix(in srgb, ' + TYPES[a.t].color + ' 16%, transparent)';
      var c = a.c ? getCase(a.c) : null;
      $('#activeTitle').innerHTML = esc(TYPES[a.t].label) +
        (c ? ' <span class="case-tag">' + esc(c.no || '案件') + '</span>' : '');
      $('#activeSub').textContent = '由 ' + fmtTime(a.s) + ' 開始' +
        (a.p ? ' · ' + a.p : '');
      $('#activeTime').textContent = fmtHMS(entryMs(a));
      $('#activeTime').className = 'a-time mono';
      strip.onclick = function (ev) {
        if (ev.target.closest('.stop-btn')) return;
        openEditor(a.id);
      };
    } else {
      strip.classList.add('is-idle');
      $('#activeIcon').innerHTML = ic('i-bolt');
      $('#activeIcon').style.color = '';
      $('#activeIcon').style.background = '';
      $('#activeTitle').textContent = status.on ? '未有進行中嘅工作' : '仲未返工';
      $('#activeSub').textContent = status.on ? '揀下面嘅工作開始計時' : '撳「返工」開始今日嘅紀錄';
      $('#activeTime').textContent = '';
      strip.onclick = null;
    }

    var btn = $('#btnClock');
    if (status.on) {
      btn.className = 'clock-btn is-off';
      btn.innerHTML = ic('i-door-out') + '<span>放工</span>';
      btn.onclick = askClockOut;
    } else {
      btn.className = 'clock-btn';
      btn.innerHTML = ic('i-door-in') + '<span>返工</span>';
      btn.onclick = function () { clockIn(); };
    }

    // action grid
    var grid = $('#actionsGrid');
    grid.innerHTML = ACTION_TYPES.map(function (k) {
      var T = TYPES[k];
      var on = a && a.t === k;
      return '<button class="action-btn' + (on ? ' is-active' : '') + '" style="--c:' + T.color +
        '" data-act="type" data-type="' + k + '">' + ic(T.icon) +
        '<span>' + T.label + '</span>' + (on ? '<i class="tick"></i>' : '') + '</button>';
    }).join('');

    $('#actionHint').textContent = a ? '撳返同一個掣即可完結' : '撳一下即開始計時';

    // 焦點日子嘅紀錄
    var todayEntries = state.entries.filter(function (e) { return e.s >= day && e.s < day + DAY; })
      .sort(function (x, y) { return y.s - x.s; });
    var list = $('#todayList');
    if (!todayEntries.length) {
      list.innerHTML = emptyHTML('i-clock', isToday ? '今日未有紀錄' : '呢日未有紀錄',
        '撳「返工」或上面嘅工作掣開始');
    } else {
      list.innerHTML = todayEntries.slice(0, 12).map(rowHTML).join('');
    }
    $('#todayTitle').textContent = isToday ? '今日紀錄' : fmtDateShort(day) + ' 紀錄';
    $('#todayCount').textContent = todayEntries.length ? '(' + todayEntries.length + ')' : '';
  }

  function emptyHTML(icon, title, sub) {
    return '<div class="empty"><div class="ico">' + ic(icon) + '</div><h3>' +
      esc(title) + '</h3><p>' + esc(sub) + '</p></div>';
  }

  function rowHTML(e) {
    var T = TYPES[e.t] || TYPES.other;
    var c = e.c ? getCase(e.c) : null;
    var isPoint = e.t === 'on' || e.t === 'off';
    var live = e.e == null && !isPoint;
    var dur = isPoint ? '' : fmtHM(entryMs(e));
    var sub = isPoint ? fmtTime(e.s)
      : fmtTime(e.s) + (e.e != null ? ' – ' + fmtTime(e.e) : ' – 進行中');
    if (e.p) sub += ' · ' + e.p;
    if (e.n) sub += ' · ' + e.n;
    return '<button class="tl-row" data-act="edit" data-id="' + e.id + '">' +
      '<span class="tl-icon" style="--c:' + T.color + '">' + ic(T.icon) + '</span>' +
      '<span class="tl-body"><span class="tl-title">' + esc(T.label) +
      (c ? ' <span class="case-tag">' + esc(c.no || '案件') + '</span>' : '') +
      (live ? ' <i class="dot-live"></i>' : '') + '</span>' +
      '<span class="tl-sub">' + esc(sub) + '</span></span>' +
      '<span class="tl-dur' + (live ? ' is-live' : '') + '"' +
      (live ? ' data-live="' + e.id + '"' : '') + '>' + dur + '</span></button>';
  }

  /* ---------------- 畫面：案件 ---------------- */
  var caseQuery = '';

  function getCase(id) {
    for (var i = 0; i < state.cases.length; i++) if (state.cases[i].id === id) return state.cases[i];
    return null;
  }

  function caseMs(caseId) {
    var t = 0;
    state.entries.forEach(function (e) {
      if (e.c === caseId) t += entryMs(e);
    });
    return t;
  }

  function renderCases() {
    var open = state.cases.filter(function (c) {
      return c.status !== 'closed' && matchCase(c, caseQuery);
    });
    var closed = state.cases.filter(function (c) {
      return c.status === 'closed' && matchCase(c, caseQuery);
    });
    open.sort(function (a, b) { return b.createdAt - a.createdAt; });
    closed.sort(function (a, b) { return (b.closedAt || 0) - (a.closedAt || 0); });

    $('#casesSub').textContent = state.cases.length
      ? open.length + ' 單處理中 · 共 ' + state.cases.length + ' 單'
      : '未有案件';

    var list = $('#caseList');
    list.innerHTML = open.length
      ? open.map(caseRowHTML).join('')
      : emptyHTML('i-folder', caseQuery ? '搵唔到案件' : '仲未有案件',
        caseQuery ? '試下其他關鍵字' : '撳「新案件」開始記錄，或者直接打卡「接案件」');

    $('#closedCount').textContent = closed.length ? closed.length + ' 單' : '';
    $('#closedList').innerHTML = closed.length ? closed.map(caseRowHTML).join('') : '';
    $('#view-cases').querySelectorAll('.section-head')[0].style.display = closed.length ? '' : 'none';
  }

  function matchCase(c, q) {
    if (!q) return true;
    var s = (c.no + ' ' + c.reporter + ' ' + c.place + ' ' + c.cat + ' ' + (c.note || '')).toLowerCase();
    return s.indexOf(q.toLowerCase()) >= 0;
  }

  function caseRowHTML(c) {
    var ms = caseMs(c.id);
    var isOpen = c.status !== 'closed';
    var badge = (c.cat || '案件').replace(/\s*\/\s*/g, '').slice(0, 2);
    return '<button class="case-row" data-act="case" data-id="' + c.id + '">' +
      '<span class="case-badge' + (isOpen ? '' : ' is-closed') + '">' + esc(badge) + '</span>' +
      '<span class="case-main"><span class="case-no">' + esc(c.no || '未編號') +
      ' <span class="chip ' + (isOpen ? 'open' : 'closed') + '">' + (isOpen ? '處理中' : '已完結') + '</span></span>' +
      '<span class="case-sub">' + esc([c.cat, c.reporter, c.place].filter(Boolean).join(' · ') || '未填資料') + '</span></span>' +
      '<span class="case-right"><span class="case-time">' + (ms ? fmtHM(ms) : '—') + '</span></span></button>';
  }

  /* ---------------- 畫面：紀錄 ---------------- */
  function renderLog() {
    var list = $('#logList');
    if (!state.entries.length) {
      list.innerHTML = emptyHTML('i-list', '仲未有紀錄', '返工、接案件、攞口供都會自動記錄喺度');
      $('#logSub').textContent = '';
      return;
    }
    var groups = {};
    state.entries.slice().sort(function (a, b) { return b.s - a.s; }).forEach(function (e) {
      var k = dayKey(e.s);
      (groups[k] = groups[k] || []).push(e);
    });
    var keys = Object.keys(groups).sort().reverse();
    var html = keys.map(function (k) {
      var d = new Date(k + 'T00:00:00');
      var st = dayStats(d.getTime());
      var head = '<b>' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + WEEKDAYS[d.getDay()] + '</b>';
      var right = '';
      if (st.total > 0) {
        right = '當值 ' + fmtHM(st.total) +
          (st.ot > 0 ? ' · <span class="day-ot">OT +' + fmtHM(st.ot) + '</span>' : '');
        if (st.open) right += ' · 進行中';
      }
      return '<div class="day-group"><div class="day-head"><span>' + head + '</span><span>' + right + '</span></div>' +
        '<div class="timeline">' + groups[k].map(rowHTML).join('') + '</div></div>';
    }).join('');
    list.innerHTML = html;
    var days = keys.length;
    $('#logSub').textContent = days + ' 日紀錄 · ' + state.entries.length + ' 項';
  }

  /* ---------------- 畫面：統計 ---------------- */
  var statsPeriod = 'today';
  var customRange = { from: null, to: null };

  function renderStats() {
    var range = periodRange(statsPeriod, customRange);
    var st = statsFor(range);

    $('#statsRange').textContent = fmtDateShort(range.from) + ' – ' +
      fmtDateShort(range.to - 1);

    var avg = st.workedDays ? st.total / st.workedDays : 0;
    var cards = [
      { k: '總當值', v: fmtHM(st.total), s: st.workedDays + ' 個當值日', cls: '' },
      {
        k: 'OT', v: (st.ot > 0 ? '+' : '') + fmtHM(st.ot),
        s: st.ot > 0 ? '超出目標' : '未超目標', cls: st.ot > 0 ? 'is-ot' : ''
      },
      { k: '當值日數', v: st.workedDays, s: '共 ' + st.days.length + ' 日', cls: '' },
      { k: '平均每日', v: fmtHM(avg), s: '目標 ' + hmToStr(state.settings.target), cls: '' }
    ];
    $('#statGrid').innerHTML = cards.map(function (c) {
      return '<div class="stat ' + c.cls + '"><div class="k">' + c.k + '</div>' +
        '<div class="v">' + c.v + '</div><div class="s">' + c.s + '</div></div>';
    }).join('');

    // chart：最少顯示 7 日，最長 14 日
    var lastDay = startOfDay(Math.min(range.to - 1, now()));
    var spanDays = Math.round((range.to - range.from) / DAY);
    var count = Math.min(14, Math.max(7, spanDays));
    var days = [];
    for (var di = count - 1; di >= 0; di--) days.push(lastDay - di * DAY);

    // 每日目標可能唔同（更份），虛線用最常見嘅目標
    var tgtCount = {};
    days.forEach(function (d) {
      var v = dayTarget(d);
      tgtCount[v] = (tgtCount[v] || 0) + 1;
    });
    var tgtLine = Number(Object.keys(tgtCount).sort(function (a, b) {
      return tgtCount[b] - tgtCount[a];
    })[0]) || targetMs();

    var maxV = tgtLine * 1.35;
    days.forEach(function (d) {
      var s = dayStats(d);
      maxV = Math.max(maxV, s.effective * 1.08);
    });
    var todayKey = startOfDay(now());
    var chartHTML = days.map(function (d) {
      var s = dayStats(d);
      var pct = Math.max(0, Math.min(100, (s.effective / maxV) * 100));
      var isToday = d === todayKey;
      var cls = s.effective > s.target ? ' is-ot' : (s.effective === 0 ? ' is-empty' : '');
      var label = count > 7 ? String(new Date(d).getDate()) : WEEKDAYS[new Date(d).getDay()];
      return '<div class="col" title="' + fmtDateShort(d) + ' · ' + fmtHM(s.effective) + '">' +
        '<div class="bar-wrap">' +
        '<div class="bar' + cls + (isToday ? ' is-today' : '') + '" style="height:' + pct + '%"></div>' +
        '<div class="tgt" style="bottom:' + Math.min(100, (tgtLine / maxV) * 100) + '%"></div>' +
        '</div><div class="x' + (isToday ? ' is-today' : '') + '">' + label + '</div></div>';
    }).join('');
    $('#chart').innerHTML = chartHTML;
    $('#chartNote').textContent = '虛線 = 目標 ' + fmtHM(tgtLine);

    // breakdown
    var entriesArr = Object.keys(st.byType).map(function (k) {
      return { t: k, ms: st.byType[k] };
    }).sort(function (a, b) { return b.ms - a.ms; }).slice(0, 7);
    var maxType = entriesArr.length ? entriesArr[0].ms : 1;
    $('#breakdown').innerHTML = entriesArr.length
      ? entriesArr.map(function (x) {
        var T = TYPES[x.t] || TYPES.other;
        return '<div class="bd-row"><span class="bd-name">' + T.label + '</span>' +
          '<span class="bd-track"><i style="width:' + Math.max(3, (x.ms / maxType) * 100) +
          '%;--c:' + T.color + '"></i></span>' +
          '<span class="bd-val">' + fmtHM(x.ms) + '</span></div>';
      }).join('')
      : '<p class="muted" style="font-size:12.5px;text-align:center;padding:10px 0">呢段時間未有活動紀錄</p>';
    $('#breakdownTotal').textContent = st.total ? '當值 ' + fmtHM(st.total) : '';

    // case time
    var cs = Object.keys(st.caseTime).map(function (id) {
      return { c: getCase(id), ms: st.caseTime[id] };
    }).filter(function (x) { return x.c; }).sort(function (a, b) { return b.ms - a.ms; }).slice(0, 6);
    var maxCase = cs.length ? cs[0].ms : 1;
    $('#caseTimeList').innerHTML = cs.length
      ? cs.map(function (x) {
        return '<div class="case-row" style="cursor:default">' +
          '<span class="case-badge">' + esc((x.c.cat || '案').slice(0, 2)) + '</span>' +
          '<span class="case-main"><span class="case-no">' + esc(x.c.no || '未編號') + '</span>' +
          '<span class="case-sub">' + esc(x.c.reporter || '未填報案人') + '</span></span>' +
          '<span class="case-right"><span class="case-time">' + fmtHM(x.ms) + '</span></span></div>';
      }).join('')
      : emptyHTML('i-folder', '未有案件工時', '將活動連結到案件，就會喺度顯示');
    $('#caseTimeNote').textContent = cs.length ? cs.length + ' 單' : '';

    $('#periodSeg').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.period === statsPeriod);
    });
  }

  /* ---------------- 畫面：更表 ---------------- */
  var calYear = null;
  var calMonth = null;

  function renderRoster() {
    var t = now();
    if (calYear == null) {
      calYear = new Date(t).getFullYear();
      calMonth = new Date(t).getMonth();
    }
    var year = calYear, month = calMonth;
    var first = new Date(year, month, 1);
    var monthLen = new Date(year, month + 1, 0).getDate();
    var lead = first.getDay();
    var todayKey = dayKey(t);

    $('#calMonth').textContent = year + '年 ' + (month + 1) + '月';

    var r = rosterFor(year);
    var totalDays = r ? Object.keys(r.days).length : 0;
    var todayShift = shiftOn(t);
    var sub = todayShift ? '今日：' + rosterLabel(todayShift) : '今日：未有更份';
    if (r && r.at) {
      var mins = Math.round((t - r.at) / 60000);
      sub += ' · 更新 ' + (mins < 1 ? '啱啱' : mins < 60 ? mins + '分鐘前' : Math.round(mins / 60) + '小時前');
    } else if (!r) {
      sub = '未能讀取更表（需要網絡一次）';
    }
    $('#rosterSub').textContent = sub;

    var cells = [];
    for (var i = 0; i < lead; i++) cells.push('<div class="cal-cell is-blank"></div>');

    var monthDuty = 0, monthOt = 0, workedDays = 0, shifts = 0;

    for (var dnum = 1; dnum <= monthLen; dnum++) {
      var d = new Date(year, month, dnum);
      var key = dayKey(d.getTime());
      var sh = r ? r.days[key] : null;
      var st = dayStats(d.getTime());
      var cls = 'cal-cell';
      if (key === todayKey) cls += ' is-today';
      if (sh && sh.type === 'OFF') cls += ' is-off';
      var codeHTML = '';
      if (sh && sh.type) {
        shifts++;
        var stp = SHIFT_TYPE[sh.type];
        codeHTML = '<span class="cal-code ' + (stp ? stp.cls : 'off') + '">' +
          (sh.type === 'OFF' ? '休' : esc(sh.type)) + '</span>';
      }
      var actHTML = '';
      if (st.total > 0) {
        workedDays++;
        monthDuty += st.effective;
        monthOt += st.ot;
        actHTML = '<span class="cal-actual' + (st.ot > 0 ? ' is-ot' : '') + '">' +
          (st.ot > 0 ? '+' + fmtHM(st.ot) : fmtHM(st.total)) + '</span>';
      }
      cells.push('<button class="' + cls + '" data-act="cal-day" data-key="' + key + '">' +
        '<span class="cal-num">' + dnum + '</span>' + codeHTML + actHTML + '</button>');
    }

    var tail = (7 - ((lead + monthLen) % 7)) % 7;
    for (var j = 0; j < tail; j++) cells.push('<div class="cal-cell is-blank"></div>');

    $('#calGrid').innerHTML = cells.join('');

    var summary = '';
    if (r) {
      summary =
        '<div><div class="k">實際當值</div><div class="v">' + fmtHM(monthDuty) + '</div></div>' +
        '<div><div class="k">OT</div><div class="v" style="color:' +
        (monthOt > 0 ? 'var(--amber)' : 'var(--text-dim)') + '">' + (monthOt > 0 ? '+' : '') + fmtHM(monthOt) + '</div></div>' +
        '<div><div class="k">當值日數</div><div class="v">' + workedDays + '</div></div>';
    } else {
      summary = '<div style="flex:1;font-size:12px;color:var(--text-faint);line-height:1.6">' +
        (totalDays ? '' : '仲未讀到 ' + year + ' 年嘅更表。撳右上角重新整理，或者去更表 App 睇下發佈咗未。') + '</div>';
    }
    $('#calSummary').innerHTML = summary;
    $('#calSummary').style.display = summary ? '' : 'none';
  }

  function openRosterDay(key) {
    var d = new Date(key + 'T00:00:00');
    var sh = rosterFor(d.getFullYear()) ? rosterFor(d.getFullYear()).days[key] : null;
    var st = dayStats(d.getTime());
    var rows = state.entries.filter(function (e) {
      return dayKey(e.s) === key;
    }).sort(function (a, b) { return b.s - a.s; });

    var html =
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
      '<div style="flex:1"><div style="font-size:20px;font-weight:800">' + fmtDateLabel(d.getTime()) + '</div>' +
      '<div style="font-size:12.5px;color:var(--text-faint);margin-top:2px">' +
      (sh ? rosterLabel(sh) : '未編排更份') + '</div></div>' +
      '<div style="text-align:right"><div class="mono" style="font-size:19px;font-weight:600">' +
      (st.total ? fmtHM(st.total) : '—') + '</div>' +
      '<div style="font-size:10.5px;color:var(--text-faint)">實際當值</div></div></div>' +
      (st.ot > 0 ? '<div class="note-box" style="margin-bottom:12px"><svg><use href="#i-bolt"/></svg>' +
        '<span>呢日 OT <b style="color:var(--amber)">+' + fmtHM(st.ot) + '</b>' +
        (st.target > 0 ? '（目標 ' + fmtHM(st.target) + '）' : '（休息日）') + '</span></div>' : '') +
      (sh && sh.note ? '<div class="note-box" style="margin-bottom:12px"><svg><use href="#i-info"/></svg><span>' +
        esc(sh.note) + '</span></div>' : '') +
      '<div class="section-head" style="margin:4px 0 8px"><h2>當日紀錄</h2><span class="count">' +
      (rows.length ? rows.length + ' 項' : '') + '</span></div>' +
      (rows.length ? '<div class="timeline">' + rows.map(rowHTML).join('') + '</div>'
        : '<p class="muted" style="font-size:12.5px;padding:6px 2px">冇紀錄</p>') +
      '<a class="btn btn-ghost btn-block" style="margin-top:14px" href="' + ROSTER.editorUrl +
      '" target="_blank" rel="noopener">' + ic('i-edit') + '去更表 App 睇／改</a>';

    openSheet('更表', html);
  }

  function shiftCal(delta) {
    var d = new Date(calYear, calMonth + delta, 1);
    calYear = d.getFullYear();
    calMonth = d.getMonth();
    renderRoster();
    if (!rosterFor(calYear)) {
      fetchRoster(calYear, false).then(function () { renderRoster(); });
    }
  }
  function renderSettings() {
    $('#nameVal').textContent = state.settings.name || '未設定';
    var th = $('#targetH'), tm = $('#targetM');
    if (document.activeElement !== th) th.value = Math.floor(state.settings.target / 60);
    if (document.activeElement !== tm) tm.value = state.settings.target % 60;

    var swMeal = $('#swDeductMeal');
    swMeal.classList.toggle('is-on', !!state.settings.deductMeal);
    swMeal.setAttribute('aria-checked', state.settings.deductMeal ? 'true' : 'false');

    var swWake = $('#swWake');
    swWake.classList.toggle('is-on', !!state.settings.wake);
    swWake.setAttribute('aria-checked', state.settings.wake ? 'true' : 'false');

    var swHap = $('#swHaptic');
    swHap.classList.toggle('is-on', !!state.settings.haptic);
    swHap.setAttribute('aria-checked', state.settings.haptic ? 'true' : 'false');

    var map = { auto: '跟隨系統', light: '淺色', dark: '深色' };
    $('#themeVal').textContent = map[state.settings.theme] || '跟隨系統';
  }

  function renderAll() {
    renderHome();
    renderCases();
    renderLog();
    renderStats();
    renderRoster();
    renderSettings();
    var t = activeEntry();
    document.body.classList.toggle('is-working', !!t);
  }

  /* ---------------- Sheet ---------------- */
  var confirmResolve = null;
  var sheetOpen = false;

  function openSheet(title, html) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = html;
    $('#backdrop').classList.add('is-open');
    $('#sheet').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    sheetOpen = true;
    var first = $('#sheetBody input, #sheetBody textarea');
    if (first && window.innerWidth > 700) { try { first.focus(); } catch (e) {} }
  }

  function closeSheet() {
    $('#backdrop').classList.remove('is-open');
    $('#sheet').classList.remove('is-open');
    document.body.style.overflow = '';
    sheetOpen = false;
    if (confirmResolve) {
      var r = confirmResolve; confirmResolve = null; r(false);
    }
  }

  function askConfirm(opts) {
    return new Promise(function (resolve) {
      confirmResolve = resolve;
      var buttons = opts.alt
        ? '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') +
          '" data-act="confirm" data-val="1">' + esc(opts.ok || '確定') + '</button>' +
          '<button class="btn btn-ghost" data-act="confirm" data-val="alt">' + esc(opts.alt) + '</button>'
        : '<button class="btn btn-ghost" data-act="confirm" data-val="0">取消</button>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') +
          '" data-act="confirm" data-val="1">' + esc(opts.ok || '確定') + '</button>';

      openSheet(opts.title,
        '<p style="font-size:14px;line-height:1.65;color:var(--text-dim);margin-bottom:18px">' +
        esc(opts.body) + '</p>' +
        '<div class="btn-row" style="flex-direction:column">' + buttons +
        (opts.alt ? '<button class="btn btn-ghost" data-act="confirm" data-val="0">取消</button>' : '') +
        '</div>');
    });
  }

  /* ---------------- 新增 / 編輯案件 ---------------- */
  function openCaseSheet(caseId) {
    var c = caseId ? getCase(caseId) : null;
    var opts = CASE_CATS.map(function (x) {
      return '<option value="' + esc(x) + '"' + (c && c.cat === x ? ' selected' : '') + '>' + esc(x) + '</option>';
    }).join('');
    var body =
      '<div class="field"><label>案件編號</label>' +
      '<input class="input" id="cNo" placeholder="例：CW-2026-0182" value="' + esc(c ? c.no : '') + '" autocomplete="off"></div>' +
      '<div class="field-row">' +
      '<div class="field"><label>類別</label><select class="select" id="cCat">' + opts + '</select></div>' +
      '<div class="field"><label>報案人</label><input class="input" id="cReporter" placeholder="稱呼" value="' +
      esc(c ? c.reporter : '') + '" autocomplete="off"></div></div>' +
      '<div class="field"><label>地點</label><input class="input" id="cPlace" placeholder="例：旺角彌敦道" value="' +
      esc(c ? c.place : '') + '" autocomplete="off"></div>' +
      '<div class="field"><label>備註</label><textarea class="textarea" id="cNote" placeholder="簡短描述，唔好寫敏感資料">' +
      esc(c ? (c.note || '') : '') + '</textarea></div>' +
      '<div class="btn-row" style="margin-top:6px">' +
      (c ? '<button class="btn btn-ghost" data-act="case-more" data-id="' + c.id + '">更多</button>' : '') +
      '<button class="btn btn-primary" data-act="save-case" data-id="' + (c ? c.id : '') + '">' +
      (c ? '儲存' : '建立並開始接案') + '</button></div>';

    openSheet(c ? '編輯案件' : '新案件', body);
    if (!c) setTimeout(function () { var el = $('#cNo'); if (el) el.focus(); }, 320);
  }

  function saveCase(id) {
    var no = $('#cNo').value.trim();
    var cat = $('#cCat').value;
    var reporter = $('#cReporter').value.trim();
    var place = $('#cPlace').value.trim();
    var note = $('#cNote').value.trim();

    if (id) {
      var c = getCase(id);
      if (!c) return;
      c.no = no; c.cat = cat; c.reporter = reporter; c.place = place; c.note = note;
      save(); closeSheet(); renderAll();
      toast('案件已更新');
    } else {
      var nc = {
        id: uid(), no: no || '', cat: cat, reporter: reporter, place: place, note: note,
        status: 'open', createdAt: now(), closedAt: null
      };
      state.cases.push(nc);
      var t = now();
      closeActive(t);
      addEntry({ id: uid(), t: 'intake', s: t, e: null, c: nc.id, n: '', p: place });
      closeSheet(); renderAll();
      toast('已接案件' + (no ? ' ' + no : '') + '，開始計時');
      openCaseDetail(nc.id);
    }
  }

  function openCaseDetail(id) {
    var c = getCase(id);
    if (!c) return;
    var ms = caseMs(id);
    var rows = state.entries.filter(function (e) { return e.c === id; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
    var isOpen = c.status !== 'closed';
    var info = [
      ['類別', c.cat], ['報案人', c.reporter], ['地點', c.place],
      ['備註', c.note], ['開案', c.createdAt ? fmtDateLabel(c.createdAt) + ' ' + fmtTime(c.createdAt) : '']
    ].filter(function (x) { return x[1]; });

    var html =
      '<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">' +
      '<div style="flex:1"><div style="font-size:22px;font-weight:800;letter-spacing:.01em">' +
      esc(c.no || '未編號') + '</div>' +
      '<div style="font-size:12px;color:var(--text-faint);margin-top:2px">' +
      esc([c.cat, c.reporter, c.place].filter(Boolean).join(' · ') || '未填資料') + '</div></div>' +
      '<div style="text-align:right"><div class="mono" style="font-size:20px;font-weight:600">' +
      (ms ? fmtHM(ms) : '—') + '</div><div style="font-size:10.5px;color:var(--text-faint)">累計工時</div></div></div>' +
      (info.length ? '<div class="card" style="padding:2px 13px;margin-bottom:12px">' +
        info.map(function (x) {
          return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--line-soft);font-size:13px">' +
            '<span style="color:var(--text-faint);flex:none;width:56px">' + x[0] + '</span><span style="flex:1">' +
            esc(x[1]) + '</span></div>';
        }).join('') + '</div>' : '') +
      '<div class="btn-row" style="margin-bottom:8px">' +
      (isOpen ? '<button class="btn btn-soft" data-act="case-start" data-id="' + id + '" data-type="casework">處理案件</button>' +
        '<button class="btn btn-soft" data-act="case-start" data-id="' + id + '" data-type="statement">攞口供</button>' : '') +
      '</div>' +
      '<div class="section-head" style="margin:16px 0 8px"><h2>相關紀錄</h2><span class="count">' +
      (rows.length ? '最近 ' + rows.length + ' 項' : '') + '</span></div>' +
      (rows.length ? '<div class="timeline">' + rows.map(rowHTML).join('') + '</div>'
        : '<p class="muted" style="font-size:12.5px;padding:6px 2px">未有連結嘅紀錄</p>') +
      '<div class="btn-row" style="margin-top:16px">' +
      '<button class="btn btn-ghost" data-act="case-edit" data-id="' + id + '">編輯</button>' +
      (isOpen ? '<button class="btn btn-ghost" data-act="case-close" data-id="' + id + '">完結案件</button>'
        : '<button class="btn btn-ghost" data-act="case-reopen" data-id="' + id + '">重新開啟</button>') +
      '</div>';

    openSheet('案件詳情', html);
  }

  /* ---------------- 揀案件 ---------------- */
  function pickCaseSheet(type) {
    var open = state.cases.filter(function (c) { return c.status === 'open'; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
    var html = '<p class="hint" style="margin:0 0 10px">呢個紀錄屬於邊單案件？</p><div class="pick-list">' +
      open.slice(0, 12).map(function (c) {
        return '<button class="pick" data-act="pick-case" data-type="' + type + '" data-id="' + c.id + '">' +
          '<span class="case-badge" style="width:34px;height:34px;border-radius:10px;font-size:10px">' +
          esc((c.cat || '案').slice(0, 2)) + '</span>' +
          '<span class="p-main"><span class="p-t">' + esc(c.no || '未編號') + '</span>' +
          '<span class="p-s">' + esc([c.cat, c.reporter].filter(Boolean).join(' · ')) + '</span></span>' +
          ic('i-chevron') + '</button>';
      }).join('') +
      '<button class="pick" data-act="pick-none" data-type="' + type + '" style="justify-content:center;color:var(--text-dim);font-size:13px">' +
      '唔指定案件</button></div>';
    openSheet('選擇案件', html);
  }

  /* ---------------- 更次（返工／放工）---------------- */
  var shiftEditing = null;

  function byId(id) {
    for (var i = 0; i < state.entries.length; i++) if (state.entries[i].id === id) return state.entries[i];
    return null;
  }

  function sessionOfEntry(ent) {
    if (!ent) return null;
    var ss = dutySessions();
    for (var i = 0; i < ss.length; i++) {
      if (ss[i].onId === ent.id || ss[i].offId === ent.id) return ss[i];
    }
    return null;
  }

  function openShiftEditor(session) {
    shiftEditing = session || null;
    var isNew = !session;
    var start, end;

    if (isNew) {
      var last = lastSession();
      if (last && last.open) {
        start = last.start;
        end = scheduleEndFor(start) || now();
      } else {
        start = now() - 9 * 3600e3;
        end = now();
      }
    } else {
      start = session.start;
      end = session.end;
      if (end == null) {
        var sch = scheduleEndFor(start);
        // 已經過咗更表收工時間就預先填入；未到就留空（仲做緊）
        end = sch != null && sch <= now() ? sch : null;
      }
    }

    var html =
      (isNew ? '<p class="hint" style="margin:0 0 12px">補錄一更嘅返工同放工時間。放工留空＝仲未收工。</p>' : '') +
      '<div class="field-row">' +
      '<div class="field"><label>返工日期</label><input class="input" id="shStartDate" type="date" value="' +
      fmtDateInput(start) + '"></div>' +
      '<div class="field"><label>返工時間</label><input class="input" id="shStartTime" type="time" value="' +
      fmtTimeInput(start) + '"></div></div>' +
      '<div class="field-row">' +
      '<div class="field"><label>放工日期</label><input class="input" id="shEndDate" type="date" value="' +
      (end != null ? fmtDateInput(end) : '') + '"></div>' +
      '<div class="field"><label>放工時間</label><input class="input" id="shEndTime" type="time" value="' +
      (end != null ? fmtTimeInput(end) : '') + '"></div></div>' +
      '<div class="hint" id="shHint"></div>' +
      '<div class="btn-row" style="margin-top:8px">' +
      '<button class="btn btn-ghost btn-sm" data-act="sh-now">' + ic('i-clock') + '而家放工</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="sh-clear">清除放工時間</button></div>' +
      '<div class="hint" style="margin-top:10px">跨夜更照填就得：放工日期揀第二日，或者時間早過返工會自動當翌日。</div>' +
      '<div class="btn-row" style="margin-top:16px">' +
      (isNew ? '' : '<button class="btn btn-danger" data-act="shift-del">刪除整更</button>') +
      '<button class="btn btn-primary" data-act="shift-save">儲存</button></div>';

    openSheet(isNew ? '補錄更次' : '更改更次', html);
    updateShiftHint();
  }

  function updateShiftHint() {
    var sd = $('#shStartDate'), st = $('#shStartTime'), ed = $('#shEndDate'), et = $('#shEndTime');
    var hint = $('#shHint');
    if (!sd || !st || !hint) return;
    var start = parseDateTime(sd.value, st.value);
    if (start == null) { hint.textContent = ''; return; }
    if (!et.value) {
      hint.innerHTML = '留空放工時間 = <b>仲未收工</b>，會繼續計時。';
      return;
    }
    var end = parseDateTime(ed.value || sd.value, et.value);
    if (end == null) { hint.textContent = ''; return; }
    var nextDay = end <= start;
    if (nextDay) end += DAY;
    hint.innerHTML = '本更 <b>' + fmtHM(end - start) + '</b>' +
      (nextDay ? ' · 放工當翌日（' + fmtDateShort(end) + '）' : '') +
      (end > now() ? ' · 未到放工時間' : '');
  }

  function saveShift() {
    var sd = $('#shStartDate').value;
    var st = $('#shStartTime').value;
    var ed = $('#shEndDate').value;
    var et = $('#shEndTime').value;
    if (!sd || !st) { toast('請填返工日期同時間'); return; }
    var start = parseDateTime(sd, st);
    if (start == null) { toast('返工時間格式有問題'); return; }

    var end = null;
    if (et) {
      end = parseDateTime(ed || sd, et);
      if (end == null) { toast('放工時間格式有問題'); return; }
      if (end <= start) end += DAY;
    }

    var sess = shiftEditing;
    if (sess && sess.onId) {
      var on = byId(sess.onId);
      if (on) { on.s = start; on.e = start; }
      var off = sess.offId ? byId(sess.offId) : null;
      if (end != null) {
        if (off) { off.s = end; off.e = end; }
        else addEntry({ id: uid(), t: 'off', s: end, e: end });
      } else if (off) {
        state.entries = state.entries.filter(function (x) { return x.id !== off.id; });
      }
    } else {
      addEntry({ id: uid(), t: 'on', s: start, e: start });
      if (end != null) addEntry({ id: uid(), t: 'off', s: end, e: end });
    }

    // 進行中嘅工作唔應該長過放工時間
    var act = activeEntry();
    if (act && end != null && act.s >= start && act.s < end) {
      act.e = Math.max(end, act.s + 60000);
    }

    state.entries.sort(byStart);
    save(); closeSheet(); renderAll();
    toast(end != null ? '已更新：' + fmtHM(end - start) + ' 更' : '已更新（未收工）');
  }

  function deleteShift() {
    var sess = shiftEditing;
    if (!sess) return;
    askConfirm({
      title: '刪除整更',
      body: '會刪除呢一更嘅返工同放工紀錄（工作內容會保留）。確定？',
      ok: '刪除', danger: true
    }).then(function (yes) {
      if (!yes) return;
      var ids = {};
      if (sess.onId) ids[sess.onId] = 1;
      if (sess.offId) ids[sess.offId] = 1;
      state.entries = state.entries.filter(function (x) { return !ids[x.id]; });
      save(); closeSheet(); renderAll();
      toast('已刪除整更');
    });
  }

  /* ---------------- 新增 / 編輯紀錄 ---------------- */
  function openEditor(id) {
    var e = id ? state.entries.filter(function (x) { return x.id === id; })[0] : null;
    var isNew = !e;
    var draft = e || {
      t: 'casework', s: now() - 30 * 60000, e: now(), c: null, n: '', p: ''
    };
    var typeOpts = ACTION_TYPES.map(function (k) {
      var T = TYPES[k];
      return '<button class="type-opt' + (draft.t === k ? ' is-on' : '') + '" style="--c:' + T.color +
        '" data-act="ed-type" data-type="' + k + '">' + ic(T.icon) + '<span>' + T.label + '</span></button>';
    }).join('');

    var openCases = state.cases.filter(function (c) { return c.status === 'open'; });
    var caseOpts = '<option value="">（唔指定）</option>' + state.cases.map(function (c) {
      return '<option value="' + c.id + '"' + (draft.c === c.id ? ' selected' : '') + '>' +
        esc((c.no || '未編號') + (c.reporter ? ' · ' + c.reporter : '')) + '</option>';
    }).join('');

    var isPoint = draft.t === 'on' || draft.t === 'off';
    var body =
      '<div class="type-grid" id="edTypes">' + typeOpts + '</div>' +
      '<div class="spacer"></div>' +
      '<div class="field-row">' +
      '<div class="field"><label>日期</label><input class="input" id="edDate" type="date" value="' +
      fmtDateInput(draft.s) + '"></div>' +
      '<div class="field"><label>開始</label><input class="input" id="edStart" type="time" value="' +
      fmtTimeInput(draft.s) + '"></div></div>' +
      '<div class="field" id="edEndWrap"' + (isPoint ? ' style="display:none"' : '') + '>' +
      '<label>結束</label><input class="input" id="edEnd" type="time" value="' +
      (draft.e != null ? fmtTimeInput(draft.e) : '') + '">' +
      '<div class="hint">留空 = 仍在進行中。過咗午夜會自動當第二日。</div></div>' +
      '<div class="field"><label>案件</label><select class="select" id="edCase">' + caseOpts + '</select></div>' +
      '<div class="field"><label>備註</label><input class="input" id="edNote" placeholder="簡短描述（選填）" value="' +
      esc(draft.n || '') + '"></div>' +
      (isNew ? '<button class="btn btn-ghost btn-block" style="margin:2px 0 10px" data-act="open-shift-new">' +
        ic('i-door-in') + '補錄返工／放工時間</button>' : '') +
      '<div class="btn-row" style="margin-top:4px">' +
      (isNew ? '' : '<button class="btn btn-danger" data-act="del-entry" data-id="' + id + '">刪除</button>') +
      '<button class="btn btn-primary" data-act="save-entry" data-id="' + (id || '') + '">' +
      (isNew ? '加入紀錄' : '儲存') + '</button></div>';

    openSheet(isNew ? '補錄紀錄' : '編輯紀錄', body);
    $('#edTypes').dataset.selected = draft.t;
  }

  function toggleEditorType(btn) {
    var grid = $('#edTypes');
    if (!grid) return;
    $$('.type-opt', grid).forEach(function (b) { b.classList.remove('is-on'); });
    btn.classList.add('is-on');
    grid.dataset.selected = btn.dataset.type;
    var point = btn.dataset.type === 'on' || btn.dataset.type === 'off';
    var wrap = $('#edEndWrap');
    if (wrap) wrap.style.display = point ? 'none' : '';
  }

  function saveEntry(id) {
    var grid = $('#edTypes');
    var type = grid ? grid.dataset.selected : 'casework';
    var dateStr = $('#edDate').value;
    var startStr = $('#edStart').value;
    if (!dateStr || !startStr) { toast('請填日期同開始時間'); return; }
    var start = parseDateTime(dateStr, startStr);
    if (start == null) { toast('時間格式有問題'); return; }

    var endStr = $('#edEnd') ? $('#edEnd').value : '';
    var end = null;
    if (endStr) {
      end = parseDateTime(dateStr, endStr);
      if (end != null && end <= start) end += DAY;
    }
    var isPoint = type === 'on' || type === 'off';
    if (isPoint) end = start;

    var caseId = $('#edCase') ? $('#edCase').value || null : null;
    var note = $('#edNote') ? $('#edNote').value.trim() : '';

    if (id) {
      var e = state.entries.filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      e.t = type; e.s = start; e.e = end; e.c = caseId; e.n = note;
      state.entries.sort(byStart);
    } else {
      // 新紀錄同現有進行中嘅紀錄重疊時，先收咗舊嗰個
      var act = activeEntry();
      if (act && end == null) closeActive(start);
      addEntry({ id: uid(), t: type, s: start, e: end, c: caseId, n: note, p: '' });
    }
    save(); closeSheet(); renderAll();
    toast(id ? '已更新' : '已加入紀錄');
  }

  function parseDateTime(dateStr, timeStr) {
    var dp = String(dateStr).split('-').map(Number);
    var tp = String(timeStr).split(':').map(Number);
    if (dp.length < 3 || tp.length < 2) return null;
    if (isNaN(dp[0]) || isNaN(tp[0])) return null;
    var d = new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0, 0);
    return d.getTime();
  }

  /* ---------------- 自訂日期範圍 ---------------- */
  function openRangeSheet() {
    var f = customRange.from || startOfDay(now()) - 6 * DAY;
    var t2 = customRange.to || startOfDay(now());
    openSheet('自訂日期',
      '<div class="field-row">' +
      '<div class="field"><label>由</label><input class="input" id="rFrom" type="date" value="' +
      fmtDateInput(f) + '"></div>' +
      '<div class="field"><label>到</label><input class="input" id="rTo" type="date" value="' +
      fmtDateInput(t2) + '"></div></div>' +
      '<div class="btn-row" style="margin-top:8px">' +
      '<button class="btn btn-ghost" data-act="range-week">最近 7 日</button>' +
      '<button class="btn btn-primary" data-act="range-apply">套用</button></div>');
  }

  function applyRange() {
    var f = parseDateTime($('#rFrom').value, '00:00');
    var t2 = parseDateTime($('#rTo').value, '00:00');
    if (f == null || t2 == null) { toast('請揀日期'); return; }
    if (f > t2) { var tmp = f; f = t2; t2 = tmp; }
    customRange.from = f;
    customRange.to = t2;
    statsPeriod = 'custom';
    closeSheet();
    renderStats();
  }

  /* ---------------- 匯出 ---------------- */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
  }

  function exportCsv() {
    if (!state.entries.length) { toast('未有紀錄可以匯出'); return; }
    download('更簿_工時_' + fmtDateInput(now()) + '.csv', buildCsv(), 'text/csv;charset=utf-8');
    toast('CSV 已匯出');
  }

  function buildCsv() {
    var lines = [];
    lines.push(['更簿 工時紀錄'].map(csvCell).join(','));
    lines.push(['姓名/警號', state.settings.name || ''].map(csvCell).join(','));
    lines.push(['匯出日期', fmtDateLabel(now()) + ' ' + fmtTime(now())].map(csvCell).join(','));
    lines.push(['每日目標', hmToStr(state.settings.target)].map(csvCell).join(','));
    lines.push('');
    lines.push(['日期', '返工', '放工', '當值', '目標', 'OT', '用膳', '案件數'].map(csvCell).join(','));

    var days = {};
    state.entries.forEach(function (e) { days[dayKey(e.s)] = true; });
    Object.keys(days).sort().forEach(function (k) {
      var d = new Date(k + 'T00:00:00');
      var st = dayStats(d.getTime());
      var on = null, off = null;
      dutySessions().forEach(function (s) {
        if (s.start >= d.getTime() && s.start < d.getTime() + DAY) {
          if (on == null) on = s.start;
          if (s.end != null) off = s.end;
        }
      });
      var caseCount = {};
      state.entries.forEach(function (e) {
        if (e.c && e.s >= d.getTime() && e.s < d.getTime() + DAY) caseCount[e.c] = true;
      });
      lines.push([
        k,
        on != null ? fmtTime(on) : '',
        off != null ? fmtTime(off) : '',
        st.total ? fmtHM(st.total) : '',
        st.target ? fmtHM(st.target) : (st.shift ? '' : hmToStr(state.settings.target)),
        st.ot ? fmtHM(st.ot) : '',
        st.meal ? fmtHM(st.meal) : '',
        Object.keys(caseCount).length || ''
      ].map(csvCell).join(','));
    });

    lines.push('');
    lines.push(['明細'].map(csvCell).join(','));
    lines.push(['日期', '類型', '開始', '結束', '時長(分鐘)', '案件編號', '報案人', '地點', '備註'].map(csvCell).join(','));
    state.entries.slice().sort(byStart).forEach(function (e) {
      var T = TYPES[e.t] || TYPES.other;
      var c = e.c ? getCase(e.c) : null;
      var mins = Math.round(entryMs(e) / 60000);
      lines.push([
        dayKey(e.s),
        T.label,
        fmtTime(e.s),
        e.e != null ? fmtTime(e.e) : '',
        e.t === 'on' || e.t === 'off' ? '' : mins,
        c ? (c.no || '') : '',
        c ? (c.reporter || '') : '',
        c ? (c.place || '') : '',
        e.n || ''
      ].map(csvCell).join(','));
    });

    return '\ufeff' + lines.join('\r\n');
  }

  function exportJson() {
    var data = JSON.stringify({
      app: 'gengbo', v: 1, exportedAt: new Date().toISOString(),
      settings: state.settings, cases: state.cases, entries: state.entries
    }, null, 2);
    download('更簿_備份_' + fmtDateInput(now()) + '.json', data, 'application/json');
    toast('備份已匯出');
  }

  function importJson(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { toast('檔案格式唔正確'); return; }
    if (!d || !Array.isArray(d.entries)) { toast('呢個唔係更簿備份檔'); return; }
    askConfirm({
      title: '還原備份',
      body: '將會用備份入面嘅 ' + d.entries.length + ' 項紀錄同 ' +
        ((d.cases || []).length) + ' 單案件，取代而家嘅資料。確定？',
      ok: '還原'
    }).then(function (yes) {
      if (!yes) return;
      var s = blankState();
      s.settings = Object.assign(s.settings, d.settings || {});
      s.cases = d.cases || [];
      s.entries = (d.entries || []).sort(byStart);
      state = s;
      save(); renderAll(); applyTheme();
      toast('已還原備份');
    });
  }

  /* ---------------- 示範資料 ---------------- */
  function seedDemo() {
    closeSheet();
    var s = blankState();
    s.rosters = state.rosters || {};
    s.settings.name = '陳 Sir';
    s.settings.seen = true;
    var cases = [
      { id: 'd1', no: 'CW-2026-1108-01', cat: '盜竊', reporter: '李太', place: '旺角彌敦道 700 號', note: '店舖盜竊，有 CCTV', status: 'open', createdAt: now() - 2 * 3600e3, closedAt: null },
      { id: 'd2', no: 'CW-2026-1107-04', cat: '傷人 / 襲擊', reporter: '張先生', place: '深水埗福華街', note: '酒後爭執', status: 'open', createdAt: now() - 26 * 3600e3, closedAt: null },
      { id: 'd3', no: 'CW-2026-1106-02', cat: '交通', reporter: '黃小姐', place: '荔枝角道', note: '私家車輕微碰撞', status: 'closed', createdAt: now() - 50 * 3600e3, closedAt: now() - 28 * 3600e3 }
    ];
    s.cases = cases;

    function dayAt(offsetDays, h, m) {
      var d = new Date(startOfDay(now()) - offsetDays * DAY);
      d.setHours(h, m, 0, 0);
      return d.getTime();
    }
    function add(t, start, end, cid, note) {
      s.entries.push({ id: uid(), t: t, s: start, e: end == null ? null : end, c: cid || null, n: note || '', p: '' });
    }

    // 過去 9 日（有兩日休息）
    for (var d = 9; d >= 1; d--) {
      if (d === 8 || d === 4) continue;
      var odd = d % 2 === 1;
      var offMin = odd ? 5 : 20;
      add('on', dayAt(d, 8, 12), dayAt(d, 8, 12));
      add('patrol', dayAt(d, 8, 30), dayAt(d, 9, 40));
      add('casework', dayAt(d, 9, 50), dayAt(d, 11, 55), d === 3 ? 'd2' : 'd3');
      add('meal', dayAt(d, 12, 24), dayAt(d, 13, 10));
      add('statement', dayAt(d, 13, 20), dayAt(d, 14, 50), 'd2');
      add('admin', dayAt(d, 15, 0), dayAt(d, 16, 20));
      add('traffic', dayAt(d, 16, 30), dayAt(d, 17, 15));
      if (odd) add('casework', dayAt(d, 17, 20), dayAt(d, 18, offMin), 'd1');
      var off = dayAt(d, 18, offMin);
      add('off', off, off);
    }

    // 今日：當值中 + 進行中嘅案件工作
    var todayOn = dayAt(0, 8, 12);
    add('on', todayOn, todayOn);
    add('patrol', dayAt(0, 8, 20), dayAt(0, 9, 15));
    add('intake', dayAt(0, 9, 25), dayAt(0, 10, 35), 'd1');
    add('meal', dayAt(0, 12, 30), dayAt(0, 13, 5));
    add('statement', dayAt(0, 13, 20), dayAt(0, 14, 40), 'd1');
    add('casework', now() - 24 * 60000, null, 'd1', '翻睇 CCTV');

    s.entries.sort(byStart);
    state = s;
    save(); renderAll();
    toast('已載入示範資料');
    go('home');
  }

  /* ---------------- 分頁 ---------------- */
  function go(tab) {
    $$('.view').forEach(function (v) { v.classList.toggle('is-on', v.id === 'view-' + tab); });
    $$('.tab').forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === tab); });
    var gear = $('#btnGotoSettings');
    if (gear) gear.classList.toggle('is-on', tab === 'settings');
    window.scrollTo(0, 0);
    if (tab === 'stats') renderStats();
    if (tab === 'roster') {
      renderRoster();
      ensureRoster(false).then(function () { if (calYear === new Date().getFullYear()) renderRoster(); });
    }
  }

  /* ---------------- 螢幕長亮 ---------------- */
  var wakeSentinel = null;
  function wakeLock(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && state.settings.wake && !wakeSentinel) {
      navigator.wakeLock.request('screen').then(function (s) {
        wakeSentinel = s;
        s.addEventListener('release', function () { wakeSentinel = null; });
      }).catch(function () {});
    } else if (!on && wakeSentinel) {
      wakeSentinel.release().catch(function () {});
      wakeSentinel = null;
    }
  }

  /* ---------------- 計時器 ---------------- */
  function tick() {
    if (document.hidden) return;
    var t = now();
    var a = activeEntry();
    if (a) {
      var el = $('#activeTime');
      if (el) el.textContent = fmtHMS(entryMs(a, t));
      $$('[data-live]').forEach(function (node) {
        var id = node.dataset.live;
        var e = state.entries.filter(function (x) { return x.id === id; })[0];
        if (e) node.textContent = fmtHM(t - e.s);
      });
    }
    var st = dayStats(heroDay());
    var big = $('#dutyBig');
    if (big) {
      var parts = fmtHMS(st.total).split(':');
      big.textContent = parts[0] + ':' + parts[1];
      $('#dutySec').textContent = ':' + parts[2];
      if (st.open) {
        var pct = st.target > 0 ? Math.min(100, (st.total / st.target) * 100) : 100;
        $('#dutyBar').style.width = (st.total > 0 ? Math.max(1.5, pct) : 0) + '%';
        $('#dutyProgress').classList.toggle('is-ot', st.target > 0 && st.total > st.target);
      }
    }
  }
  setInterval(tick, 1000);

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (ev) {
    var goto = ev.target.closest('[data-goto]');
    if (goto) { ev.preventDefault(); go(goto.dataset.goto); return; }

    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;

    switch (act) {
      case 'type': tapType(el.dataset.type); break;
      case 'edit':
        (function () {
          var ent = byId(el.dataset.id);
          if (ent && (ent.t === 'on' || ent.t === 'off')) {
            openShiftEditor(sessionOfEntry(ent));
          } else {
            openEditor(el.dataset.id);
          }
        })();
        break;
      case 'shift-edit': openShiftEditor(lastSession()); break;
      case 'shift-save': saveShift(); break;
      case 'shift-del': deleteShift(); break;
      case 'sh-now':
        (function () {
          var t = now();
          $('#shEndDate').value = fmtDateInput(t);
          $('#shEndTime').value = fmtTimeInput(t);
          updateShiftHint();
        })();
        break;
      case 'sh-clear':
        $('#shEndDate').value = '';
        $('#shEndTime').value = '';
        updateShiftHint();
        break;
      case 'open-shift-new':
        closeSheet();
        setTimeout(function () { openShiftEditor(null); }, 200);
        break;
      case 'case': openCaseDetail(el.dataset.id); break;
      case 'confirm':
        if (confirmResolve) {
          var r = confirmResolve;
          confirmResolve = null;
          r(el.dataset.val === '1' ? true : el.dataset.val === 'alt' ? 'alt' : false);
        }
        closeSheet();
        break;
      case 'save-case': saveCase(el.dataset.id || null); break;
      case 'case-edit': openCaseSheet(el.dataset.id); break;
      case 'case-start':
        closeSheet();
        setTimeout(function () { startActivity(el.dataset.type, el.dataset.id); }, 180);
        break;
      case 'case-close':
        (function () {
          var c = getCase(el.dataset.id);
          if (!c) return;
          c.status = 'closed'; c.closedAt = now();
          var a = activeEntry();
          if (a && a.c === c.id) closeActive(now());
          save(); closeSheet(); renderAll(); toast('案件已完結');
        })();
        break;
      case 'case-reopen':
        (function () {
          var c = getCase(el.dataset.id);
          if (!c) return;
          c.status = 'open'; c.closedAt = null;
          save(); closeSheet(); renderAll(); toast('案件已重新開啟');
        })();
        break;
      case 'case-more':
        (function () {
          var id = el.dataset.id;
          closeSheet();
          setTimeout(function () {
            askConfirm({ title: '刪除案件', body: '會刪除案件資料，但已記錄嘅活動會保留（只係解除連結）。', ok: '刪除', danger: true })
              .then(function (yes) {
                if (!yes) { openCaseSheet(id); return; }
                state.cases = state.cases.filter(function (c) { return c.id !== id; });
                state.entries.forEach(function (e) { if (e.c === id) e.c = null; });
                save(); renderAll(); toast('案件已刪除');
              });
          }, 200);
        })();
        break;
      case 'pick-case':
        closeSheet();
        setTimeout(function () { startActivity(el.dataset.type, el.dataset.id); }, 180);
        break;
      case 'pick-none':
        closeSheet();
        setTimeout(function () { startActivity(el.dataset.type, null); }, 180);
        break;
      case 'ed-type': toggleEditorType(el); break;
      case 'cal-prev': shiftCal(-1); break;
      case 'cal-next': shiftCal(1); break;
      case 'cal-today':
        calYear = new Date().getFullYear();
        calMonth = new Date().getMonth();
        renderRoster();
        break;
      case 'cal-day': openRosterDay(el.dataset.key); break;
      case 'welcome-start': closeSheet(); break;
      case 'welcome-demo': closeSheet(); setTimeout(seedDemo, 260); break;
      case 'range-apply': applyRange(); break;
      case 'range-week':
        $('#rFrom').value = fmtDateInput(startOfDay(now()) - 6 * DAY);
        $('#rTo').value = fmtDateInput(now());
        break;
      case 'save-entry': saveEntry(el.dataset.id || null); break;
      case 'del-entry':
        (function () {
          var id = el.dataset.id;
          askConfirm({ title: '刪除紀錄', body: '呢項紀錄會永久刪除。', ok: '刪除', danger: true })
            .then(function (yes) {
              if (!yes) return;
              state.entries = state.entries.filter(function (x) { return x.id !== id; });
              save(); renderAll(); toast('已刪除');
            });
        })();
        break;
      case 'set-target':
        saveTarget();
        break;
    }
  });

  $('#sheetClose').onclick = closeSheet;
  $('#backdrop').onclick = closeSheet;

  // 更次表單即時更新「本更」時數
  $('#sheetBody').addEventListener('input', function (ev) {
    if (/^sh(Start|End)(Date|Time)$/.test(ev.target.id)) updateShiftHint();
  });
  $('#sheetBody').addEventListener('change', function (ev) {
    if (/^sh(Start|End)(Date|Time)$/.test(ev.target.id)) updateShiftHint();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
  });

  // 分頁
  $$('.tab').forEach(function (b) {
    b.addEventListener('click', function () { go(b.dataset.tab); });
  });
  $('#btnGotoSettings').onclick = function () { go('settings'); };

  // 主題
  $('#btnTheme').onclick = function () {
    var order = ['auto', 'light', 'dark'];
    var i = order.indexOf(state.settings.theme || 'auto');
    state.settings.theme = order[(i + 1) % 3];
    save(); applyTheme(); renderSettings();
    toast('主題：' + ({ auto: '跟隨系統', light: '淺色', dark: '深色' })[state.settings.theme]);
  };

  // 案件
  $('#btnNewCase').onclick = function () { openCaseSheet(); };
  $('#caseSearch').addEventListener('input', function (e) {
    caseQuery = e.target.value.trim();
    renderCases();
  });

  // 紀錄
  $('#btnManual').onclick = function () { openEditor(null); };

  // 統計
  $('#periodSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.period === 'custom') { openRangeSheet(); return; }
    statsPeriod = b.dataset.period;
    renderStats();
  });
  $('#btnExportCsv').onclick = exportCsv;
  $('#btnExportJson').onclick = exportJson;

  // 更表
  var btnRefresh = $('#btnRosterRefresh');
  if (btnRefresh) {
    btnRefresh.onclick = function () {
      var y = calYear || new Date().getFullYear();
      var before = (rosterFor(y) || {}).at || 0;
      btnRefresh.style.opacity = '.45';
      fetchRoster(y, true).then(function (r) {
        btnRefresh.style.opacity = '';
        renderRoster();
        if (r && r.at > before) toast('更表已更新');
        else toast('更表更新失敗，用返上次資料');
      });
    };
  }
  $('#btnRosterEdit').href = ROSTER.editorUrl;

  // 設定
  $('#setName').onclick = function () {
    var v = prompt('姓名 / 警號（會顯示喺匯出報表）', state.settings.name || '');
    if (v == null) return;
    state.settings.name = v.trim();
    save(); renderSettings(); toast('已更新');
  };

  function saveTarget() {
    var h = parseInt($('#targetH').value, 10);
    var m = parseInt($('#targetM').value, 10);
    if (isNaN(h)) h = 0;
    if (isNaN(m)) m = 0;
    h = Math.max(0, Math.min(24, h));
    m = Math.max(0, Math.min(59, m));
    var total = h * 60 + m;
    if (total < 30) total = 30;
    state.settings.target = total;
    $('#targetH').value = Math.floor(total / 60);
    $('#targetM').value = total % 60;
    save(); renderHome(); renderStats();
    toast('目標工時：' + hmToStr(total));
  }
  $('#targetH').addEventListener('change', saveTarget);
  $('#targetM').addEventListener('change', saveTarget);

  $('#rowDeductMeal').onclick = function () {
    state.settings.deductMeal = !state.settings.deductMeal;
    save(); renderSettings(); renderHome(); renderStats();
  };
  $('#rowWake').onclick = function () {
    state.settings.wake = !state.settings.wake;
    save(); renderSettings();
    if (state.settings.wake && isOnDuty()) wakeLock(true); else wakeLock(false);
  };
  $('#rowHaptic').onclick = function () {
    state.settings.haptic = !state.settings.haptic;
    save(); renderSettings();
    if (state.settings.haptic) haptic();
  };
  $('#rowTheme').onclick = function () { $('#btnTheme').click(); };

  $('#setInstall').onclick = function () {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var steps = isIOS
      ? ['用 <b>Safari</b> 開呢個網頁', '撳底部 <b>分享</b> 圖示', '揀 <b>「加到主畫面」</b>', '撳 <b>「加入」</b> 完成']
      : ['用 <b>Chrome</b> 開呢個網頁', '撳右上角 <b>⋮</b> 選單', '揀 <b>「安裝應用程式」</b>（或「加到主畫面」）', '撳 <b>「安裝」</b> 完成'];
    openSheet('加到主畫面',
      '<div class="card" style="padding:6px 16px;margin-bottom:14px">' +
      steps.map(function (s, i) {
        return '<div style="display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--line-soft);font-size:13.5px;line-height:1.5">' +
          '<span style="width:20px;height:20px;border-radius:50%;background:var(--accent-soft);color:var(--accent);' +
          'display:grid;place-items:center;font-size:11px;font-weight:800;flex:none">' + (i + 1) + '</span>' +
          '<span>' + s + '</span></div>';
      }).join('') + '</div>' +
      '<p class="hint">加到主畫面之後，撳 icon 就即刻開，唔使自己搵網址；離線都睇到之前嘅紀錄。</p>');
  };

  $('#setBackup').onclick = exportJson;  $('#setRestore').onclick = function () { $('#fileInput').click(); };
  $('#fileInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () { importJson(String(reader.result)); };
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  });

  $('#setDemo').onclick = function () {
    askConfirm({
      title: '載入示範資料',
      body: '會以範例資料取代現有紀錄，方便你睇下實際效果。之後可以喺設定「清除所有資料」再開始。',
      ok: '載入'
    }).then(function (yes) { if (yes) seedDemo(); });
  };

  $('#setReset').onclick = function () {
    askConfirm({
      title: '清除所有資料',
      body: '所有案件同時間紀錄都會永久刪除，無法復原。確定要清除？',
      ok: '全部清除', danger: true
    }).then(function (yes) {
      if (!yes) return;
      state = blankState();
      save(); renderAll(); applyTheme();
      toast('已清除所有資料');
      go('home');
    });
  };

  /* ---------------- 首次使用 ---------------- */
  function showWelcome() {
    var steps = [
      ['返工 / 放工', '返到更位撳一下「返工」，收工撳「放工」，當值時數自動計。'],
      ['做緊咩就撳咩', '接案件、攞口供、處理案件、巡邏……撳一下即開始計時，再撳一下即完結。'],
      ['睇數同匯出', '「統計」睇每日、每週 OT；「匯出 CSV」交更／報 OT 都用得。']
    ];
    openSheet('歡迎用更簿',
      '<p style="font-size:13.5px;line-height:1.65;color:var(--text-dim);margin-bottom:14px">' +
      '一個掣記低你成日嘅執勤時間，唔使入表、唔使連網。所有資料只存喺你部電話。</p>' +
      '<div class="card" style="padding:4px 15px;margin-bottom:16px">' +
      steps.map(function (s, i) {
        return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line-soft)">' +
          '<span style="width:22px;height:22px;border-radius:50%;background:var(--accent-soft);color:var(--accent);' +
          'display:grid;place-items:center;font-size:11.5px;font-weight:800;flex:none">' + (i + 1) + '</span>' +
          '<span><b style="font-size:13.5px;display:block;margin-bottom:2px">' + s[0] + '</b>' +
          '<span style="font-size:12px;color:var(--text-faint);line-height:1.55">' + s[1] + '</span></span></div>';
      }).join('') + '</div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost" data-act="welcome-demo">睇示範</button>' +
      '<button class="btn btn-primary" data-act="welcome-start">開始用</button></div>');
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    applyTheme();
    renderAll();
    go('home');
    if (isOnDuty() && state.settings.wake) wakeLock(true);

    if (!state.settings.seen) {
      state.settings.seen = true;
      save();
      setTimeout(showWelcome, 420);
    }

    // GitHub Pages 上自動指向正確 repo
    try {
      if (/\.github\.io$/i.test(location.hostname)) {
        var user = location.hostname.replace(/\.github\.io$/i, '');
        var repo = location.pathname.split('/').filter(Boolean)[0] || '';
        if (user && repo) {
          var link = $('#repoLink');
          if (link) link.href = 'https://github.com/' + user + '/' + repo;
        }
      }
    } catch (e) {}

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { renderAll(); if (isOnDuty()) wakeLock(true); }
    });
    window.addEventListener('focus', function () { renderAll(); });
    window.addEventListener('online', function () { ensureRoster(true).then(renderAll); });

    // 讀更表（有快取先用，背景更新）
    ensureRoster(false).then(function () { renderAll(); });

    // 每日跨日重畫
    var lastDay = startOfDay(now());
    setInterval(function () {
      var d = startOfDay(now());
      if (d !== lastDay) { lastDay = d; renderAll(); }
    }, 30000);

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  // 對外（demo / 測試用）
  window.__gengbo = {
    state: function () { return state; },
    seed: seedDemo,
    render: renderAll,
    csv: buildCsv,
    stats: function (period) { return statsFor(periodRange(period || 'today', customRange)); }
  };

  init();
})();
