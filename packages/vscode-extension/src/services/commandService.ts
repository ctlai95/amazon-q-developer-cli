import * as vscode from "vscode";
import { DiffService } from "./diffService";
import { CliService } from "./cliService";

/**
 * Service for registering and handling VSCode commands
 */
export class CommandService {
  /**
   * Registers all commands for the extension
   * @param context VSCode extension context
   */
  public static registerCommands(context: vscode.ExtensionContext): void {
    // Register the openCLI command
    const openTerminalDisposable = vscode.commands.registerCommand(
      "amazonq.openCLI",
      CommandService.openCLIHandler
    );

    // Register the sendActiveFile command
    const sendActiveFileDisposable = vscode.commands.registerCommand(
      "amazonq.sendActiveFile",
      CommandService.sendActiveFileHandler
    );

    // Register the sendSelectedCode command
    const sendSelectedCodeDisposable = vscode.commands.registerCommand(
      "amazonq.sendSelectedCode",
      CommandService.sendSelectedCodeHandler
    );

    // Register the showFileDiff command
    const showFileDiffDisposable = vscode.commands.registerCommand(
      "amazonq.showFileDiff",
      CommandService.showFileDiffHandler
    );

    // Add all disposables to the context
    context.subscriptions.push(
      openTerminalDisposable,
      sendActiveFileDisposable,
      sendSelectedCodeDisposable,
      showFileDiffDisposable
    );
  }

  /**
   * Handler for the openCLI command
   */
  private static openCLIHandler(): void {
    vscode.commands
      .executeCommand("workbench.action.terminal.new", {
        cwd: "/Users/laileni/Desktop/Q/amazon-q-developer-cli",
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

  /**
   * Handler for the sendActiveFile command
   */
  private static sendActiveFileHandler(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showInformationMessage("No active file");
      return;
    }

    const filePath = activeEditor.document.fileName;
    const line = activeEditor.selection.active.line + 1;
    const message = `Active file: ${filePath}:${line}`;

    CliService.sendToQCli(message);
  }

  /**
   * Handler for the sendSelectedCode command
   */
  private static sendSelectedCodeHandler(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.selection.isEmpty) {
      vscode.window.showInformationMessage("No code selected");
      return;
    }
    CliService.sendSelectedCodeToCli();
    vscode.window.showInformationMessage("Selected code sent to Amazon Q CLI");
  }

  /**
   * Handler for the showFileDiff command
   */
  private static async showFileDiffHandler(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showInformationMessage("No active file");
      return;
    }
    
    // Get the current file content
    const filePath = activeEditor.document.fileName;
    const currentContent = activeEditor.document.getText();
    
    // Ask the user for the modified content or get it from clipboard
    const modifiedContent = await vscode.env.clipboard.readText() || '';
    
    if (!modifiedContent) {
      vscode.window.showInformationMessage("No modified content available in clipboard");
      return;
    }
    
    // Show diff view
    DiffService.showDiffInVSCode(currentContent, modifiedContent, filePath)
      .catch(err => {
        vscode.window.showErrorMessage(`Failed to show diff view: ${err.message}`);
      });
  }
}
