// src/components/Teacher/StudentRosterImport.tsx
import React, { useState } from 'react';
import Papa from 'papaparse';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { type AppUser } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';

interface CsvRow {
  firstName: string;
  lastName: string;
  email: string;
}

const StudentRosterImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { activeClassId } = useAuth();

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
          const students = results.data;
          
          // Initialize a Firebase Batch Write
          const batch = writeBatch(db);
          const usersRef = collection(db, 'users');

          let validCount = 0;

          students.forEach((student) => {
            if (student.email && student.firstName && student.lastName) {
              // We use a generated document ID here, but save the email inside. 
              // The AuthContext will look for this email when the student logs in via Google SSO.
              const newStudentRef = doc(usersRef); 
              
              const studentData: Partial<AppUser> = {
                email: student.email.trim(),
                firstName: student.firstName.trim(),
                lastName: student.lastName.trim(),
                role: 'student',
                classId: activeClassId || undefined
              };
              
              batch.set(newStudentRef, studentData);
              validCount++;
            }
          });

          if (validCount === 0) {
            throw new Error("No valid student data found. Please check your CSV headers (firstName, lastName, email).");
          }

          // Commit the batch to Firestore
          await batch.commit();
          
          setMessage({ text: `Successfully imported ${validCount} students!`, type: 'success' });
          setFile(null); // Reset file input
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
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Import Student Roster</h2>
      <p className="text-sm text-gray-600 mb-4">
        Upload a CSV file with the following exact headers: <span className="font-mono bg-gray-100 p-1 rounded">firstName</span>, <span className="font-mono bg-gray-100 p-1 rounded">lastName</span>, <span className="font-mono bg-gray-100 p-1 rounded">email</span>.
      </p>

      <div className="flex items-center gap-4">
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition whitespace-nowrap"
        >
          {uploading ? 'Importing...' : 'Upload CSV'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default StudentRosterImport;