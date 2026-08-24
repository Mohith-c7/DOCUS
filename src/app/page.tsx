"use client";

import React, { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { exportSummaryToPdf } from "@/lib/pdf-export";
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
  UPLOADED: "Preparing document and verifying files...",
  EXTRACTING: "Extracting text using native parser...",
  OCR_PROCESSING: "Running OCR on scanned document blocks...",
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
  const [summaryLength] = useState<"SHORT" | "MEDIUM" | "LONG">("MEDIUM");
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
  const [, setGeneratingAlternative] = useState(false);

  // Share
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Errors & Drag UI
  const [, setError] = useState<string | null>(null);
  const [, setValidationError] = useState<string | null>(null);
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
      toast.success("Summary updated!");
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

    const formData = new FormData();
    formData.append("file", file);
    if (anonymousSessionId) formData.append("anonymousSessionId", anonymousSessionId);
    if (user?.id) formData.append("userId", user.id);

    try {
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to upload file.");
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

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
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
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 24px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", background: "var(--color-brand)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-primary)" }}>Docus AI</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {user && (
            <a href="/dashboard" className="btn btn-ghost" style={{ fontSize: "13px", padding: "7px 13px" }}>
              Dashboard
            </a>
          )}
          <button className="btn btn-ghost" onClick={() => setIsPastSummariesOpen(true)} style={{ fontSize: "13px", padding: "7px 13px" }}>
            Past Summaries
          </button>

          {user ? (
            <button className="btn btn-secondary" onClick={() => supabase.auth.signOut().then(() => setUser(null))} style={{ fontSize: "13px", padding: "7px 13px" }}>
              Sign out
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => { setAuthModalMode("signup"); setIsAuthModalOpen(true); }} style={{ fontSize: "13px", padding: "7px 14px" }}>
              Create account
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        {/* Upload Form */}
        {!docId && (
          <AnimatedContainer animation="fade-up" style={{ width: "100%", maxWidth: "560px" }}>
            {/* Device Auto-Recognition Notification Banner */}
            {deviceData && deviceData.documentsCount > 0 && (
              <div style={{
                marginBottom: "24px",
                background: "#f4f5fd",
                border: "1px solid #dcdfe6",
                borderRadius: "8px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "6px",
                    background: "var(--color-brand)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", flexShrink: 0, fontWeight: 700,
                  }}>
                    ⚡
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Device Recognized
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: 0 }}>
                      {deviceData.documentsCount} saved summary available on this device
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {deviceData.recentDocuments[0] && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "12px", padding: "5px 10px" }}
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
                    style={{ fontSize: "12px", padding: "5px 8px" }}
                    onClick={() => setIsPastSummariesOpen(true)}
                  >
                    History
                  </button>
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: "8px" }}>
                Instant Document Summaries
              </h1>
              <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
                Upload any document to get a structured AI summary in seconds.
              </p>
            </div>

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
                  borderRadius: "8px", padding: "32px 24px", textAlign: "center", cursor: "pointer",
                  background: file ? "var(--color-success-bg)" : "white", marginBottom: "20px",
                }}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                {file ? (
                  <p style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{file.name}</p>
                ) : (
                  <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>Drop PDF or image here, or click to browse</p>
                )}
              </div>

              {/* Template selection */}
              <div style={{ marginBottom: "16px" }}>
                <label className="form-label">Summary Style / Domain</label>
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
              <div style={{ marginBottom: "24px" }}>
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

              <button type="submit" disabled={!file || uploading} className="btn btn-primary" style={{ width: "100%", padding: "12px", fontSize: "14px" }}>
                {uploading ? "Uploading..." : "Generate Summary"}
              </button>
            </form>
          </AnimatedContainer>
        )}

        {/* Processing State */}
        {docId && polling && !activeSummary && (
          <AnimatedContainer animation="scale-in" style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
            <div className="card" style={{ padding: "40px 32px" }}>
              <div className="page-spinner" style={{ margin: "0 auto 20px" }} />
              <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Processing Document...</h3>
              <p style={{ fontSize: "13px", color: "var(--color-brand)" }}>{STAGE_LABELS[docStage || "UPLOADED"]}</p>
            </div>
          </AnimatedContainer>
        )}

        {/* Summary Result */}
        {docId && activeSummary && (
          <AnimatedContainer animation="fade-up" style={{ width: "100%", maxWidth: "760px" }}>
            <div className="card" style={{ padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700 }}>{activeSummary.title}</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" style={{ fontSize: "12px" }} onClick={handleShare}>🔗 Share</button>
                  <button className="btn btn-secondary" style={{ fontSize: "12px" }} onClick={() => handleCopyText(activeSummary.summary)}>Copy</button>
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
                    Export PDF
                  </button>
                  {user && (
                    <a href={`/documents/${docId}`} className="btn btn-secondary" style={{ fontSize: "12px" }}>
                      Chat Q&A →
                    </a>
                  )}
                </div>
              </div>

              <div className="section-label">Executive Summary</div>
              <p style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--color-text-primary)", marginBottom: "24px" }}>
                {activeSummary.summary}
              </p>

              <div className="section-label">Key Takeaways</div>
              <ul style={{ paddingLeft: "20px", marginBottom: "24px", color: "var(--color-text-secondary)" }}>
                {activeSummary.keyPoints?.map((pt, i) => (
                  <li key={i} style={{ marginBottom: "6px" }}>{pt}</li>
                ))}
              </ul>

              <div className="section-label">Core Concepts</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {activeSummary.mainIdeas?.map((idea, i) => (
                  <div key={i} style={{ padding: "6px 12px", background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", borderRadius: "6px", fontSize: "12px" }}>
                    {idea}
                  </div>
                ))}
              </div>
            </div>
          </AnimatedContainer>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ padding: "24px", maxWidth: "440px", width: "100%" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>Share Summary</h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input type="text" className="form-input" readOnly value={shareUrl || ""} />
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
