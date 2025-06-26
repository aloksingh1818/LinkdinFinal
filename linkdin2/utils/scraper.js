chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape-links") {
    const anchors = Array.from(document.querySelectorAll('a'));
    const links = anchors
      .map(a => a.href)
      .filter(h => h.includes('linkedin.com/in/'))
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .slice(0, request.limit);
    sendResponse(links);
  }
  if (request.action === "scrape-connections") {
    // Scrape connections from the connections page
    const connections = Array.from(document.querySelectorAll('a[href*="/in/"]')).map(a => ({
      name: a.innerText.trim(),
      profileUrl: a.href
    })).filter(c => c.profileUrl.includes('linkedin.com/in/'));
    // Remove duplicates by profileUrl
    const unique = [];
    const seen = new Set();
    for (const c of connections) {
      if (!seen.has(c.profileUrl)) {
        unique.push(c);
        seen.add(c.profileUrl);
      }
    }
    sendResponse(unique);
  }
  return true; // async
}); 