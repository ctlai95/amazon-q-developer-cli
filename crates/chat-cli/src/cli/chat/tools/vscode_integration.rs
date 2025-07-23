use eyre::{Result, eyre};
use serde_json::json;
use std::path::Path;

/// Sends a file modification request to the VSCode extension with clean diff view
/// This function sends the raw file content without ASCII formatting characters using WebSockets
pub async fn send_clean_diff_to_vscode(
    original_content: &str,
    modified_content: &str,
    file_path: &Path,
) -> Result<()> {
    tracing::info!("Attempting to send clean diff to VSCode via WebSockets for file: {:?}", file_path);
    
    let file_name = file_path.file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("file");
    
    let extension = file_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    
    // Create the request params with additional metadata
    let params = json!({
        "type": "clean_diff_view",
        "originalContent": original_content,
        "modifiedContent": modified_content,
        "filePath": file_path.to_string_lossy(),
        "fileName": file_name,
        "fileExtension": extension,
        "title": format!("Diff: {}", file_path.to_string_lossy()),
        "isEntireFile": true  // Flag to indicate we're sending the entire file content
    });
    
    tracing::debug!("Sending clean diff via WebSockets to VSCode extension");
    
    // Send notification through the JSON-RPC WebSocket server
    crate::jsonrpc_server::notify_ide("file_modification", params)?;
    
    tracing::info!("Successfully sent clean diff to VSCode via WebSockets");
    Ok(())
}

/// Checks if VSCode integration is available
pub async fn is_vscode_integration_available() -> bool {
    tracing::debug!("Checking if VSCode integration is available");
    
    // First check for environment variables that indicate we're running in VSCode
    if let Ok(term_program) = std::env::var("TERM_PROGRAM") {
        if term_program == "vscode" {
            tracing::debug!("VSCode detected via TERM_PROGRAM environment variable");
            // Even if we detect VSCode, we still need to check if the WebSocket connection is active
        }
    }
    
    // Check for VSCode extension ID in VSCODE_EXTENSIONS
    if let Ok(extensions) = std::env::var("VSCODE_EXTENSIONS") {
        if extensions.contains("amazonwebservices.amazon-q-developer") {
            tracing::debug!("Amazon Q Developer extension detected in VSCODE_EXTENSIONS");
            // Extension is installed, but we still need to check if the WebSocket connection is active
        }
    }
    
    // Check if the WebSocket connection is active by checking WS_SENDER in jsonrpc_server
    let is_available = crate::jsonrpc_server::is_websocket_connected();
    
    tracing::debug!("VSCode integration available via WebSocket: {}", is_available);
    is_available
}
