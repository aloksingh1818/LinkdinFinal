chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "connect") {
    (async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const message = request.message || "";

      let sent = false;
      let name = document.querySelector('.text-heading-xlarge, h1')?.innerText || "";
      let headline = document.querySelector('.text-body-medium.break-words')?.innerText || "";

      // 1. Try to find a visible Connect button first
      let connectBtn = Array.from(document.querySelectorAll('button[aria-label^="Invite "][aria-label$="to connect"]'))
        .find(btn => btn.querySelector('.artdeco-button__text')?.textContent.trim() === 'Connect')
        || Array.from(document.querySelectorAll('button'))
        .find(btn => btn.querySelector('.artdeco-button__text')?.textContent.trim() === 'Connect');

      // 2. If not found, look for More, then Connect in dropdown (button or div[role=button])
      if (!connectBtn) {
        let moreBtn = Array.from(document.querySelectorAll('button.artdeco-dropdown__trigger')).find(btn =>
          Array.from(btn.querySelectorAll('span')).some(span => span.textContent.trim() === "More")
        );
        if (!moreBtn) {
          moreBtn = Array.from(document.querySelectorAll('button,div[role="button"]')).find(btn =>
            btn.getAttribute('aria-label')?.toLowerCase().includes('more') ||
            Array.from(btn.querySelectorAll('span')).some(span => span.textContent.trim() === "More") ||
            btn.className.includes('artdeco-dropdown__trigger')
          );
        }
        if (moreBtn) {
          moreBtn.click();
          await wait(1000);
          // Now look for Connect in the dropdown (button or div[role=button])
          connectBtn = Array.from(document.querySelectorAll('div[role="menuitem"],button,div[role="button"]'))
            .find(btn =>
              (btn.innerText.trim() === "Connect" || btn.textContent.trim() === "Connect") &&
              (btn.tagName === "BUTTON" || btn.getAttribute("role") === "button")
            );
        }
      }

      if (connectBtn) {
        connectBtn.click();
        await wait(1200);

        if (message) {
          let noteBtn = document.querySelector('button[aria-label="Add a note"]');
          if (noteBtn) {
            noteBtn.click();
            await wait(800);

            let textarea = document.querySelector('textarea');
            if (textarea) {
              textarea.value = message;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }

            let sendBtn = [...document.querySelectorAll('button')].find(b => b.innerText === "Send");
            if (sendBtn) {
              sendBtn.click();
              sent = true;
            }
          }
        } else {
          let sendWithoutNoteBtn = [...document.querySelectorAll('button')].find(btn =>
            btn.innerText.trim() === "Send without a note" ||
            btn.querySelector('.artdeco-button__text')?.textContent.trim() === "Send without a note"
          );
          if (sendWithoutNoteBtn) {
            sendWithoutNoteBtn.click();
            sent = true;
          }
        }
      }

      chrome.runtime.sendMessage({ action: "connection-sent", name, headline, sent });
      sendResponse();
    })();
    return true; // async
  }
  if (request.action === "send-referral-message") {
    (async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const profile = request.profile;

      // Helper function for fuzzy company name matching
      function normalizeCompanyName(name) {
        return name.toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
      }

      function isCompanyMatch(templateCompany, extractedCompany) {
        const template = normalizeCompanyName(templateCompany);
        const extracted = normalizeCompanyName(extractedCompany);
        if (template === extracted) return true;
        if (template.includes(extracted) || extracted.includes(template)) return true;
        const commonSuffixes = [' india', ' international', ' global', ' ltd', ' limited', ' inc', ' corp', ' corporation'];
        for (const suffix of commonSuffixes) {
          if (template.endsWith(suffix) && extracted === template.replace(suffix, '')) return true;
          if (extracted.endsWith(suffix) && template === extracted.replace(suffix, '')) return true;
        }
        return false;
      }

      // 1. Scrape company from profile (try all possible sources)
      let companies = [];
      // NEW: Try the most accurate selector provided by user
      let accurateCompany = document.querySelector('div.ltWxDMYKjgCTPsqSxdLDymWVzFYQPzXUjZEw.inline-show-more-text--is-collapsed.inline-show-more-text--is-collapsed-with-line-clamp');
      if (accurateCompany) {
        companies.push(accurateCompany.textContent.trim());
        console.log('[Company Extraction] Accurate selector found:', accurateCompany.textContent.trim());
      } else {
        console.log('[Company Extraction] Accurate selector NOT found');
        // Fallback: Try to extract company from the visible profile header area
        // Look for company badge next to the name (e.g., .pv-text-details__right-panel)
        let badgeCompany = document.querySelector('.pv-text-details__right-panel span[aria-hidden="true"]');
        if (badgeCompany) {
          companies.push(badgeCompany.textContent.trim());
          console.log('[Company Extraction] Badge company found:', badgeCompany.textContent.trim());
        }
        // Try to extract from the main headline if it contains a company name pattern
        let mainHeadline = document.querySelector('.text-body-medium.break-words')?.innerText || "";
        let companyMatch = mainHeadline.match(/@\s*([\w\s.&-]+)/);
        if (companyMatch && companyMatch[1]) {
          companies.push(companyMatch[1].trim());
          console.log('[Company Extraction] Company from headline @ found:', companyMatch[1].trim());
        }
      }
      // Try to get from Experience section (current company)
      let expCompany = document.querySelector('section.pv-profile-section.experience-section a[data-field="experience_company_logo"] span[aria-hidden="true"]');
      if (expCompany) {
        companies.push(expCompany.textContent.trim());
        console.log('[Company Extraction] Experience section found:', expCompany.textContent.trim());
      }
      // Try to get from button[aria-label^="Current company:"]
      let companyBtn = Array.from(document.querySelectorAll('button[aria-label^="Current company:"]'))[0];
      if (companyBtn) {
        const label = companyBtn.getAttribute('aria-label');
        const cleaned = label.replace("Current company:", "").replace("Click to skip to experience card", "").trim();
        companies.push(cleaned);
        console.log('[Company Extraction] Current company button found:', cleaned);
      }
      // Fallback: try text-body-medium break-words (look for @)
      let headline = document.querySelector('.text-body-medium.break-words')?.innerText || "";
      const atIdx = headline.indexOf('@');
      if (atIdx !== -1) {
        const atCompany = headline.substring(atIdx + 1).trim();
        companies.push(atCompany);
        console.log('[Company Extraction] Headline @ found:', atCompany);
      }
      // Also try right-side company logo alt text
      let logoImg = document.querySelector('img[alt][class*="EntityPhoto-square-1"]');
      if (logoImg) {
        companies.push(logoImg.getAttribute('alt').trim());
        console.log('[Company Extraction] Logo alt found:', logoImg.getAttribute('alt').trim());
      }
      // Remove duplicates and empty values
      companies = companies.filter(c => c && c.trim()).filter((c, i, arr) => arr.indexOf(c) === i);
      console.log('[Company Extraction] Final extracted companies:', companies);

      chrome.storage.local.get(['templates'], res => {
        const templates = res.templates || {};
        let msg = null;
        let matchedCompany = null;
        // Try fuzzy matching first
        for (const [key, value] of Object.entries(templates)) {
          for (const c of companies) {
            console.log(`[Template Matching] Comparing template "${key}" with extracted "${c}"`);
            if (isCompanyMatch(key, c)) {
              msg = value;
              matchedCompany = key;
              console.log(`[Template Matching] Fuzzy match found: "${key}" matches "${c}"`);
              break;
            }
          }
          if (msg) break;
        }
        // If no fuzzy match, try exact match as fallback
        if (!msg) {
          for (const [key, value] of Object.entries(templates)) {
            for (const c of companies) {
              if (key.trim().toLowerCase() === c.trim().toLowerCase()) {
                msg = value;
                matchedCompany = key;
                console.log(`[Template Matching] Exact match found: "${key}" matches "${c}"`);
                break;
              }
            }
            if (msg) break;
          }
        }
        if (!msg) {
          console.log('[Template Matching] No template match found. Skipping.');
          sendResponse({ skipped: companies.join(', ') || 'Unknown', shouldProceed: true });
          return;
        }
        console.log('[Template Matching] Matched template for company:', matchedCompany, 'Message:', msg);
        (async () => {
          // 3. Ensure only one chat window for this profile is open
          let profileName = document.querySelector('.text-heading-xlarge, h1')?.innerText.trim();
          // Close the docked Messaging panel if open
          let messagingDockBtn = document.querySelector('button.msg-overlay-bubble-header__control--close, button[aria-label="Dismiss messaging"]');
          let dockPanel = document.querySelector('.msg-overlay-list-bubble');
          if (dockPanel && messagingDockBtn) {
            console.log('[Chat Tab] Closing docked Messaging panel...');
            messagingDockBtn.click();
            await wait(800);
          }
          // Find all chat overlays for this profile
          let allChatOverlays = Array.from(document.querySelectorAll('.msg-overlay-conversation-bubble'));
          let overlaysForProfile = allChatOverlays.filter(overlay => {
            let header = overlay.querySelector('.msg-overlay-bubble-header__recipient-name');
            return header && header.innerText.includes(profileName);
          });
          // If multiple overlays for this profile, close all but one
          if (overlaysForProfile.length > 1) {
            console.log(`[Chat Tab] Multiple overlays for ${profileName} found. Closing extras...`);
            overlaysForProfile.slice(1).forEach(overlay => {
              let closeBtn = overlay.querySelector('.msg-overlay-bubble-header__control--close');
              if (closeBtn) closeBtn.click();
            });
            await wait(800);
          }
          // Refresh overlays for this profile after closing
          allChatOverlays = Array.from(document.querySelectorAll('.msg-overlay-conversation-bubble'));
          overlaysForProfile = allChatOverlays.filter(overlay => {
            let header = overlay.querySelector('.msg-overlay-bubble-header__recipient-name');
            return header && header.innerText.includes(profileName);
          });
          let chatOverlay = overlaysForProfile[0] || null;
          if (chatOverlay) {
            console.log(`[Chat Tab] Chat overlay for ${profileName} is already open. Focusing chat...`);
            let header = chatOverlay.querySelector('.msg-overlay-bubble-header__recipient-name');
            if (header) header.click();
            await wait(800);
          } else {
            // No overlay for this profile, so close all overlays before opening a new one
            if (allChatOverlays.length > 0) {
              console.log(`[Chat Tab] Closing ${allChatOverlays.length} open chat overlay(s) before opening new chat...`);
              allChatOverlays.forEach(overlay => {
                let closeBtn = overlay.querySelector('.msg-overlay-bubble-header__control--close');
                if (closeBtn) closeBtn.click();
              });
              await wait(1000);
            }
            // Robust Message button selector
            let msgBtn = Array.from(document.querySelectorAll('a,button')).find(btn => {
              let text = btn.innerText?.trim() || btn.textContent?.trim() || '';
              let aria = btn.getAttribute('aria-label')?.toLowerCase() || '';
              return (
                text === "Message" ||
                aria.includes('message') ||
                btn.className.includes('message-anywhere-button') ||
                btn.className.includes('msg-overlay-bubble-header__control')
              );
            });
            if (msgBtn) {
              console.log('[Message Button] Found, clicking...');
              msgBtn.click();
              // Wait for the chat overlay for this profile to appear
              let found = false;
              for (let attempt = 0; attempt < 20; attempt++) {
                await wait(500);
                let overlays = Array.from(document.querySelectorAll('.msg-overlay-conversation-bubble'));
                let overlaysInfo = overlays.map(overlay => {
                  let header = overlay.querySelector('.msg-overlay-bubble-header__recipient-name');
                  return header ? header.innerText : '[no header]';
                });
                console.log(`[Overlay Check] Attempt ${attempt + 1}: overlays open:`, overlaysInfo);
                chatOverlay = overlays.find(overlay => {
                  let header = overlay.querySelector('.msg-overlay-bubble-header__recipient-name');
                  return header && header.innerText.includes(profileName);
                });
                if (chatOverlay) {
                  found = true;
                  break;
                }
                // Fallback: if only one overlay and it has no header, use it
                if (!chatOverlay && overlays.length === 1 && overlaysInfo[0] === '[no header]') {
                  chatOverlay = overlays[0];
                  found = true;
                  console.log('[Overlay Check] Fallback: using the only open overlay with no header.');
                  break;
                }
              }
              if (!found) {
                console.log('[Message Sending] Chat overlay did not appear after clicking Message.');
                sendResponse();
                return;
              }
            } else {
              console.log('[Message Button] NOT found! No chat overlay for profile, and no Message button to click.');
              sendResponse();
              return;
            }
          }
          // Find the input box and Send button inside the correct chat overlay
          let inputBox = null;
          for (let attempt = 0; attempt < 20; attempt++) {
            inputBox = chatOverlay.querySelector('div[contenteditable="true"].msg-form__contenteditable');
            if (inputBox) {
              console.log(`[Message Sending] Input box found on attempt ${attempt + 1}.`);
              break;
            }
            await wait(300);
          }
          if (!inputBox) {
            console.log('[Message Sending] Message input box did not appear in the correct chat overlay.');
            sendResponse();
            return;
          }
          // Focus the window and input box before pasting/typing
          window.focus();
          inputBox.focus();
          inputBox.click();
          await wait(400);
          let pasted = false;
          // 1. Try clipboard paste
          try {
            await navigator.clipboard.writeText(msg);
            document.execCommand('paste');
            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            await wait(500);
            pasted = inputBox.innerText.trim() === msg.trim();
            if (pasted) {
              console.log('[Message Sending] Message pasted via clipboard.');
            } else {
              console.log('[Message Sending] Clipboard paste failed, will try execCommand insertText.');
            }
          } catch (e) {
            console.log('[Message Sending] Clipboard error:', e);
          }
          // 2. Try execCommand('insertText', false, msg) if clipboard failed
          if (!pasted) {
            inputBox.innerHTML = '';
            inputBox.dispatchEvent(new InputEvent('input', { bubbles: true }));
            document.execCommand('insertText', false, msg);
            inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, data: msg, inputType: 'insertText' }));
            await wait(500);
            pasted = inputBox.innerText.trim() === msg.trim();
            if (pasted) {
              console.log('[Message Sending] Message entered via execCommand insertText.');
            } else {
              console.log('[Message Sending] execCommand insertText failed, will try simulated keyboard events.');
            }
          }
          // 3. Simulate real keyboard events for each character if still not pasted
          if (!pasted) {
            inputBox.innerHTML = '';
            inputBox.dispatchEvent(new InputEvent('input', { bubbles: true }));
            for (let char of msg) {
              let eventOptions = { key: char, char, keyCode: char.charCodeAt(0), which: char.charCodeAt(0), bubbles: true };
              inputBox.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
              inputBox.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
              document.execCommand('insertText', false, char);
              inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' }));
              inputBox.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
              await wait(15);
            }
            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            await wait(500);
            pasted = inputBox.innerText.trim() === msg.trim();
            if (pasted) {
              console.log('[Message Sending] Message entered via simulated keyboard events.');
            } else {
              console.log('[Message Sending] Simulated typing failed.');
              // Fallback: prompt user to copy-paste
              alert('Could not automatically paste the referral message. Please copy and paste it manually. Message:\n\n' + msg);
              return;
            }
          }
          // After message is pasted or typed, immediately find and click the Send button in the correct chat overlay
          let sendBtn = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            sendBtn = Array.from(chatOverlay.querySelectorAll('button')).find(btn =>
              btn.className.includes('msg-form__send-button') && btn.innerText.trim() === "Send"
            );
            if (sendBtn && !sendBtn.disabled) break;
            await wait(200);
          }
          if (sendBtn && !sendBtn.disabled) {
            console.log('[Message Sending] Send button found and clicked.');
            sendBtn.click();
            chrome.runtime.sendMessage({ action: 'referral-sent', company: matchedCompany });
            sendResponse({ shouldProceed: true });
            return;
          } else {
            console.log('[Message Sending] Send button NOT found or disabled after retries.');
          }
        })();
      });
    })();
    return true; // async
  }
}); 