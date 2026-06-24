// src/components/Timeline/TaskSummaryModal.tsx
import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

interface TaskSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any | null;
}

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

const STATUS_OPTIONS = ['incomplete', 'in-progress', 'complete'];

const TaskSummaryModal: React.FC<TaskSummaryModalProps> = ({ isOpen, onClose, task }) => {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Sub-task states
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [isAddingSubTask, setIsAddingSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

  // Listen for sub-tasks in real-time
  useEffect(() => {
    if (!isOpen || !task?.id) return;

    const subTasksRef = collection(db, 'timelineItems', task.id, 'subtasks');
    const q = query(subTasksRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSubs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SubTask[];
      setSubTasks(fetchedSubs);
    });

    return () => unsubscribe();
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  // Determine if the current user has permission to edit the task/sub-tasks
  const canEdit = user?.role === 'teacher' || 
                  task.userId === user?.id || 
                  (task.taskType === 'team' && task.teamId === user?.groupId);

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) return;
    setIsUpdating(true);
    try {
      const taskRef = doc(db, 'timelineItems', task.id);
      await updateDoc(taskRef, { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddSubTask = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!canEdit || !newSubTaskTitle.trim()) return;

    try {
      await addDoc(collection(db, 'timelineItems', task.id, 'subtasks'), {
        title: newSubTaskTitle.trim(),
        completed: false,
        createdAt: Date.now()
      });
      setNewSubTaskTitle('');
      setIsAddingSubTask(false);
    } catch (error) {
      console.error("Error adding sub-task:", error);
    }
  };

  const handleToggleSubTask = async (subTaskId: string, currentStatus: boolean) => {
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, 'timelineItems', task.id, 'subtasks', subTaskId), {
        completed: !currentStatus
      });
    } catch (error) {
      console.error("Error toggling sub-task:", error);
    }
  };

  const handleDeleteSubTask = async (subTaskId: string) => {
    if (!canEdit) return;
    try {
      await deleteDoc(doc(db, 'timelineItems', task.id, 'subtasks', subTaskId));
    } catch (error) {
      console.error("Error deleting sub-task:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center" style={{ borderTop: `4px solid ${task.itemProps?.style?.background || '#2196F3'}` }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${task.taskType === 'individual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {task.taskType === 'individual' ? 'Individual Task' : 'Team Task'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-gray-800">{task.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none self-start">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          
          {/* Status Toggle */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Overall Status</h4>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  disabled={!canEdit || isUpdating}
                  onClick={() => handleStatusChange(status)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                    (task.status || 'incomplete') === status 
                      ? 'bg-white shadow-sm text-blue-600 border border-gray-200' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                  } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {status.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-tasks Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Sub-tasks</h4>
              {canEdit && !isAddingSubTask && (
                <button 
                  onClick={() => setIsAddingSubTask(true)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  + Add Sub-task
                </button>
              )}
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {subTasks.length === 0 && !isAddingSubTask ? (
                <div className="p-4 text-center text-sm text-gray-500 italic bg-white">
                  No sub-tasks created yet. Break down this task into smaller steps!
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 bg-white">
                  {subTasks.map((sub) => (
                    <li key={sub.id} className="p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={sub.completed}
                        onChange={() => handleToggleSubTask(sub.id, sub.completed)}
                        disabled={!canEdit}
                        className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className={`flex-1 text-sm ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {sub.title}
                      </span>
                      {canEdit && (
                        <button 
                          onClick={() => handleDeleteSubTask(sub.id)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                          title="Delete sub-task"
                        >
                          &times;
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add Sub-task Form */}
              {isAddingSubTask && (
                <form onSubmit={handleAddSubTask} className="p-3 bg-blue-50 border-t border-blue-100">
                  <input 
                    type="text" 
                    value={newSubTaskTitle}
                    onChange={(e) => setNewSubTaskTitle(e.target.value)}
                    placeholder="Describe the step..."
                    className="w-full text-sm p-2 border border-blue-200 rounded focus:ring-blue-500 focus:border-blue-500 mb-2 outline-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      type="button" 
                      onClick={() => { setIsAddingSubTask(false); setNewSubTaskTitle(''); }}
                      className="text-xs px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={!newSubTaskTitle.trim()}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
          <div>
            {user?.role === 'teacher' ? (
              <button 
                onClick={async () => {
                  if (window.confirm("Are you sure you want to delete this task? If it was broadcasted, it will be removed for everyone.")) {
                    setIsUpdating(true);
                    try {
                      const tasksToDelete = [];
                      
                      // 1. Gather all tasks that need to be deleted
                      if (task.broadcastId) {
                        // Find all copies of the broadcasted task
                        const q = query(collection(db, 'timelineItems'), where('broadcastId', '==', task.broadcastId));
                        const snap = await getDocs(q);
                        snap.forEach(d => tasksToDelete.push(d));
                      } else {
                        // Just this single task
                        const snap = await getDoc(doc(db, 'timelineItems', task.id));
                        if (snap.exists()) tasksToDelete.push(snap);
                      }

                      // 2. Eradicate them and their subtasks
                      for (const tDoc of tasksToDelete) {
                        // Delete subtasks first to prevent orphaning
                        const subQ = query(collection(db, 'timelineItems', tDoc.id, 'subtasks'));
                        const subSnap = await getDocs(subQ);
                        const deleteSubPromises = subSnap.docs.map(subDoc => deleteDoc(doc(db, 'timelineItems', tDoc.id, 'subtasks', subDoc.id)));
                        await Promise.all(deleteSubPromises);
                        
                        // Delete the main task document
                        await deleteDoc(doc(db, 'timelineItems', tDoc.id));
                      }
                      
                      onClose();
                    } catch (err) {
                      console.error("Error deleting task:", err);
                    } finally {
                      setIsUpdating(false);
                    }
                  }
                }}
                className="px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors font-medium text-sm"
              >
                Delete Permanently
              </button>
            ) : canEdit && task.templateId ? (
              <button 
                onClick={async () => {
                  if (window.confirm("Remove this task from the timeline? Your sub-task progress will be saved in the Task Bank.")) {
                    try {
                      // Soft Delete: Sets unclaimed to true
                      await updateDoc(doc(db, 'timelineItems', task.id), {
                        unclaimed: true
                      });
                      onClose();
                    } catch (err) {
                      console.error("Error unclaiming task:", err);
                    }
                  }
                }}
                className="px-4 py-2 text-orange-600 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors font-medium text-sm"
              >
                Remove from Timeline
              </button>
            ) : null}
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default TaskSummaryModal;