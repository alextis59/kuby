const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
// open is imported dynamically where needed

const app = express();
let port = 3000; // Default port
const MAX_PORT_TRIES = 10;

// Enable CORS
app.use(cors());

// Middleware to serve static files from the app directory
app.use(express.static(path.join(__dirname, '../app')));

// Mock data
const mockData = {
  contexts: {
    'minikube': 'default',
    'gke_project_zone_cluster': 'kube-system',
    'aks_cluster': 'monitoring',
    'eks_cluster': 'app-production',
    'docker-desktop': 'app-staging',
  },
  pods: {
    'default': ['nginx-548b6c8d64-abcde', 'mysql-74d5c6688d-fghij', 'redis-6b54b7d776-klmno', 'metrics-server-abc12'],
    'kube-system': ['coredns-558bd4d5db-pqrst', 'kube-proxy-uvwxy', 'metrics-server-z1234'],
    'monitoring': ['prometheus-5d5487f456-56789', 'grafana-6b7b9c8d8-abcde', 'alertmanager-fghij', 'metrics-server-mn567'],
    'app-production': ['frontend-567f86d547-klmno', 'backend-76c47cfd56-pqrst', 'cache-5d7b8c4d3-uvwxy', 'metrics-server-pq890'],
    'app-staging': ['frontend-test-12345', 'backend-test-67890', 'cache-test-abcde', 'metrics-server-xy345']
  },
  logGenerators: {
    // Function to generate a random timestamp within the last 24 hours with different formats
    getRandomTimestamp: (podType) => {
      const now = new Date();
      const hoursAgo = Math.floor(Math.random() * 24);
      const minutesAgo = Math.floor(Math.random() * 60);
      const secondsAgo = Math.floor(Math.random() * 60);
      
      const timestamp = new Date(now);
      timestamp.setHours(now.getHours() - hoursAgo);
      timestamp.setMinutes(now.getMinutes() - minutesAgo);
      timestamp.setSeconds(now.getSeconds() - secondsAgo);
      
      // Different timestamp formats for different pod types
      if (podType === 'frontend') {
        // Frontend format: MM/DD/YYYY HH:MM:SS
        return timestamp.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } else if (podType === 'backend') {
        // Backend format: YYYY-MM-DD HH:MM:SS.sss
        return timestamp.toISOString().replace('T', ' ').replace('Z', '');
      } else if (podType === 'cache') {
        // Cache format: HH:MM:SS - time only with no date
        return timestamp.toTimeString().split(' ')[0];
      } else if (podType === 'metrics') {
        // Metrics format: YYYY/MM/DD HH:MM:SS.sss
        const year = timestamp.getFullYear();
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        const milliseconds = String(timestamp.getMilliseconds()).padStart(3, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
      } else {
        // Default format: ISO 8601 without milliseconds
        return timestamp.toISOString().replace(/\.\d{3}Z$/, 'Z');
      }
    },
    
    // Log patterns for different pod types
    logPatterns: {
      nginx: [
        "GET /api/v1/users 200",
        "POST /api/v1/login 200",
        "GET /api/v1/products 200",
        "GET /static/js/main.js 304",
        "Warning: Connection pool reached 70% capacity",
        "Error: Request timeout after 30s"
      ],
      mysql: [
        "Query completed in 234ms",
        "Slow query detected: SELECT * FROM users WHERE last_login > '2023-01-01'",
        "Connection established from 10.0.0.5",
        "Warning: Table 'orders' is almost full",
        "Error: Deadlock found when trying to get lock"
      ],
      redis: [
        "SET cache:user:1234 OK",
        "GET cache:product:5678 miss",
        "DEL cache:session:abcde OK",
        "Warning: Memory usage above 80%",
        "Error: MISCONF Redis is configured to save RDB snapshots"
      ],
      coredns: [
        "53 10.0.0.5:43210 - AAAA IN service.namespace.svc.cluster.local. 0.023s",
        "53 10.0.0.6:54321 - A IN api.example.com. 0.015s",
        "Warning: Query rate exceeds 1000 qps",
        "Error: Failed to resolve external domain"
      ],
      metrics: [
        "Started scrape of pod api-server",
        "CPU usage: 23.4%\nMemory usage: 1.8GB\nDisk I/O: 12.3MB/s read, 4.5MB/s write",
        "Collecting metrics from pod: frontend-app\nFound 32 metrics\nSuccessfully sent to storage",
        "Warning: High memory utilization detected\nPod: database-0\nUsage: 87.5% of allocated memory\nRecommended action: Increase memory allocation",
        "Error: Scrape timeout\nPod: cache-service\nTimestamp: 323ms\nScrape canceled",
        "Pod health check\nStatus: Ready\nRestart count: 0\nLast restart: N/A",
        "Network metrics collected\nIngress: 45.6MB\nEgress: 32.1MB\nConnections: 128 established",
        "Alert triggered\nRule: CPUThrottlingHigh\nInstance: worker-pod-23\nValue: 75.5%\nThreshold: 70%"
      ],
      frontend: [
        "User 1234 logged in",
        "Cart updated for user 5678",
        "Page loaded in 456ms",
        "Warning: API response time exceeds 1s",
        "Error: Failed to load resource from CDN"
      ],
      backend: [
        "Request processed in 123ms",
        "Database query executed in 45ms",
        "Cache hit ratio: 0.85",
        "Warning: Rate limit about to be reached for user 1234",
        "Error: Unable to connect to third-party service"
      ],
      cache: [
        "Cache hit for key: user_profile_1234",
        "Cache miss for key: product_5678",
        "Evicting least recently used items",
        "Cache invalidation triggered for prefix: user_*",
        "Memory usage: 75% of allocated",
        "Warning: High eviction rate detected",
        "Error: Failed to connect to Redis backend"
      ]
    },
    
    // Generate a single log entry
    generateLogEntry: (podName) => {
      // Determine pod type based on pod name prefix
      let podType;
      if (podName.startsWith('frontend')) {
        podType = 'frontend';
      } else if (podName.startsWith('backend')) {
        podType = 'backend';
      } else if (podName.startsWith('cache')) {
        podType = 'cache';
      } else if (podName.startsWith('metrics-server')) {
        podType = 'metrics';
      } else {
        podType = 'default';
      }
      
      const timestamp = mockData.logGenerators.getRandomTimestamp(podType);
      const logPatterns = mockData.logGenerators.logPatterns[podType === 'default' ? 'nginx' : podType] || mockData.logGenerators.logPatterns.backend;
      const logMessage = logPatterns[Math.floor(Math.random() * logPatterns.length)];
      
      return `[${timestamp}] ${logMessage}`;
    },
    
    // Generate multiple log entries
    generateLogs: (podName, count = 100) => {
      const logs = [];
      let i = 0;
      
      while (i < count) {
        // Add a log with timestamp
        logs.push(mockData.logGenerators.generateLogEntry(podName));
        i++;
        
        // For metrics pods, randomly add additional lines without timestamps
        if (podName.startsWith('metrics-server') && i < count && Math.random() > 0.7) {
          // Add 1-3 lines without timestamps about 30% of the time
          const additionalLines = Math.floor(Math.random() * 3) + 1;
          const continuationOptions = [
            "Additional details not available",
            "See documentation for more information",
            "Previous operation completed successfully",
            "Request ID: " + Math.random().toString(36).substring(2, 10).toUpperCase(),
            "Transaction ID: TXN-" + Math.floor(Math.random() * 10000000),
            "Correlation ID: " + Math.random().toString(36).substring(2, 15),
            "Thread pool status: Active=8, Idle=4, Queued=2",
            "DB connections: Active=12, Idle=5, Max=20",
            "Resource utilization details follow in debug logs",
            "Check configuration in /etc/kubernetes/metrics-server.yaml"
          ];
          
          for (let j = 0; j < additionalLines && i < count; j++) {
            // Add a line without timestamp
            logs.push(continuationOptions[Math.floor(Math.random() * continuationOptions.length)]);
            i++;
          }
        }
      }
      
      return logs.join('\n');
    }
  }
};

// Route to get contexts
app.get('/contexts', (req, res) => {
  setTimeout(() => {
    res.json(mockData.contexts);
  }, 500); // Add 500ms delay to simulate network latency
});

// Route to set current context
app.get('/set-context/:context', (req, res) => {
  const { context } = req.params;
  setTimeout(() => {
    if (mockData.contexts[context]) {
      res.json({ success: true, message: `Context set to ${context}` });
    } else {
      res.status(404).json({ error: `Context ${context} not found` });
    }
  }, 300);
});

// Route to get pods from a namespace
app.get('/pods/:namespace', (req, res) => {
  const { namespace } = req.params;
  setTimeout(() => {
    if (mockData.pods[namespace]) {
      res.json(mockData.pods[namespace]);
    } else {
      res.status(404).json({ error: `Namespace ${namespace} not found` });
    }
  }, 500);
});

// Route to get logs from a pod
app.get('/logs/:namespace/:pod', (req, res) => {
  const { namespace, pod } = req.params;
  const { tail } = req.query; // Optional tail parameter
  
  setTimeout(() => {
    if (!mockData.pods[namespace]) {
      return res.status(404).json({ error: `Namespace ${namespace} not found` });
    }
    
    if (!mockData.pods[namespace].includes(pod)) {
      return res.status(404).json({ error: `Pod ${pod} not found in namespace ${namespace}` });
    }
    
    const logCount = tail ? parseInt(tail) : 100;
    const logs = mockData.logGenerators.generateLogs(pod, logCount);
    res.send(logs);
  }, 1000);
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../app', 'index.html'));
});

// WebSocket handler function - will be initialized after finding an available port
function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected to mock server');
    let streamIntervals = {};

    // Handle messages from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Handle start streaming message
        if (data.action === 'startStream') {
          const { namespace, pod } = data;
          
          // Clear any existing intervals
          Object.keys(streamIntervals).forEach(key => {
            clearInterval(streamIntervals[key]);
          });
          streamIntervals = {};
          
          // Handle multiple pods (comma-separated)
          const pods = pod.split(',');
          console.log(`Starting mock log stream for ${pods.length} pod(s) in namespace ${namespace}`);
          
          // Start sending logs for each pod
          pods.forEach(podName => {
            console.log(`Starting mock stream for pod ${podName}`);
            
            // Send logs every 2 seconds for each pod
            // Use different intervals for each pod to prevent all logs arriving simultaneously
            const delay = 1000 + Math.random() * 2000;
            streamIntervals[podName] = setInterval(() => {
              // Generate a single log entry
              const logEntry = mockData.logGenerators.generateLogEntry(podName);
              
              // Send to client
              ws.send(JSON.stringify({
                type: 'log',
                pod: podName,
                data: logEntry
              }));
            }, delay);
          });
        }
        
        // Handle stop streaming message
        if (data.action === 'stopStream') {
          console.log('Stopping all mock log streams');
          Object.keys(streamIntervals).forEach(key => {
            clearInterval(streamIntervals[key]);
          });
          streamIntervals = {};
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log('WebSocket client disconnected from mock server');
      // Clear all intervals
      Object.keys(streamIntervals).forEach(key => {
        clearInterval(streamIntervals[key]);
      });
      streamIntervals = {};
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
          console.log(`Mock API server running on http://localhost:${currentPort}`);
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