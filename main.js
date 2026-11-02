// =========================
// FOOTER YEAR
// =========================

const yearElement = document.getElementById("current-year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}


// =========================
// CREATE MESSAGE ELEMENTS
// =========================

const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("secret-message");
const charCount = document.getElementById("char-count");

const generateButton = document.getElementById("generate-button");
const resultCard = document.getElementById("result-card");
const generatedLink = document.getElementById("generated-link");

const copyButton = document.getElementById("copy-link");
const createAnotherButton = document.getElementById("create-another");
const errorMessage = document.getElementById("error-message");


// =========================
// CHARACTER COUNTER
// =========================

if (messageInput && charCount) {

    messageInput.addEventListener("input", () => {

        charCount.textContent =
            `${messageInput.value.length} / 5000`;

    });

}


// =========================
// ENCODING HELPERS
// =========================

function arrayBufferToBase64(buffer) {

    const bytes = new Uint8Array(buffer);

    let binary = "";

    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}


function arrayBufferToBase64Url(buffer) {

    return arrayBufferToBase64(buffer)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

}


// =========================
// AES-256-GCM ENCRYPTION
// =========================

async function encryptMessage(message) {

    // Generate a random 256-bit encryption key
    const key = await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );


    // Generate a unique 96-bit initialization vector
    const iv = crypto.getRandomValues(
        new Uint8Array(12)
    );


    // Convert message to bytes
    const encodedMessage = new TextEncoder().encode(message);


    // Encrypt message locally
    const encryptedData = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
            tagLength: 128
        },
        key,
        encodedMessage
    );


    // Export encryption key
    const rawKey = await crypto.subtle.exportKey(
        "raw",
        key
    );


    return {
        ciphertext: arrayBufferToBase64(encryptedData),
        iv: arrayBufferToBase64(iv),
        encryptionKey: arrayBufferToBase64Url(rawKey)
    };

}


// =========================
// ERROR HANDLING
// =========================

function showError(message) {

    if (!errorMessage) return;

    errorMessage.textContent = message;
    errorMessage.hidden = false;

    errorMessage.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


function hideError() {

    if (errorMessage) {
        errorMessage.hidden = true;
        errorMessage.textContent = "";
    }

}


// =========================
// GENERATE SECURE MESSAGE
// =========================

if (messageForm) {

    messageForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        hideError();

        const message = messageInput.value.trim();

        const expiryHours = Number(
            document.getElementById("expiry").value
        );

        const maxRetrievals = Number(
            document.getElementById("max-views").value
        );


        if (!message) {

            showError("Please enter a message first.");
            return;

        }


        if (!window.crypto || !window.crypto.subtle) {

            showError(
                "Secure encryption requires HTTPS or localhost. Please open the page using Live Server."
            );

            return;

        }


        generateButton.disabled = true;
        generateButton.textContent = "Encrypting Message...";


        try {

            // Step 1: Encrypt message on the user's device
            const encrypted = await encryptMessage(message);


            // Step 2: Send ciphertext only to the backend
            // The encryption key is NOT included in this request.

            const response = await fetch("/api/messages", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    ciphertext: encrypted.ciphertext,

                    iv: encrypted.iv,

                    expiresInHours: expiryHours,

                    maxRetrievals: maxRetrievals

                })

            });


            if (!response.ok) {

                throw new Error(
                    "The server could not save your encrypted message."
                );

            }


            const data = await response.json();


            if (!data.id) {

                throw new Error(
                    "The server response did not contain a message ID."
                );

            }


            // Step 3: Put the encryption key in the URL fragment.
            // URL fragments are not sent in the HTTP request.

            const secureLink =
                `${window.location.origin}/open.html?id=${encodeURIComponent(data.id)}#${encrypted.encryptionKey}`;


            // Step 4: Display generated link

            generatedLink.value = secureLink;

            resultCard.hidden = false;

            resultCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });


            // Clear the original message from the form
            messageInput.value = "";

            if (charCount) {
                charCount.textContent = "0 / 5000";
            }

        }

        catch (error) {

            console.error("SecureLink error:", error);

            showError(
                error.message ||
                "Something went wrong. Please try again."
            );

        }

        finally {

            generateButton.disabled = false;

            generateButton.innerHTML =
                'Encrypt & Generate Link <span>→</span>';

        }

    });

}


// =========================
// COPY SECURE LINK
// =========================

