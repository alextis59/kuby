// Parsing options modal component
const React = window.React;

function ParsingOptionsModal({ parsingOptions, updateParsingOptions, onClose }) {
  return (
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
              // Include mergeIdenticalTimestamps option if present
              const mergeIdenticalTimestamps = isLegacyFormat ? false : !!options.mergeIdenticalTimestamps;
              
              return {
                prefix,
                format,
                mergeIdenticalTimestamps
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
                      format: option.format,
                      // Include mergeIdenticalTimestamps if present in the imported option
                      ...(option.mergeIdenticalTimestamps !== undefined && { mergeIdenticalTimestamps: option.mergeIdenticalTimestamps })
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
                  // Preserve existing options including mergeIdenticalTimestamps
                  const newOptions = { 
                    ...parsingOptions, 
                    [pod]: { 
                      ...(isLegacyFormat ? {} : parsingOptions[pod]),
                      format: newFormat 
                    } 
                  };
                  updateParsingOptions(newOptions);
                }}
                style={{width: '250px'}}
              />
            </div>
            <div style={{marginTop: '5px'}}>
              <label>
                <input
                  type="checkbox"
                  checked={!isLegacyFormat && parsingOptions[pod].mergeIdenticalTimestamps}
                  onChange={e => {
                    const mergeIdenticalTimestamps = e.target.checked;
                    // Update or create the mergeIdenticalTimestamps property
                    const newOptions = { 
                      ...parsingOptions, 
                      [pod]: { 
                        ...(isLegacyFormat ? { format: '' } : parsingOptions[pod]),
                        mergeIdenticalTimestamps 
                      } 
                    };
                    updateParsingOptions(newOptions);
                  }}
                  style={{marginRight: '5px'}}
                />
                Merge lines with identical timestamps
              </label>
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
        <div style={{marginTop: '5px'}}>
          <label>
            <input
              type="checkbox"
              id="newMergeTimestamps"
              style={{marginRight: '5px'}}
            />
            Merge lines with identical timestamps
          </label>
        </div>
        <button 
          onClick={() => {
            const pod = document.getElementById('newPod').value;
            const format = document.getElementById('newFormat').value;
            const mergeIdenticalTimestamps = document.getElementById('newMergeTimestamps').checked;
            
            if (pod) {
              if (format) {
                // Create with format and mergeIdenticalTimestamps option
                updateParsingOptions({ 
                  ...parsingOptions, 
                  [pod]: { format, mergeIdenticalTimestamps }
                });
              } else {
                // Format is now required
                alert("Please provide a format string");
                return;
              }
              
              // Clear inputs
              document.getElementById('newPod').value = '';
              document.getElementById('newFormat').value = '';
              document.getElementById('newMergeTimestamps').checked = false;
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
        onClick={onClose}
        style={{marginTop: '15px'}}
      >
        Close
      </button>
    </div>
  );
}

// Export to window
window.ParsingOptionsModal = ParsingOptionsModal;