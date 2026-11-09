(() => {
  'use strict';

  const HOST = location.hostname;       // Twitch requires the page's hostname as "parent"
  const AR = 16 / 9;                     // tile aspect ratio
  const GAP = 4;                         // px between tiles

  const $ = (sel) => document.querySelector(sel);
  const stage = $('#stage');
  const empty = $('#empty');
  const input = $('#addInput');
  const toastEl = $('#toast');

  // ---------- Platforms ----------
  // Each stream is { t: type, id }. The type decides how it is embedded.
  const enc = encodeURIComponent;
  const TYPES = {
    tw: { label: 'Twitch', dot: 'tw', mute: true,
          embed: (id, m) => `https://player.twitch.tv/?channel=${enc(id)}&parent=${enc(HOST)}&muted=${m}&autoplay=true`,
          open: (id) => `https://www.twitch.tv/${id}` },
    tv: { label: 'Twitch VOD', dot: 'tw', mute: true,
          embed: (id, m) => `https://player.twitch.tv/?video=v${enc(id)}&parent=${enc(HOST)}&muted=${m}&autoplay=true`,
          open: (id) => `https://www.twitch.tv/videos/${id}` },
    tc: { label: 'Twitch clip', dot: 'tw', mute: true,
          embed: (id, m) => `https://clips.twitch.tv/embed?clip=${enc(id)}&parent=${enc(HOST)}&muted=${m}&autoplay=true`,
          open: (id) => `https://clips.twitch.tv/${id}` },
    k:  { label: 'Kick', dot: 'k', mute: true,
          embed: (id, m) => `https://player.kick.com/${enc(id)}?autoplay=true&muted=${m}`,
          open: (id) => `https://kick.com/${id}` },
    yt: { label: 'YouTube', dot: 'yt', mute: true,
          embed: (id, m) => `https://www.youtube.com/embed/${enc(id)}?autoplay=1&mute=${m ? 1 : 0}&playsinline=1&rel=0`,
          open: (id) => `https://www.youtube.com/watch?v=${id}` },
    s:  { label: 'SOOP', dot: 's', mute: false,
          embed: (id) => `https://play.sooplive.com/${enc(id)}/embed`,
          open: (id) => `https://play.sooplive.com/${id}` },
    sv: { label: 'SOOP VOD', dot: 's', mute: false,
          embed: (id) => `https://vod.sooplive.com/player/${enc(id)}/embed`,
          open: (id) => `https://vod.sooplive.com/player/${id}` },
  };

  const TWITCH_RESERVED = new Set(['directory', 'settings', 'search', 'downloads', 'p', 'jobs', 'turbo',
    'subscriptions', 'inventory', 'wallet', 'drops', 'friends', 'messages', 'login', 'signup', 'u']);
  const SOOP_RESERVED = new Set(['station', 'live', 'directory', 'search', 'my', 'feed', 'vod', 'category', 'event', 'notice']);
  const NAME_RE =/^[a-z0-9_-]{1,40}$/i;
  const YT_ID_RE = /^[\w-]{11}$/;
  const YT_CH_RE = /^UC[\w-]{22}$/;

  const ok = (t, id) => ({ t, id });
  const fail = (msg) => ({ error: msg });

  function channel(t, name) {
    name = String(name).replace(/^@/, '');
    return NAME_RE.test(name) ? ok(t, name.toLowerCase()) : fail(`"${name}" doesn't look like a channel name`);
  }

  // YouTube no longer embeds "whatever this channel is streaming", so a
  // channel link can't be shown. The viewer needs the stream's own link.
  const YT_CHANNEL_MSG = 'YouTube only embeds a specific video. Open the channel\'s live stream and paste that link (youtube.com/watch?v=… or youtube.com/live/…).';

  function youtubeValue(v) {
    if (YT_ID_RE.test(v)) return ok('yt', v);
    if (YT_CH_RE.test(v)) return fail(YT_CHANNEL_MSG);
    return fail(`"${v}" isn't a YouTube video ID`);
  }

  /** Turn whatever the user pasted into a stream, or { error }. */
  function parse(raw) {
    let s = raw.trim().replace(/^<|>$/g, '');
    if (!s) return null;

    // Shorthand like "kick:name", "soop:id", "yt:ID" (also the tokens used in the page address)
    const pre = s.match(/^([a-z]+):(?!\/\/)(.+)$/i);
    if (pre) {
      const p = pre[1].toLowerCase(), v = pre[2].trim();
      if (p === 'twitch' || p === 'tw') return channel('tw', v);
      if (p === 'kick' || p === 'k') return channel('k', v);
      if (p === 'youtube' || p === 'yt') return youtubeValue(v);
      if (p === 'soop' || p === 'afreeca' || p === 's') return channel('s', v);
      if (p === 'tv' && /^\d+$/.test(v)) return ok('tv', v);
      if (p === 'tc' && /^[\w-]+$/.test(v)) return ok('tc', v);
      if (p === 'sv' && /^\d+$/.test(v)) return ok('sv', v);
      return fail(`Unknown prefix "${p}:"`);
    }

    if (!/^https?:\/\//i.test(s)) {
      if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) s = 'https://' + s;   // "twitch.tv/name"
      else if (NAME_RE.test(s)) return channel('tw', s);                // bare name = Twitch
      else return fail(`Couldn't read "${raw.trim()}"`);
    }

    let u;
    try { u = new URL(s); } catch { return fail(`Couldn't read "${raw.trim()}"`); }
    const host = u.hostname.toLowerCase().replace(/^(www|m|go|mobile)\./, '');
    const parts = u.pathname.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
    const q = u.searchParams;

    // ----- YouTube -----
    if (host === 'youtu.be') return youtubeValue(parts[0] || '');
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (q.get('v')) return youtubeValue(q.get('v'));
      const [a, b] = parts;
      if (['live', 'shorts', 'embed', 'v', 'e'].includes(a) && b) {
        if (b === 'live_stream' && q.get('channel')) return youtubeValue(q.get('channel'));
        return youtubeValue(b);
      }
      if (a === 'channel' && b) return youtubeValue(b);
      if (a && (a.startsWith('@') || a === 'c' || a === 'user')) return fail(YT_CHANNEL_MSG);
      return fail('That YouTube link has no video in it');
    }

    // ----- Twitch -----
    if (host === 'clips.twitch.tv') {
      if (parts[0] === 'embed' && q.get('clip')) return ok('tc', q.get('clip'));
      return parts[0] ? ok('tc', parts[0]) : fail('That Twitch clip link has no clip in it');
    }
    if (host === 'player.twitch.tv') {
      if (q.get('channel')) return channel('tw', q.get('channel'));
      if (q.get('video')) return ok('tv', q.get('video').replace(/^v/, ''));
    }
    if (host.endsWith('twitch.tv')) {
      const [a, b, c] = parts;
      if (a === 'videos' && /^\d+$/.test(b || '')) return ok('tv', b);
      if (b === 'clip' && c) return ok('tc', c);
      if (b === 'v' && /^\d+$/.test(c || '')) return ok('tv', c);
      if (a === 'popout' && b) return channel('tw', b);
      if (a && !TWITCH_RESERVED.has(a.toLowerCase())) return channel('tw', a);
      return fail('That Twitch link has no channel in it');
    }

    // ----- Kick -----
    if (host === 'kick.com' || host === 'player.kick.com') {
      if (parts[0] === 'popout' && parts[1]) return channel('k', parts[1]);
      return parts[0] ? channel('k', parts[0]) : fail('That Kick link has no channel in it');
    }

    // ----- SOOP (formerly AfreecaTV) -----
    if (/(^|\.)(sooplive\.co\.kr|sooplive\.com|afreecatv\.com)$/.test(host)) {
      const sub = host.split('.')[0];
      const [a, b] = parts;
      if (sub === 'vod' && a === 'player' && /^\d+$/.test(b || '')) return ok('sv', b);
      if (sub === 'vod' && /^\d+$/.test(a || '')) return ok('sv', a);
      if (a === 'station' && b) return channel('s', b);           // www.sooplive.com/station/id
      if (a && !SOOP_RESERVED.has(a.toLowerCase())) return channel('s', a);   // play./ch./bj. hosts
      return fail('That SOOP link has no channel in it');
    }

    return fail(`${u.hostname} isn't supported (YouTube, Twitch, Kick or SOOP only)`);
  }

  // ---------- State ----------
  /** @type {{key:string,t:string,id:string,muted:boolean,el:HTMLElement,frame:HTMLIFrameElement}[]} */
  let streams = [];
  let focusKey = null;
  const keyOf = (s) => `${s.t}:${s.id}`;

  function add(stream, { quiet = false } = {}) {
    const key = keyOf(stream);
    if (streams.some((s) => s.key === key)) {
      if (!quiet) toast(`${TYPES[stream.t].label} ${stream.id} is already open`);
      return false;
    }
    const s = { ...stream, key, muted: true };
    s.el = buildTile(s);
    streams.push(s);
    stage.appendChild(s.el);
    return true;
  }

  function remove(key) {
    const i = streams.findIndex((s) => s.key === key);
    if (i < 0) return;
    streams[i].el.remove();
    streams.splice(i, 1);
    if (focusKey === key) focusKey = null;
    update();
  }

  function move(fromKey, toKey) {
    const from = streams.findIndex((s) => s.key === fromKey);
    const to = streams.findIndex((s) => s.key === toKey);
    if (from < 0 || to < 0 || from === to) return;
    const [s] = streams.splice(from, 1);
    streams.splice(to, 0, s);
    update();
  }

  function clearAll() {
    streams.forEach((s) => s.el.remove());
    streams = [];
    focusKey = null;
    update();
  }

  // ---------- Tiles ----------
  const ICONS = {
    focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    unfocus: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    muted: '<path d="M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6"/>',
    sound: '<path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>',
    reload: '<path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;

  function iconButton(name, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg(name);
    b.addEventListener('click', onClick);
    return b;
  }

  function embedUrl(s) {
    return TYPES[s.t].embed(s.id, s.muted);
  }

  function buildTile(s) {
    const type = TYPES[s.t];
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.key = s.key;

    const frame = document.createElement('iframe');
    frame.src = embedUrl(s);
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.title = `${type.label}: ${s.id}`;
    s.frame = frame;

    const bar = document.createElement('div');
    bar.className = 'tile-bar';

    const name = document.createElement('div');
    name.className = 'tile-name';
    name.draggable = true;
    name.title = 'Drag to move';
    const dot = document.createElement('span');
    dot.className = `dot ${type.dot}`;
    const label = document.createElement('span');
    label.textContent = s.id;
    name.append(dot, label);
    bar.append(name);

    const focusBtn = iconButton('focus', 'Make big', () => {
      focusKey = focusKey === s.key ? null : s.key;
      update();
    });
    focusBtn.classList.add('focus-btn');
    bar.append(focusBtn);

    if (type.mute) {
      const muteBtn = iconButton('muted', 'Unmute (reloads player)', () => {
        s.muted = !s.muted;
        muteBtn.innerHTML = svg(s.muted ? 'muted' : 'sound');
        muteBtn.title = s.muted ? 'Unmute (reloads player)' : 'Mute (reloads player)';
        muteBtn.setAttribute('aria-label', muteBtn.title);
        frame.src = embedUrl(s);
      });
      bar.append(muteBtn);
    }

    bar.append(
      iconButton('reload', 'Reload', () => { frame.src = embedUrl(s); }),
      iconButton('open', `Open on ${type.label.split(' ')[0]}`, () => window.open(type.open(s.id), '_blank', 'noopener')),
      iconButton('close', 'Remove', () => remove(s.key)),
    );

    // Drag & drop reordering. Tiles never move in the DOM (that would reload
    // the players); only their position changes.
    name.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/x-mv-key', s.key);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(name, 10, 10);
      stage.classList.add('dragging');
    });
    name.addEventListener('dragend', () => {
      stage.classList.remove('dragging');
      document.querySelectorAll('.drop-target').forEach((t) => t.classList.remove('drop-target'));
    });
    el.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('text/x-mv-key')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) el.classList.remove('drop-target');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      move(e.dataTransfer.getData('text/x-mv-key'), s.key);
    });

    el.append(frame, bar);
    return el;
  }

  // ---------- Layout ----------
  function bestGrid(n, W, H) {
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - GAP * (cols - 1)) / cols, ((H - GAP * (rows - 1)) / rows) * AR);
      if (!best || w > best.w + 0.5) best = { cols, rows, w, h: w / AR };
    }
    return best;
  }

  function placeGrid(items, x, y, W, H, out) {
    const n = items.length;
    if (!n || W <= 0 || H <= 0) return;
    const g = bestGrid(n, W, H);
    const top = y + (H - (g.rows * g.h + (g.rows - 1) * GAP)) / 2;
    items.forEach((it, i) => {
      const r = Math.floor(i / g.cols);
      const c = i % g.cols;
      const inRow = Math.min(g.cols, n - r * g.cols);
      const rowW = inRow * g.w + (inRow - 1) * GAP;
      out.set(it, { x: x + (W - rowW) / 2 + c * (g.w + GAP), y: top + r * (g.h + GAP), w: g.w, h: g.h });
    });
  }

  function fit(W, H) {
    const w = Math.min(W, H * AR);
    return { w, h: w / AR };
  }

  function computeLayout(W, H) {
    const out = new Map();
    const main = streams.find((s) => s.key === focusKey);
    if (!main || streams.length === 1) {
      placeGrid(streams, 0, 0, W, H, out);
      return out;
    }
    const rest = streams.filter((s) => s !== main);

    // Option A: big player on the left, others in a column on the right.
    // Option B: big player on top, others in a row below. Keep whichever gives the big one more room.
    const a = fit(W * 0.78, H);
    const b = fit(W, H * 0.75);
    if (a.w >= b.w) {
      out.set(main, { x: 0, y: (H - a.h) / 2, ...a });
      placeGrid(rest, a.w + GAP, 0, W - a.w - GAP, H, out);
    } else {
      out.set(main, { x: (W - b.w) / 2, y: 0, ...b });
      placeGrid(rest, 0, b.h + GAP, W, H - b.h - GAP, out);
    }
    return out;
  }

  function layout() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const rects = computeLayout(W, H);
    for (const s of streams) {
      const r = rects.get(s);
      if (!r) continue;
      Object.assign(s.el.style, {
        left: `${Math.round(r.x)}px`,
        top: `${Math.round(r.y)}px`,
        width: `${Math.round(r.w)}px`,
        height: `${Math.round(r.h)}px`,
      });
      const focused = s.key === focusKey && streams.length > 1;
      s.el.classList.toggle('focused', focused);
      const fb = s.el.querySelector('.focus-btn');
      fb.innerHTML = svg(focused ? 'unfocus' : 'focus');
      fb.title = focused ? 'Back to grid' : 'Make big';
      fb.setAttribute('aria-label', fb.title);
    }
  }

  // ---------- Page address (shareable link) ----------
  // Format: #tw:name/k:name/yt:VIDEOID/s:id   (a "*" in front marks the big one)
  let writingHash = false;

  function writeHash() {
    const h = streams.map((s) => (s.key === focusKey ? '*' : '') + s.key).join('/');
    const url = location.pathname + location.search + (h ? '#' + h : '');
    writingHash = true;
    history.replaceState(null, '', url);
    writingHash = false;
  }

  function readHash() {
    let h = location.hash.replace(/^#\/?/, '');
    try { h = decodeURIComponent(h); } catch {}
    const tokens = h.split('/').map((t) => t.trim()).filter(Boolean);
    const wanted = [];
    let focus = null;
    for (const tok of tokens) {
      const star = tok.startsWith('*');
      const r = parse(star ? tok.slice(1) : tok);
      if (r && !r.error) {
        wanted.push(r);
        if (star) focus = keyOf(r);
      }
    }
    return { wanted, focus };
  }

  function loadFromHash() {
    const { wanted, focus } = readHash();
    const wantedKeys = wanted.map(keyOf);
    // Keep players that are still wanted (so they don't reload), drop the rest
    streams.filter((s) => !wantedKeys.includes(s.key)).forEach((s) => s.el.remove());
    streams = streams.filter((s) => wantedKeys.includes(s.key));
    wanted.forEach((w) => add(w, { quiet: true }));
    streams.sort((x, y) => wantedKeys.indexOf(x.key) - wantedKeys.indexOf(y.key));
    focusKey = focus;
    update();
  }

  function update() {
    empty.hidden = streams.length > 0;
    document.title = streams.length ? `Multi Viewer (${streams.length})` : 'Multi Viewer';
    layout();
    writeHash();
  }

  // ---------- UI ----------
  let toastTimer;
  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('error', isError);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), isError ? 6000 : 2500);
  }

  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pieces = input.value.split(/[\s,]+/).filter(Boolean);
    const errors = [];
    let added = 0;
    for (const p of pieces) {
      const r = parse(p);
      if (!r) continue;
      if (r.error) errors.push(r.error);
      else if (add(r)) added++;
    }
    if (added) update();
    if (errors.length) {
      toast(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : ''), true);
    } else {
      input.value = '';
    }
  });

  $('#shareBtn').addEventListener('click', async () => {
    if (!streams.length) return toast('Add a stream first');
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied. Anyone who opens it sees these streams.');
    } catch {
      prompt('Copy this link:', location.href);
    }
  });

  $('#clearBtn').addEventListener('click', () => {
    if (streams.length && confirm('Remove all streams?')) clearAll();
  });

  function setBarHidden(hidden) {
    document.body.classList.toggle('bar-hidden', hidden);
    try { localStorage.setItem('mv-bar-hidden', hidden ? '1' : ''); } catch {}
    layout();
  }
  $('#hideBtn').addEventListener('click', () => setBarHidden(true));
  $('#showBar').addEventListener('click', () => setBarHidden(false));

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof Element && e.target.closest('input, textarea');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'h' || e.key === 'H') setBarHidden(!document.body.classList.contains('bar-hidden'));
    if (e.key === 'Escape' && focusKey) { focusKey = null; update(); }
  });

  window.addEventListener('hashchange', () => { if (!writingHash) loadFromHash(); });
  new ResizeObserver(layout).observe(stage);

  // Twitch and YouTube refuse to play when the page is opened as a plain file
  if (location.protocol === 'file:') {
    const n = $('#notice');
    n.hidden = false;
    n.textContent = 'Opened as a local file: Twitch and YouTube won\'t play here. Use the GitHub Pages link or run a local web server.';
  }

  try { if (localStorage.getItem('mv-bar-hidden')) document.body.classList.add('bar-hidden'); } catch {}
  loadFromHash();
  if (!streams.length) input.focus();
})();
