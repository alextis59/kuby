// Context selector component
const React = window.React;

function ContextSelector({ contexts, selectedContext, onContextChange }) {
  return (
    <div>
      <label>Context: </label>
      <select 
        value={selectedContext} 
        onChange={e => onContextChange(e.target.value)}
      >
        <option value="">Select Context</option>
        {Object.entries(contexts).map(([context, namespace]) => (
          <option key={context} value={context}>{context} ({namespace})</option>
        ))}
      </select>
    </div>
  );
}

// Export to window
window.ContextSelector = ContextSelector;