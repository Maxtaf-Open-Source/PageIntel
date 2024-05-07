// background.js

import { fetchOpenAI } from './api.js';



let currentModel = 'gpt-3.5-turbo';
function createNameValueList(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return ''; // Return an empty string if data is not valid
  }

  return data.map(input => {
    let name = input.label && input.label !== 'No label' ? input.label : input.name;
    return `${name}: ${input.value}`;
  }).join(', ');
}

// Set up default settings and handle onInstalled and onStartup events
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    // Set default settings including the firstTime flag and displayInPopup
    chrome.storage.sync.set({
      firstTime: true, // Assuming you use this to trigger showing settings dialog
      displayInPopup: false, // Default value for showing yellow div
      apiKey: '', // Default apiKey value
      model: currentModel, // Default model
      tasks: {
        "5 Takeaways": {
          description: "Compress the content to top 5 takeaways ",
          task: "Compress the following content to top 5 takeaways: {page-full-content} "
        },
        "Amazon: Summarize Reviews": {
          description: "Convert all prices to USD ",
          task: "The following text contains customer reviews for a product on Amazon. Your task is to analyze the reviews and create a summary in the form of pros and cons bullet points. Identify the most frequently mentioned positive and negative aspects of the product. Aim to create 3-5 bullet points each for pros and cons. If there is not enough information to generate 3 bullet points for either pros or cons, provide as many as you can based on the available reviews.\n\nFormat your response like this:\nPros:\n- [Pro 1]\n- [Pro 2]\n- [Pro 3]\n- [Pro 4]\n- [Pro 5]\n\nCons:\n- [Con 1]\n- [Con 2] \n- [Con 3]\n- [Con 4]\n- [Con 5]\n\nProduct reviews:\n{amazon-reviews}"
        },
        "Convert Prices to USD": {
          description: "Convert all prices to USD ",
          task: "in the data bellow, convert all presented prices to US dollars {page-full-content}"
        },
        "Show Page Title": {
          description: "Show the title of the web page",
          task: "respond with the following text:{page-title}"
        },
        "Summarise Page": {
          description: "Provides a summary of the full content of the page",
          task: "Summarise the following:{page-full-content}"
        },
        "Translate to English": {
          description: "Translate content to English",
          task: "translate to english the following:{page-full-content}"
        },
        "Wiki: Key Points": {
          description: "Summarize the article as a list of key points",
          task: "Please generate a list of key points from the following Wikipedia article: {page-full-content}"
        }
      },
      pageUrls: {
        "Blog Post Topic Extraction": "*medium.com/*,*cnn*",
        "Convert Prices to USD": "*amazon*",
        "Amazon: Summarize Reviews":"*amazon*",
        "Product Review Summarization": "*amazon*",
        "Product Specification Extraction": "*amazon*",
        "Show Page Title": "",
        "Summarise Page": "",
        "Translate to English": "",
        "Wiki: Key Points":"*wiki*"
      },
      dataTags: {
        "amazon-reviews": {
          description: "Focal Product reviews at Amazon",
          selector: "#reviewsMedley"
        }
      }      
      
    }, function () {
      console.log("The extension is installed. Default settings applied.");

      // Inject the content script into all existing tabs
      // Inject the content script into all existing tabs
      // chrome.tabs.query({}, function (tabs) {
      //   tabs.forEach(function (tab) {
      //     // Skip Chrome-specific URLs
      //     if (tab.url.startsWith('chrome://')) {
      //       return;
      //     }

      //     chrome.scripting.executeScript({
      //       target: { tabId: tab.id },
      //       files: [chrome.runtime.getURL('dist/content.bundle.js')]
      //     });
      //   });
      // });
    });
  }
});


chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    console.log('Extension installed.');

    // Open the quick start guide in a new tab when the extension is installed
    chrome.tabs.create({ url: chrome.runtime.getURL('dist/quickstart.html') }, function (tab) {
      console.log('Quick start guide opened in tab:', tab.id);
    });
  }

});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.log(error));



// // Listen for messages from content scripts or the extension's front-end
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Update settings based on message received
  if (request.action === 'updateSettings') {
    currentModel = request.data.model;
  } else if (request.action === "validateData") {
    // Retrieve the API key securely stored in chrome.storage
    chrome.storage.sync.get(['apiKey'], function (result) {
      if (result.apiKey) {
        let apiKey = result.apiKey;
        let tasks = request.validationTask;

        // Replace placeholders with actual data, checking for their existence
        tasks = tasks.replace('{page-title}', request.data.pageTitle || '');
        tasks = tasks.replace('{page-url}', request.data.pageUrl || '');
        tasks = tasks.replace('{headings}', request.data.headings ? request.data.headings.join(', ') : '');
        tasks = tasks.replace('{paragraphs}', request.data.paragraphs ? request.data.paragraphs.join('\n') : '');
        tasks = tasks.replace('{input-fields}', request.data.inputFields ? createNameValueList(request.data.inputFields) : '');
        tasks = tasks.replace('{maximo-input-data}', request.data.inputFields ? createNameValueList(request.data.inputFields) : '');

        // Call the updated fetchOpenAI function with the necessary API key
        fetchOpenAI(request.data.model, request.data.messages, apiKey)
          .then(data => {
            if (data.error) {
              // Handle the error, log it, and send it to the front-end to display
              console.log('API Error:', data.error.message);
              sendResponse({ error: data.error });
            } else if (data.choices && data.choices.length > 0) {
              sendResponse({ result: data.choices[0].message.content });
            } else {
              sendResponse({ error: { message: 'No valid response from the API' } });
            }
          })
          .catch(error => {
            console.log('Fetch Error:', error);
            sendResponse({ error: { message: error.message } });
          });
      } else {
        sendResponse({ result: 'Error: API key not found. Please configure it in the extension settings.' });
      }
    });

    // Keep the message channel open for asynchronous response
    return true;
  } else  if (request.action === 'callOpenAI') {
    // Check if apiKey is provided in the request, if not, retrieve it from storage
    if (request.data.apiKey) {
      performOpenAICall(request.data.apiKey, request.data.model, request.data.messages, sendResponse);
    } else {
      chrome.storage.sync.get(['apiKey', 'model', 'apiUrl'], function (items) {
        if (items.apiKey) {
          performOpenAICall(items.apiKey, request.data.model, request.data.messages, sendResponse, items.apiUrl);
        } else {
          sendResponse({ error: { message: 'API Key not found in storage.' } });
        }
      });
    }
    return true; // Keep the message channel open for the asynchronous response
  }
});

function performOpenAICall(apiKey, model, messages, sendResponse, apiUrl = 'https://api.openai.com/v1/chat/completions') {
  fetchOpenAI(model, messages, apiKey, apiUrl)
    .then(data => {
      if (data.choices && data.choices.length > 0) {
        sendResponse({ result: data.choices[0].message.content });
      } else {
        sendResponse({ error: { message: 'No valid response from the API' } });
      }
    })
    .catch(error => {
      console.log('Validation failed:', error);
      sendResponse({ error: { message: error.message } });
    });
}


