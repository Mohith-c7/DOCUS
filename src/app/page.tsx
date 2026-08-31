"use client";

import React, { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { exportSummaryToPdf } from "@/lib/pdf-export";
import { copyToClipboard } from "@/lib/copy";
import { AuthModal } from "@/components/AuthModal";
import { PastSummariesModal } from "@/components/PastSummariesModal";
import { useToast } from "@/components/ui/Toast";
import { AnimatedContainer } from "@/components/ui/AnimatedContainer";
import {
  TEMPLATE_LABELS,
  LANGUAGE_LABELS,
  SUMMARY_TEMPLATES,
  SUPPORTED_LANGUAGES,
  SummaryTemplate,
  SupportedLanguage,
} from "@/modules/validation/schemas";

const STAGE_LABELS: Record<string, string> = {
  UPLOADED: "Preparing document & verifying file structure...",
  EXTRACTING: "Extracting text using native parser...",
  OCR_PROCESSING: "Running Multimodal OCR on document blocks...",
  NORMALIZING: "Formatting and structure cleanup...",
  SUMMARIZING: "Generating AI summary with Gemini...",
  COMPLETED: "Summary generation complete!",
  FAILED: "Document processing failed.",
};

interface SummaryItem {
  id: string;
  documentId: string;
  length: "SHORT" | "MEDIUM" | "LONG";
  title: string;
  summary: string;
  keyPoints: string[];
  mainIdeas: string[];
  processingVersion: string;
  createdAt: string;
}

export default function Home() {
  const { toast } = useToast();

  // User Auth & Session States
  const [user, setUser] = useState<User | null>(null);
  const [anonymousSessionId, setAnonymousSessionId] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPastSummariesOpen, setIsPastSummariesOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("signup");

  // Input State
  const [file, setFile] = useState<File | null>(null);
  const [summaryLength, setSummaryLength] = useState<"SHORT" | "MEDIUM" | "LONG">("MEDIUM");
  const [summaryTemplate, setSummaryTemplate] = useState<SummaryTemplate>("general");
  const [summaryLanguage, setSummaryLanguage] = useState<SupportedLanguage>("en");

  // Processing States
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling] = useState(false);

  // Document context
  const [docId, setDocId] = useState<string | null>(null);
  const [docStage, setDocStage] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<SummaryItem | null>(null);
  const [, setSummariesList] = useState<SummaryItem[]>([]);
  const [generatingAlternative, setGeneratingAlternative] = useState(false);

  // Share
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Errors & Drag UI
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // References
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Device Auto-Recognition
  const [deviceData, setDeviceData] = useState<{
    deviceRecognized: boolean;
    ipAddress?: string;
    documentsCount: number;
    recentDocuments: Array<{ id: string; originalFileName: string; summaries?: Array<{ title: string; summary: string }> }>;
  } | null>(null);

  useEffect(() => {
    document.title = "Docus — Professional AI Document Summarizer & Analytics";
    let localAnonId = localStorage.getItem("docus_anon_session_id");
    if (!localAnonId) {
      localAnonId = crypto.randomUUID();
      localStorage.setItem("docus_anon_session_id", localAnonId);
    }
    const anonId = localAnonId;
    setTimeout(() => setAnonymousSessionId(anonId), 0);

    // Device IP & Session Handshake
    fetch("/api/auth/device-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousSessionId: anonId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.anonymousSessionId) {
          localStorage.setItem("docus_anon_session_id", data.anonymousSessionId);
          setAnonymousSessionId(data.anonymousSessionId);
        }
        if (data.documentsCount > 0) {
          setDeviceData(data);
        }
      })
      .catch(() => {});

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  const updateUrlParams = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) { url.searchParams.set("docId", id); }
    else { url.searchParams.delete("docId"); }
    window.history.replaceState({}, "", url.toString());
  };

  const generateAlternateSummary = async (
    id: string,
    targetLength: "SHORT" | "MEDIUM" | "LONG",
    targetTemplate: SummaryTemplate = summaryTemplate,
    targetLanguage: SupportedLanguage = summaryLanguage
  ) => {
    setGeneratingAlternative(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${id}/summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ length: targetLength, template: targetTemplate, language: targetLanguage }),
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to generate ${targetLength} summary.`);
      }
      const data = await response.json();
      const newSummary = data.summary;
      setSummariesList((prev) => {
        const filtered = prev.filter((s) => s.length !== targetLength);
        return [...filtered, newSummary];
      });
      setActiveSummary(newSummary);
      toast.success(`Generated ${targetLength.toLowerCase()} summary!`);
    } catch (err) {
      setError((err as Error).message || "Failed to generate alternative summary.");
      toast.error("Failed to update summary.");
    } finally {
      setGeneratingAlternative(false);
    }
  };

  const fetchSummaries = async (id: string, selectLength: "SHORT" | "MEDIUM" | "LONG") => {
    try {
      const response = await fetch(`/api/documents/${id}/summaries`);
      if (!response.ok) throw new Error("Failed to load summaries list.");
      const data = await response.json();
      const list = data.summaries || [];
      const match = list.find((s: SummaryItem) => s.length === selectLength);
      if (match) { setActiveSummary(match); }
      else { generateAlternateSummary(id, selectLength); }
    } catch {
      toast.error("Failed to retrieve document summaries.");
    }
  };

  const fetchStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/status`);
      if (!response.ok) throw new Error(`Server returned status check error: ${response.status}`);
      const statusData = await response.json();
      setDocStage(statusData.currentStage);
      retryCountRef.current = 0;
      if (statusData.status === "COMPLETED") {
        setPolling(false);
        fetchSummaries(id, summaryLength);
      } else if (statusData.status === "FAILED") {
        setPolling(false);
        setError("Document processing failed during background processing.");
      } else {
        pollingTimerRef.current = setTimeout(() => fetchStatus(id), 1500);
      }
    } catch {
      retryCountRef.current += 1;
      if (retryCountRef.current > 5) {
        setPolling(false);
        setError("Connection lost. Please refresh the page.");
      } else {
        pollingTimerRef.current = setTimeout(() => fetchStatus(id), 2500);
      }
    }
  };

  useEffect(() => {
    return () => { if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current); };
  }, []);

  const validateFile = (selectedFile: File) => {
    setValidationError(null);
    const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedMimeTypes.includes(selectedFile.type)) {
      setValidationError("Unsupported format. Please upload a PDF or image file (.png, .jpeg, .jpg, .webp).");
      return false;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setValidationError("File is too large. Maximum supported size is 50 MB.");
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (validateFile(selected)) setFile(selected);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setValidationError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const payload = {
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          fileSizeBytes: file.size,
          fileData: base64Data,
          anonymousSessionId: anonymousSessionId || undefined,
          userId: user?.id || undefined,
          template: summaryTemplate,
          language: summaryLanguage,
          length: summaryLength,
        };

        const response = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error?.message || errJson.message || "Failed to upload file.");
        }
        const data = await response.json();
        const id = data.document.id;
        setDocId(id);
        updateUrlParams(id);
        setDocStage(data.document.currentStage);
        setUploading(false);
        setPolling(true);
        fetchStatus(id);
      } catch (err) {
        setError((err as Error).message || "Upload error.");
        setUploading(false);
      }
    };

    reader.onerror = () => {
      setError("Failed to read file from local disk.");
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleCopyText = (text: string) => {
    copyToClipboard(text);
    toast.success("Copied to clipboard!");
  };

  const handleShare = async () => {
    if (!docId) return;
    try {
      const res = await fetch(`/api/documents/${docId}/share`, { method: "POST" });
      const data = await res.json();
      if (data.shareId) {
        setShareUrl(`${window.location.origin}/s/${data.shareId}`);
        setShowShareModal(true);
      }
    } catch {
      toast.error("Failed to generate share link");
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-surface-secondary)", display: "flex", flexDirection: "column" }}>
      {/* Navbar Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 28px", height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px",
            background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
            borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)"
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>Docus</span>
            <span className="badge badge-brand" style={{ marginLeft: "8px", fontSize: "10px" }}>AI 2.0</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {user && (
            <a href="/dashboard" className="btn btn-ghost" style={{ fontSize: "13px" }}>
              📊 Dashboard
            </a>
          )}
          <button className="btn btn-ghost" onClick={() => setIsPastSummariesOpen(true)} style={{ fontSize: "13px" }}>
            🕒 Past Summaries
          </button>

          {user ? (
            <button className="btn btn-secondary" onClick={() => supabase.auth.signOut().then(() => setUser(null))} style={{ fontSize: "13px" }}>
              Sign out
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => { setAuthModalMode("signup"); setIsAuthModalOpen(true); }} style={{ fontSize: "13px" }}>
              Create Account
            </button>
          )}
        </div>
      </header>

      {/* Hero & Upload Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 24px" }}>
        {!docId && (
          <AnimatedContainer animation="fade-up" style={{ width: "100%", maxWidth: "620px" }}>
            {/* Device Auto-Recognition Notification Banner */}
            {deviceData && deviceData.documentsCount > 0 && (
              <div style={{
                marginBottom: "28px",
                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                border: "1px solid #c7d2fe",
                borderRadius: "12px",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
                boxShadow: "0 2px 10px rgba(79, 70, 229, 0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: "var(--color-brand)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "15px", flexShrink: 0, fontWeight: 700,
                  }}>
                    ⚡
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                      Session Restored
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: 0 }}>
                      {deviceData.documentsCount} saved summaries linked to this device
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  {deviceData.recentDocuments[0] && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                      onClick={() => {
                        setDocId(deviceData.recentDocuments[0].id);
                        fetchStatus(deviceData.recentDocuments[0].id);
                      }}
                    >
                      View Recent →
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: "12px", padding: "6px 10px" }}
                    onClick={() => setIsPastSummariesOpen(true)}
                  >
                    History
                  </button>
                </div>
              </div>
            )}

            {/* Header Title */}
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--color-brand-light)", color: "var(--color-brand)", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700, marginBottom: "16px" }}>
                <span>✨ Multilingual AI Summarizer & Analytics</span>
              </div>
              <h1 style={{ fontSize: "36px", fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.035em", marginBottom: "10px", lineHeight: 1.15 }}>
                Transform Any Document Into Clean AI Summaries
              </h1>
              <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", maxWidth: "520px", margin: "0 auto" }}>
                Upload PDFs, reports, or image scans to extract structured key points, executive takeaways, and interactive Q&A in seconds.
              </p>
            </div>

            {/* Form Card */}
            <div className="card card-elevated" style={{ padding: "32px" }}>
              <form onSubmit={handleUploadSubmit}>
                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragOver(false);
                    if (e.dataTransfer.files?.[0] && validateFile(e.dataTransfer.files[0])) setFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragOver ? "var(--color-brand)" : file ? "var(--color-success)" : "var(--color-border-strong)"}`,
                    borderRadius: "12px", padding: "40px 24px", textAlign: "center", cursor: "pointer",
                    background: file ? "var(--color-success-bg)" : isDragOver ? "var(--color-brand-light)" : "var(--color-surface-secondary)",
                    marginBottom: "24px", transition: "all 0.2s ease"
                  }}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "4px" }}>{file.name}</p>
                      <p style={{ fontSize: "12px", color: "var(--color-success)", fontWeight: 600 }}>
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ width: "48px", height: "48px", background: "#ffffff", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid var(--color-border)" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "4px" }}>
                        Click to upload or drag & drop file
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                        PDF, PNG, JPEG, or WebP up to 50 MB
                      </p>
                    </div>
                  )}
                </div>

                {validationError && (
                  <div className="alert alert-danger" style={{ marginBottom: "20px" }}>
                    <span>⚠️ {validationError}</span>
                  </div>
                )}

                {/* Options Grid */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "28px" }}>
                  {/* Summary Detail Level */}
                  <div>
                    <label className="form-label">Summary Detail Level</label>
                    <div className="option-grid">
                      {(["SHORT", "MEDIUM", "LONG"] as const).map((len) => (
                        <button
                          key={len}
                          type="button"
                          className={`option-chip ${summaryLength === len ? "selected" : ""}`}
                          onClick={() => setSummaryLength(len)}
                        >
                          {len === "SHORT" ? "⚡ Short" : len === "MEDIUM" ? "📝 Medium" : "🔍 Detailed"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template selection */}
                  <div>
                    <label className="form-label">Summary Domain Style</label>
                    <div className="option-grid">
                      {SUMMARY_TEMPLATES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`option-chip ${summaryTemplate === t ? "selected" : ""}`}
                          onClick={() => setSummaryTemplate(t)}
                        >
                          {TEMPLATE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language selection */}
                  <div>
                    <label className="form-label">Output Language</label>
                    <div className="option-grid">
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <button
                          key={l}
                          type="button"
                          className={`option-chip ${summaryLanguage === l ? "selected" : ""}`}
                          onClick={() => setSummaryLanguage(l)}
                        >
                          {LANGUAGE_LABELS[l]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={!file || uploading} className="btn btn-primary" style={{ width: "100%", padding: "13px", fontSize: "15px" }}>
                  {uploading ? (
                    <>
                      <span className="spinner" />
                      <span>Uploading & Preparing...</span>
                    </>
                  ) : (
                    "Generate AI Summary →"
                  )}
                </button>
              </form>
            </div>
          </AnimatedContainer>
        )}

        {/* Failure Error Display */}
        {error && !polling && (
          <AnimatedContainer animation="scale-in" style={{ width: "100%", maxWidth: "540px", textAlign: "center", margin: "0 auto" }}>
            <div className="card card-elevated" style={{ padding: "40px 32px" }}>
              <div style={{ width: "56px", height: "56px", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger-border)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "24px" }}>
                ⚠️
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "8px" }}>
                Document Processing Failure
              </h3>
              <p style={{ fontSize: "14px", color: "var(--color-danger)", marginBottom: "28px", lineHeight: 1.5, background: "var(--color-danger-bg)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--color-danger-border)" }}>
                {error}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDocId(null);
                  setActiveSummary(null);
                  setError(null);
                  setPolling(false);
                  setFile(null);
                }}
              >
                Try Another Document →
              </button>
            </div>
          </AnimatedContainer>
        )}

        {/* Processing State Progress Card */}
        {docId && polling && !activeSummary && !error && (
          <AnimatedContainer animation="scale-in" style={{ width: "100%", maxWidth: "500px", textAlign: "center" }}>
            <div className="card card-elevated" style={{ padding: "48px 36px" }}>
              <div className="page-spinner" style={{ margin: "0 auto 24px" }} />
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "10px" }}>
                Analyzing Document...
              </h3>
              <p style={{ fontSize: "14px", color: "var(--color-brand)", fontWeight: 600, marginBottom: "20px" }}>
                {STAGE_LABELS[docStage || "UPLOADED"]}
              </p>
              <div style={{ background: "var(--color-surface-tertiary)", borderRadius: "9999px", height: "6px", width: "100%", overflow: "hidden" }}>
                <div style={{ background: "var(--color-brand)", height: "100%", width: "70%", borderRadius: "9999px" }} className="animate-pulse" />
              </div>
            </div>
          </AnimatedContainer>
        )}

        {/* Summary Result View */}
        {docId && activeSummary && (
          <AnimatedContainer animation="fade-up" style={{ width: "100%", maxWidth: "840px" }}>
            <div className="card card-elevated" style={{ padding: "36px" }}>
              {/* Summary Header Toolbar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", borderBottom: "1px solid var(--color-border)", paddingBottom: "20px" }}>
                <div>
                  <span className="badge badge-brand" style={{ marginBottom: "6px" }}>
                    {activeSummary.length} Detail Summary
                  </span>
                  <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
                    {activeSummary.title}
                  </h2>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button className="btn btn-secondary" style={{ fontSize: "12px" }} onClick={handleShare}>
                    🔗 Share Link
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: "12px" }} onClick={() => handleCopyText(activeSummary.summary)}>
                    📋 Copy Text
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: "12px" }}
                    onClick={() =>
                      exportSummaryToPdf({
                        title: activeSummary.title,
                        summary: activeSummary.summary,
                        keyPoints: activeSummary.keyPoints,
                        mainIdeas: activeSummary.mainIdeas,
                        length: activeSummary.length,
                        originalFileName: file?.name,
                      })
                    }
                  >
                    📥 Export PDF
                  </button>
                  {user && (
                    <a href={`/documents/${docId}`} className="btn btn-secondary" style={{ fontSize: "12px" }}>
                      💬 Chat Q&A →
                    </a>
                  )}
                </div>
              </div>

              {/* Length Switcher Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", background: "var(--color-surface-tertiary)", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)" }}>Detail Density</span>
                <div className="tab-bar">
                  {(["SHORT", "MEDIUM", "LONG"] as const).map((len) => (
                    <button
                      key={len}
                      disabled={generatingAlternative}
                      className={`tab-item ${activeSummary.length === len ? "tab-active" : ""}`}
                      onClick={() => {
                        setSummaryLength(len);
                        fetchSummaries(docId, len);
                      }}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* Executive Summary */}
              <div style={{ marginBottom: "32px" }}>
                <div className="section-label">Executive Summary</div>
                <div style={{ fontSize: "15px", lineHeight: 1.75, color: "var(--color-text-primary)", background: "#ffffff", padding: "20px 24px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
                  {activeSummary.summary}
                </div>
              </div>

              {/* Key Takeaways */}
              <div style={{ marginBottom: "32px" }}>
                <div className="section-label">Key Takeaways & Points</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {activeSummary.keyPoints?.map((pt, i) => (
                    <div key={i} style={{ display: "flex", gap: "12px", background: "var(--color-surface-secondary)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--color-border)", fontSize: "14px", color: "var(--color-text-primary)" }}>
                      <span style={{ fontWeight: 800, color: "var(--color-brand)" }}>0{i + 1}.</span>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Concepts */}
              <div>
                <div className="section-label">Core Concepts & Themes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {activeSummary.mainIdeas?.map((idea, i) => (
                    <div key={i} style={{ padding: "8px 14px", background: "var(--color-brand-light)", color: "var(--color-brand)", border: "1px solid var(--color-brand-muted)", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}>
                      💡 {idea}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "36px", paddingTop: "20px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setDocId(null);
                    setActiveSummary(null);
                    setFile(null);
                    updateUrlParams(null);
                  }}
                >
                  ← Summarize Another Document
                </button>
                <span className="meta-text">ID: {activeSummary.documentId.slice(0, 8)}...</span>
              </div>
            </div>
          </AnimatedContainer>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="card card-elevated" style={{ padding: "28px", maxWidth: "460px", width: "100%" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "8px" }}>Share Summary</h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "18px" }}>
              Anyone with this link can view the generated summary and key takeaways.
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <input type="text" className="share-input" readOnly value={shareUrl || ""} />
              <button className="btn btn-primary" onClick={() => handleCopyText(shareUrl || "")}>Copy</button>
            </div>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setShowShareModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} defaultMode={authModalMode} anonymousSessionId={anonymousSessionId} onSuccess={(u) => setUser(u as User)} />
      <PastSummariesModal isOpen={isPastSummariesOpen} onClose={() => setIsPastSummariesOpen(false)} userId={user?.id} anonymousSessionId={anonymousSessionId} onSelectDocument={(id) => { setDocId(id); fetchStatus(id); }} />
    </main>
  );
}
