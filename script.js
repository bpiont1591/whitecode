const API_CONTACT = "/contact";
const API_ME = "/auth/me";
const API_LOGOUT = "/auth/logout";

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

let loggedUser = null;

function setStatus(msg, type) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = "status status-box " + (type || "");
}

function updateCount() {
  if (!messageEl || !charCountEl) return;
  const len = (messageEl.value || "").length;
  charCountEl.textContent = `${len}/4000`;
}

function setAuthUI(user) {
  loggedUser = user || null;
  const isAuth = Boolean(loggedUser && loggedUser.id);
  if (submitBtn) submitBtn.disabled = !isAuth;

  if (isAuth) {
    const visibleName = loggedUser.global_name || loggedUser.username || "Użytkownik";
    if (authInfoEl) authInfoEl.textContent = `Zalogowano jako: ${visibleName} (ID: ${loggedUser.id})`;
    if (loginBtn) loginBtn.hidden = true;
    if (navLogoutBtn) navLogoutBtn.hidden = false;
    if (authBoxEl) authBoxEl.classList.add("hidden");

    const nameEl = document.getElementById("name");
    const contactEl = document.getElementById("contact");
    if (nameEl) nameEl.value = visibleName;
    if (contactEl) contactEl.value = loggedUser.id;
  } else {
    if (authInfoEl) authInfoEl.textContent = "Wymagane logowanie przez Discord przed wysłaniem wiadomości.";
    if (loginBtn) loginBtn.hidden = false;
    if (navLogoutBtn) navLogoutBtn.hidden = true;
    if (authBoxEl) authBoxEl.classList.remove("hidden");

    const nameEl = document.getElementById("name");
    const contactEl = document.getElementById("contact");
    if (nameEl) nameEl.value = "";
    if (contactEl) contactEl.value = "";
  }
}

async function refreshAuth() {
  try {
    const res = await fetch(API_ME, { credentials: "include" });
    const out = await res.json().catch(() => ({}));
    setAuthUI(out.user || null);
  } catch {
    setAuthUI(null);
  }
}

if (navLogoutBtn) {
  navLogoutBtn.addEventListener("click", async () => {
    try {
      await fetch(API_LOGOUT, { method: "POST", credentials: "include" });
    } finally {
      setAuthUI(null);
    }
  });
}

if (form) {
  form.addEventListener("submit", async (e) => {
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

    setStatus("Wysyłam wiadomość…", "");

    try {
      const res = await fetch(API_CONTACT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          message
        })
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) {
        setStatus(out.error || "Nie udało się wysłać wiadomości.", "err");
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
    }
  });
}

if (messageEl) messageEl.addEventListener("input", updateCount);

updateCount();
refreshAuth();
