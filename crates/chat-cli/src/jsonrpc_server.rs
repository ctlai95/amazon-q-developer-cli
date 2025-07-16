
use jsonrpc_core::{IoHandler, Params};
use jsonrpc_http_server::ServerBuilder;
use serde_json::json;
use tokio::sync::mpsc;
use eyre::Result;

pub struct JsonRpcServer {
    message_sender: mpsc::UnboundedSender<String>,
}

impl JsonRpcServer {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<String>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let server = Self {
            message_sender: tx,
        };
        (server, rx)
    }

    pub fn start(&self, port: u16) -> Result<()> {
        let mut io = IoHandler::new();
        let sender = self.message_sender.clone();

        io.add_method("display_message", move |params: Params| {
            let sender = sender.clone();
            async move {
                let parsed: Vec<String> = params.parse()?;
                let message = parsed.get(0).cloned().unwrap_or_default();
                
                let _ = sender.send(message);
                
                Ok(json!({"status": "ok"}))
            }
        });

        let server = ServerBuilder::new(io)
            .start_http(&format!("127.0.0.1:{}", port).parse().unwrap())
            .map_err(|e| eyre::eyre!("Failed to start JSON-RPC server: {}", e))?;

        println!("JSON-RPC server listening on http://127.0.0.1:{}", port);
        
        // Run server in background thread
        std::thread::spawn(move || {
            server.wait();
        });
        
        Ok(())
    }
}
