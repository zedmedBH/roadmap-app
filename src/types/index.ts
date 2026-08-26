// src/types/index.ts

export interface Resource {
  title: string;
  url: string;
}

export interface RubricBand {
  levels: string;
  officialDescriptor: string;
  studentExemplar: string;
}

export interface RubricStrand {
  id?: string;
  teacherId?: string;
  criterion: 'A' | 'B' | 'C' | 'D';
  strand: 'i' | 'ii' | 'iii' | 'iv';
  title: string;
  bands: RubricBand[];
  originalRubricId?: string;
  maxBand?: number;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;          
  resources?: Resource[];        
  color: string;
  taskType: 'team' | 'individual';
  isBroadcasted?: boolean;
  visibleIn?: string[];
  subtasks?: string[];
  dependencies?: string[];
  rubricStrands?: RubricStrand[];
}

export interface TimelineItem {
  id: string;
  templateId?: string;
  title: string;
  description?: string;          
  resources?: Resource[];        
  group: string;                 // teamId or userId
  start_time: number;
  end_time: number;
  color?: string;
  userId?: string | null;
  status?: string;
  taskType?: 'team' | 'individual';
  teamId?: string | null;
  unclaimed?: boolean;
  broadcastId?: string;
  rubricStrands?: RubricStrand[];
  claimedRoles?: Record<string, string>; // Role Name -> User ID
  dependencies?: string[];
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt?: number;
}

export interface Submission {
  textResponse: string;
  imageUrls?: string[];
  lastEdited: number;
}

export interface Feedback {
  scores: Record<string, number>;
  comment: string;
}

export interface SelectedRubric {
  id: string;
  maxBand: number;
}