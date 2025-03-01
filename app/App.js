// React import is provided by the script tags in index.html
const React = window.React;
const ReactDOM = window.ReactDOM;
const moment = window.moment || require('moment');

// Set the base URL to point to the API server
const BASE_URL = 'http://localhost:3000';

// Function to truncate pod name by removing the ID at the end
function truncatePodName(podName) {
  // Match pod name pattern up to the last dash followed by a hash/ID
  // Common pattern: name-deployment-hash or name-statefulset-ordinal
  return podName.replace(/-[a-z0-9]+$/, '');
}

// Function to generate a consistent color from a pod name
function generatePodColor(podName) {
  // Use the truncated pod name to ensure all pods of the same type get the same color
  const baseNameForColor = truncatePodName(podName);
  
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < baseNameForColor.length; i++) {
    hash = baseNameForColor.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with good saturation and lightness for readability
  const h = Math.abs(hash % 360); // Hue: 0-359
  const s = 65 + (hash % 20); // Saturation: 65-85%
  const l = 45 + (hash % 15); // Lightness: 45-60%
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function App() {
  // State variables
  const [contexts, setContexts] = React.useState({});
  const [selectedContext, setSelectedContext] = React.useState('');
  const [selectedNamespace, setSelectedNamespace] = React.useState('');
  const [pods, setPods] = React.useState([]);
  const [podDisplayNames, setPodDisplayNames] = React.useState({}); // Mapping of full pod names to display names
  const [podColors, setPodColors] = React.useState({}); // Mapping of pod names to colors
  const [selectedPods, setSelectedPods] = React.useState([]);
  const [podSearchFilter, setPodSearchFilter] = React.useState(''); // New state for pod search filter
  const [logOption, setLogOption] = React.useState('complete'); // 'complete' or 'tail'
  const [tailLines, setTailLines] = React.useState(50);
  const [logs, setLogs] = React.useState([]);
  const [podsWithLogs, setPodsWithLogs] = React.useState([]); // Pods for which logs were successfully loaded
  const [podsWithErrors, setPodsWithErrors] = React.useState([]); // Pods with parsing errors
  const [searchString, setSearchString] = React.useState('');
  const [timeRange, setTimeRange] = React.useState({ start: '', end: '' });
  const [parsingOptions, setParsingOptions] = React.useState({});
  const [showEditor, setShowEditor] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState([]);
  // New state for toolbar width
  const [toolbarWidth, setToolbarWidth] = React.useState(() => {
    // Try to load from localStorage or use default 280px
    const savedWidth = localStorage.getItem('toolbarWidth');
    return savedWidth ? parseInt(savedWidth, 10) : 280;
  });

  // Load parsing options from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('parsingOptions');
    if (stored) {
      setParsingOptions(JSON.parse(stored));
    }
  }, []);
  
  // Reference to toolbar element
  const toolbarRef = React.useRef(null);
  const resizeHandleRef = React.useRef(null);
  const isResizingRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);

  // Set up custom resize functionality
  React.useEffect(() => {
    const toolbar = toolbarRef.current;
    const resizeHandle = resizeHandleRef.current;
    if (!toolbar || !resizeHandle) return;
    
    // Set the initial width from state
    toolbar.style.width = `${toolbarWidth}px`;
    
    // Mouse down handler to start resizing
    const handleMouseDown = (e) => {
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = toolbar.getBoundingClientRect().width;
      resizeHandle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; // Prevent text selection during resize
      
      // Prevent default to avoid text selection
      e.preventDefault();
    };
    
    // Mouse move handler during resize
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      
      // Calculate new width based on mouse movement
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(600, startWidthRef.current + deltaX));
      
      // Update toolbar width
      toolbar.style.width = `${newWidth}px`;
    };
    
    // Mouse up handler to end resizing
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        resizeHandle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Save the new width to state and localStorage
        const newWidth = toolbar.getBoundingClientRect().width;
        setToolbarWidth(newWidth);
        localStorage.setItem('toolbarWidth', newWidth.toString());
      }
    };
    
    // Touch start handler (for mobile)
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isResizingRef.current = true;
        startXRef.current = e.touches[0].clientX;
        startWidthRef.current = toolbar.getBoundingClientRect().width;
        resizeHandle.classList.add('active');
        document.body.style.userSelect = 'none';
        
        e.preventDefault();
      }
    };
    
    // Touch move handler (for mobile)
    const handleTouchMove = (e) => {
      if (!isResizingRef.current || e.touches.length !== 1) return;
      
      const deltaX = e.touches[0].clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(600, startWidthRef.current + deltaX));
      
      toolbar.style.width = `${newWidth}px`;
      e.preventDefault();
    };
    
    // Touch end handler (for mobile)
    const handleTouchEnd = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        resizeHandle.classList.remove('active');
        document.body.style.userSelect = '';
        
        const newWidth = toolbar.getBoundingClientRect().width;
        setToolbarWidth(newWidth);
        localStorage.setItem('toolbarWidth', newWidth.toString());
      }
    };
    
    // Add event listeners for mouse
    resizeHandle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add event listeners for touch
    resizeHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    // Clean up event listeners
    return () => {
      // Remove mouse event listeners
      resizeHandle.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Remove touch event listeners
      resizeHandle.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [toolbarWidth]);

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
      
      // Create mapping of full pod names to truncated display names
      const displayNameMap = {};
      // Create mapping of pod names to colors
      const colorMap = {};
      
      data.forEach(pod => {
        displayNameMap[pod] = truncatePodName(truncatePodName(pod));
        // Generate a color for each pod
        colorMap[pod] = generatePodColor(pod);
      });
      
      setPodDisplayNames(displayNameMap);
      setPodColors(colorMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!selectedNamespace || selectedPods.length === 0) {
      setError('Please select a namespace and at least one pod');
      showToast('Please select a namespace and at least one pod', 'error');
      return;
    }
    setLoading(true);
    setLogs([]);
    // Reset the state of pods with logs and errors
    setPodsWithLogs([]);
    setPodsWithErrors([]);
    
    try {
      const allLogs = [];
      const successfulPods = [];
      const errorPods = [];
      
      // Fetch logs for each selected pod sequentially
      for (const pod of selectedPods) {
        const url = logOption === 'complete'
          ? `${BASE_URL}/logs/${selectedNamespace}/${pod}`
          : `${BASE_URL}/logs/${selectedNamespace}/${pod}?tail=${tailLines}`;
          
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch logs for pod ${pod}`);
          }
          
          const logsText = await response.text();
          const parsedLogs = parseLogs(logsText, pod, parsingOptions);
          
          // Check if there were any parsing errors for this pod
          const hasParsingErrors = parsedLogs.some(log => log.hasParsingError);
          
          // Add pod name to each log entry
          const logsWithPodName = parsedLogs.map(log => ({
            ...log,
            podName: pod
          }));
          
          allLogs.push(...logsWithPodName);
          
          // Track pod status
          successfulPods.push(pod);
          if (hasParsingErrors) {
            errorPods.push(pod);
          }
          
          // Show success toast for each pod
          showToast(`Successfully fetched logs for ${pod}`, 'success');
        } catch (podError) {
          // Add to error pods
          errorPods.push(pod);
          // Show error toast for individual pod failures but continue with other pods
          showToast(`Error fetching logs for ${pod}: ${podError.message}`, 'error');
        }
      }
      
      // Update state with pods that have logs and errors
      setPodsWithLogs(successfulPods);
      setPodsWithErrors(errorPods);
      
      // Sort all logs by timestamp
      const sortedLogs = allLogs.sort((a, b) => a.timestamp - b.timestamp);
      setLogs(sortedLogs);
      
      // Update time range based on log timestamps
      if (sortedLogs.length > 0) {
        // Find min and max timestamps
        const minTimestamp = sortedLogs[0].timestamp;
        const maxTimestamp = sortedLogs[sortedLogs.length - 1].timestamp;
        
        // Format timestamps for datetime-local input (YYYY-MM-DDThh:mm)
        // Using local timezone adjustment to prevent UTC conversion issues
        const formatDateForInput = (date) => {
          const pad = (num) => num.toString().padStart(2, '0');
          const year = date.getFullYear();
          const month = pad(date.getMonth() + 1); // getMonth() is 0-indexed
          const day = pad(date.getDate());
          const hours = pad(date.getHours());
          const minutes = pad(date.getMinutes());
          
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        setTimeRange({
          start: formatDateForInput(minTimestamp),
          end: formatDateForInput(maxTimestamp)
        });
      }
    } catch (err) {
      setError(err.message);
      showToast(`Error: ${err.message}`, 'error');
      setLogs([]); // Set logs to empty on error as requested in the task
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
    
    // If podOptions is a string, it's the old format (just regex) - keep for backward compatibility
    if (typeof podOptions === 'string') {
      pattern = new RegExp(podOptions);
    } 
    // If it's an object with format property
    else if (podOptions && podOptions.format) {
      formatString = podOptions.format;
      
      // Build a regex from the format (regex option has been removed)
      // Escape special regex characters in the format string
      let regexFromFormat = formatString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      // Replace format tokens with regex patterns
      for (const [token, regex] of Object.entries(formatTokensToRegex)) {
        regexFromFormat = regexFromFormat.replace(token, regex);
      }
      
      // Create a pattern that searches for this timestamp format within brackets
      pattern = new RegExp(`(${regexFromFormat})`);
    } 
    // Otherwise use default
    else {
      pattern = defaultPattern;
    }
    
    // For debugging
    console.log(`Pod: ${podName}, Format: ${formatString}, Pattern: ${pattern}`);
    
    // Instead of using map/filter, use a loop to process lines and handle merging
    const parsedLogs = [];
    let lastLogWithTimestamp = null;
    let hasParsingErrors = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let timestamp = null;
      
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
            // Check if the format doesn't include year, month, or day components
            // If it only has time components, set the date to today
            const hasDateComponents = /YYYY|YY|MM|DD/.test(formatString);
            if (!hasDateComponents) {
              // Get today's date components
              const today = new Date();
              momentDate.year(today.getFullYear());
              momentDate.month(today.getMonth());
              momentDate.date(today.getDate());
            }
            
            timestamp = momentDate.toDate();
            // console.log(`Successfully parsed timestamp: ${timestampStr} to ${timestamp}`);
          } else {
            // console.log(`Failed to parse timestamp: ${timestampStr} with format: ${momentFormat}`);
            hasParsingErrors = true;
          }
        } 
        // Otherwise try to parse with native Date
        else {
          timestamp = new Date(timestampStr);
          if (isNaN(timestamp)) {
            hasParsingErrors = true;
          }
        }
      } else if (i === 0) {
        // If the first line doesn't match our pattern, consider it a parsing error
        hasParsingErrors = true;
      }
      
      // If there's a valid timestamp, create a new log entry
      if (timestamp && !isNaN(timestamp)) {
        // Precompute shared time components
        const year = timestamp.getFullYear();
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        const milliseconds = String(timestamp.getMilliseconds()).padStart(3, '0');
        
        // Full timestamp with date in 24h format
        const fullDisplayString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        
        // Precompute shorter timestamp display without day/month/year
        const shortDisplayString = `${hours}:${minutes}:${seconds}.${milliseconds}`;
        
        const logEntry = { 
          line, 
          timestamp,
          fullDisplayString, 
          shortDisplayString,
          hasParsingError: false
        };
        
        parsedLogs.push(logEntry);
        lastLogWithTimestamp = logEntry;
      } 
      // If there's no timestamp but there was a previous line with timestamp, merge them
      else if (lastLogWithTimestamp) {
        // Append the current line to the last log entry with a line break
        lastLogWithTimestamp.line += '\n' + line;
      }
      // If there's no timestamp and no previous line with timestamp, add with current time
      else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        
        const fullDisplayString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
        const shortDisplayString = `${hours}:${minutes}:${seconds}.${milliseconds}`;
        
        const logEntry = {
          line,
          timestamp: now,
          fullDisplayString,
          shortDisplayString,
          hasParsingError: true
        };
        
        parsedLogs.push(logEntry);
        hasParsingErrors = true;
      }
    }
    
    // Tag all logs from this pod with the parsing error status
    parsedLogs.forEach(log => {
      log.hasParsingError = log.hasParsingError || hasParsingErrors;
    });
    
    return parsedLogs;
  };

  // Filter logs based on selected pods, search, and time range
  const filteredLogs = logs.filter(log => {
    const matchesPod = selectedPods.includes(log.podName);
    const matchesSearch = searchString ? log.line.includes(searchString) : true;
    
    // Time range filtering with proper handling of datetime-local values
    const matchesTime = timeRange.start && timeRange.end ? (() => {
      // Create Date objects from the time range inputs (these will use local timezone)
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);
      
      // Adjust end date to include the full minute (add 59 seconds, 999ms)
      endDate.setSeconds(59);
      endDate.setMilliseconds(999);
      
      return log.timestamp >= startDate && log.timestamp <= endDate;
    })() : true;
    
    return matchesPod && matchesSearch && matchesTime;
  });
  
  // Check if both start and end dates are in the same day
  let isSameDay = false;
  if (timeRange.start && timeRange.end) {
    const startDate = new Date(timeRange.start);
    const endDate = new Date(timeRange.end);
    isSameDay = startDate.getFullYear() === endDate.getFullYear() &&
                startDate.getMonth() === endDate.getMonth() &&
                startDate.getDate() === endDate.getDate();
  }

  // Toast management functions
  const showToast = (message, type) => {
    const id = Date.now(); // unique id for this toast
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
    
    return id;
  };
  
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
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
        <div className="toolbar" ref={toolbarRef} style={{ width: `${toolbarWidth}px` }}>
          <div className="resize-handle" ref={resizeHandleRef} title="Drag to resize toolbar"></div>
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
              <input
                type="text"
                placeholder="Filter pods..."
                value={podSearchFilter}
                onChange={e => setPodSearchFilter(e.target.value)}
                className="pod-filter"
              />
              <div className="pods-container">
                {pods
                  .filter(pod => pod.toLowerCase().includes(podSearchFilter.toLowerCase()))
                  .map(pod => (
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
                      <div 
                        className="pod-color-indicator" 
                        style={{ backgroundColor: podColors[pod] || '#ccc' }}
                      ></div>
                      <label htmlFor={`pod-${pod}`}>{podDisplayNames[pod] || pod}</label>
                      
                      {/* Status icons */}
                      <div className="pod-status-icons">
                        {/* Icon for pods with loaded logs */}
                        {podsWithLogs.includes(pod) && (
                          <div 
                            className="pod-status-icon pod-loaded-icon" 
                            title="Logs loaded successfully"
                          >
                            ✓
                          </div>
                        )}
                        
                        {/* Icon for pods with parsing errors */}
                        {podsWithErrors.includes(pod) && (
                          <div 
                            className="pod-status-icon pod-error-icon" 
                            title="Parsing errors detected"
                          >
                            !
                          </div>
                        )}
                      </div>
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
            <div className="logs-header">
              <h2>Logs {filteredLogs.length > 0 ? `(${filteredLogs.length})` : ''}</h2>
              {filteredLogs.length > 0 && (
                <button 
                  onClick={() => {
                    // Create content for the text file
                    const logContent = filteredLogs.map(log => {
                      const timestamp = isSameDay ? log.shortDisplayString : log.fullDisplayString;
                      const podName = podDisplayNames[log.podName] || log.podName;
                      return `[${timestamp}] [${podName}] ${log.line}`;
                    }).join('\n');
                    
                    // Create a blob with the text content
                    const blob = new Blob([logContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    
                    // Create a temporary link element and trigger download
                    const link = document.createElement('a');
                    link.href = url;
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    link.download = `logs_export_${timestamp}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    
                    // Clean up
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    // Show success toast
                    showToast('Logs exported successfully', 'success');
                  }}
                  className="export-button"
                >
                  Export Logs
                </button>
              )}
            </div>
            <ul>
              {filteredLogs.map((log, index) => (
                <li key={index}>
                  <span className="log-timestamp">
                    {isSameDay ? log.shortDisplayString : log.fullDisplayString}
                  </span>
                  <span 
                    className="log-pod"
                    style={{ 
                      backgroundColor: podColors[log.podName] || '#e5e7eb',
                      color: '#ffffff' 
                    }}
                  >
                    [{podDisplayNames[log.podName] || log.podName}]
                  </span>
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
          <p>Specify a format string for each pod prefix:</p>
          <p>Format examples: <code>MM/DD/YYYY HH:mm:SS</code> or <code>YYYY-MM-DD HH:mm:SS.sss</code></p>
          <p><strong>Important:</strong> Enter pod <em>prefixes</em> (not exact pod names). 
             When several prefixes match a pod, the options of the longest prefix will be used. For example:</p>
          <ul>
            <li><code>frontend</code> - Matches all pods starting with "frontend"</li>
            <li><code>frontend-api</code> - More specific, will be used instead of "frontend" for pods starting with "frontend-api"</li>
            <li><code>backend</code> - Matches all pods starting with "backend"</li>
          </ul>
          
          <div style={{marginBottom: '15px'}}>
            <button 
              onClick={() => {
                // Convert parsingOptions to array format for export
                const optionsArray = Object.entries(parsingOptions).map(([prefix, options]) => {
                  // Handle both old format (string) and new format (object)
                  const isLegacyFormat = typeof options === 'string';
                  const format = isLegacyFormat ? '' : (options.format || '');
                  
                  return {
                    prefix,
                    format
                  };
                }).filter(option => option.format); // Only include entries with a format
                
                // Create a JSON string for download
                const jsonString = JSON.stringify(optionsArray, null, 4);
                
                // Create a blob with the JSON data
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // Create a temporary link and trigger download
                const link = document.createElement('a');
                link.href = url;
                link.download = 'parsing-options.json';
                document.body.appendChild(link);
                link.click();
                
                // Clean up
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              style={{marginRight: '10px'}}
            >
              Export Options
            </button>
            <input
              type="file"
              id="importFile"
              style={{display: 'none'}}
              accept=".json"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      // Parse the imported JSON
                      const importedOptions = JSON.parse(event.target.result);
                      
                      // Validate the format
                      if (!Array.isArray(importedOptions)) {
                        throw new Error('Imported file must contain an array');
                      }
                      
                      // Convert array format to the object format used by the app
                      const newOptions = {};
                      importedOptions.forEach(option => {
                        if (!option.prefix || !option.format) {
                          throw new Error('Each entry must have prefix and format properties');
                        }
                        
                        newOptions[option.prefix] = {
                          format: option.format
                        };
                      });
                      
                      // Update options and save to localStorage
                      updateParsingOptions(newOptions);
                      alert('Parsing options imported successfully!');
                    } catch (error) {
                      alert(`Error importing options: ${error.message}`);
                    }
                    
                    // Clear the file input
                    e.target.value = '';
                  };
                  reader.readAsText(file);
                }
              }}
            />
            <button
              onClick={() => {
                document.getElementById('importFile').click();
              }}
            >
              Import Options
            </button>
          </div>
          
          {Object.entries(parsingOptions).map(([pod, options]) => {
            // Handle both old format (string) and new format (object)
            const isLegacyFormat = typeof options === 'string';
            // For legacy format, convert to format property if possible
            const formatValue = isLegacyFormat ? '' : (options.format || '');
            
            return (
              <div key={pod} style={{margin: '10px 0', padding: '5px 0', borderBottom: '1px solid #eee'}}>
                <div><strong>{pod}</strong></div>
                {isLegacyFormat && (
                  <div style={{marginTop: '5px', color: '#888'}}>
                    <small>Legacy format (regex only): {options}</small>
                  </div>
                )}
                <div style={{marginTop: '5px'}}>
                  <label style={{marginRight: '5px'}}>Format: </label>
                  <input
                    value={formatValue}
                    placeholder="e.g. YYYY-MM-DD HH:mm:SS.sss"
                    onChange={e => {
                      const newFormat = e.target.value;
                      // Create or update with just the format property
                      const newOptions = { 
                        ...parsingOptions, 
                        [pod]: { format: newFormat } 
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
                const format = document.getElementById('newFormat').value;
                
                if (pod) {
                  if (format) {
                    // Create with format only
                    updateParsingOptions({ 
                      ...parsingOptions, 
                      [pod]: { format }
                    });
                  } else {
                    // Format is now required
                    alert("Please provide a format string");
                    return;
                  }
                  
                  // Clear inputs
                  document.getElementById('newPod').value = '';
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
      
      {/* Toast notifications container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-content">{toast.message}</div>
            <button 
              className="toast-close" 
              onClick={() => removeToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Render the App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);