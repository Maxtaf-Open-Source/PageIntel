Certainly! I'll create the necessary files for the PageIntel Plugin Boilerplate project. I'll provide the content for each file, and you can save them in the appropriate directory structure.

1. `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "PageIntel Plugin Boilerplate",
  "version": "1.0",
  "description": "A starting point for developing PageIntel plugins",
  "permissions": ["storage"],
  "background": {
    "service_worker": "background.bundle.js"
  },
  "externally_connectable": {
    "ids": ["elloooffjhclmpoffemmkmddabnialok"]
  }
}

```

2. `src/background.js`

```javascript
const PAGEINTEL_EXTENSION_ID = 'elloooffjhclmpoffemmkmddabnialok';
const pluginId = chrome.runtime.id;

const tagDefinitions = [
  { name: "exampleTag", description: "An example tag demonstrating basic functionality." },
  { name: "reverseTag", description: "A tag that reverses the input string." }
];

function registerWithPageIntel() {
  chrome.runtime.sendMessage(
    PAGEINTEL_EXTENSION_ID,
    { 
      action: "registerTags", 
      pluginId: pluginId, 
      namespace: "boilerplate", 
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
  switch(tagName) {
    case "exampleTag":
      return `Example tag processed with params: ${JSON.stringify(params)}`;
    case "reverseTag":
      if (typeof params.text !== 'string') {
        throw new Error("reverseTag requires a 'text' parameter");
      }
      return params.text.split('').reverse().join('');
    default:
      throw new Error("Unknown tag");
  }
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

3. `webpack.config.js`

```javascript
const path = require('path');

module.exports = {
  entry: './src/background.js',
  output: {
    filename: 'background.bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  devtool: 'source-map',
  mode: 'development',
};

```

4. `package.json`

```json
{
  "name": "pageintel-plugin-boilerplate",
  "version": "1.0.0",
  "description": "A starting point for developing PageIntel plugins",
  "main": "src/background.js",
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "test": "jest"
  },
  "keywords": ["pageintel", "plugin", "boilerplate"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "@babel/core": "^7.15.0",
    "@babel/preset-env": "^7.15.0",
    "babel-loader": "^8.2.2",
    "jest": "^27.0.6",
    "webpack": "^5.50.0",
    "webpack-cli": "^4.8.0"
  }
}

```

5. `__tests__/background.test.js`

```javascript
// Mock chrome API
global.chrome = {
  runtime: {
    id: 'test-plugin-id',
    sendMessage: jest.fn(),
    onMessageExternal: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    }
  }
};

// Import the background script
require('../src/background.js');

describe('PageIntel Plugin Boilerplate', () => {
  it('registers tags with PageIntel', () => {
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      'elloooffjhclmpoffemmkmddabnialok',
      expect.objectContaining({
        action: "registerTags",
        pluginId: 'test-plugin-id',
        namespace: "boilerplate",
        tagDefinitions: expect.arrayContaining([
          expect.objectContaining({ name: "exampleTag" }),
          expect.objectContaining({ name: "reverseTag" })
        ])
      }),
      expect.any(Function)
    );
  });

  it('processes exampleTag correctly', () => {
    const listener = chrome.runtime.onMessageExternal.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    listener({ 
      action: "processTag", 
      tagName: "exampleTag", 
      params: { foo: "bar" } 
    }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: expect.stringContaining('Example tag processed with params: {"foo":"bar"}')
    });
  });

  it('processes reverseTag correctly', () => {
    const listener = chrome.runtime.onMessageExternal.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    listener({ 
      action: "processTag", 
      tagName: "reverseTag", 
      params: { text: "hello" } 
    }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: "olleh"
    });
  });

  it('handles errors correctly', () => {
    const listener = chrome.runtime.onMessageExternal.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    listener({ 
      action: "processTag", 
      tagName: "unknownTag", 
      params: {} 
    }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('Error processing unknownTag: Unknown tag')
      })
    }));
  });
});

```

6. `.gitignore`

```gitignore
# Dependencies
node_modules/

# Build output
dist/

# Logs
*.log

# Operating System Files
.DS_Store
Thumbs.db

# Editor directories and files
.idea/
.vscode/
*.swp
*.swo

# Testing
coverage/

# Temporary files
*.tmp
*.temp

```

7. `README.md`



# PageIntel Plugin Boilerplate

This repository provides a starting point for developing plugins for the PageIntel browser extension. It includes basic setup, example tags, and best practices for plugin development.

## Getting Started

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/pageintel-plugin-boilerplate.git
   cd pageintel-plugin-boilerplate
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the plugin:
   ```
   npm run build
   ```

4. Load the plugin in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

## Project Structure

- `src/background.js`: Main plugin logic
- `manifest.json`: Plugin manifest file
- `webpack.config.js`: Webpack configuration
- `__tests__/`: Test files

## Developing Your Plugin

1. Modify `src/background.js` to add your custom tags and logic.
2. Update `manifest.json` with your plugin details.
3. Add tests for your tags in the `__tests__/` directory.
4. Build your plugin using `npm run build`.

## Running Tests

To run the tests, use the following command:

```
npm test
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


8. `LICENSE`



MIT License

Copyright (c) [year] [fullname]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


These files provide a solid foundation for the PageIntel Plugin Boilerplate project. You can create a new GitHub repository, add these files, and it will be ready for developers to use as a starting point for creating their own PageIntel plugins.

Remember to update the `LICENSE` file with the current year and your name or organization name. Also, you might want to create a `CONTRIBUTING.md` file with guidelines for how others can contribute to the boilerplate project.

This setup includes a basic plugin structure, example tags, Webpack configuration for building, Jest for testing, and necessary documentation. Developers can clone this repository, follow the README instructions, and start developing their own PageIntel plugins with ease.
