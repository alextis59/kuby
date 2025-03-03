const express = require('express');
const { exec, spawn } = require('child_process');
const util = require('util');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const execPromise = util.promisify(exec);
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = 3000;

// Middleware to serve static files from the app directory
app.use(express.static(path.join(__dirname, '../app')));

// Route to get contexts with namespaces
app.get('/contexts', async (req, res) => {
  try {
    const { stdout } = await execPromise('kubectl config get-contexts');
    const lines = stdout.split('\n').filter(line => line.trim()); // Remove empty lines
    
    // Parse table output
    const contexts = {};
    // Skip the header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      // Split by whitespace but preserve multiple spaces between columns
      const columns = line.split(/\s+/);
      
      // The format is typically:
      // CURRENT   NAME              CLUSTER           AUTHINFO         NAMESPACE
      // *         context-name      cluster-name      user-name        namespace-name
      
      // Check for the current context marker (*)
      let startIndex = 0;
      if (columns[0] === '*') {
        startIndex = 1;
      }
      
      const contextName = columns[startIndex];
      // Namespace is usually the last column, but might not be set
      const namespace = columns[columns.length - 1] || '';
      
      contexts[contextName] = namespace;
    }
    
    res.json(contexts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to set current context
app.get('/set-context/:context', async (req, res) => {
  const { context } = req.params;
  try {
    await execPromise(`kubectl config use-context ${context}`);
    res.json({ success: true, message: `Context set to ${context}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get pods from a namespace
app.get('/pods/:namespace', async (req, res) => {
  const { namespace } = req.params;
  try {
    const { stdout } = await execPromise(`kubectl get pods -n ${namespace}`);
    const pods = stdout
      .split('\n')
      .slice(1)
      .filter(line => line)
      .map(line => line.split(' ')[0]);
    res.json(pods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get logs from a pod
app.get('/logs/:namespace/:pod', async (req, res) => {
  const { namespace, pod } = req.params;
  const { tail } = req.query; // Optional tail parameter
  let command = `kubectl logs -n ${namespace} ${pod}`;
  if (tail && !isNaN(tail)) {
    command += ` --tail=${tail}`;
  }
  try {
    // Increase maxBuffer to handle large log outputs (100MB)
    const { stdout } = await execPromise(command, { maxBuffer: 100 * 1024 * 1024 });
    res.send(stdout); // Send raw log text
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../app', 'index.html'));
});

// Handle WebSocket connections for log streaming
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  // Keep track of all stream processes
  let streamProcesses = {};

  // Handle messages from client
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    // Handle start streaming message
    if (data.action === 'startStream') {
      const { namespace, pod } = data;
      
      // Kill any existing processes
      Object.values(streamProcesses).forEach(process => {
        process.kill();
      });
      streamProcesses = {};
      
      // Handle multiple pods (comma-separated)
      const pods = pod.split(',');
      console.log(`Starting log stream for ${pods.length} pod(s) in namespace ${namespace}`);
      
      // Start a kubectl logs -f process for each pod
      pods.forEach(podName => {
        console.log(`Starting stream for pod ${podName}`);
        const process = spawn('kubectl', ['logs', '-n', namespace, podName, '-f', '--tail=10']);
        streamProcesses[podName] = process;
        
        // Send data from the process stdout to the WebSocket client
        process.stdout.on('data', (data) => {
          ws.send(JSON.stringify({
            type: 'log',
            pod: podName,
            data: data.toString()
          }));
        });
        
        // Handle errors
        process.stderr.on('data', (data) => {
          ws.send(JSON.stringify({
            type: 'error',
            pod: podName,
            data: data.toString()
          }));
        });
        
        // Handle process exit
        process.on('close', (code) => {
          ws.send(JSON.stringify({
            type: 'info',
            data: `Log stream for ${podName} closed with code ${code}`
          }));
          delete streamProcesses[podName];
        });
      });
    }
    
    // Handle stop streaming message
    if (data.action === 'stopStream') {
      console.log('Stopping all log streams');
      Object.values(streamProcesses).forEach(process => {
        process.kill();
      });
      streamProcesses = {};
      ws.send(JSON.stringify({
        type: 'info',
        data: 'All log streams stopped'
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    // Kill all streaming processes
    Object.values(streamProcesses).forEach(process => {
      process.kill();
    });
    streamProcesses = {};
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
