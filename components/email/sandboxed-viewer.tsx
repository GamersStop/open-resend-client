"use client";

import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, Image as ImageIcon, Eye, EyeOff } from "lucide-react";

interface SandboxedViewerProps {
  htmlBody: string | null;
  textBody: string | null;
}

export function SandboxedViewer({ htmlBody, textBody }: SandboxedViewerProps) {
  const [loadRemoteImages, setLoadRemoteImages] = useState(false);
  const [hasRemoteImages, setHasRemoteImages] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(300);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const rawHtml = htmlBody || (textBody ? `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.6; color: #1e293b;">${textBody}</pre>` : "<p style='color: #64748b;'>No content available</p>");

  useEffect(() => {
    // Detect if content contains external HTTP/HTTPS image tags
    const containsImages = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i.test(rawHtml);
    setHasRemoteImages(containsImages);
  }, [rawHtml]);

  // If remote images are blocked, replace external image sources with data URI placeholders
  const processedHtml = React.useMemo(() => {
    let content = rawHtml;

    if (!loadRemoteImages && hasRemoteImages) {
      content = content.replace(
        /<img([^>]+)src=["'](https?:\/\/[^"']+)["']([^>]*)>/gi,
        '<img$1src="data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'40\' viewBox=\'0 0 120 40\'><rect width=\'100%\' height=\'100%\' fill=\'%23f1f5f9\' stroke=\'%23cbd5e1\' rx=\'4\'/><text x=\'50%\' y=\'50%\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%2394a3b8\' dominant-baseline=\'middle\' text-anchor=\'middle\'>[Image Blocked]</text></svg>" data-blocked-src="$2"$3>'
      );
    }

    // Inject base reset styling inside the iframe
    const styleReset = `
      <style>
        body {
          margin: 0;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #1e293b;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        a {
          color: #4f46e5;
          text-decoration: underline;
        }
        blockquote {
          border-left: 3px solid #cbd5e1;
          margin-left: 0;
          padding-left: 12px;
          color: #64748b;
        }
      </style>
    `;

    return `${styleReset}${content}`;
  }, [rawHtml, loadRemoteImages, hasRemoteImages]);

  // Adjust iframe height dynamically to match contents
  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const body = iframeRef.current.contentWindow.document.body;
        const html = iframeRef.current.contentWindow.document.documentElement;
        const height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        );
        if (height > 0) {
          setIframeHeight(height + 24);
        }
      } catch {
        // Fallback default
        setIframeHeight(400);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Remote Image Security Bar */}
      {hasRemoteImages && (
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              {loadRemoteImages
                ? "Remote images loaded upon your request."
                : "Remote tracking pixels and external images were blocked to protect your IP."}
            </span>
          </div>

          <button
            onClick={() => setLoadRemoteImages(!loadRemoteImages)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-700 font-medium transition-colors cursor-pointer shrink-0"
          >
            {loadRemoteImages ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Block Images</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Load Remote Images</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Sandboxed Iframe Container */}
      <div className="rounded-xl border border-slate-800 bg-white shadow-xl overflow-hidden transition-all">
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={processedHtml}
          title="Email Message Content"
          className="w-full border-none transition-all"
          style={{ height: `${iframeHeight}px` }}
        />
      </div>
    </div>
  );
}
