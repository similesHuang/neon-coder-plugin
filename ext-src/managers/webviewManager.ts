import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export class WebviewManager {
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  public get view(): vscode.WebviewView | undefined {
    return this._view;
  }

  public setView(view: vscode.WebviewView) {
    this._view = view;
    this._configureWebview(view);
  }

  public postMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _configureWebview(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._context.extensionPath, "build")),
        vscode.Uri.joinPath(this._context.extensionUri, "images"), // 图片目录
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
  }

  public getHtmlForWebview(webview: vscode.Webview): string {
    try {
      const manifestPath = path.join(
        this._context.extensionPath,
        "build",
        "asset-manifest.json"
      );

      if (!fs.existsSync(manifestPath)) {
        return this._getErrorHtml(
          "Build files not found",
          "Please run <code>npm run build</code> first."
        );
      }

      // 清除 require 缓存以获取最新的 manifest
      delete require.cache[require.resolve(manifestPath)];
      const manifest = require(manifestPath);

      const mainScript = manifest["files"]["main.js"];
      const mainStyle = manifest["files"]["main.css"];

      if (!mainScript || !mainStyle) {
        return this._getErrorHtml(
          "Invalid build files",
          `Main script: ${mainScript}<br>Main style: ${mainStyle}`
        );
      }

      const scriptPathOnDisk = vscode.Uri.file(
        path.join(this._context.extensionPath, "build", mainScript)
      );
      const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
      const stylePathOnDisk = vscode.Uri.file(
        path.join(this._context.extensionPath, "build", mainStyle)
      );
      const styleUri = webview.asWebviewUri(stylePathOnDisk);

      const nonce = this._generateNonce();

      return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
          <meta name="theme-color" content="#000000">
          <title>Neon Coder</title>
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
      return this._getErrorHtml("Error loading React app", `Error: ${error}`);
    }
  }

  private _getErrorHtml(title: string, message: string): string {
    return `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
      <h1>💥 ${title}</h1>
      <p>${message}</p>
      <p>Check the VS Code developer console for more details.</p>
    </body></html>`;
  }

  private _generateNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public updateWebview() {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview(this._view.webview);
    }
  }
}
