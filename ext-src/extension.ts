import * as fs from "fs";
import getPort from "get-port";
import * as path from "path";
import * as vscode from "vscode";
import { startServer } from "../server";
import { getCurrentFileInfo } from "./files";
import { setupMessageChannel } from "./messagChannel";

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating React Webview Extension...");

  const port = await startKoaServer(context);

  const provider = new ReactViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("neon-coder-chat", provider)
  );

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand("neon-coder.start", () => {
      vscode.commands.executeCommand("workbench.view.extension.neon-coder");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("neon-coder.newSession", () => {
      provider.createNewSession();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("neon-coder.showHistory", () => {
      provider.toggleSessionHistory();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("neon-coder.close", () => {
      provider.closePlugin();
    })
  );
}

/**
 * Manages react webview views
 */
class ReactViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _updateInterval: NodeJS.Timeout | undefined;
  private _buildTimeout: NodeJS.Timeout | undefined;
  private _context: vscode.ExtensionContext;
  private _fileChangeDisposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._context.extensionPath, "build")),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    this._startHotReload();

    setupMessageChannel(webviewView, this._context);

    // 设置文件监听
    this._setupFileWatchers();

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log("🎯 Webview became visible, sending current file info");

        setTimeout(() => {
          this._sendCurrentFileInfo();
        }, 200);
      }
    });

    webviewView.onDidDispose(() => {
      this._dispose();
    });
  }

  private _dispose() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }
    if (this._buildTimeout) {
      clearTimeout(this._buildTimeout);
    }
    // 清理文件监听器
    this._fileChangeDisposables.forEach((disposable) => disposable.dispose());
    this._fileChangeDisposables = [];
  }

  // 设置文件监听器
  private _setupFileWatchers() {
    // 监听活动编辑器变化
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        this._sendCurrentFileInfo();
      }
    );
    this._fileChangeDisposables.push(activeEditorDisposable);

    // 监听文本选择变化
    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(
      (event) => {
        this._sendCurrentFileInfo();
      }
    );
    this._fileChangeDisposables.push(selectionDisposable);

    // 监听文档内容变化（可选，如果你想实时同步）
    const documentDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        // 防抖处理，避免频繁更新
        setTimeout(() => {
          this._sendCurrentFileInfo();
        }, 300);
      }
    );
    this._fileChangeDisposables.push(documentDisposable);
  }

  // 发送当前文件信息到 webview
  private _sendCurrentFileInfo() {
    if (!this._view) {
      return;
    }

    const fileInfo = getCurrentFileInfo();
    this._view.webview.postMessage({
      command: "currentFileInfo",
      fileInfo,
      timestamp: Date.now(),
    });
  }

  // 公共方法：手动发送当前文件信息
  public sendCurrentFileInfo() {
    this._sendCurrentFileInfo();
  }

  private _startHotReload() {
    // 记录文件的最后修改时间
    let lastModifiedTimes = new Map<string, number>();

    // 初始化文件时间戳
    const srcDir = path.join(this._context.extensionPath, "src");
    if (fs.existsSync(srcDir)) {
      const files = this._getAllFiles(srcDir, [".tsx", ".ts", ".css", ".js"]);
      for (const file of files) {
        try {
          const stats = fs.statSync(file);
          lastModifiedTimes.set(file, stats.mtime.getTime());
        } catch (error) {
          // 忽略错误
        }
      }
    }

    // 每2秒检查一次文件变化
    this._updateInterval = setInterval(() => {
      try {
        if (!fs.existsSync(srcDir)) {
          return;
        }

        const files = this._getAllFiles(srcDir, [".tsx", ".ts", ".css", ".js"]);
        let hasChanges = false;

        for (const file of files) {
          try {
            const stats = fs.statSync(file);
            const lastModified = stats.mtime.getTime();
            const previousTime = lastModifiedTimes.get(file);

            if (previousTime && previousTime !== lastModified) {
              hasChanges = true;
              console.log(`File changed: ${file}`);
            }

            lastModifiedTimes.set(file, lastModified);
          } catch (error) {
            // 文件可能被删除了
            if (lastModifiedTimes.has(file)) {
              lastModifiedTimes.delete(file);
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          this._triggerRebuild();
        }
      } catch (error) {
        console.error("Error checking for file changes:", error);
      }
    }, 2000);
  }

  private _getAllFiles(dir: string, extensions: string[]): string[] {
    let results: string[] = [];

    try {
      if (!fs.existsSync(dir)) {
        return results;
      }

      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);

        try {
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            results = results.concat(this._getAllFiles(fullPath, extensions));
          } else if (extensions.some((ext) => file.endsWith(ext))) {
            results.push(fullPath);
          }
        } catch (error) {
          // 忽略错误
        }
      }
    } catch (error) {
      // 忽略错误
    }

    return results;
  }

  private _triggerRebuild() {
    // 防抖处理，避免频繁重建
    if (this._buildTimeout) {
      clearTimeout(this._buildTimeout);
    }

    this._buildTimeout = setTimeout(() => {
      const { exec } = require("child_process");

      console.log("Changes detected, starting rebuild...");
      vscode.window.showInformationMessage(
        "🔄 检测到文件变化，正在重新构建 React 应用..."
      );

      exec(
        "npm run build",
        { cwd: this._context.extensionPath },
        (error: any, stdout: any, stderr: any) => {
          if (error) {
            console.error("Build error:", error);
            vscode.window.showErrorMessage("❌ 构建失败: " + error.message);
            return;
          }

          console.log("Build completed successfully");

          // 构建成功后重新加载 webview
          setTimeout(() => {
            this._updateWebview();
            vscode.window.showInformationMessage("🎉 React 应用已更新！");
          }, 200);
        }
      );
    }, 1000);
  }

  private _updateWebview() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    try {
      const manifestPath = path.join(
        this._context.extensionPath,
        "build",
        "asset-manifest.json"
      );

      if (!fs.existsSync(manifestPath)) {
        return `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>🚧 Build files not found</h1>
          <p>Please run <code>npm run build</code> first.</p>
        </body></html>`;
      }

      // 清除 require 缓存以获取最新的 manifest
      delete require.cache[require.resolve(manifestPath)];
      const manifest = require(manifestPath);

      const mainScript = manifest["files"]["main.js"];
      const mainStyle = manifest["files"]["main.css"];

      if (!mainScript || !mainStyle) {
        return `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>❌ Invalid build files</h1>
          <p>Main script: ${mainScript}</p>
          <p>Main style: ${mainStyle}</p>
        </body></html>`;
      }

      const scriptPathOnDisk = vscode.Uri.file(
        path.join(this._context.extensionPath, "build", mainScript)
      );
      const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
      const stylePathOnDisk = vscode.Uri.file(
        path.join(this._context.extensionPath, "build", mainStyle)
      );
      const styleUri = webview.asWebviewUri(stylePathOnDisk);

      // Use a nonce to whitelist which scripts can be run
      const nonce = getNonce();

      return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
          <meta name="theme-color" content="#000000">
          <title>React App - Hot Reload</title>
          <link rel="stylesheet" type="text/css" href="${styleUri}">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
            webview.cspSource
          } https: data:; script-src 'nonce-${nonce}'; style-src ${
        webview.cspSource
      } 'unsafe-inline' http: https: data:;">
          <base href="${webview.asWebviewUri(
            vscode.Uri.file(path.join(this._context.extensionPath, "build"))
          )}/">
          <style>
            body {
              margin: 0;
              padding: 0;
              overflow-x: hidden;
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
              background-color: var(--vscode-editor-background);
              color: var(--vscode-editor-foreground);
            }
            #root {
              width: 100%;
              height: 100vh;
              overflow-y: auto;
              overflow-x: hidden;
            }
          </style>
        </head>

        <body>
          <noscript>You need to enable JavaScript to run this app.</noscript>
          <div id="root"></div>
          
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    } catch (error) {
      console.error("Error generating HTML for webview:", error);
      return `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>💥 Error loading React app</h1>
        <p><strong>Error:</strong> ${error}</p>
        <p>Check the VS Code developer console for more details.</p>
      </body></html>`;
    }
  }
  public createNewSession() {
    if (this._view) {
      this._view.webview.postMessage({
        command: "createNewSessionFromToolbar",
        timestamp: Date.now(),
      });

      vscode.window.showInformationMessage("✨ 正在创建新会话...");
    }
  }

  public toggleSessionHistory() {
    if (this._view) {
      this._view.webview.postMessage({
        command: "toggleSessionHistory",
        timestamp: Date.now(),
      });
    }
  }

  public closePlugin() {
    vscode.commands.executeCommand("workbench.action.closeSidebar");
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function startKoaServer(
  context: vscode.ExtensionContext
): Promise<number> {
  try {
    // 动态获取可用端口
    const port = await getPort({ port: 3002 });
    const server = startServer(port);
    console.log(`Koa server started on port ${port}`);
    // 确保插件停用时关闭服务器
    context.subscriptions.push({
      dispose: () => {
        server.close();
        console.log("Server stopped");
      },
    });

    return port;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to start server: ${error}`);
    throw error;
  }
}
