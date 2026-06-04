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
      student_email: applicant.email || application.credentials?.email || "",
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

  async function upsertApplication(application, source) {
    if (!application?.id) return null;
    return request("applications?on_conflict=id,source", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rowFromApplication(application, source)),
    }).catch((error) => {
      console.warn("Supabase sync failed", error);
      return null;
    });
  }

  async function fetchApplications(source) {
    const rows = await request(
      `applications?select=id,source,status,data,updated_at&source=eq.${encodeURIComponent(source)}&order=updated_at.desc`,
    ).catch((error) => {
      console.warn("Supabase load failed", error);
      return null;
    });
    return Array.isArray(rows) ? rows.map((row) => row.data).filter(Boolean) : [];
  }

  window.BuBuSupabase = {
    getConfig,
    upsertWebApplication: (application) => upsertApplication(application, "web"),
    upsertPortalApplication: (application) => upsertApplication(application, "onboarding"),
    fetchWebApplications: () => fetchApplications("web"),
    fetchPortalApplications: () => fetchApplications("onboarding"),
    isEnabled: async () => Boolean((await getConfig()).enabled),
  };
})();
