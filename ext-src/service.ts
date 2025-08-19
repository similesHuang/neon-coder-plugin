import OpenAI from "openai";
import * as vscode from "vscode";
import { ProviderManager } from "./providers/providerManager";
import { Message } from "./types";

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
  contextUsed?: boolean;
  error?: string;
}

export class ChatService {
  private openai: OpenAI | null = null;
  private config: ChatConfig;
  private isInitialized = false;
  private providerManager: ProviderManager;

  constructor() {
    this.config = {
      model: "claude-4-sonnet",
      apiKey: "",
      baseURL: "https://llmapi.bilibili.co/v1",
      maxTokens: 8000,
      temperature: 0.7,
      systemPrompt: "你是一个专业的AI编程助手，专门帮助用户解决编程问题。",
    };
    this.providerManager = new ProviderManager();
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

  async *streamChat(
    messages: Message[],
    maxToolDepth: number = 5
  ): AsyncGenerator<StreamResponse, void, unknown> {
    this.ensureInitialized();

    try {
      // 检查是否达到最大工具调用深度
      if (maxToolDepth <= 0) {
        console.warn("达到最大工具调用深度，停止递归");
        yield {
          content:
            "抱歉，工具调用达到最大深度限制。请直接告诉我您需要什么帮助。",
          isComplete: true,
          contextUsed: false,
        };
        return;
      }

      console.log(`工具调用深度: ${5 - maxToolDepth + 1}/5`);

      const lastUserMessage = messages.filter((m) => m.role === "user").pop();
      const userQuery = lastUserMessage?.content || "";

      // 获取增强的上下文 - 仅在第一层调用时获取
      const shouldGetContext = maxToolDepth === 5;
      const enhancedContext = shouldGetContext
        ? await this.providerManager.getEnhancedContext(userQuery, messages)
        : { summary: "", contexts: [], tools: [] };

      // 简化消息处理
      let processedMessages = [...messages];

      // 仅在第一次调用且有上下文时添加上下文信息
      if (
        shouldGetContext &&
        enhancedContext.summary &&
        enhancedContext.contexts.length > 0
      ) {
        const contextMessage: Message = {
          role: "system",
          content: `相关上下文：${enhancedContext.summary}`,
          timestamp: Date.now(),
          id: "context-" + Date.now(),
        };
        processedMessages = [contextMessage, ...messages];
      }

      // 获取工具定义
      const availableTools = enhancedContext.tools || [];
      const tools =
        availableTools.length > 0
          ? availableTools.map((tool) => {
              let parameters = tool.parameters;
              if (!parameters || typeof parameters !== "object") {
                parameters = { type: "object", properties: {} };
              }
              if (!parameters.type) parameters.type = "object";
              if (!parameters.properties) parameters.properties = {};

              return {
                type: "function" as const,
                function: {
                  name: tool.name,
                  description: tool.description || `Execute ${tool.name}`,
                  parameters,
                },
              };
            })
          : undefined;

      // 转换消息格式为OpenAI API格式
      let currentMessages = processedMessages.map((msg) => {
        const baseMessage = {
          role: msg.role as any,
          content: msg.content || "",
        };

        if (msg.role === "tool" && msg.tool_call_id) {
          return { ...baseMessage, tool_call_id: msg.tool_call_id };
        }
        if (msg.role === "assistant" && msg.tool_calls) {
          return { ...baseMessage, tool_calls: msg.tool_calls };
        }
        return baseMessage;
      });

      console.log("处理消息数量:", processedMessages.length);
      console.log("API消息数量:", currentMessages.length);

      let iteration = 0;

      // 使用while循环代替嵌套generator
      while (iteration < maxToolDepth) {
        iteration++;
        console.log(
          `流式处理第 ${iteration} 轮，消息数量: ${currentMessages.length}`
        );

        // 创建流式请求
        const stream = await this.openai!.chat.completions.create({
          model: this.config.model,
          messages: currentMessages,
          max_tokens: this.config.maxTokens
            ? Math.min(this.config.maxTokens, 4000)
            : 4000,
          temperature: this.config.temperature,
          stream: true, // 使用流式处理
          tools: tools,
          tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        });

        let toolCalls: any[] = [];
        let streamContent = "";

        // 处理流式响应
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          // 输出内容
          if (delta?.content) {
            streamContent += delta.content;
            yield {
              content: delta.content,
              isComplete: false,
              contextUsed: enhancedContext.contexts.length > 0,
            };
          }

          // 收集工具调用
          if (delta?.tool_calls) {
            // 处理流式工具调用数据
            for (const toolCallDelta of delta.tool_calls) {
              if (toolCallDelta.index !== undefined) {
                if (!toolCalls[toolCallDelta.index]) {
                  toolCalls[toolCallDelta.index] = {
                    id: toolCallDelta.id,
                    type: toolCallDelta.type,
                    function: {
                      name: toolCallDelta.function?.name || "",
                      arguments: toolCallDelta.function?.arguments || "",
                    },
                  };
                } else {
                  // 追加函数参数
                  if (toolCallDelta.function?.arguments) {
                    toolCalls[toolCallDelta.index].function.arguments +=
                      toolCallDelta.function.arguments;
                  }
                }
              }
            }
          }
        }

        if (toolCalls.length > 0) {
          try {
            console.log(`检测到 ${toolCalls.length} 个工具调用`);

            // 执行工具调用
            const toolResult = await this.handleToolCallsLikeReference(
              toolCalls
            );

            if (toolResult) {
              console.log(`工具执行完成，结果长度: ${toolResult.length}`);

              // 关键：将工具结果作为用户消息添加（参考代码的做法）
              currentMessages.push({
                role: "user",
                content: toolResult,
              });

              console.log(`添加工具结果后消息数量: ${currentMessages.length}`);

              // 继续下一轮循环处理
              continue;
            } else {
              // 没有工具结果，结束处理
              break;
            }
          } catch (error) {
            console.error("工具调用错误:", error);
            yield {
              content: `\n工具调用失败: ${
                error instanceof Error ? error.message : "Unknown error"
              }\n`,
              isComplete: false,
              contextUsed: enhancedContext.contexts.length > 0,
            };
            break;
          }
        } else {
          // 没有工具调用，完成响应
          break;
        }
      }

      // 完成响应
      yield {
        content: "",
        isComplete: true,
        contextUsed: enhancedContext.contexts.length > 0,
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

  // 按照参考代码的方式处理工具调用
  private async handleToolCallsLikeReference(
    toolCalls: any[]
  ): Promise<string> {
    const toolResults: string[] = [];

    for (const toolCall of toolCalls) {
      try {
        console.log(`执行工具: ${toolCall.function.name}`);
        console.log(`工具参数原始数据: "${toolCall.function.arguments}"`);

        // 解析工具参数（处理可能的空参数或流式传输不完整的情况）
        let parameters = {};
        try {
          if (
            toolCall.function.arguments &&
            toolCall.function.arguments.trim()
          ) {
            parameters = JSON.parse(toolCall.function.arguments);
          } else {
            console.log(`工具 ${toolCall.function.name} 没有参数，使用空对象`);
            parameters = {};
          }
        } catch (parseError) {
          console.error(
            `解析工具参数失败: "${toolCall.function.arguments}"`,
            parseError
          );
          // 如果解析失败，使用空对象作为参数
          parameters = {};
        }

        console.log(`解析后的参数:`, parameters);

        // 通过 ProviderManager 执行工具
        const result = await this.providerManager.executeFunction(
          toolCall.function.name,
          parameters
        );

        toolResults.push(
          `工具 ${toolCall.function.name} 执行结果:\n${JSON.stringify(result)}`
        );
        console.log(`工具 ${toolCall.function.name} 执行成功`);
      } catch (error) {
        const errorMsg = `工具 ${toolCall.function.name} 执行失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        toolResults.push(errorMsg);
        console.error(`工具执行失败 ${toolCall.function.name}:`, error);
      }
    }

    return toolResults.join("\n\n");
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
export type { Message };
