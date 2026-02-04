import React, { useState, useEffect, useRef } from 'react';
import { Story, Chapter, Part, Section, VoiceSettings } from '../types';
import { generateSpeech, writeSection } from '../services/gemini';
import VoiceStudio from './VoiceStudio';

interface StoryEditorProps {
  story: Story;
  onUpdateStory: (story: Story) => void;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ story, onUpdateStory }) => {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    voice: 'Nu',
    speed: 1.0,
  });

  // Derived state to find current active objects
  const findActiveObjects = () => {
    if (!activeSectionId) return null;
    for (const ch of story.chapters) {
      for (const pt of ch.phan) {
        for (const sec of pt.muc) {
          if (sec.id === activeSectionId) {
            return { chapter: ch, part: pt, section: sec };
          }
        }
      }
    }
    return null;
  };

  const activeObj = findActiveObjects();

  const handleWrite = async (isContinue: boolean) => {
    if (!activeObj) return;
    setIsWriting(true);

    try {
      const { chapter, part, section } = activeObj;

      const newContentChunk = await writeSection({
        bible: story,
        chapterSummary: chapter.tom_tat_chuong,
        partSummary: part.tom_tat_phan,
        sectionSummary: section.tom_tat_muc,
        currentContent: section.noi_dung
      }, isContinue);

      const updatedSection = {
        ...section,
        noi_dung: isContinue ? (section.noi_dung + "\n\n" + newContentChunk) : newContentChunk
      };

      // Update Tree
      const newChapters = story.chapters.map(c => {
        if (c.id !== chapter.id) return c;
        return {
          ...c,
          phan: c.phan.map(p => {
            if (p.id !== part.id) return p;
            return {
              ...p,
              muc: p.muc.map(m => m.id === section.id ? updatedSection : m)
            };
          })
        };
      });

      onUpdateStory({ ...story, chapters: newChapters });

    } catch (error) {
      console.error("Writing error:", error);
      alert("Lỗi khi viết: " + (error as Error).message);
    } finally {
      setIsWriting(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!activeObj?.section.noi_dung) return;
    
    try {
      const audioBuffer = await generateSpeech(
        activeObj.section.noi_dung, 
        voiceSettings.voice, 
        voiceSettings.speed
      );
      
      const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (e) {
      alert("Lỗi tạo giọng đọc: " + (e as Error).message);
    }
  };

  // Sidebar Component for Tree View
  const Sidebar = () => (
    <div className="w-80 h-full flex flex-col glass-panel border-r border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="font-bold text-lg text-purple-300">Cấu Trúc Truyện</h3>
        <p className="text-xs text-gray-400 mt-1">{story.chapters.length} Chương</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        {story.chapters.map(chapter => (
          <div key={chapter.id} className="mb-4">
            <div className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer group">
              <span className="text-purple-500 font-mono text-xs">CH.{chapter.so_chuong}</span>
              <span className="font-semibold text-sm text-gray-200 group-hover:text-white truncate" title={chapter.ten_chuong}>
                {chapter.ten_chuong}
              </span>
            </div>
            <div className="ml-4 border-l border-white/10 pl-2">
              {chapter.phan.map(part => (
                <div key={part.id} className="mt-2">
                   <div className="text-xs text-gray-500 mb-1 pl-2">Phần {part.so_phan}</div>
                   {part.muc.map(sec => (
                     <div 
                      key={sec.id}
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`
                        p-2 rounded ml-2 text-sm cursor-pointer transition-colors
                        ${activeSectionId === sec.id ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}
                      `}
                     >
                       <div className="flex justify-between items-center">
                         <span className="truncate w-full">Mục {sec.so_muc}</span>
                         {sec.noi_dung && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                       </div>
                     </div>
                   ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-fade-in-up">
      {/* LEFT: Structure Tree */}
      <Sidebar />

      {/* CENTER: Editor */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden relative">
        {activeObj ? (
          <>
            {/* Editor Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  Chương {activeObj.chapter.so_chuong}: {activeObj.chapter.ten_chuong}
                </h2>
                <div className="flex gap-2 text-xs text-gray-400 mt-1">
                  <span>Phần {activeObj.part.so_phan}</span>
                  <span>•</span>
                  <span>Mục {activeObj.section.so_muc}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleWrite(!!activeObj.section.noi_dung)}
                  disabled={isWriting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                >
                  {isWriting ? 'Đang viết...' : (activeObj.section.noi_dung ? '✨ Viết Tiếp' : '✍️ Viết Mới')}
                </button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-8 relative">
              <div className="max-w-3xl mx-auto">
                 {/* Section Summary Box */}
                 <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-8">
                   <h4 className="text-yellow-500 text-xs font-bold uppercase tracking-wide mb-1">Mục tiêu nội dung</h4>
                   <p className="text-gray-300 text-sm italic">{activeObj.section.tom_tat_muc}</p>
                 </div>

                 {activeObj.section.noi_dung ? (
                   <div className="prose prose-invert prose-lg max-w-none text-gray-200 leading-relaxed whitespace-pre-wrap font-serif">
                     {activeObj.section.noi_dung}
                   </div>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                     <p>Chưa có nội dung.</p>
                     <p className="text-sm mt-2">Nhấn "Viết Mới" để AI khởi tạo.</p>
                   </div>
                 )}
              </div>
            </div>
            
            {/* Audio Player Footer if generated */}
            {audioUrl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-panel p-2 rounded-full shadow-2xl flex items-center gap-4 px-6 animate-slide-up">
                <audio controls src={audioUrl} className="h-8 w-64" autoPlay />
                <button onClick={() => setAudioUrl(null)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p>Chọn một mục từ danh sách bên trái để bắt đầu viết.</p>
          </div>
        )}
      </div>

      {/* RIGHT: Voice Studio & Context */}
      <div className="w-80 flex flex-col gap-6">
        <VoiceStudio 
          settings={voiceSettings} 
          onUpdate={setVoiceSettings} 
          onGenerate={handleGenerateAudio}
          canGenerate={!!activeObj?.section.noi_dung}
        />
        
        <div className="glass-panel p-4 rounded-xl flex-1 overflow-y-auto">
          <h3 className="font-bold text-gray-300 mb-4 border-b border-white/10 pb-2">Hồ Sơ Nhân Vật</h3>
          <div className="space-y-4">
            {story.nhan_vat.map((char, idx) => (
              <div key={idx} className="bg-white/5 p-3 rounded-lg hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-purple-400">{char.ten}</span>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-400 uppercase">{char.vai_tro}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 line-clamp-3">{char.mo_ta}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryEditor;
