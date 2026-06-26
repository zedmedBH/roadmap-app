// src/components/Journal/EngineeringJournal.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { uploadFileToDrive, createDriveFolder } from '../../utils/driveUpload';

// Define our data types
interface TimelineTask {
  id: string;
  title: string;
  rubricStrands?: any[];
}

interface Submission {
  textResponse: string;
  imageUrls?: string[];
  lastEdited: number;
}

const EngineeringJournal: React.FC = () => {
  const { user, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);
  
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  
  // Drive IDs & Auth States
  const [classDriveFolderId, setClassDriveFolderId] = useState<string | null>(null);
  const [studentFolderId, setStudentFolderId] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  // 1. Fetch Timeline Tasks, Existing Submissions, & Drive Folders
  useEffect(() => {
    if (!user) return;

    // Fetch Class Folder ID
    if (user.classId) {
      getDoc(doc(db, 'classes', user.classId)).then(classDoc => {
        if (classDoc.exists() && classDoc.data().driveFolderId) {
          setClassDriveFolderId(classDoc.data().driveFolderId);
        }
      });
    }

    // Fetch Student's Personal Folder ID (if it exists)
    getDoc(doc(db, 'users', user.id)).then(userDoc => {
      if (userDoc.exists() && userDoc.data().studentFolderId) {
        setStudentFolderId(userDoc.data().studentFolderId);
      }
    });

    const activeGroupId = user.groupId || 'unassigned-team';

    // Fetch active timeline items for this user/team
    const qTasks = query(collection(db, 'timelineItems'));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const activeTasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(t => !t.unclaimed && (t.group === activeGroupId || t.group === user.id))
        .map(t => ({ id: t.id, title: t.title, rubricStrands: t.rubricStrands }));
      
      setTasks(activeTasks);
    });

    // Fetch existing journal submissions for this specific student
    const qSubmissions = query(collection(db, 'submissions'), where('userId', '==', user.id));
    const unsubSubmissions = onSnapshot(qSubmissions, (snap) => {
      const subs: Record<string, Submission> = {};
      snap.forEach(d => {
        const data = d.data();
        subs[data.timelineItemId] = { 
          textResponse: data.textResponse, 
          imageUrls: data.imageUrls || [],
          lastEdited: data.lastEdited 
        };
      });
      setSubmissions(subs);
      setLoading(false);
    });

    return () => {
      unsubTasks();
      unsubSubmissions();
    };
  }, [user]);

  // 2. Handle Text Input
  const handleTextChange = (taskId: string, text: string) => {
    setSubmissions(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], textResponse: text, lastEdited: Date.now() }
    }));
  };

  // 3. Handle File Upload (With Auto-Folder Creation & Re-auth Catch)
  const handleFileUpload = async (taskId: string, file: File) => {
    if (!classDriveFolderId) {
      alert("Your class does not have a Google Drive folder configured. Please contact your teacher.");
      return;
    }
    if (!user) return;

    setUploadingTaskId(taskId);
    setNeedsReauth(false); // Reset reauth state on new attempt

    try {
      let targetFolder = studentFolderId;

      // Check if student folder exists, if not, create it inside the class folder!
      if (!targetFolder) {
        targetFolder = await createDriveFolder(`${user.firstName} ${user.lastName} - Journal`, classDriveFolderId);
        // Save the new folder ID to the student's user document
        await updateDoc(doc(db, 'users', user.id), { studentFolderId: targetFolder });
        setStudentFolderId(targetFolder);
      }

      // Upload to the personal student folder
      const fileLink = await uploadFileToDrive(file, targetFolder);
      
      const submissionId = `${taskId}_${user.id}`;
      
      // Update local state and Auto-Save immediately
      setSubmissions(prev => {
        const currentUrls = prev[taskId]?.imageUrls || [];
        const updatedUrls = [...currentUrls, fileLink];
        
        setDoc(doc(db, 'submissions', submissionId), {
          timelineItemId: taskId,
          userId: user.id,
          textResponse: prev[taskId]?.textResponse || '',
          imageUrls: updatedUrls,
          lastEdited: Date.now()
        }, { merge: true }).catch(err => console.error("Auto-save failed:", err));

        return {
          ...prev,
          [taskId]: { ...prev[taskId], imageUrls: updatedUrls, lastEdited: Date.now() }
        };
      });

    } catch (error: any) {
      console.error("Upload error:", error);
      const errMsg = error.message || "";
      
      // Catch token expirations and prompt the reauth flow
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("No Google Access Token") || errMsg.includes("Invalid Credentials")) {
        setNeedsReauth(true);
      } else {
        alert("Failed to upload file to Google Drive. Check console for details.");
      }
    } finally {
      setUploadingTaskId(null);
    }
  };

  // 4. Save Text Submission to Firestore
  const handleSave = async (taskId: string) => {
    if (!user) return;
    setSavingId(taskId);
    try {
      const submissionId = `${taskId}_${user.id}`;
      await setDoc(doc(db, 'submissions', submissionId), {
        timelineItemId: taskId,
        userId: user.id,
        textResponse: submissions[taskId]?.textResponse || '',
        imageUrls: submissions[taskId]?.imageUrls || [],
        lastEdited: Date.now()
      }, { merge: true }); 
    } catch (error) {
      console.error("Error saving submission:", error);
      alert("Failed to save entry.");
    } finally {
      setTimeout(() => setSavingId(null), 500); 
    }
  };

  if (loading) return <div className="p-6">Loading Engineering Journal...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6 max-w-4xl mx-auto">
      
      {/* Return to Home / Header */}
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm mb-4">
          ← Back to Dashboard
        </Link>
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Engineering Journal</h2>
            <p className="text-gray-600 text-sm">Document your design and execution process.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button 
              onClick={() => setMode('edit')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'edit' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Edit Mode
            </button>
            <button 
              onClick={() => setMode('preview')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'preview' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Preview Document
            </button>
          </div>
        </div>
      </div>

      {/* RE-AUTH PROMPT */}
      {needsReauth && mode === 'edit' && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex justify-between items-center mb-6 shadow-sm">
          <div>
            <h4 className="text-red-800 font-bold">Google Drive Session Expired</h4>
            <p className="text-sm text-red-600">Please re-authenticate to continue uploading files securely.</p>
          </div>
          <button 
            onClick={async () => { 
              await loginWithGoogle(); 
              setNeedsReauth(false); 
            }} 
            className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 font-medium text-sm transition"
          >
            Reconnect Drive
          </button>
        </div>
      )}

      {/* EDIT MODE */}
      {mode === 'edit' && (
        <div className="space-y-8">
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              No tasks on your timeline yet. Go to your Dashboard to claim tasks!
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                
                {/* Task Header & Rubrics */}
                <div className="bg-white p-4 border-b border-gray-200">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{task.title}</h3>
                  {task.rubricStrands && task.rubricStrands.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {task.rubricStrands.map((r: any) => (
                        <span key={`${r.criterion}-${r.strand}`} className="text-[10px] bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold uppercase tracking-wider" title={r.title}>
                          Criterion {r.criterion}.{r.strand}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 flex flex-col gap-3">
                  <textarea
                    value={submissions[task.id]?.textResponse || ''}
                    onChange={(e) => handleTextChange(task.id, e.target.value)}
                    placeholder="Document your work here. LaTeX is supported (e.g., $E=mc^2$ or $$F=ma$$)..."
                    className="w-full min-h-[150px] p-3 border border-gray-300 rounded focus:border-blue-500 outline-none font-sans text-sm leading-relaxed"
                  />
                  
                  {/* Footer Toolbar: Attachments & Save */}
                  <div className="flex justify-between items-center mt-2 border-t pt-3">
                    <div className="flex items-center gap-3">
                      <label className={`cursor-pointer px-3 py-1.5 rounded text-sm font-medium border transition flex items-center gap-2 ${uploadingTaskId === task.id || !classDriveFolderId ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'}`}>
                        <span>{uploadingTaskId === task.id ? 'Uploading...' : '📎 Attach File'}</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          disabled={uploadingTaskId === task.id || !classDriveFolderId}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(task.id, e.target.files[0]);
                            }
                          }} 
                        />
                      </label>
                      {submissions[task.id]?.imageUrls && submissions[task.id]?.imageUrls!.length > 0 && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                          {submissions[task.id]?.imageUrls!.length} file(s) attached
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {submissions[task.id]?.lastEdited ? `Last edited: ${new Date(submissions[task.id].lastEdited).toLocaleTimeString()}` : 'Unsaved'}
                      </span>
                      <button 
                        onClick={() => handleSave(task.id)}
                        disabled={savingId === task.id}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 transition disabled:bg-blue-300"
                      >
                        {savingId === task.id ? 'Saving...' : 'Save Entry'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* PREVIEW MODE */}
      {mode === 'preview' && (
        <div className="bg-white px-8 py-4 border border-gray-200 rounded-lg shadow-sm min-h-[500px]">
          {tasks.length === 0 ? (
            <p className="text-gray-500 italic mt-4">Nothing to preview yet.</p>
          ) : (
            <div className="space-y-10 mt-6">
              {tasks.map((task, index) => {
                const sub = submissions[task.id];
                const response = sub?.textResponse || '';
                const dateStr = sub?.lastEdited ? new Date(sub.lastEdited).toLocaleString() : 'Not started';
                const attachments = sub?.imageUrls || [];

                return (
                  <div key={task.id} className="border-b border-gray-200 pb-8 last:border-0">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {index + 1}. {task.title}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4 font-mono">Last Updated: {dateStr}</p>
                    
                    {/* LaTeX Wrapper with pre-wrap for line breaks */}
                    <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {response ? (
                        <Latex>{response}</Latex>
                      ) : (
                        <p className="text-gray-400 italic">No entry yet. Start typing in Edit Mode to populate this section.</p>
                      )}
                    </div>

                    {/* Styled Attachments Box */}
                    {attachments.length > 0 && (
                      <div className="mt-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-sm text-blue-900 mb-2">📎 Attached Documents</h4>
                        <ul className="list-disc list-inside text-sm text-blue-700 space-y-1 ml-2">
                          {attachments.map((url, i) => (
                            <li key={i}>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">
                                View Attachment {i + 1}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EngineeringJournal;