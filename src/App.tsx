import * as React from "react";
import "./App.css";

import logo from "./logo.svg";

const App:React.FC = () => {
 const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : undefined;
   const sendTestMessage = () => {
    if (vscode) {
      vscode.postMessage({
        command: 'alert',
        text: '这是一条测试消息！'
      });
    } else {
      console.error('VS Code API not available');
    }
  };
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1 className="App-title">🎉 热更新测试 - Welcome to React12</h1>
      </header>
       <button 
          onClick={sendTestMessage}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#0078D4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          发送测试消息
        </button>
    </div>
  );
};

export default App;
