import { Button } from "@/components/ui/button";
import { Play, Pause, AlertTriangle } from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import { useQuery } from "@tanstack/react-query";
import { fetchSchedules } from "../lib/api";
import type { Schedule } from "@db/schema";

export default function TrainControls() {
  const { updateSchedule } = useSocket();
  const { data: schedules } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: fetchSchedules
  });

  const selectedSchedule = schedules?.find(s => !s.isCancelled && s.status !== 'completed');

  if (!selectedSchedule) return null;

  return (
    <div className="flex items-center gap-2 border rounded-lg px-2 py-1 bg-background">
      <span className="text-sm font-medium mr-2">
        Train {selectedSchedule.trainId}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="hover:bg-primary/20 transition-colors border-2"
        onClick={() => updateSchedule({
          id: selectedSchedule.id,
          status: 'running',
          actualDeparture: new Date().toISOString()
        })}
        disabled={selectedSchedule.status === 'running'}
        title="Start Train"
      >
        <Play className="h-4 w-4" />
        <span className="ml-2">Start</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="hover:bg-primary/20 transition-colors border-2"
        onClick={() => updateSchedule({
          id: selectedSchedule.id,
          status: 'delayed',
        })}
        disabled={selectedSchedule.status === 'delayed'}
        title="Mark as Delayed"
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="ml-2">Delay</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="hover:bg-primary/20 transition-colors border-2"
        onClick={() => updateSchedule({
          id: selectedSchedule.id,
          status: 'completed',
          actualArrival: new Date().toISOString()
        })}
        disabled={selectedSchedule.status === 'completed'}
        title="Complete Journey"
      >
        <Pause className="h-4 w-4" />
        <span className="ml-2">Complete</span>
      </Button>
    </div>
  );
}
