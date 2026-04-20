// background.js

let offscreenReady = false;
let pendingOCRRequests = [];

// --- Offscreen Document Lifecycle ---
async function setupOffscreenDocument(path) {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
        return; // already exists
    }

    offscreenReady = false; // reset ready state when (re)creating

    await chrome.offscreen.createDocument({
        url: path,
        reasons: ['DOM_PARSER'],
        justification: 'Run Tesseract.js OCR within a DOM context for Manifest V3 CSP compliance.'
    });
}

// --- Message Router ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Offscreen document signals it's fully loaded and ready
    if (request.action === "offscreenReady") {
        console.log("[Background] Offscreen document is ready.");
        offscreenReady = true;

        // Flush any pending OCR requests that arrived before the doc was ready
        pendingOCRRequests.forEach(({ image, respond }) => {
            forwardOCR(image, respond);
        });
        pendingOCRRequests = [];
        return false;
    }

    if (request.action === "processCaptcha") {
        setupOffscreenDocument('offscreen.html').then(() => {
            if (offscreenReady) {
                forwardOCR(request.image, sendResponse);
            } else {
                // Queue the request until offscreen signals ready
                console.log("[Background] Offscreen not ready yet — queuing OCR request.");
                pendingOCRRequests.push({ image: request.image, respond: sendResponse });
            }
        });
        return true; // async response
    }
});

function forwardOCR(image, sendResponse) {
    console.log("[Background] Forwarding OCR request to offscreen document.");
    chrome.runtime.sendMessage({ action: "runOCR", image }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("[Background] Error forwarding to offscreen:", chrome.runtime.lastError.message);
            sendResponse({ text: "" });
            return;
        }
        console.log("[Background] OCR response received:", response);
        sendResponse(response);
    });
}
