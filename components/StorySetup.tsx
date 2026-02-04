import React, { useState, useEffect, useRef } from 'react';
import { PLACEHOLDER_INPUT } from '../constants';
import { ProcessingSession, ProcessingStatus, Chunk, AnalysisResponse } from '../types';
import { splitTextIntoChunks, analyzeChunk, synthesizeAnalysis } from '../services/gemini';

interface StorySetupProps {
  onAnalysisComplete: (analysis: AnalysisResponse) => void;
  isLoading: boolean; // Managed internally now, but kept prop for signature
}

const STORAGE_KEY = 'imperium_session_v1';

const StorySetup: React.FC<StorySetupProps> = ({ onAnalysisComplete }) => {
  // State
  const [input, setInput] = useState('');
  const [session, setSession] = useState<ProcessingSession | null>(null);
  
  // Terminal refs
  const terminalRef = useRef<HTMLDivElement>(null);

  // Load session from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        if (parsed.status === ProcessingStatus.COMPLETED && parsed.finalAnalysis) {
          // Allow user to review before auto-continuing?
          // For now, let's just show the completed state.
        }
      } catch (e) {
        console.error("Failed to restore session", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Persist session whenever it changes
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      // Auto-scroll terminal
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }
  }, [session]);

  const addLog = (prevSession: ProcessingSession, msg: string): ProcessingSession => {
    const timestamp = new Date().toLocaleTimeString();
    return {
      ...prevSession,
      logs: [...prevSession.logs, `[${timestamp}] ${msg}`]
    };
  };

  const startProcessing = () => {
    if (!input.trim()) return;

    // 1. SPLIT (Agent 0)
    const rawChunks = splitTextIntoChunks(input);
    const chunkObjs: Chunk[] = rawChunks.map((text, idx) => ({
      id: idx + 1,
      text,
      isProcessed: false
    }));

    const newSession: ProcessingSession = {
      sessionId: crypto.randomUUID(),
      originalText: input,
      chunks: chunkObjs,
      status: ProcessingStatus.CHUNKING,
      progress: 0,
      currentChunkIndex: 0,
      logs: [`[SYSTEM] Initialized Multi-Agent Core.`, `[SPLITTER] Text split into ${chunkObjs.length} chunks.`],
    };

    setSession(newSession);
    processQueue(newSession);
  };

  const processQueue = async (currentSession: ProcessingSession) => {
    let sess = { ...currentSession };
    
    // 2. ANALYZE CHUNKS (Agent 1 Loop)
    sess.status = ProcessingStatus.PROCESSING;
    setSession(sess);

    // Find first unprocessed chunk
    let startIndex = sess.chunks.findIndex(c => !c.isProcessed);
    if (startIndex === -1) startIndex = 0; // All done or empty

    for (let i = startIndex; i < sess.chunks.length; i++) {
      const chunk = sess.chunks[i];
      
      // Update UI: Analyzing
      sess = addLog(sess, `[AGENT-01] Analyzing Chunk #${chunk.id} (${chunk.text.split(' ').length} words)...`);
      sess.currentChunkIndex = i;
      sess.progress = Math.round(((i) / sess.chunks.length) * 80); // Up to 80% is analysis
      setSession(sess);

      try {
        const analysis = await analyzeChunk(chunk.text, chunk.id);
        
        // Update Chunk Data
        sess.chunks[i].isProcessed = true;
        sess.chunks[i].analysis = analysis;
        
        // Log Success
        sess = addLog(sess, `[AGENT-01] Chunk #${chunk.id} analysis complete. Found ${analysis.entities.length} entities.`);
        setSession({ ...sess });
      } catch (error) {
        sess = addLog(sess, `[ERROR] Failed to analyze Chunk #${chunk.id}: ${(error as Error).message}`);
        sess.status = ProcessingStatus.ERROR;
        setSession(sess);
        return; // Stop on error to allow retry
      }
    }

    // 3. SYNTHESIZE (Agent 2)
    sess.status = ProcessingStatus.SYNTHESIZING;
    sess.progress = 90;
    sess = addLog(sess, `[AGENT-02] All chunks processed. Initiating Synthesis Protocol...`);
    setSession(sess);

    try {
      const allAnalyses = sess.chunks.map(c => c.analysis!).filter(Boolean);
      const finalResult = await synthesizeAnalysis(allAnalyses);
      
      sess.finalAnalysis = finalResult;
      sess.status = ProcessingStatus.COMPLETED;
      sess.progress = 100;
      sess = addLog(sess, `[SYSTEM] Synthesis Complete. Story Bible generated.`);
      setSession({ ...sess });
      
    } catch (error) {
        sess = addLog(sess, `[ERROR] Synthesis failed: ${(error as Error).message}`);
        sess.status = ProcessingStatus.ERROR;
        setSession(sess);
    }
  };

  const handleResume = () => {
    if (session && session.status === ProcessingStatus.ERROR) {
       // Retry flow
       processQueue(session);
    } else if (session && session.status !== ProcessingStatus.COMPLETED) {
       // Continue flow
       processQueue(session);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setInput('');
  };

  const handleComplete = () => {
    if (session?.finalAnalysis) {
      onAnalysisComplete(session.finalAnalysis);
    }
  };

  // --- RENDER ---

  if (session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-5xl mx-auto p-6 animate-fade-in">
        <div className="glass-panel w-full rounded-2xl overflow-hidden shadow-2xl border border-purple-500/30">
          
          {/* Header */}
          <div className="bg-black/40 p-4 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${session.status === 'ERROR' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
              <h2 className="font-mono font-bold text-purple-400 tracking-wider">IMPERIUM CORE PROCESSOR</h2>
            </div>
            <div className="text-xs text-gray-500 font-mono">ID: {session.sessionId.slice(0,8)}</div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Status & Actions */}
            <div className="col-span-1 space-y-6">
               <div>
                 <h3 className="text-sm text-gray-400 uppercase mb-2">Trạng thái hệ thống</h3>
                 <div className="text-2xl font-bold text-white mb-2">{session.status.replace('_', ' ')}</div>
                 <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                   <div 
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" 
                      style={{width: `${session.progress}%`}}
                   ></div>
                 </div>
                 <div className="text-right text-xs text-purple-400">{session.progress}%</div>
               </div>

               <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                 <h3 className="text-xs text-gray-400 uppercase mb-2">Thống kê dữ liệu</h3>
                 <div className="space-y-2 text-sm">
                   <div className="flex justify-between">
                     <span>Chunks:</span>
                     <span className="text-white">{session.chunks.length}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>Processed:</span>
                     <span className="text-green-400">{session.chunks.filter(c => c.isProcessed).length}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>Pending:</span>
                     <span className="text-yellow-400">{session.chunks.filter(c => !c.isProcessed).length}</span>
                   </div>
                 </div>
               </div>

               <div className="flex flex-col gap-3">
                 {session.status === ProcessingStatus.COMPLETED ? (
                    <button 
                      onClick={handleComplete}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-500/20 transition-all"
                    >
                      TIẾP TỤC: KIẾN TẠO CẤU TRÚC
                    </button>
                 ) : (
                    session.status === ProcessingStatus.ERROR || session.status === ProcessingStatus.IDLE ? (
                      <button 
                        onClick={handleResume}
                        className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg shadow-lg"
                      >
                        THỬ LẠI / TIẾP TỤC
                      </button>
                    ) : (
                      <button disabled className="w-full py-3 bg-gray-700 text-gray-400 font-bold rounded-lg cursor-not-allowed">
                        ĐANG XỬ LÝ...
                      </button>
                    )
                 )}
                 
                 <button 
                    onClick={handleReset}
                    className="w-full py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-all"
                 >
                   Hủy bỏ & Tạo mới
                 </button>
               </div>
            </div>

            {/* Right: Terminal */}
            <div className="col-span-1 lg:col-span-2 bg-black/50 rounded-lg border border-white/10 p-4 font-mono text-xs md:text-sm overflow-hidden flex flex-col h-[400px]">
              <div className="flex-1 overflow-y-auto space-y-1 p-2 scrollbar-hide" ref={terminalRef}>
                {session.logs.map((log, idx) => (
                  <div key={idx} className={`${log.includes('ERROR') ? 'text-red-400' : log.includes('SYSTEM') ? 'text-cyan-400' : 'text-gray-300'}`}>
                    {log}
                  </div>
                ))}
                {session.status === ProcessingStatus.PROCESSING && (
                   <div className="text-purple-400 animate-pulse">_</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Initial Input View
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="glass-panel p-8 rounded-3xl w-full shadow-2xl relative overflow-hidden group">
        
        {/* Decorative Glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl group-hover:bg-purple-600/30 transition-all duration-1000"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl group-hover:bg-blue-600/30 transition-all duration-1000"></div>

        <h2 className="text-3xl font-display font-bold text-center mb-6 neon-text">
          Khởi Tạo Vũ Trụ Truyện
        </h2>
        
        <p className="text-gray-400 text-center mb-8">
          Hệ thống <span className="text-purple-400 font-semibold">Multi-Agent</span> sẽ tự động chia nhỏ nội dung lớn, phân tích từng phần và tổng hợp lại.
          <br/>An toàn dữ liệu - Có thể tiếp tục bất cứ lúc nào.
        </p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDER_INPUT}
          className="w-full h-64 bg-black/30 border border-white/10 rounded-xl p-6 text-gray-200 focus:outline-none focus:border-purple-500/50 transition-all resize-none mb-8 text-lg leading-relaxed placeholder-gray-600"
        />

        <div className="flex justify-center">
          <button
            onClick={startProcessing}
            disabled={!input.trim()}
            className={`
              relative px-12 py-4 rounded-full font-bold text-lg tracking-wider uppercase
              transition-all duration-300 transform hover:scale-105 active:scale-95
              bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(168,85,247,0.7)]
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            Kích Hoạt Hệ Thống Agents
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorySetup;
