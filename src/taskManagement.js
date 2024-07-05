// taskManagement.js

import { loadTasks } from './panel.js';
import { generalTags } from './generalTags.js';
import { requestDataForTag } from './tagManagement.js';
import { resolveVariables, setVariable } from './variableResolution.js';


// Load all tasks in the settings panel
function loadAllTasks(callback) {
  chrome.storage.sync.get(['tasks'], function (items) {
    var tasks = items.tasks || {};
    var existingTasksSelect = document.getElementById('existing-tasks');

    existingTasksSelect.innerHTML = '';

    for (var title in tasks) {
      var option = document.createElement('option');
      option.value = title;
      option.textContent = title;

      existingTasksSelect.appendChild(option);
    }
    populateFieldsFromSelectedTask();
    if (callback && typeof callback === 'function') {
      callback();
    }
  });
}

// Populate fields from the selected task for editing
function populateFieldsFromSelectedTask() {
  var existingTasksSelect = document.getElementById('existing-tasks');
  var selectedTitle = existingTasksSelect.value;

  chrome.storage.sync.get(['tasks', 'pageUrls'], function (items) {
    var tasks = items.tasks || {};
    var storedPageUrls = items.pageUrls || {};

    if (tasks.hasOwnProperty(selectedTitle)) {
      document.getElementById('task-title').value = selectedTitle;
      document.getElementById('task-description').value = tasks[selectedTitle].description || '';
      document.getElementById('pageintel-new-validation-tasks').value = tasks[selectedTitle].task || '';
      document.getElementById('original-task-title').value = selectedTitle;
      document.getElementById('task-urls').value = storedPageUrls[selectedTitle] || '';
      document.getElementById('task-pinned').checked = tasks[selectedTitle].pinned || false;
    }
  });
}

// Synchronize dropdown selections
function syncDropdowns(selectedTaskTitle) {
  var existingTasksSelect = document.getElementById('existing-tasks');
  existingTasksSelect.value = selectedTaskTitle;
  populateFieldsFromSelectedTask();
}

// Save  task
function saveTask() {
  var title = document.getElementById('task-title').value;
  var description = document.getElementById('task-description').value;
  var task = document.getElementById('pageintel-new-validation-tasks').value;
  var originalTitle = document.getElementById('original-task-title').value;
  var pageUrls = document.getElementById('task-urls').value;

  if (!title) {
    console.log('No task selected, auto-save not performed');
    return false;
  }

  chrome.storage.sync.get(['tasks', 'pageUrls'], function (items) {
    var tasks = items.tasks || {};
    var storedPageUrls = items.pageUrls || {};

    if (!task) {
      // If the task is empty, use the existing task from storage
      task = tasks[title]?.task || '';
    }

    tasks[title] = {
      description: description,
      task: task,
      pinned: isPinned
    };
    storedPageUrls[title] = pageUrls;

    chrome.storage.sync.set({ tasks, pageUrls: storedPageUrls }, function () {
      console.log('Task saved');
      loadAllTasks(function () {
        syncDropdowns(title);
        loadTasks();
        document.getElementById('save-task').style.display = 'none';
        taskChanged = false;
      });
    });
  });

  return true;
}

function isHTMLPage(url) {
  return url && (url.startsWith("http") || url.startsWith("file") || url.startsWith("chrome-extension:"));
}

document.getElementById('existing-tasks').addEventListener('focus', function () {
  this.setAttribute('data-original-value', this.value);
}, true);


function updateTaskPinnedStatus(taskTitle, isPinned) {
  chrome.storage.sync.get(['tasks'], function (items) {
    const tasks = items.tasks || {};
    if (tasks[taskTitle]) {
      tasks[taskTitle].pinned = isPinned;
      chrome.storage.sync.set({ tasks }, function () {
        loadTasks();  // Reload tasks to reflect changes
      });
    }
  });
}

