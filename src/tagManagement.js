// tagManagement.js
import { generalTags, isGeneralTag, getGeneralTagDescription, handleGeneralTag } from './generalTags.js';


// Load all tags into the dropdown
function loadAllTags() {
  chrome.storage.sync.get(['dataTags'], function (items) {
    var dataTags = items.dataTags || {};
    var existingTagsSelect = document.getElementById('existing-tags');

    existingTagsSelect.innerHTML = '<option value="">Select a Tag...</option>'; // Clear and add placeholder

    Object.keys(dataTags).forEach(function (tagName) {
      var option = document.createElement('option');
      option.value = tagName;
      option.textContent = tagName;
      existingTagsSelect.appendChild(option);
    });

    // Add general tags to the dropdown with a special prefix
    Object.keys(generalTags).forEach(function (tagName) {
      var option = document.createElement('option');
      option.value = tagName;
      option.textContent = '[System] ' + tagName;
      option.style.color = 'blue'; // Visually distinguish general tags
      existingTagsSelect.appendChild(option);
    });

    // Fetch and add plugin tags
    chrome.runtime.sendMessage({ action: 'getPluginTags' }, function (response) {
      const pluginTags = response.tags || {};
      Object.keys(pluginTags).forEach(function (tagName) {
        var option = document.createElement('option');
        option.value = tagName;
        option.textContent = '[Plugin] ' + tagName;
        option.style.color = 'green'; // Visually distinguish plugin tags
        existingTagsSelect.appendChild(option);
      });
    });
  });
}

// Request data for a single tag from content.js
function requestDataForTag(tag, selector) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['dataTags'], function (items) {
      const dataTags = items.dataTags || {};
      const isGeneral = generalTags.hasOwnProperty(tag);
      const isPluginTag = !isGeneral && !dataTags.hasOwnProperty(tag);

      if (!isGeneral && !dataTags.hasOwnProperty(tag) && !isPluginTag) {
        reject(new Error(`Data tag "{${tag}}" is not defined.`));
        return;
      }

      if (isGeneral) {
        handleGeneralTag(tag)
          .then(data => resolve(data))
          .catch(error => reject(error));
      } else if (isPluginTag) {
        // Request processing from background.js for plugin tags
        chrome.runtime.sendMessage({ action: 'processTag', tagName: tag, context: { selector: selector } }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.result);
          }
        });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs.length === 0) {
            reject(new Error("No active tabs found"));
            return;
          }

          chrome.tabs.sendMessage(tabs[0].id, { action: "requestData", tag: tag, selector: selector }, response => {
            if (chrome.runtime.lastError) {
              // Specific check for the common error when content.js is not loaded
              if (chrome.runtime.lastError.message.includes("Could not establish connection. Receiving end does not exist")) {
                const errorMessage = "The extension script has not been loaded into the current page. \n\nPlease reload your page and try again. This usually resolves the problem.";
                const resultContainer = document.getElementById('pageintel-result'); // Ensure this ID matches your actual error display container
                resultContainer.innerHTML = `<div class="error">${errorMessage}<button id="reload-page-button">Reload Page</button></div>`;
                document.getElementById('reload-page-button').addEventListener('click', function () {
                  chrome.tabs.reload(tabs[0].id);
                });
                reject(new Error(errorMessage));
              } else {
                reject(new Error(chrome.runtime.lastError.message));
              }
            } else {
              resolve(response.data);
            }
          });
        });
      }
    });
  });
}



