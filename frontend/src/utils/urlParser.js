/**
 * Parses the secret URL hash to extract the secret ID and key.
 * Handles both standard '#' separators and encoded '%23' separators.
 * 
 * Expected format: #/secret/<id>#<key>
 * Or: #/secret/<id>%23<key>
 * 
 * @param {string} hash - The window.location.hash string
 * @returns {Object|null} - Returns { id, key } if successful, or null if invalid format.
 * @throws {Error} - Throws specific error messages for UI feedback
 */
export function parseSecretUrl(hash) {
    if (!hash || !hash.startsWith('#/secret/')) {
        return null; // Not a secret URL
    }

    const afterSecret = hash.substring('#/secret/'.length);

    // Check for standard separator first
    let separatorIndex = afterSecret.indexOf('#');
    let separatorLength = 1;

    // If not found, check for encoded separator
    if (separatorIndex === -1) {
        separatorIndex = afterSecret.indexOf('%23');
        separatorLength = 3;
    }

    if (separatorIndex === -1) {
        throw new Error("Invalid link format");
    }

    const id = afterSecret.substring(0, separatorIndex);
    let key = afterSecret.substring(separatorIndex + separatorLength);

    if (!id || !key) {
        throw new Error("Invalid link format");
    }


    try {
        key = decodeURIComponent(key);
    } catch (e) {
        // If decoding fails, assume it's raw
        console.warn('Failed to decode key component, using raw value', e);
    }

    return { id, key };
}