function updateBlurEffect() {
  const taskList = document.getElementById('task-list');
  const blurOverlay = document.querySelector('.blur-overlay');
  // Check if the task list is scrollable
  if (taskList.scrollHeight > taskList.clientHeight) {
      blurOverlay.style.display = 'block';  // Show blur if scrollable
  } else {
      blurOverlay.style.display = 'none';   // Hide blur if not scrollable
  }
}

// Call this function initially and whenever the task list might change
updateBlurEffect();


// Setup event listeners for task management
function setupTaskEventListeners() {

  document.getElementById('process-prompt-button').addEventListener('click', processPrompt);
  document.getElementById('process-and-test-button').addEventListener('click', processAndTest);

  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('pageintel-pin-checkbox')) {
      const taskTitle = event.target.getAttribute('data-task');
      const isPinned = event.target.checked;
      updateTaskPinnedStatus(taskTitle, isPinned);
    }
  });


  document.getElementById('existing-tasks').addEventListener('focus', function () {
    this.setAttribute('data-original-value', this.value);
  }, true);


  document.getElementById('existing-tasks').addEventListener('change', function () {
    if (taskChanged) {
      const shouldProceed = confirm("You have unsaved changes. Do you want to continue without saving?");
      if (shouldProceed) {
        syncDropdowns(this.value);
        populateFieldsFromSelectedTask();
        taskChanged = false;  // Reset the task changed flag
        document.getElementById('save-task').style.display = 'none';  // Optionally hide the save button
      } else {
        // Reset to the original value if not proceeding
        var originalValue = this.getAttribute('data-original-value');
        this.value = originalValue;
        // syncDropdowns(originalValue);
        // populateFieldsFromSelectedTask();
      }
    } else {
      syncDropdowns(this.value);
      populateFieldsFromSelectedTask();
    }
  });

  document.getElementById('save-task').addEventListener('click', saveTask);

  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('pageintel-validate-task')) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var currentTab = tabs[0];
        if (!isHTMLPage(currentTab.url)) {
          displayToastMessage("This type of page cannot be processed.");
          return;
        }
        var taskTitle = event.target.dataset.task;
        if (taskTitle === 'user-question') {
          processUserQuestion();
        } else {
          showSpinner(taskTitle);
          processTask(taskTitle);
        }
      });
    }
  });


  document.getElementById('add-new-task').addEventListener('click', function () {
    document.getElementById('task-title').value = '';
    document.getElementById('task-description').value = '';
    document.getElementById('task-urls').value = '';

    document.getElementById('pageintel-new-validation-tasks').value = "Replace this text with your task prompt. Ensure you include at least one data tag (press Ctrl+Space for options) to extract relevant data from the web page. \n\nFeel free to create and experiment with your own data tags to enhance functionality.\n\nHint: For the entire visible content of a page, use {page-full-content}. ";
    document.getElementById('original-task-title').value = '';
  });

  let taskChanged = false;

  // Add event listeners for input changes to track task changes and show the "Save Task" button
  document.getElementById('task-urls').addEventListener('input', function () {
    taskChanged = true;
    showSaveTaskButton();
  });
  document.getElementById('task-title').addEventListener('input', function () {
    taskChanged = true;
    showSaveTaskButton();
  });
  document.getElementById('pageintel-new-validation-tasks').addEventListener('input', function () {
    taskChanged = true;
    showSaveTaskButton();
  });
  document.getElementById('task-description').addEventListener('input', function () {
    taskChanged = true;
    showSaveTaskButton();
  });
  document.getElementById('task-pinned').addEventListener('change', function () {
    taskChanged = true;
    showSaveTaskButton();
  });

  // Add event listener for the "Save Task" button
  document.getElementById('save-task').addEventListener('click', saveTask);

  // Function to show the "Save Task" button
  function showSaveTaskButton() {
    document.getElementById('save-task').style.display = 'inline-block';
  }

  // Modify the saveTask function to handle task renaming
  function saveTask() {
    var title = document.getElementById('task-title').value;
    var description = document.getElementById('task-description').value;
    var task = document.getElementById('pageintel-new-validation-tasks').value;
    var originalTitle = document.getElementById('original-task-title').value;
    var pageUrls = document.getElementById('task-urls').value;
    var isPinned = document.getElementById('task-pinned').checked;

    if (!title) {
      alert('Task title cannot be empty');
      return;
    }

    chrome.storage.sync.get(['tasks', 'pageUrls'], function (items) {
      var tasks = items.tasks || {};
      var storedPageUrls = items.pageUrls || {};

      // If the task title has changed, delete the old task and create a new one
      if (originalTitle !== title) {
        delete tasks[originalTitle];
        delete storedPageUrls[originalTitle];
      }

      tasks[title] = {
        description: description,
        task: task,
        pinned: isPinned
      };
      storedPageUrls[title] = pageUrls;

      chrome.storage.sync.set({ tasks, pageUrls: storedPageUrls }, function () {
        console.log('Task saved');
        loadAllTasks(function () {
          syncDropdowns(title);
          loadTasks();
          document.getElementById('save-task').style.display = 'none';
          taskChanged = false;
        });
      });
    });

    console.log("Task saved");  // Confirm task has been saved
    taskChanged = false;  // Reset the task changed flag after saving
    document.getElementById('save-task').style.display = 'none';

  }

  document.getElementById('delete-task').addEventListener('click', function () {
    var title = document.getElementById('task-title').value;

    if (!title) {
      alert('No task selected to delete');
      return;
    }

    var isConfirmed = confirm('Are you sure you want to delete the task "' + title + '"?');
    if (!isConfirmed) {
      return;
    }

    chrome.storage.sync.get(['tasks'], function (items) {
      var tasks = items.tasks || {};
      if (tasks.hasOwnProperty(title)) {
        var existingTasksSelect = document.getElementById('existing-tasks');
        var indexToDelete = Array.from(existingTasksSelect.options).findIndex(option => option.value === title);

        delete tasks[title];

        chrome.storage.sync.set({ tasks }, function () {
          loadAllTasks(function () {
            var taskToSelect;
            if (indexToDelete >= existingTasksSelect.options.length) {
              taskToSelect = existingTasksSelect.options[existingTasksSelect.options.length - 1].value;
            } else {
              taskToSelect = existingTasksSelect.options[indexToDelete].value;
            }

            syncDropdowns(taskToSelect);
            loadTasks();
          });
        });
      } else {
        alert('Task not found');
      }
    });
  });

  var userQuestionTextarea = document.getElementById('user-question');
  userQuestionTextarea.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });

  userQuestionTextarea.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      var playIcon = this.closest('.pageintel-task-item').querySelector('.pageintel-validate-task');
      playIcon.click();
    }
  });

  var clearTextIcon = document.querySelector('.pageintel-clear-text');
  clearTextIcon.addEventListener('click', function () {
    userQuestionTextarea.value = '';
    userQuestionTextarea.style.height = 'auto';
  });

}

