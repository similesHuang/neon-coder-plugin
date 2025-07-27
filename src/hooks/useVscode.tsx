let vscode: any = null;
export const getVSCodeInstance = () => {
  if (!vscode && window?.acquireVsCodeApi) {
    vscode = window.acquireVsCodeApi();
  }
  return vscode;
};

export default getVSCodeInstance;
