// src/components/Timeline/TaskPanel.tsx
import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import dayjs from 'dayjs';

interface TaskPanelProps {
  isOpen: boolean;
  onClose: () => void;
  groups: { id: string; title: string }[];
}

const TASK_COLORS = [
  { label: 'Blue (Default)', value: '#2196F3' },
  { label: 'Green (Success)', value: '#4CAF50' },
  { label: 'Orange (Warning)', value: '#FF9800' },
  { label: 'Purple (Feature)', value: '#9C27B0' },
  { label: 'Red (Urgent)', value: '#F44336' },
];

const TaskPanel: React.FC<TaskPanelProps> = ({ isOpen, onClose, groups }) => {
  const [title, setTitle] = useState('');
  const [isTemplate, setIsTemplate] = useState(true); 
  const [taskType, setTaskType] = useState<'team' | 'individual'>('team');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));
  const [color, setColor] = useState(TASK_COLORS[0].value);
  
  // New State for Sub-Tasks
  const [subTasks, setSubTasks] = useState<string[]>([]);
  const [newSubTask, setNewSubTask] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubTask = () => {
    if (newSubTask.trim()) {
      setSubTasks([...subTasks, newSubTask.trim()]);
      setNewSubTask('');
    }
  };

  const handleRemoveSubTask = (index: number) => {
    setSubTasks(subTasks.filter((_, i) => i !== index));
  };

  const handleAddTask = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // --- NEW: Catch any lingering text in the input field! ---
    const finalSubTasks = [...subTasks];
    if (newSubTask.trim()) {
      finalSubTasks.push(newSubTask.trim());
    }

    setIsSubmitting(true);
    try {
      if (isTemplate) {
        await addDoc(collection(db, 'taskTemplates'), {
          title: title.trim(),
          color: color,
          taskType: taskType,
          subtasks: finalSubTasks, // Use the finalized array
          createdAt: Date.now()
        });
      } else {
        const broadcastId = Date.now().toString();

        const baseTaskData = {
          title: title.trim(),
          start_time: dayjs(startDate).valueOf(),
          end_time: dayjs(endDate).valueOf(),
          color: color,
          taskType: taskType,
          status: 'incomplete',
          broadcastId: broadcastId,
        };

        const targetGroups = taskType === 'team' 
          ? groups.map(g => ({ group: g.id, teamId: g.id, userId: null }))
          : (await getDocs(query(collection(db, 'users'), where('role', '==', 'student')))).docs.map(d => ({ group: d.id, userId: d.id, teamId: d.data().groupId || null }));

        for (const target of targetGroups) {
          const docRef = await addDoc(collection(db, 'timelineItems'), {
            ...baseTaskData,
            ...target
          });

          // Use the finalized array here too
          if (finalSubTasks.length > 0) {
            const subTaskPromises = finalSubTasks.map((st, index) => 
              addDoc(collection(db, 'timelineItems', docRef.id, 'subtasks'), {
                title: st,
                completed: false,
                // Add index to guarantee unique ordering
                createdAt: Date.now() + index 
              })
            );
            await Promise.all(subTaskPromises);
          }
        }
      }
      
      // Reset form
      setTitle('');
      setIsTemplate(true);
      setTaskType('team');
      setStartDate(dayjs().format('YYYY-MM-DD'));
      setEndDate(dayjs().add(3, 'day').format('YYYY-MM-DD'));
      setSubTasks([]);
      setNewSubTask(''); // Don't forget to clear the input!
      onClose();
    } catch (error) {
      console.error("Error adding task: ", error);
      alert("Failed to create task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-30 z-[9998] transition-opacity" onClick={onClose} />}

      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">Add New Task</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="task-form" onSubmit={handleAddTask} className="flex flex-col gap-6">
            
            {/* DESTINATION SELECTION */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">1. Destination</p>
              <div className="flex flex-col gap-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isTemplate ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" checked={isTemplate} onChange={() => setIsTemplate(true)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Save to Task Bank</p>
                    <p className="text-xs text-gray-500">Students will claim this and set their own dates.</p>
                  </div>
                </label>
                
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!isTemplate ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" checked={!isTemplate} onChange={() => setIsTemplate(false)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Push to Timelines</p>
                    <p className="text-xs text-gray-500">Immediately broadcasts to everyone.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* TASK TYPE SELECTION */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">2. Assignment Type</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={taskType === 'team'} onChange={() => setTaskType('team')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-800">Team Task</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={taskType === 'individual'} onChange={() => setTaskType('individual')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-800">Individual Task</span>
                </label>
              </div>
            </div>

            {/* TASK DETAILS */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none" required placeholder="e.g. Requirement Gathering" />
              </div>
              
              {!isTemplate && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none" required={!isTemplate} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none" required={!isTemplate} />
                  </div>
                </div>
              )}

              {/* NEW: SUB-TASKS SECTION */}
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Initial Sub-Tasks</label>
                <ul className="space-y-2 mb-3">
                  {subTasks.map((st, i) => (
                    <li key={i} className="flex justify-between items-center text-sm bg-white border border-gray-200 px-2 py-1.5 rounded">
                      <span>{st}</span>
                      <button type="button" onClick={() => handleRemoveSubTask(i)} className="text-red-500 hover:text-red-700 font-bold px-1">&times;</button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newSubTask} 
                    onChange={e => setNewSubTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubTask(); } }}
                    placeholder="Add a sub-task..." 
                    className="flex-1 border border-gray-300 p-1.5 text-sm rounded outline-none focus:border-blue-500" 
                  />
                  <button type="button" onClick={handleAddSubTask} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-300">+</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color Marker</label>
                <div className="flex gap-2">
                  {TASK_COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => setColor(c.value)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c.value ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                </div>
              </div>
            </div>
            
          </form>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" form="task-form" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors font-medium">
            {isSubmitting ? 'Saving...' : (isTemplate ? 'Add to Bank' : 'Broadcast Task')}
          </button>
        </div>
      </div>
    </>
  );
};

export default TaskPanel;