async function processTask(taskTitle) {


  try {
    const items = await chrome.storage.sync.get(['tasks']);
    const tasks = items.tasks || {};
    const taskObject = tasks[taskTitle];
    if (!taskObject) {
      displayToastMessage("Task not found.");
      return;
    }

    showSpinner(taskTitle);  // Show spinner before starting the task processing.
    var resultContainer = document.getElementById('pageintel-result');
    resultContainer.style.display = 'none';

    const modifiedTask = await collectAndInsertData(taskObject);
    sendDataToOpenAI(modifiedTask.task, taskTitle, false);
  } catch (error) {
    console.log('An error occurred:', error);
    hideSpinner(taskTitle);

    if (error.message.includes("Data tag")) {
      displayResult(`Error: ${error.message}`, false);
    } else if (error.message.includes("The extension script has not been loaded")) {
      displayResult(`Error: ${error.message}`, false);
    } else {
      displayResult(`Error: An error occured. Please try again.`, false);
    }
  }
}

function displayErrorMessage(errorMessage) {
  const resultContainer = document.getElementById('pageintel-result');
  if (resultContainer) {
    resultContainer.innerHTML = `<div class="error-message">${errorMessage}</div>`;
    resultContainer.style.display = 'block';
  }
}

function displayToastMessage(message) {
  const toastElement = document.createElement('div');
  toastElement.classList.add('pageintel-toast');
  toastElement.textContent = message;
  document.body.appendChild(toastElement);

  setTimeout(() => {
    toastElement.classList.add('pageintel-toast-show');
  }, 100);

  setTimeout(() => {
    toastElement.classList.remove('pageintel-toast-show');
    setTimeout(() => {
      document.body.removeChild(toastElement);
    }, 300);
  }, 3000);
}

