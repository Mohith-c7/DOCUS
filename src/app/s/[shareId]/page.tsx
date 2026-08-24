"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface SharedDocData {
  shareId: string;
  originalFileName: string;
  fileType: string;
  createdAt: string;
  title: string;
  summaries: Array<{
    length: string;
    title: string;
    summary: string;
    keyPoints: string[];
    mainIdeas: string[];
  }>;
}

export default function SharedSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.shareId as string;

  const [data, setData] = useState<SharedDocData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLength, setActiveLength] = useState<string>("MEDIUM");

  useEffect(() => {
    fetch(`/api/share/${shareId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Shared summary not found");
        }
        return res.json();
      })
      .then((res) => {
        setData(res.document);
        if (res.document?.title) {
          document.title = `${res.document.title} — Docus Shared Summary`;
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="page-spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--color-surface-secondary)" }}>
        <div className="card" style={{ padding: "32px", textAlign: "center", maxWidth: "420px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Summary Not Available</h2>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "20px" }}>{error || "This shared link is invalid or has been revoked."}</p>
          <button className="btn btn-primary" onClick={() => router.push("/")}>Go to Home Page</button>
        </div>
      </main>
    );
  }

  const currentSummary = data.summaries.find((s) => s.length === activeLength) || data.summaries[0];

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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => router.push("/")}>
          <div style={{
            width: "32px", height: "32px", background: "var(--color-brand)", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-primary)" }}>Docus</span>
        </div>

        <button className="btn btn-primary" style={{ fontSize: "13px" }} onClick={() => router.push("/")}>
          Try Docus Free
        </button>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, maxWidth: "760px", width: "100%", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: "24px" }}>
          <span className="badge badge-brand" style={{ marginBottom: "8px" }}>Public Shared Summary</span>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "4px" }}>{data.title}</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>File: {data.originalFileName}</p>
        </div>

        {/* Tab switcher */}
        {data.summaries.length > 1 && (
          <div className="tab-bar" style={{ marginBottom: "16px" }}>
            {data.summaries.map((s) => (
              <button
                key={s.length}
                className={`tab-item ${activeLength === s.length ? "tab-active" : ""}`}
                onClick={() => setActiveLength(s.length)}
              >
                {s.length}
              </button>
            ))}
          </div>
        )}

        {/* Summary Card */}
        {currentSummary && (
          <div className="card" style={{ padding: "28px", marginBottom: "32px" }}>
            <div className="section-label">Executive Summary</div>
            <p style={{ fontSize: "15px", lineHeight: 1.75, color: "var(--color-text-primary)", marginBottom: "24px" }}>
              {currentSummary.summary}
            </p>

            {currentSummary.keyPoints?.length > 0 && (
              <>
                <div className="section-label">Key Takeaways</div>
                <ul style={{ paddingLeft: "20px", marginBottom: "24px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                  {currentSummary.keyPoints.map((pt, i) => (
                    <li key={i} style={{ marginBottom: "8px" }}>{pt}</li>
                  ))}
                </ul>
              </>
            )}

            {currentSummary.mainIdeas?.length > 0 && (
              <>
                <div className="section-label">Core Concepts</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {currentSummary.mainIdeas.map((idea, i) => (
                    <div key={i} style={{ padding: "8px 14px", background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", borderRadius: "6px", fontSize: "13px" }}>
                      {idea}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Banner */}
        <div className="card" style={{ padding: "24px", background: "var(--color-brand-light)", border: "1px solid var(--color-brand-muted)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "2px" }}>Get your own AI document summaries</h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Upload any PDF or image and get structured summaries in seconds.</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push("/")}>Start for Free →</button>
        </div>
      </div>
    </main>
  );
}
