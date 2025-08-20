import * as vscode from "vscode";

export class McpServerManager {
  public async manageMcpServers() {
    const actions = [
      { label: "添加新的 MCP 服务器", action: "add" },
      { label: "查看现有服务器", action: "view" },
      { label: "删除服务器", action: "delete" },
    ];

    const selectedAction = await vscode.window.showQuickPick(actions, {
      placeHolder: "选择要执行的操作",
    });

    if (!selectedAction) return;

    switch (selectedAction.action) {
      case "add":
        await this._addMcpServer();
        break;
      case "view":
        await this._viewMcpServers();
        break;
      case "delete":
        await this._deleteMcpServer();
        break;
    }
  }

  private async _addMcpServer() {
    const serverType = await vscode.window.showQuickPick(
      [
        {
          label: "HTTP Server",
          value: "http",
          description: "通过HTTP通信的服务器",
        },
      ],
      { placeHolder: "选择服务器类型" }
    );

    if (!serverType) return;

    const name = await vscode.window.showInputBox({
      prompt: "输入服务器名称",
      placeHolder: "my-custom-server",
    });

    if (!name) return;

    const description = await vscode.window.showInputBox({
      prompt: "输入服务器描述（可选）",
      placeHolder: "My custom MCP server",
    });

    let serverConfig: any = {
      type: serverType.value,
      name,
      description: description || name,
    };

    if (serverType.value === "stdio") {
      const command = await vscode.window.showInputBox({
        prompt: "输入命令",
        placeHolder: "node",
      });

      if (!command) return;

      const argsInput = await vscode.window.showInputBox({
        prompt: "输入参数（用空格分隔）",
        placeHolder: "/path/to/server.js --option value",
      });

      serverConfig.command = command;
      serverConfig.args = argsInput ? argsInput.split(" ") : [];
    } else {
      const url = await vscode.window.showInputBox({
        prompt: "输入服务器URL",
        placeHolder: "http://localhost:8080/mcp",
      });

      if (!url) return;
      serverConfig.url = url;
    }

    // 添加到配置
    const config = vscode.workspace.getConfiguration("neonCoder");
    const currentServers = config.get<string[]>("mcpServers", []);
    currentServers.push(JSON.stringify(serverConfig));

    await config.update(
      "mcpServers",
      currentServers,
      vscode.ConfigurationTarget.Global
    );
    vscode.window.showInformationMessage(`MCP服务器 "${name}" 已添加！`);
  }

  private async _viewMcpServers() {
    const config = vscode.workspace.getConfiguration("neonCoder");
    const servers = config.get<string[]>("mcpServers", []);

    if (servers.length === 0) {
      vscode.window.showInformationMessage("还没有配置任何MCP服务器");
      return;
    }

    const serverList = servers
      .map((serverStr, index) => {
        try {
          const server = JSON.parse(serverStr);
          return `${index + 1}. ${server.name} (${server.type}) - ${
            server.description || "无描述"
          }`;
        } catch {
          return `${index + 1}. [无效配置] ${serverStr.substring(0, 50)}...`;
        }
      })
      .join("\n");

    vscode.window.showInformationMessage(
      `已配置的MCP服务器:\n\n${serverList}`,
      { modal: true }
    );
  }

  private async _deleteMcpServer() {
    const config = vscode.workspace.getConfiguration("neonCoder");
    const servers = config.get<string[]>("mcpServers", []);

    if (servers.length === 0) {
      vscode.window.showInformationMessage("没有可删除的MCP服务器");
      return;
    }

    const options = servers.map((serverStr, index) => {
      try {
        const server = JSON.parse(serverStr);
        return {
          label: server.name,
          description: `${server.type} - ${server.description || "无描述"}`,
          index,
        };
      } catch {
        return {
          label: `服务器 ${index + 1}`,
          description: "[无效配置]",
          index,
        };
      }
    });

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: "选择要删除的服务器",
    });

    if (!selected) return;

    const confirm = await vscode.window.showWarningMessage(
      `确定要删除服务器 "${selected.label}" 吗？`,
      { modal: true },
      "删除"
    );

    if (confirm === "删除") {
      servers.splice(selected.index, 1);
      await config.update(
        "mcpServers",
        servers,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage(`已删除服务器 "${selected.label}"`);
    }
  }
}
