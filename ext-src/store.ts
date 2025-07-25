import * as vscode from "vscode";
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatStore {
  sessions: ChatSession[];
  currentSessionId?: string;
}

export class ChatStorageManager {
  private context: vscode.ExtensionContext;
  private readonly STORAGE_KEY = "neon-coder-chat-data";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  async getChatStore(): Promise<ChatStore> {
    const stored = await this.context.globalState.get<ChatStore>(
      this.STORAGE_KEY
    );
    return stored || { sessions: [] };
  }

  async saveChatStore(chatStore: ChatStore): Promise<void> {
    await this.context.globalState.update(this.STORAGE_KEY, chatStore);
  }

  async createSession(title?: string): Promise<ChatSession> {
    const chatStore = await this.getChatStore();
    const newSession: ChatSession = {
      id: Math.random().toString(36).slice(2),
      title: title || `聊天 ${chatStore.sessions.length + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    chatStore.sessions.unshift(newSession);
    chatStore.currentSessionId = newSession.id;
    await this.saveChatStore(chatStore);
    return newSession;
  }
  // 获取当前会话
  async getCurrentSession(): Promise<ChatSession | null> {
    const chatStore = await this.getChatStore();
    if (!chatStore.currentSessionId) return null;

    return (
      chatStore.sessions.find((s) => s.id === chatStore.currentSessionId) ||
      null
    );
  }

  // 添加消息到当前会话
  async addMessage(message: ChatMessage): Promise<void> {
    const chatStore = await this.getChatStore();
    let currentSession = await this.getCurrentSession();

    if (!currentSession) {
      currentSession = await this.createSession();
    }

    currentSession.messages.push(message);
    currentSession.updatedAt = Date.now();

    // 自动生成标题（用第一条用户消息的前20个字符）
    if (currentSession.messages.length === 1 && message.role === "user") {
      currentSession.title = message.content.slice(0, 20) + "...";
    }

    await this.saveChatStore(chatStore);
  }

  // 切换会话
  async switchSession(sessionId: string): Promise<ChatSession | null> {
    const chatStore = await this.getChatStore();
    const session = chatStore.sessions.find((s) => s.id === sessionId);
    if (session) {
      chatStore.currentSessionId = sessionId;
      await this.saveChatStore(chatStore);
    }
    return session || null;
  }

  // 删除会话
  async deleteSession(sessionId: string): Promise<void> {
    const chatStore = await this.getChatStore();
    chatStore.sessions = chatStore.sessions.filter((s) => s.id !== sessionId);

    if (chatStore.currentSessionId === sessionId) {
      chatStore.currentSessionId = chatStore.sessions[0]?.id;
    }

    await this.saveChatStore(chatStore);
  }

  // 清空所有会话
  async clearAllSessions(): Promise<void> {
    await this.saveChatStore({ sessions: [] });
  }
}