async function collectAndInsertData(taskObject) {
  const tags = extractDataTagsFromTask(taskObject.task);

  async function processTag(tag) {
    const resolvedParams = {};
    for (const [key, value] of Object.entries(tag.params)) {
      if (value.startsWith('{') && value.endsWith('}')) {
        // This is a nested tag, process it recursively
        const nestedTag = extractDataTagsFromTask(value)[0];
        const nestedResult = await processTag(nestedTag);
        resolvedParams[key] = nestedResult;
      } else {
        resolvedParams[key] = await resolveVariables(value);
      }
    }


    const data = await requestDataForTag(tag.namespace && tag.namespace.length > 0 ? tag.namespace + ":" + tag.tagName : tag.tagName, tag.selector, resolvedParams);

    setVariable(tag.variableName, data);
    return data;
  }

  const results = await Promise.all(tags.map(processTag));

  let modifiedTask = taskObject.task;
  tags.forEach((tag, index) => {
    modifiedTask = modifiedTask.replace(tag.originalTag, results[index]);
  });

  return {
    ...taskObject,
    task: cleanEscapedBraces(modifiedTask)
  };
}

// Function to extract data tags from a task, considering escaped braces
function extractDataTagsFromTask(task) {
  const regex = /(\{([^{}]+)(?:\{[^{}]*\})*[^{}]*\})/g;
  const tags = [];
  let match;
  let tagIndex = 0;

  while ((match = regex.exec(task)) !== null) {
    const [fullTagWithBraces, , fullTag] = match;
    const paramMatch = fullTag.match(/^([^(]+)(\((.*)\))?$/);
    
    if (paramMatch) {
      const [, namespacedTag, , paramsString] = paramMatch;
      const [namespace, tagName] = namespacedTag.includes(':') ? namespacedTag.split(':') : ['', namespacedTag];
      
      let params = {};
      if (paramsString) {
        params = parseParameters(paramsString);
      }
      
      const variableName = `${namespace}:${tagName}:${tagIndex}`;
      
      tags.push({ 
        originalTag: fullTagWithBraces,
        namespace: namespace || '', 
        tagName: tagName || '', 
        params,
        variableName
      });

      tagIndex++;
    } else {
      tags.push({ originalTag: fullTagWithBraces, tagName: fullTag });
    }
  }

  return tags;
}

function parseParameters(paramsString) {
  const params = {};
  const regex = /(\w+):\s*((?:\{[^{}]+\})|(?:"[^"]*")|(?:'[^']*')|(?:[^,]+))/g;
  let match;

  while ((match = regex.exec(paramsString)) !== null) {
    const [, key, value] = match;
    params[key] = value.trim();

    // Remove quotes if the value is a quoted string
    if ((params[key].startsWith('"') && params[key].endsWith('"')) ||
        (params[key].startsWith("'") && params[key].endsWith("'"))) {
      params[key] = params[key].slice(1, -1);
    }
  }

  return params;
}



// Clean escaped braces in task text
function cleanEscapedBraces(task) {
  return task.replace(/\\([{}])/g, '$1');
}

function displayResult(response, isTestTaskButton = false) {
  if (isTestTaskButton) {
    // Direct the response to the 'pageintel-aiResponse' div specifically for test tasks
    const aiResponseElement = document.getElementById('pageintel-aiResponse');
    aiResponseElement.textContent = response;
    aiResponseElement.style.display = 'block'; // Make sure it is visible
  } else {
    // Existing functionality for handling normal tasks
    chrome.storage.sync.get(['displayInPopup'], function (items) {
      var displayInPopup = items.displayInPopup;

      if (!displayInPopup) {
        var resultContainer = document.getElementById('pageintel-result');
        resultContainer.style.display = 'block';
        if (resultContainer) {
          resultContainer.innerHTML = `
            <div style="position: relative;">
              <strong style="color: inherit !important;">${response.startsWith('Error:') ? 'Error' : 'Response'}:</strong>
              <span id="pageintel-copy-result" title="copy content" style="position: absolute !important; top: 0 !important; right: 30px !important; cursor: pointer !important; font-size: 30px !important;">&#xe14d;</span>
              <span id="pageintel-close-result" style="position: absolute !important; top: 0 !important; right: 0 !important; cursor: pointer !important; font-size: 30px !important;">&times;</span>

              <pre style="white-space: pre-wrap; margin-top: 20px;">${response}</pre>
              <div id="pageintel-copy-message" style="position: absolute; top: 30px; right: 0; background-color: #A9A9A9; color: white; padding: 5px 10px; border-radius: 4px; opacity: 0; transition: opacity 0.3s;">Copied to clipboard!</div>
            </div>
          `;
          resultContainer.style.display = 'block';

          // Add event listener to the copy button
          document.getElementById('pageintel-copy-result').addEventListener('click', function () {
            copyToClipboard(response);
            showCopyMessage();
          });

          // Add event listener to the close button
          document.getElementById('pageintel-close-result').addEventListener('click', function () {
            resultContainer.innerHTML = ''; // Clear the result container
            resultContainer.style.display = 'none'; // Hide the result container
          });
        }
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'displayResults', result: response });
        });
      }
    });
  }
}


