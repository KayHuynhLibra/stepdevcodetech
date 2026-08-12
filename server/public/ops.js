(function () {
  const TOKEN_KEY = "sofiaore_ops_token";

  const $ = (id) => document.getElementById(id);
  const loginPanel = $("loginPanel");
  const dash = $("dash");
  const playbookPanel = $("playbookPanel");
  const backupPanel = $("backupPanel");
  const loginMsg = $("loginMsg");
  const dashMsg = $("dashMsg");

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  function showMsg(el, text, ok) {
    el.textContent = text || "";
    el.className = "msg " + (ok ? "ok" : text ? "err" : "");
  }

  async function api(path, opts) {
    const headers = Object.assign(
      { Accept: "application/json" },
      opts && opts.headers,
    );
    const t = token();
    if (t) headers.Authorization = "Bearer " + t;
    if (opts && opts.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(function () {
      return { ok: false, reason: "Phản hồi không phải JSON" };
    });
    if (!res.ok) {
      const err = new Error(
        (data && (data.reason || data.error)) || "HTTP " + res.status,
      );
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function setAuthed(on) {
    loginPanel.hidden = !!on;
    dash.hidden = !on;
    playbookPanel.hidden = !on;
    backupPanel.hidden = !on;
  }

  function renderStats(sec, ops) {
    const ready = sec && sec.summary && sec.summary.ready;
    const db = sec && sec.runtime && sec.runtime.db;
    const redis = sec && sec.runtime && sec.runtime.redis;
    const crit = (sec && sec.summary && sec.summary.critical) || 0;
    const html = [
      ["Ready", ready ? "OK" : "FAIL", ready ? "ok" : "bad"],
      [
        "DB",
        db && db.configured ? (db.ok ? "OK" : "FAIL") : "JSON",
        db && db.configured && !db.ok ? "bad" : "",
      ],
      [
        "Redis",
        redis && redis.configured ? (redis.ok ? "OK" : "FAIL") : "off",
        redis && redis.configured && !redis.ok ? "warn" : "",
      ],
      ["Critical", String(crit), crit ? "bad" : "ok"],
    ]
      .map(function (row) {
        return (
          '<div class="stat"><b>' +
          row[0] +
          '</b><span class="' +
          row[2] +
          '">' +
          row[1] +
          "</span></div>"
        );
      })
      .join("");
    $("stats").innerHTML = html;

    const steps = (ops && ops.playbook) || (sec && sec.ops && sec.ops.playbook) || [];
    $("playbook").innerHTML = steps
      .map(function (s) {
        return (
          "<li><strong>" +
          escapeHtml(s.title) +
          "</strong> — " +
          escapeHtml(s.detail) +
          "</li>"
        );
      })
      .join("");
    $("offsite").textContent =
      (ops && ops.offsiteHint) ||
      (sec && sec.ops && sec.ops.offsiteHint) ||
      "";

    const backups =
      (ops && ops.backups) ||
      (sec && sec.ops && sec.ops.latestBackup
        ? [sec.ops.latestBackup]
        : []);
    if (!backups.length) {
      $("backups").innerHTML = "<li class='muted'>Chưa có backup local.</li>";
    } else {
      $("backups").innerHTML = backups
        .slice(0, 8)
        .map(function (b) {
          return (
            "<li><code>" +
            escapeHtml(b.id) +
            "</code> · " +
            b.fileCount +
            " file · " +
            Math.round(b.bytes / 1024) +
            " KB</li>"
          );
        })
        .join("");
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refresh() {
    showMsg(dashMsg, "Đang quét…", true);
    try {
      const sec = await api("/api/admin/system-security");
      let ops = null;
      try {
        ops = await api("/api/admin/system-ops");
      } catch {
        ops = null;
      }
      renderStats(sec, ops);
      showMsg(dashMsg, "Cập nhật " + new Date().toLocaleString("vi-VN"), true);
    } catch (e) {
      if (e && e.status === 401) {
        setToken("");
        setAuthed(false);
        showMsg(loginMsg, "Phiên hết hạn — đăng nhập lại", false);
        return;
      }
      showMsg(dashMsg, e instanceof Error ? e.message : "Lỗi", false);
    }
  }

  $("btnLogin").addEventListener("click", async function () {
    showMsg(loginMsg, "Đang đăng nhập…", true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("user").value.trim(),
          password: $("pass").value,
        }),
      });
      if (!data.token) throw new Error("Không nhận được token");
      setToken(data.token);
      setAuthed(true);
      showMsg(loginMsg, "", true);
      await refresh();
    } catch (e) {
      showMsg(loginMsg, e instanceof Error ? e.message : "Đăng nhập thất bại", false);
    }
  });

  $("btnToken").addEventListener("click", function () {
    const t = window.prompt("Dán Bearer token (đã login admin trước đó)");
    if (!t) return;
    setToken(t.trim());
    setAuthed(true);
    refresh();
  });

  $("btnRefresh").addEventListener("click", function () {
    refresh();
  });

  $("btnBackup").addEventListener("click", async function () {
    if (!window.confirm("Tạo bản sao lưu JSON vào server/data/backups/?")) return;
    showMsg(dashMsg, "Đang sao lưu…", true);
    try {
      const r = await api("/api/admin/system-backup", { method: "POST", body: "{}" });
      showMsg(
        dashMsg,
        "Đã backup " + (r.backup && r.backup.id) + " (" + (r.backup && r.backup.fileCount) + " file)",
        true,
      );
      await refresh();
    } catch (e) {
      showMsg(dashMsg, e instanceof Error ? e.message : "Backup thất bại", false);
    }
  });

  $("btnLogout").addEventListener("click", function () {
    setToken("");
    setAuthed(false);
    showMsg(loginMsg, "Đã đăng xuất", true);
  });

  if (token()) {
    setAuthed(true);
    refresh();
  }
})();
