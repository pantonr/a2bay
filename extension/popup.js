// Add this at the start, after your initial console.log
function updateButtons(enabled) {
    const copyBtn = document.getElementById('copyButton');
    const writeBtn = document.getElementById('writeToSheet');
    
    if (enabled) {
        copyBtn.disabled = false;
        writeBtn.disabled = false;
        copyBtn.title = "Copy variant data to clipboard";
        writeBtn.title = "Write variant data to Google Sheet";
    } else {
        copyBtn.disabled = true;
        writeBtn.disabled = true;
        // Fun messages for disabled state
        const copyMessages = [
            "Nothing to copy yet! Scrape some variants first 📋",
            "This button is taking a coffee break ☕",
            "Clipboard's feeling lonely... Add some variants!",
            "Hey! You need to scrape something first 🔍"
        ];
        const writeMessages = [
            "Sheet's feeling empty! Let's get some variants in here first 📝",
            "Google Sheets is waiting patiently... 🗄️",
            "First scrape, then write! That's the order 📊",
            "Your spreadsheet misses you! Get some data first 📈"
        ];
        
        copyBtn.title = copyMessages[Math.floor(Math.random() * copyMessages.length)];
        writeBtn.title = writeMessages[Math.floor(Math.random() * writeMessages.length)];
    }
}

// Initialize buttons as disabled
document.addEventListener('DOMContentLoaded', () => {
    updateButtons(false);
});


document.getElementById("collectButton").addEventListener("click", async () => {
  //console.log("DEBUG: Scrape button clicked");
  const output = document.getElementById("output");
  
  let loadingMessages = [
    "Hunting down all those variants",
    "Wrangling size charts and color swatches",
    "Collecting ALL the options",
    "So... many... choices",
    "Making Jeff Bezos proud"
  ];

  let randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  let dotCount = 0;
  
  const loadingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    output.textContent = randomMessage + '.'.repeat(dotCount);
  }, 400);



  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0]) {
      clearInterval(loadingInterval);
      //console.error("DEBUG: No active tab found");
      output.textContent = "No active tab found.";
      return;
    }

    try {
      //console.log("DEBUG: Injecting content script");
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      });

      window.scrapedVariants = [];

      //console.log("DEBUG: Sending scrapeVariants message to content script");
      chrome.tabs.sendMessage(tabs[0].id, { action: "scrapeVariants" }, (response) => {
        clearInterval(loadingInterval);
        
        if (chrome.runtime.lastError) {
          //console.error("DEBUG: Runtime error:", chrome.runtime.lastError.message);
          output.textContent = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }

        //console.log("DEBUG: Full response from content script:", response);
        
        if (response?.data) {
          //console.log("DEBUG: First variant data:", response.data[0]);
          //console.log("DEBUG: First variant images:", response.data[0].imageUrls);

          window.scrapedVariants = response.data;

          const formattedData = response.data.map((variant, index) => {
              return `
                  <div class="variant-item">
                      <div class="variant-type">
                          <div class="label">Type:</div>
                          <div class="value">${variant.type}</div>
                      </div>
                      ${index === 0 ? '' : `
                          <div class="variant-option">
                              <div class="label">Option 1:</div>
                              <div class="value">${variant.option1 || ''}</div>
                          </div>
                          <div class="variant-option">
                              <div class="label">Option 2:</div>
                              <div class="value">${variant.option2 || ''}</div>
                          </div>
                          <div class="variant-option">
                              <div class="label">Option 3:</div>
                              <div class="value">${variant.option3 || ''}</div>
                          </div>
                      `}
                      <div class="variant-asin">
                          <div class="label">ASIN:</div>
                          <div class="value">${variant.asin}</div>
                      </div>
                      <div class="variant-condition">
                          <div class="label">Condition:</div>
                          <div class="value">${variant.condition || 'New'}</div>
                      </div>
                      ${variant.title ? `
                          <div class="variant-title">
                              <div class="label">Title:</div>
                              <div class="value">${variant.title}</div>
                          </div>
                      ` : ''}
                      ${variant.description ? `
                          <div class="variant-description">
                              <div class="label">Description:</div>
                              <div class="value">${variant.description}</div>
                          </div>
                      ` : ''}
                      ${Array.isArray(variant.bullets) && variant.bullets.length > 0 ? `
                          <div class="variant-bullets">
                              <div class="label">Bullets:</div>
                              <ul class="bullets-list">
                                  ${variant.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
                              </ul>
                          </div>
                      ` : ''}
 
${variant.imageUrls && variant.imageUrls.length > 0 ? `
    <div class="variant-image-urls">
        <div class="label">Image URLs:</div>
        <div class="url-grid">
            ${variant.imageUrls.map((url, i) => `
                <div class="url-row">
                    <div class="url-label">Image ${i + 1}:</div>
                    <div class="url-value">
                        <a href="${url}" target="_blank" title="Open image in new tab">${url}</a>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
` : ''}

 
${variant.videoUrls && variant.videoUrls.length > 0 ? `
    <div class="variant-video-urls">
        <div class="label">Video URLs:</div>
        <div class="url-grid">
            ${variant.videoUrls.map((video, i) => `
                <div class="url-row">
                    <div class="url-label">Video ${i + 1}:</div>
                    <div class="url-value">
                        <a href="${video.url}" target="_blank" title="Open video in new tab">${video.url}</a>
                        ${video.isVertical ? ' <span class="video-type">(Vertical)</span>' : ' <span class="video-type">(Horizontal)</span>'}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
` : ''}
                  </div>
                  <hr class="variant-separator">
              `;
          }).join('');

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = formattedData;
          output.innerHTML = tempDiv.innerHTML;
    updateButtons(true);


        } else if (response?.error) {
          //console.error("DEBUG: Error in response:", response.error);
          output.textContent = `Error: ${response.error}`;
              updateButtons(false);  // Add this

        } else {
          //console.error("DEBUG: No data in response");
          output.textContent = "No data received.";
              updateButtons(false);  // Add this

        }
      });
    } catch (err) {
      //onsole.error("DEBUG: Unexpected error:", err);
      output.textContent = "Failed to collect variants.";
    }
  });
});