function showCopyMessage() {
  var copyMessage = document.getElementById('pageintel-copy-message');
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


let accumulatedPromptTokens = 0;
let accumulatedCompletionTokens = 0;
let accumulatedTotalTokens = 0;
let messagesSinceReset = 0;

function sendDataToOpenAI(task, taskTitle, isTestTaskButton = false) {
  showSpinner(taskTitle); // Show the spinner for specific task

  chrome.storage.sync.get(['apiKey', 'model'], function (items) {
    var apiKey = items.apiKey;
    var model = items.model;

    if (!apiKey) {
      console.log('API key not found. Please configure it in the extension settings.');
      displayResult('API key not configured. Check extension settings.', isTestTaskButton);
      hideSpinner(taskTitle); // Hide the spinner for specific task
      return;
    }

    var requestData = {
      model: model,
      messages: [{ role: 'user', content: task }],
      max_tokens: 1000,
      n: 1,
      stop: null,
      temperature: 0.7,
    };

    chrome.runtime.sendMessage({
      action: 'callOpenAI',
      data: requestData
    }, response => {
      if (response.error && response.error.message.includes("maximum context length")) {
        let match = response.error.message.match(/maximum context length is (\d+) tokens. However, your messages resulted in (\d+) tokens./);
        if (match) {
          let maxTokens = parseInt(match[1], 10);
          let currentTokens = parseInt(match[2], 10);
          let reductionRatio = maxTokens / currentTokens;
          let truncatedLength = Math.floor(task.length * reductionRatio * 0.9);

        chrome.storage.sync.get(['autoTruncatePrompts'], function (items) {
          if (items.autoTruncatePrompts) {
            hideSpinner(taskTitle); // Hide spinner before recursive call
            sendDataToOpenAI(task.substring(0, truncatedLength), taskTitle, isTestTaskButton); // Recursively call with truncated task
          } else {
            // Ask user if they want to truncate the message
          if (confirm(`The prompt exceeds the maximum token limit. Would you like to truncate it to fit ${maxTokens} tokens?`)) {
            hideSpinner(taskTitle); // Hide spinner before recursive call
            sendDataToOpenAI(task.substring(0, truncatedLength), taskTitle, isTestTaskButton); // Recursively call with truncated task
          } else {
            displayResult('Prompt truncation cancelled by user.', isTestTaskButton);
            hideSpinner(taskTitle); // Hide spinner after user cancels
          }
          }
        });
        } else {
          displayResult(`Error: ${response.error.message}`, isTestTaskButton);
          hideSpinner(taskTitle); // Hide spinner on handling error
        }
      } else {
        displayResult(processResponse(response.result), isTestTaskButton);
        hideSpinner(taskTitle); // Hide spinner on successful response
        accumulatedPromptTokens += response.usage.prompt_tokens;
        accumulatedCompletionTokens += response.usage.completion_tokens;
        accumulatedTotalTokens += response.usage.total_tokens;
        messagesSinceReset++;

        // Update token usage display
        document.getElementById('messages-since-reset').textContent = messagesSinceReset;
        document.getElementById('prompt-tokens').textContent = accumulatedPromptTokens;
        document.getElementById('completion-tokens').textContent = accumulatedCompletionTokens;
        document.getElementById('total-tokens').textContent = accumulatedTotalTokens;

        // Calculate and display average token usage
        const avgPromptTokens = (accumulatedPromptTokens / messagesSinceReset).toFixed(2);
        const avgCompletionTokens = (accumulatedCompletionTokens / messagesSinceReset).toFixed(2);
        const avgTotalTokens = (accumulatedTotalTokens / messagesSinceReset).toFixed(2);

        document.getElementById('avg-prompt-tokens').textContent = avgPromptTokens;
        document.getElementById('avg-completion-tokens').textContent = avgCompletionTokens;
        document.getElementById('avg-total-tokens').textContent = avgTotalTokens;

      }
    });
  });
}

function processResponse(response) {
  const lastChar = response.slice(-1);
  const trimmedResponse = response.slice(0, -1); // Remove the invisible code before displaying to the user

  if (lastChar === ' ') {
    console.log("The response is related to the web page content.");
  } else if (lastChar === '\t') {
    console.log("The response is unrelated to the web page content.");
  }

  return trimmedResponse;
}

function processPrompt() {
  var taskContent = document.getElementById('pageintel-new-validation-tasks').value;
  var description = document.getElementById('task-description').value;
  
  clearAIInteractionSections();
  
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var currentTab = tabs[0];
    if (!isHTMLPage(currentTab.url)) {
      displayToastMessage("This type of page cannot be processed.");
      return;
    }

    collectAndInsertData({ task: taskContent, description: description })
      .then(modifiedTask => {
        document.getElementById('aiInteractionContainer').style.display = 'block';
        document.getElementById('pageintel-aiPrompt').textContent = modifiedTask.task;
        document.getElementById('pageintel-aiResponse').style.display = 'none';
      })
      .catch(error => {
        console.log('Error processing prompt:', error);
        displayToastMessage("Error processing the prompt. Please try again.");
      });
  });
}


