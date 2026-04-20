// offscreen.js
// Chrome MV3: Use workerBlobURL: false so Tesseract creates the Web Worker
// directly from the chrome-extension:// URL (allowed via web_accessible_resources)
// instead of a blob: URL (which triggers a blocked importScripts call).

let _worker = null;

// Signal background.js that this document is loaded and the listener is ready
chrome.runtime.sendMessage({ action: "offscreenReady" }).catch(() => {
    // background may have already received it; suppress any error
});

async function getWorker() {
    if (_worker) return _worker;

    console.log("[OCR] Creating Tesseract worker...");

    _worker = await Tesseract.createWorker("eng", 1, {
        workerPath:    chrome.runtime.getURL('assets/worker.min.js'),
        corePath:      chrome.runtime.getURL('assets/tesseract-core.wasm.js'),
        langPath:      chrome.runtime.getURL('assets'),
        workerBlobURL: false,
        logger: m => {
            if (m.status && m.progress < 1) {
                console.log(`[OCR] ${m.status}: ${(m.progress * 100).toFixed(0)}%`);
            }
        }
    });

    await _worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    });

    console.log("[OCR] Worker initialized and ready.");
    return _worker;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'runOCR') {
        console.log("[OCR] Received runOCR request.");
        processImage(request.image)
            .then(text => {
                console.log("[OCR] Sending result:", JSON.stringify(text));
                sendResponse({ text });
            })
            .catch(err => {
                console.error("[OCR] Fatal error:", err);
                sendResponse({ text: "" });
            });
        return true; // keep message channel open for async response
    }
});

async function processImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Failed to load captcha image"));

        img.onload = async () => {
            try {
                const canvas = document.getElementById('canvas');
                if (!canvas) {
                    console.error("[OCR] Canvas element not found in offscreen DOM!");
                    return reject(new Error("Canvas not found"));
                }

                const ctx = canvas.getContext('2d');

                // Crop 5% border noise from all sides
                const cropX = img.naturalWidth  * 0.05;
                const cropY = img.naturalHeight * 0.05;
                const cropW = img.naturalWidth  * 0.90;
                const cropH = img.naturalHeight * 0.90;

                // Scale up for better accuracy (target 120px min height)
                const scale = Math.max(2, 120 / cropH);
                canvas.width  = Math.round(cropW * scale);
                canvas.height = Math.round(cropH * scale);

                ctx.imageSmoothingEnabled = false;
                ctx.filter = 'grayscale(100%) contrast(300%) brightness(120%)';
                ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

                console.log(`[OCR] Canvas: ${canvas.width}×${canvas.height} | Source: ${img.naturalWidth}×${img.naturalHeight}`);

                if (typeof Tesseract === 'undefined') {
                    console.error("[OCR] Tesseract library not loaded!");
                    return resolve("");
                }

                const worker = await getWorker();
                const { data: { text } } = await worker.recognize(canvas);

                console.log("[OCR] Raw Tesseract output:", JSON.stringify(text));
                resolve(text.trim());

            } catch (err) {
                console.error("[OCR] Recognition error:", err);
                reject(err);
            }
        };

        img.src = dataUrl;
    });
}
