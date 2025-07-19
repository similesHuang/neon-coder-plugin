import * as React from "react";
import "./App.css";

const App: React.FC = () => {
  const vscode = window.acquireVsCodeApi
    ? window.acquireVsCodeApi()
    : undefined;
  const sendTestMessage = () => {
    if (vscode) {
      vscode.postMessage({
        command: "alert",
        text: "这是一条测试消息！",
      });
    } else {
      console.error("VS Code API not available");
    }
  };
  return <div className="App"></div>;
};

export default App;