// Populate tag fields when a tag is selected, including description
function populateTagFields() {
  var existingTagsSelect = document.getElementById('existing-tags');
  var tagName = existingTagsSelect.value;

  // Inputs that may be disabled
  var tagNameInput = document.getElementById('tag-name');
  var tagDescriptionInput = document.getElementById('tag-description');
  var tagSelectorInput = document.getElementById('tag-selector'); // Input for the tag's CSS selector

  if (isGeneralTag(tagName)) {
    // Populate the fields with system tag details
    tagNameInput.value = tagName;
    tagDescriptionInput.value = getGeneralTagDescription(tagName);
    tagSelectorInput.value = ''; // Clear or set a default value for system tags

    // Make fields read-only for system tags
    tagNameInput.readOnly = true;
    tagDescriptionInput.readOnly = true;
    tagSelectorInput.readOnly = true; // Ensure the selector can't be edited for system tags

    // Optionally, adjust styles or add indicators to signify that these are system tags and not editable
    tagNameInput.style.backgroundColor = '#f0f0f0'; // Example: make the background color gray
    tagDescriptionInput.style.backgroundColor = '#f0f0f0'; // Example: make the background color gray
    tagSelectorInput.style.backgroundColor = '#f0f0f0'; // Example: make the background color gray
  } else {
    // If not a system tag, fetch and populate the fields as normal and ensure they are editable
    chrome.storage.sync.get(['dataTags'], function (items) {
      var dataTags = items.dataTags || {};
      if (dataTags.hasOwnProperty(tagName)) {
        var tagDetails = dataTags[tagName];
        tagNameInput.value = tagName;
        tagDescriptionInput.value = tagDetails.description; // Assuming description field exists
        tagSelectorInput.value = tagDetails.selector; // Populate the selector field

        // Make fields editable
        tagNameInput.readOnly = false;
        tagDescriptionInput.readOnly = false;
        tagSelectorInput.readOnly = false;

        // Reset styles if necessary
        tagNameInput.style.backgroundColor = ''; // Reset background color
        tagDescriptionInput.style.backgroundColor = ''; // Reset background color
        tagSelectorInput.style.backgroundColor = ''; // Reset background color
      } else {
        // Fetch plugin tags
        chrome.runtime.sendMessage({ action: 'getPluginTags' }, function (response) {
          const pluginTags = response.tags || {};
          if (pluginTags.hasOwnProperty(tagName)) {
            var tagDetails = pluginTags[tagName];
            tagNameInput.value = tagName;
            tagDescriptionInput.value = tagDetails.description; // Assuming description field exists
            tagSelectorInput.value = ''; // Clear or set a default value for plugin tags

            // Make fields read-only for plugin tags
            tagNameInput.readOnly = true;
            tagDescriptionInput.readOnly = true;
            tagSelectorInput.readOnly = true; // Ensure the selector can't be edited for plugin tags

            // Optionally, adjust styles or add indicators to signify that these are plugin tags and not editable
            tagNameInput.style.backgroundColor = '#e0f7fa'; // Example: make the background color light cyan
            tagDescriptionInput.style.backgroundColor = '#e0f7fa'; // Example: make the background color light cyan
            tagSelectorInput.style.backgroundColor = '#e0f7fa'; // Example: make the background color light cyan
          } else {
            // Clear the fields if no tag is selected or found
            tagNameInput.value = '';
            tagDescriptionInput.value = '';
            tagSelectorInput.value = ''; // Also clear the selector field

            // Make fields editable
            tagNameInput.readOnly = false;
            tagDescriptionInput.readOnly = false;
            tagSelectorInput.readOnly = false;

            // Reset styles if necessary
            tagNameInput.style.backgroundColor = ''; // Reset background color
            tagDescriptionInput.style.backgroundColor = ''; // Reset background color
            tagSelectorInput.style.backgroundColor = ''; // Reset background color
          }
        });
      }
    });
  }
}

// Delete the selected tag
function deleteSelectedTag() {
  var existingTagsSelect = document.getElementById('existing-tags');
  var tagName = existingTagsSelect.value;

  if (isGeneralTag(tagName)) {
    showFadeOutMessage('System tags cannot be modified');
    return;
  }

  if (!tagName) {
    alert("Please select a tag to delete.");
    return;
  }

  var isConfirmed = confirm(`Are you sure you want to delete the tag "${tagName}"?`);
  if (!isConfirmed) {
    return;
  }

  chrome.storage.sync.get(['dataTags'], function (items) {
    var dataTags = items.dataTags || {};
    if (dataTags.hasOwnProperty(tagName)) {
      delete dataTags[tagName];
      chrome.storage.sync.set({ dataTags: dataTags }, function () {
        loadAllTags(); // Refresh the dropdown
        document.getElementById('tag-name').value = '';
        document.getElementById('tag-selector').value = '';
      });
    }
  });
}

let eventListenersSetup = false;  // This flag will determine if listeners have been setup

// Setup event listeners for tag management
function setupTagEventListeners() {
  if (eventListenersSetup) return;  // Prevent multiple setups
  eventListenersSetup = true;

  document.getElementById('existing-tags').addEventListener('change', function () {
    // Check if there are unsaved changes
    if (tagChanged) {
      // Use confirm to get user confirmation
      const shouldProceed = confirm("You have unsaved changes. Do you want to continue without saving?");
      if (shouldProceed) {
        populateTagFields(this.value);
        tagChanged = false; // Reset the flag if user decides to proceed
      } else {
        this.value = document.getElementById('original-tag-name').value;  // Reset to original value if not proceeding
      }
    } else {
      populateTagFields(this.value);
    }
  });

  // Additional event listeners for save, delete, and test operations
  document.getElementById('save-tag').addEventListener('click', saveOrUpdateTag);
  document.getElementById('delete-tag').addEventListener('click', deleteSelectedTag);
  document.getElementById('test-tag').addEventListener('click', function () {
    testTag();
  });

  document.getElementById('close-test-tag-result').addEventListener('click', function () {
    const resultDisplay = document.getElementById('test-tag-result');
    const resultContent = document.getElementById('test-result-content');
    resultDisplay.style.display = 'none';
    resultContent.innerHTML = '';  // Clear test result content
  });
}

