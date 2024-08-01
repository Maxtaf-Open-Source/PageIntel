// content.js
import { isGeneralTag, handleGeneralTag } from './generalTags.js';

// Load marked library
const script = document.createElement('script');
script.src = chrome.runtime.getURL('dist/marked.min.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Global flag to control form submission
let allowFormSubmission = false;

function sendDataToBackground({ data, validationTask }) {
  const pageData = extractPageData();

  chrome.runtime.sendMessage({
    action: "validateData",
    data: pageData,
    validationTask: validationTask
  }, function (response) {
    if (response) {
      displayValidationResult(response.result);
    }
  });
}

function extractPageData() {
  const pageTitle = document.title || '';
  const pageUrl = window.location.href || '';
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(heading => heading.textContent.trim());
  const paragraphs = Array.from(document.querySelectorAll('p')).map(paragraph => paragraph.textContent.trim());
  const inputFields = extractInputs();

  return {
    pageTitle,
    pageUrl,
    headings,
    paragraphs,
    inputFields
  };
}





//Function to extract data from the page and organise it an array
// Function to extract data from the page and organize it as a comma-separated list of name-value pairs
// Function to extract data from the page and organize it as a JSON string
function extractInputs() {
  const inputs = document.querySelectorAll('input, a[role="checkbox"]');
  const inputData = Array.from(inputs).map(input => {
    let label = document.querySelector(`label[for="${input.id}"]`);
    let labelText = label ? label.textContent.trim() : 'No label';

    // Handling for standard input fields
    if (input.tagName.toLowerCase() === 'input') {
      return {
        name: input.name || input.id || 'unnamed',
        value: input.value,
        type: input.type,
        label: labelText
      };
    }

    // Handling for custom checkbox fields
    if (input.getAttribute('role') === 'checkbox') {
      return {
        name: input.id || 'unnamed',
        value: input.getAttribute('aria-checked') === 'true' ? 'checked' : 'unchecked',
        type: 'checkbox',
        label: labelText
      };
    }
  });

  // Convert the input data array to a JSON string
  return JSON.stringify(inputData);
}

// Before displaying the validation result, check the setting
function displayValidationResult(result) {
  chrome.storage.sync.get(['displayInPopup'], function (items) {
    if (items.displayInPopup) {
      let resultDisplay = document.getElementById('pageintel-validationResult') || createResultDisplay();

      let shadowRoot = resultDisplay.shadowRoot || resultDisplay.attachShadow({ mode: 'open' });

      shadowRoot.innerHTML = '';

      let popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <style>
          @import url('chrome-extension://${chrome.runtime.id}/style.css');
          @import url('chrome-extension://${chrome.runtime.id}/github-markdown.min.css');
          .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
          }
        </style>
        <div style="position: relative !important;">
          <div id="pageintel-header-message-popup" style="display: flex !important; align-items: center !important;">
            <strong style="color: inherit !important; margin-right: 20px !important;">AI Response:</strong>
            <div style="margin-left: auto !important; display: flex !important; align-items: center !important;">
              <span id="pageintel-copy-result-popup" title="copy content" style="cursor: pointer !important; font-size: 30px !important; margin-right: 10px !important;">&#xe14d;</span>
              <span id="pageintel-close-result-popup" style="cursor: pointer !important; font-size: 30px !important;">&times;</span>
            </div>
          </div>
          <div id="markdown-content" class="markdown-body" style="margin-top: 20px !important;"></div>
          <div id="pageintel-copy-message-popup" style="position: absolute !important; top: 30px !important; right: 0 !important; background-color: #A9A9A9 !important; color: white !important; padding: 5px 10px !important; border-radius: 4px !important; opacity: 0 !important; transition: opacity 0.3s !important;">Copied to clipboard!</div>
        </div>
      `;

      shadowRoot.appendChild(popupContent);

      // Parse markdown and insert content
      const markdownContent = shadowRoot.getElementById('markdown-content');
      if (typeof marked !== 'undefined') {
        markdownContent.innerHTML = marked.parse(result);
      } else {
        markdownContent.innerHTML = result.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      }

      shadowRoot.getElementById('pageintel-copy-result-popup').addEventListener('click', function () {
        copyToClipboard(result);
        showCopyMessagePopup(shadowRoot);
      });

      shadowRoot.getElementById('pageintel-close-result-popup').addEventListener('click', function () {
        resultDisplay.parentNode.removeChild(resultDisplay);
      });

      document.body.appendChild(resultDisplay);
    }
  });
}

function showCopyMessagePopup(shadowRoot) {
  var copyMessage = shadowRoot.getElementById('pageintel-copy-message-popup');
  copyMessage.style.opacity = '1';
  setTimeout(function () {
    copyMessage.style.opacity = '0';
  }, 2000);
}

function copyToClipboard(text) {
  var tempInput = document.createElement('textarea');
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
}

// Function to create a div element for displaying validation results
function createResultDisplay() {
  let resultDisplay = document.createElement('div');
  resultDisplay.id = 'pageintel-validationResult';
  resultDisplay.style.setProperty('all', 'initial', 'important');
  resultDisplay.style.setProperty('position', 'fixed', 'important');
  resultDisplay.style.setProperty('top', '50%', 'important');
  resultDisplay.style.setProperty('left', '50%', 'important');
  resultDisplay.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
  resultDisplay.style.setProperty('background', '#ffffff', 'important');
  resultDisplay.style.setProperty('box-shadow', '0 2px 10px rgba(0, 0, 0, 0.1)', 'important');
  resultDisplay.style.setProperty('border', '2px solid #ddd', 'important');
  resultDisplay.style.setProperty('padding', '24px', 'important');
  resultDisplay.style.setProperty('z-index', '9999', 'important');
  resultDisplay.style.setProperty('max-width', '80%', 'important');
  resultDisplay.style.setProperty('max-height', '80%', 'important');
  resultDisplay.style.setProperty('overflow', 'auto', 'important');
  document.body.appendChild(resultDisplay);
  return resultDisplay;
}


function addControlButtons(resultDisplay) {
  let closeButton = document.createElement('span');
  closeButton.innerHTML = '&times;';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '10px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontSize = '20px';
  closeButton.style.zIndex = '10000';
  closeButton.onclick = function () {
    resultDisplay.parentNode.removeChild(resultDisplay);
  };
  resultDisplay.appendChild(closeButton);
}

// Function to remove the result display and proceed with form submission
function removeResultDisplayAndProceed(element) {
  document.body.removeChild(element);
  allowFormSubmission = true;
}

// Function to remove the result display
function removeResultDisplay(element) {
  document.body.removeChild(element);
}
// Function to create and toggle spinner
function toggleSpinner(show) {
  let spinner = document.getElementById('pageintel-ai-validation-spinner');

  if (!spinner) {
    // Create spinner if it doesn't exist
    spinner = document.createElement('div');
    spinner.id = 'pageintel-ai-validation-spinner';
    spinner.style.position = 'fixed';
    spinner.style.top = '0';
    spinner.style.left = '0';
    spinner.style.width = '100%';
    spinner.style.height = '100%';
    spinner.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    spinner.style.display = 'none';
    spinner.style.zIndex = '10000';
    spinner.style.justifyContent = 'center';
    spinner.style.alignItems = 'center';
    spinner.style.display = 'flex';
    spinner.innerHTML = '<div style="text-align: center;"><div class="pageintel-spinner"></div><p style="color: white; font-size: 20px; margin-top: 20px;">AI task in progress...</p></div>';
    document.body.appendChild(spinner);
  }

  spinner.style.display = show ? 'flex' : 'none';
}

function extractDataFromSelector(selectorConfig, params) {
  console.log("Extracting data with selector config:", JSON.stringify(selectorConfig));
  let extractedData = [];

  // If selectorConfig is a string, try to parse it as JSON
  if (typeof selectorConfig === 'string') {
    try {
      selectorConfig = JSON.parse(selectorConfig);
      console.log("Parsed selector config:", JSON.stringify(selectorConfig));
    } catch (e) {
      console.error("Failed to parse selector config as JSON:", e);
      // If parsing fails, treat it as a simple CSS selector
      const elements = document.querySelectorAll(selectorConfig);
      extractedData = Array.from(elements).map(el => el.tagName.toLowerCase() === 'input' ? el.value : el.textContent.trim());
      return extractedData.join(", ");
    }
  }

  // Now handle the JSON selector configuration
  if (selectorConfig.selectors) {
    selectorConfig.selectors.forEach(selector => {
      let context = document;

      if (selector.iframe_path) {
        console.log("Processing iframe path:", selector.iframe_path);
        for (let sel of selector.iframe_path) {
          const iframe = context.querySelector(sel);
          if (!iframe) {
            console.error("Iframe not found:", sel);
            return;
          }
          context = iframe.contentWindow.document;
        }
      }

      if (selector.shadow_dom_path) {
        console.log("Processing shadow DOM path:", selector.shadow_dom_path);
        for (let sel of selector.shadow_dom_path) {
          const shadowHost = context.querySelector(sel);
          if (!shadowHost || !shadowHost.shadowRoot) {
            console.error("Shadow DOM not found:", sel);
            return;
          }
          context = shadowHost.shadowRoot;
        }
      }

      console.log("Querying with selector:", selector.element_selector);
      const elements = context.querySelectorAll(selector.element_selector);
      console.log("Found elements:", elements.length);

      const selectorData = Array.from(elements).map(el => {
        return el.tagName.toLowerCase() === 'input' ? el.value : el.textContent.trim();
      });

      extractedData = extractedData.concat(selectorData);
    });
  }

  console.log("Extracted data:", extractedData);
  return extractedData.join(", ");
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "requestData") {
    console.log("Received requestData action for tag:", request.tag);
    let responseData = "";

    try {
      if (isGeneralTag(request.tag)) {
        console.log("Processing general tag:", request.tag);
        responseData = handleGeneralTag(request.tag, request.params);
      } else {
        console.log("Processing custom tag:", request.tag);
        console.log("Selector:", JSON.stringify(request.selector));

        // The selector is already a string, so we don't need to stringify it again
        responseData = extractDataFromSelector(request.selector, request.params);

        if (responseData === '') {
          console.warn("No data found for selector:", request.selector);
          responseData = "No data found";
        }
      }

      console.log("Sending response data:", responseData);
      sendResponse({ data: responseData });
    } catch (error) {
      console.error("Error processing tag:", error);
      sendResponse({ error: error.message });
    }

    return true;  // Indicates an asynchronous response
  }
});


// Listener for messages from panel.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "toggleSpinner") {
    toggleSpinner(request.show);
  }
});

//Listener for collecting page data
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "collectPageData") {
    let data = extractPageData(); // Ensure this function collects the necessary page data
    sendResponse({ data: data });
  } else if (request.action === "displayResults") {
    displayValidationResult(request.result);
  }
});


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "requestData") {
    let responseData = "";

    if (isGeneralTag(request.tag)) {
      responseData = handleGeneralTag(request.tag, request.params);
    } else {
      // Debug: log the type and value of the received selector
      console.log("Received selector type:", typeof request.selector);
      console.log("Received selector value:", request.selector);

      if (typeof request.selector === 'object' && request.selector.selector) {
        // If the selector is an object and has a 'selector' property, parse it as JSON
        try {
          let selector = JSON.parse(request.selector.selector);
          console.log("Parsed JSON successfully:", selector);
          responseData = extractDataFromSelector(selector, request.params);
        } catch (e) {
          // Log parsing error and use the raw string as a fallback
          console.log("JSON parsing error:", e.message);
          console.log("Using raw selector as fallback.");
          responseData = extractDataFromSelector(request.selector.selector);
        }
      } else {
        responseData = extractDataFromSelector(request.selector, request.params);
      }

      if (responseData === '') {
        responseData = "No data found";
      }
    }

    sendResponse({ data: responseData });
    return true;  // Indicates an asynchronous response
  }
});