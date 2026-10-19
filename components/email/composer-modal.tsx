"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useComposer } from "./composer-context";
import { useAccountContext } from "@/components/shared/account-context";
import { sendEmailAction } from "@/lib/actions/send";
import {
  X,
  Minus,
  Maximize2,
  Paperclip,
  Send,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Code,
  Quote,
  Type,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface AttachmentFile {
  filename: string;
  mimeType: string;
  size: number;
  content: string; // Base64 string
}

export function ComposerModal() {
  const router = useRouter();
  const { isOpen, replyContext, closeComposer } = useComposer();
  const { accounts, activeAccountId } = useAccountContext();

  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [ccInput, setCcInput] = useState<string>("");
  const [bccInput, setBccInput] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [bodyText, setBodyText] = useState<string>("");
  const [isRichText, setIsRichText] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize or reset composer state when opened
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setIsMinimized(false);

    if (replyContext) {
      // Context-aware reply workflow: lock to receiving account and original sender
      setSelectedAccountId(replyContext.accountId);
      setToInput(replyContext.to.join(", "));
      if (replyContext.cc && replyContext.cc.length > 0) {
        setCcInput(replyContext.cc.join(", "));
        setShowCc(true);
      }
      setSubject(
        replyContext.subject.toLowerCase().startsWith("re:")
          ? replyContext.subject
          : `Re: ${replyContext.subject}`
      );
      setBodyText("\n\n");
    } else {
      // Brand new message
      const defaultAccId =
        activeAccountId !== "all"
          ? activeAccountId
          : accounts.length > 0
          ? accounts[0].id
          : "";
      setSelectedAccountId(defaultAccId);
      setToInput("");
      setCcInput("");
      setBccInput("");
      setSubject("");
      setBodyText("");
      setAttachments([]);
    }
  }, [isOpen, replyContext, activeAccountId, accounts]);

  if (!isOpen) return null;

  const currentAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime/type;base64,
        const base64 = result.split(",")[1] || "";
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            content: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormat = (command: string, value: string = "") => {
    if (!isRichText) return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleSend = async () => {
    if (!currentAccount) {
      setErrorMessage("Please select an active Resend account.");
      return;
    }

    const recipients = toInput
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (recipients.length === 0) {
      setErrorMessage("Please specify at least one recipient email address.");
      return;
    }

    const ccRecipients = ccInput
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const bccRecipients = bccInput
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    let finalHtml = "";
    let finalText = "";

    if (isRichText && editorRef.current) {
      finalHtml = editorRef.current.innerHTML;
      finalText = editorRef.current.innerText;
    } else {
      finalText = bodyText;
      finalHtml = `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #1e293b;">${bodyText.replace(
        /\n/g,
        "<br/>"
      )}</div>`;
    }

    setIsSending(true);
    setErrorMessage(null);

    const res = await sendEmailAction({
      accountId: currentAccount.id,
      threadId: replyContext?.threadId,
      fromEmail: currentAccount.defaultFromEmail,
      fromName: currentAccount.defaultFromName || undefined,
      to: recipients,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
      subject: subject || "(No Subject)",
      htmlBody: finalHtml,
      textBody: finalText,
      inReplyTo: replyContext?.inReplyTo,
      references: replyContext?.references,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        mimeType: a.mimeType,
        size: a.size,
      })),
    });

    setIsSending(false);

    if (res.success) {
      closeComposer();
      router.refresh();
    } else {
      setErrorMessage(res.error || "Failed to dispatch email.");
    }
  };

  return (
    <div
      className={`fixed bottom-0 right-4 sm:right-8 z-50 transition-all duration-200 shadow-2xl rounded-t-2xl border border-slate-700 bg-slate-900 flex flex-col ${
        isMinimized ? "w-80 h-12" : "w-[94vw] sm:w-[600px] h-[580px]"
      }`}
    >
      {/* Header Bar */}
      <div className="h-12 px-4 bg-slate-800 rounded-t-2xl border-b border-slate-700 flex items-center justify-between select-none">
        <span className="font-semibold text-xs text-white truncate max-w-[320px]">
          {replyContext ? `Reply: ${subject}` : "New Message"}
        </span>

        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={closeComposer}
            className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden text-xs">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-2.5 mx-3 mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          {/* Sender & Recipients Section */}
          <div className="p-3 space-y-2 border-b border-slate-800">
            {/* From Account Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium w-12 shrink-0">
                From:
              </span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={Boolean(replyContext)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} ({acc.defaultFromEmail})
                  </option>
                ))}
              </select>
            </div>

            {/* To Input */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium w-12 shrink-0">
                To:
              </span>
              <input
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                placeholder="recipient@example.com (comma separated)"
                className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="hover:text-slate-200"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="hover:text-slate-200"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* Cc Input */}
            {showCc && (
              <div className="flex items-center gap-2 animate-in fade-in duration-100">
                <span className="text-slate-400 font-medium w-12 shrink-0">
                  Cc:
                </span>
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="cc@example.com"
                  className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
            )}

            {/* Bcc Input */}
            {showBcc && (
              <div className="flex items-center gap-2 animate-in fade-in duration-100">
                <span className="text-slate-400 font-medium w-12 shrink-0">
                  Bcc:
                </span>
                <input
                  type="text"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  placeholder="bcc@example.com"
                  className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
            )}

            {/* Subject Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-slate-400 font-medium w-12 shrink-0">
                Subject:
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject of the email..."
                className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="h-9 px-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleFormat("bold")}
                className="p-1 hover:bg-slate-800 hover:text-white rounded"
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat("italic")}
                className="p-1 hover:bg-slate-800 hover:text-white rounded"
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat("underline")}
                className="p-1 hover:bg-slate-800 hover:text-white rounded"
                title="Underline"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>
              <span className="h-3 w-px bg-slate-800 mx-1" />
              <button
                type="button"
                onClick={() => handleFormat("insertUnorderedList")}
                className="p-1 hover:bg-slate-800 hover:text-white rounded"
                title="Bullet List"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat("insertOrderedList")}
                className="p-1 hover:bg-slate-800 hover:text-white rounded"
                title="Numbered List"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat("formatBlock", "blockquote")}
                className="p-1 hover:bg-slate-800 hover:text-white rounded"
                title="Quote"
              >
                <Quote className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRichText(!isRichText)}
                className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {isRichText ? "Rich Text" : "Plain Text"}
              </button>
            </div>
          </div>

          {/* Email Body Area */}
          <div className="flex-1 p-3 overflow-y-auto bg-slate-900/50">
            {isRichText ? (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="w-full h-full min-h-[160px] text-slate-100 focus:outline-none font-sans leading-relaxed text-xs"
                data-placeholder="Write your email here..."
              />
            ) : (
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Write your message here..."
                className="w-full h-full min-h-[160px] bg-transparent resize-none text-slate-100 placeholder-slate-500 font-mono focus:outline-none"
              />
            )}
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="p-2 border-t border-slate-800 bg-slate-950 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-300 flex items-center gap-2"
                >
                  <Paperclip className="h-3 w-3 text-indigo-400" />
                  <span className="truncate max-w-[140px]">{file.filename}</span>
                  <span className="text-[9px] text-slate-500">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="text-slate-400 hover:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Attach Files"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Ctrl+Enter to send
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeComposer}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white font-medium shadow-md shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Transmitting...</span>
                  </>
                ) : (
                  <>
                    <span>Send Message</span>
                    <Send className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
