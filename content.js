let currentIcon = null;

function createFloatingIcon() {
  const icon = document.createElement('div');
  icon.className = 'polymarket-icon';
  icon.setAttribute('data-polymarket-extension', 'true');
  return icon;
}

function positionIcon(icon, selection) {
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Position icon at the end of selection
  icon.style.left = `${window.scrollX + rect.right + 5}px`;
  icon.style.top = `${window.scrollY + rect.top}px`;
}

function showIcon(selectedText) {
  hideIcon(); // Remove any existing icon
  
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  currentIcon = createFloatingIcon();
  positionIcon(currentIcon, selection);
  
  // Add click handler
  currentIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'matchMarkets',
      text: selectedText
    });
    
    hideIcon();
  });
  
  document.body.appendChild(currentIcon);
}

function hideIcon() {
  if (currentIcon) {
    currentIcon.remove();
    currentIcon = null;
  }
}

function handleTextSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  // Only show icon if selection is 10+ characters
  if (selectedText.length >= 10) {
    showIcon(selectedText);
  } else {
    hideIcon();
  }
}

// Listen for text selection
document.addEventListener('mouseup', handleTextSelection);

// Hide icon when clicking elsewhere
document.addEventListener('click', (e) => {
  // Don't hide if clicking on the icon itself
  if (e.target.closest('.polymarket-icon')) return;
  
  // Hide icon when clicking elsewhere
  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection.toString().trim()) {
      hideIcon();
    }
  }, 100);
});

// Hide icon on scroll
window.addEventListener('scroll', hideIcon);

// Hide icon when selection changes
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  if (!selection.toString().trim()) {
    hideIcon();
  }
});