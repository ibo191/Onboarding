(function () {
  const form = document.getElementById("fallCampaignForm");
  if (!form) return;

  document.querySelectorAll(".fall-faq details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;
      document.querySelectorAll(".fall-faq details").forEach((otherDetail) => {
        if (otherDetail !== detail) otherDetail.open = false;
      });
    });
  });

  const status = form.querySelector(".fall-form-status");
  const submitButton = form.querySelector('button[type="submit"]');
  let recaptchaConfigPromise = null;
  let recaptchaScriptPromise = null;

  function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function normalizeName(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts.shift() || "",
      lastName: parts.join(" "),
    };
  }

  function priceForPackage(packageId) {
    return packageId === "jistota" ? 32900 : 19900;
  }

  function packageTitle(packageId) {
    return packageId === "jistota" ? "B Jistota" : "B Základ";
  }

  function campaignId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `BUBU-JESEN-${window.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    }
    return `BUBU-JESEN-${Date.now().toString(36).toUpperCase()}`;
  }

  function getRecaptchaConfig() {
    if (!recaptchaConfigPromise) {
      recaptchaConfigPromise = fetch("/api/recaptcha-config", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { enabled: false }))
        .catch(() => ({ enabled: false }));
    }
    return recaptchaConfigPromise;
  }

  function loadRecaptcha(siteKey) {
    if (window.grecaptcha) return Promise.resolve();
    if (!recaptchaScriptPromise) {
      recaptchaScriptPromise = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    }
    return recaptchaScriptPromise;
  }

  async function recaptchaToken() {
    const config = await getRecaptchaConfig();
    if (!config.enabled || !config.siteKey) return "";
    await loadRecaptcha(config.siteKey);
    if (!window.grecaptcha) return "";

    return new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        try {
          window.grecaptcha.execute(config.siteKey, { action: "submit" }).then(resolve).catch(() => resolve(""));
        } catch (error) {
          resolve("");
        }
      });
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const name = normalizeName(data.get("name"));
    const selectedPackage = String(data.get("package") || "zaklad");
    const branch = String(data.get("branch") || "").trim();
    const preferredDate = String(data.get("preferredDate") || "").trim();

    const application = {
      id: campaignId(),
      status: "new",
      source: "google-campaign-autumn",
      courseId: "b",
      courseTitle: "Řidičák skupiny B",
      packageId: selectedPackage,
      packageTitle: packageTitle(selectedPackage),
      totalPrice: priceForPackage(selectedPackage),
      branchName: branch,
      preferredBranch: branch,
      preferredDate,
      orderMessage: "Google kampaň: Stihni řidičák ještě letos. Začni na podzim, řiď v zimě.",
      orderCreatedAt: new Date().toISOString(),
      student: {
        firstName: name.firstName,
        lastName: name.lastName,
        email: String(data.get("email") || "").trim().toLowerCase(),
        phone: String(data.get("phone") || "").trim(),
        targetGroups: "B",
      },
      applicant: {
        firstName: name.firstName,
        lastName: name.lastName,
        email: String(data.get("email") || "").trim().toLowerCase(),
        phone: String(data.get("phone") || "").trim(),
        targetGroups: "B",
      },
      campaign: {
        name: "Podzim 2026 - Stihni řidičák ještě letos",
        medium: "google-ads",
        landingPage: "/kampane/jesen/",
      },
      consents: {
        personalData: true,
        submittedAt: new Date().toISOString(),
      },
      credentials: {
        email: String(data.get("email") || "").trim().toLowerCase(),
        passwordSet: false,
      },
      security: {
        recaptchaToken: await recaptchaToken(),
      },
    };

    submitButton.disabled = true;
    submitButton.textContent = "Odesílám...";

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "web", application, sendEmails: true, requireSuccess: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || "Objednávku se nepodařilo odeslat.");

      form.reset();
      setStatus("Děkujeme. Rezervace je odeslaná a ozveme se co nejdříve.");
      if (payload.portalSetupUrl) {
        window.setTimeout(() => {
          window.location.href = payload.portalSetupUrl;
        }, 1200);
      }
    } catch (error) {
      setStatus(error.message || "Objednávku se nepodařilo odeslat.", true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Chci řidičák bez stresu";
    }
  });
})();
