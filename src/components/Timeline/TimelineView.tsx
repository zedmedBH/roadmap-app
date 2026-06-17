import React, { useEffect, useState } from 'react';
import Timeline from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import dayjs from 'dayjs';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import TaskPanel from './TaskPanel';


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
}

const TimelineView: React.FC = () => {
  const [groups, setGroups] = useState<RoadmapGroup[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State to control the side panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const defaultTimeStart = dayjs().add(-3, 'day').valueOf();
  const defaultTimeEnd = dayjs().add(14, 'day').valueOf();

  useEffect(() => {
    // 1. Listen to Real Groups (from Phase 2)
    const qGroups = query(collection(db, 'groups'));
    const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
      const fetchedGroups = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.name || 'Unnamed Group',
          order: data.order || 0
        };
      }) as RoadmapGroup[];
      
      // Sort alphabetically by title
      fetchedGroups.sort((a, b) => a.title.localeCompare(b.title));
      setGroups(fetchedGroups);
    });

    // 2. Listen to Items (Tasks)
    const qItems = query(collection(db, 'timelineItems'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => {
        const data = doc.data() as RoadmapItem;
        return {
          id: doc.id,
          group: data.group,
          title: data.title,
          start_time: data.start_time,
          end_time: data.end_time,
          itemProps: {
            style: {
              background: data.color || '#2196F3',
              color: '#fff',
              borderRadius: '4px',
              border: 'none',
              padding: '0 8px'
            }
          }
        };
      });
      setItems(fetchedItems);
      setLoading(false);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeItems();
    };
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading timeline data...</div>;

  const handleItemMove = async (itemId: string, dragTime: number, newGroupOrder: number) => {
    // 1. Find the item being moved
    const item = items.find(i => i.id === itemId);
    // 2. The library passes the array *index* of the new group, so we look it up
    const group = groups[newGroupOrder]; 

    if (!item || !group) return;

    // Calculate the new start and end times to maintain the task's duration
    const duration = item.end_time - item.start_time;
    const newStartTime = dragTime;
    const newEndTime = dragTime + duration;

    // Optimistically update the UI so it feels lightning fast
    setItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, start_time: newStartTime, end_time: newEndTime, group: group.id } : i
    ));

    // Save the new dates and new group assignment to Firestore
    try {
      await updateDoc(doc(db, 'timelineItems', itemId), {
        start_time: newStartTime,
        end_time: newEndTime,
        group: group.id
      });
    } catch (error) {
      console.error("Failed to update item position in Firebase:", error);
    }
  };

  const handleItemResize = async (itemId: string, time: number, edge: 'left' | 'right') => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Determine which edge was dragged and update the respective timestamp
    const newStartTime = edge === 'left' ? time : item.start_time;
    const newEndTime = edge === 'right' ? time : item.end_time;

    // Optimistically update the UI
    setItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, start_time: newStartTime, end_time: newEndTime } : i
    ));

    // Save the stretched/shrunk dates to Firestore
    try {
      await updateDoc(doc(db, 'timelineItems', itemId), {
        start_time: newStartTime,
        end_time: newEndTime
      });
    } catch (error) {
      console.error("Failed to resize item in Firebase:", error);
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-md mt-6 relative overflow-hidden">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800">Master Roadmap</h2>
          
          {/* Add Task Button */}
          <button 
            onClick={() => setIsPanelOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
          >
            + Add Task
          </button>
        </div>
        
        {groups.length === 0 ? (
          <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
            No phases/groups found. Please create a group in Firestore first!
          </div>
        ) : (
          <Timeline
            groups={groups}
            items={items}
            defaultTimeStart={defaultTimeStart}
            defaultTimeEnd={defaultTimeEnd}
            stackItems={true}
            canMove={true}
            canResize="both"
            lineHeight={50}
            itemHeightRatio={0.75}
            onItemMove={handleItemMove}
            onItemResize={handleItemResize}
          />
        )}
      </div>

      {/* Render the Slide-out Panel */}
      <TaskPanel 
        isOpen={isPanelOpen} 
        onClose={() => setIsPanelOpen(false)} 
        groups={groups} 
      />
    </>
  );
};

export default TimelineView;