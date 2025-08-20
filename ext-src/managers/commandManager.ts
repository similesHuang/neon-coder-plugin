import * as vscode from "vscode";
import { McpServerManager } from "./mcpServerManager";

export class CommandManager {
  private _mcpManager: McpServerManager;
  private _webviewManager: any; // WebviewManager 的引用
  private _fileWatcherManager: any; // FileWatcherManager 的引用

  constructor(webviewManager: any, fileWatcherManager: any) {
    this._webviewManager = webviewManager;
    this._fileWatcherManager = fileWatcherManager;
    this._mcpManager = new McpServerManager();
  }

  public registerCommands(context: vscode.ExtensionContext) {
    const commands = [
      {
        id: "neon-coder.start",
        handler: () => {
          vscode.commands.executeCommand("workbench.view.extension.neon-coder");
        },
      },
      {
        id: "neon-coder.newSession",
        handler: () => {
          this._webviewManager.postMessage({
            command: "createNewSessionFromToolbar",
            timestamp: Date.now(),
          });
          vscode.window.showInformationMessage("✨ 正在创建新会话...");
        },
      },
      {
        id: "neon-coder.showHistory",
        handler: () => {
          this._webviewManager.postMessage({
            command: "toggleSessionHistory",
            timestamp: Date.now(),
          });
        },
      },
      {
        id: "neon-coder.configApiKey",
        handler: async () => {
          await this._configApiKey();
        },
      },
      {
        id: "neon-coder.manageMcp",
        handler: async () => {
          await this._mcpManager.manageMcpServers();
        },
      },
      {
        id: "neon-coder.close",
        handler: () => {
          vscode.commands.executeCommand("workbench.action.closeSidebar");
        },
      },
    ];

    commands.forEach((command) => {
      context.subscriptions.push(
        vscode.commands.registerCommand(command.id, command.handler)
      );
    });
  }

  private async _configApiKey() {
    const apiKey = await vscode.window.showInputBox({
      prompt: "请输入您的 API Key",
      placeHolder: "输入您的 API Key",
      password: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "API Key 不能为空";
        }
        return null;
      },
    });

    if (apiKey) {
      this._webviewManager.postMessage({
        command: "setApiKeyFromCommand",
        apiKey: apiKey.trim(),
      });
      vscode.window.showInformationMessage("API Key 已更新！");
    }
  }
}
