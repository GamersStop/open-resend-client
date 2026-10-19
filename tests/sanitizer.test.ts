import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtml, sanitizeAttachmentFilename } from "../lib/sanitizer";

describe("Phase 3: Sanitizer & Security Utilities suite", () => {
  it("should strip <script> tags and malicious payloads", () => {
    const dirty = '<div>Hello</div><script>alert("XSS")</script><p>World</p>';
    const clean = sanitizeHtml(dirty);

    assert.ok(!clean.includes("<script>"));
    assert.ok(!clean.includes("alert("));
    assert.ok(clean.includes("Hello"));
    assert.ok(clean.includes("World"));
  });

  it("should strip inline event handlers like onerror and onload", () => {
    const dirty = '<img src="invalid.jpg" onerror="alert(1)" /><body onload="steal()">';
    const clean = sanitizeHtml(dirty);

    assert.ok(!clean.includes("onerror"));
    assert.ok(!clean.includes("onload"));
    assert.ok(!clean.includes("steal()"));
  });

  it("should disallow dangerous iframes and object embeds", () => {
    const dirty = '<iframe src="https://attacker.com"></iframe><object data="malware.swf"></object>';
    const clean = sanitizeHtml(dirty);

    assert.ok(!clean.includes("<iframe"));
    assert.ok(!clean.includes("<object"));
  });

  it("should sanitize path-traversal attachment filenames", () => {
    assert.equal(
      sanitizeAttachmentFilename("../../etc/passwd"),
      "passwd"
    );
    assert.equal(
      sanitizeAttachmentFilename("..\\..\\windows\\system32\\cmd.exe"),
      "cmd.exe"
    );
    assert.equal(
      sanitizeAttachmentFilename("invoice/nested/document.pdf"),
      "document.pdf"
    );
    assert.equal(
      sanitizeAttachmentFilename(""),
      "attachment.bin"
    );
  });
});
