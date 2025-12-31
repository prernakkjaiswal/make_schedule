import { Task, ScheduleBlock, TaskType, TaskStatus, UserSettings } from '../types';

// Helper: Convert "HH:MM" to minutes from midnight
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper: Convert minutes to "HH:MM"
export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// The Engine: RescheduleDay
export const rescheduleDay = (
  tasks: Task[], 
  settings: UserSettings
): { blocks: ScheduleBlock[], rolloverTasks: Task[] } => {
  
  // 1. Setup Canvas (00:00 to 24:00)
  // We represent the day as a boolean array of minutes (1440 minutes)
  // or more efficiently, a list of occupied ranges.
  
  let occupied: { start: number; end: number }[] = [];
  const blocks: ScheduleBlock[] = [];
  const rollover: Task[] = [];
  const processedTasks = new Set<string>();

  // 2. Map "Hard" Constraints (Anchors & Fixed Interrupts)
  const fixedTasks = tasks.filter(t => t.type === TaskType.ANCHOR || t.type === TaskType.INTERRUPT);
  
  fixedTasks.forEach(task => {
    if (task.fixedStartTime) {
      const start = timeToMinutes(task.fixedStartTime);
      const end = start + task.durationMinutes;
      
      // Create the block
      blocks.push({
        id: `block-${task.id}`,
        taskId: task.id,
        taskTitle: task.title,
        taskType: task.type,
        startTime: start,
        endTime: end,
        isLocked: true,
        priority: task.priority,
        status: TaskStatus.SCHEDULED
      });

      // Add to occupied list (INCLUDING BUFFER)
      // The schema says buffer is automatically added to gaps. 
      // In implementation, it's easier to say the task 'occupies' (Start - Buffer) to (End + Buffer)
      // But visually we only show Start-End.
      occupied.push({ 
        start: Math.max(0, start - settings.bufferMinutes), 
        end: Math.min(1440, end + settings.bufferMinutes) 
      });
      
      processedTasks.add(task.id);
    }
  });

  // Sort occupied ranges
  occupied.sort((a, b) => a.start - b.start);
  
  // Merge overlapping occupied ranges (Optimization)
  const mergedOccupied: { start: number; end: number }[] = [];
  if (occupied.length > 0) {
    let current = occupied[0];
    for (let i = 1; i < occupied.length; i++) {
      if (occupied[i].start < current.end) {
        current.end = Math.max(current.end, occupied[i].end);
      } else {
        mergedOccupied.push(current);
        current = occupied[i];
      }
    }
    mergedOccupied.push(current);
  }
  occupied = mergedOccupied;

  // 3. Identify "White Space" (Gaps)
  let gaps: { start: number; end: number, duration: number }[] = [];
  let cursor = timeToMinutes("06:00"); // Start scheduling from 6 AM for sanity, or settings.workStart
  const dayEnd = timeToMinutes("23:00"); // End at 11 PM

  // Calculate initial gaps based on occupied list
  // Simple linear scan
  for (const occ of occupied) {
    if (occ.end <= cursor) continue; // Already passed
    if (occ.start > cursor) {
      // Found a gap
      gaps.push({ start: cursor, end: occ.start, duration: occ.start - cursor });
    }
    cursor = Math.max(cursor, occ.end);
  }
  // Final gap until end of day
  if (cursor < dayEnd) {
    gaps.push({ start: cursor, end: dayEnd, duration: dayEnd - cursor });
  }

  // 4. Sort Floating Tasks
  const floatingTasks = tasks
    .filter(t => t.type === TaskType.FLOATING && t.status !== TaskStatus.COMPLETED)
    .sort((a, b) => {
      // Priority 1 is > Priority 3
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Then duration (shortest first often fits better, or longest first for "Big Rocks")
      // PRD implies importance. Let's do longest first to fit big rocks.
      return b.durationMinutes - a.durationMinutes; 
    });

  // 5. The Fitting Loop
  const queue = [...floatingTasks];
  
  while (queue.length > 0) {
    const task = queue.shift()!;
    let placed = false;

    // Try to find a gap
    // Logic: Gap must be >= task.duration
    // Note: Buffer is already accounted for in the 'occupied' calculation (we expanded occupied blocks)
    // However, we might want a buffer between two floating tasks too? 
    // The prompt says "Buffer... Automatic gap between tasks". 
    // If we place a floating task, we must add buffer to IT as well for subsequent tasks.

    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i];
      // We need task duration + buffer (for the NEXT task)
      // Actually, simply: Can we fit the task? 
      // If we place it, we effectively consume (duration + buffer) from the gap.
      
      if (gap.duration >= task.durationMinutes) {
        // IT FITS
        const start = gap.start;
        const end = start + task.durationMinutes;

        blocks.push({
          id: `block-${task.id}-${Math.random().toString(36).substr(2, 5)}`, // Unique ID for split parts
          taskId: task.id,
          taskTitle: task.title,
          taskType: task.type,
          startTime: start,
          endTime: end,
          isLocked: false,
          priority: task.priority,
          status: TaskStatus.SCHEDULED
        });
        
        // Update this gap
        // The task consumes time + buffer
        const consumed = task.durationMinutes + settings.bufferMinutes;
        
        gap.start += consumed;
        gap.duration -= consumed;
        
        placed = true;
        break; 
      }
    }

    if (!placed) {
      // 6. Splitting Logic
      if (task.isSplittable && task.durationMinutes > 30) {
        // Find largest gap
        const sortedGaps = [...gaps].sort((a, b) => b.duration - a.duration);
        const largestGap = sortedGaps[0];

        // Ensure gap is usable (min 15 mins)
        if (largestGap && largestGap.duration >= 15) {
           // Fit as much as we can (leaving room for buffer)
           const fitDuration = largestGap.duration; 
           // We technically need to leave buffer room for the next item, 
           // but since we are filling the gap entirely, the buffer pushes into the next block?
           // Simpler: Just take the whole gap, minus buffer if we want to be strict, 
           // or just fill it and say the buffer is compromised for the split.
           // Let's be strict: Take (gap - buffer)
           const actualFit = Math.max(15, fitDuration - settings.bufferMinutes);

           if (actualFit < 15) {
             // Gap too small after buffer
             rollover.push(task);
             continue;
           }

           // Part A
           const partADuration = actualFit;
           const partBDuration = task.durationMinutes - partADuration;

           // Place Part A
            blocks.push({
              id: `block-${task.id}-partA`,
              taskId: task.id,
              taskTitle: `${task.title} (Part 1)`,
              taskType: task.type,
              startTime: largestGap.start,
              endTime: largestGap.start + partADuration,
              isLocked: false,
              priority: task.priority,
              status: TaskStatus.SCHEDULED
            });

            // Consume gap
            largestGap.start += (partADuration + settings.bufferMinutes);
            largestGap.duration -= (partADuration + settings.bufferMinutes);

            // Re-queue Part B
            const partB: Task = {
              ...task,
              title: `${task.title} (Part 2)`,
              durationMinutes: partBDuration,
              // Keep splittable true in case it needs another split
            };
            // Put at front of queue to try and place immediately or find next gap
            queue.unshift(partB);
            placed = true; 
        }
      }
    }

    if (!placed) {
      // 7. Rollover
      rollover.push(task);
    }
  }

  return { blocks, rolloverTasks: rollover };
};
