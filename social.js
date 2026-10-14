// Track Me accounts and social: login (Google + email), profile and avatar creator,
// check-in streak, coins, badges, friends, chat, shared spots and pair streaks. Backend: Supabase.
(function () {
  const cfg = window.TRACKME_CONFIG || {};
  const sb = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const headerBtn = document.querySelector(".avatar-btn");
  const headerDefault = headerBtn ? headerBtn.innerHTML : "";
  if (!document.getElementById("profile-view")) return;

  // ===================== AVATAR CHARACTER (drawn as SVG layers) =====================
  const OPT = {
    faceShape: ["round", "oval", "square"],
    skin: ["#FBE0CC", "#F5CBA7", "#E8B48A", "#D39A6A", "#B97A50", "#8D5524", "#6B3F22", "#4A2A15"],
    eyes: ["dots", "happy", "wide", "sleepy", "wink", "lashes"],
    eyeColor: ["#4A2C17", "#2E6FCE", "#2E8B57", "#7B5EA7", "#555B66"],
    brows: ["none", "soft", "thick", "arched", "angry"],
    nose: ["small", "round", "pointed"],
    mouth: ["smile", "grin", "open", "smirk", "tongue", "neutral"],
    detail: ["none", "blush", "freckles"],
    hair: ["short", "long", "bob", "ponytail", "curly", "afro", "bun", "spiky", "mohawk", "bald"],
    hairColor: ["#1B1B1B", "#3B2417", "#6B4226", "#B5651D", "#E8C547", "#F2E3B3", "#D94F8A", "#4A6CF7", "#7B4DFF", "#C0C0C8"],
    beard: ["none", "stubble", "beard", "moustache"],
    glasses: ["none", "round", "square", "shades"],
    hat: ["none", "cap", "beanie", "headband"],
    earring: ["none", "stud", "hoop"],
    top: ["tee", "hoodie", "jacket", "turtleneck"],
    topColor: ["#FFFC00", "#0FADFF", "#FF5FA2", "#22BB86", "#7B4DFF", "#FF8A3D", "#111111", "#FFFFFF"],
    bg: ["#FFFC00", "#BDE8FF", "#FFD1E6", "#CFF5DF", "#E2D9FF", "#FFE1B8", "#C9CED8", "#1F2430"],
    pattern: ["solid", "stripes", "dots"],
  };
  const LABELS = { faceShape: "Face shape", skin: "Skin tone", eyes: "Eyes", eyeColor: "Eye colour", brows: "Eyebrows", nose: "Nose", mouth: "Mouth", detail: "Face details", hair: "Hairstyle", hairColor: "Hair colour", beard: "Facial hair", glasses: "Glasses", hat: "Headwear", earring: "Earrings", top: "Outfit", topColor: "Outfit colour", bg: "Background", pattern: "Pattern" };
  const TABS = { face: ["Face", ["faceShape", "skin", "eyes", "eyeColor", "brows", "nose", "mouth", "detail"]], hair: ["Hair", ["hair", "hairColor", "beard"]], style: ["Style", ["glasses", "hat", "earring"]], outfit: ["Outfit", ["top", "topColor"]], backdrop: ["Backdrop", ["bg", "pattern"]] };
  const DEFAULT_AVATAR = { faceShape: "round", skin: 2, eyes: "dots", eyeColor: 1, brows: "soft", nose: "small", mouth: "smile", detail: "none", hair: "short", hairColor: 1, beard: "none", glasses: "none", hat: "none", earring: "none", top: "hoodie", topColor: 0, bg: 1, pattern: "solid" };
  const isColour = (k) => OPT[k][0].startsWith("#");

  function pick(key, cfg) { // always returns a valid value, even if saved data is old or odd
    const v = cfg && cfg[key];
    if (isColour(key)) return OPT[key][Number.isInteger(v) && OPT[key][v] ? v : DEFAULT_AVATAR[key]];
    return OPT[key].includes(v) ? v : DEFAULT_AVATAR[key];
  }
  function shade(hex, p) { // lighten (p > 0) or darken (p < 0) a #RRGGBB colour
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + p))));
    return "#" + ((1 << 24) + (f(n >> 16) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1);
  }

  function avatarSvg(cfg, crop) {
    const c = {};
    Object.keys(OPT).forEach((k) => { c[k] = pick(k, cfg); });
    const ink = "#1B1B1B", sk = c.skin, skD = shade(sk, -0.2), hc = c.hairColor, hcL = shade(hc, 0.4), hcD = shade(hc, -0.3), tc = c.topColor, tcD = shade(tc, -0.22);
    const st = (w, col) => 'fill="none" stroke="' + (col || ink) + '" stroke-width="' + (w || 2.4) + '" stroke-linecap="round" stroke-linejoin="round"';
    let s = '<svg viewBox="' + (crop ? "14 2 92 92" : "0 0 120 120") + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar"><rect width="120" height="120" fill="' + c.bg + '"/>';
    if (c.pattern === "stripes") s += '<path d="M-10 40L40 -10M-10 90L90 -10M10 130L130 10M60 130L130 60" stroke="#fff" stroke-width="7" opacity=".3"/>';
    if (c.pattern === "dots") [[14, 14], [48, 8], [100, 16], [110, 60], [10, 70], [98, 106], [20, 108]].forEach((p) => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" fill="#fff" opacity=".35"/>'; });

    // hair behind the head
    if (c.hair === "afro") s += '<circle cx="60" cy="42" r="38" fill="' + hc + '"/>';
    if (c.hair === "long") s += '<path d="M31 52Q26 100 42 106H78Q94 100 89 52Q86 18 60 18Q34 18 31 52Z" fill="' + hc + '"/>';
    if (c.hair === "bob") s += '<path d="M31 52Q28 86 42 88H78Q92 86 89 52Q86 18 60 18Q34 18 31 52Z" fill="' + hc + '"/>';
    if (c.hair === "ponytail") s += '<path d="M84 40Q108 46 100 82Q92 68 86 60Z" fill="' + hc + '"/><circle cx="88" cy="44" r="3.5" fill="' + tc + '" stroke="' + ink + '" stroke-width="1.5"/>';

    // outfit and neck
    const body = "M16 120Q16 92 60 90Q104 92 104 120Z";
    if (c.top === "hoodie") s += '<path d="M28 98Q28 78 60 78Q92 78 92 98Z" fill="' + tcD + '" stroke="' + ink + '" stroke-width="2"/>';
    s += '<rect x="52" y="72" width="16" height="22" rx="6" fill="' + sk + '"/><rect x="52" y="72" width="16" height="9" fill="' + skD + '" opacity=".35"/>';
    s += '<path d="' + body + '" fill="' + tc + '" stroke="' + ink + '" stroke-width="2.2"/>';
    if (c.top === "tee") s += '<path d="M47 91Q60 104 73 91" fill="' + sk + '" stroke="' + ink + '" stroke-width="2"/>';
    if (c.top === "hoodie") s += '<path d="M46 91Q60 102 74 91" fill="' + sk + '" stroke="' + ink + '" stroke-width="2"/><path d="M52 98V112M68 98V112" ' + st(2.5, tcD) + '/>';
    if (c.top === "jacket") s += '<path d="M60 91L46 120H74Z" fill="#fff" stroke="' + ink + '" stroke-width="2"/><path d="M46 91L56 108L40 120M74 91L64 108L80 120" ' + st(2.2) + '/><path d="M60 100V120" ' + st(1.6, tcD) + '/>';
    if (c.top === "turtleneck") s += '<rect x="48" y="72" width="24" height="22" rx="9" fill="' + tc + '" stroke="' + ink + '" stroke-width="2.2"/><path d="M49 82H71" ' + st(1.6, tcD) + '/>';

    // ears, head, shading
    s += '<circle cx="34" cy="56" r="6.5" fill="' + sk + '" stroke="' + ink + '" stroke-width="2"/><circle cx="86" cy="56" r="6.5" fill="' + sk + '" stroke="' + ink + '" stroke-width="2"/>';
    const head = c.faceShape === "square" ? '<rect x="35" y="26" width="50" height="60" rx="20"' : c.faceShape === "oval" ? '<ellipse cx="60" cy="55" rx="23" ry="31"' : '<ellipse cx="60" cy="54" rx="26" ry="28"';
    s += head + ' fill="' + sk + '" stroke="' + ink + '" stroke-width="2.4"/>';
    s += '<ellipse cx="60" cy="74" rx="18" ry="9" fill="' + skD + '" opacity=".16"/>';
    if (c.earring === "stud") s += '<circle cx="34" cy="64" r="2.4" fill="#F5C518" stroke="' + ink + '" stroke-width="1.2"/>';
    if (c.earring === "hoop") s += '<circle cx="34" cy="68" r="4.5" ' + st(2, "#E0A800") + '/>';

    // face
    if (c.detail === "blush") s += '<ellipse cx="45" cy="64" rx="6" ry="3.6" fill="#FF6F91" opacity=".45"/><ellipse cx="75" cy="64" rx="6" ry="3.6" fill="#FF6F91" opacity=".45"/>';
    if (c.detail === "freckles") [[44, 62], [48, 65], [42, 66], [76, 62], [72, 65], [78, 66]].forEach((p) => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.1" fill="' + shade(sk, -0.45) + '"/>'; });
    if (c.beard === "stubble") s += '<path d="M36 62Q38 86 60 90Q82 86 84 62Q76 76 60 76Q44 76 36 62Z" fill="' + hc + '" opacity=".3"/>';
    if (c.beard === "beard") s += '<path d="M35 60Q35 92 60 94Q85 92 85 60Q78 76 60 76Q42 76 35 60Z" fill="' + hc + '" stroke="' + ink + '" stroke-width="1.5"/>';
    const bw = { soft: 2.6, thick: 4.2, arched: 2.6, angry: 3 }[c.brows];
    if (c.brows !== "none") {
      const paths = { soft: ["M41 45Q47 42 53 45", "M67 45Q73 42 79 45"], thick: ["M41 45Q47 43 53 45", "M67 45Q73 43 79 45"], arched: ["M41 46Q47 38 53 44", "M67 44Q73 38 79 46"], angry: ["M41 42L53 46", "M79 42L67 46"] }[c.brows];
      s += '<path d="' + paths[0] + '" ' + st(bw, hcD) + '/><path d="' + paths[1] + '" ' + st(bw, hcD) + "/>";
    }
    const eye = (x, kind) => {
      if (kind === "dots") return '<circle cx="' + x + '" cy="53" r="2.8" fill="' + ink + '"/>';
      if (kind === "happy") return '<path d="M' + (x - 5) + " 54Q" + x + " 47 " + (x + 5) + ' 54" ' + st(2.6) + "/>";
      if (kind === "sleepy") return '<path d="M' + (x - 5) + " 52Q" + x + " 57 " + (x + 5) + ' 52" ' + st(2.6) + "/>";
      let e = '<circle cx="' + x + '" cy="53" r="5.6" fill="#fff" stroke="' + ink + '" stroke-width="1.6"/><circle cx="' + x + '" cy="53.5" r="3.4" fill="' + c.eyeColor + '"/><circle cx="' + x + '" cy="53.5" r="1.6" fill="' + ink + '"/><circle cx="' + (x + 1.2) + '" cy="52" r=".9" fill="#fff"/>';
      if (kind === "lashes") e += '<path d="M' + (x - 5.5) + " 49L" + (x - 7.5) + " 46.5M" + x + " 47.5V44.5M" + (x + 5.5) + " 49L" + (x + 7.5) + ' 46.5" ' + st(1.6) + "/>";
      return e;
    };
    s += c.eyes === "wink" ? eye(47, "dots") + eye(73, "happy") : eye(47, c.eyes) + eye(73, c.eyes);
    if (c.nose === "small") s += '<path d="M60 59Q57.5 64 61 64.5" ' + st(1.8, skD) + "/>";
    if (c.nose === "round") s += '<circle cx="60" cy="62" r="2.8" fill="' + skD + '" opacity=".7"/>';
    if (c.nose === "pointed") s += '<path d="M60 57L56.5 65H62" ' + st(1.8, skD) + "/>";
    if (c.beard === "moustache") s += '<path d="M47 67Q54 62 60 66Q66 62 73 67Q66 72 60 69Q54 72 47 67Z" fill="' + hc + '" stroke="' + ink + '" stroke-width="1.2"/>';
    if (c.mouth === "smile") s += '<path d="M50 70Q60 79 70 70" ' + st(2.6) + "/>";
    if (c.mouth === "grin") s += '<path d="M48 69Q60 83 72 69Z" fill="#fff" stroke="' + ink + '" stroke-width="2.2" stroke-linejoin="round"/><path d="M50 74H70" ' + st(1.2) + "/>";
    if (c.mouth === "open") s += '<ellipse cx="60" cy="73" rx="6" ry="7" fill="#7A1F2B" stroke="' + ink + '" stroke-width="2.2"/><ellipse cx="60" cy="77" rx="3.4" ry="2.4" fill="#FF7A9A"/>';
    if (c.mouth === "smirk") s += '<path d="M51 72Q62 77 71 68" ' + st(2.6) + "/>";
    if (c.mouth === "tongue") s += '<path d="M55 75Q60 87 65 75Z" fill="#FF7A9A" stroke="' + ink + '" stroke-width="2"/><path d="M50 70Q60 79 70 70" ' + st(2.6) + "/>";
    if (c.mouth === "neutral") s += '<path d="M52 72H68" ' + st(2.6) + "/>";

    // hair in front
    const top = '<path d="M33 54Q28 20 60 20Q92 20 87 54Q80 35 60 35Q40 35 33 54Z" fill="' + hc + '"/>';
    if (["short", "long", "bob", "ponytail", "afro", "bun"].includes(c.hair)) s += top;
    if (c.hair === "bun") s += '<circle cx="60" cy="13" r="10" fill="' + hc + '"/><path d="M52 14Q60 9 68 14" ' + st(1.8, hcL) + "/>";
    if (c.hair === "curly") [[36, 38], [46, 27], [60, 23], [74, 27], [84, 38], [32, 52], [88, 52]].forEach((p) => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="' + hc + '"/>'; });
    if (c.hair === "spiky") s += '<path d="M33 52L36 26L46 38L52 14L62 34L74 14L78 36L90 24L87 52Q80 36 60 36Q40 36 33 52Z" fill="' + hc + '"/>';
    if (c.hair === "mohawk") s += '<path d="M33 52Q31 32 60 30Q89 32 87 52Q80 40 60 38Q40 40 33 52Z" fill="' + hc + '" opacity=".35"/><path d="M52 36Q54 4 60 4Q66 4 68 36Z" fill="' + hc + '"/>';
    if (!["bald", "mohawk"].includes(c.hair)) s += '<path d="M44 30Q56 24 72 28" ' + st(2.4, hcL) + ' opacity=".7"/>';

    // glasses and headwear
    if (c.glasses === "round") s += '<circle cx="47" cy="53" r="9" fill="#fff" fill-opacity=".22" ' + st(2.4).replace('fill="none" ', "") + '/><circle cx="73" cy="53" r="9" fill="#fff" fill-opacity=".22" ' + st(2.4).replace('fill="none" ', "") + '/><path d="M56 52Q60 49 64 52" ' + st(2.2) + "/>";
    if (c.glasses === "square") s += '<rect x="38" y="46" width="19" height="14" rx="3.5" fill="#fff" fill-opacity=".22" ' + st(2.4).replace('fill="none" ', "") + '/><rect x="63" y="46" width="19" height="14" rx="3.5" fill="#fff" fill-opacity=".22" ' + st(2.4).replace('fill="none" ', "") + '/><path d="M57 52H63" ' + st(2.2) + "/>";
    if (c.glasses === "shades") s += '<rect x="37" y="46" width="21" height="14" rx="5" fill="' + ink + '"/><rect x="62" y="46" width="21" height="14" rx="5" fill="' + ink + '"/><path d="M58 51H62" ' + st(2.2) + '/><path d="M41 49L46 49M66 49L71 49" ' + st(1.6, "#8A8F9C") + "/>";
    if (c.hat === "cap") s += '<path d="M33 44Q32 12 60 12Q88 12 87 44Q60 37 33 44Z" fill="' + tc + '" stroke="' + ink + '" stroke-width="2.2"/><path d="M56 41H100Q100 49 90 49H56Z" fill="' + tcD + '" stroke="' + ink + '" stroke-width="2.2"/>';
    if (c.hat === "beanie") s += '<path d="M32 44Q31 10 60 10Q89 10 88 44Z" fill="' + tc + '" stroke="' + ink + '" stroke-width="2.2"/><rect x="30" y="36" width="60" height="11" rx="5.5" fill="' + tcD + '" stroke="' + ink + '" stroke-width="2.2"/><circle cx="60" cy="8" r="5.5" fill="' + tcD + '" stroke="' + ink + '" stroke-width="2"/>';
    if (c.hat === "headband") s += '<path d="M33 42Q60 28 87 42" ' + st(6.5, tc) + '/><path d="M33 42Q60 28 87 42" ' + st(1.6) + ' opacity=".6"/>';
    return s + "</svg>";
  }

  // ===================== STATE AND HELPERS =====================
  let user = null, profile = null, stats = null, badges = [], draft = null, mode = "signin", tab = "face";
  let friends = [], incoming = [], outgoing = [], thread = [], chatWith = null, activity = [], channel = null;
  let sheet = { open: false, pick: null }, current = null;
  const unread = {};
  const BADGES = {
    first_checkin: ["🔥", "First check-in"], daily_7: ["🏅", "7-day check-in"], daily_30: ["🏆", "30-day check-in"],
    first_spot: ["📍", "First spot sent"], spots_10: ["🗺️", "10 spots sent"], generous: ["🎁", "Coin gifter"],
    streak_3: ["⚡", "3-day pair streak"], streak_7: ["🌟", "7-day pair streak"], streak_30: ["👑", "30-day pair streak"],
  };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const isoDay = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); // UTC day, same as the database
  const panel = (html, cls) => '<div class="panel ' + (cls || "") + '">' + html + "</div>";
  const nameOf = (p) => (p && (p.display_name || p.username)) || "Friend";
  const mini = (p, size) => '<span class="mini-avatar" style="width:' + (size || 46) + "px;height:" + (size || 46) + 'px">' + avatarSvg(p && p.avatar, true) + "</span>";
  const timeAgo = (iso) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + "m ago"; if (m < 1440) return Math.floor(m / 60) + "h ago";
    return Math.floor(m / 1440) + "d ago";
  };
  const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }
  const pairStreak = (s) => (s && s.last_day && s.last_day >= isoDay(-1) ? s.count : 0); // a missed day resets it

  // ===================== VIEWS =====================
  const NAMES = ["profile", "friends", "chat", "activity"];
  const TITLES = { friends: "Friends & streaks", chat: "Chat", activity: "Activity" };
  Object.keys(TITLES).forEach((n) => {
    const s = document.createElement("section");
    s.className = "view"; s.id = n + "-view"; s.hidden = true; s.setAttribute("aria-label", TITLES[n]);
    s.innerHTML = '<div class="view__inner"><div class="map-view__bar"><button class="btn btn--sm" data-back type="button"><svg class="icon icon--sm" width="16" height="16" style="transform:scaleX(-1)"><use href="#i-arrow"/></svg> Back</button><span class="map-view__title" id="' + n + '-title">' + TITLES[n] + '</span></div><div class="view__body" id="' + n + '-body"></div></div>';
    document.body.insertBefore(s, document.querySelector(".bottom-nav"));
  });
  const bodyOf = (n) => document.getElementById(n + "-body");

  function showView(name) {
    if (typeof mapView !== "undefined" && mapView && !mapView.hidden) closeMapView(true);
    NAMES.forEach((n) => { document.getElementById(n + "-view").hidden = n !== name; });
    document.body.classList.add("map-open"); // reuses the "lock page scroll" rule
    setNavActive(name === "chat" ? "friends" : name);
    current = name;
  }
  window.closeSocialViews = function (keepNav) {
    NAMES.forEach((n) => { document.getElementById(n + "-view").hidden = true; });
    current = null;
    if (typeof mapView === "undefined" || !mapView || mapView.hidden) document.body.classList.remove("map-open");
    if (!keepNav) setNavActive("home");
  };
  window.handleNav = (name) => { if (["profile", "friends", "activity"].includes(name)) openView(name); else window.closeSocialViews(true); };

  async function openView(name) {
    showView(name);
    if (name === "profile") return renderProfile();
    if (!sb || !user) return renderGate(name);
    bodyOf(name).innerHTML = panel("<p>Loading...</p>");
    if (name === "friends") { await loadFriends(); if (current === "friends") renderFriends(); }
    if (name === "activity") { await loadFriends(); await loadActivity(); if (current === "activity") renderActivity(); }
  }
  const rerender = () => { if (current === "profile") renderProfile(); if (current === "friends") renderFriends(); if (current === "chat") renderChat(); if (current === "activity") renderActivity(); };

  // ===================== DATA =====================
  async function loadAccount() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const newUser = data.session ? data.session.user : null;
    if (!newUser || !user || newUser.id !== user.id) { friends = incoming = outgoing = thread = activity = []; chatWith = null; }
    user = newUser; profile = stats = null; badges = [];
    if (user) {
      const [p, s, b] = await Promise.all([
        sb.from("profiles").select("username,display_name,avatar").eq("id", user.id).single(),
        sb.from("player_stats").select("coins,streak,last_checkin").eq("user_id", user.id).single(),
        sb.from("user_badges").select("badge").eq("user_id", user.id),
      ]);
      profile = p.data; stats = s.data; badges = (b.data || []).map((r) => r.badge);
      draft = Object.assign({}, DEFAULT_AVATAR, profile && profile.avatar);
      listen();
    } else if (channel) { sb.removeChannel(channel); channel = null; }
    paintHeader();
    if (current) { if (!user && current !== "profile") renderGate(current); else rerender(); }
  }
  async function refreshStats() {
    if (!user) return;
    const [s, b] = await Promise.all([sb.from("player_stats").select("coins,streak,last_checkin").eq("user_id", user.id).single(), sb.from("user_badges").select("badge").eq("user_id", user.id)]);
    if (s.data) stats = s.data;
    badges = (b.data || []).map((r) => r.badge);
  }
  async function loadFriends() {
    const { data: rows } = await sb.from("friendships").select("id,requester,addressee,status");
    const list = rows || [];
    const ids = list.map((r) => (r.requester === user.id ? r.addressee : r.requester));
    const profs = ids.length ? (await sb.from("profiles").select("id,username,display_name,avatar").in("id", ids)).data || [] : [];
    const streaks = (await sb.from("streaks").select("user_a,user_b,count,last_day,a_day,b_day")).data || [];
    const byId = {}; profs.forEach((p) => { byId[p.id] = p; });
    friends = []; incoming = []; outgoing = [];
    list.forEach((r) => {
      const otherId = r.requester === user.id ? r.addressee : r.requester;
      const p = byId[otherId]; if (!p) return;
      if (r.status === "accepted") {
        const s = streaks.find((x) => x.user_a === otherId || x.user_b === otherId);
        const meA = s && user.id === s.user_a;
        friends.push({ id: otherId, profile: p, row: r.id, streak: pairStreak(s), mine: s ? (meA ? s.a_day : s.b_day) === isoDay(0) : false, theirs: s ? (meA ? s.b_day : s.a_day) === isoDay(0) : false });
      } else if (r.addressee === user.id) incoming.push({ row: r.id, profile: p });
      else outgoing.push({ row: r.id, profile: p });
    });
  }
  async function loadThread() {
    const me = user.id, other = chatWith.id;
    const { data } = await sb.from("messages").select("id,sender,receiver,kind,body,spot,coins,created_at")
      .or("and(sender.eq." + me + ",receiver.eq." + other + "),and(sender.eq." + other + ",receiver.eq." + me + ")")
      .order("created_at", { ascending: true }).limit(200);
    thread = data || [];
  }
  async function loadActivity() {
    const { data } = await sb.from("messages").select("id,sender,receiver,kind,body,spot,coins,created_at").eq("kind", "spot").order("created_at", { ascending: false }).limit(30);
    activity = data || [];
  }
  function listen() { // live chat: new messages sent to me arrive here
    if (channel) return;
    channel = sb.channel("track-me-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "receiver=eq." + user.id }, (p) => onIncoming(p.new))
      .subscribe();
  }
  async function onIncoming(m) {
    if (current === "chat" && chatWith && m.sender === chatWith.id) { thread.push(m); renderChat(); }
    else { unread[m.sender] = (unread[m.sender] || 0) + 1; toast("New " + (m.kind === "spot" ? "spot" : "message") + " from a friend"); }
    await refreshStats(); await loadFriends(); rerender();
  }
  function paintHeader() {
    if (!headerBtn) return;
    headerBtn.innerHTML = profile ? avatarSvg(profile.avatar) : headerDefault;
    headerBtn.classList.toggle("has-avatar", !!profile);
  }

  // ===================== SCREENS =====================
  function authHtml() {
    if (!sb) return panel("<h2>Accounts need a quick setup</h2><p>Add your Supabase project URL and anon key to <code>js/config.js</code>, run <code>supabase/schema.sql</code> in the Supabase SQL editor, and turn on Google under Authentication &rarr; Providers. Then reload this page.</p>");
    const up = mode === "signup";
    return panel("<h2>" + (up ? "Create your account" : "Welcome back") + "</h2>" +
      '<button class="btn btn--white" data-act="google" type="button">Continue with Google</button><p class="auth__or">or use email</p>' +
      '<input class="field" id="auth-email" type="email" autocomplete="email" placeholder="Email">' +
      '<input class="field" id="auth-pass" type="password" autocomplete="' + (up ? "new-password" : "current-password") + '" placeholder="Password (at least 6 characters)">' +
      '<button class="btn" data-act="submit" type="button">' + (up ? "Create account" : "Sign in") + '</button><p class="form-msg" id="auth-msg" role="status"></p>' +
      '<button class="link-btn" data-act="toggle" type="button">' + (up ? "Already have an account? Sign in" : "New here? Create an account") + "</button>", "auth");
  }
  function renderGate(name) { bodyOf(name).innerHTML = panel("<h2>Sign in to use this</h2><p>Friends, chat and streaks need an account.</p>") + authHtml(); }

  function creatorHtml() {
    const tabs = Object.keys(TABS).map((k) => '<button class="chip opt' + (k === tab ? " is-active" : "") + '" data-act="tab" data-tab="' + k + '" type="button">' + TABS[k][0] + "</button>").join("");
    const groups = TABS[tab][1].map((key) => {
      const items = OPT[key].map((val, i) => {
        const value = isColour(key) ? i : val;
        const on = String(draft[key]) === String(value) ? " is-on" : "";
        const attrs = ' data-act="opt" data-key="' + key + '" data-val="' + value + '" type="button" aria-label="' + LABELS[key] + ": " + val + '"';
        return isColour(key) ? '<button class="swatch' + on + '" style="--c:' + val + '"' + attrs + "></button>"
          : '<button class="thumb' + on + '"' + attrs + ">" + avatarSvg(Object.assign({}, draft, { [key]: value }), true) + "<span>" + val + "</span></button>";
      }).join("");
      return '<div class="opt-group"><span class="opt-label">' + LABELS[key] + '</span><div class="opt-row">' + items + "</div></div>";
    }).join("");
    return '<div class="tabs">' + tabs + "</div>" + groups;
  }

  function renderProfile() {
    const el = bodyOf("profile");
    if (!user) { el.innerHTML = authHtml(); return; }
    if (!profile || !stats) { el.innerHTML = panel("<h2>We couldn't load your profile</h2><p>Make sure you ran <code>supabase/schema.sql</code> in your Supabase project, then try signing in again.</p>") + '<button class="btn btn--white" data-act="signout" type="button">Sign out</button>'; return; }
    const streak = stats.last_checkin && stats.last_checkin >= isoDay(-1) ? stats.streak : 0;
    const done = stats.last_checkin === isoDay(0);
    const tiles = Object.keys(BADGES).map((k) => '<div class="badge-tile' + (badges.includes(k) ? "" : " is-locked") + '"><span>' + BADGES[k][0] + "</span><b>" + BADGES[k][1] + "</b></div>").join("");
    el.innerHTML =
      panel('<div class="avatar-big" id="avatar-preview">' + avatarSvg(draft) + '</div><div><h2 id="who-name"></h2><p class="muted" id="who-user"></p></div>', "profile-head") +
      '<div class="stats"><div class="panel stat"><span class="stat__big">🔥 <b>' + streak + '</b></span><span>day check-in streak</span><button class="btn btn--sm" data-act="checkin" type="button"' + (done ? " disabled" : "") + ">" + (done ? "Checked in today ✓" : "Check in (+2 coins)") + "</button></div>" +
      '<div class="panel stat"><span class="stat__big">🪙 <b>' + stats.coins + "</b></span><span>coins</span></div></div>" +
      panel('<h3>Your character</h3><div class="creator-actions"><button class="btn btn--sm btn--white" data-act="random" type="button">🎲 Randomise</button><button class="btn btn--sm btn--white" data-act="reset" type="button">Reset</button></div><div id="creator">' + creatorHtml() + "</div>") +
      panel('<h3>Profile</h3><label class="opt-label" for="f-name">Display name</label><input class="field" id="f-name" maxlength="30"><label class="opt-label" for="f-user">Username</label><input class="field" id="f-user" maxlength="20" autocapitalize="none"><button class="btn" data-act="save" type="button">Save profile</button><p class="form-msg" id="save-msg" role="status"></p>') +
      panel('<h3>Badges</h3><div class="badges">' + tiles + "</div>") +
      '<button class="btn btn--white" data-act="signout" type="button">Sign out</button>';
    el.querySelector("#who-name").textContent = profile.display_name || "Explorer";
    el.querySelector("#who-user").textContent = "@" + profile.username;
    el.querySelector("#f-name").value = profile.display_name || "";
    el.querySelector("#f-user").value = profile.username;
  }

  function renderFriends() {
    const streak = stats && stats.last_checkin && stats.last_checkin >= isoDay(-1) ? stats.streak : 0;
    const done = stats && stats.last_checkin === isoDay(0);
    const cards = friends.length ? '<div class="friend-grid">' + friends.map((f) =>
      '<button class="friend-card" data-act="chat" data-id="' + f.id + '" type="button">' + mini(f.profile, 56) + (unread[f.id] ? '<span class="dot">' + unread[f.id] + "</span>" : "") +
      '<b class="friend-card__name">' + esc(nameOf(f.profile)) + '</b><span class="friend-card__streak">🔥 ' + f.streak + "</span></button>").join("") + "</div>"
      : "<p>No friends yet. Add someone by their username below.</p>";
    const reqs = incoming.length ? panel("<h3>Friend requests</h3>" + incoming.map((r) =>
      '<div class="row">' + mini(r.profile) + '<span class="row__main"><b>' + esc(nameOf(r.profile)) + '</b><small>@' + esc(r.profile.username) + '</small></span><button class="btn btn--sm" data-act="accept" data-row="' + r.row + '" type="button">Accept</button><button class="btn btn--sm btn--white" data-act="decline" data-row="' + r.row + '" type="button">Decline</button></div>').join("")) : "";
    const sent = outgoing.length ? panel("<h3>Waiting for a reply</h3>" + outgoing.map((r) =>
      '<div class="row">' + mini(r.profile) + '<span class="row__main"><b>' + esc(nameOf(r.profile)) + '</b><small>@' + esc(r.profile.username) + '</small></span><button class="btn btn--sm btn--white" data-act="cancel" data-row="' + r.row + '" type="button">Cancel</button></div>').join("")) : "";
    bodyOf("friends").innerHTML =
      '<div class="panel streak-card"><span class="streak-card__fire">🔥</span><div><b class="streak-card__n">' + streak + ' day streak</b><small>Check in daily to keep it going</small></div><button class="btn btn--sm btn--white" data-act="checkin" type="button"' + (done ? " disabled" : "") + ">" + (done ? "Done ✓" : "Check in") + "</button></div>" +
      reqs + panel("<h3>Close friends</h3>" + cards) +
      panel('<h3>Add a friend</h3><div class="inline"><input class="field" id="f-add" placeholder="Their username" autocapitalize="none" maxlength="20"><button class="btn btn--sm" data-act="add" type="button">Add</button></div><p class="form-msg" id="add-msg" role="status"></p>') + sent;
  }

  const spotLink = (s) => "https://www.openstreetmap.org/?mlat=" + Number(s.lat).toFixed(5) + "&mlon=" + Number(s.lng).toFixed(5) + "#map=17/" + Number(s.lat).toFixed(5) + "/" + Number(s.lng).toFixed(5);
  function bubble(m) {
    const mine = m.sender === user.id;
    let inner;
    if (m.kind === "spot" && m.spot) {
      inner = '<span class="bubble__spot">📍 <b>' + esc(m.spot.name || "A spot") + "</b></span>" +
        (m.spot.category || m.spot.label ? "<small>" + esc(m.spot.category || m.spot.label) + "</small>" : "") +
        (m.body ? "<span>" + esc(m.body) + "</span>" : "") +
        (m.coins ? '<span class="bubble__coins">🪙 ' + (mine ? "You sent " : "") + Number(m.coins) + " coins</span>" : "") +
        '<a class="bubble__link" href="' + spotLink(m.spot) + '" target="_blank" rel="noopener noreferrer">Open on the map</a>';
    } else inner = "<span>" + esc(m.body) + "</span>";
    return '<div class="msg ' + (mine ? "msg--me" : "msg--them") + '"><div class="bubble' + (m.kind === "spot" ? " bubble--spot" : "") + '">' + inner + "</div><time>" + clock(m.created_at) + "</time></div>";
  }

  function shareChoices() {
    const list = [];
    const loc = appState.location;
    if (loc) list.push({ kind: "me", title: "📍 My current location", sub: "Shared to about 100 m accuracy" + (loc.label ? " · " + loc.label : ""), spot: { kind: "me", name: "My location", label: loc.label || null, lat: +loc.lat.toFixed(3), lng: +loc.lng.toFixed(3) } });
    (appState.places || []).slice(0, 15).forEach((p) => list.push({ kind: "place", title: p.name, sub: p.typeLabel + " · " + formatDistance(p.distance), spot: { kind: "place", name: p.name, category: p.typeLabel, lat: p.lat, lng: p.lng, osm: p.osmType + "/" + p.osmId } }));
    return list;
  }

  function renderChat() {
    if (!chatWith) return;
    const f = friends.find((x) => x.id === chatWith.id) || chatWith;
    const status = f.mine && f.theirs ? "Streak is safe for today ✓" : f.mine ? "You sent a spot today. Waiting for " + esc(nameOf(f.profile)) : f.theirs ? esc(nameOf(f.profile)) + " sent one. Send yours to grow the streak!" : "Both send a spot today to grow the streak";
    document.getElementById("chat-title").textContent = nameOf(f.profile);
    let sheetHtml = "";
    if (sheet.open) {
      const choices = shareChoices();
      sheetHtml = '<div class="panel sheet"><h3>Share a spot</h3>' + (choices.length ? '<div class="choices">' + choices.map((c, i) =>
        '<button class="choice' + (sheet.pick === i ? " is-on" : "") + '" data-act="pick" data-i="' + i + '" type="button"><b>' + esc(c.title) + "</b><small>" + esc(c.sub) + "</small></button>").join("") + "</div>" +
        '<input class="field" id="spot-note" maxlength="200" placeholder="Add a note (optional)">' +
        '<label class="opt-label" for="spot-coins">Send coins with it (you have ' + (stats ? stats.coins : 0) + ')</label><input class="field" id="spot-coins" type="number" min="0" max="' + (stats ? stats.coins : 0) + '" value="0">' +
        '<button class="btn" data-act="sendspot" type="button">Send spot</button>'
        : "<p>Use Find My Location on the home page first, then you can share where you are or a place near you.</p>") +
        '<p class="form-msg" id="spot-msg" role="status"></p></div>';
    }
    bodyOf("chat").innerHTML =
      '<div class="panel chat-head">' + mini(f.profile, 52) + '<div class="row__main"><b>' + esc(nameOf(f.profile)) + '</b><small>@' + esc(f.profile.username) + ' · 🔥 ' + (f.streak || 0) + '</small><small class="chat-head__status">' + status + '</small></div><button class="link-btn" data-act="unfriend" type="button">Remove</button></div>' +
      '<div class="thread" id="thread">' + (thread.length ? thread.map(bubble).join("") : '<p class="thread__empty">No messages yet. Say hi, or share a spot to start a streak!</p>') + "</div>" +
      sheetHtml +
      '<div class="composer"><button class="btn btn--sm btn--white" data-act="sheet" type="button">📍 Share a spot</button><input class="field" id="msg-input" maxlength="500" placeholder="Message..." autocomplete="off"><button class="btn btn--sm" data-act="send" type="button">Send</button></div>';
    const t = document.getElementById("thread"); t.scrollTop = t.scrollHeight;
  }

  function renderActivity() {
    const byId = {}; friends.forEach((f) => { byId[f.id] = f; });
    const items = activity.map((m) => {
      const mine = m.sender === user.id, f = byId[mine ? m.receiver : m.sender];
      if (!f) return "";
      return '<button class="row row--btn" data-act="chat" data-id="' + f.id + '" type="button">' + mini(f.profile) + '<span class="row__main"><b>' + (mine ? "You shared " : esc(nameOf(f.profile)) + " shared ") + esc((m.spot && m.spot.name) || "a spot") + "</b><small>" + (mine ? "with " + esc(nameOf(f.profile)) : "with you") + " · " + timeAgo(m.created_at) + (m.coins ? " · 🪙 " + Number(m.coins) : "") + "</small></span></button>";
    }).join("");
    bodyOf("activity").innerHTML = panel("<h3>Recent spots</h3>" + (items || "<p>No spots yet. Share one with a friend to start a streak.</p>")) +
      panel('<h3>Your badges</h3><div class="badges">' + Object.keys(BADGES).map((k) => '<div class="badge-tile' + (badges.includes(k) ? "" : " is-locked") + '"><span>' + BADGES[k][0] + "</span><b>" + BADGES[k][1] + "</b></div>").join("") + "</div>");
  }

  // ===================== ACTIONS =====================
  const say = (id, text, ok, root) => { const el = (root || document).querySelector("#" + id); if (el) { el.textContent = text; el.classList.toggle("is-ok", !!ok); } };

  async function doCheckIn(btn) {
    btn.disabled = true;
    const { data, error } = await sb.rpc("check_in");
    if (error) { btn.disabled = false; return toast("Check-in didn't work. Please try again."); }
    stats = Object.assign({}, stats, { coins: data.coins, streak: data.streak, last_checkin: isoDay(0) });
    (data.badges || []).forEach((b) => { if (!badges.includes(b)) badges.push(b); });
    toast(data.already ? "Already checked in today" : "Checked in! +2 coins" + (data.badges && data.badges.length ? " and a new badge 🎉" : ""));
    rerender();
  }

  async function openChat(id) {
    const f = friends.find((x) => x.id === id); if (!f) return;
    chatWith = f; unread[id] = 0; sheet = { open: false, pick: null };
    showView("chat"); bodyOf("chat").innerHTML = panel("<p>Loading...</p>");
    await loadThread(); renderChat();
  }

  async function sendText() {
    const input = document.getElementById("msg-input"); const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    const { data, error } = await sb.from("messages").insert({ sender: user.id, receiver: chatWith.id, kind: "text", body: text }).select().single();
    if (error) { input.disabled = false; return toast("Message not sent. Are you still friends?"); }
    thread.push(data); renderChat(); document.getElementById("msg-input").focus();
  }

  async function sendSpot(btn) {
    const choices = shareChoices(); const choice = choices[sheet.pick];
    if (!choice) return say("spot-msg", "Pick a spot to share first.");
    const note = document.getElementById("spot-note").value.trim();
    const coins = Math.floor(Number(document.getElementById("spot-coins").value) || 0);
    if (coins < 0 || coins > (stats ? stats.coins : 0)) return say("spot-msg", "You don't have that many coins.");
    btn.disabled = true;
    const { data, error } = await sb.rpc("send_spot", { p_receiver: chatWith.id, p_body: note, p_spot: choice.spot, p_coins: coins });
    if (error) { btn.disabled = false; return say("spot-msg", /enough coins/.test(error.message) ? "You don't have that many coins." : "We couldn't send that spot. Please try again."); }
    sheet = { open: false, pick: null };
    await Promise.all([refreshStats(), loadThread(), loadFriends()]);
    chatWith = friends.find((x) => x.id === chatWith.id) || chatWith;
    renderChat();
    toast("Spot sent! " + (data.earned ? "+" + data.earned + " coins. " : "") + (data.grew ? "Streak grew to " + data.streak + " 🔥 (+10 coins)" : "") + (data.badges && data.badges.length ? " New badge 🎉" : ""));
  }

  async function onClick(e) {
    const back = e.target.closest("[data-back]");
    if (back) { if (current === "chat") { openView("friends"); } else window.closeSocialViews(); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn || !sb) return;
    const act = btn.dataset.act, root = btn.closest(".view");
    if (act === "toggle") { mode = mode === "signin" ? "signup" : "signin"; if (current === "profile") renderProfile(); else renderGate(current); }
    if (act === "google") {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
      if (error) say("auth-msg", "Google sign-in didn't start: " + error.message + (location.protocol === "file:" ? " (Open the site through a local server, not as a file.)" : ""), false, root);
    }
    if (act === "submit") {
      const email = root.querySelector("#auth-email").value.trim(), password = root.querySelector("#auth-pass").value;
      if (!email || password.length < 6) return say("auth-msg", "Enter your email and a password of at least 6 characters.", false, root);
      btn.disabled = true;
      const res = mode === "signup"
        ? await sb.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0] }, emailRedirectTo: window.location.origin + window.location.pathname } })
        : await sb.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (res.error) say("auth-msg", res.error.message, false, root);
      else if (mode === "signup" && !res.data.session) say("auth-msg", "Check your email to confirm your account, then sign in.", true, root);
    }
    if (act === "signout") { await sb.auth.signOut(); }
    if (act === "tab") { tab = btn.dataset.tab; root.querySelector("#creator").innerHTML = creatorHtml(); }
    if (act === "opt") {
      const key = btn.dataset.key; draft[key] = isColour(key) ? Number(btn.dataset.val) : btn.dataset.val;
      const prev = root.querySelector("#avatar-preview"); prev.innerHTML = avatarSvg(draft);
      prev.classList.remove("pop"); void prev.offsetWidth; prev.classList.add("pop");
      root.querySelector("#creator").innerHTML = creatorHtml();
    }
    if (act === "random") {
      Object.keys(OPT).forEach((k) => { const v = Math.floor(Math.random() * OPT[k].length); draft[k] = isColour(k) ? v : OPT[k][v]; });
      root.querySelector("#avatar-preview").innerHTML = avatarSvg(draft); root.querySelector("#creator").innerHTML = creatorHtml();
    }
    if (act === "reset") { draft = Object.assign({}, DEFAULT_AVATAR); root.querySelector("#avatar-preview").innerHTML = avatarSvg(draft); root.querySelector("#creator").innerHTML = creatorHtml(); }
    if (act === "checkin") doCheckIn(btn);
    if (act === "save") {
      const name = root.querySelector("#f-name").value.trim().slice(0, 30), username = root.querySelector("#f-user").value.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(username)) return say("save-msg", "Usernames use 3-20 letters, numbers or underscores.", false, root);
      btn.disabled = true;
      const { error } = await sb.from("profiles").update({ display_name: name, username, avatar: draft }).eq("id", user.id);
      btn.disabled = false;
      if (error) return say("save-msg", error.code === "23505" ? "That username is taken. Try another." : "We couldn't save that. Please try again.", false, root);
      profile = Object.assign({}, profile, { display_name: name, username, avatar: Object.assign({}, draft) });
      paintHeader(); root.querySelector("#who-name").textContent = name || "Explorer"; root.querySelector("#who-user").textContent = "@" + username;
      say("save-msg", "Saved!", true, root);
    }
    if (act === "add") {
      const uname = root.querySelector("#f-add").value.trim().toLowerCase().replace(/^@/, "");
      if (!uname) return say("add-msg", "Type a username first.", false, root);
      const { data: who } = await sb.from("profiles").select("id").eq("username", uname).maybeSingle();
      if (!who) return say("add-msg", "We couldn't find anyone with that username.", false, root);
      if (who.id === user.id) return say("add-msg", "That's you!", false, root);
      const { error } = await sb.from("friendships").insert({ requester: user.id, addressee: who.id });
      if (error) return say("add-msg", error.code === "23505" ? "You already have a request or friendship with them." : "We couldn't send that request.", false, root);
      await loadFriends(); renderFriends(); say("add-msg", "Request sent!", true, bodyOf("friends"));
    }
    if (act === "accept" || act === "decline") { await sb.rpc("respond_friend", { p_id: Number(btn.dataset.row), p_accept: act === "accept" }); await loadFriends(); renderFriends(); }
    if (act === "cancel") { await sb.from("friendships").delete().eq("id", Number(btn.dataset.row)); await loadFriends(); renderFriends(); }
    if (act === "chat") openChat(btn.dataset.id);
    if (act === "unfriend" && chatWith && window.confirm("Remove " + nameOf(chatWith.profile) + " from your friends?")) {
      await sb.from("friendships").delete().eq("id", chatWith.row); chatWith = null; await loadFriends(); openView("friends");
    }
    if (act === "sheet") { sheet.open = !sheet.open; renderChat(); }
    if (act === "pick") { sheet.pick = Number(btn.dataset.i); root.querySelectorAll(".choice").forEach((c, i) => c.classList.toggle("is-on", i === sheet.pick)); }
    if (act === "sendspot") sendSpot(btn);
    if (act === "send") sendText();
  }
  document.addEventListener("click", (e) => { if (e.target.closest(".view")) onClick(e); }); // one listener for all social views
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "msg-input") sendText();
    if (e.key === "Escape" && current) window.closeSocialViews();
  });
  if (headerBtn) headerBtn.addEventListener("click", () => openView("profile"));

  if (sb) {
    sb.auth.onAuthStateChange(() => setTimeout(loadAccount, 0)); // setTimeout avoids a known deadlock inside this callback
    loadAccount();
  }
})();
