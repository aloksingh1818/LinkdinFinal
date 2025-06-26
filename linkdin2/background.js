let profileUrls = [];
let currentIndex = 0;
let connectedPeople = [];
let stopRequested = false;
let stopReferralRequested = false;
let referralTabId = null;

function getRandomDelay() {
  // 6-10 seconds
  return 6000 + Math.floor(Math.random() * 4000);
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "start-connection") {
    connectedPeople = [];
    stopRequested = false;
    const { role, company, location, message, limit } = request.payload;
    const query = `site:linkedin.com/in \"${role}\" \"${company}\" \"${location}\"`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    chrome.tabs.create({ url: searchUrl, active: true }, (tab) => {
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['utils/scraper.js']
        }, () => {
          chrome.tabs.sendMessage(tab.id, { action: "scrape-links", limit }, (result) => {
            profileUrls = result || [];
            currentIndex = 0;
            openNextProfile(tab.id, message);
          });
        });
      }, 4000);
    });
  }
  if (request.action === "stop-connection") {
    stopRequested = true;
  }
  if (request.action === "connection-sent") {
    connectedPeople.push({ name: request.name, headline: request.headline, sent: request.sent });
    chrome.runtime.sendMessage({ action: "update-ui", people: connectedPeople });
  }
  if (request.action === "stop-referrals") {
    stopReferralRequested = true;
  }
  if (request.action === "send-referrals") {
    stopReferralRequested = false;
    // Clear sentReferralProfiles so we always start from the beginning
    chrome.storage.local.set({ sentReferralProfiles: [] }, () => {
      chrome.tabs.create({ url: 'https://www.linkedin.com/mynetwork/invite-connect/connections/', active: true }, (tab) => {
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['utils/scraper.js']
          }, () => {
            chrome.tabs.sendMessage(tab.id, { action: "scrape-connections" }, (result) => {
              const currentConnections = result || [];
              chrome.storage.local.get(['sentReferralProfiles'], res => {
                const sentProfiles = res.sentReferralProfiles || [];
                const newConnections = currentConnections.filter(c => !sentProfiles.includes(c.profileUrl));
                if (newConnections.length === 0) return;
                // Visit each new connection profile and send referral message
                sendReferralToNext(newConnections, 0, sentProfiles);
              });
            });
          });
        }, 4000);
      });
    });
  }
});

function openNextProfile(tabId, message) {
  if (stopRequested || currentIndex >= profileUrls.length) {
    chrome.tabs.remove(tabId); // Close tab when done or stopped
    return;
  }

  chrome.tabs.update(tabId, { url: profileUrls[currentIndex] }, () => {
    // Wait for the page to be fully loaded before injecting content script
    function waitForPageLoadAndInject() {
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (document.readyState !== 'complete') {
            window.addEventListener('load', () => {
              chrome.runtime.sendMessage({ action: 'page-loaded' });
            }, { once: true });
          } else {
            chrome.runtime.sendMessage({ action: 'page-loaded' });
          }
        }
      });
    }
    chrome.runtime.onMessage.addListener(function pageLoadListener(request) {
      if (request.action === 'page-loaded') {
        chrome.runtime.onMessage.removeListener(pageLoadListener);
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          }, () => {
            chrome.tabs.sendMessage(tabId, { action: "connect", message }, () => {
              currentIndex++;
              setTimeout(() => openNextProfile(tabId, message), getRandomDelay());
            });
          });
        }, 2000); // Extra delay after load for rendering
      }
    });
    waitForPageLoadAndInject();
  });
}

function openOrReuseTab(url, callback) {
  if (referralTabId !== null) {
    chrome.tabs.update(referralTabId, { url, active: true }, (tab) => {
      setTimeout(() => callback(tab), 4000);
    });
  } else {
    chrome.tabs.create({ url, active: true }, (tab) => {
      referralTabId = tab.id;
      setTimeout(() => callback(tab), 4000);
    });
  }
}

function sendReferralToNext(connections, idx, sentProfiles, skippedCompanies = []) {
  if (stopReferralRequested || idx >= connections.length) {
    chrome.storage.local.set({ sentReferralProfiles: sentProfiles });
    if (skippedCompanies.length > 0) {
      chrome.runtime.sendMessage({ action: 'referral-skipped', skippedCompanies });
    }
    if (referralTabId !== null) {
      chrome.tabs.remove(referralTabId);
      referralTabId = null;
    }
    return;
  }
  const profile = connections[idx];
  openOrReuseTab(profile.profileUrl, (tab) => {
    // Wait for the page to be fully loaded before injecting content script
    function waitForPageLoadAndInject() {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (document.readyState !== 'complete') {
            window.addEventListener('load', () => {
              chrome.runtime.sendMessage({ action: 'page-loaded' });
            }, { once: true });
          } else {
            chrome.runtime.sendMessage({ action: 'page-loaded' });
          }
        }
      });
    }
    chrome.runtime.onMessage.addListener(function pageLoadListener(request) {
      if (request.action === 'page-loaded') {
        chrome.runtime.onMessage.removeListener(pageLoadListener);
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }, () => {
            chrome.tabs.sendMessage(tab.id, { action: "send-referral-message", profile }, (resp) => {
              sentProfiles.push(profile.profileUrl);
              if (resp && resp.skipped) {
                skippedCompanies.push(resp.skipped);
              }
              if (resp && resp.shouldProceed) {
                setTimeout(() => {
                  sendReferralToNext(connections, idx + 1, sentProfiles, skippedCompanies);
                }, getRandomDelay());
              }
              // If shouldProceed is not true, do not proceed (wait for user action)
            });
          });
        }, 2000); // Extra delay after load for rendering
      }
    });
    waitForPageLoadAndInject();
  });
} 