// settings.js
import { loadAllTasks } from './taskManagement.js';
import { loadTasks } from './taskManagement.js';
import { loadAllTags } from './tagManagement.js'; // Add this import

// settings.js

// Load settings when the panel is opened
function loadSettings() {
  chrome.storage.sync.get(['displayInPopup', 'apiKey', 'model', 'apiUrl'], function (items) {
    document.getElementById('pageintel-display-in-popup').checked = items.displayInPopup !== false;
    document.getElementById('api-key').value = items.apiKey || '';
    document.getElementById('model-select').value = items.model || 'gpt-4';
    document.getElementById('settings-password').value = items.settingsPassword || '';
    document.getElementById('api-url').value = items.apiUrl || 'https://api.openai.com/v1/chat/completions';
  });
}

// Save settings
function saveSettings() {
  var apiKey = document.getElementById('api-key').value;
  var model = document.getElementById('model-select').value;
  var displayInPopup = document.getElementById('pageintel-display-in-popup').checked;
  var settingsPassword = document.getElementById('settings-password').value;
  var apiUrl = document.getElementById('api-url').value;

  chrome.storage.sync.set({
    apiKey: apiKey,
    model: model,
    displayInPopup: displayInPopup,
    settingsPassword: settingsPassword,
    apiUrl: apiUrl
  }, function () {
    console.log('Settings saved');
  });
}

// ...

// Export settings
// settings.js adjustments

function exportSettings() {
  chrome.storage.sync.get(['tasks', 'apiKey', 'model', 'displayInPopup', 'pageUrls', 'dataTags'], function (items) {
    var settings = {
      tasks: items.tasks || {},
      apiKey: items.apiKey || '',
      model: items.model || 'gpt-4',
      displayInPopup: items.displayInPopup !== false,
      pageUrls: items.pageUrls || {},
      dataTags: items.dataTags || {} // Ensure this includes the full tag objects with descriptions
    };

    var json = JSON.stringify(settings, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = 'extension_settings.json';
    a.click();
  });
}


// Import settings
async function importSettings(event, mode, url = null) {
  let settings;

  if (url) {
    // Fetch settings from the provided URL
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      settings = await response.json();
    } catch (error) {
      console.log('Error fetching settings from URL:', error);
      alert('Failed to import settings from URL. Please check the URL and try again.');
      return;
    }
  } else {
    // Import settings from the selected file
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    settings = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(JSON.parse(e.target.result));
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  if (mode === 'overwrite') {
    // Overwrite existing settings with imported settings
    chrome.storage.sync.set(settings, function () {
      console.log('Settings imported and overwritten successfully');
      // Reload settings and UI elements as necessary
      loadAllTasks();
      loadAllTags();
      loadSettings();
    });
  } else if (mode === 'merge') {
    // Merge imported settings with existing settings
    chrome.storage.sync.get(['tasks', 'apiKey', 'model', 'displayInPopup', 'pageUrls', 'dataTags'], function (existingSettings) {
      const mergedSettings = {
        tasks: {
          ...existingSettings.tasks,
          ...settings.tasks
        },
        apiKey: settings.apiKey || existingSettings.apiKey,
        model: settings.model || existingSettings.model || 'gpt-4',
        displayInPopup: settings.displayInPopup !== undefined ? settings.displayInPopup : existingSettings.displayInPopup !== false,
        pageUrls: {
          ...existingSettings.pageUrls,
          ...settings.pageUrls
        },
        dataTags: {
          ...existingSettings.dataTags,
          ...settings.dataTags
        }
      };

      chrome.storage.sync.set(mergedSettings, function () {
        console.log('Settings imported and merged successfully');
        // Reload settings and UI elements as necessary
        loadAllTasks();
        loadAllTags();
        loadSettings();
      });
    });
  }
}

// Export necessary functions
export { loadSettings, saveSettings, exportSettings, importSettings };