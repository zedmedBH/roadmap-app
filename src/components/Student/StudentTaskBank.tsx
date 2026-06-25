// src/components/Student/StudentTaskBank.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, onSnapshot, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import dayjs from 'dayjs';

interface TaskTemplate {
  id: string;
  title: string;
  color: string;
  taskType?: 'team' | 'individual';
  subtasks?: string[];
  isBroadcasted?: boolean;
}

const StudentTaskBank: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [claimedTemplateIds, setClaimedTemplateIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      if (!user) return;

      setLoading(true);

      // 1. Real-time listener for Task Templates
      const qTemplates = query(collection(db, 'taskTemplates'));
      const unsubscribeTemplates = onSnapshot(qTemplates, (snap) => {
        const fetchedTemplates = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as TaskTemplate[];
        
        setTemplates(fetchedTemplates.filter(t => !t.isBroadcasted));
        
        setLoading(false);
      }, (error) => {
        console.error("Error listening to task bank:", error);
        setLoading(false);
      });

      // 2. Real-time listener for Claimed Items
      const qItems = query(collection(db, 'timelineItems'));
      const unsubscribeItems = onSnapshot(qItems, (snap) => {
        const ids = new Set<string>();
        const activeGroupId = user.groupId || 'unassigned-team'; 
        
        snap.forEach(document => {
          const data = document.data();
          if (data.templateId && !data.unclaimed) {
            if (data.taskType === 'team' && data.teamId === activeGroupId) {
              ids.add(data.templateId);
            } else if (data.taskType === 'individual' && data.userId === user.id) {
              ids.add(data.templateId);
            }
          }
        });
        setClaimedTemplateIds(ids);
      });

      return () => {
        unsubscribeTemplates();
        unsubscribeItems();
      };
    }, [user]);

  const handleClaimTask = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !user) return;

    setIsSubmitting(true);
    try {
      const activeGroupId = user.groupId || 'unassigned-team';
      const assignedGroupRow = selectedTemplate.taskType === 'individual' 
        ? user.id 
        : activeGroupId;

      const existingSnap = await getDocs(query(collection(db, 'timelineItems'), where('templateId', '==', selectedTemplate.id)));
      let existingTaskDoc: any = null;
      
      existingSnap.forEach(d => {
        const data = d.data();
        if (selectedTemplate.taskType === 'team' && data.teamId === activeGroupId) {
          existingTaskDoc = d;
        } else if (selectedTemplate.taskType === 'individual' && data.userId === user.id) {
          existingTaskDoc = d;
        }
      });

      if (existingTaskDoc) {
        // RECLAIM
        await updateDoc(doc(db, 'timelineItems', existingTaskDoc.id), {
          unclaimed: false,
          start_time: dayjs(startDate).valueOf(),
          end_time: dayjs(endDate).valueOf(),
          group: assignedGroupRow
        });
      } else {
        // CREATE FRESH
        const docRef = await addDoc(collection(db, 'timelineItems'), {
          title: selectedTemplate.title,
          group: assignedGroupRow,
          color: selectedTemplate.color,
          start_time: dayjs(startDate).valueOf(),
          end_time: dayjs(endDate).valueOf(),
          userId: user.id, 
          teamId: activeGroupId,
          templateId: selectedTemplate.id,
          taskType: selectedTemplate.taskType || 'team',
          status: 'incomplete',
          unclaimed: false
        });

        if (selectedTemplate.subtasks && selectedTemplate.subtasks.length > 0) {
          const subTaskPromises = selectedTemplate.subtasks.map((stTitle, index) => 
            addDoc(collection(db, 'timelineItems', docRef.id, 'subtasks'), {
              title: stTitle,
              completed: false,
              createdAt: Date.now() + index // <-- Added + index here
            })
          );
          await Promise.all(subTaskPromises);
        }
      }

      setSelectedTemplate(null);
      setStartDate(dayjs().format('YYYY-MM-DD'));
      setEndDate(dayjs().add(3, 'day').format('YYYY-MM-DD'));
      
    } catch (error) {
      console.error("Error claiming task:", error);
      alert("Failed to claim task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">Loading Task Bank...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Task Bank</h2>
      <p className="text-gray-600 mb-6">Select tasks to add to your group's roadmap or your personal timeline.</p>

      {templates.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          No task templates available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => {
            const isClaimed = claimedTemplateIds.has(template.id);
            const isIndividual = template.taskType === 'individual';

            return (
              <div 
                key={template.id} 
                className={`border rounded-lg p-4 flex flex-col justify-between transition-shadow ${
                  isClaimed ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:shadow-lg cursor-pointer'
                }`}
                onClick={() => !isClaimed && setSelectedTemplate(template)}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: template.color || '#2196F3' }}/>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Template</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${isIndividual ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isIndividual ? '👤 Individual' : '👥 Team'}
                    </span>
                  </div>
                  <h3 className={`font-bold text-lg ${isClaimed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {template.title}
                  </h3>
                </div>
                
                {isClaimed ? (
                  <p className="mt-4 text-green-600 font-bold text-sm text-left flex items-center gap-1">✓ Claimed</p>
                ) : (
                  <button className="mt-4 text-blue-600 font-medium text-sm hover:underline text-left">
                    + Add to Timeline
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Claim Task</h3>
              <button onClick={() => setSelectedTemplate(null)} className="text-gray-500 hover:text-gray-800 text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleClaimTask} className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-gray-500">Task Title</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selectedTemplate.taskType === 'individual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {selectedTemplate.taskType === 'individual' ? 'Individual Task' : 'Team Task'}
                  </span>
                </div>
                <p className="font-bold text-gray-800 text-lg">{selectedTemplate.title}</p>
              </div>

              <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-600">
                This task will automatically be added to your {selectedTemplate.taskType === 'individual' ? <strong>Personal Row</strong> : <strong>Team's Row</strong>} on the roadmap.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" required />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedTemplate(null)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300">
                  {isSubmitting ? 'Adding...' : 'Add to Timeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTaskBank;