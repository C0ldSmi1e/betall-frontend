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
    
    // Add click handler to show modal
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Bet button clicked');
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