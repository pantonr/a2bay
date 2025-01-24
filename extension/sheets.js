class GoogleSheetsManager {
  constructor() {
    this.headers = [
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
  }

  async authorize() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        console.log('Auth token received:', token ? 'Yes' : 'No');
        if (chrome.runtime.lastError || !token) {
          console.error('Auth error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError || new Error('No token'));
          return;
        }
        resolve(token);
      });
    });
  }

async getOrCreateSheet() {
    try {
      // Check if we have a stored sheet ID
      const result = await chrome.storage.local.get('sheetId');
      if (result.sheetId) {
        console.log('Using existing sheet:', result.sheetId);
        return result.sheetId;
      }

      // If no existing sheet, create new one
      const token = await this.authorize();
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: 'Amazon Variant Data'
          }
        })
      });

      const spreadsheet = await response.json();
      const spreadsheetId = spreadsheet.spreadsheetId;

      // Store the sheet ID for future use
      await chrome.storage.local.set({ sheetId: spreadsheetId });
      console.log('Created and stored new sheet:', spreadsheetId);

      return spreadsheetId;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }

  async getNextEmptyRow(spreadsheetId, token) {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:A`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const data = await response.json();
    return (data.values?.length || 0) + 1;
  }

// In sheets.js, modify the writeVariantData method:

async writeVariantData(variants) {
    try {
        console.log('Starting writeVariantData with variants:', variants);
        const spreadsheetId = await this.getOrCreateSheet();
        console.log('Got spreadsheetId:', spreadsheetId);
        
        const token = await this.authorize();
        console.log('Got token');
        
        // First, check if the sheet is empty
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:A`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        const data = await response.json();
        const isSheetEmpty = !data.values || data.values.length === 0;
        
        // Get the next empty row
        const nextRow = await this.getNextEmptyRow(spreadsheetId, token);
        console.log('Next empty row:', nextRow);
        
        // Format the variant data for spreadsheet
        const formattedData = variants.map(variant => {
            const imageUrls = variant.imageUrls || [];
            const videoUrls = variant.videoUrls || [];
            const paddedImageUrls = [...imageUrls, "", "", "", "", ""].slice(0, 5);
            const paddedVideoUrls = [...videoUrls.map(v => v.url || v || ""), "", ""].slice(0, 2);

            return [
                variant.type || "",
                variant.option1 || "",
                variant.option2 || "",
                variant.option3 || "",
                variant.asin || "",
                variant.condition || "New",
                variant.title || "",
                variant.description || "",
                Array.isArray(variant.bullets) ? variant.bullets.join(" | ") : "",
                ...paddedImageUrls,
                ...paddedVideoUrls
            ];
        });

        // If sheet is empty, add headers first
        if (isSheetEmpty) {
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:P1?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: [this.headers]
                    })
                }
            );
            // If we added headers, adjust the next row
            formattedData.unshift(this.headers);
        }

        // Write data to the next empty row
        const writeResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A${isSheetEmpty ? 1 : nextRow}?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: formattedData
                })
            }
        );

        if (!writeResponse.ok) {
            const errorText = await writeResponse.text();
            console.error('API Error:', errorText);
            throw new Error(`API Error: ${writeResponse.status} - ${errorText}`);
        }

        console.log('Write successful');
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    } catch (error) {
        console.error('Error in writeVariantData:', error);
        throw error;
    }
}
}