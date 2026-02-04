import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, StructureResponse, StoryBible, ChunkAnalysis, Chunk } from "../types";
import { SYSTEM_PROMPTS } from "../constants";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// --- AGENT 0: SPLITTER (Logic Based) ---
export const splitTextIntoChunks = (text: string, wordsPerChunk: number = 1500): string[] => {
  // Simple regex split by whitespace to count words roughly
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    chunks.push(chunkWords.join(" "));
  }
  
  return chunks;
};

// --- AGENT 1: CHUNK ANALYZER ---
export const analyzeChunk = async (chunkText: string, chunkId: number): Promise<ChunkAnalysis> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview", 
    contents: `CHUNK ID: ${chunkId}\nCONTENT:\n${chunkText}`,
    config: {
      systemInstruction: SYSTEM_PROMPTS.ANALYZE_CHUNK,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
          entities: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: { type: Type.STRING },
        }
      }
    }
  });

  if (!response.text) throw new Error("Agent Analyzer failed");
  const result = JSON.parse(response.text) as Partial<ChunkAnalysis>;
  
  return {
    chunk_id: chunkId,
    summary: result.summary || "",
    key_points: result.key_points || [],
    entities: result.entities || [],
    notes: result.notes || ""
  };
};

// --- AGENT 2: SYNTHESIZER ---
export const synthesizeAnalysis = async (chunkAnalyses: ChunkAnalysis[]): Promise<AnalysisResponse> => {
  const ai = getAI();
  const inputData = JSON.stringify(chunkAnalyses, null, 2);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview", // Flash 2.5 has 1M context, perfect for synthesis
    contents: `LIST OF CHUNK ANALYSES:\n${inputData}`,
    config: {
      systemInstruction: SYSTEM_PROMPTS.SYNTHESIZE,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ten_truyen: { type: Type.STRING },
          the_loai: { type: Type.ARRAY, items: { type: Type.STRING } },
          boi_canh: { type: Type.STRING },
          nhan_vat: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ten: { type: Type.STRING },
                vai_tro: { type: Type.STRING },
                mo_ta: { type: Type.STRING },
                quan_he: { type: Type.STRING },
              }
            }
          },
          chu_de: { type: Type.ARRAY, items: { type: Type.STRING } },
          cot_truyen_tong_quat: { type: Type.STRING },
        }
      }
    }
  });

  if (!response.text) throw new Error("Agent Synthesizer failed");
  return JSON.parse(response.text) as AnalysisResponse;
};

// --- LEGACY/DIRECT CALLS (For Structure & Writing) ---

export const analyzeStoryInput = async (input: string): Promise<AnalysisResponse> => {
  // Legacy single-shot wrapper - NOT USED in new multi-agent flow but kept for compatibility
  const chunks = splitTextIntoChunks(input);
  if (chunks.length === 1) {
      // Direct call if small
      const ai = getAI();
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview",
          contents: input,
          config: { systemInstruction: SYSTEM_PROMPTS.ANALYZE, responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}") as AnalysisResponse;
  }
  // If large, should use the multi-agent flow in UI
  throw new Error("Input too large for single-agent analysis. Use Multi-Agent flow.");
};

export const generateStructure = async (bible: StoryBible): Promise<StructureResponse> => {
  const ai = getAI();
  const prompt = `Cốt truyện tổng quát: ${bible.cot_truyen_tong_quat}\n\nDanh sách nhân vật: ${JSON.stringify(bible.nhan_vat)}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPTS.STRUCTURE,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chuong: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                so_chuong: { type: Type.NUMBER },
                ten_chuong: { type: Type.STRING },
                tom_tat_chuong: { type: Type.STRING },
                phan: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      so_phan: { type: Type.NUMBER },
                      tom_tat_phan: { type: Type.STRING },
                      muc: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            so_muc: { type: Type.NUMBER },
                            tom_tat_muc: { type: Type.STRING }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!response.text) throw new Error("No structure generated");
  return JSON.parse(response.text) as StructureResponse;
};

interface WritingContext {
  bible: StoryBible;
  chapterSummary: string;
  partSummary: string;
  sectionSummary: string;
  previousSectionsSummary?: string;
  currentContent?: string;
}

export const writeSection = async (context: WritingContext, isContinuation: boolean = false): Promise<string> => {
  const ai = getAI();
  
  let prompt = `
    Cốt truyện tổng thể: ${context.bible.cot_truyen_tong_quat}
    Tóm tắt chương: ${context.chapterSummary}
    Tóm tắt phần: ${context.partSummary}
    Mục tiêu mục hiện tại: ${context.sectionSummary}
  `;

  if (isContinuation && context.currentContent) {
    prompt += `\n\nNội dung đã viết (Context): ${context.currentContent.slice(-2000)}`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: isContinuation ? SYSTEM_PROMPTS.CONTINUE_WRITING : SYSTEM_PROMPTS.WRITE_SECTION,
      temperature: 0.8,
    }
  });

  return response.text || "";
};

export const generateSpeech = async (text: string, voiceType: 'Nam' | 'Nu', speed: number): Promise<ArrayBuffer> => {
  const ai = getAI();
  const voiceName = voiceType === 'Nam' ? 'Fenrir' : 'Kore';

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: { parts: [{ text: text.slice(0, 4000) }] },
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};
