// src/types/config.ts
// 重新导出 store 中的类型，保持前端类型的一致性
export interface ModelConfig {
  model: "gpt-4o" | "claude-4-sonnet";
  apiKey: string;
}

export interface AppConfig {
  currentModel: ModelConfig["model"];
  apiKey: string;
}

// 模型显示名称和配置
export const MODEL_CONFIGS = {
  "gpt-4o": {
    name: "GPT-4o",
  },
  "claude-4-sonnet": {
    name: "Claude 4 Sonnet",
  },
} as const;
