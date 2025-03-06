#!/usr/bin/env node

const express = require('express');
const { exec, spawn } = require('child_process');
const util = require('util');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
// open is imported dynamically where needed

const execPromise = util.promisify(exec);
const fsPromises = fs.promises;
const app = express();
let port = 3000;
const MAX_PORT_TRIES = 10;

// User options storage path - store in user's home directory
const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.kuby');
const optionsFilePath = path.join(userDataDir, 'user-options.json');

// Helper functions for user options
async function ensureUserDataDirExists() {
  try {
    await fsPromises.mkdir(userDataDir, { recursive: true });
  } catch (error) {
    console.error('Error creating user data directory:', error);
    throw error;
  }
}

async function getUserOptions() {
  await ensureUserDataDirExists();
  
  try {
    const data = await fsPromises.readFile(optionsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty options object
      return {};
    }
    console.error('Error reading user options:', error);
    throw error;
  }
}

async function saveUserOptions(options) {
  await ensureUserDataDirExists();
  
  try {
    await fsPromises.writeFile(optionsFilePath, JSON.stringify(options, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving user options:', error);
    throw error;
  }
}

// Middleware to serve static files from the app directory
app.use(express.static(path.join(__dirname, '../app')));

// Middleware to parse JSON request bodies
app.use(express.json());

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

// Route to get user options
app.get('/options', async (req, res) => {
  try {
    const options = await getUserOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get a specific option by key
app.get('/options/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const options = await getUserOptions();
    res.json({ [key]: options[key] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to save a specific option
app.post('/options/:key', async (req, res) => {
  const { key } = req.params;
  const value = req.body.value;
  
  try {
    const options = await getUserOptions();
    options[key] = value;
    await saveUserOptions(options);
    res.json({ success: true, message: `Option ${key} saved successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to save all options at once
app.post('/options', async (req, res) => {
  try {
    await saveUserOptions(req.body);
    res.json({ success: true, message: 'All options saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../app', 'index.html'));
});

// WebSocket handler function - will be initialized after finding an available port
function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  
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
  
  return wss;
}

// Start the server and handle port retries
(async function() {
  let currentPort = port;
  let attempt = 1;
  
  while (attempt <= MAX_PORT_TRIES) {
    try {
      // Create a fresh server instance
      const server = http.createServer(app);
      
      // Attempt to start the server
      const success = await new Promise((resolve) => {
        // Set up error handler to catch 'port in use' errors
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${currentPort} is already in use, trying port ${currentPort + 1}...`);
            server.close();
            currentPort++;
            attempt++;
            resolve(false); // Signal to try next port
          } else {
            console.error('Server error:', err);
            process.exit(1);
          }
        });
        
        // Set up listening handler for successful start
        server.once('listening', () => {
          console.log(`Server running on http://localhost:${currentPort}`);
          resolve(true); // Signal successful server start
        });
        
        // Try to start the server
        server.listen(currentPort);
      });
      
      // If server started successfully
      if (success) {
        // Now set up WebSocket server on the successful server instance
        setupWebSocketServer(server);
        
        // Open the browser
        try {
          const open = await import('open');
          await open.default(`http://localhost:${currentPort}`);
        } catch (err) {
          console.log(`Failed to open browser: ${err.message}`);
        }
        
        // Break out of the retry loop
        break;
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      process.exit(1);
    }
  }
  
  if (attempt > MAX_PORT_TRIES) {
    console.error(`Failed to find an available port after ${MAX_PORT_TRIES} attempts.`);
    process.exit(1);
  }
})();