function processAndTest() {
  var taskContent = document.getElementById('pageintel-new-validation-tasks').value;
  var description = document.getElementById('task-description').value;
  var taskTitle = document.getElementById('task-title').value;

  clearAIInteractionSections();

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var currentTab = tabs[0];
    if (!isHTMLPage(currentTab.url)) {
      displayToastMessage("This type of page cannot be processed.");
      return;
    }

    collectAndInsertData({ task: taskContent, description: description })
      .then(modifiedTask => {
        document.getElementById('aiInteractionContainer').style.display = 'block';
        document.getElementById('pageintel-aiPrompt').textContent = modifiedTask.task;
        document.getElementById('pageintel-aiResponse').style.display = 'block';
        
        // Send data to OpenAI and display response
        sendDataToOpenAI(modifiedTask.task, taskTitle, true);
      })
      .catch(error => {
        console.log('Error processing and testing:', error);
        displayToastMessage("Error processing and testing the task. Please try again.");
      });
  });
}



document.getElementById('reset-tokens').addEventListener('click', function () {
  accumulatedPromptTokens = 0;
  accumulatedCompletionTokens = 0;
  accumulatedTotalTokens = 0;
  messagesSinceReset = 0;

  document.getElementById('messages-since-reset').textContent = messagesSinceReset;
  document.getElementById('prompt-tokens').textContent = accumulatedPromptTokens;
  document.getElementById('completion-tokens').textContent = accumulatedCompletionTokens;
  document.getElementById('total-tokens').textContent = accumulatedTotalTokens;
  document.getElementById('avg-prompt-tokens').textContent = '0';
  document.getElementById('avg-completion-tokens').textContent = '0';
  document.getElementById('avg-total-tokens').textContent = '0';
});


