import * as vscode from "vscode";
import { CommandManager } from "./managers/commandManager";
import { ReactViewProvider } from "./reactViewProvider";

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Neon Coder Extension...");

  // 创建主要组件
  const provider = new ReactViewProvider(context);
  const commandManager = new CommandManager(
    provider.webviewManager,
    provider.fileWatcherManager
  );

  // 注册 webview 视图
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("neon-coder-chat", provider)
  );

  // 注册所有命令
  commandManager.registerCommands(context);

  console.log("✅ Neon Coder Extension activated successfully!");
}

export function deactivate() {
  console.log("Neon Coder Extension deactivated");
}
