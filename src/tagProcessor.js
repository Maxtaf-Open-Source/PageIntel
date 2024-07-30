// tagProcessor.js

function parseTag(input) {
    console.log("Parsing tag input:", input);

    const tagMatch = input.match(/^\{((\w+):)?(\w+(-\w+)*)(\(.*\))?\}$/s);
    console.log("Tag match result:", tagMatch);
    if (!tagMatch) {
        if (input.indexOf('{') !== -1 && input.indexOf('}') === -1) {
            throw new Error(`Syntax error: Missing closing brace '}' for tag '${input}'`);
        }
        if (input.split('}').length > input.split('{').length) {
            throw new Error(`Syntax error: Unexpected closing brace '}'`);
        }
        throw new Error(`Invalid tag syntax: '${input}'`);
    }

    const [, namespaceWithColon, namespace, tagName, , paramsString] = tagMatch;

    console.log("Parsed tag parts:", { namespace, tagName, paramsString });

    let params = {};
    if (paramsString) {
        try {
            params = parseParameters(paramsString.slice(1, -1));
        } catch (error) {
            console.error(`Error parsing parameters for tag ${tagName}:`, error);
            params = { rawParams: paramsString };
        }
    }

    const result = {
        type: 'tag',
        namespace: namespace || '',
        name: tagName,
        params: params
    };

    console.log("Final parsed tag structure:", JSON.stringify(result, null, 2));
    return result;
}

function parseParameters(input) {
    let params = {};
    let depth = 0;
    let currentKey = '';
    let currentValue = '';
    let inQuotes = false;
    let isKey = true;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (char === '"' && input[i - 1] !== '\\') {
            inQuotes = !inQuotes;
        }

        if (!inQuotes) {
            if (char === '(' || char === '{') depth++;
            if (char === ')' || char === '}') depth--;
        }

        if (!inQuotes && depth === 0) {
            if (char === ':' && isKey) {
                currentKey = currentKey.trim();
                isKey = false;
                continue;
            } else if (char === ',' || i === input.length - 1) {
                if (i === input.length - 1) currentValue += char;
                currentValue = currentValue.trim();

                if (currentValue.startsWith('"') && currentValue.endsWith('"')) {
                    currentValue = currentValue.slice(1, -1);
                } else if (currentValue === 'true') {
                    currentValue = true;
                } else if (currentValue === 'false') {
                    currentValue = false;
                } else if (!isNaN(currentValue) && currentValue !== '') {
                    currentValue = Number(currentValue);
                }

                params[currentKey] = currentValue;
                currentKey = '';
                currentValue = '';
                isKey = true;
                continue;
            }
        }

        if (isKey) {
            currentKey += char;
        } else {
            currentValue += char;
        }
    }

    return params;
}

async function processTagStructure(tagStructure) {
    console.log("Processing tag structure:", JSON.stringify(tagStructure, null, 2));
    if (!tagStructure || tagStructure.type !== 'tag') return tagStructure;

    try {
        // Process nested tags in params
        for (let key in tagStructure.params) {
            if (tagStructure.params[key] && typeof tagStructure.params[key] === 'object') {
                if (tagStructure.params[key].type === 'tag') {
                    tagStructure.params[key] = await processTagStructure(tagStructure.params[key]);
                } else {
                    // Recursively process nested objects
                    tagStructure.params[key] = await processTagStructure({
                        type: 'tag',
                        namespace: tagStructure.namespace,
                        name: tagStructure.name,
                        params: tagStructure.params[key]
                    });
                }
            } else if (typeof tagStructure.params[key] === 'string' && tagStructure.params[key].startsWith('{') && tagStructure.params[key].endsWith('}')) {
                // Process nested tag string
                const nestedTag = parseTag(tagStructure.params[key]);
                if (nestedTag) {
                    tagStructure.params[key] = await processTagStructure(nestedTag);
                }
            }
        }

        // Process this tag
        console.log("Requesting data for tag:", tagStructure.name);
        const result = await requestDataForTag(tagStructure);
        console.log("Received result for tag:", result);

        return result;

    } catch (error) {
        console.error(`Error processing tag structure:`, error);

        // Enhanced error handling
        if (error.message.includes("is not registered")) {
            const availableNamespaces = await getAvailableNamespaces();
            throw new Error(`Unknown namespace: '${tagStructure.namespace}'. Available namespaces are: ${availableNamespaces.join(', ')}`);
        }

        if (error.message.includes("Unknown tag")) {
            const similarTags = findSimilarTags(tagStructure.name);
            if (similarTags.length > 0) {
                throw new Error(`Unknown tag: '${tagStructure.name}'. Did you mean one of these: ${similarTags.join(', ')}?`);
            } else {
                throw new Error(`Unknown tag: '${tagStructure.name}'.`);
            }
        }

        if (error.message.includes("Invalid parameter")) {
            const paramName = error.message.match(/parameter '(\w+)'/)[1];
            const similarParams = findSimilarParams(tagStructure.name, paramName);
            if (similarParams.length > 0) {
                throw new Error(`Invalid parameter '${paramName}' for tag '${tagStructure.name}'. Did you mean one of these: ${similarParams.join(', ')}?`);
            }
        }

        // If it's not a specific error we can enhance, rethrow the original error
        throw error;
    }
}

