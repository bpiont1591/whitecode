const API_CONTACT = "/contact";
const API_ME = "/auth/me";
const API_LOGOUT = "/auth/logout";
const API_DISCORD_STATUS = "/discord/status";
const API_OPINIONS = "/api/opinions";

const form = document.getElementById("contactForm");
const statusEl = document.getElementById("status");
const messageEl = document.getElementById("message");
const charCountEl = document.getElementById("charCount");
const hpEl = document.getElementById("website");
const submitBtn = form?.querySelector('button[type="submit"]');

const authBoxEl = document.getElementById("authBox");
const authInfoEl = document.getElementById("authInfo");
const loginBtn = document.getElementById("discordLoginBtn");
const navLogoutBtn = document.getElementById("navLogoutBtn");
const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileNav = document.getElementById("mobileNav");

const discordMemberCountEl = document.getElementById("discordMemberCount");
const discordBotStatusEl = document.getElementById("discordBotStatus");
const discordApiStatusEl = document.getElementById("discordApiStatus");
const discordStatusInfoEl = document.getElementById("discordStatusInfo");
const opinionsEl = document.getElementById("opinions") || document.getElementById("opinionsList");
const opinionsStatusEl = document.getElementById("opinionsStatus");

let loggedUser = null;
let discordStatusTimer = null;
let opinionsTimer = null;

function setStatus(msg, type) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = `status status-box ${type || ""}`.trim();
}

function updateCount() {
  if (!messageEl || !charCountEl) return;
  const len = (messageEl.value || "").length;
  charCountEl.textContent = `${len}/4000`;
}

function setSubmitting(isSubmitting) {
  if (!form) return;

  const controls = form.querySelectorAll("input, textarea, select, button");
  for (const ctrl of controls) {
    if (ctrl.id === "name" || ctrl.id === "contact") continue;
    ctrl.disabled = isSubmitting;
  }

  if (submitBtn) {
    submitBtn.classList.toggle("is-loading", isSubmitting);
    if (isSubmitting) {
      if (!submitBtn.dataset.originalText) {
        submitBtn.dataset.originalText = submitBtn.innerHTML;
      }
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Wysyłam...';
    } else if (submitBtn.dataset.originalText) {
      submitBtn.innerHTML = submitBtn.dataset.originalText;
    }
  }
}

function setAuthUI(user) {
  loggedUser = user || null;
  const isAuth = Boolean(loggedUser && loggedUser.id);
  if (submitBtn) submitBtn.disabled = !isAuth;

  const nameEl = document.getElementById("name");
  const contactEl = document.getElementById("contact");

  if (isAuth) {
    const visibleName = loggedUser.global_name || loggedUser.username || "Użytkownik";
    if (authInfoEl) authInfoEl.textContent = `Zalogowano jako: ${visibleName} (ID: ${loggedUser.id})`;
    if (loginBtn) loginBtn.hidden = true;
    if (navLogoutBtn) navLogoutBtn.hidden = false;
    if (mobileLogoutBtn) mobileLogoutBtn.hidden = false;
    if (authBoxEl) authBoxEl.classList.add("hidden");
    if (nameEl) nameEl.value = visibleName;
    if (contactEl) contactEl.value = loggedUser.id;
  } else {
    if (authInfoEl) authInfoEl.textContent = "Wymagane logowanie przez Discord przed wysłaniem wiadomości.";
    if (loginBtn) loginBtn.hidden = false;
    if (navLogoutBtn) navLogoutBtn.hidden = true;
    if (mobileLogoutBtn) mobileLogoutBtn.hidden = true;
    if (authBoxEl) authBoxEl.classList.remove("hidden");
    if (nameEl) nameEl.value = "";
    if (contactEl) contactEl.value = "";
  }
}

function closeMobileMenu() {
  if (!mobileMenuBtn || !mobileNav) return;
  mobileNav.hidden = true;
  mobileMenuBtn.setAttribute("aria-expanded", "false");
}

