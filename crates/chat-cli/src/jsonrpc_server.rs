use std::sync::{
    Arc,
    Mutex,
};

use eyre::Result;
use futures::{
    SinkExt,
    StreamExt,
};
use once_cell::sync::Lazy;
use serde_json::{
    Value,
    json,
};
use warp::Filter;

#[derive(Debug, Clone, Default)]
pub struct EditorInfo {
    pub relative_file_path: Option<String>,
    pub language: Option<String>,
    pub text: Option<String>,
}

static CURRENT_EDITOR: Lazy<Arc<Mutex<EditorInfo>>> = Lazy::new(|| Arc::new(Mutex::new(EditorInfo::default())));
static WS_SENDER: Lazy<Arc<Mutex<Option<futures::channel::mpsc::UnboundedSender<warp::ws::Message>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

pub fn get_current_editor_state() -> Option<crate::api_client::model::EditorState> {
    let editor_info = CURRENT_EDITOR.lock().unwrap();

    editor_info
        .relative_file_path
        .as_ref()
        .map(|path| crate::api_client::model::EditorState {
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
}

pub fn set_current_editor(info: EditorInfo) {
    *CURRENT_EDITOR.lock().unwrap() = info;

    if let Some(ref path) = CURRENT_EDITOR.lock().unwrap().relative_file_path {
        use std::io;

        use crossterm::style::{
            Color,
            Stylize,
        };
        use crossterm::{
            cursor,
            execute,
            style,
            terminal,
        };

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

#[derive(Default)]
pub struct JsonRpcServer;

#[derive(serde::Deserialize)]
struct JsonRpcRequest {
    method: String,
    params: Option<Value>,
    id: Option<Value>,
}

pub fn send_to_ide(message: Value) -> Result<()> {
    let sender = WS_SENDER.lock().unwrap();
    if let Some(ref tx) = *sender {
        let _ = tx.unbounded_send(warp::ws::Message::text(message.to_string()));
    }
    Ok(())
}

// Example function to send a notification to the IDE
pub fn notify_ide(method: &str, params: Value) -> Result<()> {
    let notification = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params
    });
    send_to_ide(notification)
}

async fn handle_websocket(ws: warp::ws::WebSocket) {
    let (mut ws_sender, mut ws_receiver) = ws.split();

    let (tx, mut rx) = futures::channel::mpsc::unbounded::<warp::ws::Message>();
    *WS_SENDER.lock().unwrap() = Some(tx);

    // Notify IDE that connection is established
    let _ = notify_ide("connection_established", json!({"status": "connected"}));

    // Handle outgoing messages
    tokio::spawn(async move {
        while let Some(msg) = rx.next().await {
            let _ = ws_sender.send(msg).await;
        }
    });

    // Handle incoming messages
    while let Some(result) = ws_receiver.next().await {
        if let Ok(msg) = result {
            if let Ok(text) = msg.to_str() {
                if let Ok(req) = serde_json::from_str::<JsonRpcRequest>(text) {
                    let response = handle_jsonrpc_request(req).await;
                    let sender = WS_SENDER.lock().unwrap();
                    if let Some(ref tx) = *sender {
                        let _ = tx.unbounded_send(warp::ws::Message::text(response.to_string()));
                    }
                }
            }
        }
    }

    *WS_SENDER.lock().unwrap() = None;

    // Notify IDE that connection is closed
    let _ = notify_ide("connection_closed", json!({"status": "disconnected"}));
}

async fn handle_jsonrpc_request(req: JsonRpcRequest) -> Value {
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
        json!({
            "jsonrpc": "2.0",
            "result": {"status": "ok"},
            "id": req.id
        })
    } else {
        json!({
            "jsonrpc": "2.0",
            "error": {"code": -32601, "message": "Method not found"},
            "id": req.id
        })
    }
}

impl JsonRpcServer {
    pub fn start(port: u16) -> Result<()> {
        println!("WebSocket server listening on ws://127.0.0.1:{}", port);

        let ws_route = warp::path::end()
            .and(warp::ws())
            .map(|ws: warp::ws::Ws| ws.on_upgrade(handle_websocket));

        tokio::spawn(async move {
            warp::serve(ws_route).run(([127, 0, 0, 1], port)).await;
        });

        Ok(())
    }
}
