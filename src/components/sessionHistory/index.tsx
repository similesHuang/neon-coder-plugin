import { useEffect, useState } from "react";
import getVSCodeInstance from "../../hooks/useVscode";
import { formatTime } from "../../utils";
import "./index.css";

interface SessionData {
  id: string;
  title: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
}

const vs = getVSCodeInstance();

const SessionHistory = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载会话历史
  const loadSessions = () => {
    setLoading(true);
    vs.postMessage({
      command: "loadChatSessions",
    });
  };

  // 处理会话点击
  const handleSessionClick = (sessionId: string) => {
    vs.postMessage({
      command: "switchSession",
      sessionId,
    });
    setIsOpen(false); // 切换会话后关闭弹窗
  };

  // 处理会话删除
  const handleDeleteSession = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    vs.postMessage({
      command: "deleteSession",
      sessionId,
    });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case "toggleSessionHistory":
          console.log("切换会话历史显示状态");
          setIsOpen((prev) => {
            const newState = !prev;
            if (newState) {
              loadSessions();
            }
            return newState;
          });
          break;

        case "chatSessionsLoaded":
          console.log("会话历史加载完成:", message.sessions);
          setSessions(message.sessions || []);
          setLoading(false);
          break;

        case "sessionSwitched":
          console.log("会话切换成功:", message.session);
          break;

        case "sessionDeleted":
          console.log("会话删除成功");
          setSessions(message.sessions || []);
          break;
      }
    };

    // 监听来自插件的消息
    window.addEventListener("message", handleMessage);

    // 清理监听器
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // ...existing code...

  return (
    <>
      {isOpen && (
        <div className="session-history-overlay">
          <div className="session-history-modal">
            <div className="session-history-header">
              <h3>会话历史</h3>
              <button
                className="close-button"
                onClick={() => setIsOpen(false)}
                title="关闭"
              >
                ×
              </button>
            </div>

            <div className="session-history-content">
              {loading ? (
                <div className="loading-container">
                  <div className="loading-text">加载中...</div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="empty-container">
                  <div className="empty-text">暂无会话历史</div>
                </div>
              ) : (
                <div className="session-list">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="session-item"
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <div className="session-main">
                        <div
                          className="session-title"
                          title={session.title || "未命名会话"}
                        >
                          {session.title || "未命名会话"}
                        </div>
                        <div className="session-meta">
                          <span className="session-messages-count">
                            {session.messages?.length || 0} 条
                          </span>
                          <span className="session-time">
                            {formatTime(session.updatedAt || session.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        className="delete-button"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        title="删除会话"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionHistory;
