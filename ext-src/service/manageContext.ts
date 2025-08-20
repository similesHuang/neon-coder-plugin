// ext-src/providers/providerManager.ts
import * as vscode from "vscode";
import { FileContextProvider } from "../providers/fileContextProvider";
import { McpProvider } from "../providers/mcpProvider";
import { ContextProvider, ContextResult, MCPTool, Message } from "../types";

export class ManageContext {
  private providers: ContextProvider[] = [];
  private initialized = false;

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    if (this.initialized) return;

    try {
      // 从配置中读取启用的提供者
      const config = vscode.workspace.getConfiguration("neonChat");
      const enabledProviders = config.get<string[]>("enabledProviders", [
        "file",
        "mcp",
      ]);
      // 初始化文件上下文提供者
      if (enabledProviders.includes("file")) {
        const fileProvider = new FileContextProvider();
        await fileProvider.initialize();
        this.providers.push(fileProvider);
      }

      // 初始化MCP提供者
      if (enabledProviders.includes("mcp")) {
        const mcpProvider = new McpProvider();
        await mcpProvider.initialize();
        this.providers.push(mcpProvider);
        console.log("MCP provider initialized");
      }

      // 按优先级排序
      this.providers.sort((a, b) => b.priority - a.priority);
      this.initialized = true;

      console.log(
        `Initialized ${this.providers.length} providers:`,
        this.providers.map((p) => `${p.name}(${p.priority})`)
      );
    } catch (error) {
      console.error("Failed to initialize providers:", error);
      vscode.window.showErrorMessage(
        `Failed to initialize context providers: ${error}`
      );
    }
  }

  async getEnhancedContext(
    query: string,
    messages: Message[]
  ): Promise<{
    contexts: ContextResult[];
    tools: MCPTool[];
    summary: string;
  }> {
    await this.initializeProviders();

    const contexts: ContextResult[] = [];
    const allTools: MCPTool[] = [];

    // 并行获取所有提供者的上下文
    const contextPromises = this.providers.map(async (provider) => {
      try {
        const result = await provider.getContext(query, messages);
        if (result.content && result.confidence > 0.1) {
          contexts.push(result);
        }

        // 获取工具
        if (provider.getTools) {
          const tools = await provider.getTools();
          allTools.push(...tools);
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error);
        // 不阻断其他提供者的执行
      }
    });

    await Promise.all(contextPromises);

    // 按置信度排序
    contexts.sort((a, b) => b.confidence - a.confidence);

    // 生成摘要
    const summary = this.generateContextSummary(contexts, allTools);

    return {
      contexts: contexts.slice(0, 5), // 最多返回5个最相关的上下文
      tools: allTools,
      summary,
    };
  }

  private generateContextSummary(
    contexts: ContextResult[],
    tools: MCPTool[]
  ): string {
    const summaryParts: string[] = [];

    if (contexts.length > 0) {
      summaryParts.push("== 上下文信息 ==");
      contexts.forEach((ctx, index) => {
        summaryParts.push(
          `${index + 1}. [${ctx.source}] (置信度: ${(
            ctx.confidence * 100
          ).toFixed(0)}%)`
        );
        if (ctx.content.length > 200) {
          summaryParts.push(ctx.content.substring(0, 200) + "...");
        } else {
          summaryParts.push(ctx.content);
        }
        summaryParts.push("");
      });
    }

    if (tools.length > 0) {
      summaryParts.push("== 可用工具 ==");
      tools.forEach((tool) => {
        summaryParts.push(`- ${tool.name}: ${tool.description}`);
      });
      summaryParts.push("");
    }

    return summaryParts.join("\n");
  }

  async executeFunction(functionName: string, parameters: any): Promise<any> {
    await this.initializeProviders();

    // 查找对应的工具和提供者
    for (const provider of this.providers) {
      if (provider.getTools) {
        const tools = await provider.getTools();
        const tool = tools.find((t) => t.name === functionName);

        if (tool) {
          try {
            console.log(
              `Executing tool ${functionName} with parameters:`,
              parameters
            );

            // 使用提供者的 callTool 方法（如果存在）
            if (provider.callTool) {
              const result = await provider.callTool(functionName, parameters);
              console.log(`Tool ${functionName} executed successfully`);
              return result;
            } else {
              throw new Error(
                `Provider ${provider.name} does not support tool execution`
              );
            }
          } catch (error) {
            console.error(`Tool ${functionName} execution failed:`, error);
            throw error;
          }
        }
      }
    }

    throw new Error(`Tool '${functionName}' not found`);
  }

  getProviderInfo(): {
    name: string;
    priority: number;
    initialized: boolean;
  }[] {
    return this.providers.map((provider) => ({
      name: provider.name,
      priority: provider.priority,
      initialized: this.initialized,
    }));
  }

  async refreshProviders(): Promise<void> {
    this.providers = [];
    this.initialized = false;
    await this.initializeProviders();
  }

  // 添加新的提供者
  addProvider(provider: ContextProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  // 移除提供者
  removeProvider(name: string): boolean {
    const index = this.providers.findIndex((p) => p.name === name);
    if (index !== -1) {
      this.providers.splice(index, 1);
      return true;
    }
    return false;
  }

  // 获取特定提供者
  getProvider(name: string): ContextProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }
}
