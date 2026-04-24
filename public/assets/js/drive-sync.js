/**
 * DriveSync — Google Drive appDataFolder sync for Policy Builder
 * Stores all policies as a single JSON file in the user's hidden app folder.
 */
window.DriveSync = (() => {
  const DATA_FILENAME = 'policy-builder-data.json';
  const SYNC_DEBOUNCE_MS = 3000;
  const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

  let driveFileId = null;
  let syncTimer = null;
  let onStatusChange = null;

  function init(callback) {
    onStatusChange = callback;
  }

  function setStatus(status) {
    if (onStatusChange) onStatusChange(status);
  }

  async function authHeaders() {
    const token = await GoogleAuth.getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${token}` };
  }

  // Find the data file in appDataFolder
  async function findFile() {
    if (driveFileId) return driveFileId;
    const headers = await authHeaders();
    const url = `${DRIVE_FILES}?spaces=appDataFolder&q=name='${DATA_FILENAME}'&fields=files(id,modifiedTime)`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Drive list failed: ${res.status} ${body}`);
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      driveFileId = data.files[0].id;
      return driveFileId;
    }
    return null;
  }

  // Read the JSON data file
  async function readFile(fileId) {
    const headers = await authHeaders();
    const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, { headers });
    if (!res.ok) throw new Error(`Drive read failed: ${res.status}`);
    return res.json();
  }

  // Create a new data file
  async function createFile(data) {
    const headers = await authHeaders();
    const metadata = { name: DATA_FILENAME, parents: ['appDataFolder'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: headers.Authorization },
      body: form,
    });
    if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
    const result = await res.json();
    driveFileId = result.id;
    return driveFileId;
  }

  // Update existing data file
  async function updateFile(fileId, data) {
    const headers = await authHeaders();
    const res = await fetch(`${DRIVE_UPLOAD}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
  }

  // Pull data from Drive (returns null if no file exists)
  async function pullFromDrive() {
    setStatus('syncing');
    try {
      const fileId = await findFile();
      if (!fileId) return null;
      const data = await readFile(fileId);
      return data;
    } catch (e) {
      console.error('Pull from Drive failed:', e);
      throw e;
    }
  }

  // Push data to Drive
  async function pushToDrive(data) {
    setStatus('syncing');
    try {
      const fileId = await findFile();
      if (fileId) {
        await updateFile(fileId, data);
      } else {
        await createFile(data);
      }
      setStatus('synced');
    } catch (e) {
      console.error('Push to Drive failed:', e);
      setStatus('error');
      throw e;
    }
  }

  // Debounced push
  function schedulePush(data) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushToDrive(data).catch(() => {});
    }, SYNC_DEBOUNCE_MS);
  }

  function stopSync() {
    clearTimeout(syncTimer);
    driveFileId = null;
    setStatus('idle');
  }

  // Merge local and remote data — most recent lastModified wins per document
  function mergeData(localIndex, localDocs, remoteData) {
    const remoteIndex = remoteData.index || [];
    const remoteDocs = remoteData.documents || {};

    // Build maps keyed by doc ID
    const localMap = {};
    for (const doc of localIndex) {
      localMap[doc.id] = { meta: doc, md: localDocs[doc.id] || '' };
    }
    const remoteMap = {};
    for (const doc of remoteIndex) {
      remoteMap[doc.id] = { meta: doc, md: remoteDocs[doc.id] || '' };
    }

    // Union of all IDs
    const allIds = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);
    const mergedIndex = [];
    const mergedDocs = {};

    for (const id of allIds) {
      const local = localMap[id];
      const remote = remoteMap[id];

      if (local && remote) {
        // Both exist — keep the one with later lastModified
        const localTime = local.meta.lastModified || '';
        const remoteTime = remote.meta.lastModified || '';
        if (remoteTime > localTime) {
          mergedIndex.push(remote.meta);
          mergedDocs[id] = remote.md;
        } else {
          mergedIndex.push(local.meta);
          mergedDocs[id] = local.md;
        }
      } else if (local) {
        mergedIndex.push(local.meta);
        mergedDocs[id] = local.md;
      } else {
        mergedIndex.push(remote.meta);
        mergedDocs[id] = remote.md;
      }
    }

    return { index: mergedIndex, documents: mergedDocs };
  }

  return { init, pullFromDrive, pushToDrive, schedulePush, stopSync, mergeData };
})();
