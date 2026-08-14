#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const projectRoot = process.cwd();

function readProjectFile(pathname) {
  return readFileSync(join(projectRoot, pathname), "utf8");
}

function loadCommunityGalleryHelpers() {
  const source = `${readProjectFile("components/community/community-gallery.tsx")}
module.exports.__test__ = { getMomentCaptionParagraphs };
`;
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
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
    Image: class TestImage {},
    window: { addEventListener() {}, removeEventListener() {} },
    require(moduleName) {
      if (moduleName === "next/link") return function Link() { return null; };
      if (moduleName === "react") {
        return {
          useEffect() {},
          useMemo(factory) { return factory(); },
          useState(initialValue) { return [initialValue, () => undefined]; },
        };
      }
      if (moduleName === "react/jsx-runtime") {
        return {
          Fragment: Symbol.for("react.fragment"),
          jsx() { return null; },
          jsxs() { return null; },
        };
      }
      if (moduleName === "@/lib/community") {
        return {
          COMMUNITY_CATEGORIES: [],
          COMMUNITY_CATEGORY_LABELS: {},
          getCommunityMomentCoverImage() { return null; },
          getCommunityMomentImageCount() { return 0; },
          getCommunityMomentImages() { return []; },
          isPublicActiveLinkedVehicle() { return false; },
          listPublishedCommunityMoments() { return Promise.resolve([]); },
        };
      }
      if (moduleName === "@/lib/data") return { getVehicleById() { return Promise.resolve(null); } };
      if (moduleName === "@/lib/utils") return { getVehicleDisplayReference() { return "CN-TEST"; } };
      if (moduleName === "@/types") return {};
      throw new Error(`Unexpected test import: ${moduleName}`);
    },
  };

  vm.runInNewContext(transpiled, sandbox, { filename: "components/community/community-gallery.tsx" });
  return module.exports.__test__;
}

const source = readProjectFile("components/community/community-gallery.tsx");

assert.match(
  source,
  /className="[^"]*fixed inset-0[^"]*overflow-y-auto[^"]*"/,
  "The modal overlay should allow vertical scrolling on small viewports."
);
assert.match(
  source,
  /className="[^"]*flex max-h-\[calc\(100dvh-2rem\)\][^"]*flex-col[^"]*overflow-hidden[^"]*"/,
  "The modal card should stay constrained to the viewport while containing its own scrollable body."
);
assert.match(
  source,
  /className="[^"]*shrink-0 flex items-center justify-between[^"]*"/,
  "The modal header and Close control should remain outside the scrollable article body."
);
assert.match(
  source,
  /className="min-h-0 overflow-y-auto"/,
  "The image/article body should be the scrollable region."
);
assert.match(
  source,
  /selectedCaptionParagraphs\.map/,
  "Article captions should render all paragraphs rather than a single clipped block."
);
assert.equal(
  /selectedCaptionParagraphs[\s\S]{0,500}line-clamp|line-clamp[\s\S]{0,500}selectedCaptionParagraphs/.test(source),
  false,
  "Selected article caption paragraphs must not be line-clamped."
);

const { getMomentCaptionParagraphs } = loadCommunityGalleryHelpers();
const longArticle = [
  "CarNest was started by a small group of car enthusiasts who have spent years working in the automotive industry.",
  "The more time we have spent in this industry, the more we have realised there is still a lot of room to improve transparency, presentation and trust in the Australian used-car market.",
  "That is why we started CarNest.",
  "For now, we have not really done a complete enough job if this paragraph disappears from the modal. This final sentence must remain part of the rendered article body.",
].join("\n\n");

const paragraphs = getMomentCaptionParagraphs(longArticle);
assert.equal(paragraphs.length, 4, "Long article captions should preserve paragraph breaks.");
assert.equal(
  paragraphs.at(-1)?.endsWith("rendered article body."),
  true,
  "The final paragraph of a long article should still be available to render."
);

console.log("Community article modal validation passed.");
