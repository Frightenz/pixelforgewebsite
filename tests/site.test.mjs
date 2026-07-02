import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pages = ["index.html", "privacy.html", "terms.html", "support.html", "404.html"];
const supportEmail = ["jeffreyburns", "me.com"].join("@");

function read(page) {
  return readFileSync(join(root, page), "utf8");
}

function linksFrom(html) {
  return [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
}

test("all static pages exist and include required document metadata", () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /^<!doctype html>/i, `${page} should be HTML5`);
    assert.match(html, /<html lang="en">/, `${page} should set a language`);
    assert.match(html, /<meta name="viewport"/, `${page} should include viewport metadata`);
    assert.match(html, /<link rel="stylesheet" href="assets\/styles\.css">/, `${page} should use shared CSS`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${page} should have exactly one h1`);
  }
});

test("relative links are GitHub Pages compatible and local targets exist", () => {
  for (const page of pages) {
    const html = read(page);
    for (const link of linksFrom(html)) {
      assert(!link.startsWith("/"), `${page} uses root-relative link ${link}`);
      assert(!link.startsWith("http://"), `${page} should not use insecure http link ${link}`);
      if (link.startsWith("mailto:") || link.startsWith("https://") || link.startsWith("#")) {
        continue;
      }

      const cleanLink = link.split("#")[0].split("?")[0];
      if (!cleanLink) {
        continue;
      }
      assert(existsSync(join(root, cleanLink)), `${page} links to missing local file ${cleanLink}`);
    }
  }
});

test("privacy policy covers App Store review requirements", () => {
  const privacy = read("privacy.html");
  const required = [
    /does not collect personal data/i,
    /does not track/i,
    /third-party advertising or analytics SDKs/i,
    /retention and deletion/i,
    /Consent controls/i,
    /Apple may process App Store purchases/i,
    /support\.html/i
  ];

  for (const pattern of required) {
    assert.match(privacy, pattern);
  }
});

test("only the support page exposes the support email address", () => {
  for (const page of pages.filter((page) => page !== "support.html")) {
    const html = read(page);
    assert(!html.includes(supportEmail), `${page} should not show the support email address`);
    assert.doesNotMatch(html, /mailto:/i, `${page} should not contain direct email links`);
  }

  const support = read("support.html");
  assert(support.includes(supportEmail));
  assert(support.includes(`mailto:${supportEmail}?subject=PixelForge%20Support`));
});

test("support and legal pages expose required support and purchase information", () => {
  const support = read("support.html");
  const terms = read("terms.html");

  assert.match(support, /App Store Connect Support URL/i);
  assert.match(terms, /Purchases and subscriptions/i);
  assert.match(terms, /Acceptable use/i);
  assert.match(terms, /Apple in-app purchases or subscriptions/i);
});

test("site CSS preserves PixelForge iOS color tokens", () => {
  const css = read("assets/styles.css");
  for (const token of ["#000102", "#020205", "#030307", "#8014ff", "#ff089e", "#00c7ff"]) {
    assert(css.includes(token), `missing PixelForge color token ${token}`);
  }
});
