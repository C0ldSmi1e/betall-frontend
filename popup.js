// Polymarket Extension Popup
document.addEventListener('DOMContentLoaded', async function() {
  const radioButtons = document.querySelectorAll('input[name="threshold"]');
  
  // Load current threshold setting
  const result = await chrome.storage.sync.get({ similarityThreshold: 0.5 });
  const threshold = result.similarityThreshold;
  
  // Check the appropriate radio button based on saved threshold
  radioButtons.forEach(radio => {
    if (parseFloat(radio.value) === threshold) {
      radio.checked = true;
    }
  });
  
  // Listen for radio button changes
  radioButtons.forEach(radio => {
    radio.addEventListener('change', async function() {
      if (this.checked) {
        const newThreshold = parseFloat(this.value);
        await chrome.storage.sync.set({ similarityThreshold: newThreshold });
        // console.log('Similarity threshold saved:', newThreshold);
      }
    });
  });
});