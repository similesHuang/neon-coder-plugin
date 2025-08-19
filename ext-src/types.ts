// ext-src/types.ts

export interface ContextProvider {
  name: string;
  priority: number;

  initialize?(): Promise<void>;
  getContext(query: string, messages: Message[]): Promise<ContextResult>;
  getTools?(): Promise<MCPTool[]>;
  callTool?(toolName: string, parameters: Record<string, any>): Promise<any>; // 添加工具调用方法
}

export interface ContextResult {
  content: string;
  source: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface KnowledgeSource {
  search(query: string, limit?: number): Promise<KnowledgeItem[]>;
  index(content: string, metadata: Record<string, any>): Promise<void>;
  initialize?(): Promise<void>;
}

export interface KnowledgeItem {
  id: string;
  content: string;
  title?: string;
  source: string;
  score: number;
  metadata: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  serverName?: string; // 添加服务器名称以便路由调用
}
export interface MCPPrompt {
  role: "user" | "assistant";
  type: "text";
  content: string;
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp?: number;
  id?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatConfig {
  model: string;
  apiKey: string;
  baseURL: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  enableMCP?: boolean;
  enableKnowledgeBase?: boolean;
  mcpServers?: string[];
  knowledgeBaseConfig?: {
    vectorDbUrl?: string;
    embeddingModel?: string;
  };
}

export interface StreamResponse {
  content: string;
  isComplete: boolean;
  error?: string;
  toolCalls?: any[];
  contextUsed?: ContextResult[];
}
