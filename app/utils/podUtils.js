// Pod utility functions

// Function to truncate pod name by removing the ID at the end
function truncatePodName(podName) {
  // Match pod name pattern up to the last dash followed by a hash/ID
  // Common pattern: name-deployment-hash or name-statefulset-ordinal
  return podName.replace(/-[a-z0-9]+$/, '').replace(/-[a-z0-9]+$/, '');
}

// Function to generate a consistent color from a pod name
function generatePodColor(podName) {
  // Use the truncated pod name to ensure all pods of the same type get the same color
  const baseNameForColor = truncatePodName(podName);
  
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < baseNameForColor.length; i++) {
    hash = baseNameForColor.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with good saturation and lightness for readability
  const h = Math.abs(hash % 360); // Hue: 0-359
  const s = 65 + (hash % 20); // Saturation: 65-85%
  const l = 45 + (hash % 15); // Lightness: 45-60%
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Export to window
window.truncatePodName = truncatePodName;
window.generatePodColor = generatePodColor;