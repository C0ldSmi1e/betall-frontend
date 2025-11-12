(function() {
  'use strict';
  
  if (window.polymarketExtensionLoaded) return;
  window.polymarketExtensionLoaded = true;

  let currentIcon = null;
  let loadingModal = null;
  let iconClicked = false;

  function createFloatingIcon() {
    const icon = document.createElement('div');
    icon.className = 'polymarket-icon';
    icon.setAttribute('data-polymarket-extension', 'true');
    
    Object.assign(icon.style, {
      pointerEvents: 'all',
      position: 'absolute',
      zIndex: '999999'
    });
    
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
    hideLoadingModal();
    
    loadingModal = createLoadingModal();
    addModalHandlers(loadingModal, hideLoadingModal);
    document.body.appendChild(loadingModal);
    
    setTimeout(() => loadingModal?.classList.add('polymarket-modal-show'), 10);
  }

  function hideLoadingModal() {
    loadingModal?.remove();
    loadingModal = null;
  }

  function positionIcon(icon, selection) {
    if (!selection.rangeCount) return;
    
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    icon.style.left = `${window.scrollX + rect.right + 5}px`;
    icon.style.top = `${window.scrollY + rect.top}px`;
  }

  function showIcon(selectedText) {
    hideIcon();
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    currentIcon = createFloatingIcon();
    positionIcon(currentIcon, selection);
    currentIcon.addEventListener('mousedown', handleIconClick(selectedText));
    document.body.appendChild(currentIcon);
  }

  function handleIconClick(selectedText) {
    return (e) => {
      iconClicked = true;
      e.preventDefault();
      e.stopPropagation();
      
      setTimeout(() => {
        showLoadingModal();
        
        chrome.runtime.sendMessage({
          action: 'matchMarkets',
          text: selectedText
        }).catch(() => {
          hideLoadingModal();
          showErrorModal('Extension context invalidated. Please refresh the page.');
        });
        
        hideIcon();
      }, 10);
    };
  }

  function hideIcon() {
    currentIcon?.remove();
    currentIcon = null;
  }

  function handleTextSelection() {
    if (iconClicked) {
      iconClicked = false;
      return;
    }
    
    const selectedText = window.getSelection().toString().trim();
    selectedText.length >= 10 ? showIcon(selectedText) : hideIcon();
  }

  function addModalHandlers(modal, closeHandler) {
    const closeBtn = modal.querySelector('.polymarket-close-btn');
    const backdrop = modal.querySelector('.polymarket-modal-backdrop');
    
    closeBtn?.addEventListener('click', closeHandler);
    backdrop?.addEventListener('click', closeHandler);
  }


  function createModal(content, isMarketModal = false) {
    const modal = document.createElement('div');
    modal.className = `polymarket-loading-modal polymarket-modal-show`;
    
    const modalContentClass = isMarketModal ? 'polymarket-modal-content polymarket-market-modal' : 'polymarket-modal-content';
    
    modal.innerHTML = `
      <div class="polymarket-modal-backdrop"></div>
      <div class="${modalContentClass}">
        <div class="polymarket-modal-header">
          <div class="polymarket-label">POLYMARKET</div>
          <button class="polymarket-close-btn">&times;</button>
        </div>
        ${content}
      </div>
    `;
    
    const closeModal = () => modal.remove();
    const closeBtn = modal.querySelector('.polymarket-close-btn');
    const backdrop = modal.querySelector('.polymarket-modal-backdrop');
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    document.body.appendChild(modal);
    return modal;
  }

  function showMarketModal(market) {
    const content = `
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
    `;
    createModal(content, true);
  }

  function showErrorModal(error) {
    const content = `
      <div class="polymarket-loading-content">
        <p style="color: #FF5A7A;">${escapeHtml(error)}</p>
      </div>
    `;
    createModal(content);
  }

  function showEmptyModal() {
    const content = `
      <div class="polymarket-loading-content">
        <p>No prediction markets found for your selection.</p>
      </div>
    `;
    createModal(content);
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
  const messageHandlers = {
    showMarket: (message) => {
      hideLoadingModal();
      showMarketModal(message.market);
    },
    showError: (message) => {
      hideLoadingModal();
      showErrorModal(message.error);
    },
    showEmpty: () => {
      hideLoadingModal();
      showEmptyModal();
    }
  };

  chrome.runtime.onMessage.addListener((message) => {
    const handler = messageHandlers[message.action];
    if (handler) {
      handler(message);
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