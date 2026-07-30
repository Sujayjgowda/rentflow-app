const { google } = require('googleapis');
const path = require('path');
const stream = require('stream');

let driveClient = null;
let subfolderCache = {}; // Cache subfolder IDs to avoid repeated lookups

/**
 * Initialize and return the Google Drive client using a Service Account.
 * Reads credentials from GOOGLE_SERVICE_ACCOUNT_KEY env var (base64-encoded JSON).
 */
function getDriveClient() {
    if (driveClient) return driveClient;

    const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyEnv) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. Google Drive integration is disabled.');
    }

    let credentials;
    try {
        const decoded = Buffer.from(keyEnv, 'base64').toString('utf8');
        credentials = JSON.parse(decoded);
    } catch (e) {
        // Try parsing as plain JSON (not base64)
        try {
            credentials = JSON.parse(keyEnv);
        } catch (e2) {
            throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY. Provide a valid base64-encoded or raw JSON service account key.');
        }
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    driveClient = google.drive({ version: 'v3', auth });
    console.log('✅ Google Drive client initialized (Service Account)');
    return driveClient;
}

/**
 * Get the root folder ID from environment.
 */
function getRootFolderId() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is not set.');
    }
    return folderId;
}

/**
 * Find or create a subfolder inside the root Drive folder.
 * @param {string} folderName - e.g. 'agreements', 'bills', 'receipts'
 * @returns {Promise<string>} The subfolder ID
 */
async function getOrCreateSubfolder(folderName) {
    if (subfolderCache[folderName]) return subfolderCache[folderName];

    const drive = getDriveClient();
    const parentId = getRootFolderId();

    // Search for existing subfolder
    const searchRes = await drive.files.list({
        q: `name = '${folderName}' AND '${parentId}' in parents AND mimeType = 'application/vnd.google-apps.folder' AND trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
        subfolderCache[folderName] = searchRes.data.files[0].id;
        return subfolderCache[folderName];
    }

    // Create subfolder
    const createRes = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
    });

    subfolderCache[folderName] = createRes.data.id;
    console.log(`📁 Created Drive subfolder: ${folderName} (${createRes.data.id})`);
    return subfolderCache[folderName];
}

/**
 * Upload a file buffer to Google Drive.
 * @param {Buffer} fileBuffer - The file content as a Buffer
 * @param {string} fileName - Original file name (e.g. 'lease-agreement.pdf')
 * @param {string} mimeType - MIME type (e.g. 'application/pdf')
 * @param {string} subfolder - Subfolder name: 'agreements', 'bills', or 'receipts'
 * @returns {Promise<{fileId: string, viewLink: string}>}
 */
async function uploadFile(fileBuffer, fileName, mimeType, subfolder) {
    const drive = getDriveClient();
    const folderId = await getOrCreateSubfolder(subfolder);

    // Create a readable stream from the buffer
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const res = await drive.files.create({
        requestBody: {
            name: `${Date.now()}_${fileName}`,
            parents: [folderId],
        },
        media: {
            mimeType: mimeType,
            body: bufferStream,
        },
        fields: 'id, webViewLink, webContentLink',
    });

    const fileId = res.data.id;

    // Make the file viewable by anyone with the link
    await drive.permissions.create({
        fileId: fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    // Get the updated file info with sharing link
    const fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'webViewLink, webContentLink',
    });

    const viewLink = fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    console.log(`📤 Uploaded to Drive: ${fileName} → ${fileId}`);

    return {
        fileId,
        viewLink,
    };
}

/**
 * Delete a file from Google Drive.
 * @param {string} fileId - The Google Drive file ID
 * @returns {Promise<boolean>}
 */
async function deleteFile(fileId) {
    if (!fileId) return false;

    try {
        const drive = getDriveClient();
        await drive.files.delete({ fileId });
        console.log(`🗑️  Deleted from Drive: ${fileId}`);
        return true;
    } catch (err) {
        // File might already be deleted or not found
        if (err.code === 404) {
            console.warn(`⚠️ Drive file not found for deletion: ${fileId}`);
            return false;
        }
        throw err;
    }
}

/**
 * Check if Google Drive integration is configured.
 * @returns {boolean}
 */
function isConfigured() {
    return !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_DRIVE_FOLDER_ID);
}

module.exports = {
    uploadFile,
    deleteFile,
    isConfigured,
    getDriveClient,
};
