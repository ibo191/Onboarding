import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipDirs = new Set([".git", "node_modules", ".agents", ".codex"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (entry.name === "index.html" || entry.name === "404.html") out.push(file);
  }
  return out;
}

function getAttr(html, selector, attr) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<[^>]+${escaped}[^>]+${attr}=["']([^"']+)["'][^>]*>`, "i");
  return html.match(re)?.[1] || "";
}

function contentFor(html, name) {
  const re = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  return html.match(re)?.[1] || "";
}

function titleFor(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
}

function canonicalFor(html) {
  return html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
}

function routeFromUrl(value) {
  if (!value) return "";
  try {
    return new URL(value).pathname.replace(/\/$/, "") || "/";
  } catch {
    return "";
  }
}

function appPathFor(file) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  if (rel === "404.html") return "/404";
  return `/${rel.replace(/\/index\.html$/, "")}`;
}

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, "") || "/");
const sitemapSet = new Set(sitemapUrls);
const pages = walk(root);
const publicPages = pages.filter((file) => !path.relative(root, file).startsWith("onboarding") && !path.relative(root, file).startsWith("student"));

const report = publicPages.map((file) => {
  const html = fs.readFileSync(file, "utf8");
  const route = appPathFor(file);
  const isUtility = ["/404", "/dekujeme-za-vyplneni-objednavky"].includes(route);
  const canonical = canonicalFor(html);
  const canonicalRoute = routeFromUrl(canonical);
  const canonicalInSitemap = canonicalRoute ? sitemapSet.has(canonicalRoute) : false;
  const jsonLdCount = (html.match(/type=["']application\/ld\+json["']/gi) || []).length;
  return {
    route,
    file: path.relative(root, file).replace(/\\/g, "/"),
    title: titleFor(html),
    description: contentFor(html, "description"),
    canonical,
    robots: contentFor(html, "robots"),
    ogTitle: contentFor(html, "og:title"),
    ogDescription: contentFor(html, "og:description"),
    jsonLdCount,
    inSitemap: sitemapSet.has(route),
    canonicalInSitemap,
    issues: [
      !titleFor(html) && "missing title",
      !contentFor(html, "description") && "missing meta description",
      !canonical && !isUtility && "missing canonical",
      !contentFor(html, "og:title") && !isUtility && "missing og:title",
      !contentFor(html, "og:description") && !isUtility && "missing og:description",
      jsonLdCount === 0 && !isUtility && "missing json-ld",
      !canonicalInSitemap && !isUtility && "canonical not in sitemap",
      route === "/404" && "utility page",
    ].filter(Boolean),
  };
});

const missingFiles = sitemapUrls.filter((route) => route !== "/" && !publicPages.some((file) => appPathFor(file) === route));

console.log(JSON.stringify({ pages: report.length, issues: report.filter((item) => item.issues.length), missingFiles }, null, 2));
