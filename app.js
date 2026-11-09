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
  //   mute: whether the viewer can mute/unmute it
  //   api:  'yt' / 'tw' players take volume commands, so they always load muted and
  //         get their sound (at VOLUME) turned on once ready. Kick can only be told
  //         "muted or not" in its address, and SOOP not even that.
  const VOLUME = 26;                     // % volume for YouTube and Twitch players
  const enc = encodeURIComponent;
  const TYPES = {
    tw: { label: 'Twitch', dot: 'tw', mute: true, api: 'tw',
          embed: (id) => `https://player.twitch.tv/?channel=${enc(id)}&parent=${enc(HOST)}&muted=true&autoplay=true`,
          open: (id) => `https://www.twitch.tv/${id}` },
    tv: { label: 'Twitch VOD', dot: 'tw', mute: true, api: 'tw',
          embed: (id) => `https://player.twitch.tv/?video=v${enc(id)}&parent=${enc(HOST)}&muted=true&autoplay=true`,
          open: (id) => `https://www.twitch.tv/videos/${id}` },
    tc: { label: 'Twitch clip', dot: 'tw', mute: true, api: 'tw',
          embed: (id) => `https://clips.twitch.tv/embed?clip=${enc(id)}&parent=${enc(HOST)}&muted=true&autoplay=true`,
          open: (id) => `https://clips.twitch.tv/${id}` },
    k:  { label: 'Kick', dot: 'k', mute: true,
          embed: (id, m) => `https://player.kick.com/${enc(id)}?autoplay=true&muted=${m}`,
          open: (id) => `https://kick.com/${id}` },
    yt: { label: 'YouTube', dot: 'yt', mute: true, api: 'yt',
          embed: (id) => `https://www.youtube.com/embed/${enc(id)}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&origin=${enc(location.origin)}`,
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

  // ---------- Layouts ----------
  // Each zone is [x, y, width, height] as a fraction of the screen.
  const T = 1 / 3;
  const grid = (cols, rows) => {
    const z = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) z.push([c / cols, r / rows, 1 / cols, 1 / rows]);
    return z;
  };
  const LAYOUTS = [
    { id: '2v', zones: [[0, 0, .5, 1], [.5, 0, .5, 1]] },
    { id: '2w', zones: [[0, 0, 2 * T, 1], [2 * T, 0, T, 1]] },
    { id: '2h', zones: [[0, 0, 1, .5], [0, .5, 1, .5]] },
    { id: '3r', zones: [[0, 0, .5, 1], [.5, 0, .5, .5], [.5, .5, .5, .5]] },
    { id: '3l', zones: [[0, 0, .5, .5], [0, .5, .5, .5], [.5, 0, .5, 1]] },
    { id: '3c', zones: grid(3, 1) },
    { id: '3m', zones: [[0, 0, .25, 1], [.25, 0, .5, 1], [.75, 0, .25, 1]] },
    { id: '3b', zones: [[0, 0, 1, 2 * T], [0, 2 * T, .5, T], [.5, 2 * T, .5, T]] },
    { id: '4g', zones: grid(2, 2) },
    { id: '4r', zones: [[0, 0, .75, 1], [.75, 0, .25, T], [.75, T, .25, T], [.75, 2 * T, .25, T]] },
    { id: '4b', zones: [[0, 0, 1, .75], [0, .75, T, .25], [T, .75, T, .25], [2 * T, .75, T, .25]] },
    { id: '4c', zones: grid(4, 1) },
    { id: '5r', zones: [[0, 0, .5, 1], [.5, 0, .25, .5], [.75, 0, .25, .5], [.5, .5, .25, .5], [.75, .5, .25, .5]] },
    { id: '5b', zones: [[0, 0, .5, .6], [.5, 0, .5, .6], [0, .6, T, .4], [T, .6, T, .4], [2 * T, .6, T, .4]] },
    { id: '6l', zones: [[0, 0, 2 * T, 2 * T], [2 * T, 0, T, T], [2 * T, T, T, T], [0, 2 * T, T, T], [T, 2 * T, T, T], [2 * T, 2 * T, T, T]] },
    { id: '6g', zones: grid(3, 2) },
    { id: '8g', zones: grid(4, 2) },
    { id: '9g', zones: grid(3, 3) },
  ];
  const LAYOUT_BY_ID = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]));

  // The screen shape at which this layout's spots come closest to 16:9.
  // Used to size the layout when "Fill screen" is off, so videos aren't letterboxed.
  for (const l of LAYOUTS) {
    let sum = 0, weight = 0;
    for (const [, , w, h] of l.zones) {
      sum += w * h * Math.log(AR * h / w);
      weight += w * h;
    }
    l.aspect = Math.exp(sum / weight);
  }

  // ---------- State ----------
  /** @type {{key:string,t:string,id:string,muted:boolean,el:HTMLElement,frame:HTMLIFrameElement}[]} */
  let streams = [];        // every open stream (its order is the Auto layout order)
  let focusKey = null;     // the big one in Auto layout
  let layoutId = 'auto';   // 'auto' or an id from LAYOUTS
  let slots = [];          // custom layout only: stream key (or null) for each spot
  let fillScreen = false;
  const keyOf = (s) => `${s.t}:${s.id}`;
  const isCustom = () => layoutId !== 'auto';
  const byKey = (key) => streams.find((s) => s.key === key);

  /** Streams in the order they appear on screen. */
  function visualOrder() {
    return isCustom() ? slots.filter(Boolean) : streams.map((s) => s.key);
  }

  // Browsers only allow sound after the person has clicked or typed on the page.
  // Before that (e.g. opening a shared link), streams start muted and the
  // "Turn on sound" button appears.
  const canPlaySound = () => !!navigator.userActivation?.hasBeenActive;

  function add(stream, { quiet = false, sound = canPlaySound() } = {}) {
    const key = keyOf(stream);
    if (byKey(key)) {
      if (!quiet) toast(`${TYPES[stream.t].label} ${stream.id} is already open`);
      return null;
    }
    const s = { ...stream, key, muted: !sound, waitingForClick: !sound };
    s.el = buildTile(s);
    streams.push(s);
    stage.appendChild(s.el);
    return s;
  }

  /** Put a newly added stream into the first empty spot. Returns false if there was none. */
  function placeNew(key) {
    if (!isCustom()) return true;
    const i = slots.indexOf(null);
    if (i < 0) return false;
    slots[i] = key;
    return true;
  }

  function remove(key) {
    const s = byKey(key);
    if (!s) return;
    s.el.remove();
    streams = streams.filter((x) => x !== s);
    if (focusKey === key) focusKey = null;
    if (isCustom()) slots = slots.map((k) => (k === key ? null : k));
    update();
  }

  /** Drag & drop: put fromKey where toKey is (swap in a custom layout). */
  function move(fromKey, toKey) {
    if (fromKey === toKey) return;
    if (isCustom()) {
      const a = slots.indexOf(fromKey), b = slots.indexOf(toKey);
      if (a < 0 || b < 0) return;
      [slots[a], slots[b]] = [slots[b], slots[a]];
    } else {
      const from = streams.findIndex((s) => s.key === fromKey);
      const to = streams.findIndex((s) => s.key === toKey);
      if (from < 0 || to < 0) return;
      const [s] = streams.splice(from, 1);
      streams.splice(to, 0, s);
    }
    update();
  }

  /** Drag & drop onto an empty spot in a custom layout. */
  function moveToSlot(key, index) {
    const from = slots.indexOf(key);
    if (from < 0 || slots[index]) return;
    slots[from] = null;
    slots[index] = key;
    update();
  }

  /**
   * Switch layout. With placeKey + zone, that stream goes into that exact spot
   * (swapping with whatever was there when the layout stays the same).
   */
  function setLayout(id, { placeKey = null, zone = -1 } = {}) {
    const order = visualOrder();
    if (id === 'auto') {
      if (!isCustom()) return;
      // Keep the on-screen order; anything not on screen yet goes last
      const rank = (k) => { const i = order.indexOf(k); return i < 0 ? Infinity : i; };
      streams.sort((a, b) => rank(a.key) - rank(b.key));
      layoutId = 'auto';
      slots = [];
      update();
      return;
    }
    const L = LAYOUT_BY_ID[id];
    if (!L) return;
    if (order.length > L.zones.length) {
      toast(`That layout has ${L.zones.length} spots but you have ${order.length} streams`, true);
      return;
    }
    let next;
    if (placeKey && id === layoutId) {
      next = [...slots];
      const from = next.indexOf(placeKey);
      [next[from], next[zone]] = [next[zone], next[from]];
    } else {
      next = L.zones.map(() => null);
      if (placeKey) next[zone] = placeKey;
      let i = 0;
      for (const k of order) {
        if (k === placeKey) continue;
        while (next[i]) i++;
        next[i] = k;
      }
    }
    layoutId = id;
    slots = next;
    focusKey = null;
    update();
  }

  function clearAll() {
    streams.forEach((s) => s.el.remove());
    streams = [];
    focusKey = null;
    layoutId = 'auto';
    slots = [];
    update();
  }

  // ---------- Tiles ----------
  const ICONS = {
    focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    unfocus: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    layout: '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
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

  // ---------- Sound ----------
  function post(s, msg) {
    try { s.frame.contentWindow?.postMessage(msg, '*'); } catch {}
  }

  /** Tell a YouTube or Twitch player whether to be muted, and set its volume. */
  function sendAudio(s) {
    const api = TYPES[s.t].api;
    if (api === 'yt') {
      const cmd = (func, args = []) => post(s, JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }));
      post(s, JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }));
      // Volume is set even while muted, so unmuting inside the player also gives VOLUME
      cmd('setVolume', [VOLUME]);
      cmd(s.muted ? 'mute' : 'unMute');
    } else if (api === 'tw') {
      // Twitch's embed commands: 10 = set muted, 11 = set volume (0 to 1)
      const cmd = (eventName, params) => post(s, { eventName, params, namespace: 'twitch-embed-player-proxy' });
      cmd(11, VOLUME / 100);
      cmd(10, s.muted);
    }
  }

  // Players finish starting up at different times, so the sound settings are sent
  // a few times after loading and again when the player says it's ready. After
  // that, whatever the person sets inside the player is left alone.
  function onFrameLoad(s) {
    if (!TYPES[s.t].api) return;
    s.audioUntil = Date.now() + 15000;
    s.readySeen = new Set();
    clearTimeout(s.audioTimer);
    let i = 0;
    const delays = [600, 1500, 3000, 6000];
    const tick = () => {
      if (!byKey(s.key)) return;
      sendAudio(s);
      if (++i < delays.length) s.audioTimer = setTimeout(tick, delays[i] - delays[i - 1]);
    };
    s.audioTimer = setTimeout(tick, delays[0]);
  }

  window.addEventListener('message', (e) => {
    const s = streams.find((x) => x.frame.contentWindow === e.source);
    if (!s || !(Date.now() < s.audioUntil)) return;
    let d = e.data;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch { return; }
    }
    if (!d || typeof d !== 'object') return;
    const ev = d.event === 'onReady' ? 'yt-ready'
      : d.namespace === 'twitch-embed' && ['ready', 'video.ready', 'playing'].includes(d.eventName) ? d.eventName
      : null;
    if (ev && !s.readySeen.has(ev)) {
      s.readySeen.add(ev);
      sendAudio(s);
    }
  });

  function setSound(s, on) {
    s.muted = !on;
    s.waitingForClick = false;
    if (TYPES[s.t].api) {
      s.audioUntil = Date.now() + 15000;
      s.readySeen = new Set();
      sendAudio(s);
    } else {
      s.frame.src = embedUrl(s);   // Kick only reads this when loading
    }
    refreshMuteButton(s);
    refreshSoundPrompt();
  }

  function refreshMuteButton(s) {
    const b = s.muteBtn;
    if (!b) return;
    const reloads = TYPES[s.t].api ? '' : ' (reloads player)';
    b.innerHTML = svg(s.muted ? 'muted' : 'sound');
    b.title = (s.muted ? 'Turn sound on' : 'Mute') + reloads;
    b.setAttribute('aria-label', b.title);
  }

  const soundBtn = $('#soundBtn');
  function refreshSoundPrompt() {
    soundBtn.hidden = !streams.some((s) => s.waitingForClick);
  }
  function turnOnWaitingSound() {
    streams.filter((s) => s.waitingForClick).forEach((s) => setSound(s, true));
  }
  soundBtn.addEventListener('click', turnOnWaitingSound);
  // Any click or key press on the page counts, so sound comes on with the first one
  document.addEventListener('pointerdown', turnOnWaitingSound, true);
  document.addEventListener('keydown', turnOnWaitingSound, true);

  // ---------- Moving streams by dragging ----------
  // Press and hold a stream's name (or anywhere on it in Arrange mode), drag it
  // over another stream to swap places, or over an empty spot to move it there.
  // Tiles never move inside the page (that would reload the players); only their
  // position on screen changes.
  let drag = null;

  function dropTargetAt(x, y, dragged) {
    const inside = (el) => {
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    for (const s of streams) if (s !== dragged && inside(s.el)) return { el: s.el, key: s.key };
    for (const el of emptySpots) if (inside(el)) return { el, index: Number(el.dataset.index) };
    return null;
  }

  function endDrag(drop) {
    const { s, target } = drag;
    drag = null;
    target?.el.classList.remove('drop-target');
    const before = s.el.getBoundingClientRect();
    s.el.classList.add('no-anim');           // jump straight to the new spot, then glide in
    stage.classList.remove('dragging');
    if (drop && target) {
      if (target.key) move(s.key, target.key);
      else moveToSlot(s.key, target.index);
    }
    s.el.style.transform = 'none';
    const after = s.el.getBoundingClientRect();
    s.el.style.transform = `translate(${before.left - after.left}px, ${before.top - after.top}px)`;
    void s.el.offsetWidth;                   // apply that before animating
    s.el.classList.remove('no-anim');
    s.el.classList.add('settling');
    s.el.style.transform = '';
    setTimeout(() => s.el.classList.remove('lifted', 'settling'), 260);
  }

  function makeDragHandle(handle, s) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || drag) return;
      e.preventDefault();
      try { handle.setPointerCapture(e.pointerId); } catch {}
      drag = { s, handle, x0: e.clientX, y0: e.clientY, active: false, target: null };
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag || drag.handle !== handle) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.active) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.active = true;
        closeMenu();
        stage.classList.add('dragging');
        s.el.classList.add('lifted');
      }
      s.el.style.transform = `translate(${dx}px, ${dy}px)`;
      const t = dropTargetAt(e.clientX, e.clientY, s);
      if (t?.el !== drag.target?.el) {
        drag.target?.el.classList.remove('drop-target');
        t?.el.classList.add('drop-target');
        drag.target = t;
      }
    });
    const finish = (drop) => () => {
      if (!drag || drag.handle !== handle) return;
      if (drag.active) endDrag(drop);
      else drag = null;
    };
    handle.addEventListener('pointerup', finish(true));
    handle.addEventListener('pointercancel', finish(false));
    handle.addEventListener('lostpointercapture', finish(false));
  }

  // ---------- Building a tile ----------
  function buildTile(s) {
    const type = TYPES[s.t];
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.key = s.key;

    const frame = document.createElement('iframe');
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.title = `${type.label}: ${s.id}`;
    frame.addEventListener('load', () => onFrameLoad(s));
    frame.src = embedUrl(s);
    s.frame = frame;

    // Covers the video in Arrange mode so the whole stream can be grabbed
    const grab = document.createElement('div');
    grab.className = 'grab';
    const grabName = document.createElement('b');
    grabName.textContent = s.id;
    const grabHint = document.createElement('span');
    grabHint.textContent = 'Hold and drag to move';
    grab.append(grabName, grabHint);
    makeDragHandle(grab, s);

    const bar = document.createElement('div');
    bar.className = 'tile-bar';

    const name = document.createElement('div');
    name.className = 'tile-name';
    name.title = 'Hold and drag to move';
    const dot = document.createElement('span');
    dot.className = `dot ${type.dot}`;
    const label = document.createElement('span');
    label.textContent = s.id;
    name.append(dot, label);
    makeDragHandle(name, s);
    bar.append(name);

    const layoutBtn = iconButton('layout', 'Choose this stream\'s spot', () => openMenu(layoutBtn, s.key));
    bar.append(layoutBtn);

    const focusBtn = iconButton('focus', 'Make big', () => {
      focusKey = focusKey === s.key ? null : s.key;
      update();
    });
    focusBtn.classList.add('focus-btn');
    bar.append(focusBtn);

    if (type.mute) {
      s.muteBtn = iconButton('muted', '', () => setSound(s, s.muted));
      refreshMuteButton(s);
      bar.append(s.muteBtn);
    }

    bar.append(
      iconButton('reload', 'Reload', () => { frame.src = embedUrl(s); }),
      iconButton('open', `Open on ${type.label.split(' ')[0]}`, () => window.open(type.open(s.id), '_blank', 'noopener')),
      iconButton('close', 'Remove', () => remove(s.key)),
    );

    el.append(frame, grab, bar);
    return el;
  }

  // ---------- Positioning ----------
  function bestGrid(n, W, H) {
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - GAP * (cols - 1)) / cols, ((H - GAP * (rows - 1)) / rows) * AR);
      if (!best || w > best.w + 0.5) best = { cols, rows, w, h: w / AR };
    }
    return best;
  }

  function placeGrid(keys, x, y, W, H, out) {
    const n = keys.length;
    if (!n || W <= 0 || H <= 0) return;
    const g = bestGrid(n, W, H);
    const top = y + (H - (g.rows * g.h + (g.rows - 1) * GAP)) / 2;
    keys.forEach((k, i) => {
      const r = Math.floor(i / g.cols);
      const c = i % g.cols;
      const inRow = Math.min(g.cols, n - r * g.cols);
      const rowW = inRow * g.w + (inRow - 1) * GAP;
      out.set(k, { x: x + (W - rowW) / 2 + c * (g.w + GAP), y: top + r * (g.h + GAP), w: g.w, h: g.h });
    });
  }

  function fit(W, H, aspect = AR) {
    const w = Math.min(W, H * aspect);
    return { w, h: w / aspect };
  }

  /** Auto layout: equal 16:9 tiles, or one big + the rest in a strip. */
  function autoRects(W, H) {
    const out = new Map();
    const keys = streams.map((s) => s.key);
    if (!byKey(focusKey) || keys.length === 1) {
      placeGrid(keys, 0, 0, W, H, out);
      return out;
    }
    const rest = keys.filter((k) => k !== focusKey);
    // Big one on the left with a column on the right, or on top with a row below:
    // whichever leaves the big one more room.
    const a = fit(W * 0.78, H);
    const b = fit(W, H * 0.75);
    if (a.w >= b.w) {
      out.set(focusKey, { x: 0, y: (H - a.h) / 2, ...a });
      placeGrid(rest, a.w + GAP, 0, W - a.w - GAP, H, out);
    } else {
      out.set(focusKey, { x: (W - b.w) / 2, y: 0, ...b });
      placeGrid(rest, 0, b.h + GAP, W, H - b.h - GAP, out);
    }
    return out;
  }

  /** Custom layout: one rect per spot (index), whether filled or empty. */
  function zoneRects(W, H) {
    const L = LAYOUT_BY_ID[layoutId];
    const box = fillScreen ? { w: W, h: H } : fit(W, H, L.aspect);
    const bx = (W - box.w) / 2, by = (H - box.h) / 2;
    const half = GAP / 2;
    return L.zones.map(([x, y, w, h]) => ({
      x: bx + x * box.w + half,
      y: by + y * box.h + half,
      w: w * box.w - GAP,
      h: h * box.h - GAP,
    }));
  }

  function setRect(el, r) {
    Object.assign(el.style, {
      left: `${Math.round(r.x)}px`,
      top: `${Math.round(r.y)}px`,
      width: `${Math.round(r.w)}px`,
      height: `${Math.round(r.h)}px`,
    });
  }

  let emptySpots = [];

  function emptySpot(index) {
    const el = document.createElement('div');
    el.className = 'empty-spot';
    el.innerHTML = '<b>Empty spot</b><span>Drop here</span>';
    el.dataset.index = index;
    return el;
  }

  function layout() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    emptySpots.forEach((el) => el.remove());
    emptySpots = [];
    stage.classList.toggle('custom', isCustom());

    if (isCustom()) {
      zoneRects(W, H).forEach((r, i) => {
        const s = byKey(slots[i]);
        if (s) {
          setRect(s.el, r);
        } else {
          const el = emptySpot(i);
          setRect(el, r);
          stage.appendChild(el);
          emptySpots.push(el);
        }
      });
    } else {
      const rects = autoRects(W, H);
      for (const s of streams) if (rects.has(s.key)) setRect(s.el, rects.get(s.key));
    }

    for (const s of streams) {
      const focused = !isCustom() && s.key === focusKey && streams.length > 1;
      s.el.classList.toggle('focused', focused);
      const fb = s.el.querySelector('.focus-btn');
      fb.innerHTML = svg(focused ? 'unfocus' : 'focus');
      fb.title = focused ? 'Back to grid' : 'Make big';
      fb.setAttribute('aria-label', fb.title);
    }
  }

  // ---------- Layout menu ----------
  const menu = $('#layoutMenu');
  const menuTitle = $('#layoutMenuTitle');
  const menuHint = $('#layoutMenuHint');
  const layoutGrid = $('#layoutGrid');
  const fillToggle = $('#fillToggle');
  let menuKey = null;      // which stream the menu is placing, or null for "whole layout"
  let menuAnchor = null;

  function zoneStyle([x, y, w, h]) {
    // 4px padding inside the preview card, 1.5px gap between zones
    return `left:calc(4px + (100% - 8px) * ${x} + 1.5px);top:calc(4px + (100% - 8px) * ${y} + 1.5px);` +
           `width:calc((100% - 8px) * ${w} - 3px);height:calc((100% - 8px) * ${h} - 3px)`;
  }

  function buildMenu() {
    for (const L of LAYOUTS) {
      const card = document.createElement('div');
      card.className = 'lay';
      card.dataset.id = L.id;
      L.zones.forEach((z, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'zone';
        b.style.cssText = zoneStyle(z);
        b.setAttribute('aria-label', `${L.zones.length} stream layout, spot ${i + 1}`);
        b.addEventListener('click', () => {
          const key = menuKey;
          closeMenu();
          setLayout(L.id, key ? { placeKey: key, zone: i } : {});
        });
        card.appendChild(b);
      });
      layoutGrid.appendChild(card);
    }
  }

  function refreshMenu() {
    const n = streams.length;
    const name = menuKey ? byKey(menuKey)?.id : null;
    menu.classList.toggle('placing', !!menuKey);
    menuTitle.textContent = name ? `Move ${name} to…` : 'Layout';
    menuHint.textContent = name
      ? 'Click the spot where this stream should go.'
      : 'Pick a layout. Then use a stream\'s layout button to choose its exact spot, or drag names to swap.';
    $('#autoLayout').classList.toggle('current', !isCustom());
    $('#autoLayout').hidden = !!menuKey;
    layoutGrid.querySelectorAll('.lay').forEach((card) => {
      const L = LAYOUT_BY_ID[card.dataset.id];
      const tooSmall = L.zones.length < n;
      card.classList.toggle('disabled', tooSmall);
      card.classList.toggle('current', L.id === layoutId);
      card.title = tooSmall ? `Only ${L.zones.length} spots (you have ${n} streams)` : '';
      card.querySelectorAll('.zone').forEach((z, i) => {
        z.disabled = tooSmall;
        z.classList.toggle('here', !!menuKey && L.id === layoutId && slots[i] === menuKey);
      });
    });
    fillToggle.checked = fillScreen;
  }

  function positionMenu() {
    if (menu.hidden || !menuAnchor) return;
    const a = menuAnchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(a.right - m.width, innerWidth - m.width - 8));
    let top = a.bottom + 6;
    if (top + m.height > innerHeight - 8) top = Math.max(8, a.top - m.height - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function openMenu(anchor, key = null) {
    if (!menu.hidden && menuAnchor === anchor) return closeMenu();
    menuAnchor = anchor;
    menuKey = key;
    refreshMenu();
    menu.hidden = false;
    positionMenu();
    menu.querySelector('.zone:not(:disabled), #autoLayout:not([hidden])')?.focus({ preventScroll: true });
  }

  function closeMenu() {
    menu.hidden = true;
    menuAnchor = null;
    menuKey = null;
  }

  buildMenu();
  $('#layoutBtn').addEventListener('click', (e) => openMenu(e.currentTarget));
  $('#autoLayout').addEventListener('click', () => { closeMenu(); setLayout('auto'); });
  fillToggle.addEventListener('change', () => {
    fillScreen = fillToggle.checked;
    try { localStorage.setItem('mv-fill', fillScreen ? '1' : ''); } catch {}
    layout();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !menuAnchor?.contains(e.target)) closeMenu();
  });
  // Clicking into a video moves focus to its frame, which the page sees as a blur
  window.addEventListener('blur', () => { if (!menu.hidden) closeMenu(); });

  // ---------- Page address (shareable link) ----------
  // Auto:   #tw:name/k:name/yt:VIDEOID/s:id    ("*" in front marks the big one)
  // Custom: #@4r/tw:name/-/k:name/s:id         (layout id first; "-" is an empty spot)
  let writingHash = false;

  function writeHash() {
    let h = '';
    if (isCustom()) {
      h = ['@' + layoutId, ...slots.map((k) => k || '-')].join('/');
    } else if (streams.length) {
      h = streams.map((s) => (s.key === focusKey ? '*' : '') + s.key).join('/');
    }
    const url = location.pathname + location.search + (h ? '#' + h : '');
    writingHash = true;
    history.replaceState(null, '', url);
    writingHash = false;
  }

  function readHash() {
    let h = location.hash.replace(/^#\/?/, '');
    try { h = decodeURIComponent(h); } catch {}
    const tokens = h.split('/').map((t) => t.trim()).filter(Boolean);
    let layout = null;
    if (tokens[0]?.startsWith('@')) layout = tokens.shift().slice(1);
    const entries = [];   // stream, or null for an empty spot
    let focus = null;
    for (const tok of tokens) {
      if (tok === '-') { entries.push(null); continue; }
      const star = tok.startsWith('*');
      const r = parse(star ? tok.slice(1) : tok);
      if (r && !r.error) {
        entries.push(r);
        if (star) focus = keyOf(r);
      }
    }
    return { layout, entries, focus };
  }

  function loadFromHash() {
    const { layout: id, entries, focus } = readHash();
    const wanted = entries.filter(Boolean);
    const wantedKeys = wanted.map(keyOf);
    // Keep players that are still wanted (so they don't reload), drop the rest
    streams.filter((s) => !wantedKeys.includes(s.key)).forEach((s) => s.el.remove());
    streams = streams.filter((s) => wantedKeys.includes(s.key));
    wanted.forEach((w) => add(w, { quiet: true }));
    streams.sort((x, y) => wantedKeys.indexOf(x.key) - wantedKeys.indexOf(y.key));
    focusKey = focus;

    const L = id && LAYOUT_BY_ID[id];
    if (L && wanted.length && wanted.length <= L.zones.length) {
      layoutId = id;
      const seen = new Set();
      slots = L.zones.map((_, i) => {
        const k = entries[i] ? keyOf(entries[i]) : null;
        if (!k || seen.has(k)) return null;
        seen.add(k);
        return k;
      });
      // Anything that didn't fit in its listed spot goes into the first free one
      for (const s of streams) if (!seen.has(s.key)) slots[slots.indexOf(null)] = s.key;
    } else {
      layoutId = 'auto';
      slots = [];
    }
    update();
  }

  function update() {
    if (!streams.length && isCustom()) { layoutId = 'auto'; slots = []; }
    empty.hidden = streams.length > 0;
    document.title = streams.length ? `Multi Viewer (${streams.length})` : 'Multi Viewer';
    layout();
    writeHash();
    if (!menu.hidden) { refreshMenu(); positionMenu(); }
    refreshSoundPrompt();
    if (!streams.length) setArranging(false);
  }

  // ---------- Theme ----------
  const themeBtn = $('#themeBtn');
  const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  const MOON = '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>';

  function showThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeBtn.innerHTML = `<svg viewBox="0 0 24 24">${dark ? SUN : MOON}</svg>`;
    themeBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    themeBtn.setAttribute('aria-label', themeBtn.title);
  }
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('mv-theme', next); } catch {}
    showThemeButton();
  });
  showThemeButton();

  // ---------- Other UI ----------
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
    let overflowed = false;
    for (const p of pieces) {
      const r = parse(p);
      if (!r) continue;
      if (r.error) { errors.push(r.error); continue; }
      const s = add(r, { sound: true });   // pressing Add counts as a click, so sound is allowed
      if (!s) continue;
      added++;
      if (!placeNew(s.key)) {
        // No free spot in the custom layout: fall back to Auto so nothing is hidden
        setLayout('auto');
        overflowed = true;
      }
    }
    if (added) update();
    if (errors.length) {
      toast(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : ''), true);
    } else {
      input.value = '';
      if (overflowed) toast('No empty spot left, so the layout switched to Auto. Pick a bigger layout to arrange them.');
    }
  });

  $('#shareBtn').addEventListener('click', async () => {
    if (!streams.length) return toast('Add a stream first');
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied. Anyone who opens it sees these streams in this layout.');
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
    closeMenu();
    layout();
  }
  $('#hideBtn').addEventListener('click', () => setBarHidden(true));
  $('#showBar').addEventListener('click', () => setBarHidden(false));

  // Arrange mode: every stream gets a cover you can grab anywhere to drag it
  const arrangeBtn = $('#arrangeBtn');
  function setArranging(on) {
    stage.classList.toggle('arranging', on);
    arrangeBtn.setAttribute('aria-pressed', String(on));
    arrangeBtn.querySelector('span').textContent = on ? 'Done' : 'Arrange';
    arrangeBtn.classList.toggle('primary', on);
  }
  arrangeBtn.addEventListener('click', () => {
    if (!streams.length) return toast('Add a stream first');
    setArranging(!stage.classList.contains('arranging'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drag?.active) { endDrag(false); return; }
    if (e.key === 'Escape' && !menu.hidden) { closeMenu(); return; }
    if (e.key === 'Escape' && stage.classList.contains('arranging')) { setArranging(false); return; }
    const typing = e.target instanceof Element && e.target.closest('input, textarea');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'h' || e.key === 'H') setBarHidden(!document.body.classList.contains('bar-hidden'));
    if (e.key === 'l' || e.key === 'L') openMenu($('#layoutBtn'));
    if ((e.key === 'a' || e.key === 'A') && streams.length) setArranging(!stage.classList.contains('arranging'));
    if (e.key === 'Escape' && focusKey) { focusKey = null; update(); }
  });

  window.addEventListener('hashchange', () => { if (!writingHash) loadFromHash(); });
  window.addEventListener('resize', positionMenu);
  new ResizeObserver(layout).observe(stage);

  // Twitch and YouTube refuse to play when the page is opened as a plain file
  if (location.protocol === 'file:') {
    const n = $('#notice');
    n.hidden = false;
    n.textContent = 'Opened as a local file: Twitch and YouTube won\'t play here. Use the GitHub Pages link or run a local web server.';
  }

  try {
    if (localStorage.getItem('mv-bar-hidden')) document.body.classList.add('bar-hidden');
    fillScreen = !!localStorage.getItem('mv-fill');
  } catch {}
  loadFromHash();
  if (!streams.length) input.focus();
})();
