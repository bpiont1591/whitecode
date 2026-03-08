const API_CONTACT = "/contact";
const API_ME = "/auth/me";
const API_LOGOUT = "/auth/logout";
const API_REVIEW = "/review";
const API_REVIEWS = "/reviews";
const API_DB_INIT = "/db/init";

const form = document.getElementById("contactForm");
const statusEl = document.getElementById("status");
const messageEl = document.getElementById("message");
const charCountEl = document.getElementById("charCount");
const hpEl = document.getElementById("website");
const submitBtn = form?.querySelector('button[type="submit"]');

const reviewForm = document.getElementById("reviewForm");
const reviewRatingEl = document.getElementById("reviewRating");
const reviewMessageEl = document.getElementById("reviewMessage");
const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");
const reviewStatusEl = document.getElementById("reviewStatus");
const reviewIdentityEl = document.getElementById("reviewIdentity");
const liveReviewsEl = document.getElementById("liveReviews");

const authBoxEl = document.getElementById("authBox");
const authInfoEl = document.getElementById("authInfo");
const loginBtn = document.getElementById("discordLoginBtn");
const navLogoutBtn = document.getElementById("navLogoutBtn");

let loggedUser = null;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setStatus(msg, type) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = "status status-box " + (type || "");
}

function setReviewStatus(msg, type) {
  if (!reviewStatusEl) return;
  reviewStatusEl.textContent = msg;
  reviewStatusEl.className = "status status-box " + (type || "");
}

function updateCount() {
  if (!messageEl || !charCountEl) return;
  const len = (messageEl.value || "").length;
  charCountEl.textContent = `${len}/4000`;
}

function starsFromRating(rating) {
  const n = Math.max(1, Math.min(5, Number(rating || 0)));
  return "⭐".repeat(n);
}

function renderReviewCard(it) {
  return `
    <article class="review-card">
      <div class="review-header">
        <div class="avatar"><i class="fa-brands fa-discord"></i></div>
        <div>
          <div class="review-name">${escapeHtml(it.discord_user_display || "Użytkownik Discord")}</div>
          <div class="review-meta">ID: ${escapeHtml(it.discord_user_id || "—")}</div>
        </div>
      </div>
      <div class="stars">${starsFromRating(it.rating)} <span class="rating-meta">(${Number(it.rating || 0)}/5)</span></div>
      <p class="review-text">„${escapeHtml(it.review || "")}"</p>
    </article>
  `;
}

async function warmupReviewsSchema() {
  try {
    await fetch(API_DB_INIT, { cache: "no-store" });
  } catch {
    // non-blocking
  }
}

async function loadLiveReviews() {
  if (!liveReviewsEl) return;
  try {
    const res = await fetch(API_REVIEWS, { cache: "no-store" });
    const out = await res.json().catch(() => ({ items: [] }));

    if (!res.ok || !out.ok) {
      liveReviewsEl.innerHTML = `<div class="status status-box err">${escapeHtml(out.error || "Nie udało się pobrać opinii.")}</div>`;
      return;
    }

    const items = Array.isArray(out.items) ? out.items : [];
    if (!items.length) {
      liveReviewsEl.innerHTML = '<div class="status status-box">Brak opinii. Bądź pierwszy!</div>';
      return;
    }

    liveReviewsEl.innerHTML = items.map(renderReviewCard).join("");
  } catch {
    liveReviewsEl.innerHTML = '<div class="status status-box err">Nie udało się pobrać opinii.</div>';
  }
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
      submitBtn.dataset.originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Wysyłam...';
    } else if (submitBtn.dataset.originalText) {
      submitBtn.innerHTML = submitBtn.dataset.originalText;
    }
  }
}

function setReviewSubmitting(isSubmitting) {
  if (!reviewForm) return;
  const controls = reviewForm.querySelectorAll("textarea, select, button");
  for (const ctrl of controls) {
    ctrl.disabled = isSubmitting;
  }

  if (reviewSubmitBtn) {
    reviewSubmitBtn.classList.toggle("is-loading", isSubmitting);
    if (isSubmitting) {
      reviewSubmitBtn.dataset.originalText = reviewSubmitBtn.innerHTML;
      reviewSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dodaję...';
    } else if (reviewSubmitBtn.dataset.originalText) {
      reviewSubmitBtn.innerHTML = reviewSubmitBtn.dataset.originalText;
    }
  }
}

function setAuthUI(user) {
  loggedUser = user || null;
  const isAuth = Boolean(loggedUser && loggedUser.id);
  if (submitBtn) submitBtn.disabled = !isAuth;
  if (reviewSubmitBtn) reviewSubmitBtn.disabled = !isAuth;

  if (isAuth) {
    const visibleName = loggedUser.global_name || loggedUser.username || "Użytkownik";
    if (authInfoEl) authInfoEl.textContent = `Zalogowano jako: ${visibleName} (ID: ${loggedUser.id})`;
    if (reviewIdentityEl) {
      reviewIdentityEl.textContent = `Dodajesz opinię jako: ${visibleName} (ID: ${loggedUser.id})`;
      reviewIdentityEl.className = "status status-box ok";
    }
    if (loginBtn) loginBtn.hidden = true;
    if (navLogoutBtn) navLogoutBtn.hidden = false;
    if (authBoxEl) authBoxEl.classList.add("hidden");

    const nameEl = document.getElementById("name");
    const contactEl = document.getElementById("contact");
    if (nameEl) nameEl.value = visibleName;
    if (contactEl) contactEl.value = loggedUser.id;
  } else {
    if (authInfoEl) authInfoEl.textContent = "Wymagane logowanie przez Discord przed wysłaniem wiadomości.";
    if (reviewIdentityEl) {
      reviewIdentityEl.textContent = "Najpierw zaloguj się przez Discord, aby dodać opinię.";
      reviewIdentityEl.className = "status status-box";
    }
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

if (reviewForm) {
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!loggedUser) {
      setReviewStatus("Najpierw zaloguj się przez Discord.", "err");
      return;
    }

    const rating = Number(reviewRatingEl?.value || 0);
    const review = String(reviewMessageEl?.value || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setReviewStatus("Wybierz ocenę od 1 do 5.", "err");
      return;
    }

    if (!review) {
      setReviewStatus("Wpisz treść opinii.", "err");
      return;
    }

    if (review.length > 1200) {
      setReviewStatus("Opinia jest za długa (max 1200 znaków).", "err");
      return;
    }

    setReviewStatus("Dodaję opinię...", "");
    setReviewSubmitting(true);

    try {
      const res = await fetch(API_REVIEW, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review, rating })
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) {
        setReviewStatus(out.error || "Nie udało się dodać opinii.", "err");
        return;
      }

      reviewForm.reset();
      if (reviewRatingEl) reviewRatingEl.value = "5";
      setReviewStatus("Opinia dodana ✅", "ok");
      await loadLiveReviews();
    } catch {
      setReviewStatus("Błąd połączenia. Spróbuj ponownie.", "err");
    } finally {
      setReviewSubmitting(false);
      if (!loggedUser && reviewSubmitBtn) reviewSubmitBtn.disabled = true;
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
    setSubmitting(true);

    try {
      const res = await fetch(API_CONTACT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message })
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
}

if (messageEl) messageEl.addEventListener("input", updateCount);

updateCount();
warmupReviewsSchema();
refreshAuth();
loadLiveReviews();
