<meta name='viewport' content='width=device-width, initial-scale=1'/><script>/* =========================================================================
   ih5z -- request form logic
   ========================================================================= */

/* -------------------------------------------------------------------------
   CONFIGURATION -- this is the only block you need to edit.
   ------------------------------------------------------------------------- */

const CONFIG = {
  /* 1) FORM ENDPOINT -- required.
     Go to https://web3forms.com, enter the email where requests should land,
     copy the Access Key, paste it between the quotes below.

     Note on "keys in public JS": a Web3Forms Access Key is a *public form key*.
     It only routes mail to the address you verified -- it cannot read your
     inbox, and it is designed to sit in client-side code. GitHub Pages has no
     server, so this is the correct and only place for it. If it is ever
     abused, regenerate it on web3forms.com and paste the new one here. */
  web3formsAccessKey: "f413f660-9dff-4e28-97ba-a527744e56bf",

  /* 2) DONATION LINK -- optional.
     Any URL: https://buymeacoffee.com/ih5z , a Ko-fi page, PayPal.me, UPI link.
     Leave it as "" and the Support buttons stay hidden -- no dead buttons. */
  donationUrl: "",

  /* 3) REQUEST COUNTER -- optional.
     A URL returning JSON exactly like: { "count": 128 }
     (e.g. a Cloudflare Worker, a static JSON file you update, a serverless fn).
     Leave as "" and the counter never renders. It will never show fake numbers. */
  counterEndpoint: "",

  /* 4) Anti-spam: minimum seconds a human needs before submitting. */
  minFillSeconds: 3
};

/* -------------------------------------------------------------------------
   Nothing below needs editing.
   ------------------------------------------------------------------------- */

const form = document.getElementById("requestForm");
const requestPanel = document.getElementById("requestPanel");
const successPanel = document.getElementById("successPanel");
const submitBtn = document.getElementById("submitBtn");
const clearBtn = document.getElementById("clearBtn");
const backHomeBtn = document.getElementById("backHomeBtn");
const formStatus = document.getElementById("formStatus");
const counterEl = document.getElementById("requestCounter");
const donateBtn = document.getElementById("donateBtn");
const supportBtn2 = document.getElementById("supportBtn2");

const loadedAt = Date.now();
let isSubmitting = false;

/* -------------------------------------------------------------- validation */

const RULES = {
  songName: (v) => {
    if (!v.trim()) return "Enter the song name.";
    if (v.trim().length < 2) return "That looks too short.";
    return "";
  },
  artistName: (v) => {
    if (!v.trim()) return "Enter the artist name.";
    if (v.trim().length < 2) return "That looks too short.";
    return "";
  },
  editStyle: (v) => (v ? "" : "Choose an edit style."),
  musicLanguage: (v) => (v ? "" : "Choose the song's language."),
  referenceUrl: (v) => {
    const s = v.trim();
    if (!s) return "";
    let url;
    try {
      url = new URL(s);
    } catch {
      return "Enter a full link starting with https://";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Link must start with http:// or https://";
    }
    return "";
  },
  username: (v) => (v.trim().length > 40 ? "Keep it under 40 characters." : ""),
  details: (v) => (v.trim().length > 1000 ? "Keep it under 1000 characters." : "")
};

function setError(id, message) {
  const input = document.getElementById(id);
  const slot = document.querySelector(`[data-error-for="${id}"]`);
  const field = input.closest(".field");
  if (!input || !slot) return;

  if (message) {
    slot.textContent = message;
    slot.classList.add("show");
    field.classList.add("invalid");
    input.setAttribute("aria-invalid", "true");
  } else {
    slot.textContent = "";
    slot.classList.remove("show");
    field.classList.remove("invalid");
    input.removeAttribute("aria-invalid");
  }
}

function clearAllErrors() {
  Object.keys(RULES).forEach((id) => setError(id, ""));
  hideStatus();
}

