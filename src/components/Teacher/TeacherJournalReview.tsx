// src/components/Teacher/TeacherJournalReview.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import { db } from '../../config/firebase';
import { useAuth, type AppUser } from '../../context/AuthContext';

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

interface FeedbackState {
  scores: Record<string, number>;
  comment: string;
}

const TeacherJournalReview: React.FC = () => {
  const { user, activeClassId } = useAuth();
  
  const [students, setStudents] = useState<AppUser[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  
  //const [savedFeedbacks, setSavedFeedbacks] = useState<Record<string, FeedbackState>>({});
  const [draftFeedbacks, setDraftFeedbacks] = useState<Record<string, FeedbackState>>({});
  
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeClassId) return;
    const fetchStudents = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', activeClassId));
      const snap = await getDocs(q);
      const fetchedStudents = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      
      fetchedStudents.sort((a, b) => a.firstName.localeCompare(b.firstName));
      setStudents(fetchedStudents);
    };
    fetchStudents();
  }, [activeClassId]);

  useEffect(() => {
    if (!selectedStudentId) {
      setTasks([]);
      setSubmissions({});
      //setSavedFeedbacks({});
      setDraftFeedbacks({});
      return;
    }

    setLoadingStudent(true);

    let unsubTasks: () => void;
    let unsubSubmissions: () => void;
    let unsubFeedback: () => void;

    const loadStudentData = async () => {
      const groupsQ = query(collection(db, 'groups'), where('memberIds', 'array-contains', selectedStudentId));
      const groupSnap = await getDocs(groupsQ);
      const activeGroupId = groupSnap.empty ? 'unassigned-team' : groupSnap.docs[0].id;

      const qTasks = query(collection(db, 'timelineItems'));
      unsubTasks = onSnapshot(qTasks, (snap) => {
        const activeTasks = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(t => !t.unclaimed && (t.group === activeGroupId || t.group === selectedStudentId))
          .map(t => ({ id: t.id, title: t.title, rubricStrands: t.rubricStrands }));
        setTasks(activeTasks);
      });

      const qSubmissions = query(collection(db, 'submissions'), where('userId', '==', selectedStudentId));
      unsubSubmissions = onSnapshot(qSubmissions, (snap) => {
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

      const qFeedback = query(collection(db, 'feedback'), where('userId', '==', selectedStudentId));
      unsubFeedback = onSnapshot(qFeedback, (snap) => {
        const fb: Record<string, FeedbackState> = {};
        snap.forEach(d => {
          const data = d.data();
          fb[data.timelineItemId] = {
            scores: data.scores || {},
            comment: data.comment || ''
          };
        });
        //setSavedFeedbacks(fb);
        setDraftFeedbacks(fb); 
        setLoadingStudent(false);
      });
    };

    loadStudentData();

    return () => {
      if (unsubTasks) unsubTasks();
      if (unsubSubmissions) unsubSubmissions();
      if (unsubFeedback) unsubFeedback();
    };
  }, [selectedStudentId]);

  const handleScoreChange = (taskId: string, strandKey: string, score: number) => {
    setDraftFeedbacks(prev => {
      const currentDraft = prev[taskId] || { scores: {}, comment: '' };
      return {
        ...prev,
        [taskId]: {
          ...currentDraft,
          scores: { ...currentDraft.scores, [strandKey]: score }
        }
      };
    });
  };

  const handleCommentChange = (taskId: string, comment: string) => {
    setDraftFeedbacks(prev => {
      const currentDraft = prev[taskId] || { scores: {}, comment: '' };
      return { ...prev, [taskId]: { ...currentDraft, comment } };
    });
  };

  const saveFeedback = async (taskId: string) => {
    if (!user || !selectedStudentId) return;
    
    setSavingTaskId(taskId);
    try {
      const draft = draftFeedbacks[taskId] || { scores: {}, comment: '' };
      const feedbackId = `${taskId}_${selectedStudentId}`;
      
      await setDoc(doc(db, 'feedback', feedbackId), {
        timelineItemId: taskId,
        userId: selectedStudentId,
        teacherId: user.id,
        scores: draft.scores,
        comment: draft.comment,
        updatedAt: Date.now()
      }, { merge: true });
      
    } catch (error) {
      console.error("Error saving feedback:", error);
      alert("Failed to save feedback.");
    } finally {
      setTimeout(() => setSavingTaskId(null), 500);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Journal Review & Grading</h2>
          <p className="text-gray-600 text-sm">Review student submissions and provide rubric-based feedback.</p>
        </div>
        
        <div className="w-full md:w-64">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Student</label>
          <select 
            value={selectedStudentId} 
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 p-2.5 font-bold outline-none"
          >
            <option value="" disabled>-- Choose a student --</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedStudentId ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          Please select a student from the dropdown above to view their Engineering Journal.
        </div>
      ) : loadingStudent ? (
        <div className="text-center py-12 text-gray-500">Loading student journal...</div>
      ) : (
        <div className="space-y-12">
          {tasks.length === 0 ? (
             <div className="text-center py-10 text-gray-400 italic">
               This student has no active tasks on their timeline.
             </div>
          ) : (
            tasks.map((task, index) => {
              const sub = submissions[task.id];
              const draft = draftFeedbacks[task.id] || { scores: {}, comment: '' };
              const hasRubrics = task.rubricStrands && task.rubricStrands.length > 0;

              return (
                <div key={task.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col md:flex-row">
                  
                  {/* Left Column: Student Submission */}
                  <div className="flex-1 p-6 bg-white border-b md:border-b-0 md:border-r border-gray-200">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{index + 1}. {task.title}</h3>
                      <p className="text-xs text-gray-400 font-mono">
                        Last Edited: {sub?.lastEdited ? new Date(sub.lastEdited).toLocaleString() : 'No submission yet'}
                      </p>
                    </div>

                    <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-sm bg-gray-50 p-4 rounded border border-gray-100 min-h-[150px]">
                      {sub?.textResponse ? (
                        <Latex>{sub.textResponse}</Latex>
                      ) : (
                        <span className="text-gray-400 italic">No entry written yet.</span>
                      )}
                    </div>

                    {sub?.imageUrls && sub.imageUrls.length > 0 && (
                      <div className="mt-4 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-xs text-blue-900 mb-2 uppercase tracking-wider">📎 Attachments</h4>
                        <ul className="list-disc list-inside text-sm text-blue-700 space-y-1 ml-1">
                          {sub.imageUrls.map((url, i) => (
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

                  {/* Right Column: Teacher Grading Panel */}
                  <div className="w-full md:w-[450px] bg-purple-50 flex flex-col">
                    <div className="p-4 bg-purple-100 border-b border-purple-200 flex justify-between items-center">
                      <h4 className="font-bold text-purple-900">📝 Assessment</h4>
                      <span className="text-xs font-semibold text-purple-600 bg-purple-200 px-2 py-1 rounded-full">
                        {hasRubrics ? 'Graded Task' : 'Feedback Only'}
                      </span>
                    </div>

                    <div className="p-4 flex-1 space-y-6">
                      {hasRubrics && (
                        <div className="space-y-6">
                          {task.rubricStrands?.map((r: any) => {
                            const strandKey = `${r.criterion}.${r.strand}`;
                            const currentScore = draft.scores[strandKey];
                            const maxBand = r.maxBand || 8;

                            // Filter the bands to only show the ones applicable to this task's maxBand
                            const availableBands = r.bands.filter((b: any) => {
                              const topScore = parseInt(b.levels.split('-')[1]);
                              return topScore <= maxBand;
                            });

                            return (
                              <div key={strandKey} className="bg-white p-4 rounded shadow-sm border border-purple-200">
                                <div className="mb-3 border-b border-purple-100 pb-2">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-lg text-purple-800">Criterion {strandKey}</span>
                                    <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded">Max: {maxBand}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{r.title}</p>
                                </div>
                                
                                <div className="space-y-3">
                                  {availableBands.map((band: any) => {
                                    const scoresInBand = band.levels.split('-').map((s: string) => parseInt(s));
                                    const isBandSelected = scoresInBand.includes(currentScore);

                                    return (
                                      <div key={band.levels} className={`p-3 rounded border transition-colors ${isBandSelected ? 'bg-purple-100 border-purple-300' : 'bg-gray-50 border-gray-200 hover:bg-purple-50'}`}>
                                        <div className="flex justify-between items-start gap-4">
                                          <div className="flex-1">
                                            <p className="text-xs text-gray-700 leading-relaxed">
                                              {band.studentExemplar || band.officialDescriptor}
                                            </p>
                                          </div>
                                          <div className="flex gap-1 shrink-0">
                                            {scoresInBand.map((score: number) => (
                                              <button
                                                key={score}
                                                onClick={() => handleScoreChange(task.id, strandKey, score)}
                                                className={`w-8 h-8 rounded text-sm font-bold transition-all ${
                                                  currentScore === score 
                                                    ? 'bg-purple-600 text-white shadow-md' 
                                                    : 'bg-white text-gray-600 border border-gray-300 hover:border-purple-400 hover:text-purple-600'
                                                }`}
                                              >
                                                {score}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Teacher Comments</label>
                        <textarea
                          value={draft.comment}
                          onChange={(e) => handleCommentChange(task.id, e.target.value)}
                          placeholder="Leave constructive feedback here..."
                          className="w-full p-3 border border-purple-200 rounded focus:border-purple-500 outline-none text-sm min-h-[100px] bg-white"
                        />
                      </div>
                    </div>

                    <div className="p-4 border-t border-purple-200 bg-white flex justify-end">
                      <button
                        onClick={() => saveFeedback(task.id)}
                        disabled={savingTaskId === task.id}
                        className="bg-purple-600 text-white px-6 py-2 rounded shadow hover:bg-purple-700 font-medium transition-colors disabled:bg-purple-300 w-full md:w-auto"
                      >
                        {savingTaskId === task.id ? 'Saving...' : 'Save Feedback'}
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherJournalReview;