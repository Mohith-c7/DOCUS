import React, { useState } from 'react';

interface ChatMessageProps {
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt?: string;
}

export function ChatMessage({ role, content, createdAt }: ChatMessageProps) {
  const isUser = role === 'USER';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '16px' }}>
      {!isUser && (
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ✨ Docus AI
        </span>
      )}

      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'} style={{ position: 'relative' }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>

        {!isUser && (
          <button
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            style={{ marginTop: '8px', fontSize: '10px', padding: '2px 6px' }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px', paddingLeft: '4px', paddingRight: '4px' }}>
        {formattedTime}
      </span>
    </div>
  );
}
