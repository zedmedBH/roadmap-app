import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import type { CourseResource } from '../../types';

const TeacherResourceBank: React.FC = () => {
  const { user, activeClassId } = useAuth();
  const [resources, setResources] = useState<CourseResource[]>([]);
  
  // Form State
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    const q = query(collection(db, 'courseResources'), where('teacherId', '==', user.id));
    const unsub = onSnapshot(q, (snap) => {
      // Sort to show newest first, or you can sort alphabetically
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseResource));
      fetched.sort((a, b) => b.createdAt - a.createdAt);
      setResources(fetched);
    });
    return () => unsub();
  }, [user]);

  const resetForm = () => {
    setEditingResourceId(null);
    setTitle('');
    setDescription('');
    setUrl('');
  };

  const handleEdit = (resource: CourseResource) => {
    setEditingResourceId(resource.id!);
    setTitle(resource.title);
    setDescription(resource.description);
    setUrl(resource.url);
    // Smooth scroll to the top where the form is
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveResource = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !url.trim()) return;
    setIsSubmitting(true);
    
    try {
      if (editingResourceId) {
        // Update existing resource
        await updateDoc(doc(db, 'courseResources', editingResourceId), {
          title: title.trim(),
          description: description.trim(),
          url: url.trim(),
        });
      } else {
        // Create new resource
        await addDoc(collection(db, 'courseResources'), {
          teacherId: user.id,
          title: title.trim(),
          description: description.trim(),
          url: url.trim(),
          resourceType: 'link',
          visibleIn: activeClassId ? [activeClassId] : [],
          createdAt: Date.now()
        });
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Failed to save resource.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVisibility = async (resource: CourseResource) => {
    if (!activeClassId) return alert("Select a class first.");
    const visibleIn = resource.visibleIn || [];
    const newVisibleIn = visibleIn.includes(activeClassId) 
      ? visibleIn.filter(id => id !== activeClassId) 
      : [...visibleIn, activeClassId];
    await updateDoc(doc(db, 'courseResources', resource.id!), { visibleIn: newVisibleIn });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this resource globally?")) {
      await deleteDoc(doc(db, 'courseResources', id));
      if (editingResourceId === id) resetForm();
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Class Resources Bank</h2>
        {editingResourceId && (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
            Edit Mode
          </span>
        )}
      </div>
      
      <form onSubmit={handleSaveResource} className={`mb-8 p-4 rounded-lg border ${editingResourceId ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Resource Title" value={title} onChange={e => setTitle(e.target.value)} className="p-2 border border-gray-300 rounded outline-none focus:border-blue-500 bg-white" required />
          <input type="url" placeholder="URL (Google Drive, YouTube, etc.)" value={url} onChange={e => setUrl(e.target.value)} className="p-2 border border-gray-300 rounded outline-none focus:border-blue-500 bg-white" required />
        </div>
        <textarea placeholder="Brief description..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border border-gray-300 rounded mb-4 min-h-[80px] outline-none focus:border-blue-500 bg-white" />
        
        <div className="flex gap-3">
          <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {isSubmitting ? 'Saving...' : (editingResourceId ? 'Update Resource' : '+ Add Resource')}
          </button>
          {editingResourceId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 font-medium transition">
              Cancel
            </button>
          )}
        </div>
      </form>

      {resources.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">No resources added yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resources.map(res => (
            <div key={res.id} className={`border p-4 rounded-lg flex flex-col justify-between shadow-sm transition-all ${editingResourceId === res.id ? 'border-yellow-400 bg-yellow-50/30 ring-2 ring-yellow-100' : 'border-gray-200 bg-white'}`}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-800">{res.title}</h3>
                  <button onClick={() => toggleVisibility(res)} className={`text-xs px-2 py-1 rounded-full font-bold transition ${res.visibleIn.includes(activeClassId!) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {res.visibleIn.includes(activeClassId!) ? 'Visible to Class' : 'Hidden'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-2">{res.description}</p>
                <a href={res.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline block truncate mb-4 font-medium">{res.url}</a>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
                <button onClick={() => handleEdit(res)} className="text-blue-600 text-sm font-medium hover:text-blue-800 transition">Edit</button>
                <button onClick={() => handleDelete(res.id!)} className="text-red-500 text-sm font-medium hover:text-red-700 transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherResourceBank;