import OpenAI from "openai";
import * as vscode from "vscode";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  id?: string;
}

export interface ChatConfig {
  model: string;
  apiKey: string;
  baseURL: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface StreamResponse {
  content: string;
  isComplete: boolean;
  error?: string;
}

export class ChatService {
  private openai: OpenAI | null = null;
  private config: ChatConfig;
  private isInitialized = false;

  constructor() {
    this.config = {
      model: "claude-4-sonnet",
      apiKey: "",
      baseURL: "https://llmapi.bilibili.co/v1",
      maxTokens: 8000,
      temperature: 0.7,
      systemPrompt: "你是一个专业的AI编程助手，专门帮助用户解决编程问题。",
    };
  }

  // 初始化服务
  async initialize(config?: Partial<ChatConfig>): Promise<void> {
    try {
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // 从VSCode配置中读取设置
      await this.loadConfigFromVSCode();

      if (!this.config.apiKey) {
        throw new Error("API Key is required");
      }

      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      });

      this.isInitialized = true;
      console.log("ChatService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ChatService:", error);
      throw error;
    }
  }

  // 从VSCode配置加载设置
  private async loadConfigFromVSCode(): Promise<void> {
    const config = vscode.workspace.getConfiguration("neonCoder");

    this.config.model = config.get("model", this.config.model);
    this.config.apiKey = config.get("apiKey", this.config.apiKey);
  }

  // 检查服务是否已初始化
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.openai) {
      throw new Error("ChatService not initialized. Call initialize() first.");
    }
  }

  // 智能上下文控制
  private controlContext(messages: Message[]): Message[] {
    if (!messages || messages.length === 0) return [];

    const maxTokens = this.config.maxTokens || 8000;
    const reservedTokens = 1000; // 为响应预留的token
    const availableTokens = maxTokens - reservedTokens;

    // 分类消息
    const systemMessages = messages.filter((msg) => msg.role === "system");
    const conversationMessages = messages.filter(
      (msg) => msg.role !== "system"
    );

    const result: Message[] = [];
    let tokenCount = 0;

    // 优先添加系统消息
    for (const msg of systemMessages) {
      const tokens = this.estimateTokens(msg.content);
      if (tokenCount + tokens <= availableTokens * 0.2) {
        // 系统消息最多占20%
        result.push(msg);
        tokenCount += tokens;
      }
    }

    // 添加系统提示（如果没有系统消息）
    if (systemMessages.length === 0 && this.config.systemPrompt) {
      const systemTokens = this.estimateTokens(this.config.systemPrompt);
      if (tokenCount + systemTokens <= availableTokens * 0.2) {
        result.push({
          role: "system",
          content: this.config.systemPrompt,
        });
        tokenCount += systemTokens;
      }
    }

    // 从最新消息开始向前添加
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const tokens = this.estimateTokens(msg.content);

      if (tokenCount + tokens <= availableTokens) {
        result.unshift(msg);
        tokenCount += tokens;
      } else {
        break;
      }
    }

    // 如果还有空间且有被截断的消息，添加摘要
    if (
      conversationMessages.length >
      result.filter((m) => m.role !== "system").length
    ) {
      const truncatedMessages = conversationMessages.slice(
        0,
        conversationMessages.length -
          result.filter((m) => m.role !== "system").length
      );
      const summary = this.summarizeMessages(truncatedMessages);
      const summaryTokens = this.estimateTokens(summary);

      if (tokenCount + summaryTokens <= availableTokens) {
        result.splice(systemMessages.length, 0, {
          role: "system",
          content: `[历史对话摘要]: ${summary}`,
        });
      }
    }

    console.log(
      `Context control: ${messages.length} -> ${result.length} messages, estimated tokens: ${tokenCount}`
    );
    return result;
  }

  // 估算token数量
  private estimateTokens(text: string): number {
    if (!text) return 0;

    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text
      .split(/\s+/)
      .filter((word) => /[a-zA-Z]/.test(word)).length;
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).join("").length;
    const otherChars = text.length - chineseChars - codeBlocks;

    return Math.ceil(
      chineseChars * 1.3 +
        englishWords * 1.2 +
        codeBlocks * 0.8 +
        otherChars * 0.5
    );
  }

  // 消息摘要
  private summarizeMessages(messages: Message[]): string {
    const topics = new Set<string>();
    const keyPoints: string[] = [];

    for (const msg of messages) {
      const content = msg.content;

      // 识别主题
      if (content.includes("```")) topics.add("代码讨论");
      if (content.match(/[？?]/)) topics.add("问题咨询");
      if (content.includes("错误") || content.includes("bug"))
        topics.add("问题解决");
      if (content.includes("优化") || content.includes("改进"))
        topics.add("代码优化");

      // 提取关键点
      if (content.length < 100 && content.length > 10) {
        keyPoints.push(content.slice(0, 50));
      }
    }

    const summary = [
      topics.size > 0 ? `讨论了${Array.from(topics).join("、")}` : "",
      keyPoints.length > 0
        ? `主要内容包括: ${keyPoints.slice(0, 3).join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("。");

    return summary || `进行了${messages.length}轮对话交流`;
  }

  // 流式聊天
  async *streamChat(
    messages: Message[]
  ): AsyncGenerator<StreamResponse, void, unknown> {
    this.ensureInitialized();

    try {
      const controlledMessages = this.controlContext(messages);

      const completion = await this.openai!.chat.completions.create({
        model: this.config.model,
        messages: controlledMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: true,
        max_tokens: this.config.maxTokens
          ? Math.min(this.config.maxTokens, 4000)
          : 4000,
        temperature: this.config.temperature,
      });

      let fullContent = "";

      for await (const chunk of completion) {
        const content = chunk.choices?.[0]?.delta?.content || "";
        if (content) {
          fullContent += content;
          yield {
            content,
            isComplete: false,
          };
        }
      }

      yield {
        content: "",
        isComplete: true,
      };
    } catch (error) {
      console.error("StreamChat error:", error);
      yield {
        content: "",
        isComplete: true,
        error: `Chat error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  // 获取当前配置
  getConfig(): ChatConfig {
    return { ...this.config };
  }

  // 销毁服务
  dispose(): void {
    this.openai = null;
    this.isInitialized = false;
    console.log("ChatService disposed");
  }
}

// 单例实例
export const chatService = new ChatService();
