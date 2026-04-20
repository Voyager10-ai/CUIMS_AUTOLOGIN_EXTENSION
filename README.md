# CUIMS Auto Login

I developed CU Auto Login, a **Chrome Extension** that automates the login process for **Chandigarh University** portals: CUIMS and CU LMS. Manual credential entry is a repetitive task for students. This tool removes that friction while keeping user data secure on the local machine.

## Features

- **Auto Login**: Automatically fills and submits the login form.
- **Secure Storage**: Safely handles user credentials using `chrome.storage`.
- **Manifest V3**: Fully compliant with the latest Chrome extension standards.

## Installation

1.  Clone this repository:
    ```bash
    git clone https://github.com/Voyager10-ai/CUIMS_AUTOLOGIN_EXTENSION.git
    ```
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (toggle in the top right corner).
4.  Click **Load unpacked** and select the folder containing this project.

## How to use

1.  Click on the extension icon in your toolbar to open the settings.
2.  Enter your CUIMS credentials.
3.  Navigate to the CUIMS login page, and the extension will handle the rest!

## Technical Highlights

- **Offscreen API**: Implemented for Tesseract.js OCR to bypass service worker limitations in Manifest V3.
- **Content Scripts**: Injected to interact with the login form securely.
  
---

Developed with ❤️ for CU Students.
