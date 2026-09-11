import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import type { CourseResource } from '../../types';

const StudentResourceHub: React.FC = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState<CourseResource[]>([]);

  useEffect(() => {
    if (!user?.classId) return;
    const q = query(
      collection(db, 'courseResources'), 
      where('visibleIn', 'array-contains', user.classId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setResources(snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseResource)));
    });
    return () => unsub();
  }, [user]);

  if (resources.length === 0) return null;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Class Resources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map(res => (
          <a 
            key={res.id} 
            href={res.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition bg-gray-50 hover:bg-white"
          >
            <h3 className="font-bold text-blue-800 mb-1">{res.title}</h3>
            {res.description && <p className="text-sm text-gray-600 line-clamp-2">{res.description}</p>}
          </a>
        ))}
      </div>
    </div>
  );
};
export default StudentResourceHub;