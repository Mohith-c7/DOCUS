"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import { CollectionsSidebar } from "@/components/dashboard/CollectionsSidebar";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { useToast } from "@/components/ui/Toast";

interface DocumentItem {
  id: string;
  originalFileName: string;
  fileType: string;
  fileSizeBytes: number;
  status: string;
  createdAt: string;
  summaries?: Array<{ length: string; title: string }>;
}

interface CollectionItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  _count: { documents: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loadingCols, setLoadingCols] = useState(true);

  const [stats, setStats] = useState({ totalDocuments: 0, totalSummaries: 0 });
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Check auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/");
      } else {
        setUser(data.user);
        setLoadingUser(false);
      }
    });
  }, [router]);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    // Fetch Stats
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});

    // Fetch Collections
    setLoadingCols(true);
    fetch(`/api/collections?userId=${user.id}`)
      .then((res) => res.json())
      .then((data) => setCollections(data.collections || []))
      .catch(() => toast.error("Failed to load collections"))
      .finally(() => setLoadingCols(false));
  }, [user, toast]);

  // Fetch Documents when user or activeCollection changes
  useEffect(() => {
    if (!user) return;

    setLoadingDocs(true);
    let url = `/api/documents?userId=${user.id}`;
    if (activeCollection) {
      url += `&collectionId=${activeCollection}`;
    }

    fetch(url)
      .then((res) => res.json())
      .then((data) => setDocuments(data.documents || []))
      .catch(() => toast.error("Failed to load documents"))
      .finally(() => setLoadingDocs(false));
  }, [user, activeCollection, toast]);

  const handleCreateCollection = async () => {
    const name = prompt("Enter collection name:");
    if (!name || !name.trim()) return;

    try {
      const res = await fetch(`/api/collections?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCollections((prev) => [...prev, data.collection]);
        toast.success("Collection created!");
      }
    } catch {
      toast.error("Failed to create collection");
    }
  };

  const handleAddToCollection = async (docId: string) => {
    if (collections.length === 0) {
      toast.info("Create a collection first!");
      handleCreateCollection();
      return;
    }

    const colName = prompt(
      `Add to which collection?\nAvailable:\n${collections.map((c) => `- ${c.name}`).join("\n")}`
    );
    if (!colName) return;

    const target = collections.find((c) => c.name.toLowerCase() === colName.trim().toLowerCase());
    if (!target) {
      toast.error("Collection not found");
      return;
    }

    try {
      const res = await fetch(`/api/collections/${target.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      if (res.ok) {
        toast.success(`Added to ${target.name}`);
        // Refresh collections count
        setCollections((prev) =>
          prev.map((c) =>
            c.id === target.id
              ? { ...c, _count: { documents: (c._count?.documents || 0) + 1 } }
              : c
          )
        );
      }
    } catch {
      toast.error("Failed to add to collection");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const filteredDocs = documents.filter((doc) =>
    doc.originalFileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const docsThisMonth = documents.filter((d) => {
    const date = new Date(d.createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  if (loadingUser) {
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => router.push("/")}>
          <div style={{
            width: "32px", height: "32px", background: "var(--color-brand)", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-primary)" }}>Docus Dashboard</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>{user.email}</span>
          <button className="btn btn-primary" style={{ fontSize: "13px", padding: "6px 14px" }} onClick={() => router.push("/")}>
            + Upload New
          </button>
          <button className="btn btn-secondary" style={{ fontSize: "13px", padding: "6px 14px" }} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div style={{ flex: 1, display: "flex", maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "32px 24px", gap: "32px" }}>
        {/* Left Sidebar */}
        <CollectionsSidebar
          collections={collections}
          activeCollection={activeCollection}
          onSelectCollection={setActiveCollection}
          onCreateCollection={handleCreateCollection}
          loading={loadingCols}
        />

        {/* Right Area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatsBar
            totalDocuments={stats.totalDocuments || documents.length}
            totalSummaries={stats.totalSummaries || documents.length}
            documentsThisMonth={docsThisMonth}
          />

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "16px" }}>
            <input
              type="text"
              placeholder="Search documents..."
              className="form-input"
              style={{ maxWidth: "320px" }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Grid */}
          {loadingDocs ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="card" style={{ padding: "48px", textAlign: "center" }}>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "8px" }}>No documents found</p>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "16px" }}>Upload a PDF or image to get started.</p>
              <button className="btn btn-primary" onClick={() => router.push("/")}>Upload Document</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onSelect={(id) => router.push(`/documents/${id}`)}
                  onAddToCollection={handleAddToCollection}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
