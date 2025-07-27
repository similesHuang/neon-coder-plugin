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

  async createNewSession(title?: string): Promise<ChatSession> {
    const chatStore = await this.getChatStore();
    const newSession: ChatSession = {
      id: Math.random().toString(36).slice(2),
      title: title || `新对话 ${chatStore.sessions.length + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    chatStore.sessions.unshift(newSession);

    chatStore.currentSessionId = newSession.id;

    await this.saveChatStore(chatStore);

    console.log(
      `Created new session: ${newSession.id} with title: ${newSession.title}`
    );
    return newSession;
  }

  async setCurrentSessionId(sessionId: string): Promise<void> {
    const chatStore = await this.getChatStore();

    const sessionExists = chatStore.sessions.some(
      (session) => session.id === sessionId
    );

    if (!sessionExists) {
      throw new Error(`Session with ID ${sessionId} does not exist`);
    }

    chatStore.currentSessionId = sessionId;
    await this.saveChatStore(chatStore);

    console.log(`Set current session to: ${sessionId}`);
  }

  async getCurrentSessionId(): Promise<string | undefined> {
    const chatStore = await this.getChatStore();
    return chatStore.currentSessionId;
  }

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
      currentSession = await this.createNewSession();
    }

    currentSession.messages.push(message);
    currentSession.updatedAt = Date.now();

    if (currentSession.messages.length === 1 && message.role === "user") {
      currentSession.title = message.content.slice(0, 60) + "...";
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

  async deleteSession(sessionId: string): Promise<void> {
    const chatStore = await this.getChatStore();
    chatStore.sessions = chatStore.sessions.filter((s) => s.id !== sessionId);

    if (chatStore.currentSessionId === sessionId) {
      chatStore.currentSessionId = chatStore.sessions[0]?.id;
    }

    await this.saveChatStore(chatStore);
  }

  async clearAllSessions(): Promise<void> {
    await this.saveChatStore({ sessions: [] });
  }

  async updateSessionTitle(sessionId: string, newTitle: string): Promise<void> {
    const chatStore = await this.getChatStore();
    const session = chatStore.sessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new Error(`Session with ID ${sessionId} does not exist`);
    }

    session.title = newTitle;
    session.updatedAt = Date.now();

    await this.saveChatStore(chatStore);
    console.log(`Updated session ${sessionId} title to: ${newTitle}`);
  }

  async getSessionById(sessionId: string): Promise<ChatSession | null> {
    const chatStore = await this.getChatStore();
    return chatStore.sessions.find((s) => s.id === sessionId) || null;
  }
}
