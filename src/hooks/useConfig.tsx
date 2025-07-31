// src/hooks/useConfig.tsx
import { useCallback, useEffect, useState } from "react";
import { AppConfig, ModelConfig } from "../types/config";
import { getVSCodeInstance } from "./useVscode";

const vscode = getVSCodeInstance();

// 前端默认配置，与后端保持一致
const DEFAULT_CONFIG: AppConfig = {
  currentModel: "gpt-4o",
  apiKey: "",
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // 从插件存储加载配置
  const loadConfig = useCallback(() => {
    if (vscode) {
      vscode.postMessage({
        command: "getConfig",
        timestamp: Date.now(),
      });
    }
  }, []);

  // 更新当前模型
  const setCurrentModel = useCallback((model: ModelConfig["model"]) => {
    if (vscode) {
      vscode.postMessage({
        command: "setCurrentModel",
        model,
        timestamp: Date.now(),
      });
    }
  }, []);

  // 更新API Key
  const setApiKey = useCallback((apiKey: string) => {
    if (vscode) {
      vscode.postMessage({
        command: "setApiKey",
        apiKey,
        timestamp: Date.now(),
      });
    }
  }, []);

  const getCurrentModelConfig = useCallback((): ModelConfig => {
    return {
      model: config.currentModel,
      apiKey: config.apiKey,
    };
  }, [config]);

  // 检查当前模型是否已配置key
  const isCurrentModelConfigured = useCallback((): boolean => {
    return !!config.apiKey;
  }, [config]);

  // 监听来自插件的配置响应
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case "configLoaded":
          if (message.config) {
            setConfig(message.config);
          }
          setIsLoading(false);
          break;

        case "configSaved":
          console.log("✅ Config saved successfully");
          break;

        case "configError":
          console.error("❌ Config error:", message.error);
          setIsLoading(false);
          break;

        // 处理从命令设置的API Key
        case "setApiKeyFromCommand":
          if (message.apiKey) {
            setApiKey(message.apiKey);
          }
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // 组件挂载时加载配置
    loadConfig();

    return () => window.removeEventListener("message", handleMessage);
  }, [loadConfig]);

  return {
    config,
    isLoading,
    setCurrentModel,
    setApiKey,
    getCurrentModelConfig,
    isCurrentModelConfigured,
    refreshConfig: loadConfig,
  };
}
