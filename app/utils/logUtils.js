// Log utility functions
const moment = window.moment;

// Parse logs from text to structured format
function parseLogs(logsText, podName, parsingOptions) {
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
        // Use a mapping instead of sequential replacements to avoid conflicts
        const formatMap = {
          'YYYY': 'YYYY',
          'YY': 'YY',
          'MM': 'MM',
          'DD': 'DD',
          'HH': 'HH',
          'mm': 'mm',
          'SS': 'ss',
          'sss': 'SSS'
        };
        
        // Create a regex pattern that matches all format tokens
        const tokenPattern = new RegExp(Object.keys(formatMap).join('|'), 'g');
        
        // Replace each token with its moment.js equivalent
        const momentFormat = formatString.replace(tokenPattern, match => formatMap[match]);
        
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
}

// Export to window
window.parseLogs = parseLogs;