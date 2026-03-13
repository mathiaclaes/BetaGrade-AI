/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  ChevronRight, 
  ChevronLeft, 
  Info, 
  History, 
  Plus, 
  X, 
  CheckCircle2, 
  Loader2,
  Mountain
} from 'lucide-react';
import { analyzeBoulderingRoute, resizeImage } from './services/geminiService';
import { RouteRecord, AnalysisResult } from './types';

export default function App() {
  const [view, setView] = useState<'home' | 'upload' | 'results' | 'history'>('home');
  const [images, setImages] = useState<string[]>([]);
  const [extraInfo, setExtraInfo] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<RouteRecord[]>([]);
  const [trainingData, setTrainingData] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteRecord | null>(null);
  const [officialGradeInput, setOfficialGradeInput] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [lastAnalyzedId, setLastAnalyzedId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
    fetchTrainingData();
  }, []);

  const fetchTrainingData = async () => {
    try {
      const res = await fetch('/api/training-data');
      if (res.ok) {
        const data = await res.json();
        setTrainingData(data);
      }
    } catch (err) {
      console.error('Failed to fetch training data:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/routes');
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from server but got something else.");
      }
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files as FileList).forEach((file: File) => {
      if (images.length >= 3) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string].slice(0, 3));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (images.length < 3) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeBoulderingRoute(images, extraInfo, trainingData);
      setResult(analysis);
      
      // Resize images for DB storage to prevent payload size issues
      const resizedForDb = await Promise.all(images.map(img => resizeImage(img, 800, 800)));

      // Save to DB
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image1: resizedForDb[0],
          image2: resizedForDb[1],
          image3: resizedForDb[2],
          extra_info: extraInfo,
          grade_range: analysis.gradeRange,
          description: analysis.description
        })
      });
      
      if (res.ok) {
        const saved = await res.json();
        setLastAnalyzedId(saved.id);
      } else {
        console.error('Failed to save route to database');
      }

      fetchHistory();
      setView('results');
    } catch (err: any) {
      console.error('Analysis failed', err);
      alert(err.message || 'Failed to analyze route. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitOfficialGrade = async () => {
    if (!lastAnalyzedId || !officialGradeInput) return;
    setIsSubmittingFeedback(true);
    try {
      await fetch(`/api/routes/${lastAnalyzedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ official_grade: officialGradeInput })
      });
      setOfficialGradeInput('');
      setLastAnalyzedId(null);
      fetchHistory();
      fetchTrainingData();
      alert('Thank you! This grade will help the AI learn for future analyses.');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const importDataset = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (!Array.isArray(data)) throw new Error('Dataset must be an array');
          
          alert(`Importing ${data.length} records. This may take a moment...`);
          
          for (const item of data) {
            await fetch('/api/routes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...item,
                is_verified: true
              })
            });
          }
          
          fetchHistory();
          fetchTrainingData();
          alert('Dataset imported successfully!');
        } catch (err) {
          alert('Failed to import dataset. Ensure it is a valid JSON array of route objects.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const resetForm = () => {
    setImages([]);
    setExtraInfo('');
    setResult(null);
    setLastAnalyzedId(null);
    setOfficialGradeInput('');
    setView('home');
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2" onClick={() => setView('home')}>
          <div className="bg-emerald-600 p-1.5 rounded-lg shadow-sm">
            <Mountain className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-800">BetaGrade AI</h1>
        </div>
        <button 
          onClick={() => setView('history')}
          className="p-2 hover:bg-stone-100 rounded-full transition-colors"
        >
          <History className="w-5 h-5 text-stone-600" />
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pt-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-extrabold text-stone-900">Grade your project.</h2>
                <p className="text-stone-500">Upload 3 angles for high-precision AI estimation.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => setView('upload')}
                  className="group relative overflow-hidden bg-emerald-600 text-white p-8 rounded-3xl shadow-xl shadow-emerald-200 flex flex-col items-center gap-4 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <div className="bg-white/20 p-4 rounded-2xl">
                    <Camera className="w-8 h-8" />
                  </div>
                  <span className="text-lg font-bold">Start New Analysis</span>
                  <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Plus className="w-12 h-12" />
                  </div>
                </button>

                <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-600" />
                    How it works
                  </h3>
                  <ul className="space-y-3 text-sm text-stone-600">
                    <li className="flex gap-3">
                      <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</span>
                      Take 3 photos: Front, Side, and Close-up.
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</span>
                      Add context like wall angle or hold types.
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</span>
                      Get a French Font grade and beta description.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setView('home')} className="p-2 -ml-2">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">New Route</h2>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-stone-500 uppercase tracking-wider">
                  Photos ({images.length}/3)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-stone-200 border border-stone-300">
                      <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full backdrop-blur-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {images.length < 3 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px] font-bold">ADD</span>
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple 
                  onChange={handleImageUpload} 
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-stone-500 uppercase tracking-wider">
                  Extra Context
                </label>
                <textarea
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  placeholder="e.g. 30° overhang, crimpy, dyno start..."
                  className="w-full h-32 p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <button
                disabled={images.length < 3 || isAnalyzing}
                onClick={startAnalysis}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                  images.length === 3 && !isAnalyzing
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:scale-[1.01]'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Beta...
                  </>
                ) : (
                  <>
                    Analyze Route
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {view === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 pt-4"
            >
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-xl shadow-stone-200 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full text-emerald-600 mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">Estimated Grade</p>
                  <h3 className="text-6xl font-black text-emerald-600">{result.gradeRange}</h3>
                </div>

                <div className="h-px bg-stone-100 w-full" />

                {lastAnalyzedId && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Calibrate Universal AI</p>
                    <p className="text-xs text-emerald-600">Is there a verified grade (e.g. from TopLogger) for this route?</p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={officialGradeInput}
                        onChange={(e) => setOfficialGradeInput(e.target.value)}
                        placeholder="e.g. 6B+"
                        className="flex-1 text-sm p-2 rounded-lg border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button 
                        onClick={submitOfficialGrade}
                        disabled={isSubmittingFeedback || !officialGradeInput}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                      >
                        {isSubmittingFeedback ? '...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="text-left space-y-4">
                  <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">AI Beta Description</p>
                  <div className="space-y-3">
                    {result.description.split('.').filter(s => s.trim()).map((sentence, i) => (
                      <p key={i} className="text-stone-700 leading-relaxed flex gap-3">
                        <span className="text-emerald-500 font-bold">•</span>
                        {sentence.trim()}.
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={resetForm}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-colors"
              >
                Done
              </button>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setView('home')} className="p-2 -ml-2">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-xl font-bold">History</h2>
                </div>
                <button 
                  onClick={importDataset}
                  className="text-[10px] font-bold bg-stone-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <Upload className="w-3 h-3" />
                  IMPORT DATASET
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-20 text-stone-400 space-y-4">
                  <History className="w-12 h-12 mx-auto opacity-20" />
                  <p>No analyzed routes yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((route) => (
                    <div 
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex gap-4 cursor-pointer hover:border-emerald-300 transition-colors"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
                        <img src={route.image1} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                          <h4 className="font-black text-xl text-emerald-600">{route.grade_range}</h4>
                          <span className="text-[10px] text-stone-400 font-bold uppercase">
                            {new Date(route.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-stone-500 truncate">{route.extra_info || 'No context provided'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRoute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center"
            onClick={() => setSelectedRoute(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative h-64 bg-stone-900">
                <img src={selectedRoute.image1} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => setSelectedRoute(null)}
                  className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                  <h3 className="text-4xl font-black text-white">{selectedRoute.grade_range}</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-2">
                  <img src={selectedRoute.image1} className="aspect-square rounded-lg object-cover border border-stone-200" referrerPolicy="no-referrer" />
                  <img src={selectedRoute.image2} className="aspect-square rounded-lg object-cover border border-stone-200" referrerPolicy="no-referrer" />
                  <img src={selectedRoute.image3} className="aspect-square rounded-lg object-cover border border-stone-200" referrerPolicy="no-referrer" />
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Context</h4>
                    <p className="text-stone-700">{selectedRoute.extra_info || 'No context provided'}</p>
                  </div>
                  <div className="h-px bg-stone-100" />
                  <div>
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">AI Beta</h4>
                    <div className="space-y-2">
                      {selectedRoute.description.split('.').filter(s => s.trim()).map((sentence, i) => (
                        <p key={i} className="text-sm text-stone-600 leading-relaxed">
                          {sentence.trim()}.
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav (Mobile Feel) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-stone-200 px-8 py-4 flex justify-around items-center z-40">
        <button 
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-emerald-600' : 'text-stone-400'}`}
        >
          <Mountain className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Home</span>
        </button>
        <button 
          onClick={() => setView('upload')}
          className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-200 -mt-12 transition-transform active:scale-90"
        >
          <Plus className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setView('history')}
          className={`flex flex-col items-center gap-1 ${view === 'history' ? 'text-emerald-600' : 'text-stone-400'}`}
        >
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">History</span>
        </button>
      </nav>
    </div>
  );
}
