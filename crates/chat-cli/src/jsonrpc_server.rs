use eyre::Result;
use serde_json::{
    Value,
    json,
};
use warp::Filter;

use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

#[derive(Debug, Clone, Default)]
pub struct EditorInfo {
    pub relative_file_path: Option<String>,
    pub language: Option<String>,
    pub text: Option<String>,
}

static CURRENT_EDITOR: Lazy<Arc<Mutex<EditorInfo>>> = Lazy::new(|| Arc::new(Mutex::new(EditorInfo::default())));

pub fn get_current_editor_state() -> Option<crate::api_client::model::EditorState> {
    let editor_info = CURRENT_EDITOR.lock().unwrap();

    if let Some(ref path) = editor_info.relative_file_path {
        Some(crate::api_client::model::EditorState {
            document: Some(crate::api_client::model::TextDocument {
                relative_file_path: path.clone(),
                programming_language: None,
                text: editor_info.text.clone(),
                document_symbols: None,
            }),
            cursor_state: None,
            relevant_documents: None,
            use_relevant_documents: Some(false),
            workspace_folders: None,
        })
    } else {
        None
    }
}

pub fn set_current_editor(info: EditorInfo) {
    *CURRENT_EDITOR.lock().unwrap() = info;

    if let Some(ref path) = CURRENT_EDITOR.lock().unwrap().relative_file_path {
        use crossterm::{cursor, execute, style, terminal};
        use crossterm::style::{Color, Stylize};
        use std::io;

        let mut stdout = io::stdout();
        let _ = execute!(
            stdout,
            cursor::SavePosition,
            cursor::MoveUp(1),
            terminal::Clear(terminal::ClearType::CurrentLine),
            style::Print(format!("📄 {}", path.clone().with(Color::DarkGrey))),
            cursor::RestorePosition
        );
    }
}

pub struct JsonRpcServer;

#[derive(serde::Deserialize)]
struct JsonRpcRequest {
    method: String,
    params: Option<Value>,
    id: Option<Value>,
}

impl JsonRpcServer {
    pub fn new() -> Self {
        Self
    }

    pub fn start(&self, port: u16) -> Result<()> {
        let rpc = warp::path::end()
            .and(warp::post())
            .and(warp::body::json())
            .and_then(move |req: JsonRpcRequest| {
                async move {
                    if req.method == "update_editor_state" {
                        if let Some(params) = req.params {
                            let mut editor_info = EditorInfo::default();

                            if let Some(path) = params.get("relative_file_path").and_then(|v| v.as_str()) {
                                editor_info.relative_file_path = Some(path.to_string());
                            }
                            if let Some(lang) = params.get("language").and_then(|v| v.as_str()) {
                                editor_info.language = Some(lang.to_string());
                            }
                            if let Some(text) = params.get("text").and_then(|v| v.as_str()) {
                                editor_info.text = Some(text.to_string());
                            }

                            set_current_editor(editor_info);
                        }
                        Ok::<_, warp::Rejection>(warp::reply::json(&json!({
                            "jsonrpc": "2.0",
                            "result": {"status": "ok"},
                            "id": req.id
                        })))
                    } else {
                        Ok(warp::reply::json(&json!({
                            "jsonrpc": "2.0",
                            "error": {"code": -32601, "message": "Method not found"},
                            "id": req.id
                        })))
                    }
                }
            });

        println!("JSON-RPC server listening on http://127.0.0.1:{}", port);

        tokio::spawn(async move {
            warp::serve(rpc).run(([127, 0, 0, 1], port)).await;
        });

        Ok(())
    }
}
