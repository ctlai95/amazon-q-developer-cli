import * as vscode from "vscode";
import { CliService } from "./cliService";

/**
 * Service for tracking text selection in the editor
 */
export class SelectionService {
  private static isSelecting: boolean = false;
  private static lastSelection: vscode.Selection | null = null;
  private static lastSelectionTime: number = 0;
  private static lastSentSelection: vscode.Selection | null = null;
  private static selectionStabilityTimer: NodeJS.Timeout | null = null;

  /**
   * Initializes the selection tracking service
   * @param context VSCode extension context
   */
  public static initialize(context: vscode.ExtensionContext): void {
    // Detect selection changes
    const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
      SelectionService.handleSelectionChange(event);
    });
    
    // Detect when selection is complete on focus change events
    const focusChangeDisposable = vscode.window.onDidChangeWindowState((event) => {
      if (event.focused && SelectionService.isSelecting) {
        // Force immediate selection stability check when window gets focus
        if (SelectionService.selectionStabilityTimer) {
          clearTimeout(SelectionService.selectionStabilityTimer);
        }
        SelectionService.checkSelectionStability();
      }
    });
    
    // Detect selection completion on editor clicks
    const documentClickDisposable = vscode.commands.registerCommand('editor.action.mouseCommand', () => {
      // Force immediate stability check on mouse commands
      if (SelectionService.isSelecting) {
        if (SelectionService.selectionStabilityTimer) {
          clearTimeout(SelectionService.selectionStabilityTimer);
        }
        SelectionService.checkSelectionStability();
      }
    });
    
    // Add keyboard shortcut triggers for selection completion
    const keyReleaseDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      // Text document changes might also indicate end of selection via keyboard
      if (SelectionService.isSelecting) {
        if (SelectionService.selectionStabilityTimer) {
          clearTimeout(SelectionService.selectionStabilityTimer);
        }
        SelectionService.checkSelectionStability();
      }
    });
    
    // Register all disposables to ensure proper cleanup when extension is deactivated
    context.subscriptions.push(
      selectionChangeDisposable,
      focusChangeDisposable,
      documentClickDisposable,
      keyReleaseDisposable
    );
  }

  /**
   * Handles selection change events
   * @param event Selection change event
   */
  private static handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    const editor = event.textEditor;
    const selection = editor.selection;
    
    // Skip empty selections
    if (selection.isEmpty) {
      SelectionService.isSelecting = false;
      if (SelectionService.selectionStabilityTimer) {
        clearTimeout(SelectionService.selectionStabilityTimer);
        SelectionService.selectionStabilityTimer = null;
      }
      return;
    }
    
    // Update tracking state
    SelectionService.lastSelectionTime = Date.now();
    SelectionService.isSelecting = true;
    
    // Store current selection state
    SelectionService.lastSelection = new vscode.Selection(
      selection.anchor,
      selection.active
    );
    
    // Clear any existing timer and set a new one
    if (SelectionService.selectionStabilityTimer) {
      clearTimeout(SelectionService.selectionStabilityTimer);
    }
    
    // Check if selection becomes stable
    SelectionService.selectionStabilityTimer = setTimeout(() => {
      SelectionService.checkSelectionStability();
    }, 300);
  }

  /**
   * Checks if the current selection is stable
   */
  private static checkSelectionStability(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || !SelectionService.isSelecting) {
      return;
    }
    
    const currentSelection = activeEditor.selection;
    if (currentSelection.isEmpty) {
      SelectionService.isSelecting = false;
      return;
    }
    
    const now = Date.now();
    const timeSinceLastChange = now - SelectionService.lastSelectionTime;
    
    // Selection is considered stable after 300ms without changes
    if (timeSinceLastChange >= 300 && SelectionService.lastSelection) {
      // Check if this selection was already sent
      const isDifferentFromLast = !SelectionService.lastSentSelection || 
        !SelectionService.selectionsEqual(currentSelection, SelectionService.lastSentSelection);
      
      if (isDifferentFromLast) {
        // Selection is stable and different from last sent one
        CliService.sendSelectedCodeToCli();
        SelectionService.lastSentSelection = new vscode.Selection(
          currentSelection.anchor,
          currentSelection.active
        );
        SelectionService.isSelecting = false;
      }
    }
  }

  /**
   * Checks if two selections are equal
   * @param sel1 First selection
   * @param sel2 Second selection
   * @returns True if selections are equal, false otherwise
   */
  private static selectionsEqual(sel1: vscode.Selection, sel2: vscode.Selection): boolean {
    return sel1.anchor.isEqual(sel2.anchor) && 
           sel1.active.isEqual(sel2.active);
  }
}
