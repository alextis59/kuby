// React import is provided by the script tags in index.html
const React = window.React;
const ReactDOM = window.ReactDOM;

// Access utilities from window - these are set in the HTML file
const { 
  truncatePodName, generatePodColor, parseLogs, 
  fetchContexts, setContext, fetchPods, fetchPodLogs,
  createLogStream, stopLogStream,
  DEFAULT_TOOLBAR_WIDTH, DEFAULT_TAIL_LINES 
} = window;

// Component references
const {
  Toolbar, LogsDisplay, ParsingOptionsModal, 
  ToastNotification, useToasts
} = window;

function App() {
  // State variables
  const [contexts, setContexts] = React.useState({});
  const [selectedContext, setSelectedContext] = React.useState('');
  const [selectedNamespace, setSelectedNamespace] = React.useState('');
  const [pods, setPods] = React.useState([]);
  const [podDisplayNames, setPodDisplayNames] = React.useState({}); // Mapping of full pod names to display names
  const [podColors, setPodColors] = React.useState({}); // Mapping of pod names to colors
  const [selectedPods, setSelectedPods] = React.useState([]);
  const [logOption, setLogOption] = React.useState(() => {
    // Try to load from localStorage or use 'complete' as default
    const savedOption = localStorage.getItem('logOption');
    return savedOption || 'complete'; // 'complete' or 'tail'
  });
  const [tailLines, setTailLines] = React.useState(() => {
    // Try to load from localStorage or use default value
    const savedTailLines = localStorage.getItem('tailLines');
    return savedTailLines ? parseInt(savedTailLines, 10) : DEFAULT_TAIL_LINES;
  });
  const [logs, setLogs] = React.useState([]);
  const [podsWithLogs, setPodsWithLogs] = React.useState([]); // Pods for which logs were successfully loaded
  const [podsWithErrors, setPodsWithErrors] = React.useState([]); // Pods with parsing errors
  const [searchString, setSearchString] = React.useState('');
  const [timeRange, setTimeRange] = React.useState({ start: '', end: '' });
  const [parsingOptions, setParsingOptions] = React.useState({});
  const [showEditor, setShowEditor] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamSocket, setStreamSocket] = React.useState(null);
  
  // Toast notifications
  const { toasts, showToast, removeToast } = useToasts();
  
  // Toolbar width state
  const [toolbarWidth, setToolbarWidth] = React.useState(() => {
    // Try to load from localStorage or use default width
    const savedWidth = localStorage.getItem('toolbarWidth');
    return savedWidth ? parseInt(savedWidth, 10) : DEFAULT_TOOLBAR_WIDTH;
  });

  // Load parsing options from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('parsingOptions');
    if (stored) {
      setParsingOptions(JSON.parse(stored));
    }
  }, []);

  // Fetch contexts on mount
  React.useEffect(() => {
    fetchContextsData();
  }, []);

  // When context is selected, update the namespace and set the context
  React.useEffect(() => {
    if (selectedContext) {
      setSelectedNamespace(contexts[selectedContext]);
      setContextData(selectedContext);
    } else {
      setSelectedNamespace('');
      setPods([]);
      setSelectedPods([]);
    }
  }, [selectedContext, contexts]);

  // Fetch pods when namespace changes
  React.useEffect(() => {
    if (selectedNamespace) {
      fetchPodsData(selectedNamespace);
    } else {
      setPods([]);
      setSelectedPods([]);
    }
  }, [selectedNamespace]);

  // Fetch functions
  const fetchContextsData = async () => {
    setLoading(true);
    try {
      const data = await fetchContexts();
      setContexts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setContextData = async (context) => {
    try {
      await setContext(context);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchPodsData = async (namespace) => {
    setLoading(true);
    try {
      const data = await fetchPods(namespace);
      setPods(data);
      
      // Create mapping of full pod names to truncated display names
      const displayNameMap = {};
      // Create mapping of pod names to colors
      const colorMap = {};
      
      data.forEach(pod => {
        displayNameMap[pod] = truncatePodName(pod);
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
        try {
          const logsText = await fetchPodLogs(
            selectedNamespace, 
            pod, 
            logOption === 'tail', 
            tailLines
          );
          
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

  // Update parsing options
  const updateParsingOptions = (newOptions) => {
    setParsingOptions(newOptions);
    localStorage.setItem('parsingOptions', JSON.stringify(newOptions));
  };

  // Handle toolbar width change
  const handleToolbarWidthChange = (newWidth) => {
    setToolbarWidth(newWidth);
    localStorage.setItem('toolbarWidth', newWidth.toString());
  };
  
  // Handle log option change and save to localStorage
  const handleLogOptionChange = (option) => {
    setLogOption(option);
    localStorage.setItem('logOption', option);
  };
  
  // Handle tail lines change and save to localStorage
  const handleTailLinesChange = (lines) => {
    setTailLines(lines);
    localStorage.setItem('tailLines', lines.toString());
  };
  
  // Start streaming logs for all selected pods
  const startStreaming = () => {
    if (!selectedNamespace || selectedPods.length === 0) {
      setError('Please select a namespace and at least one pod');
      showToast('Please select a namespace and at least one pod', 'error');
      return;
    }
    
    // Clear existing logs
    setLogs([]);
    setPodsWithLogs([...selectedPods]);
    setPodsWithErrors([]);
    
    // Create a WebSocket connection
    const socket = createLogStream(
      selectedNamespace,
      selectedPods.join(','), // Send all selected pods as comma-separated string
      // On message callback
      (data) => {
        if (data.type === 'log') {
          // Parse log data
          const parsedLogs = parseLogs(data.data, data.pod, parsingOptions);
          
          // Add pod name to each log entry
          const logsWithPodName = parsedLogs.map(log => ({
            ...log,
            podName: data.pod
          }));
          
          // Check for log entries without timestamps that need to be merged with previous log entry
          setLogs(prevLogs => {
            // Handle special case where we have untimestamped logs
            if (logsWithPodName.length > 0 && logsWithPodName.some(log => log.hasParsingError)) {
              const result = [...prevLogs];
              
              // Process logs with parsing errors (no timestamp)
              const logsWithErrors = logsWithPodName.filter(log => log.hasParsingError);
              const mergedLogs = [];
              
              // Process each log with error
              logsWithErrors.forEach(log => {
                let merged = false;
                
                // Try to find the last log entry from the same pod
                const lastLogIndex = result.length - 1;
                for (let i = lastLogIndex; i >= 0; i--) {
                  if (result[i].podName === log.podName) {
                    // Merge the content with the previous log from the same pod
                    result[i].line += '\n' + log.line;
                    merged = true;
                    break; // Stop searching once we found a match
                  }
                }
                
                // If no previous log from this pod was found, add to a list to be added separately
                if (!merged) {
                  mergedLogs.push(log);
                }
              });
              
              // Add all logs that have proper timestamps and unmerged logs with errors
              const logsToAdd = logsWithPodName.filter(log => !log.hasParsingError);
              return [...result, ...mergedLogs, ...logsToAdd];
            }
            
            // Normal case - just append all logs
            return [...prevLogs, ...logsWithPodName];
          });
        } else if (data.type === 'error') {
          showToast(`Error: ${data.data}`, 'error');
          if (!podsWithErrors.includes(data.pod)) {
            setPodsWithErrors(prev => [...prev, data.pod]);
          }
        } else if (data.type === 'info') {
          showToast(data.data, 'info');
        }
      },
      // On error callback
      (error) => {
        setError(`WebSocket error: ${error}`);
        showToast(`WebSocket error: ${error}`, 'error');
      },
      // On close callback
      () => {
        setIsStreaming(false);
        setStreamSocket(null);
        showToast('Log streaming has ended', 'info');
      }
    );
    
    // Store socket reference
    setStreamSocket(socket);
    
    // Update streaming state
    setIsStreaming(true);
    
    showToast(`Started streaming logs for ${selectedPods.length} pod(s)`, 'success');
  };
  
  // Stop streaming logs
  const stopStreaming = () => {
    if (streamSocket) {
      stopLogStream(streamSocket);
      setStreamSocket(null);
      setIsStreaming(false);
      
      // Sort logs by timestamp
      setLogs(prevLogs => {
        // Filter logs that have valid timestamps
        const logsWithTimestamps = prevLogs.filter(log => !log.hasParsingError && log.timestamp);
        
        // Sort logs by timestamp
        const sortedLogs = [...logsWithTimestamps].sort((a, b) => a.timestamp - b.timestamp);
        
        // If there are logs with timestamps, set the time range
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
          
          // Set time range
          setTimeRange({
            start: formatDateForInput(minTimestamp),
            end: formatDateForInput(maxTimestamp)
          });
        }
        
        // Add logs without timestamps at the end
        const logsWithoutTimestamps = prevLogs.filter(log => log.hasParsingError || !log.timestamp);
        
        return [...sortedLogs, ...logsWithoutTimestamps];
      });
      
      showToast('Stopped log streaming', 'info');
    }
  };
  
  // Clean up socket on unmount
  React.useEffect(() => {
    return () => {
      if (streamSocket) {
        stopLogStream(streamSocket);
      }
    };
  }, [streamSocket]);

  // Filter logs based on selected pods, search, and time range
  const filteredLogs = logs.filter(log => {
    const matchesPod = selectedPods.includes(log.podName);
    const matchesSearch = searchString ? log.line.includes(searchString) : true;
    
    // Time range filtering with proper handling of datetime-local values
    // Skip time range filtering if streaming is active
    const matchesTime = isStreaming ? true : (timeRange.start && timeRange.end ? (() => {
      // Create Date objects from the time range inputs (these will use local timezone)
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);
      
      // Adjust end date to include the full minute (add 59 seconds, 999ms)
      endDate.setSeconds(59);
      endDate.setMilliseconds(999);
      
      return log.timestamp >= startDate && log.timestamp <= endDate;
    })() : true);
    
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

  return (
    <div className="App">
      <h1>KUBY</h1>
      
      <div className="main-container">
        {/* Left toolbar with all controls */}
        <Toolbar 
          width={toolbarWidth}
          contexts={contexts}
          selectedContext={selectedContext}
          onContextChange={setSelectedContext}
          pods={pods}
          selectedPods={selectedPods}
          onPodSelectionChange={setSelectedPods}
          podColors={podColors}
          podDisplayNames={podDisplayNames}
          podsWithLogs={podsWithLogs}
          podsWithErrors={podsWithErrors}
          logOption={logOption}
          tailLines={tailLines}
          onLogOptionChange={handleLogOptionChange}
          onTailLinesChange={handleTailLinesChange}
          onFetchLogs={fetchLogs}
          onOpenEditor={() => setShowEditor(true)}
          loading={loading}
          searchString={searchString}
          timeRange={timeRange}
          onSearchChange={setSearchString}
          onTimeRangeChange={setTimeRange}
          error={error}
          onWidthChange={handleToolbarWidthChange}
          isStreaming={isStreaming}
          onStartStreaming={startStreaming}
          onStopStreaming={stopStreaming}
        />
        
        {/* Right side with logs */}
        <LogsDisplay 
          logs={filteredLogs} 
          podDisplayNames={podDisplayNames} 
          podColors={podColors} 
          isSameDay={isSameDay}
          isSinglePod={selectedPods.length === 1}
          showToast={showToast}
        />
      </div>
      
      {/* Modal for editing parsing options */}
      {showEditor && (
        <ParsingOptionsModal 
          parsingOptions={parsingOptions}
          updateParsingOptions={updateParsingOptions}
          onClose={() => setShowEditor(false)}
        />
      )}
      
      {/* Toast notifications */}
      <ToastNotification toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

// Make component available through window
window.App = App;

// Render the App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);