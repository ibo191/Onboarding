(function () {
  const CONFIG_ENDPOINT = "/api/supabase-config";
  let configPromise = null;

  function rowFromApplication(application, source) {
    const applicant = application.student || application.applicant || {};
    return {
      id: application.id,
      source,
      status: application.status || "new",
      course_id: application.courseId || application.course || applicant.targetGroups || "",
      student_email: String(applicant.email || application.credentials?.email || "").toLowerCase(),
      student_name: [applicant.firstName, applicant.lastName].filter(Boolean).join(" "),
      phone: applicant.phone || "",
      data: application,
      updated_at: new Date().toISOString(),
    };
  }

  async function getConfig() {
    if (!configPromise) {
      configPromise = fetch(CONFIG_ENDPOINT, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { enabled: false }))
        .catch(() => ({ enabled: false }));
    }
    return configPromise;
  }

  async function request(path, options = {}) {
    const config = await getConfig();
    if (!config.enabled || !config.url || !config.anonKey) return null;
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Supabase ${response.status}: ${message}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function upsertApplication(application, source, options = {}) {
    if (!application?.id) return null;
    return apiPost("/api/applications", { source, application, ...options }).catch((error) => {
      console.warn("Supabase sync failed", error);
      return null;
    });
  }

  async function fetchApplications(source) {
    const payload = await fetch(`/api/applications?source=${encodeURIComponent(source)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { applications: [] }))
      .catch((error) => {
      console.warn("Supabase load failed", error);
      return null;
    });
    return Array.isArray(payload?.applications) ? payload.applications : [];
  }

  async function apiPost(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed: ${response.status}`);
    return payload;
  }

  window.BuBuSupabase = {
    getConfig,
    upsertWebApplication: (application, options) => upsertApplication(application, "web", options),
    upsertPortalApplication: (application) => upsertApplication(application, "onboarding"),
    fetchWebApplications: () => fetchApplications("web"),
    fetchPortalApplications: () => fetchApplications("onboarding"),
    notifyStudent: (applicationId, type, message) => apiPost("/api/notify-student", { applicationId, type, message }),
    setStudentPassword: (details, password) => {
      if (details && typeof details === "object") return apiPost("/api/set-student-password", details);
      return apiPost("/api/set-student-password", { applicationId: details, password });
    },
    studentLogin: (email, password) => apiPost("/api/student-login", { email, password }),
    saveConsent: (decision) => apiPost("/api/consent", decision),
    isEnabled: async () => Boolean((await getConfig()).enabled),
  };
})();
