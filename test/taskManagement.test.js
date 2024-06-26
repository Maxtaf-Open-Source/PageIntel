import { loadAllTasks, setupTaskEventListeners, addPageContentToQuestion, updateBlurEffect } from '../src/taskManagement';
import chrome from 'chrome';

describe('Task Management', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('loadAllTasks should load tasks from storage', () => {
    // Mock chrome.storage.sync.get
    chrome.storage.sync.get.mockImplementationOnce((keys, callback) => {
      callback({ tasks: { task1: {}, task2: {} } });
    });

    // Mock the callback function
    const callback = jest.fn();

    // Call loadAllTasks
    loadAllTasks(callback);

    // Check if the callback function is called
    expect(callback).toHaveBeenCalled();
  });

  // ... other tests ...
});