// src/utils/driveUpload.ts

// Helper to get the token
const getAccessToken = () => {
  const token = sessionStorage.getItem('google_access_token');
  if (!token) throw new Error("No Google Access Token found. Please log out and log back in.");
  return token;
};

// 1. Create a Folder inside a Parent Folder
export const createDriveFolder = async (folderName: string, parentFolderId: string): Promise<string> => {
  const accessToken = getAccessToken();

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create folder: ${errorText}`);
  }

  const data = await response.json();
  return data.id; // Returns the new Folder ID
};

// 2. Upload a File to a Specific Folder
export const uploadFileToDrive = async (file: File, folderId: string): Promise<string> => {
  const accessToken = getAccessToken();

  const metadata = {
    name: file.name,
    mimeType: file.type,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive upload failed: ${errorText}`);
  }

  const data = await response.json();
  return data.webViewLink; 
};