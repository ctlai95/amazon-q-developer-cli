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

  context.subscriptions.push(openTerminalDisposable);

  // Auto-send on file change
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      sendEditorStateUpdate(editor);
    }
  });

  // Send updates when document content changes
  vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      sendEditorStateUpdate(activeEditor);
    }
  });
}

function sendEditorStateUpdate(editor: vscode.TextEditor) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    editor.document.uri
  );
  const relativePath = workspaceFolder
    ? vscode.workspace.asRelativePath(editor.document.uri)
    : editor.document.fileName;

  const data = JSON.stringify({
    jsonrpc: "2.0",
    method: "update_editor_state",
    params: {
      relative_file_path: relativePath,
      language: editor.document.languageId,
      text: editor.document.getText(),
    },
    id: 2,
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
      console.error("Failed to send editor state to Q CLI:", res.statusCode);
    }
  });

  req.on("error", (error) => {
    console.error("Error sending editor state to Q CLI:", error);
  });

  req.write(data);
  req.end();
}

export function deactivate() {}
