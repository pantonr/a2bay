window.variantCache = window.variantCache || new Map();
window.variantCache.clear();  
window.CACHING_ENABLED = true; // Use window. to avoid redeclaration



// Add this function at the top level
//function getTestImageUrl() {
//    console.log("TEST URL FUNCTION CALLED");
//    return ["https://test-url.com/test-image.jpg"];
//}


const getCleanImageUrls = (images) => {
    return [...new Set(
        images
            .map(img => img.src.replace(/\._.*\./, '.'))
            .filter(url => 
                !url.includes('360_icon') && 
                !url.includes('imageBlock-360') && 
                !url.includes('PKdp-play-icon-overlay') &&
                !url.includes('transparent-pixel')
            )
    )];
};




function extractVideoUrls(doc) {
  const videos = [];
  
  const selectors = [
    '._dnNlL_vseVideoDataItem_2A7tm',
    '[data-video-url]',
    '[data-cel-widget*="video"]',
    '[class*="video-data"]',
    '#vse-player',
    '[data-video-json]',
    '.videoContainer'
  ];

  const processVideoUrl = (url) => {
    if (url && url.includes('.m3u8')) {
      videos.push({
        url: url,
        isVertical: url.includes('vertical')
      });
    }
  };

  selectors.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(element => {
      const possibleUrls = [
        element.dataset.url,
        element.getAttribute('data-url'),
        element.dataset.videoUrl,
        element.getAttribute('data-video-url')
      ];

      possibleUrls.forEach(url => {
        if (url) processVideoUrl(url);
      });

      const jsonData = element.dataset.videoJson || element.dataset.videoData;
      if (jsonData) {
        try {
          const parsed = JSON.parse(jsonData);
          if (parsed.url) processVideoUrl(parsed.url);
          if (parsed.videoUrl) processVideoUrl(parsed.videoUrl);
        } catch (e) {
          //console.log('Error parsing video JSON:', e);
        }
      }
    });
  });

  const scripts = doc.querySelectorAll('script');
  scripts.forEach(script => {
    const content = script.textContent;
    if (content.includes('video') || content.includes('.m3u8')) {
      const matches = content.match(/https:\/\/[^"']*\.m3u8[^"']*/g);
      if (matches) {
        matches.forEach(url => processVideoUrl(url));
      }
    }
  });

  //console.log(`Found ${videos.length} videos:`, videos);
  return [...new Set(videos.map(v => JSON.stringify(v)))].map(v => JSON.parse(v)).slice(0, 2);
}









async function fetchVariantDetails(asin) {
  //console.log("Starting fetchVariantDetails for ASIN:", asin);
  
  if (variantCache.has(asin)) {
    return variantCache.get(asin);
  }

  const variantUrl = `https://www.amazon.com/dp/${asin}`;
  try {
    const response = await fetch(variantUrl);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    const condition = doc.querySelector("#acBadge_feature_div .ac-badge-text")?.textContent.trim() 
      || doc.querySelector("#newAccordionRow .a-color-state")?.textContent.trim()
      || doc.querySelector("#usedAccordionRow .a-color-state")?.textContent.trim()
      || "New";

    // Use EXACTLY the same pattern as parent
const imageUrls = (() => {
    const images = Array.from(doc.querySelectorAll('#altImages li:not(.a-hidden) img'));
    //console.log("DEBUG: Found variant images for ASIN", asin, ":", images.length);
    return getCleanImageUrls(images);
})();

    const details = {
      title: doc.getElementById("productTitle")?.textContent.trim() || "",
      description: doc.getElementById("productDescription")?.textContent.trim() || "",
      condition: condition,
      bullets: Array.from(doc.querySelectorAll("#feature-bullets ul li span, .a-unordered-list.a-vertical.a-spacing-small li span"))
        .map((bullet) => bullet.textContent.trim()),
      videoUrls: extractVideoUrls(doc),
      imageUrls: imageUrls
    };

    if (CACHING_ENABLED) {
      variantCache.set(asin, details);
    }
    return details;
  } catch (error) {
    //console.error(`Error fetching details for ${asin}:`, error);
    return null;
  }
}



















async function getVariantDetailsWithParent() {
  const variants = [];
  //console.log("Starting variant scraping...");

  // Get variant containers
  const selectors = [
    '[id^="variation_"]',
    "#twister-plus-inline-twister-card .inline-twister-row"
  ];
  const variantContainers = Array.from(document.querySelectorAll(selectors.join(",")));
  
  // Collect all variant options
  let allVariantOptions = [];
  
  // Process variant containers to get options
  for (const container of variantContainers) {
    const labelElement = container.querySelector(".a-form-label, label, .dimension-heading span.a-size-base");
    const variantType = labelElement
      ? labelElement.textContent.trim().replace(":", "")
      : container.id.replace("variation_", "").replace("_name", "").replace("inline-twister-row-", "");

    const options = container.querySelectorAll("select option, .a-button-list li, .dimension-values-list li");
    
    const containerOptions = Array.from(options).map(option => {
      let text = "";
      let asin = "";

      if (option.tagName === "OPTION") {
        text = option.textContent.trim();
        asin = option.value?.split(",")[1];
      } else {
        text = option.getAttribute("title")
          || option.querySelector(".swatch-title-text-display")?.textContent.trim()
          || option.textContent.trim();
        asin = option.getAttribute("data-asin") || option.getAttribute("data-csa-c-item-id");
      }

      return { text, asin, type: variantType };
    }).filter(v => v.text && v.asin);

    if (containerOptions.length > 0) {
      allVariantOptions.push(containerOptions);
    }
  }

  // Get parent details
  const parentAsin = new URL(window.location.href).searchParams.get("asin")
    || document.querySelector("input#ASIN")?.value
    || window.location.pathname.split("/").find((segment) => segment.length === 10);

  const condition = document.querySelector("#acBadge_feature_div .ac-badge-text")?.textContent.trim() 
    || document.querySelector("#newAccordionRow .a-color-state")?.textContent.trim()
    || document.querySelector("#usedAccordionRow .a-color-state")?.textContent.trim()
    || "New";

  const productTitle = document.getElementById("productTitle")?.textContent.trim() || "";
  const productDescription = document.getElementById("productDescription")?.textContent.trim() || "";
  const bulletPoints = Array.from(document.querySelectorAll("#feature-bullets ul li span, .a-unordered-list.a-vertical.a-spacing-small li span"))
    .map((bullet) => bullet.textContent.trim());

//console.log("PARENT - About to set parent image URLs");








const parentImageUrls = (() => {
    const images = Array.from(document.querySelectorAll('#altImages li:not(.a-hidden) img'));
    //console.log("DEBUG: Found parent images:", images.length);
    return getCleanImageUrls(images);
})();





//console.log("PARENT - Parent image URLs set to:", parentImageUrls);


  const videoUrls = extractVideoUrls(document);

  // Add parent/standalone product
  //console.log("PARENT - Adding parent variant with images:", parentImageUrls);

  variants.push({
    type: allVariantOptions.length > 0 ? "Parent" : "Standalone Product",
    option1: "",
    option2: "",
    option3: "",
    asin: parentAsin || "",
    title: productTitle,
    condition: condition,
    description: productDescription,
    bullets: bulletPoints,
    imageUrls: parentImageUrls,
    videoUrls: videoUrls
  });

  // Generate combinations function
  const generateCombinations = (arrays, current = [], index = 0) => {
    if (index === arrays.length) {
      return [current];
    }

    let results = [];
    for (let item of arrays[index]) {
      results = results.concat(
        generateCombinations(arrays, [...current, item], index + 1)
      );
    }
    return results;
  };

  // Process variants if we have options
  if (allVariantOptions.length > 0) {
    const combinations = generateCombinations(allVariantOptions);
    
    // Process each combination
    for (const combo of combinations) {
      const details = await fetchVariantDetails(combo[combo.length - 1].asin);
      
      if (details) {  // Add null check here
        //console.log("VARIANT - Adding variant with images:", details.imageUrls);

        variants.push({
          type: combo[0].type,
          option1: combo[0]?.text || "",
          option2: combo[1]?.text || "",
          option3: combo[2]?.text || "",
          asin: combo[combo.length - 1].asin,
          condition: details.condition || "New",
          title: details.title || "",
          description: details.description || "",
          bullets: details.bullets || [],
          imageUrls: details.imageUrls || [],
          videoUrls: details.videoUrls || []
        });
      }
    }
  }

  //console.log("Scraping completed. Variants:", variants);
  return variants;
}

// Add this back near the end of the file:
// Replace the message listener at the bottom of content.js with this:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  //console.log("Message received in content.js:", message);

  if (message.action === "scrapeVariants") {
    //console.log("Scraping variants...");

    // Create an async function to handle the scraping
    const handleScraping = async () => {
      try {
        const variants = await getVariantDetailsWithParent();
        //console.log("Variants collected successfully:", variants);
        if (variants && variants.length > 0) {
          sendResponse({ data: variants });
        } else {
          sendResponse({ error: "No variants found" });
        }
      } catch (error) {
        //console.error("Error during scraping:", error);
        sendResponse({ error: error.message || "Scraping failed" });
      }
    };

    // Execute the async function
    handleScraping().catch(error => {
      //console.error("Unexpected error:", error);
      sendResponse({ error: "Unexpected error occurred" });
    });

    return true; // Keep the message channel open for async response
  }

  return false;
});







