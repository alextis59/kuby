// Logs display component
const React = window.React;

function LogsDisplay({ logs, podDisplayNames, podColors, isSameDay, isSinglePod, showToast }) {
  const filteredLogs = logs;
  
  return (
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
              {!isSinglePod && (
                <span 
                  className="log-pod"
                  style={{ 
                    backgroundColor: podColors[log.podName] || '#e5e7eb',
                    color: '#ffffff' 
                  }}
                >
                  [{podDisplayNames[log.podName] || log.podName}]
                </span>
              )}
              <span className="log-line">{log.line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Export to window
window.LogsDisplay = LogsDisplay;