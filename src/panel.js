// panel.js

import { loadAllTags, setupTagEventListeners } from './tagManagement.js';
import { loadAllTasks, setupTaskEventListeners } from './taskManagement.js';
import { loadSettings, saveSettings, exportSettings, importSettings } from './settings.js';
import { generalTags } from './generalTags.js';
//import { fetchOpenAI } from './api.js';

// Show settings modal
function showSettingsModal() {
  document.getElementById('pageintel-settingsModal').style.display = 'block';
  document.body.classList.add('pageintel-modal-open');
}

// Close settings modal
function closeSettingsModal() {
  document.getElementById('pageintel-settingsModal').style.display = 'none';
  document.body.classList.remove('pageintel-modal-open');
}


function verifyApiKey() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  if (!apiKey) {
    alert('API Key cannot be empty.');
    return;
  }

  // Data to send for validation
  const validationData = {
    action: 'callOpenAI',
    data: {
      apiKey: apiKey,
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "hello, ai" }]
    }
  };

  // Send message to background.js
  chrome.runtime.sendMessage(validationData, function(response) {
    if (response.error) {
      console.log('Validation failed:', response.error);
      alert('API Key validation failed: ' + response.error.message);
    } else {
      console.log('API Key is valid!');
      chrome.storage.sync.set({ apiKey: apiKey }, function () {
        console.log('API Key saved and verified');

        closeSettingsModal(); // Close the settings modal
        alert("Your API key is activated! You can start using the extension. \n\nWe've included some predefined tasks for you to try, but we encourage you to create your own in the settings area. \n\n Just for this first time, please reload any open pages before running tasks to ensure everything works smoothly.");
        chrome.storage.sync.set({ firstTime: false }, function () {
          console.log('The settings modal has been shown on first use.');
        });
        document.getElementById('pageintel-firstTimeAlert').style.display = 'none'; // Show the first-time alert

      });
    }
  });
}



// Save password to storage
document.getElementById('save-password').addEventListener('click', function () {
  chrome.storage.sync.set({ settingsPassword: document.getElementById('settings-password').value }, function () {
    console.log('Settings password saved.');
  });
});

// Toggle visibility of the result section based on checkbox state
function toggleResultVisibility() {
  var displayInPopup = document.getElementById('pageintel-display-in-popup').checked;
  var resultContainer = document.getElementById('pageintel-result');
  resultContainer.style.display = displayInPopup ? 'none' : 'block';
}

function matchUrlWildcard(url, pattern) {
  console.log('URL:', url);
  console.log('Pattern:', pattern);
  var regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(url);
}

