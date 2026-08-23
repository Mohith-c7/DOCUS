"use client";

import React, { useState, useEffect, useRef } from "react";

// Stage mapping to human readable status messages
const STAGE_LABELS: Record<string, string> = {
  UPLOADED: "Preparing document and verifying files...",
  EXTRACTING: "Extracting text using native parser...",
  OCR_PROCESSING: "Running OCR engine on scanned blocks...",
  NORMALIZING: "Formatting and structure cleanup...",
  SUMMARIZING: "Running AI summarization engine...",
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
  // Input State
  const [file, setFile] = useState<File | null>(null);
  const [summaryLength, setSummaryLength] = useState<"SHORT" | "MEDIUM" | "LONG">("MEDIUM");
  
  // Processing States
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling] = useState(false);
  
  // Document context
  const [docId, setDocId] = useState<string | null>(null);
  const [docStage, setDocStage] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<SummaryItem | null>(null);
  const [summariesList, setSummariesList] = useState<SummaryItem[]>([]);
  const [generatingAlternative, setGeneratingAlternative] = useState(false);

  // Errors
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Interaction UI
  const [isDragOver, setIsDragOver] = useState(false);
  
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // Helper to update the browser URL search parameters
  const updateUrlParams = (id: string | null) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set("docId", id);
      } else {
        url.searchParams.delete("docId");
      }
      window.history.pushState({}, "", url.toString());
    }
  };

  // Generate an alternative summary length
  const generateAlternateSummary = async (id: string, length: "SHORT" | "MEDIUM" | "LONG") => {
    setGeneratingAlternative(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${id}/summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ length }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to generate summary.");
      }

      const data = await response.json();
      const newSummary = data.summary;

      setSummariesList((prev) => {
        // Ensure no duplicates in state list
        const filtered = prev.filter((s) => s.length !== length);
        return [...filtered, newSummary];
      });
      setActiveSummary(newSummary);
    } catch (err) {
      console.error(err);
      setError(`Failed to generate ${length.toLowerCase()} summary: ${(err as Error).message}`);
    } finally {
      setGeneratingAlternative(false);
    }
  };

  // Fetch summaries list for completed document
  const fetchSummaries = async (id: string, selectLength: "SHORT" | "MEDIUM" | "LONG") => {
    try {
      const response = await fetch(`/api/documents/${id}/summaries`);
      if (!response.ok) {
        throw new Error("Failed to load summaries list.");
      }
      const data = await response.json();
      const list = data.summaries || [];
      setSummariesList(list);

      // Find summary matching length
      const match = list.find((s: SummaryItem) => s.length === selectLength);
      if (match) {
        setActiveSummary(match);
      } else {
        // If not found (e.g. on page refresh if we want a length other than MEDIUM), request generation
        generateAlternateSummary(id, selectLength);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to retrieve document summaries.");
    }
  };

  // Poll status endpoint
  const fetchStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/status`);
      if (!response.ok) {
        throw new Error(`Server returned status check error: ${response.status}`);
      }

      const statusData = await response.json();
      setDocStage(statusData.currentStage);
      retryCountRef.current = 0; // Reset network errors count

      if (statusData.status === "COMPLETED") {
        setPolling(false);
        // Load generated summaries list
        fetchSummaries(id, summaryLength);
      } else if (statusData.status === "FAILED") {
        setPolling(false);
        setError("Document processing failed during the background pipeline. Please try uploading another document.");
      } else {
        // Keep polling
        pollingTimerRef.current = setTimeout(() => fetchStatus(id), 1500);
      }
    } catch (err) {
      console.error("Polling error:", err);
      retryCountRef.current += 1;
      
      if (retryCountRef.current > 5) {
        setPolling(false);
        setError("Lost connection to processing server. Please refresh the page to try retrieving the document.");
      } else {
        // Retry polling soon
        pollingTimerRef.current = setTimeout(() => fetchStatus(id), 2500);
      }
    }
  };

  // Clean polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  // Sync state with URL parameter for page refresh resiliency
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDocId = params.get("docId");
    
    if (urlDocId && urlDocId !== docId) {
      // Async state update using setTimeout to prevent synchronous cascading renders inside effect
      setTimeout(() => {
        setDocId(urlDocId);
        setPolling(true);
        setError(null);
        retryCountRef.current = 0;
        fetchStatus(urlDocId);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // File selection validation
  const validateFile = (selectedFile: File) => {
    setValidationError(null);

    const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimeTypes.includes(selectedFile.type)) {
      setValidationError("Unsupported file format. Please select a PDF or an Image (.png, .jpeg, .jpg).");
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setValidationError("File is too large. Maximum supported size is 10MB.");
      return false;
    }

    if (selectedFile.size === 0) {
      setValidationError("The selected file is empty. Please select a valid document.");
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (validateFile(selected)) {
        setFile(selected);
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (validateFile(selected)) {
        setFile(selected);
      }
    }
  };

  // Upload handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setValidationError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to upload file to processing pipeline.");
      }

      const data = await response.json();
      const id = data.document.id;
      
      setDocId(id);
      updateUrlParams(id);
      setDocStage(data.document.currentStage);
      setUploading(false);
      setPolling(true);
      
      // Start polling status
      fetchStatus(id);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || "An unexpected error occurred during upload.");
      setUploading(false);
    }
  };

  // Alternate length request click handler
  const handleLengthSwitch = (length: "SHORT" | "MEDIUM" | "LONG") => {
    if (!docId || generatingAlternative) return;
    setSummaryLength(length);

    const match = summariesList.find((s) => s.length === length);
    if (match) {
      setActiveSummary(match);
    } else {
      generateAlternateSummary(docId, length);
    }
  };

  // Reset to initial state for new uploads
  const handleUploadAnother = () => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
    }
    setFile(null);
    setDocId(null);
    setDocStage(null);
    setActiveSummary(null);
    setSummariesList([]);
    setPolling(false);
    setUploading(false);
    setGeneratingAlternative(false);
    setError(null);
    setValidationError(null);
    updateUrlParams(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header Bar */}
      <header className="border-b border-slate-200 bg-white shadow-xs py-4 px-6 sm:px-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            D
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">DocuSum</h1>
            <p className="text-xs text-slate-500 font-medium">AI Document Summary Assistant</p>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono hidden sm:block">
          Pipeline v1.0
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-col flex-1 items-center justify-center py-10 px-6 sm:px-12 max-w-5xl w-full mx-auto">
        {error && (
          <div className="mb-6 w-full p-4 border-l-4 border-red-500 bg-red-50 rounded-r-md text-red-800 text-sm shadow-xs flex justify-between items-start gap-4">
            <div>
              <h4 className="font-semibold text-red-900">Error Encountered</h4>
              <p className="mt-1 font-medium">{error}</p>
            </div>
            <button
              onClick={handleUploadAnother}
              className="text-xs font-bold text-red-700 hover:text-red-900 underline uppercase tracking-wider shrink-0"
            >
              Upload Another
            </button>
          </div>
        )}

        {/* UPLOAD SCREEN */}
        {!docId && !uploading && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs w-full max-w-2xl p-6 sm:p-10">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight text-center">
              Generate Structured Summaries
            </h2>
            <p className="text-sm text-slate-500 text-center mt-1 mb-8 max-w-md mx-auto">
              Upload a digital PDF, scanned document, or text image. Our intelligence pipeline handles layout extraction, OCR routing, and structures the summary.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-indigo-600 bg-indigo-50/50"
                    : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                }`}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                {/* SVG Icon */}
                <svg
                  className="w-12 h-12 text-slate-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                  ></path>
                </svg>

                {file ? (
                  <div className="text-center">
                    <p className="font-semibold text-slate-800 text-sm max-w-xs truncate mx-auto">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split("/")[1].toUpperCase()}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-semibold text-slate-700 text-sm">
                      Drag & drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports PDF, PNG, JPG, JPEG (up to 10MB)
                    </p>
                  </div>
                )}
              </div>

              {validationError && (
                <div className="p-3 bg-amber-50 text-amber-800 text-xs border border-amber-200 rounded-md font-medium text-center">
                  {validationError}
                </div>
              )}

              {/* Summary Length Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Summary Detail Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "SHORT", title: "Short", desc: "1-2 sentence overview and key points." },
                    { id: "MEDIUM", title: "Medium", desc: "Paragraph summary with core themes." },
                    { id: "LONG", title: "Long", desc: "Detailed summary and deep concept lists." },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSummaryLength(opt.id as "SHORT" | "MEDIUM" | "LONG")}
                      className={`p-3 border text-left rounded-lg transition-all ${
                        summaryLength === opt.id
                          ? "border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <h4 className="font-bold text-slate-800 text-sm">{opt.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-snug">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!file}
                className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide shadow-xs transition-all ${
                  file
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                Upload and Summarize
              </button>
            </form>
          </div>
        )}

        {/* UPLOADING & POLLING PROGRESS SCREEN */}
        {(uploading || polling) && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs w-full max-w-md p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative w-16 h-16">
                {/* Rotating Spinner */}
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-800">
                {uploading ? "Uploading Document..." : "Processing Document Pipeline"}
              </h3>
              <p className="text-sm text-slate-500">
                {uploading
                  ? "Writing file bytes to storage repository..."
                  : STAGE_LABELS[docStage || "UPLOADED"] || "Executing pipeline steps..."}
              </p>
            </div>

            {/* Stages Visual Progression */}
            {!uploading && (
              <div className="border-t border-slate-100 pt-4 text-left space-y-3">
                {[
                  { key: "EXTRACTING", label: "Text Extraction" },
                  { key: "NORMALIZING", label: "Format Normalization" },
                  { key: "SUMMARIZING", label: "AI Summary Generation" },
                ].map((step, idx) => {
                  const stages = ["UPLOADED", "EXTRACTING", "OCR_PROCESSING", "NORMALIZING", "SUMMARIZING", "COMPLETED", "FAILED"];
                  const currentIdx = stages.indexOf(docStage || "UPLOADED");
                  const stepIdx = stages.indexOf(step.key);

                  // Specialized checks for OCR fallbacks
                  const isCurrent = currentIdx === stepIdx || (step.key === "EXTRACTING" && docStage === "OCR_PROCESSING");
                  const isDone = currentIdx > stepIdx && docStage !== "FAILED";

                  return (
                    <div key={step.key} className="flex items-center gap-3 text-xs font-semibold">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                          isDone
                            ? "bg-emerald-100 text-emerald-700"
                            : isCurrent
                            ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500/20"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <span
                        className={
                          isDone
                            ? "text-slate-500 line-through decoration-slate-300"
                            : isCurrent
                            ? "text-indigo-600 font-bold"
                            : "text-slate-400"
                        }
                      >
                        {step.label}
                        {isCurrent && docStage === "OCR_PROCESSING" && " (OCR fallback)"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RESULTS SCREEN */}
        {docId && !polling && activeSummary && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs w-full p-6 sm:p-10 space-y-8">
            {/* Title / Action bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-4">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 py-1 px-2.5 rounded-full border border-emerald-200">
                  Ready
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight mt-2.5">
                  {activeSummary.title}
                </h2>
              </div>
              <button
                onClick={handleUploadAnother}
                className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md font-bold text-xs bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-2xs w-full sm:w-auto shrink-0"
              >
                Upload New
              </button>
            </div>

            {/* Length Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Detail Level:
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-200/60 p-1 rounded-md">
                {(["SHORT", "MEDIUM", "LONG"] as const).map((len) => (
                  <button
                    key={len}
                    onClick={() => handleLengthSwitch(len)}
                    disabled={generatingAlternative}
                    className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md font-bold text-xs transition-all ${
                      summaryLength === len
                        ? "bg-white text-indigo-600 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
              {generatingAlternative && (
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 sm:ml-auto">
                  <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  Generating alternative...
                </div>
              )}
            </div>

            {/* Main Structured output display */}
            <div className="space-y-6">
              {/* Summary Paragraph */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Summary
                </h3>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                  {activeSummary.summary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Key Points */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Key Points
                  </h3>
                  <ul className="space-y-2.5">
                    {activeSummary.keyPoints.map((point: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-sm text-slate-600 leading-relaxed font-medium">
                        <span className="text-indigo-600 text-xs shrink-0 select-none mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Main Ideas */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Main Ideas
                  </h3>
                  <div className="space-y-2">
                    {activeSummary.mainIdeas.map((idea: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-normal font-medium hover:border-slate-300 transition-colors"
                      >
                        {idea}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
