import {
  sseConnectServer,
  stdioConnectServer,
  streamableHttpConnectServer,
} from "client-connect-server";
import * as vscode from "vscode";
import {
  ContextProvider,
  ContextResult,
  MCPPrompt,
  MCPTool,
  Message,
} from "../types";

interface MCPServerConfig {
  name: string;
  type: "stdio" | "sse" | "http";
  path?: string; // for stdio: path to .js/.cjs file
  url?: string; // for sse/http
  description?: string;
}

interface MCPServerConnection {
  config: MCPServerConfig;
  client: any;
  isConnected: boolean;
  tools: MCPTool[];
  prompts: MCPPrompt[];
}

export class McpProvider implements ContextProvider {
  name = "MCP";
  priority = 90;

  private connections: Map<string, MCPServerConnection> = new Map();
  private availableTools: MCPTool[] = [];

  constructor() {
    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("neonCoder.mcpServers")) {
        this.handleConfigurationChange();
      }
    });
  }

  async initialize(): Promise<void> {
    console.log("Initializing MCP Provider...");

    // 获取配置的MCP服务器
    const config = vscode.workspace.getConfiguration("neonCoder");
    const mcpServers = config.get<string[]>("mcpServers", []);

    // 连接到每个MCP服务器
    for (const serverConfigStr of mcpServers) {
      try {
        const serverConfig: MCPServerConfig = JSON.parse(serverConfigStr);
        await this.connectToMcpServer(serverConfig);
      } catch (error) {
        console.error(
          "Failed to parse MCP server config:",
          serverConfigStr,
          error
        );
        vscode.window.showWarningMessage(`MCP服务器配置解析失败: ${error}`);
      }
    }

    console.log(`Initialized ${this.connections.size} MCP server connections`);
  }

  private async handleConfigurationChange(): Promise<void> {
    console.log("MCP configuration changed, reinitializing...");

    // 断开所有现有连接
    await this.dispose();

    // 重新初始化
    await this.initialize();
  }

  private async connectToMcpServer(config: MCPServerConfig): Promise<void> {
    try {
      console.log(`Connecting to MCP server: ${config.name} (${config.type})`);

      let client: any;

      switch (config.type) {
        case "stdio":
          if (!config.path) {
            throw new Error("Stdio server requires path to .js/.cjs file");
          }
          client = await stdioConnectServer(config.path);
          break;

        case "sse":
          if (!config.url) {
            throw new Error("SSE server requires URL");
          }
          client = await sseConnectServer(config.url);
          break;

        case "http":
          if (!config.url) {
            throw new Error("HTTP server requires URL");
          }
          client = await streamableHttpConnectServer(config.url);
          break;

        default:
          throw new Error(`Unsupported server type: ${config.type}`);
      }

      const connection: MCPServerConnection = {
        config,
        client,
        isConnected: true,
        tools: [],
        prompts: [],
      };

      // 获取服务器提供的工具列表
      const tools = await this.getServerTools(client, config.name);
      connection.tools = tools;
      this.availableTools.push(...tools);

      this.connections.set(config.name, connection);

      console.log(
        `Successfully connected to MCP server ${config.name} with ${tools.length} tools:`,
        tools.map((t: MCPTool) => t.name).join(", ")
      );
    } catch (error) {
      console.error(`Failed to connect to MCP server ${config.name}:`, error);
      vscode.window.showErrorMessage(
        `连接MCP服务器 ${config.name} 失败: ${error}`
      );
    }
  }

  private async getServerTools(
    client: any,
    serverName: string
  ): Promise<MCPTool[]> {
    try {
      // 调用客户端的 listTools 方法
      const response = await client.listTools();

      if (!response || !response.tools) {
        console.log(`No tools found for server ${serverName}`);
        return [];
      }

      return response.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || `Tool from ${serverName}`,
        parameters: tool.inputSchema || { type: "object", properties: {} },
        serverName: serverName, // 记录工具来自哪个服务器
      }));
    } catch (error) {
      console.error(`Failed to get tools from server ${serverName}:`, error);
      return [];
    }
  }

  // 公共工具调用接口
  async callTool(
    toolName: string,
    parameters: Record<string, any>
  ): Promise<any> {
    // 查找工具所属的服务器
    const tool = this.availableTools.find((t) => t.name === toolName);
    if (!tool || !tool.serverName) {
      throw new Error(`Tool ${toolName} not found or server not specified`);
    }

    return await this.callMcpToolInternal(
      tool.serverName,
      toolName,
      parameters
    );
  }

  private async callMcpToolInternal(
    serverName: string,
    toolName: string,
    parameters: any
  ): Promise<any> {
    const connection = this.connections.get(serverName);
    if (!connection || !connection.isConnected) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }

    console.log(
      `Calling MCP tool ${toolName} on server ${serverName} with params:`,
      parameters
    );

    try {
      // 使用客户端的 callTool 方法
      const response = await connection.client.callTool({
        name: toolName,
        arguments: parameters,
      });

      console.log(`MCP tool ${toolName} response:`, response);
      return response;
    } catch (error) {
      console.error(`Failed to call MCP tool ${toolName}:`, error);
      throw error;
    }
  }

  async getContext(query: string, messages: Message[]): Promise<ContextResult> {
    if (this.availableTools.length === 0) {
      return {
        content: "",
        source: "MCP",
        confidence: 0,
      };
    }

    return {
      content: "",
      source: "MCP",
      confidence: 0,
    };
  }

  async getTools(): Promise<MCPTool[]> {
    return this.availableTools;
  }

  // 获取连接状态
  getConnectionStatus(): { [serverName: string]: boolean } {
    const status: { [serverName: string]: boolean } = {};
    for (const [name, connection] of this.connections) {
      status[name] = connection.isConnected;
    }
    return status;
  }

  // 重新连接服务器
  async reconnectServer(serverName: string): Promise<boolean> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      console.error(`Server ${serverName} not found`);
      return false;
    }

    try {
      // 先断开现有连接
      await this.disconnectServer(serverName);

      // 重新连接
      await this.connectToMcpServer(connection.config);
      return true;
    } catch (error) {
      console.error(`Failed to reconnect to server ${serverName}:`, error);
      return false;
    }
  }

  // 断开服务器连接
  async disconnectServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    try {
      if (connection.client && typeof connection.client.close === "function") {
        await connection.client.close();
      }

      connection.isConnected = false;

      // 从可用工具列表中移除该服务器的工具
      this.availableTools = this.availableTools.filter(
        (tool) =>
          !connection.tools.some((serverTool) => serverTool.name === tool.name)
      );

      console.log(`Disconnected from MCP server: ${serverName}`);
    } catch (error) {
      console.error(`Error disconnecting from server ${serverName}:`, error);
    }
  }

  // 清理所有连接
  async dispose(): Promise<void> {
    console.log("Disposing MCP Provider...");

    for (const [name] of this.connections) {
      await this.disconnectServer(name);
    }

    this.connections.clear();
    this.availableTools = [];
  }
}
