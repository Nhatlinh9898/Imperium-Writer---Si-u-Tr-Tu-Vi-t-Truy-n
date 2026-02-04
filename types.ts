export interface Character {
  ten: string;
  vai_tro: string;
  mo_ta: string;
  quan_he?: string;
}

export interface Section {
  id: string; // UUID
  so_muc: number;
  tom_tat_muc: string;
  noi_dung: string;
  tom_tat_ngan: string; // For context feeding
  is_locked: boolean;
}

export interface Part {
  id: string;
  so_phan: number;
  tom_tat_phan: string;
  muc: Section[];
  isOpen?: boolean; // UI state
}

export interface Chapter {
  id: string;
  so_chuong: number;
  ten_chuong: string;
  tom_tat_chuong: string;
  phan: Part[];
  isOpen?: boolean; // UI state
}

export interface StoryBible {
  cot_truyen_tong_quat: string;
  ten_truyen: string;
  the_loai: string[];
  boi_canh: string;
  nhan_vat: Character[];
  chu_de: string[];
}

export interface Story extends StoryBible {
  id: string;
  chapters: Chapter[];
  created_at: number;
}

// AI Response Types
export interface AnalysisResponse {
  ten_truyen: string;
  the_loai: string[];
  boi_canh: string;
  nhan_vat: Character[];
  chu_de: string[];
  cot_truyen_tong_quat: string;
}

export interface StructureResponse {
  chuong: {
    so_chuong: number;
    ten_chuong: string;
    tom_tat_chuong: string;
    phan: {
      so_phan: number;
      tom_tat_phan: string;
      muc: {
        so_muc: number;
        tom_tat_muc: string;
      }[];
    }[];
  }[];
}

export enum AppState {
  SETUP = 'SETUP',
  ANALYZING = 'ANALYZING',
  STRUCTURING = 'STRUCTURING',
  WRITING = 'WRITING',
}

export interface VoiceSettings {
  enabled: boolean;
  voice: 'Nam' | 'Nu';
  speed: number;
}

// --- MULTI-AGENT TYPES ---

export interface ChunkAnalysis {
  chunk_id: number;
  summary: string;
  key_points: string[];
  entities: string[]; // Names of people, places detected
  notes: string;
}

export interface Chunk {
  id: number;
  text: string;
  isProcessed: boolean;
  analysis?: ChunkAnalysis;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  CHUNKING = 'CHUNKING',
  PROCESSING = 'PROCESSING',
  SYNTHESIZING = 'SYNTHESIZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ProcessingSession {
  sessionId: string;
  originalText: string;
  chunks: Chunk[];
  status: ProcessingStatus;
  progress: number; // 0 to 100
  currentChunkIndex: number;
  logs: string[]; // Console logs for UI
  finalAnalysis?: AnalysisResponse;
}
