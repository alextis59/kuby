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

// Export to window
window.fetchContexts = fetchContexts;
window.setContext = setContext;
window.fetchPods = fetchPods;
window.fetchPodLogs = fetchPodLogs;