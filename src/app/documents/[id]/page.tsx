"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { exportSummaryToPdf } from "@/lib/pdf-export";
import { copyToClipboard } from "@/lib/copy";
import { QAPanel } from "@/components/chat/QAPanel";
import {
  TEMPLATE_LABELS,
  LANGUAGE_LABELS,
  SUMMARY_TEMPLATES,
  SUPPORTED_LANGUAGES,
  SummaryTemplate,
  SupportedLanguage,
} from "@/modules/validation/schemas";
import { useToast } from "@/components/ui/Toast";

interface SummaryItem {
  id: string;
  length: "SHORT" | "MEDIUM" | "LONG";
  title: string;
  summary: string;
  keyPoints: string[];
  mainIdeas: string[];
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [documentMeta, setDocumentMeta] = useState<Record<string, unknown> | null>(null);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [activeSummary, setActiveSummary] = useState<SummaryItem | null>(null);
  const [summaryLength, setSummaryLength] = useState<"SHORT" | "MEDIUM" | "LONG">("MEDIUM");
  const [summaryTemplate, setSummaryTemplate] = useState<SummaryTemplate>("general");
  const [summaryLanguage, setSummaryLanguage] = useState<SupportedLanguage>("en");

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${id}/status`)
      .then((res) => res.json())
      .then((data) => {
        setDocumentMeta(data);
        if (data.status === "COMPLETED") {
          return fetch(`/api/documents/${id}/summaries`);
        }
      })
      .then((res) => res?.json())
      .then((data) => {
        if (data && data.summaries) {
          setSummaries(data.summaries);
          const match = data.summaries.find((s: SummaryItem) => s.length === summaryLength) || data.summaries[0];
          if (match) setActiveSummary(match);
        }
      })
      .catch(() => toast.error("Failed to load document"))
      .finally(() => setLoading(false));
  }, [id, summaryLength, toast]);

  const handleGenerate = async (
    length: "SHORT" | "MEDIUM" | "LONG",
    template: SummaryTemplate,
    language: SupportedLanguage
  ) => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/documents/${id}/summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ length, template, language }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveSummary(data.summary);
      setSummaries((prev) => {
        const filtered = prev.filter((s) => s.length !== length);
        return [...filtered, data.summary];
      });
      toast.success("Summary updated!");
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/share`, { method: "POST" });
      const data = await res.json();
      if (data.shareId) {
        const fullUrl = `${window.location.origin}/s/${data.shareId}`;
        setShareUrl(fullUrl);
        setShowShareModal(true);
      }
    } catch {
      toast.error("Failed to generate share link");
    }
  };

  const handleCopy = (text: string) => {
    copyToClipboard(text);
    toast.success("Copied to clipboard!");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="page-spinner" />
      </div>
    );
  }

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ padding: "6px 10px" }}>
            ← Back
          </button>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {activeSummary?.title || (documentMeta?.originalFileName as string) || "Document Details"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn btn-secondary" onClick={handleShare} style={{ fontSize: "13px" }}>
            🔗 Share Link
          </button>
          <button
            className="btn btn-primary"
            style={{ fontSize: "13px" }}
            onClick={() => {
              if (activeSummary) {
                exportSummaryToPdf({
                  title: activeSummary.title,
                  summary: activeSummary.summary,
                  keyPoints: activeSummary.keyPoints,
                  mainIdeas: activeSummary.mainIdeas,
                  length: activeSummary.length,
                });
              }
            }}
          >
            Export PDF
          </button>
        </div>
      </header>

      {/* Share Modal */}
      {showShareModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ padding: "24px", maxWidth: "440px", width: "100%" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>Public Share Link</h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "16px" }}>Anyone with this link can view this summary without logging in.</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input type="text" className="form-input" readOnly value={shareUrl || ""} />
              <button className="btn btn-primary" onClick={() => handleCopy(shareUrl || "")}>Copy</button>
            </div>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setShowShareModal(false)}>Done</button>
          </div>
        </div>
      )}

      {/* Main Two-Column View */}
      <div style={{ flex: 1, display: "flex", maxWidth: "1400px", width: "100%", margin: "0 auto", padding: "24px", gap: "24px" }}>
        {/* Left: Summary Panel */}
        <div style={{ flex: "1 1 55%", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Controls Bar */}
          <div className="card" style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}>
            <div className="tab-bar">
              {(["SHORT", "MEDIUM", "LONG"] as const).map((len) => (
                <button
                  key={len}
                  className={`tab-item ${summaryLength === len ? "tab-active" : ""}`}
                  onClick={() => {
                    setSummaryLength(len);
                    const existing = summaries.find((s) => s.length === len);
                    if (existing) {
                      setActiveSummary(existing);
                    } else {
                      handleGenerate(len, summaryTemplate, summaryLanguage);
                    }
                  }}
                >
                  {len}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <select
                className="form-input"
                style={{ fontSize: "12px", padding: "4px 8px" }}
                value={summaryTemplate}
                onChange={(e) => {
                  const t = e.target.value as SummaryTemplate;
                  setSummaryTemplate(t);
                  handleGenerate(summaryLength, t, summaryLanguage);
                }}
              >
                {SUMMARY_TEMPLATES.map((t) => (
                  <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>
                ))}
              </select>

              <select
                className="form-input"
                style={{ fontSize: "12px", padding: "4px 8px" }}
                value={summaryLanguage}
                onChange={(e) => {
                  const l = e.target.value as SupportedLanguage;
                  setSummaryLanguage(l);
                  handleGenerate(summaryLength, summaryTemplate, l);
                }}
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary Card */}
          <div className="card" style={{ padding: "24px", flex: 1 }}>
            {generating ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div className="page-spinner" style={{ margin: "0 auto 16px" }} />
                <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Generating summary with AI...</p>
              </div>
            ) : activeSummary ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div className="section-label" style={{ margin: 0 }}>Executive Summary</div>
                  <button className="copy-btn" onClick={() => handleCopy(activeSummary.summary)}>Copy</button>
                </div>
                <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-text-primary)", marginBottom: "24px" }}>
                  {activeSummary.summary}
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div className="section-label" style={{ margin: 0 }}>Key Takeaways</div>
                  <button className="copy-btn" onClick={() => handleCopy(activeSummary.keyPoints.join("\n"))}>Copy All</button>
                </div>
                <ul style={{ paddingLeft: "20px", marginBottom: "24px", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                  {activeSummary.keyPoints.map((pt, i) => (
                    <li key={i} style={{ marginBottom: "6px" }}>{pt}</li>
                  ))}
                </ul>

                <div className="section-label">Core Concepts</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {activeSummary.mainIdeas.map((idea, i) => (
                    <div key={i} style={{ padding: "6px 12px", background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", borderRadius: "6px", fontSize: "12px" }}>
                      {idea}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Q&A Panel */}
        <div style={{ flex: "1 1 45%", minWidth: 0, height: "calc(100vh - 108px)" }}>
          <QAPanel documentId={id} documentTitle={activeSummary?.title || "Document"} />
        </div>
      </div>
    </main>
  );
}
