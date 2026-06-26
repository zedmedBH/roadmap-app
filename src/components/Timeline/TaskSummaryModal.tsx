// src/components/Timeline/TaskSummaryModal.tsx
import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
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
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);

  useEffect(() => {
    if (!isOpen || !task?.id) return;
    const subTasksRef = collection(db, 'timelineItems', task.id, 'subtasks');
    const q = query(subTasksRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SubTask[]);
    });

    return () => unsubscribe();
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const canEdit = user?.role === 'teacher' || 
                  task.userId === user?.id || 
                  (task.taskType === 'team' && task.teamId === user?.groupId);

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) return;

    // PRE-REQUISITE CHECK: Prevent completing if dependencies are not met
    if (newStatus === 'complete' && task.dependencies && task.dependencies.length > 0) {
      try {
        const depsQ = query(
          collection(db, 'timelineItems'),
          where('group', '==', task.group),
          where('templateId', 'in', task.dependencies)
        );
        const depsSnap = await getDocs(depsQ);
        
        const incompleteDeps = depsSnap.docs.filter(d => {
          const data = d.data();
          return data.status !== 'complete' && !data.unclaimed;
        });

        if (incompleteDeps.length > 0) {
          alert("Warning: You cannot complete this task until all prerequisite tasks are marked as 'complete'.");
          return;
        }
      } catch (err) {
        console.error("Dependency check failed:", err);
      }
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'timelineItems', task.id), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveTask = async () => {
    // DEPENDENCY CHECK: Prevent removal if something else depends on this
    try {
      const dependentQ = query(
        collection(db, 'timelineItems'),
        where('group', '==', task.group),
        where('dependencies', 'array-contains', task.templateId),
        where('unclaimed', '==', false)
      );
      const depSnap = await getDocs(dependentQ);
      
      if (!depSnap.empty) {
        alert("Action Blocked: Another task currently on your timeline requires this task as a prerequisite. Remove the dependent task first.");
        return;
      }

      if (window.confirm("Remove this task from the timeline? Your journal progress will be saved.")) {
        await updateDoc(doc(db, 'timelineItems', task.id), { unclaimed: true });
        onClose();
      }
    } catch (err) {
      console.error("Error checking dependents:", err);
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
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none self-start">&times;</button>
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

          {/* Sub-tasks Section (Read Only) */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Sub-tasks (Read Only)</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <ul className="divide-y divide-gray-100 bg-white">
                {subTasks.map((sub) => (
                  <li key={sub.id} className="p-3 flex items-center gap-3">
                    <span className={`flex-1 text-sm ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {sub.title}
                    </span>
                  </li>
                ))}
                {subTasks.length === 0 && (
                  <li className="p-3 text-sm text-gray-500 italic">No sub-tasks.</li>
                )}
              </ul>
            </div>
          </div>
          {/* Assessment Criteria (Read Only) */}
          {task.rubricStrands && task.rubricStrands.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Assessment Criteria</h4>
              <div className="space-y-3">
                {task.rubricStrands.map((r: any) => (
                  <div key={`${r.criterion}.${r.strand}`} className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2 border-b border-purple-100 pb-2">
                      <span className="font-bold text-purple-800">Criterion {r.criterion}.{r.strand}</span>
                      <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                        Max Band: {r.maxBand || 8}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium mb-3">{r.title}</p>
                    
                    <div className="space-y-2">
                      {r.bands.filter((b: any) => parseInt(b.levels.split('-')[1]) <= (r.maxBand || 8)).map((band: any) => (
                        <div key={band.levels} className="bg-white border border-purple-100 rounded p-2 flex gap-3">
                          <span className="font-bold text-purple-600 text-sm w-8 shrink-0">{band.levels}</span>
                          <span className="text-xs text-gray-600">{band.studentExemplar || band.officialDescriptor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center">
            <p className="text-sm text-blue-800">Ready to work on this task?</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium text-sm">
              Open Engineering Journal
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
          <div>
            {user?.role === 'teacher' ? (
              <p className="text-sm text-gray-500 font-medium italic pr-4">Edit globally via Master Task Management.</p>
            ) : canEdit && task.templateId && !task.broadcastId ? (
              <button 
                onClick={handleRemoveTask}
                className="px-4 py-2 text-orange-600 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors font-medium text-sm whitespace-nowrap"
              >
                Remove from Timeline
              </button>
            ) : null}
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium">Close</button>
        </div>
      </div>
    </div>
  );
};

export default TaskSummaryModal;