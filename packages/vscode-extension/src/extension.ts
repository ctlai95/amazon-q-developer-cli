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

  let sendActiveFileDisposable = vscode.commands.registerCommand(
    "amazonq.sendActiveFile",
    () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showInformationMessage("No active file");
        return;
      }

      sendEditorStateUpdate(activeEditor);
    }
  );

  // Command to manually send selected code to Amazon Q CLI
  let sendSelectedCodeDisposable = vscode.commands.registerCommand(
    "amazonq.sendSelectedCode",
    () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.selection.isEmpty) {
        vscode.window.showInformationMessage("No code selected");
        return;
      }
      sendSelectedCodeToCli();
      vscode.window.showInformationMessage(
        "Selected code sent to Amazon Q CLI"
      );
    }
  );

  // Register all commands
  context.subscriptions.push(
    openTerminalDisposable,
    sendActiveFileDisposable,
    sendSelectedCodeDisposable
  );

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

  // Track selection state to detect when selection is complete
  let isSelecting = false;
  let lastSelection: vscode.Selection | null = null;
  let lastSelectionTime = 0;
  let lastSentSelection: vscode.Selection | null = null;
  let selectionStabilityTimer: NodeJS.Timeout | null = null;

  // Function to check if selections are equal
  function selectionsEqual(
    sel1: vscode.Selection,
    sel2: vscode.Selection
  ): boolean {
    return sel1.anchor.isEqual(sel2.anchor) && sel1.active.isEqual(sel2.active);
  }

  // Function to check if selection is stable and send if needed
  function checkSelectionStability() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || !isSelecting) {
      return;
    }

    const currentSelection = activeEditor.selection;
    if (currentSelection.isEmpty) {
      isSelecting = false;
      return;
    }

    const now = Date.now();
    const timeSinceLastChange = now - lastSelectionTime;

    // Selection is considered stable after 300ms without changes
    if (timeSinceLastChange >= 300 && lastSelection) {
      // Check if this selection was already sent
      const isDifferentFromLast =
        !lastSentSelection ||
        !selectionsEqual(currentSelection, lastSentSelection);

      if (isDifferentFromLast) {
        // Selection is stable and different from last sent one
        sendSelectedCodeToCli();
        lastSentSelection = new vscode.Selection(
          currentSelection.anchor,
          currentSelection.active
        );
        isSelecting = false;
      }
    }
  }

  // Detect selection changes
  let selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(
    (event) => {
      const editor = event.textEditor;
      const selection = editor.selection;

      // Skip empty selections
      if (selection.isEmpty) {
        isSelecting = false;
        if (selectionStabilityTimer) {
          clearTimeout(selectionStabilityTimer);
          selectionStabilityTimer = null;
        }
        return;
      }

      // Update tracking state
      lastSelectionTime = Date.now();
      isSelecting = true;

      // Store current selection state
      lastSelection = new vscode.Selection(selection.anchor, selection.active);

      // Clear any existing timer and set a new one
      if (selectionStabilityTimer) {
        clearTimeout(selectionStabilityTimer);
      }

      // Check if selection becomes stable
      selectionStabilityTimer = setTimeout(() => {
        checkSelectionStability();
      }, 300);
    }
  );

  // Detect when selection is complete on focus change events
  let focusChangeDisposable = vscode.window.onDidChangeWindowState((event) => {
    if (event.focused && isSelecting) {
      // Force immediate selection stability check when window gets focus
      if (selectionStabilityTimer) {
        clearTimeout(selectionStabilityTimer);
      }
      checkSelectionStability();
    }
  });

  // Detect selection completion on editor clicks
  let documentClickDisposable = vscode.commands.registerCommand(
    "editor.action.mouseCommand",
    () => {
      // Force immediate stability check on mouse commands
      if (isSelecting) {
        if (selectionStabilityTimer) {
          clearTimeout(selectionStabilityTimer);
        }
        checkSelectionStability();
      }
    }
  );

  // Add keyboard shortcut triggers for selection completion
  let keyReleaseDisposable = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      // Text document changes might also indicate end of selection via keyboard
      if (isSelecting) {
        if (selectionStabilityTimer) {
          clearTimeout(selectionStabilityTimer);
        }
        checkSelectionStability();
      }
    }
  );

  // Register all disposables to ensure proper cleanup when extension is deactivated
  context.subscriptions.push(
    selectionChangeDisposable,
    focusChangeDisposable,
    documentClickDisposable,
    keyReleaseDisposable
  );
}

// Function to send selected code to CLI
function sendSelectedCodeToCli() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor || activeEditor.selection.isEmpty) {
    // Don't show any message when there's no selection
    return;
  }

  const filePath = activeEditor.document.fileName;
  const selection = activeEditor.selection;
  const selectedText = activeEditor.document.getText(selection);
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;
  const startChar = selection.start.character + 1;
  const endChar = selection.end.character + 1;

  // Format the message with file path, line range, and selected code
  // Use a consistent format similar to sendActiveFileDisposable
  const message = `Selected code from ${filePath}: L${startLine}:${startChar} - L${endLine}:${endChar}`;

  // TODO: Send this as editor context
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