// Helper function to get available namespaces
async function getAvailableNamespaces() {
    // This function should be implemented to return all registered namespaces
    // For now, we'll return a placeholder
    return ['hlw', 'general'];
}

// Helper function to find similar tags
function findSimilarTags(tagName) {
    // This function should implement a fuzzy search algorithm to find similar tag names
    // For now, we'll return a placeholder
    const allTags = ['page-title', 'page-url', 'helloWorldTag', 'mathTag', 'nestedTag', 'conditionalTag'];
    return allTags.filter(tag => tag !== tagName && tag.includes(tagName.substring(0, 3)));
}

// Helper function to find similar parameters
function findSimilarParams(tagName, paramName) {
    // This function should return known parameters for the given tag
    // For now, we'll return placeholders based on the tag name
    const paramMap = {
        'mathTag': ['operation', 'a', 'b'],
        'conditionalTag': ['condition', 'trueResult', 'falseResult'],
        'nestedTag': ['content']
    };
    const knownParams = paramMap[tagName] || [];
    return knownParams.filter(param => param !== paramName && param.includes(paramName.substring(0, 3)));
}


async function requestDataForTag(tagStructure) {
    console.log("Requesting data for tag structure:", tagStructure);

    let fullTagName, tagName, namespace, params;

    if (typeof tagStructure === 'string') {
        fullTagName = tagStructure;
        tagName = tagStructure;
        namespace = null;
        params = {};
    } else {
        fullTagName = tagStructure.namespace
            ? `${tagStructure.namespace}:${tagStructure.name}`
            : tagStructure.name;
        tagName = tagStructure.name;
        namespace = tagStructure.namespace;
        params = tagStructure.params || {};
    }

    console.log("Full tag name:", fullTagName);

    // Check if it's a plugin tag (has a namespace)
    if (namespace) {
        console.log("Processing plugin tag:", fullTagName);
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    action: "processTag",
                    tagName: tagName,
                    namespace: namespace,
                    params: params
                },
                (response) => {
                    console.log("Received response for plugin tag:", response);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.result) {
                        resolve(response.result);
                    } else if (response && response.error) {
                        reject(new Error(response.error));
                    } else {
                        reject(new Error("Invalid response from background script"));
                    }
                }
            );
        });
    } else {
        console.log("Processing general or custom tag:", fullTagName);
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['dataTags'], function (items) {
                const dataTags = items.dataTags || {};
                const selector = dataTags[fullTagName] ? dataTags[fullTagName].selector : null;

                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    chrome.tabs.sendMessage(
                        tabs[0].id,
                        {
                            action: "requestData",
                            tag: fullTagName,
                            params: params,
                            selector: selector  // Include the selector here
                        },
                        (response) => {
                            // Handle response
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else if (response && response.data) {
                                resolve(response.data);
                            } else {
                                reject(new Error("Invalid response from content script"));
                            }
                        }
                    );
                });
            });
        });
    }
}

async function parseAndProcessTags(input) {
    console.log("Parsing and processing input:", input);
    let result = '';
    let currentIndex = 0;

    while (currentIndex < input.length) {
        const openBraceIndex = input.indexOf('{', currentIndex);
        if (openBraceIndex === -1) {
            result += input.slice(currentIndex);
            break;
        }

        result += input.slice(currentIndex, openBraceIndex);
        const closeBraceIndex = findMatchingCloseBrace(input, openBraceIndex);

        if (closeBraceIndex === -1) {
            result += input[openBraceIndex];
            currentIndex = openBraceIndex + 1;
            continue;
        }

        const fullTag = input.slice(openBraceIndex, closeBraceIndex + 1);
        console.log("Processing tag:", fullTag);

        const tagStructure = parseTag(fullTag);
        console.log("Parsed tag structure:", tagStructure);

        if (tagStructure) {
            try {
                const processedTag = await processTagStructure(tagStructure);
                console.log("Processed tag result:", processedTag);
                result += processedTag;
            } catch (error) {
                console.error("Error processing tag:", error);
                result += `[Error processing tag: ${error.message}]`;
            }
        } else {
            console.log("Keeping original tag due to parsing failure");
            result += fullTag;
        }

        currentIndex = closeBraceIndex + 1;
    }

    console.log("Final processed result:", result);
    return result;
}

function findMatchingCloseBrace(input, startIndex) {
    let depth = 0;
    for (let i = startIndex; i < input.length; i++) {
        if (input[i] === '{') {
            depth++;
        } else if (input[i] === '}') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

export { parseTag, processTagStructure, requestDataForTag, parseAndProcessTags };