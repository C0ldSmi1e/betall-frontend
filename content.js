(function() {
  'use strict';
  
  if (window.polymarketExtensionLoaded) return;
  window.polymarketExtensionLoaded = true;

  let loadingModal = null;


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

  // Store tweets waiting for responses
  const pendingTweets = [];

  // Listen for messages from background script
  const messageHandlers = {
    showMarket: (message) => {
      console.log('📈 MARKET FOUND:', message.market);
      
      // Find the most recent tweet and add button
      const tweetElement = pendingTweets.pop();
      if (tweetElement) {
        addBetButton(tweetElement, message.market);
      }
    },
    showError: (message) => {
      console.log('❌ API ERROR:', message.error);
      pendingTweets.pop(); // Remove from pending
    },
    showEmpty: () => {
      console.log('🔍 NO MARKETS FOUND');
      pendingTweets.pop(); // Remove from pending
    }
  };

  chrome.runtime.onMessage.addListener((message) => {
    const handler = messageHandlers[message.action];
    if (handler) {
      handler(message);
    }
  });

  // Twitter Integration
  function isTwitter() {
    return window.location.hostname === 'twitter.com' || window.location.hostname === 'x.com';
  }

  function extractTweetText(tweetElement) {
    // Try to find tweet text content
    const tweetTextSelector = '[data-testid="tweetText"]';
    const textElement = tweetElement.querySelector(tweetTextSelector);
    
    if (textElement) {
      const text = textElement.textContent.trim();
      console.log('Tweet detected:', text);
      return text;
    }
    
    return null;
  }

  async function processTweet(tweetElement) {
    // Avoid processing the same tweet multiple times
    if (tweetElement.hasAttribute('data-polymarket-processed')) {
      return;
    }
    
    const tweetText = extractTweetText(tweetElement);
    if (tweetText && tweetText.length >= 10) {
      tweetElement.setAttribute('data-polymarket-processed', 'true');
      console.log('Processing tweet:', tweetText);
      
      // Store tweet element for later reference
      tweetElement.tweetText = tweetText;
      
      // Send to server
      try {
        await sendTweetToServer(tweetText, tweetElement);
      } catch (error) {
        console.error('Error processing tweet:', error);
      }
    }
  }

  async function sendTweetToServer(tweetText, tweetElement) {
    console.log('Sending tweet to server:', tweetText);
    
    // Add to pending tweets
    pendingTweets.push(tweetElement);
    
    try {
      // Send message to background script to handle the API call
      await chrome.runtime.sendMessage({
        action: 'matchMarkets',
        text: tweetText
      });
      
      console.log('Background script response received');
      
    } catch (error) {
      console.error('Error communicating with background script:', error);
      throw error;
    }
  }

  function addBetButton(tweetElement, marketData) {
    // Create button container to match Twitter's button structure
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'css-175oi2r r-1awozwy r-6koalj r-18u37iz';
    
    const buttonInner = document.createElement('div');
    buttonInner.className = 'css-175oi2r';
    
    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'css-175oi2r r-18u37iz r-1h0z5md';
    
    // Create bet button
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'View prediction market');
    button.setAttribute('role', 'button');
    button.className = 'css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l';
    button.setAttribute('type', 'button');
    
    const buttonContent = document.createElement('div');
    buttonContent.setAttribute('dir', 'ltr');
    buttonContent.className = 'css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q';
    buttonContent.style.cssText = `
      color: #000 !important;
      background-color: #F5C842 !important;
      font-size: 13px;
      font-weight: 600;
      padding: 0 8px;
      border-radius: 16px;
    `;
    buttonContent.textContent = 'Bet';
    
    // Add hover handlers for modal
    let hoverTimer = null;
    let currentHoverModal = null;
    
    button.addEventListener('mouseenter', () => {
      // Clear any existing timer
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
      
      // Show modal after delay
      hoverTimer = setTimeout(() => {
        currentHoverModal = showHoverModal(marketData, button);
      }, 500);
    });
    
    button.addEventListener('mouseleave', () => {
      // Clear timer if user leaves before delay
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      
      // Hide modal with small delay to allow moving to modal
      setTimeout(() => {
        if (currentHoverModal && !currentHoverModal.isHovered) {
          hideHoverModal(currentHoverModal);
          currentHoverModal = null;
        }
      }, 100);
    });
    
    // Keep click handler as backup
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Bet button clicked');
      if (currentHoverModal) {
        hideHoverModal(currentHoverModal);
      }
      showMarketModal(marketData);
    });
    
    // Assemble button structure
    button.appendChild(buttonContent);
    buttonWrapper.appendChild(button);
    buttonInner.appendChild(buttonWrapper);
    buttonContainer.appendChild(buttonInner);
    
    // Find the Grok button and insert before it
    const grokButton = tweetElement.querySelector('button[aria-label="Grok actions"]');
    if (grokButton && grokButton.parentElement && grokButton.parentElement.parentElement) {
      // Insert into the same container as Grok button
      const buttonParentContainer = grokButton.parentElement.parentElement;
      buttonParentContainer.insertBefore(buttonContainer, grokButton.parentElement);
      console.log('Added Polymarket bet button next to Grok button');
    } else {
      console.log('Could not find Grok button to position Polymarket button');
    }
  }

  function showHoverModal(marketData, buttonElement) {
    // Create compact hover modal
    const hoverModal = document.createElement('div');
    hoverModal.className = 'polymarket-hover-modal';
    hoverModal.style.cssText = `
      position: fixed !important;
      background: #1A1A1A !important;
      border: 1px solid #2A2A2A !important;
      border-radius: 12px !important;
      padding: 16px !important;
      width: 280px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
      z-index: 999999 !important;
      opacity: 0;
      transform: translateY(4px);
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: auto !important;
    `;
    
    // Create modal content
    hoverModal.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="color: #F5C842; font-size: 10px; font-weight: 600; letter-spacing: 0.8px; margin-bottom: 8px;">POLYMARKET</div>
        <div style="color: #FFFFFF; font-size: 14px; font-weight: 500; line-height: 1.3; margin-bottom: 12px;">${escapeHtml(marketData.question)}</div>
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <div style="flex: 1; background: #2A2A2A; border-radius: 6px; padding: 8px 10px; border-left: 3px solid #00D395;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #FFFFFF; font-size: 12px; font-weight: 600;">Yes</span>
            <span style="color: #00D395; font-size: 12px; font-weight: 600;">${marketData.yesPercentage}%</span>
          </div>
        </div>
        <div style="flex: 1; background: #2A2A2A; border-radius: 6px; padding: 8px 10px; border-left: 3px solid #FF5A7A;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #FFFFFF; font-size: 12px; font-weight: 600;">No</span>
            <span style="color: #FF5A7A; font-size: 12px; font-weight: 600;">${marketData.noPercentage}%</span>
          </div>
        </div>
      </div>
      
      <a href="${escapeHtml(marketData.url)}" target="_blank" class="polymarket-hover-bet-button" style="
        display: block;
        background: #F5C842;
        color: #000;
        text-decoration: none;
        text-align: center;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        transition: background 0.2s;
      ">
        Place Bet →
      </a>
    `;
    
    // Add to page first
    document.body.appendChild(hoverModal);
    
    // Position modal relative to button
    positionHoverModal(hoverModal, buttonElement);
    
    console.log('Modal added to DOM, positioning...', {
      modalElement: hoverModal,
      buttonRect: buttonElement.getBoundingClientRect()
    });
    
    // Add hover tracking
    hoverModal.isHovered = false;
    hoverModal.addEventListener('mouseenter', () => {
      hoverModal.isHovered = true;
    });
    hoverModal.addEventListener('mouseleave', () => {
      hoverModal.isHovered = false;
      setTimeout(() => {
        if (!hoverModal.isHovered) {
          hideHoverModal(hoverModal);
        }
      }, 100);
    });

    // Add hover effect to bet button
    const betButton = hoverModal.querySelector('.polymarket-hover-bet-button');
    if (betButton) {
      betButton.addEventListener('mouseenter', () => {
        betButton.style.background = '#E5B832';
      });
      betButton.addEventListener('mouseleave', () => {
        betButton.style.background = '#F5C842';
      });
    }
    
    // Animate in
    setTimeout(() => {
      hoverModal.style.setProperty('opacity', '1', 'important');
      hoverModal.style.setProperty('transform', 'translateY(0)', 'important');
      console.log('Modal should now be visible:', hoverModal.getBoundingClientRect());
    }, 10);
    
    console.log('Hover modal shown');
    return hoverModal;
  }

  function positionHoverModal(modal, buttonElement) {
    const buttonRect = buttonElement.getBoundingClientRect();
    const modalWidth = 280;
    const modalHeight = 160; // Approximate height
    const gap = 12;
    
    console.log('Button rect:', buttonRect);
    
    // Calculate horizontal position (centered on button)
    let x = buttonRect.left + (buttonRect.width / 2) - (modalWidth / 2);
    
    // Ensure modal doesn't go off screen horizontally
    const viewportWidth = window.innerWidth;
    if (x < 10) x = 10;
    if (x + modalWidth > viewportWidth - 10) x = viewportWidth - modalWidth - 10;
    
    // Calculate vertical position (prefer above button)
    let y = buttonRect.top - modalHeight - gap;
    
    // If not enough space above, show below
    if (y < 10) {
      y = buttonRect.bottom + gap;
    }
    
    console.log('Calculated position:', { x, y, modalWidth, modalHeight });
    
    // Apply position
    modal.style.setProperty('left', `${x}px`, 'important');
    modal.style.setProperty('top', `${y}px`, 'important');
    
    console.log('Applied styles:', modal.style.left, modal.style.top);
  }

  function hideHoverModal(hoverModal) {
    if (hoverModal && hoverModal.parentElement) {
      hoverModal.style.opacity = '0';
      hoverModal.style.transform = 'translateY(4px)';
      setTimeout(() => {
        if (hoverModal.parentElement) {
          hoverModal.remove();
        }
      }, 200);
      console.log('Hover modal hidden');
    }
  }

  function observeTweets() {
    if (!isTwitter()) return;
    
    console.log('Starting Twitter tweet observation');
    
    // Process existing tweets on page load
    const existingTweets = document.querySelectorAll('[data-testid="tweet"]');
    existingTweets.forEach(processTweet);
    
    // Watch for new tweets
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a tweet
            if (node.matches && node.matches('[data-testid="tweet"]')) {
              processTweet(node);
            }
            // Check if the added node contains tweets
            const tweets = node.querySelectorAll && node.querySelectorAll('[data-testid="tweet"]');
            if (tweets) {
              tweets.forEach(processTweet);
            }
          }
        });
      });
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('Tweet observer started');
  }

  // Initialize Twitter integration
  if (isTwitter()) {
    // Wait for page to load, then start observing
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeTweets);
    } else {
      observeTweets();
    }
  }

})();