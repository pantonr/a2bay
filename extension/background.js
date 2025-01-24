// Set default state as disabled
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
});

// Check each tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url) {
    const isAmazon = tab.url.includes('amazon.com');
    if (isAmazon) {
      chrome.action.enable(tabId);
      chrome.action.setIcon({
        path: {
          "16": "icons/a2bay_16.png",
          "48": "icons/a2bay_48.png",
          "128": "icons/a2bay_128.png"
        },
        tabId: tabId
      });
    } else {
      chrome.action.disable(tabId);
    }
  }
});

// Handle tab switching
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const isAmazon = tab.url.includes('amazon.com');
    if (isAmazon) {
      chrome.action.enable(activeInfo.tabId);
    } else {
      chrome.action.disable(activeInfo.tabId);
    }
  } catch (error) {
    console.error(error);
  }
});