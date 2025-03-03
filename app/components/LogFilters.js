// Log filters component
const React = window.React;

function LogFilters({ searchString, timeRange, onSearchChange, onTimeRangeChange, isStreaming }) {
  return (
    <div className="filters">
      <label>Search Logs:</label>
      <input
        type="text"
        placeholder="Search logs..."
        value={searchString}
        onChange={e => onSearchChange(e.target.value)}
      />
      {!isStreaming && (
        <>
          <label>Time Range:</label>
          <input
            type="datetime-local"
            value={timeRange.start}
            onChange={e => onTimeRangeChange({ ...timeRange, start: e.target.value })}
          />
          <input
            type="datetime-local"
            value={timeRange.end}
            onChange={e => onTimeRangeChange({ ...timeRange, end: e.target.value })}
          />
        </>
      )}
    </div>
  );
}

// Export to window
window.LogFilters = LogFilters;