function clearAIInteractionSections() {
  document.getElementById('pageintel-aiPrompt').textContent = '';
  document.getElementById('pageintel-aiResponse').textContent = '';
  document.getElementById('aiInteractionContainer').style.display = 'block';
}


// Call this function inside setupTaskEventListeners to attach the event listener
document.getElementById('clear-ai-interaction').addEventListener('click', function () {
  document.getElementById('aiInteractionContainer').style.display = 'none';
});

// Update the existing dropdown change event listener to include clearing the AI sections


// Show spinner
function showSpinner(taskTitle) {
  // Show spinner icon in the task list
  const playIcon = document.querySelector(`.pageintel-validate-task[data-task="${taskTitle}"]`);
  if (playIcon) {
    playIcon.classList.remove('material-symbols-outlined');
    playIcon.classList.add('pageintel-task-spinner');
    playIcon.textContent = '';
  }

  // Show spinner next to "Response" in the AI interaction container
  const responseSpinner = document.getElementById('response-spinner');
  if (responseSpinner) {
    responseSpinner.style.display = 'inline-block';
  }
}

// Hide spinner
function hideSpinner(taskTitle) {
  // Hide spinner icon and restore play icon in the task list
  const playIcon = document.querySelector(`.pageintel-validate-task[data-task="${taskTitle}"]`);
  if (playIcon) {
    playIcon.classList.remove('pageintel-task-spinner');
    playIcon.classList.add('material-symbols-outlined');
    playIcon.textContent = 'send';
  }

  // Hide spinner next to "Response" in the AI interaction container
  const responseSpinner = document.getElementById('response-spinner');
  if (responseSpinner) {
    responseSpinner.style.display = 'none';
  }
}

function processUserQuestion() {
  const userQuestion = document.getElementById('user-question').value;
  if (userQuestion.trim() === '') {
    displayToastMessage("Please enter a question.");
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var currentTab = tabs[0];
    if (!isHTMLPage(currentTab.url)) {
      displayToastMessage("This type of page cannot be processed.");
      return;
    }

    showSpinner('user-question');
    var resultContainer = document.getElementById('pageintel-result');
    resultContainer.style.display = 'none';

    const modifiedTask = addPageContentToQuestion(userQuestion);
    collectAndInsertData({ task: modifiedTask })
      .then(modifiedTask => {
        sendDataToOpenAI(modifiedTask.task, 'user-question', false);
      })
      .catch(error => {
        console.log('An error occurred:', error);
        hideSpinner('user-question');

        if (error.message.includes("Data tag")) {
          displayResult(`Error: ${error.message}`, false);
        } else if (error.message.includes("The extension script has not been loaded")) {
          displayResult(`Error: ${error.message}`, false);
        } else {
          displayResult(`Error: An error occured. Please try again.`, false);
        }
      });
  });
}

function addPageContentToQuestion(question) {
  const regex = /(?<!\\)\{([^}]+)\}/g;
  if (!regex.test(question)) {
    const prompt = `
    What follows is the user's prompt, to which the content of the current web page is appended. 
    Make your best judgment whether the user's prompt is related to the web content, and in such case, take the content into account.
    If you determine that the user's prompt is unrelated to the web page content, ignore the content and answer the prompt directly. 
    In your response, do not supply the reasoning related to determining whether the user question was related to the web page content or not.
    
    User Prompt: ${question}
  `;
  return `${prompt}\nWeb Page Content: {page-full-content}`;
  }
  return question;
}
// Export necessary functions
export { loadAllTasks, setupTaskEventListeners, addPageContentToQuestion, updateBlurEffect, collectAndInsertData };