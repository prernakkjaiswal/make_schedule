import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Settings, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Split, 
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  BrainCircuit,
  Trash2,
  X
} from 'lucide-react';
import { Task, ScheduleBlock, TaskType, TaskStatus, UserSettings } from './types';
import { rescheduleDay, minutesToTime, timeToMinutes } from './services/scheduler';
import { analyzeTaskInput } from './services/geminiService';

// --- Mock Initial Data ---
const INITIAL_SETTINGS: UserSettings = {
  workStart: "09:00",
  workEnd: "17:00",
  bufferMinutes: 15,
};

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Deep Work: Strategy', type: TaskType.ANCHOR, priority: 1, durationMinutes: 90, isSplittable: false, status: TaskStatus.PENDING, fixedStartTime: '09:00' },
  { id: '2', title: 'Team Sync', type: TaskType.ANCHOR, priority: 2, durationMinutes: 45, isSplittable: false, status: TaskStatus.PENDING, fixedStartTime: '13:00' },
  { id: '3', title: 'Client Email Responses', type: TaskType.FLOATING, priority: 2, durationMinutes: 60, isSplittable: true, status: TaskStatus.PENDING },
  { id: '4', title: 'Code Review', type: TaskType.FLOATING, priority: 2, durationMinutes: 45, isSplittable: false, status: TaskStatus.PENDING },
  { id: '5', title: 'Prepare Q3 Report', type: TaskType.FLOATING, priority: 1, durationMinutes: 120, isSplittable: true, status: TaskStatus.PENDING },
];

// --- Components ---