// Function to test a tag
// function testTag() {
//   const tagNameInput = document.getElementById('tag-name');
//   const tagName = tagNameInput.value;
//   const tagDescriptionInput = document.getElementById('tag-description');
//   const tagSelectorInput = document.getElementById('tag-selector');

//   const resultDisplay = document.getElementById('test-tag-result');
//   const resultContent = document.getElementById('test-result-content');

//   // Constructing the selector object
//   const selectorObject = {
//     description: tagDescriptionInput.value,
//     selector: tagSelectorInput.value
//   };

//   resultDisplay.style.display = 'block';

//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     chrome.tabs.sendMessage(
//       tabs[0].id,
//       { action: "requestData", tag: tagName, selector: selectorObject },
//       (response) => {
//         if (chrome.runtime.lastError) {
//           resultContent.textContent = 'Error: ' + chrome.runtime.lastError.message;
//         } else {
//           if (response && response.data) {
//             resultContent.textContent = `Test Result: ${response.data}`;
//           } else {
//             resultContent.textContent = 'No data found or error occurred.';
//           }
//         }
//       }
//     );
//   });
// }
// Function to test a tag

function testTag() {
  const tagNameInput = document.getElementById('tag-name');
  const tagName = tagNameInput.value;
  const tagDescriptionInput = document.getElementById('tag-description');
  const tagSelectorInput = document.getElementById('tag-selector');

  const resultDisplay = document.getElementById('test-tag-result');
  const resultContent = document.getElementById('test-result-content');

  // Constructing the selector object
  const selectorObject = {
    description: tagDescriptionInput.value,
    selector: tagSelectorInput.value
  };

  resultDisplay.style.display = 'block';

  requestDataForTag(tagName, selectorObject)
    .then(data => {
      resultContent.textContent = `Test Result: ${data}`;
    })
    .catch(error => {
      resultContent.textContent = 'Error: ' + error.message;
    });
}

function showFadeOutMessage(message) {
  const messageContainer = document.createElement('div');
  messageContainer.style.position = 'fixed';
  messageContainer.style.bottom = '20px';
  messageContainer.style.left = '50%';
  messageContainer.style.transform = 'translateX(-50%)';
  messageContainer.style.backgroundColor = '#ffcccc';
  messageContainer.style.color = '#000';
  messageContainer.style.padding = '10px';
  messageContainer.style.borderRadius = '5px';
  messageContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,.5)';
  messageContainer.style.zIndex = '1000';
  messageContainer.innerText = message;

  document.body.appendChild(messageContainer);

  setTimeout(() => {
    messageContainer.style.transition = 'opacity 0.5s';
    messageContainer.style.opacity = '0';
    setTimeout(() => document.body.removeChild(messageContainer), 500);
  }, 2000); // Message will fade out after 2 seconds
}

let tagChanged = false;

document.getElementById('tag-name').addEventListener('input', () => manageTagChanges());
document.getElementById('tag-description').addEventListener('input', () => manageTagChanges());
document.getElementById('tag-selector').addEventListener('input', () => manageTagChanges());

function manageTagChanges() {
  tagChanged = true;
  document.getElementById('save-tag').style.display = 'inline-block';
  console.log("Changes made, showing Save button"); // Debug log
}

// Function to show the "Save Tag" button
function showSaveTagButton() {
  document.getElementById('save-tag').style.display = 'inline-block';
}

function saveOrUpdateTag() {
  console.log("Saving tag"); // Debug log
  tagChanged = false; // Reset the flag
  document.getElementById('save-tag').style.display = 'none'; // Hide Save button

  var tagName = document.getElementById('tag-name').value.trim();
  var originalTagName = document.getElementById('original-tag-name').value.trim();
  var tagSelector = document.getElementById('tag-selector').value.trim();
  var tagDescription = document.getElementById('tag-description').value.trim();

  if (!tagName || !tagSelector) {
    alert("Tag name and selector are required.");
    return;
  }

  chrome.storage.sync.get(['dataTags'], function (items) {
    var dataTags = items.dataTags || {};

    // If the tag name has changed, delete the old tag and create a new one
    if (originalTagName !== tagName) {
      delete dataTags[originalTagName];
    }

    dataTags[tagName] = { selector: tagSelector, description: tagDescription };

    chrome.storage.sync.set({ dataTags: dataTags }, function () {
      loadAllTags(); // Refresh the list of tags
      document.getElementById('save-tag').style.display = 'none';
      tagChanged = false;
    });
  });
}


document.getElementById('save-tag').style.display = 'none';


// Export necessary functions
export { loadAllTags, setupTagEventListeners, requestDataForTag };
