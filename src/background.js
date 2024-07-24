// background.js

import { fetchOpenAI } from './api.js';
// Plugin registry to keep track of registered plugins and their tags
const pluginRegistry = {};
chrome.storage.sync.get(['pluginRegistry'], function (items) {
  if (items.pluginRegistry) {
    Object.assign(pluginRegistry, items.pluginRegistry);
  }
});


// Handle messages from plugins
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log("Received external message:", message);
  if (message.action === "registerTags") {
    const { pluginId, namespace, tagDefinitions } = message;

    if (!namespace || typeof namespace !== 'string' || namespace.trim() === '') {
      sendResponse({ status: "error", message: "Namespace is required and must be a non-empty string." });
      return;
    }

    chrome.storage.sync.get(['pluginTags'], function (items) {
      let pluginTags = items.pluginTags || {};
      let existingTags = Object.keys(pluginTags).filter(tag => pluginTags[tag].pluginId === pluginId && tag.startsWith(namespace + ":"));
      
      let newTagNames = tagDefinitions.map(tagDef => `${namespace}:${tagDef.name}`);

      // Identify tags to be removed
      let tagsToRemove = existingTags.filter(tag => !newTagNames.includes(tag));

      // Remove old tags
      tagsToRemove.forEach(tag => {
        delete pluginTags[tag];
        delete pluginRegistry[tag];
      });

      // Add/Update new tags
      tagDefinitions.forEach(tagDef => {
        const namespacedTagName = `${namespace}:${tagDef.name}`;
        pluginRegistry[namespacedTagName] = { pluginId, description: tagDef.description, namespace };
        pluginTags[namespacedTagName] = { description: tagDef.description, pluginId: pluginId };
      });

      chrome.storage.sync.set({ pluginTags: pluginTags, pluginRegistry: pluginRegistry }, function () {
        sendResponse({ status: "success" });

        console.log('Attempting to send reloadTags message');
        chrome.runtime.sendMessage({ action: 'reloadTags' }, (response) => {
          if (chrome.runtime.lastError) {
            // Log the error for debugging purposes or ignore it
            console.log('UI panel not open, ignoring error:', chrome.runtime.lastError.message);
          } else {
            console.log('Response from reloadTags message:', response);
          }
        });
      });
    });
  }
  return true; // Indicate that the response is asynchronous
});

function getPluginTags() {
  return pluginRegistry;
}

