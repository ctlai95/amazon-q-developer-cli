import * as vscode from "vscode";
import { CommandService } from "./services/commandService";
import { SelectionService } from "./services/selectionService";
import { ServerService } from "./services/serverService";
import { DiffService } from "./services/diffService";

/**
 * Activates the extension
 * @param context VSCode extension context
 */
export function activate(context: vscode.ExtensionContext) {
  // Register commands
  CommandService.registerCommands(context);
  
  // Initialize selection tracking
  SelectionService.initialize(context);
  
  // Start server for CLI communication
  const server = new ServerService();
  server.start()
    .then(() => {
      console.log("Amazon Q CLI integration server started");
    })
    .catch(err => {
      console.error("Failed to start Amazon Q CLI integration server:", err);
    });
  
  // Make sure to close the server when the extension is deactivated
  context.subscriptions.push({
    dispose: () => {
      server.stop();
    }
  });
  
  // Auto-send on file change
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      const filePath = editor.document.fileName;
      const message = `Active file: ${filePath}`;
      
      // Import here to avoid circular dependencies
      const { CliService } = require('./services/cliService');
      CliService.sendToQCli(message);
    }
  });
}

/**
 * Deactivates the extension
 */
export function deactivate() {
  // Clean up temporary files
  DiffService.cleanupTempFiles();
}