if (copyButton) {

    copyButton.addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText(
                generatedLink.value
            );

            copyButton.textContent = "Copied! ✓";

            setTimeout(() => {

                copyButton.textContent = "Copy Link";

            }, 2000);

        }

        catch (error) {

            generatedLink.select();

            showError(
                "Automatic copying failed. Please select and copy the link manually."
            );

        }

    });

}


// =========================
// CREATE ANOTHER MESSAGE
// =========================

if (createAnotherButton) {

    createAnotherButton.addEventListener("click", () => {

        resultCard.hidden = true;

        generatedLink.value = "";

        messageForm.reset();

        if (charCount) {
            charCount.textContent = "0 / 5000";
        }

        hideError();

        messageInput.focus();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

}
// =========================
// OPEN SECURE MESSAGE
// =========================

const loadingCard = document.getElementById("loading-card");
const initialCard = document.getElementById("initial-card");
const messageResult = document.getElementById("message-result");

const openErrorCard = document.getElementById("open-error-card");
const openErrorText = document.getElementById("open-error-text");

const openMessageButton = document.getElementById("open-message-button");
const decryptedMessage = document.getElementById("decrypted-message");


// Base64 decoder

function base64ToArrayBuffer(base64) {

    const binary = atob(base64);

    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;

}


// Base64URL decoder

function base64UrlToArrayBuffer(base64url) {

    let base64 = base64url
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    while (base64.length % 4) {
        base64 += "=";
    }

    return base64ToArrayBuffer(base64);

}


// Show error

function showOpenError(message) {

    if (loadingCard) loadingCard.hidden = true;
    if (initialCard) initialCard.hidden = true;
    if (messageResult) messageResult.hidden = true;

    if (openErrorCard) {
        openErrorText.textContent = message;
        openErrorCard.hidden = false;
    }

}


// Decrypt message

async function decryptSecureMessage() {

    const params = new URLSearchParams(
        window.location.search
    );

    const messageId = params.get("id");

    const encryptionKey = window.location.hash.substring(1);


    if (!messageId || !encryptionKey) {

        showOpenError(
            "The secure link is incomplete. Please ask the sender to share the complete link."
        );

        return;

    }


    if (!window.crypto || !window.crypto.subtle) {

        showOpenError(
            "Secure decryption requires HTTPS or localhost."
        );

        return;

    }


    try {

        // Retrieve encrypted message from backend.
        // The key is never included in this request.

        const response = await fetch(
            `/api/messages/${encodeURIComponent(messageId)}`
        );


        if (!response.ok) {

            throw new Error(
                "The message could not be retrieved. It may have expired or reached its retrieval limit."
            );

        }


        const data = await response.json();


        if (!data.ciphertext || !data.iv) {

            throw new Error(
                "The server returned incomplete encrypted message data."
            );

        }


        // Import the key locally

        const rawKey = base64UrlToArrayBuffer(
            encryptionKey
        );


        const key = await crypto.subtle.importKey(
            "raw",
            rawKey,
            {
                name: "AES-GCM"
            },
            false,
            ["decrypt"]
        );


        // Decode encrypted message and IV

        const encryptedData = base64ToArrayBuffer(
            data.ciphertext
        );

        const iv = new Uint8Array(
            base64ToArrayBuffer(data.iv)
        );


        // Decrypt locally

        const decryptedData = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128
            },
            key,
            encryptedData
        );


        const originalMessage = new TextDecoder().decode(
            decryptedData
        );


        // Display as text, never as HTML

        decryptedMessage.textContent = originalMessage;

        loadingCard.hidden = true;
        initialCard.hidden = true;
        messageResult.hidden = false;


    }

    catch (error) {

        console.error("Decryption error:", error);

        showOpenError(
            "The message could not be decrypted. The link may be invalid, the key may be incorrect, or the message may have been modified."
        );

    }

}


// Initialize Open Message Page

if (loadingCard && openMessageButton) {

    loadingCard.hidden = true;
    initialCard.hidden = false;

    openMessageButton.addEventListener(
        "click",
        async () => {

            openMessageButton.disabled = true;
            openMessageButton.textContent = "Decrypting...";

            await decryptSecureMessage();

            openMessageButton.disabled = false;
            openMessageButton.innerHTML =
                'Decrypt & View Message <span>→</span>';

        }
    );

}