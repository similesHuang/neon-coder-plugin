import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import useChat from "../../hooks/useChat";
import useFile from "../../hooks/useFile";
import type { Message } from "../../types/chat";
import "./index.css";
import "./md.css";

const EXAMPLE_PROMPTS = ["mcp工具调用"];

const NeonChat: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { currentFile, fileList } = useFile();
  useEffect(() => {
    console.log("Current File:", currentFile);
  }, [currentFile]);
  const {
    messages,
    input,
    isLoading,
    isStreaming,
    error,
    currentSessionId,
    handleInputChange,
    handleSubmit,
    setInput,
    stop,
    append,
    createNewSession,
  } = useChat({
    api: "/api/llm/chat",
  });

  const chatStarted = messages.length > 0;
  console.log("Current Session ID:", currentSessionId);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleExampleClick = (text: string) => {
    setInput(text);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent);
    }, 0);
  };

  // 插入当前文件内容到输入框
  // const handleInsertCurrentFile = () => {
  //   if (currentFile && currentFile.hasFile) {
  //     const fileContext = `\n\n**当前文件: ${currentFile.fileName}** (${currentFile.languageId})\n\`\`\`${currentFile.languageId}\n${currentFile.fullText}\n\`\`\`\n\n`;
  //     setInput(input + fileContext);
  //   }
  // };

  // 插入选中内容到输入框
  // const handleInsertSelection = () => {
  //   if (selectedText && selectedText.trim()) {
  //     const selectionContext = `\n\n**选中的代码** (${languageId}):\n\`\`\`${languageId}\n${selectedText}\n\`\`\`\n\n`;
  //     setInput(input + selectionContext);
  //   }
  // };

  return (
    <div className="neon-chat-container">
      <div className="chat-messages" ref={scrollRef}>
        {!chatStarted && (
          <div className="welcome-screen">
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
                  components={{
                    pre: ({ children, ...props }) => {
                      const codeRef = useRef<HTMLPreElement>(null);
                      const handleCopy = async () => {
                        if (codeRef.current) {
                          const codeText = codeRef.current.textContent || "";
                          try {
                            await navigator.clipboard.writeText(codeText);
                            // 可以添加一个成功提示
                            console.log("代码已复制");
                          } catch (err) {
                            console.error("复制失败:", err);
                          }
                        }
                      };

                      return (
                        <div className="code-block-container">
                          <div className="code-block-header">
                            <button
                              className="copy-button"
                              onClick={handleCopy}
                              title="复制代码"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z" />
                              </svg>
                            </button>
                          </div>
                          <pre
                            ref={codeRef}
                            className="markdown-pre"
                            {...props}
                          >
                            {children}
                          </pre>
                        </div>
                      );
                    },
                    // 自定义内联代码组件
                    code: ({ children, className, ...props }) => (
                      <code
                        className={`markdown-code ${className || ""}`}
                        {...props}
                      >
                        {children}
                      </code>
                    ),
                    // 自定义段落组件
                    p: ({ children, ...props }) => (
                      <p className="markdown-p" {...props}>
                        {children}
                      </p>
                    ),
                    // 自定义标题组件
                    h1: ({ children, ...props }) => (
                      <h1 className="markdown-h1" {...props}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children, ...props }) => (
                      <h2 className="markdown-h2" {...props}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children, ...props }) => (
                      <h3 className="markdown-h3" {...props}>
                        {children}
                      </h3>
                    ),
                    h4: ({ children, ...props }) => (
                      <h4 className="markdown-h4" {...props}>
                        {children}
                      </h4>
                    ),
                    h5: ({ children, ...props }) => (
                      <h5 className="markdown-h5" {...props}>
                        {children}
                      </h5>
                    ),
                    h6: ({ children, ...props }) => (
                      <h6 className="markdown-h6" {...props}>
                        {children}
                      </h6>
                    ),
                    // 自定义链接组件
                    a: ({ children, ...props }) => (
                      <a className="markdown-link" {...props}>
                        {children}
                      </a>
                    ),
                    // 自定义列表组件
                    ul: ({ children, ...props }) => (
                      <ul className="markdown-ul" {...props}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }) => (
                      <ol className="markdown-ol" {...props}>
                        {children}
                      </ol>
                    ),
                    li: ({ children, ...props }) => (
                      <li className="markdown-li" {...props}>
                        {children}
                      </li>
                    ),
                    // 自定义引用块组件
                    blockquote: ({ children, ...props }) => (
                      <blockquote className="markdown-blockquote" {...props}>
                        {children}
                      </blockquote>
                    ),
                    // 自定义表格组件
                    table: ({ children, ...props }) => (
                      <table className="markdown-table" {...props}>
                        {children}
                      </table>
                    ),
                    th: ({ children, ...props }) => (
                      <th className="markdown-th" {...props}>
                        {children}
                      </th>
                    ),
                    td: ({ children, ...props }) => (
                      <td className="markdown-td" {...props}>
                        {children}
                      </td>
                    ),
                  }}
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
          <div className="file-info-bar">
            <div className="file-info">
              {currentFile?.hasFile && <span>{currentFile.fileName}</span>}
            </div>
            <div className="file-actions">
              <button className="file-action-button" title="插入文件内容">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="action-icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00-.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01.142-3.667l3-3z" />
                  <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01-.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00.225-5.865z" />
                </svg>
                添加上下文
              </button>
            </div>
          </div>

          <textarea
            className="chat-textarea"
            placeholder="按回车发送消息..."
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
