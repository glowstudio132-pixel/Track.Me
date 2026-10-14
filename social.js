// Track Me accounts: login (Google + email) with Supabase, profile, avatar character,
// daily check-in streak, coins and badges. Friends and chat come in a later step.
(function () {
  const cfg = window.TRACKME_CONFIG || {};
  const sb = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const view = document.getElementById("profile-view");
  const body = document.getElementById("profile-body");
  const headerBtn = document.querySelector(".avatar-btn");
  if (!view || !body) return;
  const headerDefault = headerBtn ? headerBtn.innerHTML : "";

  // ---------- Avatar character (drawn as SVG from a small settings object) ----------
  const OPT = {
    skin: ["#F7D6B8", "#E8B48A", "#C68642", "#8D5524", "#5C3A21"],
    hair: ["short", "long", "curly", "bun", "bald"],
    hairColor: ["#1B1B1B", "#5A3825", "#B5651D", "#E8C547", "#D94F8A", "#4A6CF7"],
    eyes: ["dots", "happy", "wide"],
    mouth: ["smile", "grin", "open"],
    extra: ["none", "glasses", "cap"],
    top: ["#FFFC00", "#0FADFF", "#FF5FA2", "#22BB86", "#7B4DFF", "#111111"],
    bg: ["#FFFC00", "#BDE8FF", "#FFD1E6", "#CFF5DF", "#E2D9FF"],
  };
  const LABELS = { skin: "Skin", hair: "Hair", hairColor: "Hair colour", eyes: "Eyes", mouth: "Mouth", extra: "Extras", top: "Outfit", bg: "Background" };
  const DEFAULT_AVATAR = { skin: 1, hair: "short", hairColor: 1, eyes: "dots", mouth: "smile", extra: "none", top: 0, bg: 1 };
  const isColour = (key) => OPT[key][0].startsWith("#");

  function pick(key, cfg) { // always returns a valid value, even if saved data is odd
    const v = cfg && cfg[key];
    if (isColour(key)) return OPT[key][Number.isInteger(v) && OPT[key][v] ? v : DEFAULT_AVATAR[key]];
    return OPT[key].includes(v) ? v : DEFAULT_AVATAR[key];
  }

  function avatarSvg(cfg) {
    const c = {};
    Object.keys(OPT).forEach((k) => { c[k] = pick(k, cfg); });
    const ink = "#1B1B1B";
    let s = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar"><rect width="100" height="100" fill="' + c.bg + '"/>';
    if (c.hair === "long") s += '<ellipse cx="50" cy="52" rx="27" ry="34" fill="' + c.hairColor + '"/>';
    s += '<path d="M16 100Q16 76 50 74Q84 76 84 100Z" fill="' + c.top + '" stroke="' + ink + '" stroke-width="2"/>';
    s += '<rect x="43" y="62" width="14" height="14" rx="5" fill="' + c.skin + '"/>';
    s += '<circle cx="28" cy="48" r="5" fill="' + c.skin + '"/><circle cx="72" cy="48" r="5" fill="' + c.skin + '"/>';
    s += '<ellipse cx="50" cy="46" rx="22" ry="25" fill="' + c.skin + '" stroke="' + ink + '" stroke-width="2"/>';
    if (["short", "long", "bun"].includes(c.hair)) s += '<path d="M27 44Q26 20 50 20Q74 20 73 44Q64 32 50 32Q36 32 27 44Z" fill="' + c.hairColor + '"/>';
    if (c.hair === "bun") s += '<circle cx="50" cy="16" r="9" fill="' + c.hairColor + '"/>';
    if (c.hair === "curly") [[32, 30], [42, 24], [54, 23], [65, 28], [72, 38], [28, 40]].forEach((p) => { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="' + c.hairColor + '"/>'; });
    if (c.eyes === "dots") s += '<circle cx="41" cy="46" r="2.6" fill="' + ink + '"/><circle cx="59" cy="46" r="2.6" fill="' + ink + '"/>';
    if (c.eyes === "happy") s += '<path d="M37 47Q41 41 45 47M55 47Q59 41 63 47" fill="none" stroke="' + ink + '" stroke-width="2.5" stroke-linecap="round"/>';
    if (c.eyes === "wide") s += '<circle cx="41" cy="46" r="4.5" fill="#fff" stroke="' + ink + '" stroke-width="1.5"/><circle cx="59" cy="46" r="4.5" fill="#fff" stroke="' + ink + '" stroke-width="1.5"/><circle cx="42" cy="46" r="2" fill="' + ink + '"/><circle cx="60" cy="46" r="2" fill="' + ink + '"/>';
    if (c.mouth === "smile") s += '<path d="M42 57Q50 65 58 57" fill="none" stroke="' + ink + '" stroke-width="2.5" stroke-linecap="round"/>';
    if (c.mouth === "grin") s += '<path d="M41 56Q50 68 59 56Z" fill="#fff" stroke="' + ink + '" stroke-width="2" stroke-linejoin="round"/>';
    if (c.mouth === "open") s += '<ellipse cx="50" cy="60" rx="5" ry="6" fill="#7A1F2B" stroke="' + ink + '" stroke-width="2"/>';
    if (c.extra === "glasses") s += '<circle cx="41" cy="46" r="7.5" fill="none" stroke="' + ink + '" stroke-width="2.5"/><circle cx="59" cy="46" r="7.5" fill="none" stroke="' + ink + '" stroke-width="2.5"/><path d="M48.5 46h3" stroke="' + ink + '" stroke-width="2.5"/>';
    if (c.extra === "cap") s += '<path d="M26 38Q26 15 50 15Q74 15 74 38Z" fill="' + (c.top === "#111111" ? "#FFFC00" : "#111111") + '" stroke="' + ink + '" stroke-width="2"/><path d="M62 37h24" stroke="' + ink + '" stroke-width="6" stroke-linecap="round"/>';
    return s + "</svg>";
  }

  // ---------- State ----------
  let user = null, profile = null, stats = null, badges = [], draft = null, mode = "signin";
  const BADGES = { first_checkin: ["🔥", "First check-in"], daily_7: ["🏅", "7-day streak"], daily_30: ["🏆", "30-day streak"] };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const isoDay = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); // UTC day, same as the database

  async function loadAccount() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    profile = stats = null;
    badges = [];
    if (user) {
      const [p, s, b] = await Promise.all([
        sb.from("profiles").select("username,display_name,avatar").eq("id", user.id).single(),
        sb.from("player_stats").select("coins,streak,last_checkin").eq("user_id", user.id).single(),
        sb.from("user_badges").select("badge").eq("user_id", user.id),
      ]);
      profile = p.data; stats = s.data; badges = (b.data || []).map((r) => r.badge);
      draft = Object.assign({}, DEFAULT_AVATAR, profile && profile.avatar);
    }
    paintHeader();
    if (!view.hidden) render();
  }

  function paintHeader() { // show the user's character in the header button
    if (!headerBtn) return;
    headerBtn.innerHTML = profile ? avatarSvg(profile.avatar) : headerDefault;
    headerBtn.classList.toggle("has-avatar", !!profile);
  }

  // ---------- Screens ----------
  const panel = (html, cls) => '<div class="panel ' + (cls || "") + '">' + html + "</div>";

  function renderAuth() {
    if (!sb) {
      return panel("<h2>Accounts need a quick setup</h2><p>Add your Supabase project URL and anon key to <code>js/config.js</code>, run <code>supabase/schema.sql</code> in the Supabase SQL editor, and turn on Google under Authentication &rarr; Providers. Then reload this page.</p>");
    }
    const up = mode === "signup";
    return panel(
      "<h2>" + (up ? "Create your account" : "Welcome back") + "</h2>" +
      '<button class="btn btn--white" data-act="google" type="button">Continue with Google</button>' +
      '<p class="auth__or">or use email</p>' +
      '<input class="field" id="auth-email" type="email" autocomplete="email" placeholder="Email">' +
      '<input class="field" id="auth-pass" type="password" autocomplete="' + (up ? "new-password" : "current-password") + '" placeholder="Password (at least 6 characters)">' +
      '<button class="btn" data-act="submit" type="button">' + (up ? "Create account" : "Sign in") + "</button>" +
      '<p class="form-msg" id="auth-msg" role="status"></p>' +
      '<button class="link-btn" data-act="toggle" type="button">' + (up ? "Already have an account? Sign in" : "New here? Create an account") + "</button>",
      "auth"
    );
  }

  function optionRows() {
    return Object.keys(OPT).map((key) => {
      const items = OPT[key].map((val, i) => {
        const value = isColour(key) ? i : val;
        const on = String(draft[key]) === String(value) ? " is-on" : "";
        return isColour(key)
          ? '<button class="swatch' + on + '" style="--c:' + val + '" data-act="opt" data-key="' + key + '" data-val="' + value + '" type="button" aria-label="' + LABELS[key] + " " + (i + 1) + '"></button>'
          : '<button class="chip opt' + on + '" data-act="opt" data-key="' + key + '" data-val="' + value + '" type="button">' + val + "</button>";
      }).join("");
      return '<div class="opt-group"><span class="opt-label">' + LABELS[key] + '</span><div class="opt-row">' + items + "</div></div>";
    }).join("");
  }

  function renderProfile() {
    if (!profile || !stats) {
      return panel("<h2>We couldn't load your profile</h2><p>Make sure you ran <code>supabase/schema.sql</code> in your Supabase project, then try signing in again.</p>") +
        '<button class="btn btn--white" data-act="signout" type="button">Sign out</button>';
    }
    const streak = stats.last_checkin && stats.last_checkin >= isoDay(-1) ? stats.streak : 0; // a missed day resets it
    const done = stats.last_checkin === isoDay(0);
    const tiles = Object.keys(BADGES).map((k) =>
      '<div class="badge-tile' + (badges.includes(k) ? "" : " is-locked") + '"><span>' + BADGES[k][0] + "</span><b>" + BADGES[k][1] + "</b></div>").join("");
    return (
      panel('<div class="avatar-big" id="avatar-preview">' + avatarSvg(draft) + '</div><div><h2 id="who-name"></h2><p class="muted" id="who-user"></p></div>', "profile-head") +
      '<div class="stats">' +
      '<div class="panel stat"><span class="stat__big">🔥 <b id="stat-streak">' + streak + '</b></span><span>day streak</span>' +
      '<button class="btn btn--sm" data-act="checkin" type="button"' + (done ? " disabled" : "") + ">" + (done ? "Checked in today ✓" : "Check in (+2 coins)") + "</button></div>" +
      '<div class="panel stat"><span class="stat__big">🪙 <b id="stat-coins">' + stats.coins + "</b></span><span>coins</span></div></div>" +
      panel("<h3>Your character</h3>" + optionRows()) +
      panel('<h3>Profile</h3><label class="opt-label" for="f-name">Display name</label><input class="field" id="f-name" maxlength="30">' +
        '<label class="opt-label" for="f-user">Username</label><input class="field" id="f-user" maxlength="20" autocapitalize="none">' +
        '<button class="btn" data-act="save" type="button">Save profile</button><p class="form-msg" id="save-msg" role="status"></p>') +
      panel('<h3>Badges</h3><div class="badges">' + tiles + "</div><p class=\"muted\">More badges arrive with friends and chat.</p>") +
      '<button class="btn btn--white" data-act="signout" type="button">Sign out</button>'
    );
  }

  function render() {
    body.innerHTML = user ? renderProfile() : renderAuth();
    if (user && profile) { // user-typed text goes in with textContent/value (never as HTML)
      body.querySelector("#who-name").textContent = profile.display_name || "Explorer";
      body.querySelector("#who-user").textContent = "@" + profile.username;
      body.querySelector("#f-name").value = profile.display_name || "";
      body.querySelector("#f-user").value = profile.username;
    }
  }

  const say = (id, text, ok) => { const el = body.querySelector("#" + id); if (el) { el.textContent = text; el.classList.toggle("is-ok", !!ok); } };

  // ---------- Actions (one click listener for the whole view, so nothing is added twice) ----------
  body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !sb) return;
    const act = btn.dataset.act;
    if (act === "toggle") { mode = mode === "signin" ? "signup" : "signin"; render(); }
    if (act === "google") {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
      if (error) say("auth-msg", "Google sign-in didn't start: " + error.message + (location.protocol === "file:" ? " (Open the site through a local server, not as a file.)" : ""));
    }
    if (act === "submit") {
      const email = body.querySelector("#auth-email").value.trim();
      const password = body.querySelector("#auth-pass").value;
      if (!email || password.length < 6) return say("auth-msg", "Enter your email and a password of at least 6 characters.");
      btn.disabled = true;
      const res = mode === "signup"
        ? await sb.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0] }, emailRedirectTo: window.location.origin + window.location.pathname } })
        : await sb.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (res.error) say("auth-msg", res.error.message);
      else if (mode === "signup" && !res.data.session) say("auth-msg", "Check your email to confirm your account, then sign in.", true);
    }
    if (act === "signout") { await sb.auth.signOut(); }
    if (act === "opt") {
      const key = btn.dataset.key;
      draft[key] = isColour(key) ? Number(btn.dataset.val) : btn.dataset.val;
      body.querySelector("#avatar-preview").innerHTML = avatarSvg(draft);
      body.querySelectorAll('[data-act="opt"][data-key="' + key + '"]').forEach((b) => b.classList.toggle("is-on", b === btn));
    }
    if (act === "checkin") {
      btn.disabled = true;
      const { data, error } = await sb.rpc("check_in");
      if (error) { btn.disabled = false; return; }
      stats = Object.assign({}, stats, { coins: data.coins, streak: data.streak, last_checkin: isoDay(0) });
      (data.badges || []).forEach((b) => badges.push(b));
      render();
    }
    if (act === "save") {
      const name = body.querySelector("#f-name").value.trim().slice(0, 30);
      const username = body.querySelector("#f-user").value.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(username)) return say("save-msg", "Usernames use 3-20 letters, numbers or underscores.");
      btn.disabled = true;
      const { error } = await sb.from("profiles").update({ display_name: name, username, avatar: draft }).eq("id", user.id);
      btn.disabled = false;
      if (error) return say("save-msg", error.code === "23505" ? "That username is taken. Try another." : "We couldn't save that. Please try again.");
      profile = Object.assign({}, profile, { display_name: name, username, avatar: Object.assign({}, draft) });
      paintHeader();
      body.querySelector("#who-name").textContent = name || "Explorer";
      body.querySelector("#who-user").textContent = "@" + username;
      say("save-msg", "Saved!", true);
    }
  });

  // ---------- Opening and closing the profile view ----------
  function openProfile() {
    if (typeof mapView !== "undefined" && mapView && !mapView.hidden) closeMapView(true);
    view.hidden = false;
    document.body.classList.add("map-open"); // reuses the "lock page scroll" rule
    setNavActive("profile");
    render();
  }
  window.closeProfile = function (keepNav) {
    view.hidden = true;
    if (typeof mapView === "undefined" || !mapView || mapView.hidden) document.body.classList.remove("map-open");
    if (!keepNav) setNavActive("home");
  };
  window.handleNav = (name) => { if (name === "profile") openProfile(); else if (!view.hidden) window.closeProfile(true); };

  if (headerBtn) headerBtn.addEventListener("click", openProfile);
  const back = document.getElementById("profile-back");
  if (back) back.addEventListener("click", () => window.closeProfile());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !view.hidden) window.closeProfile(); });

  if (sb) {
    sb.auth.onAuthStateChange(() => setTimeout(loadAccount, 0)); // setTimeout avoids a known deadlock inside this callback
    loadAccount();
  }
})();
