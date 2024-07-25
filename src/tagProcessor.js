// tagProcessor.js

import { generalTags, isGeneralTag, handleGeneralTag } from './generalTags.js';

function parseTag(input) {
    console.log("Parsing tag input:", input);
    
    // Match the entire tag structure
    const tagMatch = input.match(/^\{(\w+:)?(\w+)(\(.*\))?\}$/);
    if (!tagMatch) {
        console.error("Failed to parse tag:", input);
        return null;
    }

    const [, namespaceWithColon, tagName, paramsString] = tagMatch;
    const namespace = namespaceWithColon ? namespaceWithColon.slice(0, -1) : '';

    console.log("Parsed tag parts:", { namespace, tagName, paramsString });

    let params = {};
    if (paramsString) {
        // Remove the outer parentheses
        const cleanParamsString = paramsString.slice(1, -1);
        try {
            params = JSON.parse(cleanParamsString);
        } catch (error) {
            console.error(`Error parsing parameters for tag ${tagName}:`, error);
            params = { rawParams: cleanParamsString };
        }
    }

    const result = {
        type: 'tag',
        namespace: namespace,
        name: tagName,
        params: params
    };

    console.log("Final parsed tag structure:", JSON.stringify(result, null, 2));
    return result;
}

async function processTagStructure(tagStructure) {
    console.log("Processing tag structure:", JSON.stringify(tagStructure, null, 2));
    if (!tagStructure || tagStructure.type !== 'tag') return tagStructure;

    // Process nested tags in params
    for (let key in tagStructure.params) {
        if (typeof tagStructure.params[key] === 'string') {
            // Check if the parameter value is a nested tag
            const nestedTagMatch = tagStructure.params[key].match(/^\{([^{}]+)\}$/);
            if (nestedTagMatch) {
                const nestedTagContent = nestedTagMatch[1];
                const nestedTagStructure = parseTag(`{${nestedTagContent}}`);
                tagStructure.params[key] = await processTagStructure(nestedTagStructure);
            }
        } else if (tagStructure.params[key] && typeof tagStructure.params[key] === 'object' && tagStructure.params[key].type === 'tag') {
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
    console.log("Parsing and processing input:", input);
    const tagRegex = /\{(\w+:)?\w+(\(.*?\))?\}/g;
    let match;
    let lastIndex = 0;
    let result = '';

    while ((match = tagRegex.exec(input)) !== null) {
        // Add any text before the tag
        result += input.slice(lastIndex, match.index);

        const fullTag = match[0];
        const tagContent = match[1];
        console.log("Processing tag:", fullTag);

        const tagStructure = parseTag(fullTag);
        if (tagStructure) {
            try {
                const processedTag = await processTagStructure(tagStructure);
                result += processedTag;
            } catch (error) {
                console.error("Error processing tag:", error);
                result += `[Error processing tag: ${error.message}]`;
            }
        } else {
            result += fullTag; // Keep the original tag if parsing failed
        }

        lastIndex = tagRegex.lastIndex;
    }

    // Add any remaining text after the last tag
    result += input.slice(lastIndex);

    console.log("Final processed result:", result);
    return result;
}


export { parseTag, processTagStructure, requestDataForTag, parseAndProcessTags };