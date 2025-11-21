// Polymarket Extension Popup
document.addEventListener('DOMContentLoaded', async function() {
  const thresholdInput = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  
  // Load current threshold setting
  const result = await chrome.storage.sync.get({ similarityThreshold: 0.5 });
  const threshold = result.similarityThreshold;
  
  if (thresholdInput && thresholdValue) {
    thresholdInput.value = threshold;
    thresholdValue.textContent = threshold;
    
    // Update display value as user drags
    thresholdInput.addEventListener('input', function() {
      thresholdValue.textContent = this.value;
    });
    
    // Save when user releases
    thresholdInput.addEventListener('change', async function() {
      const newThreshold = parseFloat(this.value);
      await chrome.storage.sync.set({ similarityThreshold: newThreshold });
      console.log('Similarity threshold saved:', newThreshold);
    });
  }
});