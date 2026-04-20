// popup.js

const uidInput     = document.getElementById('uid');
const pwdInput     = document.getElementById('password');
const togglePwd    = document.getElementById('togglePwd');
const saveBtn      = document.getElementById('saveBtn');
const toast        = document.getElementById('toast');
const statusBadge  = document.getElementById('statusBadge');
const toggleCUIMS  = document.getElementById('toggleCUIMS');
const toggleLMS    = document.getElementById('toggleLMS');

// ── Load saved credentials on open ──────────────────────────────────────────
chrome.storage.local.get(['uid', 'password', 'enableCUIMS', 'enableLMS'], (data) => {
    if (data.uid) {
        uidInput.value = data.uid;
    }
    if (data.password) {
        pwdInput.value = data.password;
    }

    // Site toggles (default: both ON)
    toggleCUIMS.checked = data.enableCUIMS !== false;
    toggleLMS.checked   = data.enableLMS   !== false;

    updateBadge(!!data.uid && !!data.password);
});

// ── Show/hide password ───────────────────────────────────────────────────────
togglePwd.addEventListener('click', () => {
    const isHidden = pwdInput.type === 'password';
    pwdInput.type      = isHidden ? 'text' : 'password';
    togglePwd.textContent = isHidden ? '🙈' : '👁️';
});

// ── Save credentials ─────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
    const uid      = uidInput.value.trim().toUpperCase();
    const password = pwdInput.value;

    if (!uid) {
        showToast("Please enter your Student UID.", "error");
        uidInput.focus();
        return;
    }
    if (!password) {
        showToast("Please enter your password.", "error");
        pwdInput.focus();
        return;
    }

    chrome.storage.local.set({
        uid,
        password,
        enableCUIMS: toggleCUIMS.checked,
        enableLMS:   toggleLMS.checked,
    }, () => {
        updateBadge(true);
        showToast("✅ Credentials saved! Auto-login is active.", "success");
    });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function updateBadge(hasCredentials) {
    if (hasCredentials) {
        statusBadge.textContent = 'Active';
        statusBadge.className   = 'status-badge active';
    } else {
        statusBadge.textContent = 'Not Set';
        statusBadge.className   = 'status-badge inactive';
    }
}

function showToast(msg, type) {
    toast.textContent  = msg;
    toast.className    = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3500);
}
