import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const TeacherSettings: React.FC = () => {
  const { user } = useAuth();
  const [masterFolderId, setMasterFolderId] = useState('');
  const [savedFolderId, setSavedFolderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load the existing folder ID when the component mounts
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.id) {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists() && userDoc.data().masterFolderId) {
          setMasterFolderId(userDoc.data().masterFolderId);
          setSavedFolderId(userDoc.data().masterFolderId); // Track the verified DB value
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
      setSavedFolderId(masterFolderId.trim()); // Update verified value on success
      setMessage({ text: 'Master Folder ID saved successfully!', type: 'success' });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ text: 'Failed to save settings.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Google Drive Settings</h2>
          <p className="text-sm text-gray-600">
            1. Create a folder in your Google Drive named "MYP Submissions Master".<br/>
            2. Set the sharing permissions to "Anyone with the link can edit" (or restrict it to your domain).<br/>
            3. Copy the Folder ID from the URL (the random letters/numbers after <code className="bg-gray-100 px-1 rounded">/folders/</code>) and paste it below.
          </p>
        </div>
        
        {/* Verification Badge */}
        {savedFolderId && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex flex-col items-end whitespace-nowrap shadow-sm">
            <span className="font-bold flex items-center gap-2">
              <span className="text-green-600 text-lg leading-none">✓</span> Connected
            </span>
            <span className="font-mono text-xs text-green-600 mt-1" title={savedFolderId}>
              {savedFolderId.length > 15 ? `${savedFolderId.substring(0, 15)}...` : savedFolderId}
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveMasterFolder} className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Master Folder ID</label>
          <input 
            type="text" 
            value={masterFolderId}
            onChange={(e) => setMasterFolderId(e.target.value)}
            placeholder="e.g., 1A2b3C4d5E6f7G8h9I0jKLMNO"
            className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={isSaving || masterFolderId.trim() === savedFolderId}
          className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:bg-blue-300 transition"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
      
      {message && (
        <div className={`mt-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default TeacherSettings;