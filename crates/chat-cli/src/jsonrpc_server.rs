use eyre::Result;
use serde_json::{
    Value,
    json,
};
use tokio::sync::mpsc;
use warp::Filter;

pub struct JsonRpcServer {
    message_sender: mpsc::UnboundedSender<String>,
}

#[derive(serde::Deserialize)]
struct JsonRpcRequest {
    method: String,
    params: Option<Value>,
    id: Option<Value>,
}

impl JsonRpcServer {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<String>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let server = Self { message_sender: tx };
        (server, rx)
    }

    pub fn start(&self, port: u16) -> Result<()> {
        let sender = self.message_sender.clone();

        let rpc = warp::path::end()
            .and(warp::post())
            .and(warp::body::json())
            .and_then(move |req: JsonRpcRequest| {
                let sender = sender.clone();
                async move {
                    if req.method == "display_message" {
                        if let Some(params) = req.params {
                            if let Some(arr) = params.as_array() {
                                if let Some(msg) = arr.first().and_then(|v| v.as_str()) {
                                    let _ = sender.send(msg.to_string());
                                }
                            }
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
