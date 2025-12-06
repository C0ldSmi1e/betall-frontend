(function() {
  'use strict';
  
  if (window.polymarketExtensionLoaded) return;
  window.polymarketExtensionLoaded = true;

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

  // Store tweets waiting for responses with unique IDs
  const pendingTweets = new Map(); // requestId -> tweetElement
  let requestCounter = 0;

  // Listen for messages from background script
  const messageHandlers = {
    showMarket: (message) => {
      const requestId = message.requestId;
      const tweetElement = pendingTweets.get(requestId);
      if (tweetElement) {
        pendingTweets.delete(requestId);
        const logText = `=== POLYMARKET MATCH FOUND ===
Request ID: ${requestId}
Tweet: ${message.debug?.text || tweetElement.tweetText}
All matching slugs: ${JSON.stringify(message.debug?.slugs || [])}
Selected slug: ${JSON.stringify(message.debug?.selectedSlug || {})}
Market question: ${JSON.stringify(message.market?.question || {})}
Market URL: ${JSON.stringify(message.market?.url || {})}
================================\n`;
        // console.log(logText);
        addBetButton(tweetElement, message.market, message.debug?.selectedSlug);
      }
    },
    showError: (message) => {
      const requestId = message.requestId;
      const tweetElement = pendingTweets.get(requestId);
      if (tweetElement) {
        pendingTweets.delete(requestId);
        const logText = `=== POLYMARKET ERROR ===
Request ID: ${requestId}
Tweet: ${tweetElement.tweetText}
Error: ${message.error}
========================\n`;
        // console.log(logText);
      }
    },
    showEmpty: (message) => {
      const requestId = message.requestId;
      const tweetElement = pendingTweets.get(requestId);
      if (tweetElement) {
        pendingTweets.delete(requestId);
        const logText = `=== NO POLYMARKET MATCH ===
Request ID: ${requestId}
Tweet: ${message.debug?.text || tweetElement.tweetText}
Slugs found: ${message.debug?.slugs || []}
===========================\n`;
        // console.log(logText);
      }
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
      return textElement.textContent.trim();
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
      
      // Store tweet element for later reference
      tweetElement.tweetText = tweetText;
      
      // Send to server
      try {
        await sendTweetToServer(tweetText, tweetElement);
      } catch (error) {
        console.error('[Polymarket Extension] Error processing tweet:', error);
      }
    }
  }

  async function sendTweetToServer(tweetText, tweetElement) {
    // Generate unique request ID
    const requestId = ++requestCounter;
    
    // Add to pending tweets with unique ID
    pendingTweets.set(requestId, tweetElement);
    
    try {
      // Send message to background script to handle the API call
      await chrome.runtime.sendMessage({
        action: 'matchMarkets',
        text: tweetText,
        requestId: requestId
      });
      
    } catch (error) {
      // Clean up on error
      pendingTweets.delete(requestId);
      throw error;
    }
  }

  function addBetButton(tweetElement, marketData, selectedSlug) {
    // Find the tweet text element to insert before it
    const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
    if (!tweetTextElement) {
      return;
    }

    // Find the parent container of the tweet text
    const tweetContentContainer = tweetTextElement.parentElement;
    if (!tweetContentContainer) {
      return;
    }

    console.log("marketData", marketData);
    
    // Create market title button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'polymarket-market-container';
    buttonContainer.style.cssText = `
      margin: 8px 0 4px 0;
      padding: 0;
    `;
    
    // Create market title button
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'View prediction market');
    button.setAttribute('role', 'button');
    button.className = 'polymarket-market-button';
    button.setAttribute('type', 'button');
    button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      width: auto;
      background: #1A1A1A;
      border: 1px solid #2A2A2A;
      border-left: 3px solid #F5C842;
      border-radius: 6px;
      padding: 8px 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    
    // Create market question text
    const questionText = document.createElement('span');
    questionText.style.cssText = `
      color: #F5C842;
      font-size: 14px;
      font-weight: 500;
    `;
    
    // Add similarity score if available
    const similarity = selectedSlug?.similarity;
    const similarityText = similarity ? ` | ${(similarity * 100).toFixed(0)}%` : '';
    
    // Truncate long questions elegantly for single line
    const baseText = escapeHtml(marketData.question);
    questionText.innerHTML = `${baseText}<span style="opacity: 0.7; font-weight: 400;">${similarityText}</span>`;
    
    // Add hover effects
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#2A2A2A';
      button.style.borderColor = '#F5C842';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#1A1A1A';
      button.style.borderColor = '#2A2A2A';
    });
    
    // Add hover handlers for modal (same as before)
    let currentHoverModal = null;
    
    button.addEventListener('mouseenter', () => {
      currentHoverModal = showHoverModal(marketData, button);
    });
    
    button.addEventListener('mouseleave', () => {
      // Hide modal with small delay to allow moving to modal
      setTimeout(() => {
        if (currentHoverModal && !currentHoverModal.isHovered) {
          hideHoverModal(currentHoverModal);
          currentHoverModal = null;
        }
      }, 100);
    });
    
    // Assemble button
    button.appendChild(questionText);
    buttonContainer.appendChild(button);
    
    // Insert before the tweet text content
    tweetContentContainer.insertBefore(buttonContainer, tweetTextElement);
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
      width: 320px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
      z-index: 999999 !important;
      opacity: 0;
      transform: translateY(4px);
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: auto !important;
    `;
    
    // Create enhanced modal content with payouts
    hoverModal.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <h2 style="color: #FFFFFF; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.4;">${escapeHtml(marketData.question)}</h2>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: #2A2A2A; border-radius: 6px; padding: 12px 16px; border-left: 4px solid #00D395;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: #FFFFFF; font-size: 14px; font-weight: 600; min-width: 30px;">Yes</span>
              <span style="color: #00D395; font-size: 14px; font-weight: 500;">${marketData.yesPercentage}%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #A0A0A0; font-size: 12px;">$10 →</span>
              <span style="color: #00D395; font-size: 16px; font-weight: 600;">$${marketData.yesPayout}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; background: #2A2A2A; border-radius: 6px; padding: 12px 16px; border-left: 4px solid #FF5A7A;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: #FFFFFF; font-size: 14px; font-weight: 600; min-width: 30px;">No</span>
              <span style="color: #FF5A7A; font-size: 14px; font-weight: 500;">${marketData.noPercentage}%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #A0A0A0; font-size: 12px;">$10 →</span>
              <span style="color: #FF5A7A; font-size: 16px; font-weight: 600;">$${marketData.noPayout}</span>
            </div>
          </div>
        </div>
        
        <a href="${escapeHtml(marketData.url)}" target="_blank" class="polymarket-hover-bet-button" style="
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #F5C842;
          color: #000;
          font-size: 14px;
          font-weight: 600;
          padding: 12px;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.2s;
        ">
          Place Bet
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>
    `;
    
    // Add to page first
    document.body.appendChild(hoverModal);
    
    // Position modal relative to button
    positionHoverModal(hoverModal, buttonElement);
    
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
    }, 10);
    
    return hoverModal;
  }

  function positionHoverModal(modal, buttonElement) {
    const buttonRect = buttonElement.getBoundingClientRect();
    const modalWidth = 320;
    const modalHeight = 220;
    const gap = 12;
    
    // Calculate horizontal position (left-aligned with button)
    let x = buttonRect.left;
    
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
    
    // Apply position
    modal.style.setProperty('left', `${x}px`, 'important');
    modal.style.setProperty('top', `${y}px`, 'important');
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
    }
  }

  function observeTweets() {
    if (!isTwitter()) return;
    
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