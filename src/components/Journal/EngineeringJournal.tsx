// src/components/Journal/EngineeringJournal.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { uploadFileToDrive, createDriveFolder } from '../../utils/driveUpload';

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

interface Feedback {
  scores: Record<string, number>; 
  comment: string;
}

const CRITERIA_NAMES: Record<string, string> = {
  A: "Inquiring and Analyzing",
  B: "Developing Ideas",
  C: "Creating the Solution",
  D: "Evaluating"
};

const EngineeringJournal: React.FC = () => {
  const { user, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  const [loading, setLoading] = useState(true);
  
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  
  const [classDriveFolderId, setClassDriveFolderId] = useState<string | null>(null);
  const [studentFolderId, setStudentFolderId] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  // Accordion state for the summary grid
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;

    if (user.classId) {
      getDoc(doc(db, 'classes', user.classId)).then(classDoc => {
        if (classDoc.exists() && classDoc.data().driveFolderId) {
          setClassDriveFolderId(classDoc.data().driveFolderId);
        }
      });
    }

    getDoc(doc(db, 'users', user.id)).then(userDoc => {
      if (userDoc.exists() && userDoc.data().studentFolderId) {
        setStudentFolderId(userDoc.data().studentFolderId);
      }
    });

    const activeGroupId = user.groupId || 'unassigned-team';

    const qTasks = query(collection(db, 'timelineItems'));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const activeTasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(t => !t.unclaimed && (t.group === activeGroupId || t.group === user.id))
        .map(t => ({ id: t.id, title: t.title, rubricStrands: t.rubricStrands }));
      
      setTasks(activeTasks);
    });

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
    });

    const qFeedback = query(collection(db, 'feedback'), where('userId', '==', user.id));
    const unsubFeedback = onSnapshot(qFeedback, (snap) => {
      const fb: Record<string, Feedback> = {};
      snap.forEach(d => {
        const data = d.data();
        fb[data.timelineItemId] = {
          scores: data.scores || {},
          comment: data.comment || ''
        };
      });
      setFeedbacks(fb);
      setLoading(false);
    });

    return () => {
      unsubTasks();
      unsubSubmissions();
      unsubFeedback();
    };
  }, [user]);

  const handleTextChange = (taskId: string, text: string) => {
    setSubmissions(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], textResponse: text, lastEdited: Date.now() }
    }));
  };

  const handleFileUpload = async (taskId: string, file: File) => {
    if (!classDriveFolderId) {
      alert("Your class does not have a Google Drive folder configured.");
      return;
    }
    if (!user) return;

    setUploadingTaskId(taskId);
    setNeedsReauth(false); 

    try {
      let targetFolder = studentFolderId;

      if (!targetFolder) {
        targetFolder = await createDriveFolder(`${user.firstName} ${user.lastName} - Journal`, classDriveFolderId);
        await updateDoc(doc(db, 'users', user.id), { studentFolderId: targetFolder });
        setStudentFolderId(targetFolder);
      }

      const fileLink = await uploadFileToDrive(file, targetFolder);
      const submissionId = `${taskId}_${user.id}`;
      
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
      
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("No Google Access Token") || errMsg.includes("Invalid Credentials")) {
        setNeedsReauth(true);
      } else {
        alert("Failed to upload file to Google Drive. Check console for details.");
      }
    } finally {
      setUploadingTaskId(null);
    }
  };

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

  const toggleCriterion = (crit: string) => {
    setExpandedCriteria(prev => ({ ...prev, [crit]: !prev[crit] }));
  };

  if (loading) return <div className="p-6">Loading Engineering Journal...</div>;

  // --- Calculate Summary Statistics by Criterion & Strand ---
  const criteriaStats: Record<string, Record<string, number[]>> = {
    A: { i: [], ii: [], iii: [], iv: [] },
    B: { i: [], ii: [], iii: [], iv: [] },
    C: { i: [], ii: [], iii: [], iv: [] },
    D: { i: [], ii: [], iii: [], iv: [] }
  };
  let gradedTasksCount = 0;

  tasks.forEach(task => {
    const feedback = feedbacks[task.id];
    if (feedback && task.rubricStrands) {
      let taskHasGrade = false;
      task.rubricStrands.forEach(strand => {
        const strandKey = `${strand.criterion}.${strand.strand}`;
        if (feedback.scores[strandKey] !== undefined) {
          taskHasGrade = true;
          if (criteriaStats[strand.criterion] && criteriaStats[strand.criterion][strand.strand]) {
            criteriaStats[strand.criterion][strand.strand].push(feedback.scores[strandKey]);
          }
        }
      });
      if (taskHasGrade) gradedTasksCount++;
    }
  });

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
              Preview & Feedback
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK SUMMARY PANEL */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Performance Summary</h3>
          <p className="text-sm text-gray-600">
            Averaged scores across <span className="font-bold text-blue-600">{gradedTasksCount}</span> graded task(s).
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['A', 'B', 'C', 'D'].map(crit => {
            const strands = criteriaStats[crit];
            const allScores = Object.values(strands).flat();
            const hasScores = allScores.length > 0;
            const critAvg = hasScores ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '-';
            const isExpanded = !!expandedCriteria[crit];

            return (
              <div key={crit} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transition-all">
                <div 
                  className={`p-4 flex justify-between items-center transition-colors ${hasScores ? 'cursor-pointer hover:bg-purple-50' : 'opacity-60 cursor-not-allowed'}`}
                  onClick={() => hasScores && toggleCriterion(crit)}
                >
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm md:text-base">Criterion {crit}</h4>
                    <p className="text-xs text-gray-500">{CRITERIA_NAMES[crit]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-xl font-black ${hasScores ? 'text-purple-700' : 'text-gray-300'}`}>
                      {critAvg} <span className="text-xs font-normal text-gray-400">avg</span>
                    </div>
                    {hasScores && (
                      <div className="text-gray-400">
                        {isExpanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Collapsible Sub-strands Grid */}
                {isExpanded && hasScores && (
                  <div className="bg-purple-50/50 p-4 border-t border-purple-100 grid grid-cols-2 gap-3">
                    {['i', 'ii', 'iii', 'iv'].map(strand => {
                      const sScores = strands[strand];
                      const sAvg = sScores.length > 0 ? (sScores.reduce((a, b) => a + b, 0) / sScores.length).toFixed(1) : '-';
                      return (
                        <div key={strand} className="flex justify-between items-center bg-white p-2 rounded border border-purple-100 text-sm shadow-sm">
                          <span className="font-semibold text-gray-600">Strand {strand}</span>
                          <span className={`font-bold ${sAvg !== '-' ? 'text-purple-600' : 'text-gray-300'}`}>{sAvg}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
                
                <div className="bg-white p-4 border-b border-gray-200">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{task.title}</h3>
                  {task.rubricStrands && task.rubricStrands.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {task.rubricStrands.map((r: any) => (
                        <span key={`${r.criterion}-${r.strand}`} className="text-[10px] bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold uppercase tracking-wider" title={r.title}>
                          Crit {r.criterion}.{r.strand} (Max: {r.maxBand || 8})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-3">
                  <textarea
                    value={submissions[task.id]?.textResponse || ''}
                    onChange={(e) => handleTextChange(task.id, e.target.value)}
                    placeholder="Document your work here. LaTeX is supported (e.g., $E=mc^2$ or $$F=ma$$)..."
                    className="w-full min-h-[150px] p-3 border border-gray-300 rounded focus:border-blue-500 outline-none font-sans text-sm leading-relaxed"
                  />
                  
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

      {/* PREVIEW & FEEDBACK MODE */}
      {mode === 'preview' && (
        <div className="bg-white px-8 py-4 border border-gray-200 rounded-lg shadow-sm min-h-[500px]">
          {tasks.length === 0 ? (
            <p className="text-gray-500 italic mt-4">Nothing to preview yet.</p>
          ) : (
            <div className="space-y-10 mt-6">
              {tasks.map((task, index) => {
                const sub = submissions[task.id];
                const feedback = feedbacks[task.id];
                const response = sub?.textResponse || '';
                const dateStr = sub?.lastEdited ? new Date(sub.lastEdited).toLocaleString() : 'Not started';
                const attachments = sub?.imageUrls || [];

                return (
                  <div key={task.id} className="border-b border-gray-200 pb-8 last:border-0">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {index + 1}. {task.title}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4 font-mono">Last Updated: {dateStr}</p>
                    
                    <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {response ? (
                        <Latex>{response}</Latex>
                      ) : (
                        <p className="text-gray-400 italic">No entry yet. Start typing in Edit Mode to populate this section.</p>
                      )}
                    </div>

                    {attachments.length > 0 && (
                      <div className="mt-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-sm text-blue-900 mb-2 uppercase tracking-wider">📎 Attachments</h4>
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

                    {/* INLINE TEACHER FEEDBACK */}
                    {feedback && (
                      <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-5 shadow-sm">
                        <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                          📝 Teacher Evaluation
                        </h4>
                        
                        {Object.keys(feedback.scores).length > 0 && (
                          <div className="space-y-4 mb-6">
                            {Object.entries(feedback.scores).map(([strandKey, score]) => {
                                const matchingStrand = task.rubricStrands?.find(r => `${r.criterion}.${r.strand}` === strandKey);
                                const max = matchingStrand?.maxBand || 8;
                                
                                const achievedBand = matchingStrand?.bands?.find((b: any) => {
                                  const scores = b.levels.split('-').map((s: string) => parseInt(s));
                                  return scores.includes(score);
                                });

                                return (
                                  <div key={strandKey} className="bg-white border border-purple-100 rounded-lg p-4 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="font-bold text-purple-800">Criterion {strandKey}</span>
                                      <span className="text-lg font-black text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                                        {score}<span className="text-sm text-purple-400 font-medium ml-0.5">/{max}</span>
                                      </span>
                                    </div>
                                    {achievedBand && (
                                      <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-100">
                                        <span className="font-semibold text-gray-600 block mb-1">Achieved Band ({achievedBand.levels}):</span>
                                        {achievedBand.studentExemplar || achievedBand.officialDescriptor}
                                      </div>
                                    )}
                                  </div>
                                );
                            })}
                          </div>
                        )}

                        {feedback.comment && (
                          <div className="bg-white p-4 rounded-lg border border-purple-100 text-sm text-gray-800 whitespace-pre-wrap shadow-sm">
                            <span className="font-bold text-purple-900 block mb-2">Comments:</span>
                            {feedback.comment}
                          </div>
                        )}
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