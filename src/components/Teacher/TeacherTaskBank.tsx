// src/components/Teacher/TeacherTaskBank.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import TaskPanel from '../Timeline/TaskPanel';
import type { TaskTemplate } from '../../types';

const TASK_COLORS = [
  { label: 'Blue Phase', value: '#2196F3' },
  { label: 'Green Phase', value: '#4CAF50' },
  { label: 'Orange Phase', value: '#FF9800' },
  { label: 'Purple Phase', value: '#9C27B0' },
  { label: 'Red Phase', value: '#F44336' },
];

const TeacherTaskBank: React.FC = () => {
  const { activeClassId, setActiveClassId, user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [groups, setGroups] = useState<{ id: string; title: string }[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Panel & Edit State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);

  // Fetch Templates
  useEffect(() => {
    const q = query(collection(db, 'taskTemplates'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskTemplate)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Classes for the dropdown
  useEffect(() => {
    if (user?.role !== 'teacher') return;
    const qClasses = query(collection(db, 'classes'), where('teacherId', '==', user.id));
    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      const fetchedClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(fetchedClasses);
    });
    return () => unsubscribeClasses();
  }, [user]);

  // Fetch groups so the TaskPanel can broadcast team tasks
  useEffect(() => {
    if (!activeClassId) return;
    const qGroups = query(collection(db, 'groups'), where('classId', '==', activeClassId));
    const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
      const fetchedGroups = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().name || 'Unnamed Group',
      }));
      setGroups(fetchedGroups);
    });
    return () => unsubscribeGroups();
  }, [activeClassId]);

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

  const toggleVisibility = async (template: TaskTemplate) => {
    if (!activeClassId) {
      alert("Please select a class from the dropdown above to toggle visibility.");
      return;
    }
    const visibleIn = template.visibleIn || [];
    const isVisible = visibleIn.includes(activeClassId);
    
    // If it's visible, remove the class ID. If hidden, add it.
    const newVisibleIn = isVisible 
      ? visibleIn.filter(id => id !== activeClassId)
      : [...visibleIn, activeClassId];

    try {
      await updateDoc(doc(db, 'taskTemplates', template.id), { visibleIn: newVisibleIn });
    } catch (err) {
      console.error("Error toggling visibility", err);
    }
  };

  const handleEditOpen = (task: TaskTemplate) => {
    setEditingTask(task);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setEditingTask(null);
    setIsPanelOpen(false);
  };

  // Group templates by color to match the Student Task Bank UI
  const groupedTemplates = TASK_COLORS.map(colorObj => {
    const colorTemplates = templates.filter(t => (t.color || '#2196F3') === colorObj.value);
    return { ...colorObj, templates: colorTemplates };
  }).filter(group => group.templates.length > 0);

  if (loading) return <div className="p-6">Loading Master Task Bank...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Master Task Management</h2>
          <p className="text-gray-600 text-sm">Manage all Tasks and Templates here. Edits and deletions will cascade globally.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {classes.length > 0 && (
            <select
              value={activeClassId || ''}
              onChange={(e) => setActiveClassId(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 font-bold outline-none flex-1"
            >
              <option value="" disabled>-- Select a Class --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.term})
                </option>
              ))}
            </select>
          )}
          <button 
            onClick={() => {
              setEditingTask(null);
              setIsPanelOpen(true);
            }} 
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition font-medium whitespace-nowrap"
          >
            + Add Task
          </button>
        </div>
      </div>

      {groupedTemplates.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          No tasks have been created yet.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTemplates.map(group => (
            <div key={group.value}>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: group.value }}>
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: group.value }}></span>
                {group.label}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.templates.map(template => {
                  const isIndividual = template.taskType === 'individual';
                  
                  return (
                    <div key={template.id} className="border rounded-lg p-4 bg-white flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border-gray-200">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          {/* Left side: Color marker + Template Status */}
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: template.color || '#2196F3' }}></span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                              {template.isBroadcasted ? 'Broadcasted' : 'Bank Template'}
                            </span>
                          </div>
                          
                          {/* Right side: Visibility + Task Type */}
                          <div className="flex items-center gap-2">
                            {!template.isBroadcasted && (
                              <button 
                                onClick={() => toggleVisibility(template)}
                                className={`text-xs px-2 py-1 rounded-full font-semibold transition ${template.visibleIn?.includes(activeClassId!) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                                title="Toggle visibility for the selected class"
                              >
                                👁️ {template.visibleIn?.includes(activeClassId!) ? 'Visible' : 'Hidden'}
                              </button>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${isIndividual ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {isIndividual ? '👤 Individual' : '👥 Team'}
                            </span>
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-lg mb-2 text-gray-800">{template.title}</h4>
                        
                        {template.dependencies && template.dependencies.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-1">
                            <strong>Prerequisites:</strong>
                            {template.dependencies.map(depId => {
                              const depTitle = templates.find(t => t.id === depId)?.title || 'Unknown Task';
                              return <span key={depId} className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{depTitle}</span>;
                            })}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-4">
                        <button onClick={() => handleEditOpen(template)} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(template.id)} className="text-sm font-medium text-red-500 hover:text-red-700 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskPanel 
        isOpen={isPanelOpen} 
        onClose={handleClosePanel} 
        groups={groups} 
        editTask={editingTask} 
      />

    </div>
  );
};

export default TeacherTaskBank;