import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
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
  const [groupId, setGroupId] = useState('');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));
  const [color, setColor] = useState(TASK_COLORS[0].value);
  const [isTemplate, setIsTemplate] = useState(false); // <-- New State for the toggle
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen && !groupId && groups.length > 0) {
      setGroupId(groups[0].id);
    }
  }, [isOpen, groups, groupId]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !groupId) return;

    setIsSubmitting(true);
    try {
      if (isTemplate) {
        // Save to Task Bank (No dates)
        await addDoc(collection(db, 'taskTemplates'), {
          title: title.trim(),
          group: groupId,
          color: color,
          createdAt: Date.now()
        });
      } else {
        // Pin to Master Timeline (With dates)
        await addDoc(collection(db, 'timelineItems'), {
          title: title.trim(),
          group: groupId,
          start_time: dayjs(startDate).valueOf(),
          end_time: dayjs(endDate).valueOf(),
          color: color
        });
      }
      
      // Reset form and close
      setTitle('');
      setIsTemplate(false);
      setStartDate(dayjs().format('YYYY-MM-DD'));
      setEndDate(dayjs().add(3, 'day').format('YYYY-MM-DD'));
      onClose();
    } catch (error) {
      console.error("Error adding task: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">Add New Task</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="task-form" onSubmit={handleAddTask} className="flex flex-col gap-5">
            
            {/* Template Toggle */}
            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
              <input 
                type="checkbox" 
                id="templateToggle"
                checked={isTemplate}
                onChange={(e) => setIsTemplate(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="templateToggle" className="text-sm font-medium text-blue-900 cursor-pointer">
                Save to Task Bank for Students
                <p className="text-xs text-blue-700 font-normal">Task will be saved without dates for students to claim later.</p>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none" 
                required 
                placeholder="e.g. Requirement Gathering"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phase / Group</label>
              <select 
                value={groupId} 
                onChange={e => setGroupId(e.target.value)} 
                className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                {groups.length === 0 && <option value="">No groups available</option>}
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>

            {/* Conditionally hide dates if it's a template */}
            {!isTemplate && (
              <div className="grid grid-cols-2 gap-4 transition-all">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none" 
                    required={!isTemplate}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500 outline-none" 
                    required={!isTemplate}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-2">
                {TASK_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c.value ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="task-form"
            disabled={isSubmitting || groups.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {isSubmitting ? 'Saving...' : (isTemplate ? 'Save to Bank' : 'Pin to Timeline')}
          </button>
        </div>
      </div>
    </>
  );
};

export default TaskPanel;