import * as vscode from "vscode";
import { getCurrentFileInfo } from "../uitils/files";

export class FileWatcherManager {
  private _fileChangeDisposables: vscode.Disposable[] = [];
  private _onFileChangeCallback?: (fileInfo: any) => void;

  public setFileChangeCallback(callback: (fileInfo: any) => void) {
    this._onFileChangeCallback = callback;
  }

  public start() {
    this._setupFileWatchers();
  }

  public stop() {
    this._fileChangeDisposables.forEach((disposable) => disposable.dispose());
    this._fileChangeDisposables = [];
  }

  private _setupFileWatchers() {
    // 监听活动编辑器变化
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(
      () => {
        this._sendCurrentFileInfo();
      }
    );
    this._fileChangeDisposables.push(activeEditorDisposable);

    // 监听文本选择变化
    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(
      () => {
        this._sendCurrentFileInfo();
      }
    );
    this._fileChangeDisposables.push(selectionDisposable);

    // 监听文档内容变化
    const documentDisposable = vscode.workspace.onDidChangeTextDocument(() => {
      setTimeout(() => {
        this._sendCurrentFileInfo();
      }, 300);
    });
    this._fileChangeDisposables.push(documentDisposable);
  }

  private _sendCurrentFileInfo() {
    const fileInfo = getCurrentFileInfo();
    this._onFileChangeCallback?.(fileInfo);
  }

  public sendCurrentFileInfo() {
    this._sendCurrentFileInfo();
  }
}
