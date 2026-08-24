"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";

interface Message {
  id?: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt?: string;
}

interface QAPanelProps {
  documentId: string;
  documentTitle: string;
}

export function QAPanel({ documentId, documentTitle }: QAPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentStreamToken, setCurrentStreamToken] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fetch initial history
  useEffect(() => {
    fetch(`/api/documents/${documentId}/qa`)
      .then((res) => res.json())
      .then((data) => {
        if (data.session) {
          setSessionId(data.session.id);
          setMessages(data.session.messages || []);
        }
      })
      .catch(() => {});
  }, [documentId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStreamToken]);

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || streaming) return;

    const userMessageText = textToSend.trim();
    setInput("");

    // Add user message optimistically
    setMessages((prev) => [...prev, { role: "USER", content: userMessageText }]);
    setStreaming(true);
    setCurrentStreamToken("");

    try {
      const res = await fetch(`/api/documents/${documentId}/qa/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessageText, sessionId }),
      });

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "session") {
                setSessionId(data.sessionId);
              } else if (data.type === "token") {
                fullText += data.token;
                setCurrentStreamToken(fullText);
              } else if (data.type === "done") {
                setMessages((prev) => [...prev, { role: "ASSISTANT", content: fullText }]);
                setCurrentStreamToken("");
              } else if (data.type === "error") {
                setMessages((prev) => [...prev, { role: "ASSISTANT", content: `Error: ${data.message}` }]);
                setCurrentStreamToken("");
              }
            } catch {
              // ignore parse errors for partial json
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ASSISTANT", content: "Failed to connect to Q&A assistant." }]);
    } finally {
      setStreaming(false);
      setCurrentStreamToken("");
    }
  };

  const sampleQuestions = [
    "Summarize the main points of this document.",
    "What are the key dates or deadlines mentioned?",
    "Who are the main parties involved?",
  ];

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
          💬 Document Q&A
        </h3>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Ask questions in real-time</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="scroll-panel" style={{ flex: 1, padding: "20px" }}>
        {messages.length === 0 && !streaming ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "20px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🤖</div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "4px" }}>Ask anything about this document</p>
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "20px" }}>
              Gemini AI will search the document and answer accurately.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "320px" }}>
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  className="btn btn-secondary"
                  style={{ fontSize: "12px", textAlign: "left", justifyContent: "flex-start", padding: "8px 12px" }}
                  onClick={() => handleSend(q)}
                >
                  &quot;{q}&quot;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <ChatMessage key={index} role={msg.role} content={msg.content} createdAt={msg.createdAt} />
            ))}

            {streaming && currentStreamToken && (
              <ChatMessage role="ASSISTANT" content={currentStreamToken} />
            )}
            <div ref={chatBottomRef} />
          </>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)", display: "flex", gap: "8px" }}
      >
        <input
          type="text"
          className="form-input"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button type="submit" className="btn btn-primary" disabled={streaming || !input.trim()}>
          {streaming ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
