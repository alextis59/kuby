// Parsing options modal component
const React = window.React;

function ParsingOptionsModal({ parsingOptions, updateParsingOptions, onClose }) {
  return (
    <div className="modal" style={{width: '800px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', backgroundColor: 'white', padding: '20px', borderRadius: '6px'}}>
      <h2 style={{color: '#222', borderBottom: '2px solid #4a90e2', paddingBottom: '8px', fontSize: '24px', margin: '0 0 15px 0'}}>Edit Parsing Options</h2>
      <div style={{backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '15px'}}>
        <p style={{color: '#222', fontSize: '15px', margin: '0 0 10px 0'}}>Specify a format string for each pod prefix:</p>
        <p style={{color: '#222', fontSize: '15px', margin: '0 0 10px 0'}}>Format examples: <code style={{backgroundColor: '#f5f5f5', padding: '2px 4px', border: '1px solid #e0e0e0'}}>MM/DD/YYYY HH:mm:SS</code> or <code style={{backgroundColor: '#f5f5f5', padding: '2px 4px', border: '1px solid #e0e0e0'}}>YYYY-MM-DD HH:mm:SS.sss</code></p>
        <p style={{color: '#222', fontSize: '15px', margin: '0 0 10px 0'}}><strong>Important:</strong> Enter pod <em>prefixes</em> (not exact pod names). 
          When several prefixes match a pod, the options of the longest prefix will be used. For example:</p>
        <ul style={{color: '#222', marginBottom: '0', paddingLeft: '25px'}}>
          <li style={{margin: '5px 0'}}><code style={{backgroundColor: '#f5f5f5', padding: '2px 4px', border: '1px solid #e0e0e0'}}>frontend</code> - Matches all pods starting with "frontend"</li>
          <li style={{margin: '5px 0'}}><code style={{backgroundColor: '#f5f5f5', padding: '2px 4px', border: '1px solid #e0e0e0'}}>frontend-api</code> - More specific, will be used instead of "frontend" for pods starting with "frontend-api"</li>
          <li style={{margin: '5px 0'}}><code style={{backgroundColor: '#f5f5f5', padding: '2px 4px', border: '1px solid #e0e0e0'}}>backend</code> - Matches all pods starting with "backend"</li>
        </ul>
      </div>
      
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
          style={{marginRight: '10px', padding: '8px 15px', backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
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
          style={{padding: '8px 15px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
        >
          Import Options
        </button>
      </div>
      
      {/* Table to display current parsing options */}
      <div style={{marginBottom: '20px', overflow: 'auto'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead>
            <tr style={{borderBottom: '2px solid #ddd', background: '#4a90e2'}}>
              <th style={{padding: '10px', width: '25%', color: 'white', fontWeight: 'bold'}}>Pod Prefix</th>
              <th style={{padding: '10px', width: '35%', color: 'white', fontWeight: 'bold'}}>Format</th>
              <th style={{padding: '10px', width: '30%', color: 'white', fontWeight: 'bold'}}>Options</th>
              <th style={{padding: '10px', width: '10%', color: 'white', fontWeight: 'bold'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(parsingOptions).map(([pod, options], index) => {
              // Handle both old format (string) and new format (object)
              const isLegacyFormat = typeof options === 'string';
              // For legacy format, convert to format property if possible
              const formatValue = isLegacyFormat ? '' : (options.format || '');
              
              return (
                <tr key={pod} style={{borderBottom: '1px solid #eee', background: index % 2 === 0 ? '#fff' : '#f9f9f9'}}>
                  <td style={{padding: '10px'}}>
                    <strong style={{color: '#333', fontSize: '14px'}}>{pod}</strong>
                    {isLegacyFormat && (
                      <div style={{fontSize: '12px', color: '#555', marginTop: '3px'}}>
                        <small>Legacy format (regex only): {options}</small>
                      </div>
                    )}
                  </td>
                  <td style={{padding: '10px'}}>
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
                      style={{width: '100%', padding: '5px', color: '#333', backgroundColor: 'white', border: '1px solid #ccc'}}
                    />
                  </td>
                  <td style={{padding: '10px'}}>
                    <label style={{display: 'flex', alignItems: 'center', color: '#333'}}>
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
                        style={{marginRight: '8px'}}
                      />
                      <span>Merge identical timestamps</span>
                    </label>
                  </td>
                  <td style={{padding: '10px', textAlign: 'center'}}>
                    <button 
                      onClick={() => {
                        const newOptions = { ...parsingOptions };
                        delete newOptions[pod];
                        updateParsingOptions(newOptions);
                      }}
                      style={{padding: '5px 10px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'}}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div style={{margin: '20px 0', padding: '15px', background: '#e8f0fa', borderRadius: '5px', border: '1px solid #c0d5ea'}}>
        <h3 style={{color: '#333', marginTop: '0'}}>Add New Pattern</h3>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end'}}>
          <div style={{flex: '1', minWidth: '200px'}}>
            <label style={{display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold'}}>Pod Prefix:</label>
            <input
              placeholder="e.g. frontend, backend"
              id="newPod"
              style={{width: '100%', padding: '8px', color: '#333', backgroundColor: 'white', border: '1px solid #ccc'}}
            />
          </div>
          <div style={{flex: '2', minWidth: '300px'}}>
            <label style={{display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold'}}>Format:</label>
            <input
              placeholder="e.g. YYYY-MM-DD HH:mm:SS.sss"
              id="newFormat"
              style={{width: '100%', padding: '8px', color: '#333', backgroundColor: 'white', border: '1px solid #ccc'}}
            />
          </div>
          <div style={{flex: '1', minWidth: '200px'}}>
            <label style={{display: 'flex', alignItems: 'center', color: '#333'}}>
              <input
                type="checkbox"
                id="newMergeTimestamps"
                style={{marginRight: '8px'}}
              />
              <span>Merge identical timestamps</span>
            </label>
          </div>
          <div>
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
              style={{padding: '8px 15px', background: '#4a90e2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
            >
              Add
            </button>
          </div>
        </div>
      </div>
      
      <div style={{textAlign: 'right', marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px'}}>
        <button 
          onClick={onClose}
          style={{padding: '8px 20px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Export to window
window.ParsingOptionsModal = ParsingOptionsModal;