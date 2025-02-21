const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);
const app = express();
const port = 3000;

// Middleware to serve static files (React build)
app.use(express.static(path.join(__dirname, 'client/build')));

// Route to get namespaces
app.get('/namespaces', async (req, res) => {
  try {
    const { stdout } = await execPromise('kubectl get namespaces');
    const namespaces = stdout
      .split('\n')
      .slice(1) // Skip header
      .filter(line => line) // Remove empty lines
      .map(line => line.split(' ')[0]); // Extract namespace name
    res.json(namespaces);
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
    const { stdout } = await execPromise(command);
    res.send(stdout); // Send raw log text
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
