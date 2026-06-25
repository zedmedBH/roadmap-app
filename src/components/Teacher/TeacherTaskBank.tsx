// src/components/Teacher/TeacherTaskBank.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface TaskTemplate {
  id: string;
  title: string;
  color: string;
  taskType: 'team' | 'individual';
  isBroadcasted?: boolean;
}

const TASK_COLORS = [
  { label: 'Blue (Default)', value: '#2196F3' },
  { label: 'Green (Success)', value: '#4CAF50' },
  { label: 'Orange (Warning)', value: '#FF9800' },
  { label: 'Purple (Feature)', value: '#9C27B0' },
  { label: 'Red (Urgent)', value: '#F44336' },
];

const TeacherTaskBank: React.FC = () => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'taskTemplates'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskTemplate)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (templateId: string) => {
    if (!window.confirm("Are you sure you want to delete this master task? It will be permanently removed from ALL student timelines and the Task Bank.")) return;

    try {
      // 1. Delete the Master Template
      await deleteDoc(doc(db, 'taskTemplates', templateId));

      // 2. Find and eradicate all timeline copies and their subtasks
      const q = query(collection(db, 'timelineItems'), where('templateId', '==', templateId));
      const snap = await getDocs(q);

      for (const tDoc of snap.docs) {
        // Delete subtasks first to prevent orphaning
        const subQ = query(collection(db, 'timelineItems', tDoc.id, 'subtasks'));
        const subSnap = await getDocs(subQ);
        const deleteSubPromises = subSnap.docs.map(subDoc => deleteDoc(doc(db, 'timelineItems', tDoc.id, 'subtasks', subDoc.id)));
        await Promise.all(deleteSubPromises);

        // Delete the main timeline item
        await deleteDoc(doc(db, 'timelineItems', tDoc.id));
      }
    } catch (err) {
      console.error("Error deleting master task", err);
      alert("An error occurred while deleting.");
    }
  };

  const handleEditOpen = (task: TaskTemplate) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditColor(task.color || '#2196F3');
  };

  const handleEditSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    setIsUpdating(true);
    try {
      // 1. Update the Master Template
      await updateDoc(doc(db, 'taskTemplates', editingTask.id), {
        title: editTitle.trim(),
        color: editColor
      });

      // 2. Cascade the update to all timeline copies
      const q = query(collection(db, 'timelineItems'), where('templateId', '==', editingTask.id));
      const snap = await getDocs(q);

      const updatePromises = snap.docs.map(tDoc =>
        updateDoc(doc(db, 'timelineItems', tDoc.id), {
          title: editTitle.trim(),
          color: editColor
        })
      );
      await Promise.all(updatePromises);

      setEditingTask(null);
    } catch (err) {
      console.error("Error updating master task", err);
      alert("An error occurred while saving.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="p-6">Loading Master Task Bank...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Master Task Management</h2>
      <p className="text-gray-600 mb-6">Manage all Tasks and Templates here. Edits and deletions will cascade globally to all connected student timelines.</p>

      {templates.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          No tasks have been created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div key={template.id} className="border border-gray-200 rounded-lg p-4 bg-white flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: template.color || '#2196F3' }}/>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {template.isBroadcasted ? 'Broadcasted' : 'Bank Template'}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${template.taskType === 'individual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {template.taskType === 'individual' ? '👤 Individual' : '👥 Team'}
                  </span>
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-4">{template.title}</h3>
              </div>
              
              <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                <button onClick={() => handleEditOpen(template)} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition">
                  Edit
                </button>
                <button onClick={() => handleDelete(template.id)} className="text-sm font-medium text-red-500 hover:text-red-700 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Edit Master Task</h3>
              <button onClick={() => setEditingTask(null)} className="text-gray-500 hover:text-gray-800 text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleEditSave} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color Marker</label>
                <div className="flex gap-2">
                  {TASK_COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => setEditColor(c.value)} className={`w-8 h-8 rounded-full border-2 transition-all ${editColor === c.value ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                <button type="button" onClick={() => setEditingTask(null)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={isUpdating} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition">
                  {isUpdating ? 'Saving...' : 'Save & Cascade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherTaskBank;