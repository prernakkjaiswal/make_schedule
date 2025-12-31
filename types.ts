export enum TaskType {
  ANCHOR = 'Anchor',       // Fixed time (e.g., Meetings, Sleep)
  FLOATING = 'Floating',   // Can be moved (e.g., Coding, Email)
  INTERRUPT = 'Interrupt', // Sudden high priority fixed task
}

export enum TaskStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  ROLLOVER = 'rollover',
}

export interface UserSettings {
  workStart: string; // "09:00"
  workEnd: string;   // "17:00"
  bufferMinutes: number;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  priority: 1 | 2 | 3; // 1: High, 2: Med, 3: Low
  durationMinutes: number;
  isSplittable: boolean;
  deadline?: Date;
  status: TaskStatus;
  fixedStartTime?: string; // Only for Anchors/Interrupts
}

export interface ScheduleBlock {
  id: string;
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  startTime: number; // Minutes from midnight
  endTime: number;   // Minutes from midnight
  isLocked: boolean;
  priority: number;
  status: TaskStatus;
}
