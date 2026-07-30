#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const projectRoot = process.cwd();
const officialOrigin = "https://www.carnest.au";
const forbiddenDeploymentHost = ["vercel", "app"].join(".");
const simulatedDeploymentHost = ["carnest-alpha", "vercel", "app"].join(".");

function readProjectFile(pathname) {
  return readFileSync(join(projectRoot, pathname), "utf8");
}

function loadSeoModule() {
  const source = readProjectFile("lib/seo.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const sandbox = {
    console,
    module,
    exports: module.exports,
    process,
    URL,
    require(moduleName) {
      if (moduleName === "next" || moduleName === "@/types") return {};
      throw new Error(`Unexpected test import: ${moduleName}`);
    },
  };

  vm.runInNewContext(transpiled, sandbox, { filename: "lib/seo.ts" });
  return module.exports;
}

const originalEnv = { ...process.env };

try {
  const seo = loadSeoModule();

  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SITE_URL = "";
  process.env.NEXT_PUBLIC_APP_URL = "";
  process.env[["VERCEL", "URL"].join("_")] = simulatedDeploymentHost;
  process.env[["VERCEL", "PROJECT", "PRODUCTION", "URL"].join("_")] = simulatedDeploymentHost;

  assert.equal(seo.PUBLIC_SITE_ORIGIN, officialOrigin);
  assert.equal(seo.getSiteUrl(), officialOrigin);
  assert.equal(seo.buildAbsoluteUrl("/"), `${officialOrigin}/`);
  assert.equal(seo.buildAbsoluteUrl("/community"), `${officialOrigin}/community`);
  assert.equal(seo.buildAbsoluteUrl("/inventory/cn-test-listing"), `${officialOrigin}/inventory/cn-test-listing`);

  const homepageCanonicalUrl = new URL("/", seo.PUBLIC_SITE_ORIGIN).toString();
  const homepageOgUrl = seo.PUBLIC_SITE_ORIGIN;
  assert.equal(homepageCanonicalUrl, `${officialOrigin}/`);
  assert.equal(homepageOgUrl, officialOrigin);

  const layoutSource = readProjectFile("app/layout.tsx");
  assert.match(layoutSource, /metadataBase:\s*new URL\("https:\/\/www\.carnest\.au"\)/);
  assert.match(layoutSource, /canonical:\s*"\/"/);
  assert.match(layoutSource, /url:\s*"https:\/\/www\.carnest\.au"/);
  assert.match(layoutSource, /siteName:\s*"CarNest"/);

  const listingSource = readProjectFile("app/(public)/inventory/[id]/page.tsx");
  assert.ok(
    listingSource.includes("canonical: buildAbsoluteUrl(`/inventory/${vehicle.id}`)"),
    "Listing canonical URL must preserve the listing pathname."
  );
  assert.ok(
    listingSource.includes("url: buildAbsoluteUrl(`/inventory/${vehicle.id}`)"),
    "Listing Open Graph URL must preserve the listing pathname."
  );

  const publicMetadataFiles = [
    "app/layout.tsx",
    "app/(public)/page.tsx",
    "app/(public)/inventory/[id]/page.tsx",
    "app/(public)/community/page.tsx",
    "app/sitemap.ts",
    "app/robots.ts",
    "lib/seo.ts",
    "lib/public-vehicle-action-email.ts",
  ];

  for (const file of publicMetadataFiles) {
    const source = readProjectFile(file);
    assert.equal(source.includes(simulatedDeploymentHost), false, `${file} contains the old deployment host.`);
    assert.equal(source.includes(forbiddenDeploymentHost), false, `${file} contains a deployment host fallback.`);
  }

  console.log("Public share metadata validation passed.");
} finally {
  process.env = originalEnv;
}
