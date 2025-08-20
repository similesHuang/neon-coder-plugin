import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export class HotReloadManager {
  private _updateInterval: NodeJS.Timeout | undefined;
  private _buildTimeout: NodeJS.Timeout | undefined;
  private _lastModifiedTimes = new Map<string, number>();
  private _context: vscode.ExtensionContext;
  private _onReloadCallback?: () => void;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  public setReloadCallback(callback: () => void) {
    this._onReloadCallback = callback;
  }

  public start() {
    this._initializeFileTimestamps();
    this._startFileWatcher();
  }

  public stop() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = undefined;
    }
    if (this._buildTimeout) {
      clearTimeout(this._buildTimeout);
      this._buildTimeout = undefined;
    }
  }

  private _initializeFileTimestamps() {
    const srcDir = path.join(this._context.extensionPath, "src");
    if (fs.existsSync(srcDir)) {
      const files = this._getAllFiles(srcDir, [".tsx", ".ts", ".css", ".js"]);
      for (const file of files) {
        try {
          const stats = fs.statSync(file);
          this._lastModifiedTimes.set(file, stats.mtime.getTime());
        } catch (error) {
          // 忽略错误
        }
      }
    }
  }

  private _startFileWatcher() {
    this._updateInterval = setInterval(() => {
      this._checkForChanges();
    }, 2000);
  }

  private _checkForChanges() {
    try {
      const srcDir = path.join(this._context.extensionPath, "src");
      if (!fs.existsSync(srcDir)) {
        return;
      }

      const files = this._getAllFiles(srcDir, [".tsx", ".ts", ".css", ".js"]);
      let hasChanges = false;

      for (const file of files) {
        try {
          const stats = fs.statSync(file);
          const lastModified = stats.mtime.getTime();
          const previousTime = this._lastModifiedTimes.get(file);

          if (previousTime && previousTime !== lastModified) {
            hasChanges = true;
            console.log(`File changed: ${file}`);
          }

          this._lastModifiedTimes.set(file, lastModified);
        } catch (error) {
          if (this._lastModifiedTimes.has(file)) {
            this._lastModifiedTimes.delete(file);
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
  }

  private _triggerRebuild() {
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
          setTimeout(() => {
            this._onReloadCallback?.();
            vscode.window.showInformationMessage("🎉 React 应用已更新！");
          }, 200);
        }
      );
    }, 1000);
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
}
