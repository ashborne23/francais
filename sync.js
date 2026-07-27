/* ------------------------------------------------------------------
   Offline-first sync for the French lab.

   Local storage stays the source of truth. Supabase holds one JSON row
   per signed-in user. On sign-in and on demand the two are MERGED
   field by field, never overwritten wholesale, so working on the
   laptop in the morning and the iPad at night doesn't lose either.

   Merge rules
     log      union by date; the larger minute count for that date wins
     quiz     per topic, the higher right/wrong counts win
     voc      per card, the higher Leitner box wins
     known    union of everything marked known
     done     union of completed units
     open     union
     mine     union by french headword
     startLv  from whichever side was written most recently
------------------------------------------------------------------- */

(function () {
  const KEY = "french_lab_v1";
  const STAMP = "french_lab_stamp";
  const cfg = window.FL_CONFIG || {};
  const bar = document.getElementById("syncbar");
  if (!bar) return;

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    bar.innerHTML = '<span class="tbar-s">Sync is off — add your Supabase keys to <code>config.js</code> to turn it on.</span>';
    return;
  }

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
  const writeLocal = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); localStorage.setItem(STAMP, new Date().toISOString()); } catch (e) {} };
  const localStamp = () => { try { return localStorage.getItem(STAMP) || "1970-01-01T00:00:00Z"; } catch (e) { return "1970-01-01T00:00:00Z"; } };

  function mins(e) { return (e.l || 0) + (e.r || 0) + (e.g || 0) + (e.s || 0) + (e.w || 0); }

  function merge(a, b, aStamp, bStamp) {
    a = a || {}; b = b || {};
    const out = { log: {}, quiz: {}, voc: {}, known: {}, done: {}, open: {}, mine: [] };

    const dates = new Set([...Object.keys(a.log || {}), ...Object.keys(b.log || {})]);
    dates.forEach(d => {
      const x = (a.log || {})[d], y = (b.log || {})[d];
      out.log[d] = !x ? y : !y ? x : (mins(x) >= mins(y) ? x : y);
    });

    const topics = new Set([...Object.keys(a.quiz || {}), ...Object.keys(b.quiz || {})]);
    topics.forEach(t => {
      const x = (a.quiz || {})[t] || { r: 0, w: 0 }, y = (b.quiz || {})[t] || { r: 0, w: 0 };
      out.quiz[t] = { r: Math.max(x.r || 0, y.r || 0), w: Math.max(x.w || 0, y.w || 0) };
    });

    const cards = new Set([...Object.keys(a.voc || {}), ...Object.keys(b.voc || {})]);
    cards.forEach(c => {
      const x = (a.voc || {})[c], y = (b.voc || {})[c];
      out.voc[c] = !x ? y : !y ? x : ((x.b || 0) >= (y.b || 0) ? x : y);
    });

    [["known", "known"], ["done", "done"], ["open", "open"]].forEach(([k]) => {
      Object.assign(out[k], a[k] || {});
      Object.entries(b[k] || {}).forEach(([id, v]) => { if (v) out[k][id] = v; });
    });

    const seen = new Set();
    [...(a.mine || []), ...(b.mine || [])].forEach(m => {
      if (m && m.fr && !seen.has(m.fr)) { seen.add(m.fr); out.mine.push(m); }
    });

    out.startLv = (aStamp >= bStamp ? a.startLv : b.startLv) || a.startLv || b.startLv || "A2";
    return out;
  }

  let sb = null, session = null, lastPushed = null, busy = false;

  function status(html, cls) {
    bar.innerHTML = '<span class="tbar-s ' + (cls || "") + '">' + html + "</span>" + controls();
    wire();
  }
  function controls() {
    if (!session) {
      return '<span class="tbar-b">' +
             '<input type="email" id="sy-mail" placeholder="you@example.com" autocomplete="username">' +
             '<input type="password" id="sy-pass" placeholder="password" autocomplete="current-password">' +
             '<button type="button" id="sy-in">Sign in</button>' +
             '<button type="button" id="sy-up">Create account</button></span>';
    }
    return '<span class="tbar-b"><button type="button" id="sy-now">Sync now</button>' +
           '<button type="button" id="sy-out">Sign out</button></span>';
  }
  function wire() {
    const i = document.getElementById("sy-in");
    if (i) i.onclick = () => credentials(false);
    const u = document.getElementById("sy-up");
    if (u) u.onclick = () => credentials(true);
    const p = document.getElementById("sy-pass");
    if (p) p.onkeydown = (e) => { if (e.key === "Enter") credentials(false); };
    const n = document.getElementById("sy-now");
    if (n) n.onclick = () => syncNow(true);
    const o = document.getElementById("sy-out");
    if (o) o.onclick = async () => { await sb.auth.signOut(); session = null; status("Signed out. Progress stays on this device."); };
  }

  async function credentials(isNew) {
    const em = document.getElementById("sy-mail");
    const pw = document.getElementById("sy-pass");
    const email = (em && em.value || "").trim();
    const password = (pw && pw.value || "");
    if (!email) { em && em.focus(); return; }
    if (password.length < 6) { status("Password needs at least 6 characters.", "warn"); return; }

    status(isNew ? "Creating account…" : "Signing in…");
    const fn = isNew ? "signUp" : "signInWithPassword";
    const { data, error } = await sb.auth[fn]({ email, password });

    if (error) {
      let msg = error.message;
      if (/invalid login credentials/i.test(msg))
        msg = "Wrong email or password. If this is your first time on this device, use Create account only once — then Sign in everywhere else.";
      if (/already registered|user already/i.test(msg))
        msg = "That account exists — use Sign in instead.";
      status(msg, "warn");
      return;
    }
    if (!data.session) {
      status("Account created, but Supabase is waiting on email confirmation. Turn off " +
             "Authentication → Sign In / Providers → Confirm email, then sign in.", "warn");
      return;
    }
    session = data.session;
    syncNow(false);
  }

  async function syncNow(manual) {
    if (!session || busy) return;
    busy = true;
    if (manual) status("Syncing…");
    try {
      const local = readLocal();
      const { data, error } = await sb.from("progress")
        .select("data, updated_at").eq("user_id", session.user.id).maybeSingle();
      if (error) throw error;

      const remote = data ? data.data : null;
      const remoteStamp = data ? data.updated_at : "1970-01-01T00:00:00Z";
      const merged = merge(local, remote, localStamp(), remoteStamp);
      const mergedStr = JSON.stringify(merged);
      const changedLocally = mergedStr !== JSON.stringify(local);

      if (changedLocally) writeLocal(merged);

      if (mergedStr !== lastPushed) {
        const { error: upErr } = await sb.from("progress")
          .upsert({ user_id: session.user.id, data: merged, updated_at: new Date().toISOString() });
        if (upErr) throw upErr;
        lastPushed = mergedStr;
      }

      status("Synced as " + session.user.email + " · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (changedLocally && manual) setTimeout(() => location.reload(), 600);
      if (changedLocally && !manual) status("Pulled newer progress from another device — reloading…"), setTimeout(() => location.reload(), 800);
    } catch (e) {
      status("Sync failed: " + (e.message || e) + " — your progress is still safe on this device.", "warn");
    } finally { busy = false; }
  }

  async function boot() {
    status("Connecting…");
    let createClient;
    try {
      ({ createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"));
    } catch (e) {
      try { ({ createClient } = await import("https://esm.sh/@supabase/supabase-js@2")); }
      catch (e2) {
        status("Offline — sync paused. Everything is saving on this device.", "");
        return;
      }
    }
    sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    session = data.session || null;

    sb.auth.onAuthStateChange((_e, s) => {
      session = s || null;
      if (session) syncNow(false); else status("Signed out. Progress stays on this device.");
    });

    if (session) await syncNow(false);
    else status("Not synced. Sign in to share progress between your laptop and iPad.");

    setInterval(() => { if (session) syncNow(false); }, 120000);
    window.addEventListener("pagehide", () => { if (session) syncNow(false); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && session) syncNow(false);
    });
  }

  boot();
})();
