import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

/**
 * Service for handling diff view operations
 */
export class DiffService {
  /**
   * Shows a diff view using VSCode's native API
   * @param originalContent Original file content
   * @param modifiedContent Modified file content
   * @param filePath Path to the file being compared
   */
  public static async showDiffInVSCode(
    originalContent: string,
    modifiedContent: string,
    filePath: string
  ): Promise<void> {
    console.log(`Showing diff view for file: ${filePath}`);
    const amazonQTabSuffix = " (Amazon Q Diff)";
    
    // Create temporary files for the diff view
    const tmpDir = os.tmpdir();
    const fileName = path.basename(filePath);
    const originalFilePath = path.join(tmpDir, `original-${fileName}`);
    const modifiedFilePath = path.join(tmpDir, `modified-${fileName}`);
    
    console.log(`Creating temporary files: ${originalFilePath} and ${modifiedFilePath}`);
    
    try {
      // Write content to temporary files
      await fs.promises.writeFile(originalFilePath, originalContent);
      await fs.promises.writeFile(modifiedFilePath, modifiedContent);
      
      // Create URIs for the diff view
      const originalFileUri = vscode.Uri.file(originalFilePath);
      const modifiedFileUri = vscode.Uri.file(modifiedFilePath);
      
      console.log(`Executing vscode.diff command with URIs: ${originalFileUri} and ${modifiedFileUri}`);
      
      // Show diff in VSCode's native diff view
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalFileUri,
        modifiedFileUri,
        `${fileName}${amazonQTabSuffix}`
      );
      
      console.log(`Successfully showed diff view for ${fileName}`);
    } catch (error) {
      console.error(`Error showing diff view: ${error}`);
      throw error;
    }
  }

  /**
   * Cleans up temporary files created for diff views
   */
  public static cleanupTempFiles(): void {
    try {
      const tmpDir = os.tmpdir();
      const files = fs.readdirSync(tmpDir);
      
      // Find and delete temporary files created for diffs
      files.forEach(file => {
        if (file.startsWith('original-') || file.startsWith('modified-')) {
          try {
            fs.unlinkSync(path.join(tmpDir, file));
          } catch (err) {
            console.error(`Failed to delete temporary file ${file}:`, err);
          }
        }
      });
    } catch (err) {
      console.error('Error cleaning up temporary files:', err);
    }
  }
}