// Add copy functionality
document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById("output");

  function formatForSpreadsheet(variants) {
    const headers = [
        "Type", 
        "Option 1",
        "Option 2", 
        "Option 3",
        "ASIN",
        "Condition",
        "Title", 
        "Description", 
        "Bullets",
        "Image URL 1",
        "Image URL 2",
        "Image URL 3",
        "Image URL 4",
        "Image URL 5",
        "Video URL 1",
        "Video URL 2"
    ];

    const spreadsheetLines = variants.map(variant => {
        const imageUrls = variant.imageUrls || [];
        const videoUrls = variant.videoUrls || [];
        
        const paddedImageUrls = [...imageUrls, "", "", "", "", ""].slice(0, 5);
        const paddedVideoUrls = [...(videoUrls.map(v => v.url || v) || []), "", ""].slice(0, 2);

        return [
            variant.type || "",
            variant.option1 || "",
            variant.option2 || "",
            variant.option3 || "",
            variant.asin || "",
            variant.condition || "New",
            (variant.title || "").replace(/\t/g, " ").replace(/\n/g, " "),
            (variant.description || "").replace(/\t/g, " ").replace(/\n/g, " "),
            (Array.isArray(variant.bullets) ? variant.bullets.join(" | ") : "").replace(/\t/g, " ").replace(/\n/g, " "),
            ...paddedImageUrls.map(url => url.replace(/\t/g, " ").replace(/\n/g, " ")),
            ...paddedVideoUrls.map(url => url.replace(/\t/g, " ").replace(/\n/g, " "))
        ].join("\t");
    });

    return [headers.join("\t"), ...spreadsheetLines].join("\n");
  }

  function copyToSpreadsheet() {
    const copyButton = document.getElementById("copyButton");

    if (!window.scrapedVariants || window.scrapedVariants.length === 0) {
      alert("No variants to copy");
      return;
    }

    const spreadsheetText = formatForSpreadsheet(window.scrapedVariants);

    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = spreadsheetText;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextArea);

    copyButton.textContent = 'Copied!';
    setTimeout(() => {
      copyButton.textContent = 'Copy for Spreadsheet';
    }, 2000);
  }

  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'copyButton') {
      copyToSpreadsheet();
    }
  });

  // Google Sheets handler
  document.getElementById('writeToSheet')?.addEventListener('click', async () => {
    try {
      const sheetsManager = new GoogleSheetsManager();
      const sheetUrl = await sheetsManager.writeVariantData(window.scrapedVariants);
      
      chrome.tabs.query({}, function(tabs) {
        const existingTab = tabs.find(tab => tab.url === sheetUrl);
        
        if (existingTab) {
          chrome.tabs.update(existingTab.id, {
            active: true
          });
          chrome.windows.update(existingTab.windowId, {
            focused: true
          });
        } else {
          window.open(sheetUrl, '_blank');
        }
      });
      
      output.innerHTML = `Successfully wrote data to sheet! <a href="${sheetUrl}" target="_blank">Open Sheet</a>`;
    } catch (error) {
      //console.error('Error writing to sheet:', error);
      alert('Failed to write to Google Sheet. Please check console for details.');
    }
  });
});