// Function to request tag processing from a plugin
function requestTagProcessing(tagName, namespace, context) {
  return new Promise((resolve, reject) => {
    const tagKey = namespace ? `${namespace}:${tagName}` : tagName;
    const tagInfo = pluginRegistry[tagKey];

    if (!tagInfo) {
      return reject(new Error(`Tag "${tagKey}" is not registered.`));
    }

    const { pluginId } = tagInfo;

    chrome.runtime.sendMessage(pluginId, { 
      action: "processTag", 
      tagName: tagName,
      namespace: namespace,
      context: context 
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.error) {
        reject(response.error); // Pass the error object directly
      } else if (response && response.data) {
        resolve(response.data);
      } else {
        reject(new Error("Invalid response from plugin"));
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPluginTags') {
    sendResponse({ tags: getPluginTags() });
  } else if (request.action === 'processTag') {
    requestTagProcessing(request.tagName, request.namespace, request.context)
      .then(data => sendResponse({ result: data }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Indicate that the response is asynchronous
  }
});

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
      apiKeySet: false,
      displayInPopup: false, // Default value for showing yellow div
      apiKey: '', // Default apiKey value
      model: currentModel, // Default model
      tasks: {
        "5 Key Highlights": {
          description: "Compress the content to top 5 key highlights",
          task: "Compress the following content to top 5 key highlights: {page-full-content}"
        },
        "Ad-Free Reading Experience": {
          description: "Remove all ads and distractions from the page content",
          task: "Please strip all advertisements, sidebars, pop-up messages, and any promotional content from the following webpage text. Provide a clean, uninterrupted version of the main content for a distraction-free reading experience. Break text into paragraphs for easier reading. {page-full-content}"
        },
        "Amazon: Summarize Reviews": {
          description: "Summarize Amazon product reviews",
          task: "The following text contains customer reviews for a product on Amazon. Your task is to analyze the reviews and create a summary in the form of pros and cons bullet points. Identify the most frequently mentioned positive and negative aspects of the product. Aim to create 3-5 bullet points each for pros and cons. If there is not enough information to generate 3 bullet points for either pros or cons, provide as many as you can based on the available reviews.\n\nFormat your response like this:\nPros:\n- [Pro 1]\n- [Pro 2]\n- [Pro 3]\n- [Pro 4]\n- [Pro 5]\n\nCons:\n- [Con 1]\n- [Con 2]\n- [Con 3]\n- [Con 4]\n- [Con 5]\n\nProduct reviews:\n{amazon-reviews}"
        },
        "Convert Prices to USD": {
          description: "Convert all prices to USD",
          task: "In the data below, convert all presented prices to US dollars {page-full-content}"
        },
        "Executive Summary": {
          description: "Condense the content into an executive summary",
          task: "Condense the content below into an executive summary. Focus on key points, conclusions, and actionable insights. {page-full-content}"
        },
        "Explain as though I am 5": {
          description: "Simplify the content for easier understanding.",
          task: "Below is a scrape of a web page content. Extract from it the useful information by eliminating anything that is not relevant like adverts or any other distractions. {page-full-content}. Then re-tell that content in very simple and easy to understand language, as if I am 5 years old.\n\nContent:\n\n{page-full-content}"
        },
        "Extract Product Specs": {
          description: "Extract product specification from the page.",
          task: "You are an AI designed to extract structured data from unstructured web pages. Your task is to extract product specifications from the given HTML content of an Amazon or eBay product page. Focus on capturing key details such as the product title, price, brand, model number, dimensions, weight, color, material, special features, and customer reviews. Ensure the extracted data is formatted clearly and concisely.\n\nInstructions:\n\n1. Identify and extract the product title.\n2. Identify and extract the product price.\n3. Identify and extract the brand name.\n4. Identify and extract the model number.\n5. Identify and extract the product dimensions.\n6. Identify and extract the product weight.\n7. Identify and extract the color options.\n8. Identify and extract the material details.\n9. Identify and extract any special features or specifications.\n10. Identify and extract customer review snippets and ratings.\n\nProduct Information:{page-full-content}"
        },
        "Legal Document Simplification": {
          description: "Simplify legal jargon into plain language",
          task: "Simplify the legal jargon found in the text below into plain language, highlighting main obligations, rights, and conditions. {page-full-content}"
        },
        "Opinion vs. Fact Distinction": {
          description: "Separate opinions from facts in the content",
          task: "Separate the opinions from facts in the content below. Provide summaries for both factual statements and subjective opinions. {page-full-content}"
        },
        "Tech Article to Layman's Terms": {
          description: "Convert technical details in tech articles to layman's terms",
          task: "Convert the technical details in the provided tech article into layman's terms. Explain complex technologies, processes, or concepts in simple language. {page-full-content}"
        },
        "Traducir al español": {
          description: "Traduce el contenido al español.",
          task: "Translate to Spanish the following:{page-full-content}"
        },
        "Translate to English": {
          description: "Translate content to English",
          task: "Translate to English the following:{page-full-content}"
        },
        "Translate to Simple English": {
          description: "Translate the page content to Simple English",
          task: "Translate the content below into Simple English, suitable for non-native speakers or young readers. {page-full-content}"
        },
        "Tutorial Steps Extraction": {
          description: "Extract tutorial steps from the content",
          task: "Extract step-by-step instructions or tutorial guidance from the content provided. List these steps in a clear and concise format. {page-full-content}"
        }
      },
      pageUrls: {
        "Amazon: Summarize Reviews": "*amazon*",
        "Convert Prices to USD": "*amazon*"
      },
      dataTags: {
        "amazon-reviews": {
          description: "Focal Product reviews at Amazon",
          selector: "#reviewsMedley"
        }
      }

    }, function () {
      console.log("The extension is installed. Default settings applied.");

    });
  }
});


chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    console.log('Extension installed.');

    // Open the quick start guide in a new tab when the extension is installed
    chrome.tabs.create({ url: 'https://maxtaf-open-source.github.io/PageIntel/docs/userguide.html' }, function (tab) {
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
  } else if (request.action === 'callOpenAI') {
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
      sendResponse({
        result: data.result,
        usage: data.usage
      });
    })
    .catch(error => {
      console.log('Validation failed:', error);
      sendResponse({ error: { message: error.message } });
    });
}