function toggleMobileMenu() {
  if (!mobileMenuBtn || !mobileNav) return;
  const expanded = mobileMenuBtn.getAttribute("aria-expanded") === "true";
  mobileNav.hidden = expanded;
  mobileMenuBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderDiscordStatus(data) {
  if (discordMemberCountEl) {
    discordMemberCountEl.textContent = Number.isFinite(data.memberCount)
      ? String(data.memberCount)
      : "—";
  }

  if (discordBotStatusEl) {
    const status = data.botStatus || "offline";
    discordBotStatusEl.textContent = status;
    discordBotStatusEl.className = `bot-status ${status}`;
  }

  if (discordApiStatusEl) {
    const apiStatus = data.apiStatus || "unknown";
    discordApiStatusEl.textContent = apiStatus;
    discordApiStatusEl.className = `bot-status ${apiStatus}`;
  }

  if (discordStatusInfoEl) {
    const stale = data.stale ? " (cache)" : "";
    discordStatusInfoEl.textContent = `Ostatnia aktualizacja: ${formatDateTime(data.updatedAt)}${stale}`;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stars(n) {
  const value = Math.max(1, Math.min(5, Number(n || 0)));
  return "⭐".repeat(value) + "☆".repeat(5 - value);
}

function renderOpinionCard(item) {
  const author = escapeHtml(item.userTag || `ID: ${item.userId || "nieznany"}`);
  const text = escapeHtml(item.text || "");
  const atmosfera = escapeHtml(item.atmosfera || "—");
  const przebieg = escapeHtml(item.przebieg || "—");
  const rating = Math.max(1, Math.min(5, Number(item.rating || 0)));

  return `
    <article class="opinion-card">
      <div class="opinion-head">
        <strong>${stars(rating)} (${rating}/5)</strong>
        <span>${formatDateTime(item.createdAt)}</span>
      </div>
      <div class="opinion-author">${author}</div>
      <p class="opinion-text">${text || "—"}</p>
      <div class="opinion-meta">
        <span><b>Atmosfera:</b> ${atmosfera}</span>
        <span><b>Przebieg:</b> ${przebieg}</span>
      </div>
    </article>
  `;
}

function setOpinionsStatus(message) {
  if (opinionsStatusEl) opinionsStatusEl.textContent = message;
}

async function refreshOpinions() {
  if (!opinionsEl) return;

  try {
    opinionsEl.setAttribute("aria-busy", "true");

    const response = await fetch(API_OPINIONS, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      opinionsEl.innerHTML = '<p class="status-note">Nie udało się pobrać opinii.</p>';
      setOpinionsStatus(`Nie udało się pobrać opinii. (${response.status})`);
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      opinionsEl.innerHTML = '<p class="status-note">Endpoint opinii zwrócił niepoprawny format.</p>';
      setOpinionsStatus("Endpoint opinii zwrócił niepoprawny format.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    const items = Array.isArray(data?.items) ? data.items : null;

    if (!data?.ok || !items) {
      opinionsEl.innerHTML = '<p class="status-note">Niepoprawna odpowiedź endpointu opinii.</p>';
      setOpinionsStatus("Niepoprawna odpowiedź endpointu opinii.");
      return;
    }

    if (items.length === 0) {
      opinionsEl.innerHTML = '<p class="status-note">Na razie nie ma jeszcze opinii.</p>';
      setOpinionsStatus("Na razie nie ma jeszcze opinii.");
      return;
    }

    opinionsEl.innerHTML = items.map(renderOpinionCard).join("");
    setOpinionsStatus(`Załadowano ${items.length} opinii.`);
  } catch (error) {
    console.error("Opinions error:", error);
    opinionsEl.innerHTML = '<p class="status-note">Nie udało się pobrać opinii.</p>';
    setOpinionsStatus("Nie udało się pobrać opinii.");
  } finally {
    opinionsEl.removeAttribute("aria-busy");
  }
}

function startOpinionsAutoRefresh() {
  if (!opinionsEl) return;
  if (opinionsTimer) clearInterval(opinionsTimer);
  refreshOpinions();
  opinionsTimer = setInterval(refreshOpinions, 60_000);
}

async function refreshDiscordStatus() {
  try {
    const res = await fetch(API_DISCORD_STATUS, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) {
      if (discordStatusInfoEl) {
        discordStatusInfoEl.textContent = out.error || "Status Discord chwilowo niedostępny.";
      }
      return;
    }

    renderDiscordStatus(out);
  } catch {
    if (discordStatusInfoEl) {
      discordStatusInfoEl.textContent = "Status Discord chwilowo niedostępny.";
    }
  }
}

function startDiscordStatusAutoRefresh() {
  if (discordStatusTimer) clearInterval(discordStatusTimer);
  refreshDiscordStatus();
  discordStatusTimer = setInterval(refreshDiscordStatus, 60_000);
}

async function refreshAuth() {
  try {
    const res = await fetch(API_ME, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const out = await res.json().catch(() => ({}));
    setAuthUI(out.user || null);
  } catch {
    setAuthUI(null);
  }
}

async function handleLogout() {
  try {
    await fetch(API_LOGOUT, { method: "POST", credentials: "include" });
  } finally {
    setAuthUI(null);
    closeMobileMenu();
  }
}

navLogoutBtn?.addEventListener("click", handleLogout);
mobileLogoutBtn?.addEventListener("click", handleLogout);
mobileMenuBtn?.addEventListener("click", toggleMobileMenu);

mobileNav?.addEventListener("click", (event) => {
  const el = event.target;
  if (el instanceof HTMLAnchorElement) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!loggedUser) {
    setStatus("Najpierw zaloguj się przez Discord.", "err");
    return;
  }

  if (hpEl?.value) {
    setStatus("Wiadomość odrzucona.", "err");
    return;
  }

  const topicEl = document.getElementById("topic");
  const message = (messageEl?.value || "").trim();
  const topic = topicEl?.value || "";

  if (!message || !topic) {
    setStatus("Uzupełnij temat i treść wiadomości.", "err");
    return;
  }

  setStatus("Wysyłam wiadomość...", "");
  setSubmitting(true);

  try {
    const res = await fetch(API_CONTACT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ topic, message }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) {
      if (res.status === 429 && out.retry_after_sec) {
        setStatus(`Za szybko wysyłasz wiadomości. Spróbuj za ${out.retry_after_sec}s.`, "err");
      } else {
        setStatus(out.error || "Nie udało się wysłać wiadomości.", "err");
      }
      return;
    }

    form.reset();
    updateCount();

    const nameEl = document.getElementById("name");
    const contactEl = document.getElementById("contact");
    const visibleName = loggedUser.global_name || loggedUser.username || "Użytkownik";
    if (nameEl) nameEl.value = visibleName;
    if (contactEl) contactEl.value = loggedUser.id;

    setStatus("Wiadomość wysłana ✅", "ok");
  } catch {
    setStatus("Błąd połączenia. Spróbuj ponownie.", "err");
  } finally {
    setSubmitting(false);
    if (submitBtn && !loggedUser) submitBtn.disabled = true;
  }
});

messageEl?.addEventListener("input", updateCount);

document.addEventListener("DOMContentLoaded", () => {
  updateCount();
  refreshAuth();
  startDiscordStatusAutoRefresh();
  startOpinionsAutoRefresh();
});
