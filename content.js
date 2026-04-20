// content.js
// Reads credentials from chrome.storage.local (set via the extension popup).
// Supports:
//   1. https://students.cuchd.in  — 2-step CUIMS login
//   2. https://lms.cuchd.in       — Moodle single-step login

const host = window.location.hostname;
console.log("[CU Auto Login] Loaded on:", host);

// Fetch credentials and site preferences from storage, then run
chrome.storage.local.get(['uid', 'password', 'enableCUIMS', 'enableLMS'], (data) => {
    const uid      = data.uid;
    const password = data.password;

    if (!uid || !password) {
        console.log("[CU Auto Login] No credentials saved. Open the extension popup to set up.");
        return;
    }

    if (host.includes("lms.cuchd.in")) {
        if (data.enableLMS === false) {
            console.log("[CU Auto Login] LMS auto-login is disabled in settings.");
            return;
        }
        handleLMSLogin(uid, password);

    } else {
        if (data.enableCUIMS === false) {
            console.log("[CU Auto Login] CUIMS auto-login is disabled in settings.");
            return;
        }
        handleCUIMS(uid, password);
    }
});


// ─── LMS (Moodle) Login ──────────────────────────────────────────────────────
function handleLMSLogin(uid, password) {
    const tryFill = setInterval(() => {
        const usernameInput = document.getElementById("username") ||
                              document.querySelector('input[name="username"]');
        const passwordInput = document.getElementById("password") ||
                              document.querySelector('input[name="password"]');
        const loginBtn      = document.getElementById("loginbtn") ||
                              document.querySelector('button[type="submit"], input[type="submit"]');

        if (usernameInput && passwordInput && loginBtn) {
            clearInterval(tryFill);
            console.log("[LMS Auto Login] Filling credentials...");
            setNativeValue(usernameInput, uid);
            setNativeValue(passwordInput, password);
            setTimeout(() => {
                console.log("[LMS Auto Login] Submitting login.");
                loginBtn.click();
            }, 500);
        }
    }, 500);

    setTimeout(() => clearInterval(tryFill), 15000);
}


// ─── CUIMS 2-Step Login ──────────────────────────────────────────────────────
function handleCUIMS(uid, password) {
    let step1Done = false;
    let step2Done = false;
    let captchaSolving = false;

    const poll = setInterval(() => {
        const passwordInput = document.querySelector('input[type="password"]');

        // STEP 1: No password field → enter UID and click NEXT
        if (!passwordInput && !step1Done) {
            const usernameInput = document.querySelector('input[type="text"], input:not([type="password"]):not([type="hidden"])');
            const nextBtn = findButtonByText(["NEXT", "CONTINUE"]);

            if (usernameInput && nextBtn) {
                if (usernameInput.value !== uid) {
                    console.log("[CUIMS Auto Login] Step 1: Filling UID.");
                    setNativeValue(usernameInput, uid);
                }
                if (usernameInput.value === uid) {
                    console.log("[CUIMS Auto Login] Step 1: Clicking NEXT.");
                    step1Done = true;
                    setTimeout(() => nextBtn.click(), 400);
                }
            }
            return;
        }

        // STEP 2: Password visible → fill it and click LOGIN (Wait for Captcha too)
        if (passwordInput && !step2Done) {
            const loginBtn = findButtonByText(["LOGIN", "SUBMIT", "SIGN IN"]);
            const captchaImg = document.querySelector('img[src*="Captcha"], img#imgCaptcha');
            const captchaInput = document.querySelector('input[name*="Captcha"], input#txtCaptcha');

            if (loginBtn) {
                // Fill password if not already filled
                if (passwordInput.value !== password) {
                    console.log("[CUIMS Auto Login] Step 2: Filling password.");
                    setNativeValue(passwordInput, password);
                }

                // If captcha exists, solve it before clicking login
                if (captchaImg && captchaInput && !captchaSolving && !captchaInput.value) {
                    console.log("[CUIMS Auto Login] Step 2: Captcha detected. Starting OCR...");
                    captchaSolving = true;
                    solveCaptcha(captchaImg, captchaInput, () => {
                        console.log("[CUIMS Auto Login] Captcha filled. Clicking LOGIN.");
                        step2Done = true;
                        clearInterval(poll);
                        setTimeout(() => loginBtn.click(), 500);
                    });
                    return; // Wait for OCR callback
                }

                // If no captcha or already filled, just login
                if (!step2Done && (!captchaImg || (captchaInput && captchaInput.value))) {
                    console.log("[CUIMS Auto Login] Step 2: Finalizing login.");
                    step2Done = true;
                    clearInterval(poll);
                    setTimeout(() => loginBtn.click(), 500);
                }
            }
        }
    }, 600);

    setTimeout(() => clearInterval(poll), 30000);
}


// ─── Captcha Handling ────────────────────────────────────────────────────────

async function solveCaptcha(imgEl, inputEl, callback) {
    try {
        const dataUrl = await getImageDataURL(imgEl);
        if (!dataUrl) {
            console.error("[CUIMS Auto Login] Failed to extract captcha image.");
            callback(); // Proceed anyway (let user fill it)
            return;
        }

        chrome.runtime.sendMessage({ action: "processCaptcha", image: dataUrl }, (response) => {
            if (response && response.text) {
                const cleaned = response.text.replace(/\s/g, '').toUpperCase();
                console.log("[CUIMS Auto Login] OCR Result:", cleaned);
                setNativeValue(inputEl, cleaned);
            } else {
                console.warn("[CUIMS Auto Login] OCR failed or returned empty text.");
            }
            callback();
        });
    } catch (err) {
        console.error("[CUIMS Auto Login] Error in solveCaptcha:", err);
        callback();
    }
}

function getImageDataURL(img) {
    return new Promise((resolve) => {
        if (img.complete && img.naturalHeight !== 0) {
            resolve(extractFromCanvas(img));
        } else {
            img.onload = () => resolve(extractFromCanvas(img));
            img.onerror = () => resolve(null);
        }
    });
}

function extractFromCanvas(img) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("[CUIMS Auto Login] Canvas extraction failed (CORS?):", e);
        return null;
    }
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function findButtonByText(labels) {
    const els = document.querySelectorAll('button, input[type="submit"], input[type="button"], a');
    return Array.from(els).find(el => {
        const text = (el.innerText || el.value || el.textContent || "").trim().toUpperCase();
        return labels.some(l => text === l || text.startsWith(l));
    }) || null;
}

// Sets a value in a way React/Angular frameworks detect
function setNativeValue(el, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, value);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}
