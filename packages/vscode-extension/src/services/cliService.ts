import * as http from "http";
import * as vscode from "vscode";
import { DiffService } from "./diffService";

/**
 * Service for communicating with the Amazon Q CLI
 */
export class CliService {
  /**
   * Sends a message to the Q CLI
   * @param message Message to send
   */
  public static sendToQCli(message: string): void {
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
        return;
      }
      
      // Handle response data
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (responseData) {
            const response = JSON.parse(responseData);
            
            // Check if this is a file modification request
            if (response.result && response.result.type === 'file_modification') {
              CliService.handleFileModificationRequest(response.result);
            }
          }
        } catch (error) {
          console.error('Error processing response from Q CLI:', error);
        }
      });
    });
  
    req.on("error", (error) => {
      console.error("Error sending to Q CLI:", error);
    });
  
    req.write(data);
    req.end();
  }

  /**
   * Sends selected code to the CLI
   */
  public static sendSelectedCodeToCli(): void {
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
    const message = `Selected code from ${filePath}: L${startLine}:${startChar} - L${endLine}:${endChar}`;
  
    CliService.sendToQCli(message);
  }

  /**
   * Handles file modification requests from the CLI
   * @param message File modification message
   * @returns True if the request was handled, false otherwise
   */
  private static handleFileModificationRequest(message: any): boolean {
    try {
      if (message && message.type === 'file_modification') {
        const { originalContent, modifiedContent, filePath } = message;
        DiffService.showDiffInVSCode(originalContent, modifiedContent, filePath)
          .catch(err => {
            vscode.window.showErrorMessage(`Failed to show diff view: ${err.message}`);
          });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error handling file modification request:', error);
      return false;
    }
  }
}
