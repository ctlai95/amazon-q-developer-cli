import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Handles clean diff view requests from the CLI
 */
export class DiffViewHandler {
    /**
     * Creates a diff view in VSCode showing the differences between original and modified content
     * 
     * @param originalContent The original file content without ASCII formatting
     * @param modifiedContent The modified file content without ASCII formatting
     * @param filePath The path of the file being modified
     * @param title Optional title for the diff view
     * @param isEntireFile Whether the content represents the entire file or just a section
     */
    public static async showDiffView(
        originalContent: string,
        modifiedContent: string,
        filePath: string,
        title?: string,
        isEntireFile: boolean = false
    ): Promise<void> {
        try {
            console.log(`Creating diff view for ${filePath} (entire file: ${isEntireFile})`);
            
            // Create temporary files for the diff view
            const tempDir = path.join(os.tmpdir(), 'amazon-q-diff-view');
            
            // Ensure temp directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Generate unique filenames based on the original file
            const fileName = path.basename(filePath);
            const fileExt = path.extname(filePath);
            const fileNameWithoutExt = path.basename(filePath, fileExt);
            const timestamp = new Date().getTime();
            
            // Create temp files for original and modified content
            const originalFile = path.join(tempDir, `${fileNameWithoutExt}.original-${timestamp}${fileExt}`);
            const modifiedFile = path.join(tempDir, `${fileNameWithoutExt}.modified-${timestamp}${fileExt}`);
            
            // Write content to temp files
            fs.writeFileSync(originalFile, originalContent);
            fs.writeFileSync(modifiedFile, modifiedContent);
            
            // Create URIs for the diff editor
            const originalUri = vscode.Uri.file(originalFile);
            const modifiedUri = vscode.Uri.file(modifiedFile);
            
            // Show the diff in VSCode
            const diffTitle = title || `Diff: ${fileName}`;
            await vscode.commands.executeCommand('vscode.diff', 
                originalUri, 
                modifiedUri, 
                diffTitle
            );
            
            console.log('Diff view created successfully');
            
            // Schedule cleanup of temp files after some time
            setTimeout(() => {
                try {
                    if (fs.existsSync(originalFile)) {
                        fs.unlinkSync(originalFile);
                    }
                    if (fs.existsSync(modifiedFile)) {
                        fs.unlinkSync(modifiedFile);
                    }
                } catch (error) {
                    console.error('Error cleaning up temp files:', error);
                }
            }, 300000); // Clean up after 5 minutes
            
        } catch (error) {
            console.error('Error creating diff view:', error);
            vscode.window.showErrorMessage(`Failed to create diff view: ${error}`);
        }
    }
    
    /**
     * Handles a clean diff view request from the CLI
     * 
     * @param params Parameters from the CLI request
     */
    public static async handleCleanDiffRequest(params: any): Promise<void> {
        const { originalContent, modifiedContent, filePath, title, isEntireFile } = params;
        
        if (!originalContent || !modifiedContent || !filePath) {
            console.error('Missing required parameters for diff view');
            vscode.window.showErrorMessage('Missing required parameters for diff view');
            return;
        }
        
        await this.showDiffView(
            originalContent, 
            modifiedContent, 
            filePath, 
            title, 
            isEntireFile === true
        );
    }
}
