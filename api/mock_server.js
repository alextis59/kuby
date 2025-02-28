const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000; // Different port from the main API

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
    'default': ['nginx-548b6c8d64-abcde', 'mysql-74d5c6688d-fghij', 'redis-6b54b7d776-klmno'],
    'kube-system': ['coredns-558bd4d5db-pqrst', 'kube-proxy-uvwxy', 'metrics-server-z1234'],
    'monitoring': ['prometheus-5d5487f456-56789', 'grafana-6b7b9c8d8-abcde', 'alertmanager-fghij', 'metrics-server-z1234'],
    'app-production': ['frontend-567f86d547-klmno', 'backend-76c47cfd56-pqrst', 'cache-5d7b8c4d3-uvwxy', 'metrics-server-z1234'],
    'app-staging': ['frontend-test-12345', 'backend-test-67890', 'cache-test-abcde']
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
      ]
    },
    
    // Generate a single log entry
    generateLogEntry: (podName) => {
      // Simplify type determination by just checking if it starts with frontend/backend
      let podType;
      if (podName.startsWith('frontend')) {
        podType = 'frontend';
      } else if (podName.startsWith('backend')) {
        podType = 'backend';
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
      for (let i = 0; i < count; i++) {
        logs.push(mockData.logGenerators.generateLogEntry(podName));
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

app.listen(port, () => {
  console.log(`Mock API server running on http://localhost:${port}`);
});