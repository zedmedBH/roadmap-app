import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { collection, doc, writeBatch, query, where, onSnapshot, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { type AppUser, useAuth } from '../../context/AuthContext';

interface CsvRow {
  firstName: string;
  lastName: string;
  email: string;
}

const StudentRosterImport: React.FC = () => {
  const { activeClassId } = useAuth();
  
  // Roster State
  const [students, setStudents] = useState<AppUser[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  
  // Single Add State
  const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', email: '' });
  const [isAdding, setIsAdding] = useState(false);

  // CSV Import State
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch and listen to the current roster
  useEffect(() => {
    if (!activeClassId) return;
    
    const q = query(
      collection(db, 'users'), 
      where('role', '==', 'student'), 
      where('classId', '==', activeClassId)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedStudents = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      fetchedStudents.sort((a, b) => a.firstName.localeCompare(b.firstName));
      setStudents(fetchedStudents);
      setLoadingRoster(false);
    });

    return () => unsubscribe();
  }, [activeClassId]);

  // --- Handlers ---

  const handleAddSingleStudent = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newStudent.firstName.trim() || !newStudent.lastName.trim() || !newStudent.email.trim() || !activeClassId) return;
    
    setIsAdding(true);
    setMessage(null);
    
    try {
      const newRef = doc(collection(db, 'users'));
      await setDoc(newRef, {
        email: newStudent.email.trim(),
        firstName: newStudent.firstName.trim(),
        lastName: newStudent.lastName.trim(),
        role: 'student',
        classId: activeClassId
      });
      
      setNewStudent({ firstName: '', lastName: '', email: '' });
      setMessage({ text: 'Student added successfully!', type: 'success' });
    } catch (error) {
      console.error("Error adding student:", error);
      setMessage({ text: 'Failed to add student.', type: 'error' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to remove ${studentName} from the roster?`)) {
      try {
        await deleteDoc(doc(db, 'users', studentId));
      } catch (err) {
        console.error("Error removing student:", err);
        alert('Failed to remove student.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = () => {
    if (!file) {
      setMessage({ text: 'Please select a CSV file first.', type: 'error' });
      return;
    }
    setUploading(true);
    setMessage(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const csvStudents = results.data;
          const batch = writeBatch(db);
          const usersRef = collection(db, 'users');
          let validCount = 0;

          csvStudents.forEach((student) => {
            if (student.email && student.firstName && student.lastName) {
              const newStudentRef = doc(usersRef);
              batch.set(newStudentRef, {
                email: student.email.trim(),
                firstName: student.firstName.trim(),
                lastName: student.lastName.trim(),
                role: 'student',
                classId: activeClassId || undefined
              });
              validCount++;
            }
          });

          if (validCount === 0) {
            throw new Error("No valid student data found. Check your headers.");
          }

          await batch.commit();
          setMessage({ text: `Successfully imported ${validCount} students!`, type: 'success' });
          setFile(null);
        } catch (error: any) {
          console.error("Error uploading roster:", error);
          setMessage({ text: error.message || 'An error occurred during upload.', type: 'error' });
        } finally {
          setUploading(false);
        }
      },
      error: (error) => {
        console.error("PapaParse Error:", error);
        setMessage({ text: 'Error reading the CSV file.', type: 'error' });
        setUploading(false);
      }
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">Roster Management</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Current Roster */}
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Current Students</h3>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden h-[300px] overflow-y-auto">
            {loadingRoster ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading roster...</div>
            ) : students.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm italic">No students in this class yet.</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {students.map(student => (
                  <li key={student.id} className="p-3 bg-white flex justify-between items-center hover:bg-gray-50 transition">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveStudent(student.id, `${student.firstName} ${student.lastName}`)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                    >
                      Drop
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Add Students */}
        <div className="space-y-6">
          
          {/* Manual Add */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Add Single Student</h3>
            <form onSubmit={handleAddSingleStudent} className="space-y-3">
              <div className="flex gap-3">
                <input 
                  type="text" placeholder="First Name" required
                  value={newStudent.firstName} onChange={e => setNewStudent({...newStudent, firstName: e.target.value})}
                  className="w-full border border-gray-300 p-2 text-sm rounded outline-none focus:border-blue-500"
                />
                <input 
                  type="text" placeholder="Last Name" required
                  value={newStudent.lastName} onChange={e => setNewStudent({...newStudent, lastName: e.target.value})}
                  className="w-full border border-gray-300 p-2 text-sm rounded outline-none focus:border-blue-500"
                />
              </div>
              <input 
                type="email" placeholder="Student Email" required
                value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})}
                className="w-full border border-gray-300 p-2 text-sm rounded outline-none focus:border-blue-500"
              />
              <button 
                type="submit" disabled={isAdding}
                className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 transition disabled:bg-blue-300"
              >
                {isAdding ? 'Adding...' : '+ Add to Class'}
              </button>
            </form>
          </div>

          {/* Bulk Import */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-2">Bulk Import CSV</h3>
            <p className="text-xs text-gray-500 mb-3">
              Headers required: <span className="font-mono bg-gray-200 px-1 rounded">firstName</span>, <span className="font-mono bg-gray-200 px-1 rounded">lastName</span>, <span className="font-mono bg-gray-200 px-1 rounded">email</span>
            </p>
            
            <div className="flex flex-col gap-3">
              <input 
                type="file" accept=".csv" onChange={handleFileChange}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition"
              />
              <button
                onClick={handleUpload} disabled={!file || uploading}
                className="w-full bg-gray-800 text-white py-2 rounded text-sm font-medium hover:bg-gray-900 transition disabled:bg-gray-400"
              >
                {uploading ? 'Importing...' : 'Upload & Import'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div className={`mt-4 p-3 rounded text-sm text-center border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default StudentRosterImport;