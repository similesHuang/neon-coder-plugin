// ext-src/messagChannel.ts
import * as vscode from "vscode";
import { getCurrentFileInfo } from "./files";
import { chatService } from "./service";
import { ChatStorageManager } from "./store";

let storageManager: ChatStorageManager;

export function setupMessageChannel(
  webviewView: vscode.WebviewView,
  context: vscode.ExtensionContext
) {
  storageManager = new ChatStorageManager(context);
  console.log("Setting up message channel...");

  webviewView.webview.onDidReceiveMessage(async (message) => {
    console.log("Received message from webview:", message);
    switch (message.command) {
      case "loadChatSessions": {
        try {
          const chatStore = await storageManager.getChatStore();
          webviewView.webview.postMessage({
            command: "chatSessionsLoaded",
            sessions: chatStore.sessions,
            currentSessionId: chatStore.currentSessionId,
          });
        } catch (error) {
          console.error("Error loading chat sessions:", error);
        }
        break;
      }

      case "createNewSession": {
        try {
          const title = message.title || "新对话";
          console.log("Creating new session with title:", title);

          const newSession = await storageManager.createNewSession(title);
          await storageManager.setCurrentSessionId(newSession.id);

          webviewView.webview.postMessage({
            command: "sessionCreated",
            session: newSession,
          });

          console.log("New session created:", newSession.id);
        } catch (error) {
          console.error("Error creating new session:", error);
        }
        break;
      }

      case "switchSession": {
        try {
          const session = await storageManager.switchSession(message.sessionId);

          // 获取完整的会话状态
          const chatStore = await storageManager.getChatStore();

          webviewView.webview.postMessage({
            command: "sessionSwitched",
            session,
            chatStore, // 返回完整状态以保持同步
          });
        } catch (error) {
          console.error("Error switching session:", error);
        }
        break;
      }

      case "saveMessage": {
        try {
          await storageManager.addMessage(message.message);

          // 保存消息后，返回更新的当前会话信息
          const currentSession = await storageManager.getCurrentSession();
          webviewView.webview.postMessage({
            command: "messageSaved",
            success: true,
            currentSession, // 返回更新后的会话
          });
        } catch (error) {
          console.error("Error saving message:", error);
          webviewView.webview.postMessage({
            command: "messageSaved",
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      case "deleteSession": {
        try {
          await storageManager.deleteSession(message.sessionId);
          const chatStore = await storageManager.getChatStore();
          webviewView.webview.postMessage({
            command: "sessionDeleted",
            sessions: chatStore.sessions,
            currentSessionId: chatStore.currentSessionId,
            chatStore, // 返回完整状态
          });
        } catch (error) {
          console.error("Error deleting session:", error);
        }
        break;
      }

      case "syncState": {
        try {
          const chatStore = await storageManager.getChatStore();
          const currentSession = await storageManager.getCurrentSession();

          webviewView.webview.postMessage({
            command: "stateSync",
            chatStore,
            currentSession,
          });
        } catch (error) {
          console.error("Error syncing state:", error);
        }
        break;
      }

      case "getCurrentSession": {
        try {
          const currentSession = await storageManager.getCurrentSession();
          webviewView.webview.postMessage({
            command: "currentSessionLoaded",
            session: currentSession,
          });
        } catch (error) {
          console.error("Error getting current session:", error);
        }
        break;
      }

      case "streamRequest": {
        try {
          const { messages, requestId } = message;

          // 获取配置并初始化chatService
          const config = await storageManager.getAppConfig();
          await chatService.initialize({
            apiKey: config.apiKey,
            model: config.currentModel || "claude-4-sonnet",
          });

          let aborted = false;
          let fullContent = "";

          // 监听中断请求
          const abortListener = webviewView.webview.onDidReceiveMessage(
            (msg) => {
              if (
                msg.command === "abortStream" &&
                msg.requestId === requestId
              ) {
                aborted = true;
                abortListener.dispose();
                webviewView.webview.postMessage({
                  command: "streamAbort",
                  requestId,
                });
              }
            }
          );

          // 开始流式聊天
          const start = Date.now();

          (async () => {
            try {
              for await (const response of chatService.streamChat(messages)) {
                if (aborted) break;

                if (response.error) {
                  if (!aborted) {
                    webviewView.webview.postMessage({
                      command: "streamError",
                      requestId,
                      error: response.error,
                    });
                  }
                  break;
                }

                if (response.isComplete) {
                  const end = Date.now();
                  console.log(`一轮回复时间采集 ${end - start}ms`);
                  if (!aborted) {
                    webviewView.webview.postMessage({
                      command: "streamComplete",
                      requestId,
                      fullContent,
                    });
                  }
                  break;
                }

                if (response.content && !aborted) {
                  fullContent += response.content;
                  webviewView.webview.postMessage({
                    command: "streamChunk",
                    requestId,
                    chunk: response.content,
                    fullContent,
                  });
                }
              }
            } catch (error) {
              if (!aborted) {
                webviewView.webview.postMessage({
                  command: "streamError",
                  requestId,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            } finally {
              abortListener.dispose();
            }
          })();
        } catch (error) {
          console.error("Error in stream request:", error);
          webviewView.webview.postMessage({
            command: "streamError",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      case "getCurrentFileInfo": {
        try {
          const fileInfo = getCurrentFileInfo();
          webviewView.webview.postMessage({
            command: "currentFileInfo",
            fileInfo,
          });
        } catch (error) {
          console.error("Error getting current file info:", error);
          webviewView.webview.postMessage({
            command: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      // 获取配置
      case "getConfig": {
        try {
          const config = await storageManager.getAppConfig();
          webviewView.webview.postMessage({
            command: "configLoaded",
            config,
          });
        } catch (error) {
          console.error("Error loading config:", error);
          webviewView.webview.postMessage({
            command: "configError",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      // 保存配置
      case "saveConfig": {
        try {
          await storageManager.saveAppConfig(message.config);
          webviewView.webview.postMessage({
            command: "configSaved",
            success: true,
          });
          console.log("✅ Configuration saved successfully");
        } catch (error) {
          console.error("Error saving config:", error);
          webviewView.webview.postMessage({
            command: "configError",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      // 更新当前模型
      case "setCurrentModel": {
        try {
          await storageManager.setCurrentModel(message.model);
          const config = await storageManager.getAppConfig();
          webviewView.webview.postMessage({
            command: "configLoaded",
            config,
          });
        } catch (error) {
          console.error("Error setting current model:", error);
          webviewView.webview.postMessage({
            command: "configError",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      // 更新API Key
      case "setApiKey": {
        try {
          await storageManager.setApiKey(message.apiKey);
          const config = await storageManager.getAppConfig();
          webviewView.webview.postMessage({
            command: "configLoaded",
            config,
          });
        } catch (error) {
          console.error("Error setting API key:", error);
          webviewView.webview.postMessage({
            command: "configError",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      // 从命令设置API Key
      case "setApiKeyFromCommand": {
        try {
          await storageManager.setApiKey(message.apiKey);
          const config = await storageManager.getAppConfig();
          webviewView.webview.postMessage({
            command: "configLoaded",
            config,
          });
        } catch (error) {
          console.error("Error setting API key from command:", error);
          webviewView.webview.postMessage({
            command: "configError",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      default:
        break;
    }
  });
  webviewView.onDidDispose(() => {
    console.log("Webview view disposed, cleaning up message channel.");
    chatService?.dispose();
  });
}
