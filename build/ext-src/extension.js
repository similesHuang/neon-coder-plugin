"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
function activate(context) {
    // 注册 WebviewViewProvider
    const provider = new ReactViewProvider(context.extensionPath);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('react-webview', provider));
    // 注册命令
    context.subscriptions.push(vscode.commands.registerCommand('react-webview.start', () => {
        vscode.commands.executeCommand('react-explorer.focus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('react-webview.refresh', () => {
        provider.refresh();
    }));
}
exports.activate = activate;
/**
 * Manages react webview views
 */
class ReactViewProvider {
    constructor(extensionPath) {
        this._extensionPath = extensionPath;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this._extensionPath, 'build'))
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // 启动热更新监听
        this._startHotReload();
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
            }
        });
        // Clean up when the view is disposed
        webviewView.onDidDispose(() => {
            this._dispose();
        });
    }
    refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
    _dispose() {
        // 清理热更新定时器
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
        }
        if (this._buildTimeout) {
            clearTimeout(this._buildTimeout);
        }
    }
    _startHotReload() {
        // 记录文件的最后修改时间
        let lastModifiedTimes = new Map();
        // 初始化文件时间戳
        const srcDir = path.join(this._extensionPath, 'src');
        if (fs.existsSync(srcDir)) {
            const files = this._getAllFiles(srcDir, ['.tsx', '.ts', '.css', '.js']);
            for (const file of files) {
                try {
                    const stats = fs.statSync(file);
                    lastModifiedTimes.set(file, stats.mtime.getTime());
                }
                catch (error) {
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
                const files = this._getAllFiles(srcDir, ['.tsx', '.ts', '.css', '.js']);
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
                    }
                    catch (error) {
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
            }
            catch (error) {
                console.error('Error checking for file changes:', error);
            }
        }, 2000);
    }
    _getAllFiles(dir, extensions) {
        let results = [];
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
                    }
                    else if (extensions.some(ext => file.endsWith(ext))) {
                        results.push(fullPath);
                    }
                }
                catch (error) {
                    // 忽略错误
                }
            }
        }
        catch (error) {
            // 忽略错误
        }
        return results;
    }
    _triggerRebuild() {
        // 防抖处理，避免频繁重建
        if (this._buildTimeout) {
            clearTimeout(this._buildTimeout);
        }
        this._buildTimeout = setTimeout(() => {
            const { exec } = require('child_process');
            console.log('Changes detected, starting rebuild...');
            vscode.window.showInformationMessage('🔄 检测到文件变化，正在重新构建 React 应用...');
            exec('npm run build', { cwd: this._extensionPath }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Build error:', error);
                    vscode.window.showErrorMessage('❌ 构建失败: ' + error.message);
                    return;
                }
                console.log('Build completed successfully');
                // 构建成功后重新加载 webview
                setTimeout(() => {
                    this._updateWebview();
                    vscode.window.showInformationMessage('🎉 React 应用已更新！');
                }, 200);
            });
        }, 1000);
    }
    _updateWebview() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
    _getHtmlForWebview(webview) {
        try {
            const manifestPath = path.join(this._extensionPath, 'build', 'asset-manifest.json');
            if (!fs.existsSync(manifestPath)) {
                return `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
					<h1>🚧 Build files not found</h1>
					<p>Please run <code>npm run build</code> first.</p>
				</body></html>`;
            }
            // 清除 require 缓存以获取最新的 manifest
            delete require.cache[require.resolve(manifestPath)];
            const manifest = require(manifestPath);
            const mainScript = manifest['files']['main.js'];
            const mainStyle = manifest['files']['main.css'];
            if (!mainScript || !mainStyle) {
                return `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
					<h1>❌ Invalid build files</h1>
					<p>Main script: ${mainScript}</p>
					<p>Main style: ${mainStyle}</p>
				</body></html>`;
            }
            const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build', mainScript));
            const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
            const stylePathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build', mainStyle));
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
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline' http: https: data:;">
					<base href="${webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionPath, 'build')))}/">
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
        }
        catch (error) {
            console.error('Error generating HTML for webview:', error);
            return `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
				<h1>💥 Error loading React app</h1>
				<p><strong>Error:</strong> ${error}</p>
				<p>Check the VS Code developer console for more details.</p>
			</body></html>`;
        }
    }
}
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map