function validateForm() {
  let firstInvalid = null;

  Object.keys(RULES).forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const message = RULES[id](input.value);
    setError(id, message);
    if (message && !firstInvalid) firstInvalid = input;
  });

  if (firstInvalid) {
    firstInvalid.focus({ preventScroll: true });
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ status */

function showStatus(text) {
  formStatus.textContent = text;
  formStatus.classList.add("show");
}

function hideStatus() {
  formStatus.textContent = "";
  formStatus.classList.remove("show");
}

/* ----------------------------------------------------------------- loading */

function setLoading(loading) {
  isSubmitting = loading;
  submitBtn.disabled = loading;
  clearBtn.disabled = loading;
  submitBtn.classList.toggle("loading", loading);
  submitBtn.querySelector(".btn-label").textContent = loading ? "Sending…" : "Submit request";
  form.setAttribute("aria-busy", loading ? "true" : "false");
}

/* ------------------------------------------------------------------ submit */

async function handleSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;          // hard stop on double submits
  hideStatus();

  // honeypot -- a real person never checks this
  if (form.botcheck.checked) return;

  // time trap -- bots submit instantly
  if ((Date.now() - loadedAt) / 1000 < CONFIG.minFillSeconds) {
    showStatus("Hold on a moment, then submit again.");
    return;
  }

  if (!CONFIG.web3formsAccessKey || CONFIG.web3formsAccessKey === "YOUR_WEB3FORMS_ACCESS_KEY") {
    showStatus("Form is not connected yet -- add your Web3Forms access key in script.js.");
    return;
  }

  if (!validateForm()) {
    showStatus("Check the highlighted fields.");
    return;
  }

  setLoading(true);

  const payload = {
    access_key: CONFIG.web3formsAccessKey,
    subject: `ih5z request -- ${form.Song.value.trim()} by ${form.Artist.value.trim()}`,
    from_name: "ih5z requests",
    botcheck: false,
    Song: form.Song.value.trim(),
    Artist: form.Artist.value.trim(),
    "Edit style": form["Edit style"].value,
    "Music language": form["Music language"].value,
    "Reference link": form["Reference link"].value.trim() || "--",
    "Requested by": form["Requested by"].value.trim() || "Anonymous",
    Details: form.Details.value.trim() || "--",
    Submitted: new Date().toISOString()
  };

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      /* non-JSON response -- treated as failure below */
    }

    if (!response.ok || data.success !== true) {
      throw new Error(data.message || "The request could not be sent.");
    }

    // real success only
    form.reset();
    clearAllErrors();
    setLoading(false);
    showSuccess();

  } catch (error) {
    setLoading(false);
    showStatus(
      (error && error.message ? error.message : "Network error.") +
      " Try again, or DM me directly."
    );
  }
}

/* ---------------------------------------------------------------- success */

function showSuccess() {
  requestPanel.hidden = true;
  successPanel.hidden = false;
  successPanel.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backHome() {
  successPanel.hidden = true;
  requestPanel.hidden = false;
  loadedAtPlaceholder();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// resets the anti-bot timer so a second request isn't throttled
function loadedAtPlaceholder() {
  form.dataset.reopened = "1";
}

/* ------------------------------------------------------------------ clear */

function clearForm() {
  form.reset();
  clearAllErrors();
  document.getElementById("songName").focus({ preventScroll: true });
}

/* --------------------------------------------------------------- donation */

function initDonation() {
  const url = (CONFIG.donationUrl || "").trim();
  if (!url) return;                  // stays hidden -- never a dead button

  const open = () => window.open(url, "_blank", "noopener,noreferrer");

  [donateBtn, supportBtn2].forEach((btn) => {
    btn.hidden = false;
    btn.addEventListener("click", open);
  });
}

/* ---------------------------------------------------------------- counter */

async function initCounter() {
  const endpoint = (CONFIG.counterEndpoint || "").trim();
  if (!endpoint) return;             // no endpoint → no counter, ever

  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.count !== "number" || !Number.isFinite(data.count)) return;

    const n = data.count.toLocaleString();
    counterEl.textContent = `${n} request${data.count === 1 ? "" : "s"} received`;
    counterEl.hidden = false;
  } catch {
    /* silently absent -- a broken counter is worse than none */
  }
}

/* ----------------------------------------------------------------- reveal */

function initReveal() {
  const items = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

/* ------------------------------------------------------------------- wire */

form.addEventListener("submit", handleSubmit);
clearBtn.addEventListener("click", clearForm);
backHomeBtn.addEventListener("click", backHome);

// live-clear an error the moment the field becomes valid
Object.keys(RULES).forEach((id) => {
  const input = document.getElementById(id);
  if (!input) return;
  const eventName = input.tagName === "SELECT" ? "change" : "input";
  input.addEventListener(eventName, () => {
    if (input.closest(".field").classList.contains("invalid")) {
      setError(id, RULES[id](input.value));
    }
  });
});

initReveal();
initDonation();
initCounter();</script>