(function() {
  'use strict';
  
  // Prevent multiple script injections
  if (window.polymarketExtensionLoaded) {
    return;
  }
  window.polymarketExtensionLoaded = true;

  let currentIcon = null;
  let loadingModal = null;
  let iconClicked = false;

  function createFloatingIcon() {
    const icon = document.createElement('div');
    icon.className = 'polymarket-icon';
    icon.setAttribute('data-polymarket-extension', 'true');
    
    // Add explicit pointer events to ensure the icon captures mouse events
    icon.style.pointerEvents = 'all';
    icon.style.position = 'absolute';
    icon.style.zIndex = '999999';
    
    return icon;
  }

  function createLoadingModal() {
    const modal = document.createElement('div');
    modal.className = 'polymarket-loading-modal';
    modal.innerHTML = `
      <div class="polymarket-modal-backdrop"></div>
      <div class="polymarket-modal-content">
        <div class="polymarket-modal-header">
          <div class="polymarket-label">POLYMARKET</div>
          <button class="polymarket-close-btn">&times;</button>
        </div>
        <div class="polymarket-loading-content">
          <div class="polymarket-spinner"></div>
          <p>Finding prediction markets...</p>
        </div>
      </div>
    `;
    return modal;
  }

  function showLoadingModal() {
    hideLoadingModal(); // Remove any existing modal
    
    loadingModal = createLoadingModal();
    
    // Add close handlers
    const closeBtn = loadingModal.querySelector('.polymarket-close-btn');
    const backdrop = loadingModal.querySelector('.polymarket-modal-backdrop');
    
    closeBtn.addEventListener('click', hideLoadingModal);
    backdrop.addEventListener('click', hideLoadingModal);
    
    document.body.appendChild(loadingModal);
    
    // Animate in
    setTimeout(() => {
      if (loadingModal) {
        loadingModal.classList.add('polymarket-modal-show');
      }
    }, 10);
  }

  function hideLoadingModal() {
    if (loadingModal) {
      loadingModal.remove();
      loadingModal = null;
    }
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
    
    currentIcon.addEventListener('mousedown', (e) => {
      iconClicked = true;
      e.preventDefault();
      e.stopPropagation();
      
      // Trigger the action immediately on mousedown
      setTimeout(() => {
        showLoadingModal();
        
        console.log('Sending message to background:', selectedText);
        
        // Send message to background script
        chrome.runtime.sendMessage({
          action: 'matchMarkets',
          text: selectedText
        }).catch((error) => {
          console.error('Failed to send message:', error);
          hideLoadingModal();
          showErrorModal('Extension context invalidated. Please refresh the page.');
        });
        
        hideIcon();
      }, 10);
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
    if (iconClicked) {
      iconClicked = false;
      return;
    }
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // Only show icon if selection is 10+ characters
    if (selectedText.length >= 10) {
      showIcon(selectedText);
    } else {
      hideIcon();
    }
  }


  function showMarketModal(market) {
    const modal = document.createElement('div');
    modal.className = 'polymarket-loading-modal polymarket-modal-show';
    modal.innerHTML = `
      <div class="polymarket-modal-backdrop"></div>
      <div class="polymarket-modal-content polymarket-market-modal">
        <div class="polymarket-modal-header">
          <div class="polymarket-label">POLYMARKET</div>
          <button class="polymarket-close-btn">&times;</button>
        </div>
        <div class="polymarket-market-content">
          <h2 class="polymarket-market-title">${escapeHtml(market.question)}</h2>
          
          <div class="polymarket-bet-options">
            <div class="polymarket-bet-option polymarket-yes-option">
              <div class="polymarket-option-info">
                <span class="polymarket-outcome-label">Yes</span>
                <span class="polymarket-outcome-percentage">${market.yesPercentage}%</span>
              </div>
              <div class="polymarket-payout-info">
                <span class="polymarket-bet-amount">$10 →</span>
                <span class="polymarket-payout-amount">$${market.yesPayout}</span>
              </div>
            </div>

            <div class="polymarket-bet-option polymarket-no-option">
              <div class="polymarket-option-info">
                <span class="polymarket-outcome-label">No</span>
                <span class="polymarket-outcome-percentage">${market.noPercentage}%</span>
              </div>
              <div class="polymarket-payout-info">
                <span class="polymarket-bet-amount">$10 →</span>
                <span class="polymarket-payout-amount">$${market.noPayout}</span>
              </div>
            </div>
          </div>

          <a href="${escapeHtml(market.url)}" target="_blank" class="polymarket-place-bet-button">
            Place Bet
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    `;
    
    // Add close handlers
    const closeBtn = modal.querySelector('.polymarket-close-btn');
    const backdrop = modal.querySelector('.polymarket-modal-backdrop');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    document.body.appendChild(modal);
  }

  function showErrorModal(error) {
    const modal = document.createElement('div');
    modal.className = 'polymarket-loading-modal polymarket-modal-show';
    modal.innerHTML = `
      <div class="polymarket-modal-backdrop"></div>
      <div class="polymarket-modal-content">
        <div class="polymarket-modal-header">
          <div class="polymarket-label">POLYMARKET</div>
          <button class="polymarket-close-btn">&times;</button>
        </div>
        <div class="polymarket-loading-content">
          <p style="color: #FF5A7A;">${escapeHtml(error)}</p>
        </div>
      </div>
    `;
    
    const closeBtn = modal.querySelector('.polymarket-close-btn');
    const backdrop = modal.querySelector('.polymarket-modal-backdrop');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    document.body.appendChild(modal);
  }

  function showEmptyModal() {
    const modal = document.createElement('div');
    modal.className = 'polymarket-loading-modal polymarket-modal-show';
    modal.innerHTML = `
      <div class="polymarket-modal-backdrop"></div>
      <div class="polymarket-modal-content">
        <div class="polymarket-modal-header">
          <div class="polymarket-label">POLYMARKET</div>
          <button class="polymarket-close-btn">&times;</button>
        </div>
        <div class="polymarket-loading-content">
          <p>No prediction markets found for your selection.</p>
        </div>
      </div>
    `;
    
    const closeBtn = modal.querySelector('.polymarket-close-btn');
    const backdrop = modal.querySelector('.polymarket-modal-backdrop');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    document.body.appendChild(modal);
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showMarket') {
      hideLoadingModal();
      showMarketModal(message.market);
    } else if (message.action === 'showError') {
      hideLoadingModal();
      showErrorModal(message.error);
    } else if (message.action === 'showEmpty') {
      hideLoadingModal();
      showEmptyModal();
    }
  });

  // Event listeners
  document.addEventListener('mouseup', (e) => {
    if (e.target.closest('.polymarket-icon')) {
      return;
    }
    handleTextSelection();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.polymarket-icon')) {
      return;
    }
    
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection.toString().trim()) {
        hideIcon();
      }
    }, 100);
  });

  window.addEventListener('scroll', hideIcon);

  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection.toString().trim()) {
      hideIcon();
    }
  });

})();