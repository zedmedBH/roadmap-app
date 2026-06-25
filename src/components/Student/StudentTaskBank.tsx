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
  dependencies?: string[];
}

const StudentTaskBank: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  // Store the actual claimed items so we can check their end dates
  const [claimedItemsMap, setClaimedItemsMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // 1. Listen for Task Templates
    const qTemplates = query(collection(db, 'taskTemplates'));
    const unsubscribeTemplates = onSnapshot(qTemplates, (snap) => {
      const fetchedTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() })) as TaskTemplate[];
      setTemplates(fetchedTemplates.filter(t => !t.isBroadcasted));
    });

    // 2. Listen for Claimed Items to track dependencies and end dates
    const qItems = query(collection(db, 'timelineItems'));
    const unsubscribeItems = onSnapshot(qItems, (snap) => {
      const activeGroupId = user.groupId || 'unassigned-team'; 
      const newMap = new Map<string, any>();
      
      snap.forEach(document => {
        const data = document.data();
        if (data.templateId && !data.unclaimed) {
          if ((data.taskType === 'team' && data.teamId === activeGroupId) || 
              (data.taskType === 'individual' && data.userId === user.id)) {
            newMap.set(data.templateId, data);
          }
        }
      });
      setClaimedItemsMap(newMap);
      setLoading(false);
    });

    return () => {
      unsubscribeTemplates();
      unsubscribeItems();
    };
  }, [user]);

  // Sort templates: Sequential order first, claimed tasks at the very bottom
  const sortedTemplates = [...templates].sort((a, b) => {
    const aClaimed = claimedItemsMap.has(a.id);
    const bClaimed = claimedItemsMap.has(b.id);
    
    if (aClaimed && !bClaimed) return 1;
    if (!aClaimed && bClaimed) return -1;

    // If a depends on b, b should come first
    if (a.dependencies?.includes(b.id)) return 1;
    if (b.dependencies?.includes(a.id)) return -1;
    
    return (a.dependencies?.length || 0) - (b.dependencies?.length || 0);
  });

  const handleOpenClaimModal = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    
    // Auto-calculate start date based on prerequisites
    let defaultStart = dayjs();
    if (template.dependencies && template.dependencies.length > 0) {
      let maxEndTime = 0;
      template.dependencies.forEach(depId => {
        const depItem = claimedItemsMap.get(depId);
        if (depItem && depItem.end_time > maxEndTime) {
          maxEndTime = depItem.end_time;
        }
      });
      
      if (maxEndTime > 0) {
        // Start the day after the prerequisite ends
        defaultStart = dayjs(maxEndTime).add(1, 'day'); 
      }
    }
    
    setStartDate(defaultStart.format('YYYY-MM-DD'));
    setEndDate(defaultStart.add(3, 'day').format('YYYY-MM-DD'));
  };

  const handleClaimTask = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !user) return;

    setIsSubmitting(true);
    try {
      const activeGroupId = user.groupId || 'unassigned-team';
      const assignedGroupRow = selectedTemplate.taskType === 'individual' ? user.id : activeGroupId;

      // Check if task exists but was previously unclaimed/removed
      const existingSnap = await getDocs(query(collection(db, 'timelineItems'), where('templateId', '==', selectedTemplate.id)));
      let existingTaskDoc: any = null;
      
      existingSnap.forEach(d => {
        const data = d.data();
        if ((selectedTemplate.taskType === 'team' && data.teamId === activeGroupId) || 
            (selectedTemplate.taskType === 'individual' && data.userId === user.id)) {
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
          dependencies: selectedTemplate.dependencies || [],
          status: 'incomplete',
          unclaimed: false
        });

        if (selectedTemplate.subtasks && selectedTemplate.subtasks.length > 0) {
          const subTaskPromises = selectedTemplate.subtasks.map((stTitle, index) => 
            addDoc(collection(db, 'timelineItems', docRef.id, 'subtasks'), {
              title: stTitle,
              completed: false,
              createdAt: Date.now() + index
            })
          );
          await Promise.all(subTaskPromises);
        }
      }

      setSelectedTemplate(null);
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
      <p className="text-gray-600 mb-6">Select tasks to add to your roadmap sequentially.</p>

      {sortedTemplates.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          No task templates available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTemplates.map(template => {
            const isClaimed = claimedItemsMap.has(template.id);
            const isIndividual = template.taskType === 'individual';
            
            // Check if prerequisites are met
            const unmetDependencies = template.dependencies?.filter(depId => !claimedItemsMap.has(depId)) || [];
            const isLocked = !isClaimed && unmetDependencies.length > 0;

            return (
              <div 
                key={template.id} 
                className={`border rounded-lg p-4 flex flex-col justify-between transition-shadow ${
                  isClaimed ? 'bg-gray-50 border-gray-200 opacity-60' : 
                  isLocked ? 'bg-gray-50 border-gray-200 opacity-80 cursor-not-allowed' : 
                  'bg-white border-gray-200 hover:shadow-lg cursor-pointer'
                }`}
                onClick={() => !isClaimed && !isLocked && handleOpenClaimModal(template)}
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
                  
                  {template.dependencies && template.dependencies.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-1">
                      <strong>Prerequisites:</strong>
                      {template.dependencies.map(depId => {
                        const depTitle = templates.find(t => t.id === depId)?.title || 'Unknown Task';
                        return <span key={depId} className="bg-gray-200 px-1.5 py-0.5 rounded">{depTitle}</span>;
                      })}
                    </div>
                  )}
                </div>
                
                {isClaimed ? (
                  <p className="mt-4 text-green-600 font-bold text-sm text-left flex items-center gap-1">✓ On Timeline</p>
                ) : isLocked ? (
                  <p className="mt-4 text-orange-600 font-bold text-sm text-left flex items-center gap-1">🔒 Complete Prerequisites First</p>
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
              <h3 className="font-bold text-gray-800">Add Task to Timeline</h3>
              <button onClick={() => setSelectedTemplate(null)} className="text-gray-500 hover:text-gray-800 text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleClaimTask} className="p-4 space-y-4">
              <div>
                <p className="font-bold text-gray-800 text-lg">{selectedTemplate.title}</p>
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