import * as vscode from "vscode";
import * as http from "http";

export function activate(context: vscode.ExtensionContext) {
  // Command to open Amazon Q CLI terminal
  let openTerminalDisposable = vscode.commands.registerCommand(
    "amazonq.openCLI",
    () => {
      vscode.commands
        .executeCommand("workbench.action.terminal.new", {
          cwd: "/Volumes/workplace/github/amazon-q-developer-cli",
          name: "Amazon Q CLI",
        })
        .then(() => {
          // Move terminal to editor area first
          vscode.commands
            .executeCommand("workbench.action.terminal.moveToEditor")
            .then(() => {
              // Wait a bit then move terminal to the right
              setTimeout(() => {
                vscode.commands.executeCommand(
                  "workbench.action.moveEditorToRightGroup"
                );
              }, 100);
            });
          // Send command to terminal
          const terminal = vscode.window.activeTerminal;
          if (terminal) {
            terminal.sendText(
              "source ~/.cargo/env && cargo run --bin chat_cli"
            );
          }
        });
    }
  );

  let disposable = vscode.commands.registerCommand(
    "amazonq.sendActiveFile",
    () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showInformationMessage("No active file");
        return;
      }

      const filePath = activeEditor.document.fileName;
      const line = activeEditor.selection.active.line + 1;
      const message = `Active file: ${filePath}:${line}`;

      sendToQCli(message);
    }
  );

  context.subscriptions.push(openTerminalDisposable, disposable);

  // Auto-send on file change
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      const filePath = editor.document.fileName;
      const message = `Active file: ${filePath}`;
      sendToQCli(message);
    }
  });
}

function sendToQCli(message: string) {
  const data = JSON.stringify({
    jsonrpc: "2.0",
    method: "display_message",
    params: [message],
    id: 1,
  });

  const options = {
    hostname: "127.0.0.1",
    port: 3030,
    path: "/",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  const req = http.request(options, (res) => {
    if (res.statusCode !== 200) {
      console.error("Failed to send to Q CLI:", res.statusCode);
    }
  });

  req.on("error", (error) => {
    console.error("Error sending to Q CLI:", error);
  });

  req.write(data);
  req.end();
}

export function deactivate() {}
