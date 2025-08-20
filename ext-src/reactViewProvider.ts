import * as vscode from "vscode";
import { FileWatcherManager } from "./managers/fileWatchManager";
import { HotReloadManager } from "./managers/hotReloadManager";
import { WebviewManager } from "./managers/webviewManager";
import { setupMessageChannel } from "./messageChannel";

export class ReactViewProvider implements vscode.WebviewViewProvider {
  private _webviewManager: WebviewManager;
  private _hotReloadManager: HotReloadManager;
  private _fileWatcherManager: FileWatcherManager;
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._webviewManager = new WebviewManager(context);
    this._hotReloadManager = new HotReloadManager(context);
    this._fileWatcherManager = new FileWatcherManager();

    // 设置回调
    this._hotReloadManager.setReloadCallback(() => {
      this._webviewManager.updateWebview();
    });

    this._fileWatcherManager.setFileChangeCallback((fileInfo) => {
      this._webviewManager.postMessage({
        command: "currentFileInfo",
        fileInfo,
        timestamp: Date.now(),
      });
    });
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._webviewManager.setView(webviewView);
    this._hotReloadManager.start();
    this._fileWatcherManager.start();

    setupMessageChannel(webviewView, this._context);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log("🎯 Webview became visible, sending current file info");
        setTimeout(() => {
          this._fileWatcherManager.sendCurrentFileInfo();
        }, 200);
      }
    });

    webviewView.onDidDispose(() => {
      this._dispose();
    });
  }

  private _dispose() {
    this._hotReloadManager.stop();
    this._fileWatcherManager.stop();
  }

  // 公共方法，供命令使用
  public get webviewManager() {
    return this._webviewManager;
  }

  public get fileWatcherManager() {
    return this._fileWatcherManager;
  }
}
