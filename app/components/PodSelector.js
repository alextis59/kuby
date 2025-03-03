// Pod selector component
const React = window.React;

function PodSelector({ 
  pods, 
  selectedPods, 
  onPodSelectionChange, 
  podColors, 
  podDisplayNames,
  podsWithLogs,
  podsWithErrors
}) {
  const [podSearchFilter, setPodSearchFilter] = React.useState('');

  return (
    <div className="pod-selector">
      <label>Pods: </label>
      <div className="pod-selector-actions">
        <button 
          className="select-all-button" 
          onClick={() => onPodSelectionChange([...pods])}
          disabled={pods.length === 0}>
          Select All
        </button>
        <button 
          className="clear-button" 
          onClick={() => onPodSelectionChange([])}
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
                    onPodSelectionChange([...selectedPods, pod]);
                  } else {
                    onPodSelectionChange(selectedPods.filter(p => p !== pod));
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
  );
}

// Export to window
window.PodSelector = PodSelector;