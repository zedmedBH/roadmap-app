// src/components/Timeline/TimelineView.tsx
import React, { useEffect, useState } from 'react';
import Timeline from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import dayjs from 'dayjs';
import { collection, onSnapshot, query, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth, type AppUser } from '../../context/AuthContext';
import TaskPanel from './TaskPanel';
import TaskSummaryModal from './TaskSummaryModal';
import { FiMaximize2 } from "react-icons/fi";

export interface RoadmapGroup {
  id: string;
  title: string;
  order: number;
}

export interface RoadmapItem {
  id: string;
  group: string;
  title: string;
  start_time: number;
  end_time: number;
  color?: string;
  userId?: string;
  status?: string;
  taskType?: 'team' | 'individual';
  teamId?: string;
  templateId?: string;
  unclaimed?: boolean;
  broadcastId?: string; 
}

const TimelineView: React.FC = () => {
  const { user, activeClassId } = useAuth();
  const [baseGroups, setBaseGroups] = useState<RoadmapGroup[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [students, setStudents] = useState<AppUser[]>([]); 
  const [loading, setLoading] = useState(true);
  
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const defaultTimeStart = dayjs().add(-3, 'day').valueOf();
  const defaultTimeEnd = dayjs().add(14, 'day').valueOf();

  useEffect(() => {
    const targetClassId = user?.role === 'teacher' ? activeClassId : user?.classId;
    if (!targetClassId) return;

    const qGroups = query(collection(db, 'groups'), where('classId', '==', targetClassId));
    const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
      const fetchedGroups = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().name || 'Unnamed Group',
        order: doc.data().order || 0
      })) as RoadmapGroup[];
      setBaseGroups(fetchedGroups);
    });

    const qUsers = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', targetClassId));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    });

    const qItems = query(collection(db, 'timelineItems'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const activeGroupId = user?.groupId || 'unassigned-team';
      
      const fetchedItems = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as RoadmapItem))
        .filter(data => !data.unclaimed) 
        .filter(data => {
          if (user?.role === 'teacher') return true; 
          return data.group === activeGroupId || data.group === user?.id;
        })
        .map(data => {
          const isMasterTaskForStudent = user?.role === 'student' && !data.userId;
          const isIndividual = data.taskType === 'individual';
          
          return {
            id: data.id,
            group: data.group,
            title: data.title,
            start_time: data.start_time,
            end_time: data.end_time,
            userId: data.userId,
            status: data.status,
            taskType: data.taskType,
            templateId: data.templateId,
            broadcastId: data.broadcastId,
            // Explicitly set permissions here so the library disables the cursor natively
            canMove: !isMasterTaskForStudent,
            canResize: !isMasterTaskForStudent ? 'both' : false,
            itemProps: {
              style: {
                background: data.color || '#2196F3',
                color: '#fff',
                borderRadius: '4px',
                border: isMasterTaskForStudent ? '2px dashed rgba(255,255,255,0.6)' : 'none',
                opacity: isMasterTaskForStudent ? 0.7 : 1,
                padding: '0 8px',
                backgroundImage: isIndividual 
                  ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' 
                  : 'none'
              }
            }
          };
        });

      setItems(fetchedItems);
      setLoading(false);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeUsers();
      unsubscribeItems();
    };
  }, [user, activeClassId]);

  let renderedGroups: RoadmapGroup[] = [];

  if (user?.role === 'student') {
    const activeGroupId = user.groupId || 'unassigned-team';
    const myTeam = baseGroups.find(g => g.id === activeGroupId);
    
    if (myTeam) renderedGroups.push(myTeam);
    else renderedGroups.push({ id: 'unassigned-team', title: 'My Team', order: 0 });
    
    renderedGroups.push({
      id: user.id,
      title: '👤 My Personal Tasks',
      order: myTeam ? myTeam.order + 0.5 : 1
    });
  } else {
    renderedGroups = [...baseGroups];
    const knownGroupIds = new Set(baseGroups.map(g => g.id));
    const extraGroups = new Map<string, string>();
    
    items.forEach(item => {
      if (!knownGroupIds.has(item.group)) {
        const student = students.find(s => s.id === item.group);
        const displayName = student ? `${student.firstName} ${student.lastName}` : `Unknown ID: ${item.group.substring(0, 4)}...`;
        extraGroups.set(item.group, `👤 ${displayName}`);
      }
    });
    
    extraGroups.forEach((title, id) => {
      renderedGroups.push({ id, title, order: 999 });
    });
  }

  renderedGroups.sort((a, b) => a.order - b.order);

  const handleItemMove = async (itemId: string, dragTime: number, newGroupOrder: number) => {
    const item = items.find(i => i.id === itemId);
    const group = renderedGroups[newGroupOrder]; 
    if (!item || !group) return;

    if (user?.role === 'student') {
      if (!item.userId) { 
        alert("You cannot move master roadmap tasks."); 
        return; 
      }
      // PREVENT VERTICAL MOVEMENT: If the destination group isn't the task's original group, reject the drop.
      if (group.id !== item.group) {
        return; 
      }
    }

    const duration = item.end_time - item.start_time;
    const newStartTime = dragTime;
    const newEndTime = dragTime + duration;

    setItems(prev => prev.map(i => i.id === itemId ? { ...i, start_time: newStartTime, end_time: newEndTime, group: group.id } : i));
    try { await updateDoc(doc(db, 'timelineItems', itemId), { start_time: newStartTime, end_time: newEndTime, group: group.id }); } catch (error) {}
  };

  const handleItemResize = async (itemId: string, time: number, edge: 'left' | 'right') => {
    const item = items.find(i => i.id === itemId);
    if (user?.role === 'student' && !item.userId) { alert("You cannot resize master roadmap tasks."); return; }
    if (!item) return;

    const newStartTime = edge === 'left' ? time : item.start_time;
    const newEndTime = edge === 'right' ? time : item.end_time;

    setItems(prev => prev.map(i => i.id === itemId ? { ...i, start_time: newStartTime, end_time: newEndTime } : i));
    try { await updateDoc(doc(db, 'timelineItems', itemId), { start_time: newStartTime, end_time: newEndTime }); } catch (error) {}
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading timeline data...</div>;

  const activeTaskObject = selectedTaskId ? items.find(i => i.id === selectedTaskId) || null : null;

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-md mt-6 relative overflow-hidden">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800">{user?.role === 'teacher' ? 'Master Roadmap' : 'My Roadmap'}</h2>
          {user?.role === 'teacher' && (
            <button onClick={() => setIsPanelOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition z-10 relative">+ Add Task</button>
          )}
        </div>
        {renderedGroups.length === 0 ? (
          <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">No phases/groups found.</div>
        ) : (
          <Timeline
            groups={renderedGroups} 
            items={items} 
            defaultTimeStart={defaultTimeStart} 
            defaultTimeEnd={defaultTimeEnd}
            stackItems={true} 
            canMove={true} 
            canResize="both" 
            useResizeHandle={true} // <-- ADDED THIS to fix the resize issue
            lineHeight={50} 
            itemHeightRatio={0.75}
            onItemMove={handleItemMove} 
            onItemResize={handleItemResize} 
            itemRenderer={({ item, itemContext, getItemProps, getResizeProps }) => {
              const { left: leftResizeProps, right: rightResizeProps } = getResizeProps();
              
              const isMasterTaskForStudent = user?.role === 'student' && !item.userId;
              const isIndividual = item.taskType === 'individual';

              const { key, ...restItemProps } = getItemProps({
                style: {
                  background: item.itemProps?.style?.background || '#2196F3',
                  color: 'white',
                  borderRadius: '4px',
                  border: isMasterTaskForStudent ? '2px dashed rgba(255,255,255,0.6)' : 'none',
                  opacity: isMasterTaskForStudent ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 8px 0 8px', 
                  overflow: 'hidden',
                  backgroundImage: isIndividual 
                    ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' 
                    : 'none'
                }
              });

              return (
                <div
                  key={key}
                  {...restItemProps}
                >
                  {/* Left Resize Handle (Added w-3 and z-20) */}
                  {itemContext.useResizeHandle ? <div {...leftResizeProps} className="!w-3 h-full absolute left-0 cursor-ew-resize hover:bg-white/30 z-20" /> : null}

                  <span className="truncate flex-1 text-sm font-medium pr-2">
                    {itemContext.title}
                  </span>
                  
                  <button 
                    onPointerDown={(e) => e.stopPropagation()} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTaskId(String(item.id));
                    }}
                    className="text-white bg-black/20 hover:bg-black/40 rounded p-1 z-10 cursor-pointer transition-colors flex items-center justify-center mr-1"
                    title="View Task Details"
                  >
                    <FiMaximize2 className="w-4 h-4" />
                  </button>

                  {/* Right Resize Handle (Added w-3 and z-20) */}
                  {itemContext.useResizeHandle ? <div {...rightResizeProps} className="!w-3 h-full absolute right-0 cursor-ew-resize hover:bg-white/30 z-20" /> : null}
                </div>
              );
            }}
          />
        )}
      </div>
      {user?.role === 'teacher' && <TaskPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} groups={baseGroups} />}
      <TaskSummaryModal 
        isOpen={!!selectedTaskId} 
        onClose={() => setSelectedTaskId(null)} 
        task={activeTaskObject} 
      />
    </>
  );
};
export default TimelineView;