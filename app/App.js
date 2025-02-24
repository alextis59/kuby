// React import is provided by the script tags in index.html
const React = window.React;
const ReactDOM = window.ReactDOM;

// Set the base URL to point to the API server
const BASE_URL = 'http://localhost:3000';

function App() {
  // State variables
  const [namespaces, setNamespaces] = React.useState([]);
  const [selectedNamespace, setSelectedNamespace] = React.useState('');
  const [pods, setPods] = React.useState([]);
  const [selectedPods, setSelectedPods] = React.useState([]);
  const [logOption, setLogOption] = React.useState('complete'); // 'complete' or 'tail'
  const [tailLines, setTailLines] = React.useState(50);
  const [logs, setLogs] = React.useState([]);
  const [searchString, setSearchString] = React.useState('');
  const [timeRange, setTimeRange] = React.useState({ start: '', end: '' });
  const [parsingOptions, setParsingOptions] = React.useState({});
  const [showEditor, setShowEditor] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Load parsing options from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('parsingOptions');
    if (stored) {
      setParsingOptions(JSON.parse(stored));
    }
  }, []);

  // Fetch namespaces on mount
  React.useEffect(() => {
    fetchNamespaces();
  }, []);

  // Fetch pods when namespace changes
  React.useEffect(() => {
    if (selectedNamespace) {
      fetchPods(selectedNamespace);
    } else {
      setPods([]);
      setSelectedPods([]);
    }
  }, [selectedNamespace]);

  // Fetch functions
  const fetchNamespaces = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/namespaces`);
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
      const response = await fetch(`${BASE_URL}/pods/${namespace}`);
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
    if (!selectedNamespace || selectedPods.length === 0) {
      setError('Please select a namespace and at least one pod');
      return;
    }
    setLoading(true);
    setLogs([]);
    try {
      const allLogs = [];
      
      // Fetch logs for each selected pod sequentially
      for (const pod of selectedPods) {
        const url = logOption === 'complete'
          ? `${BASE_URL}/logs/${selectedNamespace}/${pod}`
          : `${BASE_URL}/logs/${selectedNamespace}/${pod}?tail=${tailLines}`;
          
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch logs for pod ${pod}`);
        
        const logsText = await response.text();
        const parsedLogs = parseLogs(logsText, pod, parsingOptions);
        
        // Add pod name to each log entry
        const logsWithPodName = parsedLogs.map(log => ({
          ...log,
          podName: pod
        }));
        
        allLogs.push(...logsWithPodName);
      }
      
      // Sort all logs by timestamp
      const sortedLogs = allLogs.sort((a, b) => a.timestamp - b.timestamp);
      setLogs(sortedLogs);
      
      // Update time range based on log timestamps
      if (sortedLogs.length > 0) {
        // Find min and max timestamps
        const minTimestamp = sortedLogs[0].timestamp;
        const maxTimestamp = sortedLogs[sortedLogs.length - 1].timestamp;
        
        // Format timestamps for datetime-local input (YYYY-MM-DDThh:mm)
        const formatDateForInput = (date) => {
          return date.toISOString().slice(0, 16);
        };
        
        // Update time range with min and max timestamps
        setTimeRange({
          start: formatDateForInput(minTimestamp),
          end: formatDateForInput(maxTimestamp)
        });
      }
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
      timestamp = lastTimestamp || new Date(); // Use previous timestamp if none found
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

      <div className="selectors">
        <label>Namespace: </label>
        <select value={selectedNamespace} onChange={e => {
          setSelectedNamespace(e.target.value);
          setSelectedPods([]);
        }}>
          <option value="">Select Namespace</option>
          {namespaces.map(ns => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>

        <div className="pod-selector">
          <label>Pods: </label>
          <div className="pods-container">
            {pods.map(pod => (
              <div key={pod} className="pod-checkbox">
                <input
                  type="checkbox"
                  id={`pod-${pod}`}
                  checked={selectedPods.includes(pod)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPods([...selectedPods, pod]);
                    } else {
                      setSelectedPods(selectedPods.filter(p => p !== pod));
                    }
                  }}
                />
                <label htmlFor={`pod-${pod}`}>{pod}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="selected-pods-summary">
        {selectedPods.length > 0 ? (
          <div>
            <span>Selected pods ({selectedPods.length}): </span>
            <span className="pod-list">{selectedPods.join(', ')}</span>
            <button 
              className="clear-button" 
              onClick={() => setSelectedPods([])}>
              Clear All
            </button>
          </div>
        ) : (
          <div className="no-pods-selected">No pods selected</div>
        )}
      </div>

      <div className="options">
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
        <button onClick={fetchLogs} disabled={loading || selectedPods.length === 0}>
          {loading ? 'Fetching...' : 'Fetch Logs'}
        </button>
        <button style={{marginLeft: '5px'}} onClick={() => setShowEditor(true)}>Edit Parsing Options</button>
      </div>

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

      <div className="filters">
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

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Loading...</p>}
      <div className="logs">
        <h2>Logs {filteredLogs.length > 0 ? `(${filteredLogs.length})` : ''}</h2>
        <ul>
          {filteredLogs.map((log, index) => (
            <li key={index}>
              <span className="log-timestamp">{log.timestamp.toLocaleString()}</span>
              <span className="log-pod">[{log.podName}]</span>
              <span className="log-line">{log.line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Render the App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);