function loadTasks(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

    var currentTab = tabs[0];
    var currentPageUrl = currentTab.url;
    console.log('Current Page URL:', currentPageUrl);

    chrome.storage.sync.get(['tasks', 'pageUrls'], function (items) {

      console.log("Loaded tasks from storage:", items.tasks);
      if (!items.tasks) {
        console.log("No tasks found in sync storage.");
      }

      var tasks = items.tasks || {};
      var storedPageUrls = items.pageUrls || {};
      console.log('Stored Validation Tasks:', tasks);
      console.log('Stored Page URLs:', storedPageUrls);

      var taskList = document.getElementById('task-list');
      taskList.innerHTML = ''; // Clear previous task items

      for (var title in tasks) {
        var pageUrls = storedPageUrls[title] || '';
        console.log('Task Title:', title);
        console.log('Page URLs for Task:', pageUrls);

        if (pageUrls === '' || pageUrls.split(',').some(url => {
          var matchResult = matchUrlWildcard(currentPageUrl, url.trim());
          console.log('Matching URL:', url.trim());
          console.log('Match Result:', matchResult);
          return matchResult;
        })) {
          var taskItem = document.createElement('div');
          taskItem.className = 'pageintel-task-item';
          taskItem.innerHTML = `
            <div class="pageintel-task-header">
              <span class="pageintel-task-title">${title}</span>
              <div class="pageintel-task-actions">
                <i class="material-icons pageintel-view-task pageintel-visible" data-task="${title}">visibility</i>
                <i class="material-icons pageintel-view-task pageintel-hidden" data-task="${title}" style="display: none;">visibility_off</i>
                <i class="material-icons pageintel-validate-task" data-task="${title}">play_arrow</i>
              </div>
            </div>
            <div class="pageintel-task-details" style="display: none;">
              <p><b>Description</b>: ${tasks[title].description || 'No description available'}</p>
              <p><b>Prompt</b>: ${tasks[title].task || 'No prompt available'}</p>
            </div>
          `;
          taskList.appendChild(taskItem);

          taskItem.querySelectorAll('.pageintel-view-task').forEach(function (icon) {
            icon.addEventListener('click', function () {
              var taskDetails = this.closest('.pageintel-task-header').nextElementSibling;
              taskDetails.classList.toggle('show'); // This will add or remove the 'show' class

              var visibleIcon = this.parentNode.querySelector('.pageintel-visible');
              var hiddenIcon = this.parentNode.querySelector('.pageintel-hidden');

              // Toggle icons depending on whether task details are visible
              if (taskDetails.classList.contains('show')) {
                visibleIcon.style.display = 'none';
                hiddenIcon.style.display = 'inline-block';
              } else {
                visibleIcon.style.display = 'inline-block';
                hiddenIcon.style.display = 'none';
              }
            });
          });
        }
      }

      if (callback && typeof callback === 'function') {
        callback();
      }
    });
  });
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.active) {
    loadTasks();
  }
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
  loadTasks();
});

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
  loadAllTasks();
  loadAllTags();
  loadSettings();
  loadTasks();
  setupTagEventListeners();
  initializeImportSettingsUI();

  chrome.storage.sync.get(['firstTime'], function (items) {
    if (items.firstTime === undefined || items.firstTime === true) {
      showSettingsModal(); // Open the settings modal
      document.getElementById('pageintel-firstTimeAlert').style.display = 'block'; // Show the first-time alert
      chrome.storage.sync.set({ firstTime: false }, function () {
        console.log('The settings modal has been shown on first use.');
      });
    }
  });
  


  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.active) {
      loadTasks();
    }
  });



  var coll = document.getElementsByClassName("pageintel-collapsible");
  for (var i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function () {
      this.classList.toggle("pageintel-active");
      var content = this.nextElementSibling;
      content.style.display = content.style.display === "block" ? "none" : "block";
    });
  }

  toggleResultVisibility();
  setupTaskEventListeners();
  setupTagEventListeners();
  setupTextareaAutocomplete();
});

function setupTextareaAutocomplete() {
  const textarea = document.getElementById('pageintel-new-validation-tasks');

  textarea.addEventListener('keydown', function (event) {
    // Check if Ctrl+Space is pressed
    if (event.ctrlKey && event.code === 'Space') {
      event.preventDefault(); // Prevent the default space action

      // Fetch available data tags
      chrome.storage.sync.get(['dataTags'], function (items) {
        const dataTags = items.dataTags || {};
        showDataTagsPopup(dataTags);
      });
    }
  });

  // Close the pop-up when clicking outside
  document.addEventListener('click', function (event) {
    const popup = document.getElementById('dataTagsPopup');
    if (popup && !popup.contains(event.target)) {
      document.body.removeChild(popup);
      document.removeEventListener('keydown', handleKeyDown); // Remove the event listener
    }
  });
}

