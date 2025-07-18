import * as http from "http";
import { DiffService } from "./diffService";

/**
 * Service for handling HTTP server operations
 */
export class ServerService {
  private server: http.Server;
  private port: number = 3031;

  /**
   * Creates a new server service
   */
  constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  /**
   * Starts the server
   * @returns Promise that resolves when the server is started
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`VSCode extension server listening on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (err) => {
        console.error(`Failed to start server: ${err.message}`);
        reject(err);
      });
    });
  }

  /**
   * Stops the server
   */
  public stop(): void {
    if (this.server) {
      this.server.close();
    }
  }

  /**
   * Handles incoming HTTP requests
   * @param req HTTP request
   * @param res HTTP response
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Add a health endpoint
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    
    if (req.method === 'POST' && req.headers['content-type'] === 'application/json') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        this.processRequestBody(body, res);
      });
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  }

  /**
   * Processes the request body
   * @param body Request body as string
   * @param res HTTP response
   */
  private processRequestBody(body: string, res: http.ServerResponse): void {
    try {
      console.log("Received request:", body);
      const request = JSON.parse(body);
      
      // Check for file_modification in both method and params.type
      if ((request.method === 'file_modification' || 
           (request.params && request.params.type === 'file_modification'))) {
        console.log("Received file modification request");
        this.handleFileModification(request.params || request, res);
      } else {
        // Handle other requests
        console.log("Received unknown request type:", request.method);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: 'received' }));
      }
    } catch (error) {
      console.error('Error processing request:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
  }

  /**
   * Handles file modification requests
   * @param params Request parameters
   * @param res HTTP response
   */
  private handleFileModification(params: any, res: http.ServerResponse): void {
    console.log("Processing file modification request with params:", params);
    
    // Extract parameters, handling different possible structures
    const originalContent = params.originalContent || params.params?.originalContent || "";
    const modifiedContent = params.modifiedContent || params.params?.modifiedContent || "";
    const filePath = params.filePath || params.params?.filePath || "unknown.txt";
    
    console.log(`File path: ${filePath}`);
    console.log(`Original content length: ${originalContent.length}`);
    console.log(`Modified content length: ${modifiedContent.length}`);
    
    if (!originalContent && !modifiedContent) {
      console.error("Missing content in file modification request");
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing content in file modification request' }));
      return;
    }
    
    DiffService.showDiffInVSCode(originalContent, modifiedContent, filePath)
      .then(() => {
        console.log("Successfully showed diff view for file:", filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: 'success' }));
      })
      .catch(err => {
        console.error("Failed to show diff view:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
  }
}