const TaskModal = ({ 
  isOpen, 
  onClose, 
  onAdd 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (t: Task[]) => void 
}) => {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  // UI State for "Fixed" vs "Flexible" tab
  const [isFixed, setIsFixed] = useState(false);
  const [isInterrupt, setIsInterrupt] = useState(false); // Only if fixed
  
  const [priority, setPriority] = useState<1|2|3>(2);
  const [isSplittable, setIsSplittable] = useState(false);
  const [fixedTime, setFixedTime] = useState('09:00');
  const [aiLoading, setAiLoading] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
       setIsFixed(false);
       setIsInterrupt(false);
       setPriority(2);
       setDuration(30);
       setIsSplittable(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAiAssist = async () => {
    if (!title) return;
    setAiLoading(true);
    const suggestion = await analyzeTaskInput(title);
    setAiLoading(false);
    
    if (suggestion) {
      if (suggestion.subtasks && suggestion.subtasks.length > 0) {
        // Complex task breakdown
        const newTasks: Task[] = suggestion.subtasks.map((st, idx) => ({
          id: Date.now().toString() + idx,
          title: st.title,
          type: TaskType.FLOATING,
          priority: priority,
          durationMinutes: st.duration,
          isSplittable: false,
          status: TaskStatus.PENDING
        }));
        onAdd(newTasks);
        onClose();
        setTitle('');
      } else {
        // Simple refinement
        setTitle(suggestion.title);
        setDuration(suggestion.durationMinutes);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalType = TaskType.FLOATING;
    if (isFixed) {
      finalType = isInterrupt ? TaskType.INTERRUPT : TaskType.ANCHOR;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      type: finalType,
      priority,
      durationMinutes: duration,
      isSplittable: !isFixed && isSplittable, // Only floating tasks usually split well, but logic allows any. Keeping it simple.
      status: TaskStatus.PENDING,
      fixedStartTime: isFixed ? fixedTime : undefined
    };
    onAdd([newTask]);
    onClose();
    setTitle('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Add New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="mb-6 flex gap-2">
           <input 
              type="text" 
              placeholder="What needs to be done?" 
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
            <button 
              onClick={handleAiAssist}
              disabled={aiLoading || !title}
              className="bg-purple-50 text-purple-600 border border-purple-100 p-3 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 shadow-sm"
              title="AI Assist"
            >
              {aiLoading ? <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" /> : <Sparkles size={20} />}
            </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Schedule Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setIsFixed(false)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${!isFixed ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
              >
                <div className="font-semibold flex items-center gap-2">
                   <BrainCircuit size={16} /> Flexible
                </div>
                <div className="text-xs opacity-80 mt-1">Auto-scheduled</div>
              </button>
              <button 
                type="button"
                onClick={() => setIsFixed(true)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${isFixed ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
              >
                <div className="font-semibold flex items-center gap-2">
                   <Clock size={16} /> Fixed Time
                </div>
                <div className="text-xs opacity-80 mt-1">Specific time</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Duration */}
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="5"
                  step="5"
                  value={duration} 
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">m</span>
              </div>
            </div>

            {/* Time Picker (Conditional) */}
            {isFixed && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-sm font-medium text-gray-700 mb-1">At What Time?</label>
                <input 
                  type="time" 
                  value={fixedTime} 
                  onChange={e => setFixedTime(e.target.value)}
                  className="w-full border border-blue-300 bg-blue-50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>

          {/* Fixed Task Options */}
          {isFixed && (
             <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in">
               <input 
                 type="checkbox" 
                 id="interruptCheck"
                 checked={isInterrupt}
                 onChange={e => setIsInterrupt(e.target.checked)}
                 className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-gray-300"
               />
               <label htmlFor="interruptCheck" className="text-sm font-medium text-red-800 cursor-pointer">
                 High Priority Interruption
               </label>
             </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex gap-1">
                {[1, 2, 3].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p as 1|2|3)}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      priority === p 
                        ? p === 1 ? 'bg-red-100 text-red-700 ring-1 ring-red-500' : p === 2 ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-500' : 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p === 1 ? 'High' : p === 2 ? 'Med' : 'Low'}
                  </button>
                ))}
              </div>
            </div>
            
            {!isFixed && (
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={isSplittable} 
                    onChange={e => setIsSplittable(e.target.checked)}
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="text-sm text-gray-700 group-hover:text-blue-700 transition-colors">
                    <span className="font-medium">Allow Splitting</span>
                    <p className="text-xs text-gray-400">Can break into parts</p>
                  </div>
                </label>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="w-full bg-[#1E40AF] text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20"
          >
            Add Task
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [settings, setSettings] = useState<UserSettings>(INITIAL_SETTINGS);
  const [schedule, setSchedule] = useState<{blocks: ScheduleBlock[], rolloverTasks: Task[]}>({ blocks: [], rolloverTasks: [] });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(timeToMinutes("06:00")); // For visual timeline start

  // The "Engine" Effect - Runs whenever tasks or settings change
  useEffect(() => {
    const result = rescheduleDay(tasks, settings);
    setSchedule(result);
  }, [tasks, settings]);

  const addTask = (newTasks: Task[]) => {
    setTasks(prev => [...prev, ...newTasks]);
  };

  const deleteTask = (taskId: string) => {
    // Confirm? Maybe not needed for this MVP.
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Helper to calculate top position and height for timeline blocks
  // 1 minute = 1.5 pixels (or configurable)
  const PIXELS_PER_MINUTE = 2;
  const START_OF_DAY_MINUTES = timeToMinutes("06:00");
  const VIEW_HEIGHT = (timeToMinutes("23:00") - START_OF_DAY_MINUTES) * PIXELS_PER_MINUTE;

  const getBlockStyle = (block: ScheduleBlock) => {
    const top = (block.startTime - START_OF_DAY_MINUTES) * PIXELS_PER_MINUTE;
    const height = (block.endTime - block.startTime) * PIXELS_PER_MINUTE;
    return { top: `${top}px`, height: `${height}px` };
  };

  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-slate-800">
      
      {/* Sidebar / Dashboard */}
      <div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-blue-800 bg-[#1E40AF]">
          <div className="flex items-center gap-3 mb-1">
             <div className="p-2 bg-white/20 rounded-lg text-white">
                <LayoutDashboard size={20} />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white">Smart Scheduler</h1>
          </div>
          <p className="text-xs text-blue-100 uppercase tracking-wider font-semibold">AI Powered Planner</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <span className="text-blue-600 text-sm font-semibold">Scheduled</span>
                <p className="text-2xl font-bold text-slate-900">{schedule.blocks.length}</p>
             </div>
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <span className="text-orange-600 text-sm font-semibold">Rollover</span>
                <p className="text-2xl font-bold text-slate-900">{schedule.rolloverTasks.length}</p>
             </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                 <Settings size={16} /> Configuration
               </h3>
             </div>
             <div className="bg-gray-50 p-4 rounded-xl space-y-3">
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Buffer (Min)</label>
                 <input 
                   type="range" 
                   min="0" 
                   max="30" 
                   step="5"
                   value={settings.bufferMinutes}
                   onChange={e => setSettings({...settings, bufferMinutes: Number(e.target.value)})}
                   className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-slate-900 mt-2"
                 />
                 <div className="flex justify-between text-xs text-gray-400 mt-1">
                   <span>0m</span>
                   <span className="text-slate-900 font-bold">{settings.bufferMinutes}m</span>
                   <span>30m</span>
                 </div>
               </div>
             </div>
          </div>

          {/* Rollover / Unscheduled List */}
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="text-orange-500" /> Rollover / Pending
            </h3>
            {schedule.rolloverTasks.length === 0 ? (
              <div className="text-sm text-gray-400 italic">No rollover tasks. Good job!</div>
            ) : (
              <ul className="space-y-2">
                {schedule.rolloverTasks.map(task => (
                  <li key={task.id} className="bg-white border border-l-4 border-l-orange-400 border-gray-200 p-3 rounded-lg shadow-sm group hover:border-orange-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="font-medium text-sm block">{task.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{task.durationMinutes}m</span>
                           {task.isSplittable && (
                            <span className="flex items-center gap-1 text-xs text-blue-500">
                              <Split size={10} /> Splittable
                            </span>
                           )}
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Delete Task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        <div className="p-6 border-t border-gray-200">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            <Plus size={20} /> Add Task
          </button>
        </div>
      </div>

      {/* Main Timeline View */}
      <div className="flex-1 h-screen overflow-y-auto relative bg-gray-50/50">
        <div className="p-8 max-w-4xl mx-auto">
          
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Today's Timeline</h2>
              <p className="text-gray-500">Automated schedule based on your priorities.</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-600">Legend</div>
              <div className="flex gap-3 text-xs mt-1">
                 <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 rounded"></div> Fixed</div>
                 <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border-2 border-slate-300 border-dashed rounded"></div> Flexible</div>
                 <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div> Interrupt</div>
              </div>
            </div>
          </div>

          <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: `${VIEW_HEIGHT + 100}px` }}>
            
            {/* Hour Grid Lines */}
            {hours.map(hour => (
              <div 
                key={hour} 
                className="absolute w-full border-t border-gray-100 flex items-center"
                style={{ top: `${(timeToMinutes(`${hour}:00`) - START_OF_DAY_MINUTES) * PIXELS_PER_MINUTE}px` }}
              >
                <span className="absolute -left-12 text-xs font-medium text-gray-400 w-10 text-right">
                  {hour > 12 ? `${hour-12} PM` : `${hour} ${hour === 12 ? 'PM' : 'AM'}`}
                </span>
              </div>
            ))}

            {/* Current Time Indicator (Visual Mock) */}
            <div 
              className="absolute w-full border-t-2 border-red-400 z-10 pointer-events-none opacity-50"
              style={{ top: `${(timeToMinutes("14:15") - START_OF_DAY_MINUTES) * PIXELS_PER_MINUTE}px` }}
            >
               <div className="absolute -left-2 -top-1.5 w-3 h-3 bg-red-400 rounded-full"></div>
            </div>


            {/* Blocks */}
            <div className="absolute left-4 right-4 top-0 bottom-0">
              {schedule.blocks.map(block => {
                 const isFixed = block.isLocked;
                 const isInterrupt = block.taskType === TaskType.INTERRUPT;
                 
                 return (
                  <div
                    key={block.id}
                    style={getBlockStyle(block)}
                    className={`absolute left-0 right-0 rounded-lg px-4 py-2 transition-all hover:shadow-md cursor-pointer group
                      ${isInterrupt 
                        ? 'bg-red-50 border-l-4 border-red-500 text-red-900' 
                        : isFixed 
                          ? 'bg-slate-800 text-white border-l-4 border-slate-600' 
                          : 'bg-white border-2 border-dashed border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex justify-between items-start h-full">
                      <div className="flex flex-col h-full overflow-hidden">
                        <span className={`text-xs font-semibold uppercase tracking-wider mb-1 opacity-70
                           ${isFixed ? 'text-slate-300' : 'text-slate-500'}
                        `}>
                          {minutesToTime(block.startTime)} - {minutesToTime(block.endTime)}
                        </span>
                        <h4 className="font-bold text-sm md:text-base line-clamp-2 leading-tight">
                          {block.taskTitle}
                        </h4>
                        
                        {/* Task Type Badge */}
                         <div className="mt-auto pt-2 flex items-center gap-2">
                            {block.priority === 1 && !isFixed && (
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                 High Priority
                               </span>
                            )}
                            {block.id.includes('part') && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                <Split size={10} /> Split
                              </span>
                            )}
                         </div>

                      </div>
                      
                      {/* Hover Info & Controls */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             deleteTask(block.taskId);
                           }}
                           className={`p-1.5 rounded hover:bg-black/20 ${isFixed ? 'text-white' : 'text-gray-500 hover:text-red-500'}`}
                           title="Delete Task"
                         >
                           <Trash2 size={14} />
                         </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={addTask} />
    </div>
  );
};

export default App;