// React import is provided by the script tags in index.html
const React = window.React;
const ReactDOM = window.ReactDOM;
const moment = window.moment || require('moment');

// Set the base URL to point to the API server
const BASE_URL = 'http://localhost:3000';

function App() {
  // State variables
  const [contexts, setContexts] = React.useState({});
  const [selectedContext, setSelectedContext] = React.useState('');
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

  // Fetch contexts on mount
  React.useEffect(() => {
    fetchContexts();
  }, []);

  // When context is selected, update the namespace and set the context
  React.useEffect(() => {
    if (selectedContext) {
      setSelectedNamespace(contexts[selectedContext]);
      setContext(selectedContext);
    } else {
      setSelectedNamespace('');
      setPods([]);
      setSelectedPods([]);
    }
  }, [selectedContext]);

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
  const fetchContexts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/contexts`);
      if (!response.ok) throw new Error('Failed to fetch contexts');
      const data = await response.json();
      setContexts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setContext = async (context) => {
    try {
      const response = await fetch(`${BASE_URL}/set-context/${context}`);
      if (!response.ok) throw new Error('Failed to set context');
      await response.json(); // Consume the response
    } catch (err) {
      setError(err.message);
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
        
        // Auto-update time range with min and max timestamps only if empty
        if (!timeRange.start && !timeRange.end) {
          setTimeRange({
            start: formatDateForInput(minTimestamp),
            end: formatDateForInput(maxTimestamp)
          });
        }
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
    
    // Find matching pod prefix in parsingOptions
    let matchedPrefix = '';
    let podOptions = {};
    
    // Sort prefixes by length (longest first) to match most specific prefix
    const prefixes = Object.keys(parsingOptions).sort((a, b) => b.length - a.length);
    
    for (const prefix of prefixes) {
      if (podName.startsWith(prefix)) {
        matchedPrefix = prefix;
        podOptions = parsingOptions[prefix];
        break;
      }
    }
    
    // Pattern for extracting timestamp and the format to parse it
    let pattern, formatString;
    
    // Convert format tokens to regex patterns
    const formatTokensToRegex = {
      'YYYY': '(\\d{4})',
      'YY': '(\\d{2})',
      'MM': '(\\d{2})',
      'DD': '(\\d{2})',
      'HH': '(\\d{2})',
      'mm': '(\\d{2})',
      'SS': '(\\d{2})',
      'sss': '(\\d{3})'
    };
    
    // If podOptions is a string, it's the old format (just regex)
    if (typeof podOptions === 'string') {
      pattern = new RegExp(podOptions);
    } 
    // If it's an object with format property
    else if (podOptions && podOptions.format) {
      formatString = podOptions.format;
      
      // If regex is provided, use it
      if (podOptions.regex) {
        pattern = new RegExp(podOptions.regex);
      } 
      // Otherwise, build a regex from the format
      else {
        // Escape special regex characters in the format string
        let regexFromFormat = formatString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        
        // Replace format tokens with regex patterns
        for (const [token, regex] of Object.entries(formatTokensToRegex)) {
          regexFromFormat = regexFromFormat.replace(token, regex);
        }
        
        // Create a pattern that searches for this timestamp format within brackets
        pattern = new RegExp(`(${regexFromFormat})`);
      }
    } 
    // Otherwise use default
    else {
      pattern = defaultPattern;
    }
    
    let lastTimestamp = null;
    
    // For debugging
    console.log(`Pod: ${podName}, Format: ${formatString}, Pattern: ${pattern}`);
    
    return lines.map(line => {
      let timestamp;
      
      // Try to match the pattern in the line
      const match = line.match(pattern);
      
      if (match && match[1]) {
        const timestampStr = match[1];
        
        // If we have a format string, use moment.js to parse
        if (formatString) {
          // Convert our custom format tokens to moment format tokens if needed
          const momentFormat = formatString
            .replace('YYYY', 'YYYY')
            .replace('YY', 'YY')
            .replace('MM', 'MM')
            .replace('DD', 'DD')
            .replace('HH', 'HH')
            .replace('mm', 'mm')
            .replace('SS', 'ss')
            .replace('sss', 'SSS');
          
          // Parse with moment.js
          const momentDate = moment(timestampStr, momentFormat);
          
          if (momentDate.isValid()) {
            timestamp = momentDate.toDate();
            console.log(`Successfully parsed timestamp: ${timestampStr} to ${timestamp}`);
          } else {
            console.log(`Failed to parse timestamp: ${timestampStr} with format: ${momentFormat}`);
          }
        } 
        // Otherwise try to parse with native Date
        else {
          timestamp = new Date(timestampStr);
        }
        
        if (!isNaN(timestamp)) {
          lastTimestamp = timestamp;
        }
      }
      
      timestamp = timestamp || lastTimestamp || new Date(); // Use previous timestamp if none found
      return { line, timestamp };
    }).filter(log => log.timestamp); // Remove logs without a timestamp
  };

  // Filter logs based on selected pods, search, and time range
  const filteredLogs = logs.filter(log => {
    const matchesPod = selectedPods.includes(log.podName);
    const matchesSearch = searchString ? log.line.includes(searchString) : true;
    const matchesTime = timeRange.start && timeRange.end
      ? log.timestamp >= new Date(timeRange.start) && log.timestamp <= new Date(timeRange.end)
      : true;
    return matchesPod && matchesSearch && matchesTime;
  });

  // Update parsing options
  const updateParsingOptions = (newOptions) => {
    setParsingOptions(newOptions);
    localStorage.setItem('parsingOptions', JSON.stringify(newOptions));
  };

  return (
    <div className="App">
      <h1>KUBY</h1>
      
      <div className="main-container">
        {/* Left toolbar with all controls */}
        <div className="toolbar">
          <div className="selectors">
            <label>Context: </label>
            <select value={selectedContext} onChange={e => {
              setSelectedContext(e.target.value);
              setSelectedPods([]);
            }}>
              <option value="">Select Context</option>
              {Object.entries(contexts).map(([context, namespace]) => (
                <option key={context} value={context}>{context} ({namespace})</option>
              ))}
            </select>

            <div className="pod-selector">
              <label>Pods: </label>
              <div className="pod-selector-actions">
                <button 
                  className="select-all-button" 
                  onClick={() => setSelectedPods([...pods])}
                  disabled={pods.length === 0}>
                  Select All
                </button>
                <button 
                  className="clear-button" 
                  onClick={() => setSelectedPods([])}
                  disabled={selectedPods.length === 0}>
                  Clear All
                </button>
              </div>
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


          <div className="options">
            <label>Log Option:</label>
            <select value={logOption} onChange={e => setLogOption(e.target.value)}>
              <option value="complete">Complete Logs</option>
              <option value="tail">Last X Lines</option>
            </select>
            {logOption === 'tail' && (
              <>
                <label>Number of Lines:</label>
                <input
                  type="number"
                  value={tailLines}
                  onChange={e => setTailLines(e.target.value)}
                  min="1"
                />
              </>
            )}
            <button onClick={fetchLogs} disabled={loading || selectedPods.length === 0}>
              {loading ? 'Fetching...' : 'Fetch Logs'}
            </button>
            <button onClick={() => setShowEditor(true)}>Edit Parsing Options</button>
          </div>

          <div className="filters">
            <label>Search Logs:</label>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchString}
              onChange={e => setSearchString(e.target.value)}
            />
            <label>Time Range:</label>
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
        </div>
        
        {/* Right side with logs */}
        <div className="logs-container">
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
      </div>
      
      {/* Modal for editing parsing options */}
      {showEditor && (
        <div className="modal">
          <h2>Edit Parsing Options</h2>
          <p>You can specify:</p>
          <ul>
            <li>Just a format string (regex will default to extract text between [ ])</li>
            <li>Both a regex pattern and format string</li>
            <li>Just a regex pattern (for backward compatibility)</li>
          </ul>
          <p>Format examples: <code>MM/DD/YYYY HH:mm:SS</code> or <code>YYYY-MM-DD HH:mm:SS.sss</code></p>
          <p><strong>Important:</strong> Enter pod <em>prefixes</em> (not exact pod names). 
             The longest matching prefix will be used. For example:</p>
          <ul>
            <li><code>frontend</code> - Matches all pods starting with "frontend"</li>
            <li><code>backend</code> - Matches all pods starting with "backend"</li>
          </ul>
          
          {Object.entries(parsingOptions).map(([pod, options]) => {
            // Handle both old format (string) and new format (object)
            const isLegacyFormat = typeof options === 'string';
            const regexValue = isLegacyFormat ? options : (options.regex || '');
            const formatValue = isLegacyFormat ? '' : (options.format || '');
            
            return (
              <div key={pod} style={{margin: '10px 0', padding: '5px 0', borderBottom: '1px solid #eee'}}>
                <div><strong>{pod}</strong></div>
                <div style={{marginTop: '5px'}}>
                  <label style={{marginRight: '5px'}}>Regex (optional): </label>
                  <input
                    value={regexValue}
                    placeholder="Default: \\[(.*?)\\]"
                    onChange={e => {
                      const newValue = e.target.value;
                      // If we have a format, update the object properties
                      if (formatValue) {
                        const newOptions = { 
                          ...parsingOptions, 
                          [pod]: { regex: newValue, format: formatValue } 
                        };
                        updateParsingOptions(newOptions);
                      } else {
                        // Otherwise just update the string
                        const newOptions = { ...parsingOptions, [pod]: newValue };
                        updateParsingOptions(newOptions);
                      }
                    }}
                    style={{width: '250px'}}
                  />
                </div>
                <div style={{marginTop: '5px'}}>
                  <label style={{marginRight: '5px'}}>Format: </label>
                  <input
                    value={formatValue}
                    placeholder="e.g. YYYY-MM-DD HH:mm:SS.sss"
                    onChange={e => {
                      const newFormat = e.target.value;
                      // Create or update the object
                      const newOptions = { 
                        ...parsingOptions, 
                        [pod]: { 
                          regex: regexValue, 
                          format: newFormat 
                        } 
                      };
                      updateParsingOptions(newOptions);
                    }}
                    style={{width: '250px'}}
                  />
                </div>
                <button 
                  onClick={() => {
                    const newOptions = { ...parsingOptions };
                    delete newOptions[pod];
                    updateParsingOptions(newOptions);
                  }}
                  style={{marginTop: '5px'}}
                >
                  Delete
                </button>
              </div>
            );
          })}
          
          <div style={{margin: '15px 0'}}>
            <h3>Add New Pattern</h3>
            <div>
              <label style={{display: 'block', marginBottom: '5px'}}>Pod Prefix:</label>
              <input
                placeholder="e.g. frontend, backend"
                id="newPod"
                style={{width: '250px'}}
              />
            </div>
            <div style={{marginTop: '5px'}}>
              <label style={{display: 'block', marginBottom: '5px'}}>Regex Pattern (optional):</label>
              <input
                placeholder="Default: \\[(.*?)\\]"
                id="newPattern"
                style={{width: '250px'}}
              />
            </div>
            <div style={{marginTop: '5px'}}>
              <label style={{display: 'block', marginBottom: '5px'}}>Format:</label>
              <input
                placeholder="e.g. YYYY-MM-DD HH:mm:SS.sss"
                id="newFormat"
                style={{width: '250px'}}
              />
            </div>
            <button 
              onClick={() => {
                const pod = document.getElementById('newPod').value;
                const pattern = document.getElementById('newPattern').value;
                const format = document.getElementById('newFormat').value;
                
                if (pod) {
                  if (format) {
                    // Create with format
                    const options = { format };
                    if (pattern) options.regex = pattern;
                    updateParsingOptions({ 
                      ...parsingOptions, 
                      [pod]: options
                    });
                  } else if (pattern) {
                    // Legacy format (just regex)
                    updateParsingOptions({ ...parsingOptions, [pod]: pattern });
                  } else {
                    // Need at least format or pattern
                    alert("Please provide either a format or a regex pattern");
                    return;
                  }
                  
                  // Clear inputs
                  document.getElementById('newPod').value = '';
                  document.getElementById('newPattern').value = '';
                  document.getElementById('newFormat').value = '';
                } else {
                  alert("Pod name is required");
                }
              }}
              style={{marginTop: '10px'}}
            >
              Add
            </button>
          </div>
          
          <button 
            onClick={() => setShowEditor(false)}
            style={{marginTop: '15px'}}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// Render the App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);