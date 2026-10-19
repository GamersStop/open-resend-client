import DOMPurify from "isomorphic-dompurify";
import path from "path";

/**
 * Sanitizes an incoming HTML email body server-side before persisting to database.
 * Strips script tags, unsafe iframes, object embeds, and dangerous inline event handlers.
 */
export function sanitizeHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml || typeof rawHtml !== "string") {
    return "";
  }

  // Configure DOMPurify with strict email-friendly options
  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "blockquote",
      "br",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "span",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
      "code",
      "font",
      "center",
      "style",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "class",
      "style",
      "target",
      "rel",
      "width",
      "height",
      "align",
      "valign",
      "bgcolor",
      "color",
      "border",
      "cellpadding",
      "cellspacing",
    ],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "formaction"],
    ALLOW_DATA_ATTR: false,
  });

  return clean;
}

/**
 * Sanitizes an incoming attachment filename to neutralize path traversal (../../) attacks.
 */
export function sanitizeAttachmentFilename(rawFilename: string): string {
  if (!rawFilename || typeof rawFilename !== "string") {
    return "attachment.bin";
  }

  // Extract base filename without directory separators
  const base = path.basename(rawFilename.replace(/\\/g, "/"));

  // Strip null bytes, control characters, and non-printable characters
  const clean = base
    .replace(/\0/g, "")
    .replace(/[^\w\s.-]/g, "_")
    .trim();

  return clean.length > 0 ? clean : "attachment.bin";
}
