// tagProcessor.js

import { generalTags, isGeneralTag, handleGeneralTag } from './generalTags.js';

function parseTag(input) {
    console.log("Parsing tag input:", input);
    let index = 0;
    
    function parseTagContent() {
        const start = index;
        let depth = 1;
        while (index < input.length) {
            if (input[index] === '{') depth++;
            if (input[index] === '}') depth--;
            if (depth === 0) break;
            index++;
        }
        return input.slice(start, index);
    }

    function parseTagStructure() {
        if (input[index] !== '{') return null;
        index++; // Skip opening brace
        const tagContent = parseTagContent();
        index++; // Skip closing brace
        
        console.log("Parsed tag content:", tagContent);
        
        const [fullTag, namespace, tagName, paramsString] = tagContent.match(/^(?:(\w+):)?(\w+)(?:\((.*)\))?$/) || [];
        
        console.log("Parsed tag parts:", { fullTag, namespace, tagName, paramsString });

        let params = {};
        if (paramsString) {
            try {
                // Replace nested tags with placeholders before parsing
                const placeholderParamsString = paramsString.replace(/\{([^{}]+)\}/g, (match, p1) => {
                    return `"__PLACEHOLDER__${p1}__"`;
                });
                params = JSON.parse(placeholderParamsString);
                
                // Process placeholders
                for (let key in params) {
                    if (typeof params[key] === 'string' && params[key].startsWith('__PLACEHOLDER__') && params[key].endsWith('__')) {
                        const nestedTagContent = params[key].slice(14, -2); // Remove placeholder markers
                        params[key] = parseTagStructure(`{${nestedTagContent}}`);
                    }
                }
            } catch (error) {
                console.error(`Error parsing parameters for tag ${tagName}:`, error);
                // If parsing fails, treat the entire paramsString as a single parameter
                params = { rawParams: paramsString };
            }
        }

        return {
            type: 'tag',
            namespace: namespace || '',
            name: tagName,
            params: params
        };
    }

    const result = parseTagStructure();
    console.log("Final parsed tag structure:", JSON.stringify(result, null, 2));
    return result;
}
async function processTagStructure(tagStructure) {
    console.log("Processing tag structure:", JSON.stringify(tagStructure, null, 2));
    if (!tagStructure || tagStructure.type !== 'tag') return tagStructure;

    // Process nested tags in params
    for (let key in tagStructure.params) {
        if (tagStructure.params[key] && typeof tagStructure.params[key] === 'object' && tagStructure.params[key].type === 'tag') {
            tagStructure.params[key] = await processTagStructure(tagStructure.params[key]);
        }
    }

    // If rawParams exists, process it
    if (tagStructure.params.rawParams) {
        const nestedTagMatch = tagStructure.params.rawParams.match(/\{([^{}]+)\}/);
        if (nestedTagMatch) {
            const nestedTagContent = nestedTagMatch[1];
            const nestedTagStructure = parseTag(`{${nestedTagContent}}`);
            const processedNestedTag = await processTagStructure(nestedTagStructure);
            tagStructure.params = { name: processedNestedTag };
        }
    }

    // Process this tag
    console.log("Requesting data for tag:", tagStructure.name);
    const result = await requestDataForTag(tagStructure);
    console.log("Received result for tag:", result);

    return result;
}

async function requestDataForTag(tagStructure) {
    console.log("Requesting data for tag structure:", tagStructure);
    const fullTagName = tagStructure.namespace ? `${tagStructure.namespace}:${tagStructure.name}` : tagStructure.name;
    
    console.log("Full tag name:", fullTagName);
    console.log("Is general tag:", isGeneralTag(fullTagName));

    if (isGeneralTag(fullTagName)) {
        return handleGeneralTag(fullTagName, tagStructure.params);
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { 
                action: "processTag", 
                tagName: tagStructure.name,
                namespace: tagStructure.namespace,
                params: tagStructure.params
            },
            (response) => {
                console.log("Received response from background script:", response);
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
}

async function parseAndProcessTags(input) {
    const tagStructure = parseTag(input);
    return await processTagStructure(tagStructure);
}

export { parseTag, processTagStructure, requestDataForTag, parseAndProcessTags };