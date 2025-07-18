use eyre::{Result, eyre};
use serde_json::json;
use reqwest::Client;
use std::time::Duration;
use std::path::Path;

/// Sends a file modification request to the VSCode extension with clean diff view
/// This function sends the raw file content without ASCII formatting characters
pub async fn send_clean_diff_to_vscode(
    original_content: &str,
    modified_content: &str,
    file_path: &Path,
) -> Result<()> {
    tracing::info!("Attempting to send clean diff to VSCode for file: {:?}", file_path);
    
    // Create the request payload with clean content
    let payload = json!({
        "jsonrpc": "2.0",
        "method": "file_modification",
        "params": {
            "type": "clean_diff_view",
            "originalContent": original_content,
            "modifiedContent": modified_content,
            "filePath": file_path.to_string_lossy(),
        },
        "id": 1
    });
    
    tracing::debug!("Sending clean diff request to VSCode extension server");
    
    // Use a client with a short timeout
    let client = Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| {
            tracing::error!("Failed to build HTTP client: {}", e);
            eyre!("Failed to build HTTP client: {}", e)
        })?;
    
    // Send the request to the VSCode extension server with a timeout
    let response = match tokio::time::timeout(
        Duration::from_secs(3),
        client.post("http://127.0.0.1:3031/")
            .json(&payload)
            .send()
    ).await {
        Ok(result) => result.map_err(|e| {
            tracing::error!("Failed to send clean diff to VSCode: {}", e);
            eyre!("Failed to send clean diff to VSCode: {}", e)
        })?,
        Err(_) => {
            let error_msg = "Request to VSCode extension timed out";
            tracing::error!("{}", error_msg);
            return Err(eyre!(error_msg));
        }
    };
    
    if !response.status().is_success() {
        let error_msg = format!("VSCode extension returned error status: {}", response.status());
        tracing::error!("{}", error_msg);
        return Err(eyre!(error_msg));
    }
    
    tracing::info!("Successfully sent clean diff to VSCode");
    Ok(())
}

/// Checks if VSCode integration is available
pub async fn is_vscode_integration_available() -> bool {
    tracing::debug!("Checking if VSCode integration is available");
    
    // First check for environment variables that indicate we're running in VSCode
    if let Ok(term_program) = std::env::var("TERM_PROGRAM") {
        if term_program == "vscode" {
            tracing::debug!("VSCode detected via TERM_PROGRAM environment variable");
            // Even if we detect VSCode, we still need to check if the extension server is running
        }
    }
    
    // Check for VSCode extension ID in VSCODE_EXTENSIONS
    if let Ok(extensions) = std::env::var("VSCODE_EXTENSIONS") {
        if extensions.contains("amazonwebservices.amazon-q-developer") {
            tracing::debug!("Amazon Q Developer extension detected in VSCODE_EXTENSIONS");
            // Extension is installed, but we still need to check if the server is running
        }
    }
    
    // Simple check to see if we can connect to the VSCode extension server
    let client = Client::new();
    
    // Use a very short timeout to avoid blocking for too long
    let response = match tokio::time::timeout(
        Duration::from_millis(300),
        client.get("http://127.0.0.1:3031/health").send()
    ).await {
        Ok(result) => result,
        Err(_) => {
            tracing::debug!("VSCode integration check timed out");
            return false;
        }
    };
    
    let is_available = match response {
        Ok(resp) => resp.status().is_success(),
        Err(e) => {
            tracing::debug!("VSCode integration not available: {}", e);
            false
        }
    };
    
    tracing::debug!("VSCode integration available: {}", is_available);
    is_available
}
