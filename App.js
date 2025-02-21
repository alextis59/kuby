import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // State variables
  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const [pods, setPods] = useState([]);
  const [selectedPod, setSelectedPod] = useState('');
  const [logOption, setLogOption] = useState('complete'); // 'complete' or 'tail'
  const [tailLines, setTailLines] = useState(50);
  const [logs, setLogs] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [parsingOptions, setParsingOptions] = useState({});
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load parsing options from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('parsingOptions');
    if (stored) {
      setParsingOptions(JSON.parse(stored));
    }
  }, []);

  // Fetch namespaces on mount
  useEffect(() => {
    fetchNamespaces();
  }, []);

  // Fetch pods when namespace changes
  useEffect(() => {
    if (selectedNamespace) {
      fetchPods(selectedNamespace);
    } else {
      setPods([]);
      setSelectedPod('');
    }
  }, [selectedNamespace]);

  // Fetch functions
  const fetchNamespaces = async () => {
    setLoading(true);
    try {
      const response = await fetch('/namespaces');
      if (!response.ok) throw new Error('Failed to fetch namespaces');
      const data = await response.json();
      setNamespaces(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPods = async (namespace) => {
    setLoading(true);
    try {
      const response = await fetch(`/pods/${namespace}`);
      if (!response.ok) throw new Error('Failed to fetch pods');
      const data = await response.json();
      setPods(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!selectedNamespace || !selectedPod) {
      setError('Please select a namespace and pod');
      return;
    }
    setLoading(true);
    try {
      const url = logOption === 'complete'
        ? `/logs/${selectedNamespace}/${selectedPod}`
        : `/logs/${selectedNamespace}/${selectedPod}?tail=${tailLines}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const logsText = await response.text();
      const parsedLogs = parseLogs(logsText, selectedPod, parsingOptions);
      setLogs(parsedLogs.sort((a, b) => a.timestamp - b.timestamp));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parse logs function
  const parseLogs = (logsText, podName, parsingOptions) => {
    const lines = logsText.split('\n').filter(line => line);
    const defaultPattern = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\]/;
    const customPatternStr = parsingOptions[podName];
    const pattern = customPatternStr ? new RegExp(customPatternStr) : defaultPattern;
    let lastTimestamp = null;
    return lines.map(line => {
      const match = line.match(pattern);
      let timestamp;
      if (match && match[1]) {
        timestamp = new Date(match[1]);
        if (!isNaN(timestamp)) lastTimestamp = timestamp;
      }
      timestamp = lastTimestamp; // Use previous timestamp if none found
      return { line, timestamp };
    }).filter(log => log.timestamp); // Remove logs without a timestamp
  };

  // Filter logs based on search and time range
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchString ? log.line.includes(searchString) : true;
    const matchesTime = timeRange.start && timeRange.end
      ? log.timestamp >= new Date(timeRange.start) && log.timestamp <= new Date(timeRange.end)
      : true;
    return matchesSearch && matchesTime;
  });

  // Update parsing options
  const updateParsingOptions = (newOptions) => {
    setParsingOptions(newOptions);
    localStorage.setItem('parsingOptions', JSON.stringify(newOptions));
  };

  return (
    <div className="App">
      <h1>Kubernetes Log Viewer</h1>

      {/* Namespace Selector */}
      <div>
        <label>Namespace: </label>
        <select value={selectedNamespace} onChange={e => setSelectedNamespace(e.target.value)}>
          <option value="">Select Namespace</option>
          {namespaces.map(ns => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
      </div>

      {/* Pod Selector */}
      <div>
        <label>Pod: </label>
        <select value={selectedPod} onChange={e => setSelectedPod(e.target.value)}>
          <option value="">Select Pod</option>
          {pods.map(pod => (
            <option key={pod} value={pod}>{pod}</option>
          ))}
        </select>
      </div>

      {/* Log Retrieval Options */}
      <div>
        <label>Log Option: </label>
        <select value={logOption} onChange={e => setLogOption(e.target.value)}>
          <option value="complete">Complete Logs</option>
          <option value="tail">Last X Lines</option>
        </select>
        {logOption === 'tail' && (
          <input
            type="number"
            value={tailLines}
            onChange={e => setTailLines(e.target.value)}
            min="1"
          />
        )}
      </div>

      {/* Fetch Logs Button */}
      <button onClick={fetchLogs} disabled={loading}>
        {loading ? 'Fetching...' : 'Fetch Logs'}
      </button>

      {/* Parsing Options Editor */}
      <button onClick={() => setShowEditor(true)}>Edit Parsing Options</button>
      {showEditor && (
        <div className="modal">
          <h2>Edit Parsing Options</h2>
          {Object.entries(parsingOptions).map(([pod, pattern]) => (
            <div key={pod}>
              <span>{pod}: </span>
              <input
                value={pattern}
                onChange={e => {
                  const newOptions = { ...parsingOptions, [pod]: e.target.value };
                  updateParsingOptions(newOptions);
                }}
              />
              <button onClick={() => {
                const newOptions = { ...parsingOptions };
                delete newOptions[pod];
                updateParsingOptions(newOptions);
              }}>Delete</button>
            </div>
          ))}
          <div>
            <input
              placeholder="Pod Name"
              id="newPod"
            />
            <input
              placeholder="Regex Pattern"
              id="newPattern"
            />
            <button onClick={() => {
              const pod = document.getElementById('newPod').value;
              const pattern = document.getElementById('newPattern').value;
              if (pod && pattern) {
                updateParsingOptions({ ...parsingOptions, [pod]: pattern });
              }
            }}>Add</button>
          </div>
          <button onClick={() => setShowEditor(false)}>Close</button>
        </div>
      )}

      {/* Search and Time Range Filters */}
      <div>
        <input
          type="text"
          placeholder="Search logs..."
          value={searchString}
          onChange={e => setSearchString(e.target.value)}
        />
        <input
          type="datetime-local"
          value={timeRange.start}
          onChange={e => setTimeRange({ ...timeRange, start: e.target.value })}
        />
        <input
          type="datetime-local"
          value={timeRange.end}
          onChange={e => setTimeRange({ ...timeRange, end: e.target.value })}
        />
      </div>

      {/* Logs Display */}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div>
        <h2>Logs</h2>
        <ul>
          {filteredLogs.map((log, index) => (
            <li key={index}>
              {log.timestamp.toLocaleString()} - {log.line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
