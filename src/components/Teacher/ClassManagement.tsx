import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { createDriveFolder } from '../../utils/driveUpload';

interface SchoolClass {
  id: string;
  name: string;
  term: string;
  teacherId: string;
  driveFolderId?: string;
}

const ClassManagement: React.FC = () => {
  const { user, setActiveClassId } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    const q = query(collection(db, 'classes'), where('teacherId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedClasses = snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolClass));
      setClasses(fetchedClasses);
    });
    return () => unsubscribe();
  }, [user?.role, user?.id]); // Removed activeClassId from array

  const handleCreateClass = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user?.id || !newClassName.trim() || !newTerm.trim()) return;
    setIsCreating(true);
    try {
      // 1. Get the Teacher's Master Folder ID
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const masterFolderId = userDoc.data()?.masterFolderId;

      if (!masterFolderId) {
        alert("Please set your Master Folder ID in the settings first!");
        setIsCreating(false);
        return;
      }

      // 2. Create the folder in Google Drive
      const folderName = `${newClassName.trim()} - ${newTerm.trim()}`;
      const newDriveFolderId = await createDriveFolder(folderName, masterFolderId);

      // 3. Save the new class to Firestore
      const newClassRef = await addDoc(collection(db, 'classes'), {
        name: newClassName.trim(),
        term: newTerm.trim(),
        teacherId: user.id,
        driveFolderId: newDriveFolderId
      });

      setActiveClassId(newClassRef.id);
      setNewClassName('');
      setNewTerm('');
    } catch (error) {
      console.error("Error creating class:", error);
      alert("Failed to create class. Check console for details.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Class Management</h2>
        
      </div>

      <form onSubmit={handleCreateClass} className="flex gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
          <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="e.g. Grade 10 Design" className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 outline-none" required />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Term/Year</label>
          <input type="text" value={newTerm} onChange={e => setNewTerm(e.target.value)} placeholder="e.g. Fall 2026" className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 outline-none" required />
        </div>
        <button type="submit" disabled={isCreating} className="bg-green-600 text-white px-6 py-2 rounded font-medium hover:bg-green-700 disabled:bg-green-300 transition whitespace-nowrap">
          {isCreating ? 'Creating...' : '+ Add Class & Drive Folder'}
        </button>
      </form>
    </div>
  );
};

export default ClassManagement;