function showDataTagsPopup(dataTags) {
  const popup = document.createElement('div');
  popup.setAttribute('id', 'dataTagsPopup');
  popup.style.position = 'absolute';
  popup.style.border = '1px solid #ccc';
  popup.style.backgroundColor = 'white';
  popup.style.padding = '10px';
  popup.style.borderRadius = '5px';
  popup.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  popup.style.zIndex = '1000';
  popup.style.maxHeight = '200px'; // Set a maximum height for the popup
  popup.style.overflowY = 'auto'; // Enable vertical scrolling when needed
  document.body.appendChild(popup);

  const allTags = { ...dataTags };
  Object.keys(generalTags).forEach(tagName => {
    allTags[tagName] = { description: generalTags[tagName].description, isGeneral: true }; // Mark general tags
  });

  let filteredTags = Object.entries(allTags);

  const renderTags = () => {
    popup.innerHTML = ''; // Clear previous content

    filteredTags.forEach(([tagName, tagDetails]) => {
      const tagElement = document.createElement('div');
      tagElement.innerHTML = `<strong>${tagName}</strong>: ${tagDetails.description || 'No description available'}`;
      tagElement.style.cursor = 'pointer';
      tagElement.style.margin = '5px 0';
      tagElement.style.color = tagDetails.isGeneral ? 'blue' : 'inherit'; // Color general tags in blue
      tagElement.addEventListener('click', function () {
        insertTagAtCursor(tagName);
        document.body.removeChild(popup);
        document.removeEventListener('keydown', handleKeyDown);
        selectedIndex = -1;
      });
      popup.appendChild(tagElement);
    });
  };

  renderTags(); // Initial rendering

  let selectedIndex = -1;
  let searchTerm = '';

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredTags.length) % filteredTags.length;
      highlightSelectedTag();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredTags.length;
      highlightSelectedTag();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (selectedIndex !== -1) {
        const [tagName] = filteredTags[selectedIndex];
        insertTagAtCursor(tagName);
        document.body.removeChild(popup);
        document.removeEventListener('keydown', handleKeyDown);
        selectedIndex = -1;
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (searchTerm !== '') {
        // Reset the filter if there is a search term
        searchTerm = '';
        filteredTags = Object.entries(allTags);
        renderTags();
        selectedIndex = -1;
      } else {
        // Close the popup without inserting text if there is no search term
        document.body.removeChild(popup);
        document.removeEventListener('keydown', handleKeyDown);
        selectedIndex = -1;
      }
    } else if (event.key.length === 1) {
      event.preventDefault();
      searchTerm += event.key;
      filteredTags = Object.entries(allTags).filter(([tagName]) =>
        tagName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      renderTags();
      selectedIndex = -1;
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  const highlightSelectedTag = () => {
    const tagElements = popup.getElementsByTagName('div');
    for (let i = 0; i < tagElements.length; i++) {
      tagElements[i].style.backgroundColor = i === selectedIndex ? '#f0f0f0' : 'inherit';
    }
    if (selectedIndex !== -1) {
      tagElements[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  positionPopupCenter(popup);
}


function positionPopupCenter(popup) {
  const textarea = document.getElementById('pageintel-new-validation-tasks');
  const rect = textarea.getBoundingClientRect();

  // Calculate center position
  const centerX = rect.left + (textarea.offsetWidth / 2) - (popup.offsetWidth / 2);
  const centerY = rect.top + (textarea.offsetHeight / 2) - (popup.offsetHeight / 2) + window.scrollY;

  // Apply calculated position
  popup.style.left = `${centerX}px`;
  popup.style.top = `${centerY}px`;
}


function insertTagAtCursor(tag) {
  const textarea = document.getElementById('pageintel-new-validation-tasks');
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const textAfter = textarea.value.substring(cursorPos);

  textarea.value = textBefore + "{" + tag + "}" + textAfter;
  textarea.selectionStart = textarea.selectionEnd = cursorPos + tag.length + 2;
  textarea.focus();
}

function submitPassword() {
  var enteredPassword = document.getElementById('password-input').value;
  chrome.storage.sync.get(['settingsPassword'], function (result) {
    if (enteredPassword === result.settingsPassword) {
      document.getElementById('password-modal').style.display = 'none';
      showSettingsModal();
    } else {
      alert('Incorrect password.');
    }
    // Clear the password field after submission attempt
    document.getElementById('password-input').value = '';
  });
}

function cancelPassword() {
  document.getElementById('password-modal').style.display = 'none';
  // Clear the password field when cancelling
  document.getElementById('password-input').value = '';
}

function initializeImportSettingsUI() {
  const importFromFileRadio = document.getElementById('import-settings-file-radio'); // Assuming this is the ID for the "Import from File" radio button
  const importFromURLRadio = document.getElementById('import-settings-url-radio'); // Assuming this is the ID for the "Import from URL" radio button
  const fileInput = document.getElementById('import-settings-file');
  const urlInput = document.getElementById('import-settings-url');

  if (importFromFileRadio.checked) {
    fileInput.style.display = 'inline-block';
    urlInput.style.display = 'none';
  } else if (importFromURLRadio.checked) {
    fileInput.style.display = 'none';
    urlInput.style.display = 'inline-block';
  } else {
    // If none are selected, default to file input
    importFromFileRadio.checked = true;
    fileInput.style.display = 'inline-block';
    urlInput.style.display = 'none';
  }
}

document.getElementById('activate-button').addEventListener('click', verifyApiKey);

document.getElementById('api-key').addEventListener('input', saveSettings);
document.getElementById('model-select').addEventListener('change', saveSettings);
document.getElementById('pageintel-display-in-popup').addEventListener('change', saveSettings);
document.getElementById('api-url').addEventListener('input', saveSettings);

document.querySelector('.pageintel-close').addEventListener('click', closeSettingsModal);
document.getElementById('pageintel-display-in-popup').addEventListener('change', function () {
  chrome.storage.sync.set({ displayInPopup: this.checked }, function () {
    console.log('Show popup setting saved');
  });
  toggleResultVisibility();
});

document.getElementById('export-settings').addEventListener('click', exportSettings);

document.getElementById('import-settings-toggle').addEventListener('click', function () {
  document.getElementById('import-settings-container').style.display = 'block';
});

document.getElementById('import-settings-cancel').addEventListener('click', function () {
  document.getElementById('import-settings-container').style.display = 'none';
});

document.querySelectorAll('input[name="import-source"]').forEach(function (radioButton) {
  radioButton.addEventListener('change', function () {
    var importSource = document.querySelector('input[name="import-source"]:checked').value;
    document.getElementById('import-settings-file').style.display = importSource === 'file' ? 'inline-block' : 'none';
    document.getElementById('import-settings-url').style.display = importSource === 'url' ? 'inline-block' : 'none';
  });
});

document.getElementById('skip-button').addEventListener('click', function() {
  document.getElementById('pageintel-firstTimeAlert').style.display = 'none';
  showSettingsModal();
  chrome.storage.sync.set({ firstTime: false }, function () {
    console.log('The settings modal has been shown on first use.');
  });
  document.getElementById('pageintel-firstTimeAlert').style.display = 'none'; 
  alert("You've chosen to proceed without an API key. Please go to the settings to configure your API key or import settings at any time.");
});


document.getElementById('import-settings-submit').addEventListener('click', async function () {
  var importSource = document.querySelector('input[name="import-source"]:checked').value;
  var importMode = document.getElementById('import-mode-select').value;

  if (importSource === 'file') {
    var fileInput = document.getElementById('import-settings-file');
    if (fileInput.files.length > 0) {
      var file = fileInput.files[0];
      var event = { target: { files: [file] } };
      await importSettings(event, importMode, null);
      document.getElementById('import-settings-container').style.display = 'none';
    } else {
      alert('Please select a file to import.');
    }
  } else if (importSource === 'url') {
    var url = document.getElementById('import-settings-url').value;
    if (url) {
      await importSettings(null, importMode, url);
      document.getElementById('import-settings-container').style.display = 'none';
    } else {
      alert('Please enter a URL to import from.');
    }
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "displayResult") {
    chrome.storage.sync.get(['displayInPopup'], function (items) {
      var displayInPopup = items.displayInPopup;
      var resultDiv = document.getElementById('pageintel-result');
      resultDiv.innerHTML = '';

      if (!displayInPopup) {
        resultDiv.innerHTML = message.result;
      }
    });
  }
});

document.querySelector('.pageintel-settings-icon').addEventListener('click', function () {
  chrome.storage.sync.get(['settingsPassword'], function (result) {
    if (result.settingsPassword) {
      showPasswordModal();
    } else {
      showSettingsModal();
    }
  });
});

function showPasswordModal() {
  document.getElementById('password-modal').style.display = 'block';
  document.getElementById('password-input').focus();
}

// Example code in panel.js or similar

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.error) {
    // Display the error message in the UI
    const resultDiv = document.getElementById('pageintel-result');
    resultDiv.innerHTML = `<div class="error">Error: ${message.error.message}</div>`;
  }
});


document.getElementById('password-submit').addEventListener('click', submitPassword);
document.getElementById('password-cancel').addEventListener('click', cancelPassword);

document.getElementById('password-input').addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    submitPassword();
  } else if (event.key === 'Escape') {
    cancelPassword();
  }
});

document.getElementById('password-cancel').addEventListener('click', function () {
  document.getElementById('password-modal').style.display = 'none';
});

// document.getElementById('import-settings-btn').addEventListener('click', function () {
//   document.getElementById('import-mode-container').style.display = 'block';
//   document.getElementById('import-settings').click();
// });

// document.getElementById('import-settings').addEventListener('change', async function (event) {
//   const importMode = document.querySelector('input[name="import-mode"]:checked').value;
//   await importSettings(event, importMode, null);
//   document.getElementById('import-mode-container').style.display = 'none';
// });

document.querySelectorAll('.password-toggle').forEach(function (button) {
  button.addEventListener('click', function () {
    var targetInput = document.getElementById(this.dataset.target);
    var inputType = targetInput.getAttribute('type');
    if (inputType === 'password') {
      targetInput.setAttribute('type', 'text');
      this.innerHTML = '<i class="material-icons">visibility_off</i>';
    } else {
      targetInput.setAttribute('type', 'password');
      this.innerHTML = '<i class="material-icons">visibility</i>';
    }
  });
});

export { loadTasks };