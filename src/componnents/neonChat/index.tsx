import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import useChat from "../../hooks/useChat";
import type { Message } from "../../types/chat";
import "./index.css";

const EXAMPLE_PROMPTS = ["基础架构前端应用"];

const NeonChat: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    isLoading,
    isStreaming,
    error,
    handleInputChange,
    handleSubmit,
    setInput,
    stop,
    append,
  } = useChat({
    api: "/api/llm/chat",
  });

  const chatStarted = messages.length > 0;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Example prompt click handler
  const handleExampleClick = (text: string) => {
    setInput(text);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent);
    }, 0);
  };

  return (
    <div className="neon-chat-container">
      <div className="chat-messages" ref={scrollRef}>
        {!chatStarted && (
          <div className="welcome-screen">
            <h1 className="welcome-title">Neon Coder</h1>
            <p className="welcome-subtitle">
              让你的想法闪耀，AI 编程助手为你服务。
            </p>
            <div className="example-prompts">
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  className="example-prompt-button"
                  onClick={() => handleExampleClick(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((msg: Message) => {
          if (msg?.role !== "user") {
            return (
              <div key={msg?.id} className="assistant-message">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {msg?.content || ""}
                </ReactMarkdown>
              </div>
            );
          }
          return (
            <div key={msg?.id} className="user-message">
              <span className="user-message-content">{msg?.content}</span>
            </div>
          );
        })}

        {(isLoading || isStreaming) &&
          !messages.some((msg) => msg.role === "assistant" && msg.content) && (
            <div className="loading-indicator">
              <span>{isLoading ? "正在思考中" : "正在生成回答"}</span>
              <span className="loading-dots">...</span>
            </div>
          )}
      </div>

      <div className="chat-input-container">
        <div className="input-wrapper">
          <textarea
            className="chat-textarea"
            placeholder="发送消息..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            rows={2}
            disabled={isLoading}
          />
          <div className="input-buttons">
            {isStreaming ? (
              <button onClick={stop} className="stop-button" title="停止生成">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="button-icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="8" height="8" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className={`send-button ${
                  input.trim() && !isLoading ? "active" : "disabled"
                }`}
                title="发送消息"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="button-icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NeonChat;
