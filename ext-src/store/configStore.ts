import * as vscode from "vscode";

export interface ModelConfig {
  model: "gpt-4o" | "claude-4-sonnet" | "deepseek-r1";
  apiKey: string;
}

export interface AppConfig {
  currentModel: ModelConfig["model"];
  apiKey: string; // 统一的API Key
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export const MODEL_CONFIGS = {
  "gpt-4o": {
    name: "GPT-4o",
    provider: "openai",
    maxTokens: 4096,
    defaultTemperature: 0.7,
  },
  "claude-4-sonnet": {
    name: "Claude 4 Sonnet",
    provider: "anthropic",
    maxTokens: 8192,
    defaultTemperature: 0.7,
  },
  "deepseek-r1": {
    name: "DeepSeek R1",
    provider: "deepseek",
    maxTokens: 4096,
    defaultTemperature: 0.7,
  },
} as const;

export const DEFAULT_CONFIG: AppConfig = {
  currentModel: "claude-4-sonnet",
  apiKey: "",
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: "你是一个有用的AI助手。",
};

export class ConfigStoreManager {
  private context: vscode.ExtensionContext;
  private readonly CONFIG_KEY = "neon-coder-config";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // ========== 配置存储方法 ==========

  async getAppConfig(): Promise<AppConfig> {
    const stored = await this.context.globalState.get<AppConfig>(
      this.CONFIG_KEY
    );
    return { ...DEFAULT_CONFIG, ...stored };
  }

  async saveAppConfig(config: AppConfig): Promise<void> {
    await this.context.globalState.update(this.CONFIG_KEY, config);
    console.log("✅ App config saved to persistent storage");
  }

  /**
   * 更新当前使用的模型
   */
  async setCurrentModel(model: ModelConfig["model"]): Promise<void> {
    const config = await this.getAppConfig();
    config.currentModel = model;

    // 更新模型相关的默认设置
    const modelConfig = MODEL_CONFIGS[model];
    config.maxTokens = modelConfig.maxTokens;
    config.temperature = modelConfig.defaultTemperature;

    await this.saveAppConfig(config);
    console.log(`✅ Current model updated to: ${model}`);
  }

  /**
   * 更新API Key
   */
  async setApiKey(apiKey: string): Promise<void> {
    const config = await this.getAppConfig();
    config.apiKey = apiKey;
    await this.saveAppConfig(config);
    console.log(`✅ API Key updated`);
  }

  /**
   * 更新模型参数
   */
  async updateModelParams(params: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  }): Promise<void> {
    const config = await this.getAppConfig();

    if (params.maxTokens !== undefined) {
      config.maxTokens = params.maxTokens;
    }
    if (params.temperature !== undefined) {
      config.temperature = params.temperature;
    }
    if (params.systemPrompt !== undefined) {
      config.systemPrompt = params.systemPrompt;
    }

    await this.saveAppConfig(config);
    console.log(`✅ Model parameters updated:`, params);
  }

  /**
   * 获取当前模型配置
   */
  async getCurrentModelConfig(): Promise<ModelConfig | null> {
    const config = await this.getAppConfig();

    if (!config.apiKey) {
      return null;
    }

    return {
      model: config.currentModel,
      apiKey: config.apiKey,
    };
  }

  /**
   * 获取当前模型信息
   */
  async getCurrentModelInfo() {
    const config = await this.getAppConfig();
    const modelInfo = MODEL_CONFIGS[config.currentModel];

    return {
      ...modelInfo,
      currentConfig: config,
    };
  }

  /**
   * 检查当前模型是否已配置
   */
  async isCurrentModelConfigured(): Promise<boolean> {
    const modelConfig = await this.getCurrentModelConfig();
    return modelConfig !== null && modelConfig.apiKey.trim().length > 0;
  }

  /**
   * 获取所有可用模型
   */
  getAvailableModels() {
    return Object.entries(MODEL_CONFIGS).map(([key, config]) => ({
      id: key as ModelConfig["model"],
      name: config.name,
      provider: config.provider,
      maxTokens: config.maxTokens,
      defaultTemperature: config.defaultTemperature,
    }));
  }

  /**
   * 重置配置到默认值
   */
  async resetAppConfig(): Promise<void> {
    await this.saveAppConfig(DEFAULT_CONFIG);
    console.log("✅ App config reset to default values");
  }

  /**
   * 清除API Key配置
   */
  async clearApiKey(): Promise<void> {
    const config = await this.getAppConfig();
    config.apiKey = "";
    await this.saveAppConfig(config);
    console.log(`✅ API Key cleared`);
  }

  /**
   * 导出配置
   */
  async exportConfig(): Promise<AppConfig> {
    return await this.getAppConfig();
  }

  /**
   * 导入配置
   */
  async importConfig(config: Partial<AppConfig>): Promise<void> {
    const currentConfig = await this.getAppConfig();
    const newConfig = { ...currentConfig, ...config };
    await this.saveAppConfig(newConfig);
    console.log("✅ Configuration imported successfully");
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<{ isValid: boolean; errors: string[] }> {
    const config = await this.getAppConfig();
    const errors: string[] = [];

    // 检查API Key
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      errors.push("API Key is required");
    }

    // 检查模型
    if (!MODEL_CONFIGS[config.currentModel]) {
      errors.push(`Invalid model: ${config.currentModel}`);
    }

    // 检查参数范围
    if (
      config.maxTokens &&
      (config.maxTokens < 1 || config.maxTokens > 32000)
    ) {
      errors.push("Max tokens must be between 1 and 32000");
    }

    if (
      config.temperature &&
      (config.temperature < 0 || config.temperature > 2)
    ) {
      errors.push("Temperature must be between 0 and 2");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
