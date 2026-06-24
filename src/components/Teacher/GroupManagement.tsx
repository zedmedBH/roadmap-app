// src/components/Teacher/GroupManagement.tsx
import React, { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { type AppUser } from '../../context/AuthContext';

// --- Helper Components for Drag and Drop ---

const DraggableStudent = ({ student, groupId }: { student: AppUser; groupId: string }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: student.id,
    data: { student, currentGroupId: groupId },
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-2 mb-2 bg-white border border-gray-200 rounded shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 transition-colors z-10 relative"
    >
      {student.firstName} {student.lastName}
    </div>
  );
};

const DroppableGroup = ({ id, name, children }: { id: string; name: string; children: React.ReactNode }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`p-4 rounded-lg min-h-[200px] border-2 transition-colors ${
        isOver ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <h3 className="font-bold text-gray-700 mb-4 pb-2 border-b border-gray-200">{name}</h3>
      <div className="min-h-[100px]">{children}</div>
    </div>
  );
};

// --- Main Component ---

interface Group {
  id: string;
  name: string;
  classId: string;
  memberIds: string[];
}

const GroupManagement: React.FC = () => {
  const [students, setStudents] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);

  // Default class ID for now. In a full app, this would come from the Teacher's active class.
  const CLASS_ID = 'default-class'; 

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all students
      const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));
      const studentDocs = await getDocs(studentsQ);
      const fetchedStudents = studentDocs.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      
      // 2. Fetch all groups for this class
      const groupsQ = query(collection(db, 'groups'), where('classId', '==', CLASS_ID));
      const groupDocs = await getDocs(groupsQ);
      const fetchedGroups = groupDocs.docs.map(d => ({ id: d.id, ...d.data() } as Group));

      setStudents(fetchedStudents);
      setGroups(fetchedGroups);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateGroup = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const groupData = {
        name: newGroupName.trim(),
        classId: CLASS_ID,
        memberIds: [],
      };
      const docRef = await addDoc(collection(db, 'groups'), groupData);
      setGroups([...groups, { id: docRef.id, ...groupData }]);
      setNewGroupName('');
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return; // Dropped outside a valid area

    const studentId = active.id as string;
    const fromGroupId = active.data.current?.currentGroupId;
    const toGroupId = over.id as string;

    if (fromGroupId === toGroupId) return; // Dropped in the same place

    // Optimistically update UI state
    setGroups(prevGroups => prevGroups.map(group => {
      // Remove from old group
      if (group.id === fromGroupId) {
        return { ...group, memberIds: group.memberIds.filter(id => id !== studentId) };
      }
      // Add to new group
      if (group.id === toGroupId) {
        return { ...group, memberIds: [...group.memberIds, studentId] };
      }
      return group;
    }));

    // Perform Firestore updates
    try {
      if (fromGroupId !== 'unassigned') {
        const fromGroupRef = doc(db, 'groups', fromGroupId);
        await updateDoc(fromGroupRef, { memberIds: arrayRemove(studentId) });
      }
      
      if (toGroupId !== 'unassigned') {
        const toGroupRef = doc(db, 'groups', toGroupId);
        await updateDoc(toGroupRef, { memberIds: arrayUnion(studentId) });
      }
    } catch (error) {
      console.error("Error updating group membership:", error);
      fetchData(); // Revert to database state if update fails
    }
  };

  if (loading) return <div className="p-6">Loading roster and groups...</div>;

  // Determine which students are in groups, and which are unassigned
  const allAssignedIds = new Set(groups.flatMap(g => g.memberIds));
  const unassignedStudents = students.filter(s => !allAssignedIds.has(s.id));

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-800">Project Groups</h2>
        
        <form onSubmit={handleCreateGroup} className="flex gap-2">
          <input
            type="text"
            placeholder="New Group Name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700 transition">
            + Create Group
          </button>
        </form>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Unassigned Students Column */}
          <div className="md:col-span-1">
            <DroppableGroup id="unassigned" name={`Unassigned Students (${unassignedStudents.length})`}>
              {unassignedStudents.length === 0 && (
                <p className="text-gray-400 text-sm italic">All students assigned.</p>
              )}
              {unassignedStudents.map(student => (
                <DraggableStudent key={student.id} student={student} groupId="unassigned" />
              ))}
            </DroppableGroup>
          </div>

          {/* Groups Grid */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.length === 0 && (
              <div className="col-span-2 text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                No groups created yet. Create one above!
              </div>
            )}
            
            {groups.map(group => {
              const groupMembers = students.filter(s => group.memberIds.includes(s.id));
              
              return (
                <DroppableGroup key={group.id} id={group.id} name={`${group.name} (${groupMembers.length})`}>
                  {groupMembers.length === 0 && (
                    <p className="text-gray-400 text-sm italic">Drag students here.</p>
                  )}
                  {groupMembers.map(student => (
                    <DraggableStudent key={student.id} student={student} groupId={group.id} />
                  ))}
                </DroppableGroup>
              );
            })}
          </div>
          
        </div>
      </DndContext>
    </div>
  );
};

export default GroupManagement;