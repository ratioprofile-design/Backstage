
// Service to handle Google Drive API interaction
// Requires google scripts to be loaded in index.html

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// Scopes required for the application
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Helper to ensure scripts are loaded
const waitForScript = (globalVar: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if ((window as any)[globalVar]) {
            resolve();
            return;
        }
        // Wait up to 5 seconds (50 * 100ms)
        let retries = 0;
        const interval = setInterval(() => {
            if ((window as any)[globalVar]) {
                clearInterval(interval);
                resolve();
            }
            retries++;
            if (retries > 50) {
                clearInterval(interval);
                reject(`Timeout waiting for ${globalVar} script to load. Please check your internet connection or ad blockers.`);
            }
        }, 100);
    });
};

// Initialize the Google API Client
export const initializeGapi = async (apiKey: string, clientId: string) => {
  if (gapiInited && gisInited) {
      console.log("GAPI/GIS already initialized.");
      return; 
  }

  console.log("Initializing GAPI...");
  await waitForScript('gapi');
  await waitForScript('google');

  return new Promise<void>((resolve, reject) => {
    window.gapi.load('client', async () => {
      try {
        console.log("GAPI client loaded. Initializing...");
        
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        
        gapiInited = true;
        console.log("GAPI initialized.");
        
        if (window.google) {
          tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: () => {}, // Defined at request time
          });
          gisInited = true;
          console.log("GIS initialized.");
          resolve();
        } else {
          reject("Google Identity Services script not loaded");
        }
      } catch (err) {
        console.error("GAPI Init Error", err);
        const msg = (err as any)?.result?.error?.message || (err as any)?.message || JSON.stringify(err);
        reject(msg);
      }
    });
  });
};

// Request Access Token
export const requestAccessToken = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject("Token client not initialized");
    
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      // Explicitly set the token for gapi.client
      // console.log("Access Token Received:", resp.access_token);
      if (window.gapi && window.gapi.client) {
          window.gapi.client.setToken(resp); // Handles expiry internally for the session
      }
      resolve();
    };

    // Use 'prompt: ""' to try silent auth if possible, otherwise consent
    // For first run, might need 'consent', but the library handles 'prompt' logic well usually.
    // If token is null, we might need a popup.
    const currentToken = window.gapi.client.getToken();
    if (!currentToken) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' }); // Try silent refresh
    }
  });
};

// Create a new file on Drive
export const createDriveFile = async (fileName: string, content: string): Promise<string> => {
  try {
    const fileMetadata = {
      'name': fileName,
      'mimeType': 'application/json'
    };
    
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const contentType = 'application/json';
    
    // Strict multipart formatting
    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        content +
        close_delim;

    const request = window.gapi.client.request({
        'path': '/upload/drive/v3/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
    });

    const response = await request;
    return response.result.id;
  } catch (error) {
    console.error("Error creating file", error);
    throw error;
  }
};

// Update existing file on Drive
export const updateDriveFile = async (fileId: string, content: string) => {
  try {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const contentType = 'application/json';

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify({}) + // Empty metadata update (keep name same)
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        content +
        close_delim;

    const request = window.gapi.client.request({
        'path': '/upload/drive/v3/files/' + fileId,
        'method': 'PATCH',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
    });

    await request;
    return true;
  } catch (error) {
    console.error("Error updating file", error);
    throw error;
  }
};

// Search for existing file by name
export const findDriveFile = async (fileName: string): Promise<string | null> => {
  try {
    const response = await window.gapi.client.drive.files.list({
      'pageSize': 10,
      'fields': "nextPageToken, files(id, name, trashed)",
      'q': `name = '${fileName}' and trashed = false`
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0].id;
    }
    return null;
  } catch (err) {
    console.error("Error finding file", err);
    throw err; // Re-throw to handle 401s in context
  }
};
