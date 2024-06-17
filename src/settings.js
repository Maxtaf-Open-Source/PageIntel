// settings.js
import { loadAllTasks } from './taskManagement.js';
import { loadTasks } from './taskManagement.js';
import { loadAllTags } from './tagManagement.js'; // Add this import

// settings.js

// Load settings when the panel is opened
function loadSettings() {
  chrome.storage.sync.get(['displayInPopup', 'apiKey', 'model', 'apiUrl', 'settingsPassword', 'autoTruncatePrompts'], function (items) {
    document.getElementById('pageintel-display-in-popup').checked = items.displayInPopup !== false;
    document.getElementById('api-key').value = items.apiKey || '';
    document.getElementById('model-select').value = items.model || 'gpt-4';
    document.getElementById('settings-password').value = items.settingsPassword || '';
    document.getElementById('api-url').value = items.apiUrl || 'https://api.openai.com/v1/chat/completions';
    document.getElementById('auto-truncate-prompts').checked = items.autoTruncatePrompts !== false; 
  });
}

// Save settings
function saveSettings() {
  var apiKey = document.getElementById('api-key').value;
  var model = document.getElementById('model-select').value;
  var displayInPopup = document.getElementById('pageintel-display-in-popup').checked;
  var settingsPassword = document.getElementById('settings-password').value;
  var apiUrl = document.getElementById('api-url').value;
  var autoTruncatePrompts = document.getElementById('auto-truncate-prompts').checked;


  chrome.storage.sync.set({
    apiKey: apiKey,
    model: model,
    displayInPopup: displayInPopup,
    settingsPassword: settingsPassword,
    apiUrl: apiUrl,
    autoTruncatePrompts: autoTruncatePrompts
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
      dataTags: items.dataTags || {},
      autoTruncatePrompts: items.autoTruncatePrompts !== false,
      apiUrl: items.apiUrl

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
// Import settings
async function importSettings(event, mode, url = null) {
  let settings;

  try {
    if (url) {
      // Fetch settings from the provided URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      settings = await response.json();
    } else {
      // Import settings from the selected file
      const file = event.target.files[0];
      if (!file) throw new Error("No file selected.");

      settings = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            resolve(JSON.parse(e.target.result));
          } catch (error) {
            reject(new Error(`Invalid JSON in file: ${error.message}`));
          }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    }

    if (mode === 'overwrite') {
      chrome.storage.sync.set(settings, async function () {
        console.log('Settings imported and overwritten successfully');
        await loadAllTasks();
        await loadAllTags();
        loadSettings();

        // Calculate and display how many tasks and tags were imported
        const tasksCount = Object.keys(settings.tasks || {}).length;
        const tagsCount = Object.keys(settings.dataTags || {}).length;
        alert(`Import successful! ${tasksCount} tasks and ${tagsCount} tags have been imported.`);
        loadTasks();
      });
    } else if (mode === 'merge') {
      chrome.storage.sync.get(['tasks', 'dataTags', 'apiKey', 'model', 'displayInPopup', 'pageUrls'], function (existingSettings) {
        const mergedSettings = {
          tasks: { ...existingSettings.tasks, ...settings.tasks },
          dataTags: { ...existingSettings.dataTags, ...settings.dataTags },
          apiKey: settings.apiKey || existingSettings.apiKey,
          model: settings.model || existingSettings.model,
          displayInPopup: settings.displayInPopup !== undefined ? settings.displayInPopup : existingSettings.displayInPopup,
          pageUrls: { ...existingSettings.pageUrls, ...settings.pageUrls },
          apiUrl:  settings.apiUrl || existingSettings.apiUrl,
          displayIautoTruncatePrompts: settings.autoTruncatePrompts !== undefined ? settings.autoTruncatePrompts : existingSettings.autoTruncatePrompts,
        };

        chrome.storage.sync.set(mergedSettings, async function () {
          console.log('Settings imported and merged successfully');
          await loadAllTasks();
          await loadAllTags();
          loadSettings();

          // Calculate and display how many tasks and tags were merged
          const tasksCount = Object.keys(mergedSettings.tasks).length;
          const tagsCount = Object.keys(mergedSettings.dataTags).length;
          alert(`Import successful! Merged ${tasksCount} tasks and ${tagsCount} tags.`);
          loadTasks();
        });
      });
    }
  } catch (error) {
    console.log('Import failed:', error);
    alert(`Failed to import settings: ${error.message}`);
  }

}


// Export necessary functions
export { loadSettings, saveSettings, exportSettings, importSettings };