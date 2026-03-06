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
    const submitBtn = form.querySelector('button[type="submit"]');

    const reviewForm = document.getElementById("reviewForm");
    const reviewRatingEl = document.getElementById("reviewRating");
    const reviewMessageEl = document.getElementById("reviewMessage");
    const reviewStatusEl = document.getElementById("reviewStatus");
    const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");
    const liveReviewsEl = document.getElementById("liveReviews");

    let reviewsAutoScrollTimer = null;

    const authBoxEl = document.getElementById("authBox");
    const authInfoEl = document.getElementById("authInfo");
    const loginBtn = document.getElementById("discordLoginBtn");
    const navLogoutBtn = document.getElementById("navLogoutBtn");

    let loggedUser = null;

    function setStatus(msg, type) {
      statusEl.textContent = msg;
      statusEl.className = "status status-box " + (type || "");
    }

    function updateCount() {
      const len = (messageEl.value || "").length;
      charCountEl.textContent = `${len}/4000`;
    }

    function setReviewStatus(msg, type) {
      reviewStatusEl.textContent = msg;
      reviewStatusEl.className = "status status-box " + (type || "");
    }

    function starsFromRating(rating) {
      const n = Math.max(1, Math.min(5, Number(rating || 0)));
      return "⭐".repeat(n);
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function renderReviewCard(it) {
      const stars = starsFromRating(it.rating);
      return `
        <article class="review-card">
          <div class="review-header">
            <div class="avatar"><i class="fa-brands fa-discord"></i></div>
            <div>
              <div class="review-name">${escapeHtml(it.discord_user_display || "Użytkownik Discord")}</div>
              <div class="review-meta">Opinia ze strony</div>
            </div>
          </div>
          <div class="stars">${stars} <span class="rating-meta">(${Number(it.rating || 0)}/5)</span></div>
          <p class="review-text">„${escapeHtml(it.review || "")}”</p>
        </article>
      `;
    }

    function stopReviewsAutoScroll() {
      if (reviewsAutoScrollTimer) {
        clearInterval(reviewsAutoScrollTimer);
        reviewsAutoScrollTimer = null;
      }
    }

    function startReviewsAutoScroll() {
      stopReviewsAutoScroll();

      const cards = liveReviewsEl.querySelectorAll('.review-card');
      if (cards.length < 4) return;

      let direction = 1;
      reviewsAutoScrollTimer = setInterval(() => {
        const maxScroll = liveReviewsEl.scrollWidth - liveReviewsEl.clientWidth;
        if (maxScroll <= 0) return;

        const nextLeft = liveReviewsEl.scrollLeft + (direction * 1);
        if (nextLeft >= maxScroll) {
          direction = -1;
        } else if (nextLeft <= 0) {
          direction = 1;
        }

        liveReviewsEl.scrollBy({ left: direction, behavior: 'auto' });
      }, 18);
    }

    function renderLiveReviews(items) {
      stopReviewsAutoScroll();

      if (!items.length) {
        liveReviewsEl.classList.remove('is-scrollable');
        liveReviewsEl.innerHTML = '<div class="status status-box">Brak opinii dodanych przez formularz.</div>';
        return;
      }

      liveReviewsEl.innerHTML = items.map(renderReviewCard).join("");

      const shouldScroll = items.length >= 4;
      liveReviewsEl.classList.toggle('is-scrollable', shouldScroll);
      if (shouldScroll) {
        startReviewsAutoScroll();
      }
    }

    async function loadLiveReviews() {
      try {
        const res = await fetch(API_REVIEWS, { cache: "no-store" });
        const out = await res.json().catch(() => ({ items: [] }));
        const items = Array.isArray(out.items) ? out.items : [];
        renderLiveReviews(items);
      } catch {
        liveReviewsEl.innerHTML = '<div class="status status-box err">Nie udało się załadować opinii.</div>';
      }
    }

    
async function warmupDatabaseSchema() {
  try {
    await fetch(API_DB_INIT, { cache: "no-store" });
  } catch {
    // non-blocking warmup; normal flows will still try schema init on write/read
  }
}

function setAuthUI(user) {
      loggedUser = user || null;
      const isAuth = Boolean(loggedUser && loggedUser.id);
      submitBtn.disabled = !isAuth;
      reviewSubmitBtn.disabled = !isAuth;

      if (isAuth) {
        const visibleName = loggedUser.global_name || loggedUser.username || "Użytkownik";
        authInfoEl.textContent = `Zalogowano jako: ${visibleName} (ID: ${loggedUser.id})`;
        loginBtn.hidden = true;
        navLogoutBtn.hidden = false;
        authBoxEl.classList.add("hidden");

        document.getElementById("name").value = visibleName;
        document.getElementById("contact").value = loggedUser.id;
      } else {
        authInfoEl.textContent = "Wymagane logowanie przez Discord przed wysłaniem wiadomości.";
        loginBtn.hidden = false;
        navLogoutBtn.hidden = true;
        authBoxEl.classList.remove("hidden");

        document.getElementById("name").value = "";
        document.getElementById("contact").value = "";
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

    navLogoutBtn.addEventListener("click", async () => {
      try {
        await fetch(API_LOGOUT, { method: "POST", credentials: "include" });
      } finally {
        setAuthUI(null);
      }
    });

    updateCount();
    warmupDatabaseSchema();
    refreshAuth();
    loadLiveReviews();
    messageEl.addEventListener("input", updateCount);

    liveReviewsEl.addEventListener('mouseenter', stopReviewsAutoScroll);
    liveReviewsEl.addEventListener('mouseleave', startReviewsAutoScroll);
    window.addEventListener('beforeunload', stopReviewsAutoScroll);

    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!loggedUser) {
        setReviewStatus("Najpierw zaloguj się przez Discord.", "err");
        return;
      }

      const rating = Number(reviewRatingEl.value || 0);
      const review = (reviewMessageEl.value || "").trim();
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

      setReviewStatus("Wysyłam opinię…", "");
      try {
        const res = await fetch(API_REVIEW, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review, rating })
        });

        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) {
          setReviewStatus(out.error || "Nie udało się wysłać opinii.", "err");
          return;
        }

        reviewForm.reset();
        reviewRatingEl.value = "5";
        if (out.warning) {
          setReviewStatus(`Opinia zapisana ✅ (${out.warning})`, "ok");
        } else {
          setReviewStatus("Opinia wysłana ✅", "ok");
        }

        if (out.item) {
          const current = Array.from(liveReviewsEl.querySelectorAll('.review-card')).map(() => null);
          if (current.length === 0 || liveReviewsEl.textContent.includes("Brak opinii")) {
            renderLiveReviews([out.item]);
          } else {
            liveReviewsEl.insertAdjacentHTML('afterbegin', renderReviewCard(out.item));
          }
        } else {
          await loadLiveReviews();
        }
      } catch {
        setReviewStatus("Błąd sieci. Spróbuj ponownie.", "err");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!loggedUser) {
        setStatus("Najpierw zaloguj się przez Discord.", "err");
        return;
      }

      if ((hpEl?.value || "").trim().length > 0) {
        form.reset();
        setAuthUI(loggedUser);
        updateCount();
        setStatus("Wysłane ✅", "ok");
        return;
      }

      const name = document.getElementById("name").value.trim();
      const contact = document.getElementById("contact").value.trim();
      const topic = document.getElementById("topic").value.trim();
      const message = messageEl.value.trim();

      if (!name || !contact || !topic || !message) {
        setStatus("Uzupełnij wszystkie pola.", "err");
        return;
      }

      if (message.length > 4000) {
        setStatus("Wiadomość jest za długa (max 4000 znaków).", "err");
        return;
      }

      setStatus("Wysyłam…", "");

      try {
        const res = await fetch(API_CONTACT, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, contact, topic, message, hpWebsite: "" })
        });

        const out = await res.json().catch(() => ({}));

        if (!res.ok || !out.ok) {
          setStatus(out.error || "Nie udało się wysłać. Spróbuj ponownie.", "err");
          if (res.status === 401) setAuthUI(null);
          return;
        }

        form.reset();
        setAuthUI(loggedUser);
        updateCount();
        if (out.warning) {
          setStatus(`Wysłane ✅ (${out.warning})`, "ok");
        } else {
          setStatus("Wysłane ✅", "ok");
        }
      } catch {
        setStatus("Błąd sieci. Spróbuj ponownie.", "err");
      }
    });
  
