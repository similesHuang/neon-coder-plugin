// src/components/modelSelector/ModelSelector.tsx
import React from "react";
import { MODEL_CONFIGS, ModelConfig } from "../../types/config";
import "./index.css";

interface ModelSelectorProps {
  currentModel: ModelConfig["model"];
  onModelChange: (model: ModelConfig["model"]) => void;
  isConfigured: boolean;
}

const Selector: React.FC<ModelSelectorProps> = ({
  currentModel,
  onModelChange,
  isConfigured,
}) => {
  return (
    <div className="model-selector">
      <select
        className="model-select"
        value={currentModel}
        onChange={(e) => onModelChange(e.target.value as ModelConfig["model"])}
      >
        {Object.entries(MODEL_CONFIGS).map(([modelKey, modelInfo]) => (
          <option key={modelKey} value={modelKey}>
            {modelInfo.name}
          </option>
        ))}
      </select>
      <div className="model-status">
        {isConfigured ? (
          <span className="status-configured" title="API Key 已配置">
            ✅
          </span>
        ) : (
          <span className="status-unconfigured" title="需要配置 API Key">
            ⚠️
          </span>
        )}
      </div>
    </div>
  );
};

export default Selector;
