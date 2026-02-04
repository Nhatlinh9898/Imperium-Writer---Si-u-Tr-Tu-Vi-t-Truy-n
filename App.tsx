import React, { useState } from 'react';
import StorySetup from './components/StorySetup';
import StoryEditor from './components/StoryEditor';
import { Story, AppState, AnalysisResponse } from './types';
import { generateStructure } from './services/gemini';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string>('');

  // This is called when the Multi-Agent system finishes synthesis
  const handleAnalysisComplete = async (analysis: AnalysisResponse) => {
    try {
      console.log("Analysis Complete:", analysis);

      // Step 2: Structure (Still single shot for now, or could be agent-ified later)
      setAppState(AppState.STRUCTURING);
      setLoadingMsg("Đang kiến tạo khung xương tiểu thuyết...");
      
      const structure = await generateStructure(analysis as any);
      console.log("Structure Complete:", structure);

      // Step 3: Combine into Story Object
      const newStory: Story = {
        id: crypto.randomUUID(),
        created_at: Date.now(),
        ...analysis,
        chapters: structure.chuong.map(c => ({
          id: crypto.randomUUID(),
          ...c,
          phan: c.phan.map(p => ({
            id: crypto.randomUUID(),
            ...p,
            muc: p.muc.map(m => ({
              id: crypto.randomUUID(),
              ...m,
              noi_dung: "",
              tom_tat_ngan: m.tom_tat_muc,
              is_locked: false
            }))
          }))
        }))
      };

      setCurrentStory(newStory);
      setAppState(AppState.WRITING);
      
      // Clean up the setup session storage since we are done
      localStorage.removeItem('imperium_session_v1');

    } catch (error) {
      console.error(error);
      alert("Lỗi khởi tạo cấu trúc: " + (error as Error).message);
      // We go back to setup, the session data is still there in localstorage so user can retry structure gen if needed logic added later
      // For now, simple return
      setAppState(AppState.SETUP);
    }
  };

  const handleAPIKeySelection = () => {
      if (!process.env.API_KEY) {
          alert("Lỗi: Không tìm thấy API Key trong biến môi trường.");
      }
  };

  React.useEffect(() => {
      handleAPIKeySelection();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0c29] text-gray-100 flex flex-col font-sans overflow-hidden">
      {/* HEADER */}
      <header className="h-20 flex items-center justify-center relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-gray-500 font-mono tracking-widest">IMPERIUM v33.1 [MULTI-AGENT]</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500 tracking-tight drop-shadow-2xl">
          SIÊU APP VIP PRO
        </h1>

        <div className="absolute right-6 top-1/2 -translate-y-1/2">
            {appState === AppState.WRITING && (
                <button className="px-4 py-1.5 rounded-full border border-white/10 text-xs text-gray-400 hover:bg-white/5 transition-colors">
                    Export JSON
                </button>
            )}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 overflow-hidden relative">
        {/* Background Effects */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px] -z-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[120px] -z-10"></div>

        {appState === AppState.SETUP && (
          <StorySetup 
            onAnalysisComplete={handleAnalysisComplete} 
            isLoading={false} // Prop is effectively unused now inside setup, but keeping for interface
          />
        )}

        {/* Note: ANALYZING state is now handled internally inside StorySetup visually, 
            but STRUCTURING is still global state */}
        {appState === AppState.STRUCTURING && (
          <div className="flex flex-col items-center justify-center h-full animate-pulse">
            <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-t-4 border-purple-500 rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{loadingMsg}</h2>
            <p className="text-gray-500">Hệ thống đang sử dụng Gemini 2.5 Flash để kiến tạo cấu trúc...</p>
          </div>
        )}

        {appState === AppState.WRITING && currentStory && (
          <StoryEditor 
            story={currentStory} 
            onUpdateStory={setCurrentStory} 
          />
        )}
      </main>
    </div>
  );
};

export default App;
