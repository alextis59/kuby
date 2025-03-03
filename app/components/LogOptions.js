// Log options component
const React = window.React;

function LogOptions({ 
  logOption, 
  tailLines, 
  onLogOptionChange, 
  onTailLinesChange, 
  onFetchLogs, 
  onOpenEditor,
  loading,
  selectedPods 
}) {
  return (
    <div className="options">
      <label>Log Option:</label>
      <select value={logOption} onChange={e => onLogOptionChange(e.target.value)}>
        <option value="complete">Complete Logs</option>
        <option value="tail">Last X Lines</option>
      </select>
      {logOption === 'tail' && (
        <>
          <label>Number of Lines:</label>
          <input
            type="number"
            value={tailLines}
            onChange={e => onTailLinesChange(e.target.value)}
            min="1"
          />
        </>
      )}
      <button 
        onClick={onFetchLogs} 
        disabled={loading || selectedPods.length === 0}
      >
        {loading ? 'Fetching...' : 'Fetch Logs'}
      </button>
      <button onClick={onOpenEditor}>Edit Parsing Options</button>
    </div>
  );
}

// Export to window
window.LogOptions = LogOptions;