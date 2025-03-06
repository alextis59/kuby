// API service
const BASE_URL = window.BASE_URL;

// Fetch available Kubernetes contexts
async function fetchContexts() {
  const response = await fetch(`${BASE_URL}/contexts`);
  if (!response.ok) throw new Error('Failed to fetch contexts');
  return await response.json();
}

// Set the active Kubernetes context
async function setContext(context) {
  const response = await fetch(`${BASE_URL}/set-context/${context}`);
  if (!response.ok) throw new Error('Failed to set context');
  return await response.json();
}

// Fetch pods for a namespace
async function fetchPods(namespace) {
  const response = await fetch(`${BASE_URL}/pods/${namespace}`);
  if (!response.ok) throw new Error('Failed to fetch pods');
  return await response.json();
}

// Fetch logs for a specific pod
async function fetchPodLogs(namespace, pod, isTail = false, tailLines = 50) {
  const url = isTail
    ? `${BASE_URL}/logs/${namespace}/${pod}?tail=${tailLines}`
    : `${BASE_URL}/logs/${namespace}/${pod}`;
    
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch logs for pod ${pod}`);
  return await response.text();
}

// Create a websocket connection for streaming logs
function createLogStream(namespace, pod, onMessage, onError, onClose) {
  // Create WebSocket URL from the current page URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}`;
  
  // Create WebSocket connection
  const socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log('WebSocket connection established');
    // Start streaming for the specified pod
    socket.send(JSON.stringify({
      action: 'startStream',
      namespace,
      pod
    }));
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage && typeof onMessage === 'function') {
        onMessage(data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  };
  
  socket.onclose = (event) => {
    console.log('WebSocket connection closed', event.code, event.reason);
    if (onClose && typeof onClose === 'function') {
      onClose(event);
    }
  };
  
  // Return the socket so it can be used to send messages or close the connection
  return socket;
}

// Stop the log stream
function stopLogStream(socket) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      action: 'stopStream'
    }));
  }
}

// User options API functions
async function getOptions() {
  const response = await fetch(`${BASE_URL}/options`);
  if (!response.ok) throw new Error('Failed to fetch options');
  return await response.json();
}

async function getOption(key) {
  const response = await fetch(`${BASE_URL}/options/${key}`);
  if (!response.ok) throw new Error(`Failed to fetch option ${key}`);
  const result = await response.json();
  return result[key];
}

async function saveOption(key, value) {
  const response = await fetch(`${BASE_URL}/options/${key}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });
  if (!response.ok) throw new Error(`Failed to save option ${key}`);
  return await response.json();
}

async function saveAllOptions(options) {
  const response = await fetch(`${BASE_URL}/options`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  });
  if (!response.ok) throw new Error('Failed to save options');
  return await response.json();
}

// Export to window
window.fetchContexts = fetchContexts;
window.setContext = setContext;
window.fetchPods = fetchPods;
window.fetchPodLogs = fetchPodLogs;
window.createLogStream = createLogStream;
window.stopLogStream = stopLogStream;
window.getOptions = getOptions;
window.getOption = getOption;
window.saveOption = saveOption;
window.saveAllOptions = saveAllOptions;