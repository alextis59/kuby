const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);
const app = express();
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
    const { stdout } = await execPromise(command);
    res.send(stdout); // Send raw log text
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../app', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
