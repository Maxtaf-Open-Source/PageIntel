// generalTags.js

const generalTags = {
  'page-title': {
    description: 'The title of the current page',
    handler: function () {
      return document.title || '';
    }
  },
  'page-url': {
    description: 'The URL of the current page',
    handler: function () {
      return window.location.href || '';
    }
  },
  'page-input-data': {
    description: 'Data contained in input fields, including those within iframes',
    handler: function (params) {
        console.log('Starting page-input-data handler');

        function collectInputData(context) {
            console.log('Collecting input data from context:', context.location ? context.location.href : 'Main document');
            const inputs = context.querySelectorAll('input, a[role="checkbox"]');
            console.log(`Found ${inputs.length} input elements in this context`);
            
            return Array.from(inputs).map(input => {
                let label = context.querySelector(`label[for="${input.id}"]`);
                let labelText = label ? label.textContent.trim() : 'No label';

                console.log(`Processing input: ${input.name || input.id || 'unnamed'}, Type: ${input.type || 'custom'}`);

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
        }

        function getInputDataRecursive(context, depth = 0) {
            console.log(`${' '.repeat(depth * 2)}Entering getInputDataRecursive, depth: ${depth}`);
            let inputData = collectInputData(context);

            // Process iframes
            const iframes = context.getElementsByTagName('iframe');
            console.log(`${' '.repeat(depth * 2)}Found ${iframes.length} iframes in this context`);

            for (let i = 0; i < iframes.length; i++) {
                const iframe = iframes[i];
                console.log(`${' '.repeat(depth * 2)}Processing iframe ${i + 1}/${iframes.length}`);
                try {
                    const iframeContent = iframe.contentDocument || iframe.contentWindow.document;
                    console.log(`${' '.repeat(depth * 2)}Successfully accessed iframe content`);
                    const iframeData = getInputDataRecursive(iframeContent, depth + 1);
                    console.log(`${' '.repeat(depth * 2)}Collected ${iframeData.length} input data items from iframe`);
                    inputData = inputData.concat(iframeData);
                } catch (e) {
                    console.log(`${' '.repeat(depth * 2)}Error accessing iframe content:`, e);
                }
            }

            console.log(`${' '.repeat(depth * 2)}Exiting getInputDataRecursive, depth: ${depth}, total inputs: ${inputData.length}`);
            return inputData;
        }

        const allInputData = getInputDataRecursive(document);
        console.log(`Total input elements collected: ${allInputData.length}`);

        // Convert the input data array to a JSON string
        const jsonResult = JSON.stringify(allInputData);
        console.log('Final JSON result length:', jsonResult.length);

        return jsonResult;
    }
},
  'page-full-content': {
    description: 'The full text content of the current page, including iframes and shadow DOMs',
    handler: function (params) {
      return getFullContent(document.body);
    }
  }

  // Add other general tags and their descriptions and handlers here
};

function isGeneralTag(tagName) {
  return generalTags.hasOwnProperty(tagName);
}

function getGeneralTagDescription(tagName) {
  return generalTags[tagName].description;
}

function handleGeneralTag(tagName, params) {
  return generalTags[tagName].handler(params);
}

function getFullContent(node) {
  let content = '';
  // Check if the current page is a PDF
  if (document.body.classList.contains('pdf-viewer')) {
    // Get the content of the PDF page
    const pdfContent = document.querySelector('.textLayer').textContent;
    return pdfContent.trim();
  }

  // Check if the current page is a Google Sheet or Google Doc
  if (window.location.hostname === 'docs.google.com') {
    if (window.location.pathname.startsWith('/spreadsheets/')) {
      // Get the content of the Google Sheet
      const sheetContent = document.querySelector('.grid-container').textContent;
      return sheetContent.trim();
    } else if (window.location.pathname.startsWith('/document/')) {
      // Get the content of the Google Doc
      const docContent = document.querySelector('.kix-page-content-wrapper').textContent;
      return docContent.trim();
    }
  }

  // Check if the node is visible
  if (isNodeVisible(node)) {
    // Handle text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      content += node.textContent;
    }
    // Handle elements
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      // Skip script, style, and multimedia tags
      if (!['script', 'style', 'img', 'picture', 'video', 'source', 'svg'].includes(tagName)) {
        // Handle iframe contents
        if (tagName === 'iframe') {
          try {
            content += ' ' + getFullContent(node.contentDocument.body);
          } catch (e) {
            console.log('Error accessing iframe content:', e);
          }
        }
        // Handle shadow DOM
        else if (node.shadowRoot) {
          content += ' ' + getFullContent(node.shadowRoot);
        }
        // Handle input fields
        if (tagName === 'input' || tagName === 'textarea') {
          let type = node.type.toLowerCase();
          if (['text', 'password', 'email', 'search', 'number', 'tel', 'url', 'textarea'].includes(type)) {
            content += ' ' + node.value;
          }
          // Handle checkbox and radio to include only if they are checked
          else if ((type === 'checkbox' || type === 'radio') && node.checked) {
            content += ' ' + node.value;
          }
        }
        // Handle select elements (dropdowns)
        else if (tagName === 'select') {
          content += ' ' + node.options[node.selectedIndex].text;
        }
        // Traverse child nodes
        for (let child of node.childNodes) {
          content += ' ' + getFullContent(child);
        }
      }
    }
  }

  return content.trim();
}

function isNodeVisible(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  }
  return true;
}


export { generalTags, isGeneralTag, getGeneralTagDescription, handleGeneralTag };