// Track Me demo mode: a small stand-in for Supabase that runs entirely in your browser.
// It is used automatically when js/config.js has no Supabase keys, so every page works right away.
// Sample friends reply automatically. Profile, coins, badges and streaks are saved in this browser;
// chat messages (which can contain places) are kept in memory only and reset on reload.
(function () {
  const KEY = "trackme-demo-v1", SESSION = "trackme-demo-session", ME = "demo-me";
  const KEEP = ["profiles", "player_stats", "user_badges", "friendships", "streaks"];
  const day = (o) => new Date(Date.now() + o * 864e5).toISOString().slice(0, 10);
  const CANNED = ["Haha nice 😄", "Love that! 🔥", "I'll check it out this weekend", "Same! Let's go together", "👍👍", "Ooh, tell me more!"];

  function seed() {
    return {
      profiles: [
        { id: ME, username: "you_demo", display_name: "You", avatar: {} },
        { id: "sophie", username: "sophie", display_name: "Sophie", avatar: { hair: "long", hairColor: 6, skin: 1, mouth: "grin", eyes: "lashes", topColor: 2, bg: 2 } },
        { id: "mia", username: "mia", display_name: "Mia", avatar: { hair: "bun", hairColor: 3, skin: 4, eyes: "happy", glasses: "round", topColor: 3, bg: 4 } },
        { id: "jake", username: "jake", display_name: "Jake", avatar: { hair: "spiky", hairColor: 0, skin: 3, beard: "stubble", top: "jacket", topColor: 6, bg: 6 } },
        { id: "kai", username: "kai", display_name: "Kai", avatar: { hair: "mohawk", hairColor: 7, skin: 2, glasses: "shades", hat: "none", bg: 3 } },
        { id: "ava", username: "ava", display_name: "Ava", avatar: { hair: "afro", hairColor: 1, skin: 6, eyes: "wink", earring: "hoop", topColor: 5, bg: 5 } },
        { id: "leo", username: "leo", display_name: "Leo", avatar: { hair: "curly", hairColor: 4, skin: 0, beard: "moustache", hat: "beanie", topColor: 1, bg: 1 } },
      ],
      player_stats: [{ user_id: ME, coins: 120, streak: 0, last_checkin: null }],
      user_badges: [],
      friendships: [
        { id: 1, requester: ME, addressee: "sophie", status: "accepted" },
        { id: 2, requester: "mia", addressee: ME, status: "accepted" },
        { id: 3, requester: "jake", addressee: ME, status: "pending" },
      ],
      streaks: [
        { user_a: "demo-me", user_b: "sophie", count: 3, last_day: day(-1), a_day: day(-1), b_day: day(-1) },
        { user_a: "demo-me", user_b: "mia", count: 1, last_day: day(-1), a_day: day(-1), b_day: day(-1) },
      ],
    };
  }
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { db = seed(); }
  if (!db.profiles || !db.player_stats) db = seed();
  const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
  db.messages = [
    { id: 1, sender: "sophie", receiver: ME, kind: "text", body: "Hey! Found any good spots today? ☕", spot: null, coins: 0, created_at: ago(40) },
    { id: 2, sender: "mia", receiver: ME, kind: "text", body: "Welcome to Track Me 👋", spot: null, coins: 0, created_at: ago(90) },
  ];
  let nid = 100, rt = null, session = localStorage.getItem(SESSION) === "out" ? null : { user: { id: ME } };
  const authCbs = [];
  const save = () => { try { const o = {}; KEEP.forEach((k) => { o[k] = db[k]; }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* storage full or blocked: demo still works */ } };
  const stats = () => db.player_stats[0];

  function award(uid, badge) { // one badge once, +20 coins (mirrors award_badge in schema.sql)
    if (uid !== ME || db.user_badges.some((b) => b.user_id === uid && b.badge === badge)) return false;
    db.user_badges.push({ user_id: uid, badge, earned_at: new Date().toISOString() });
    stats().coins += 20;
    return true;
  }
  function bump(sender, receiver) { // pair streak grows when BOTH sent a spot on the same day (mirrors send_spot)
    const a = sender < receiver ? sender : receiver, b = sender < receiver ? receiver : sender, today = day(0);
    let s = db.streaks.find((x) => x.user_a === a && x.user_b === b);
    if (!s) { s = { user_a: a, user_b: b, count: 0, last_day: null, a_day: null, b_day: null }; db.streaks.push(s); }
    if (sender === a) s.a_day = today; else s.b_day = today;
    let grew = false;
    if (s.a_day === today && s.b_day === today && (!s.last_day || s.last_day < today)) {
      s.count = s.last_day === day(-1) ? s.count + 1 : 1; s.last_day = today; grew = true;
      stats().coins += 10;
      const got = [];
      [[3, "streak_3"], [7, "streak_7"], [30, "streak_30"]].forEach(([n, k]) => { if (s.count >= n && award(ME, k)) got.push(k); });
      return { grew, count: s.count, got };
    }
    return { grew, count: s.count, got: [] };
  }
  function friendSays(friendId, msg) { // a sample friend replies after a moment
    setTimeout(() => {
      const m = Object.assign({ id: ++nid, sender: friendId, receiver: ME, spot: null, coins: 0, created_at: new Date().toISOString() }, msg);
      db.messages.push(m);
      if (m.kind === "spot") bump(friendId, ME);
      save();
      if (rt) rt({ new: m });
    }, 1400);
  }

  function from(table) {
    let filters = [], op = "select", payload = null, one = false, maybe = false, ord = null, lim = null;
    const run = () => {
      const rows = db[table], m = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "insert") {
        const made = [].concat(payload).map((a) => Object.assign({ id: ++nid, created_at: new Date().toISOString(), status: "pending", spot: null, coins: 0 }, a));
        if (table === "friendships" && made.some((a) => rows.some((r) => (r.requester === a.requester && r.addressee === a.addressee) || (r.requester === a.addressee && r.addressee === a.requester)))) return { data: null, error: { code: "23505" } };
        rows.push(...made); save();
        if (table === "friendships") made.forEach((f) => { // sample people accept your request a moment later
          setTimeout(() => { f.status = "accepted"; save(); friendSays(f.addressee, { kind: "text", body: "Thanks for adding me! 👋" }); }, 800);
        });
        if (table === "messages" && made[0].sender === ME) friendSays(made[0].receiver, { kind: "text", body: CANNED[Math.floor(Math.random() * CANNED.length)] });
        return { data: one ? made[0] : made, error: null };
      }
      if (op === "update") {
        if (table === "profiles" && payload.username && rows.some((r) => r.username === payload.username && !m.includes(r))) return { data: null, error: { code: "23505" } };
        m.forEach((r) => Object.assign(r, payload)); save(); return { data: null, error: null };
      }
      if (op === "delete") { db[table] = rows.filter((r) => !m.includes(r)); save(); return { data: null, error: null }; }
      let out = m.slice();
      if (ord) out.sort((x, y) => (x[ord[0]] > y[ord[0]] ? 1 : -1) * (ord[1] ? 1 : -1));
      if (lim) out = out.slice(0, lim);
      if (one) return { data: out[0] || null, error: out[0] ? null : { message: "not found" } };
      return { data: maybe ? out[0] || null : out, error: null };
    };
    const b = {
      select() { return b; }, eq(c, v) { filters.push((r) => r[c] === v); return b; }, in(c, a) { filters.push((r) => a.includes(r[c])); return b; },
      or(str) { const pairs = [...str.matchAll(/sender\.eq\.([\w-]+),receiver\.eq\.([\w-]+)/g)]; filters.push((r) => pairs.some((p) => r.sender === p[1] && r.receiver === p[2])); return b; },
      order(c, o) { ord = [c, o.ascending]; return b; }, limit(n) { lim = n; return b; }, single() { one = true; return b; }, maybeSingle() { maybe = true; return b; },
      insert(v) { op = "insert"; payload = v; return b; }, update(v) { op = "update"; payload = v; return b; }, delete() { op = "delete"; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return b;
  }

  const rpcs = {
    check_in() {
      const s = stats(), today = day(0);
      if (s.last_checkin === today) return { already: true, coins: s.coins, streak: s.streak, badges: [] };
      s.streak = s.last_checkin === day(-1) ? s.streak + 1 : 1; s.last_checkin = today; s.coins += 2;
      const got = [];
      [[0, "first_checkin"], [7, "daily_7"], [30, "daily_30"]].forEach(([n, k]) => { if (s.streak >= n && award(ME, k)) got.push(k); });
      save(); return { already: false, coins: s.coins, streak: s.streak, badges: got };
    },
    respond_friend(a) {
      const f = db.friendships.find((x) => x.id === a.p_id && x.addressee === ME && x.status === "pending"); if (!f) return null;
      if (a.p_accept) f.status = "accepted"; else db.friendships = db.friendships.filter((x) => x !== f);
      save(); return null;
    },
    send_spot(a) {
      const ok = db.friendships.some((f) => f.status === "accepted" && (f.requester === a.p_receiver || f.addressee === a.p_receiver));
      if (!ok) throw new Error("you can only send spots to friends");
      const gift = a.p_coins || 0, s = stats();
      if (gift < 0 || gift > s.coins) throw new Error("not enough coins");
      const sentToday = db.messages.filter((m) => m.sender === ME && m.kind === "spot").length;
      s.coins -= gift;
      const got = [];
      if (gift > 0 && award(ME, "generous")) got.push("generous");
      db.messages.push({ id: ++nid, sender: ME, receiver: a.p_receiver, kind: "spot", body: a.p_body || "", spot: a.p_spot, coins: gift, created_at: new Date().toISOString() });
      const earned = sentToday < 3 ? 5 : 0; s.coins += earned;
      if (award(ME, "first_spot")) got.push("first_spot");
      if (db.messages.filter((m) => m.sender === ME && m.kind === "spot").length >= 10 && award(ME, "spots_10")) got.push("spots_10");
      const r = bump(ME, a.p_receiver); r.got.forEach((k) => got.push(k));
      save();
      // the sample friend sends a spot back (a real nearby place when we have one), which is what grows the streak
      const places = (typeof appState !== "undefined" && appState.places ? appState.places : []).filter((p) => p.name !== a.p_spot.name);
      const p = places[Math.floor(Math.random() * places.length)];
      friendSays(a.p_receiver, { kind: "spot", body: "Nice one! Here's one back 🔥", spot: p ? { kind: "place", name: p.name, category: p.typeLabel, lat: p.lat, lng: p.lng, osm: p.osmType + "/" + p.osmId } : { kind: "place", name: a.p_spot.name, category: a.p_spot.category || null, lat: a.p_spot.lat, lng: a.p_spot.lng } });
      return { earned, streak: r.count, grew: r.grew, badges: got };
    },
  };

  window.TrackMeDemo = {
    createClient() {
      const fire = (e) => authCbs.forEach((cb) => cb(e));
      return {
        auth: {
          getSession: () => Promise.resolve({ data: { session } }),
          onAuthStateChange: (cb) => { authCbs.push(cb); return { data: { subscription: {} } }; },
          signInWithPassword: () => { session = { user: { id: ME } }; localStorage.removeItem(SESSION); fire("SIGNED_IN"); return Promise.resolve({ data: { session }, error: null }); },
          signUp: () => Promise.resolve({ data: { session: null }, error: { message: "Demo mode: use Start demo" } }),
          signInWithOAuth: () => Promise.resolve({ error: { message: "Google sign-in needs your Supabase keys (js/config.js)" } }),
          signOut: () => { session = null; localStorage.setItem(SESSION, "out"); fire("SIGNED_OUT"); return Promise.resolve({}); },
        },
        from,
        channel: () => ({ on(e, f, cb) { rt = cb; return this; }, subscribe() { return this; } }),
        removeChannel() { rt = null; },
        rpc(name, args) {
          try { return Promise.resolve({ data: rpcs[name](args || {}), error: null }); }
          catch (e) { return Promise.resolve({ data: null, error: { message: e.message } }); }
        },
      };
    },
  };
})();
