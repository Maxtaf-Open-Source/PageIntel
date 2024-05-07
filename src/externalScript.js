// externalScript.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'showOpenExtensionMessage') {
        const message = document.createElement('div');
        message.innerHTML = `
            <p>To open the PageIntel extension, click on the extension icon in your browser's toolbar.</p>
        `;
        document.body.appendChild(message);
    }
});
