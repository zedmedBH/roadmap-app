// src/components/Teacher/TeacherSettings.tsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { createDriveFolder } from '../../utils/driveUpload';

const TeacherSettings: React.FC = () => {
  const { user } = useAuth();
  const [masterFolderId, setMasterFolderId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load the existing folder ID when the component mounts
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.id) {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists() && userDoc.data().masterFolderId) {
          setMasterFolderId(userDoc.data().masterFolderId);
        }
      }
    };
    loadSettings();
  }, [user?.id]);

  const handleSaveMasterFolder = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user?.id || !masterFolderId.trim()) return;

    setIsSaving(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        masterFolderId: masterFolderId.trim()
      });
      setMessage({ text: 'Master Folder ID saved successfully!', type: 'success' });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ text: 'Failed to save settings.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateClassFolder = async () => {
    if (!masterFolderId) {
      setMessage({ text: 'Please save a Master Folder ID first.', type: 'error' });
      return;
    }
    
    try {
      setMessage({ text: 'Creating folder in Google Drive...', type: 'success' });
      const newFolderId = await createDriveFolder('Class of 2026 - Submissions', masterFolderId);
      
      // For now, we'll just save this directly to the teacher's profile as the active class folder
      // Later, this will be saved to a specific 'classes' document
      await updateDoc(doc(db, 'users', user!.id), {
        activeClassFolderId: newFolderId
      });
      
      setMessage({ text: `Success! Created class subfolder. ID: ${newFolderId}`, type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Google Drive Settings</h2>
      <p className="text-sm text-gray-600 mb-4">
        1. Create a folder in your Google Drive named "MYP Submissions Master".<br/>
        2. Set the sharing permissions to "Anyone with the link can edit" (or restrict it to your domain).<br/>
        3. Copy the Folder ID from the URL (the random letters/numbers after <code className="bg-gray-100 px-1 rounded">/folders/</code>) and paste it below.
      </p>

      <form onSubmit={handleSaveMasterFolder} className="flex gap-4 items-end mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Master Folder ID</label>
          <input 
            type="text" 
            value={masterFolderId}
            onChange={(e) => setMasterFolderId(e.target.value)}
            placeholder="e.g., 1A2b3C4d5E6f7G8h9I0jKLMNO"
            className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={isSaving}
          className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:bg-blue-300 transition"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="font-semibold text-gray-800 mb-2">Class Folder Generation</h3>
        <p className="text-sm text-gray-600 mb-3">
          Once your Master Folder is linked, click here to automatically generate a subfolder for your active class. Students will upload their files here.
        </p>
        <button 
          onClick={handleGenerateClassFolder}
          className="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-2 rounded font-medium hover:bg-gray-200 transition"
        >
          Generate Subfolder for Current Class
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default TeacherSettings;