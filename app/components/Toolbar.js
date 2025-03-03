// Toolbar component
const React = window.React;

// Get constants from window object
const { MIN_TOOLBAR_WIDTH, MAX_TOOLBAR_WIDTH, ContextSelector, PodSelector, LogOptions, LogFilters } = window;

function Toolbar({ 
  width,
  contexts,
  selectedContext,
  onContextChange,
  pods,
  selectedPods,
  onPodSelectionChange,
  podColors,
  podDisplayNames,
  podsWithLogs,
  podsWithErrors,
  logOption,
  tailLines,
  onLogOptionChange,
  onTailLinesChange,
  onFetchLogs,
  onOpenEditor,
  loading,
  searchString,
  timeRange,
  onSearchChange,
  onTimeRangeChange,
  error,
  onWidthChange,
  isStreaming,
  onStartStreaming,
  onStopStreaming
}) {
  // References and state variables for toolbar resizing
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
    toolbar.style.width = `${width}px`;
    
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
      const newWidth = Math.max(MIN_TOOLBAR_WIDTH, Math.min(MAX_TOOLBAR_WIDTH, startWidthRef.current + deltaX));
      
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
        onWidthChange(newWidth);
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
      const newWidth = Math.max(MIN_TOOLBAR_WIDTH, Math.min(MAX_TOOLBAR_WIDTH, startWidthRef.current + deltaX));
      
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
        onWidthChange(newWidth);
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
  }, [width, onWidthChange]);

  return (
    <div className="toolbar" ref={toolbarRef} style={{ width: `${width}px` }}>
      <div className="resize-handle" ref={resizeHandleRef} title="Drag to resize toolbar"></div>
      <div className="selectors">
        <ContextSelector 
          contexts={contexts} 
          selectedContext={selectedContext} 
          onContextChange={onContextChange}
        />
        
        <PodSelector 
          pods={pods}
          selectedPods={selectedPods}
          onPodSelectionChange={onPodSelectionChange}
          podColors={podColors}
          podDisplayNames={podDisplayNames}
          podsWithLogs={podsWithLogs}
          podsWithErrors={podsWithErrors}
        />
      </div>

      <LogOptions 
        logOption={logOption}
        tailLines={tailLines}
        onLogOptionChange={onLogOptionChange}
        onTailLinesChange={onTailLinesChange}
        onFetchLogs={onFetchLogs}
        onOpenEditor={onOpenEditor}
        loading={loading}
        selectedPods={selectedPods}
        isStreaming={isStreaming}
        onStartStreaming={onStartStreaming}
        onStopStreaming={onStopStreaming}
      />

      <LogFilters 
        searchString={searchString}
        timeRange={timeRange}
        onSearchChange={onSearchChange}
        onTimeRangeChange={onTimeRangeChange}
        isStreaming={isStreaming}
      />
      
      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Loading...</p>}
    </div>
  );
}

// Export to window
window.Toolbar = Toolbar;