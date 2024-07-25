# PageIntel Plugin Development Guide

## 1. Introduction
This document provides guidelines and specifications for developing plugins compatible with the PageIntel extension. Plugins extend the functionality of PageIntel by providing custom tags that can be used to extract or process data.

## 2. Plugin Structure
### 2.1 Manifest File
Each plugin must have a manifest.json file with the following key components:

```json
{
  "manifest_version": 3,
  "name": "Your Plugin Name",
  "version": "1.0",
  "description": "Description of your plugin",
  "permissions": [
    "storage"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "externally_connectable": {
    "ids": ["elloooffjhclmpoffemmkmddabnialok"]
  }
}
```

Ensure that the PageIntel extension ID is included in the externally_connectable.ids array.

### 2.2 Background Script
The core of your plugin will be the background.js file. This script should:
- Register your plugin's tags with PageIntel
- Listen for and process tag requests

## 3. Communication Protocol
### 3.1 Registering Tags
On installation and startup, your plugin should register its tags with PageIntel:

```javascript
const PAGEINTEL_EXTENSION_ID = 'elloooffjhclmpoffemmkmddabnialok';
const pluginId = chrome.runtime.id;

const tagDefinitions = [
  { name: "yourTagName", description: "Description of your tag" },
  // Add more tags as needed
];

function registerWithPageIntel() {
  chrome.runtime.sendMessage(
    PAGEINTEL_EXTENSION_ID,
    { 
      action: "registerTags", 
      pluginId: pluginId, 
      namespace: "yourNamespace", 
      tagDefinitions 
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to register tags:', chrome.runtime.lastError.message);
      } else {
        console.log("Tags registered successfully:", response);
      }
    }
  );
}

chrome.runtime.onStartup.addListener(registerWithPageIntel);
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    registerWithPageIntel();
  }
});
```

### 3.2 Processing Tag Requests
Your plugin should listen for external messages and process tag requests:

```javascript
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === "processTag") {
    const { tagName, params } = message;
    console.log(`Processing tag: ${tagName} with params:`, JSON.stringify(params, null, 2));

    try {
      let result = processTag(tagName, params);
      console.log(`Processed ${tagName} tag. Result:`, result);
      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error(`Error processing tag ${tagName}:`, error);
      sendResponse({ success: false, error: formatError(error, tagName) });
    }
  }
  return true; // Indicates an asynchronous response
});

function processTag(tagName, params) {
  // Implement your tag processing logic here
  // Return the result
}

function formatError(error, tagName) {
  return {
    type: 'error',
    message: `Error processing ${tagName}: ${error.message}`,
    details: error.stack,
    tagName: tagName
  };
}
```

## 4. Plugin Responsibilities
Plugins are responsible for processing their own tags and should not be concerned with nested tag structures. PageIntel handles the resolution of nested tags before sending requests to plugins. Your plugin should focus on processing the specific tags it has registered, using the parameters provided by PageIntel.

## 5. Best Practices
- Error Handling: Implement robust error handling and provide informative error messages.
- Logging: Use console.log for debugging, but ensure sensitive information is not logged in production.
- Performance: Optimize your tag processing functions for performance, especially for operations that might be called frequently.
- Security: Validate and sanitize all input parameters before processing.
- Versioning: Implement version checking to ensure compatibility with the current version of PageIntel.

## 6. Testing
- Develop unit tests for your tag processing functions.
- Test your plugin with PageIntel in various scenarios.
- Verify that your plugin correctly handles error cases and edge cases.

## 7. Documentation
- Provide clear documentation for each tag your plugin implements, including:
  - Tag name and namespace
  - Expected parameters
  - Return value format
  - Examples of usage
- Document any dependencies or special setup requirements for your plugin.

## 8. Submission and Updates
- Package your plugin according to Chrome Web Store guidelines.
- When submitting updates, ensure backwards compatibility or provide clear upgrade instructions.

This revised technical document provides a solid foundation for plugin developers to create compatible and robust plugins for PageIntel, with the correction regarding nested tag handling.
