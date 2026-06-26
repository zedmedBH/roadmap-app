// src/components/Teacher/TeacherRubricBank.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export interface RubricBand {
  levels: string;
  officialDescriptor: string;
  studentExemplar: string;
}

export interface RubricStrand {
  id?: string;
  teacherId: string;
  criterion: 'A' | 'B' | 'C' | 'D';
  strand: 'i' | 'ii' | 'iii' | 'iv';
  title: string;
  bands: RubricBand[];
}

const DEFAULT_BANDS: RubricBand[] = [
  { levels: '1-2', officialDescriptor: '', studentExemplar: '' },
  { levels: '3-4', officialDescriptor: '', studentExemplar: '' },
  { levels: '5-6', officialDescriptor: '', studentExemplar: '' },
  { levels: '7-8', officialDescriptor: '', studentExemplar: '' },
];

const TeacherRubricBank: React.FC = () => {
  const { user } = useAuth();
  const [strands, setStrands] = useState<RubricStrand[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingStrandId, setEditingStrandId] = useState<string | null>(null);
  
  const [criterion, setCriterion] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [strand, setStrand] = useState<'i' | 'ii' | 'iii' | 'iv'>('i');
  const [title, setTitle] = useState('');
  const [bands, setBands] = useState<RubricBand[]>(DEFAULT_BANDS);

  useEffect(() => {
    if (user?.role !== 'teacher') return;

    const q = query(collection(db, 'rubricBank'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedStrands = snap.docs.map(d => ({ id: d.id, ...d.data() } as RubricStrand));
      // Sort by Criterion then Strand
      fetchedStrands.sort((a, b) => a.criterion.localeCompare(b.criterion) || a.strand.localeCompare(b.strand));
      setStrands(fetchedStrands);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleBandChange = (index: number, field: keyof RubricBand, value: string) => {
    const updatedBands = [...bands];
    updatedBands[index] = { ...updatedBands[index], [field]: value };
    setBands(updatedBands);
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingStrandId(null);
    setCriterion('A');
    setStrand('i');
    setTitle('');
    setBands(DEFAULT_BANDS);
  };

  const openNewForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (strandToEdit: RubricStrand) => {
    setEditingStrandId(strandToEdit.id || null);
    setCriterion(strandToEdit.criterion);
    setStrand(strandToEdit.strand);
    setTitle(strandToEdit.title);
    setBands(strandToEdit.bands);
    setIsFormOpen(true);
    setTimeout(() => document.getElementById('rubric-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const handleDuplicate = (strandToDuplicate: RubricStrand) => {
    setEditingStrandId(null); // Null ID means it will create a new doc on save
    setCriterion(strandToDuplicate.criterion);
    setStrand(strandToDuplicate.strand);
    setTitle(`${strandToDuplicate.title} (Copy)`);
    setBands([...strandToDuplicate.bands]);
    setIsFormOpen(true);
    setTimeout(() => document.getElementById('rubric-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const handleSaveStrand = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const strandData = {
        teacherId: user.id,
        criterion,
        strand,
        title: title.trim(),
        bands
      };

      if (editingStrandId) {
        // Update existing strand
        await updateDoc(doc(db, 'rubricBank', editingStrandId), strandData);
      } else {
        // Create new strand
        await addDoc(collection(db, 'rubricBank'), strandData);
      }
      
      resetForm();
    } catch (error) {
      console.error("Error saving rubric strand:", error);
      alert("Failed to save rubric strand.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (strandId: string) => {
    if (window.confirm("Are you sure you want to delete this rubric strand from your bank? (Tasks that already use it will keep their copy).")) {
      await deleteDoc(doc(db, 'rubricBank', strandId));
      if (editingStrandId === strandId) {
        resetForm(); // Close form if they delete the one they are currently editing
      }
    }
  };

  if (loading) return <div className="p-6">Loading Rubric Bank...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 mt-6">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">My Rubric Bank</h2>
          <p className="text-gray-600 text-sm">Create and manage reusable MYP assessment criteria strands.</p>
        </div>
        <button 
          onClick={isFormOpen ? resetForm : openNewForm} 
          className={`px-4 py-2 rounded shadow font-medium transition ${
            isFormOpen ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {isFormOpen ? 'Cancel' : '+ New Strand'}
        </button>
      </div>

      {/* Creation/Edit Form */}
      {isFormOpen && (
        <form onSubmit={handleSaveStrand} className="mb-8 bg-gray-50 p-6 rounded-lg border border-purple-200 shadow-inner">
          <h3 className="font-bold text-purple-800 mb-4 pb-2 border-b border-purple-100">
            {editingStrandId ? 'Edit Rubric Strand' : 'Create New Rubric Strand'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Criterion</label>
              <select value={criterion} onChange={e => setCriterion(e.target.value as any)} className="w-full border border-gray-300 p-2 rounded outline-none focus:border-purple-500">
                <option value="A">A: Inquiring and Analyzing</option>
                <option value="B">B: Developing Ideas</option>
                <option value="C">C: Creating the Solution</option>
                <option value="D">D: Evaluating</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strand</label>
              <select value={strand} onChange={e => setStrand(e.target.value as any)} className="w-full border border-gray-300 p-2 rounded outline-none focus:border-purple-500">
                <option value="i">i</option>
                <option value="ii">ii</option>
                <option value="iii">iii</option>
                <option value="iv">iv</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strand Title (e.g., Design Specifications)</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full border border-gray-300 p-2 rounded outline-none focus:border-purple-500" />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-gray-800 border-b pb-2">Achievement Bands</h4>
            {bands.map((band, idx) => (
              <div key={band.levels} className="flex gap-4 items-start bg-white p-4 rounded border border-gray-200">
                <div className="w-16 flex-shrink-0 font-bold text-lg text-purple-700 pt-2">{band.levels}</div>
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Official IB Descriptor</label>
                    <textarea 
                      value={band.officialDescriptor} 
                      onChange={e => handleBandChange(idx, 'officialDescriptor', e.target.value)}
                      placeholder="e.g., Lists some basic design specifications..."
                      className="w-full border border-gray-300 p-2 rounded text-sm min-h-[60px] outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Student-Friendly Exemplar</label>
                    <textarea 
                      value={band.studentExemplar} 
                      onChange={e => handleBandChange(idx, 'studentExemplar', e.target.value)}
                      placeholder="e.g., I can list a few basic things my robot should do..."
                      className="w-full border border-purple-200 bg-purple-50 p-2 rounded text-sm min-h-[60px] focus:border-purple-400 outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="bg-purple-600 text-white px-6 py-2 rounded font-medium hover:bg-purple-700 disabled:bg-purple-300 transition">
              {isSubmitting ? 'Saving...' : (editingStrandId ? 'Update Strand' : 'Save to Bank')}
            </button>
          </div>
        </form>
      )}

      {/* Render Saved Strands */}
      {strands.length === 0 && !isFormOpen ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          Your Rubric Bank is empty. Create a strand to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {strands.map(s => (
            <div key={s.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm flex flex-col">
              <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">
                  <span className="text-purple-600 mr-2">Criterion {s.criterion}.{s.strand}</span>
                  {s.title}
                </h3>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                  <button onClick={() => handleDuplicate(s)} className="text-gray-500 hover:text-gray-700 text-sm font-medium" title="Duplicate">Copy</button>
                  <button onClick={() => s.id && handleDelete(s.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                </div>
              </div>
              <div className="p-4 flex-1 text-sm space-y-3">
                {s.bands.map(b => (
                  <div key={b.levels} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                    <span className="font-bold text-gray-700 mr-2">{b.levels}:</span>
                    <span className="text-gray-600">{b.studentExemplar || b.officialDescriptor}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherRubricBank;