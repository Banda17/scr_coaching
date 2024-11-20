import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, AlertTriangle } from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import { useQuery } from "@tanstack/react-query";
import { fetchSchedules } from "../lib/api";
import type { Schedule } from "@db/schema";
import { cn } from "@/lib/utils";

export default function TrainControls() {
  const { updateSchedule, isConnected } = useSocket();
  const [isUpdating, setIsUpdating] = useState(false);
  const { data: schedules } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: fetchSchedules
  });

  const selectedSchedule = schedules?.find(s => !s.isCancelled && s.status !== 'completed');

  if (!selectedSchedule) return null;

  const handleUpdateSchedule = async (updateData: {
    status: string;
    actualDeparture?: string | null;
    actualArrival?: string | null;
  }) => {
    setIsUpdating(true);
    try {
      await updateSchedule({
        id: selectedSchedule.id,
        ...updateData
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border rounded-lg px-2 py-1 bg-background">
      <span className="text-sm font-medium mr-2">
        Train {selectedSchedule.trainId}
      </span>
      <div className="flex items-center gap-2">
        {!isConnected && (
          <span className="text-xs text-red-500">Offline</span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="hover:bg-primary/20 transition-colors border-2"
          onClick={() => handleUpdateSchedule({
            status: 'running',
            actualDeparture: new Date().toISOString()
          })}
          disabled={!isConnected || isUpdating || selectedSchedule.status === 'running'}
          title="Start Train"
        >
          <Play className={cn("h-4 w-4", isUpdating && "animate-spin")} />
          <span className="ml-2">Start</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hover:bg-primary/20 transition-colors border-2"
          onClick={() => handleUpdateSchedule({
            status: 'delayed'
          })}
          disabled={!isConnected || isUpdating || selectedSchedule.status === 'delayed'}
          title="Mark as Delayed"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="ml-2">Delay</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hover:bg-primary/20 transition-colors border-2"
          onClick={() => handleUpdateSchedule({
            status: 'completed',
            actualArrival: new Date().toISOString()
          })}
          disabled={!isConnected || isUpdating || selectedSchedule.status === 'completed'}
          title="Complete Journey"
        >
          <Pause className="h-4 w-4" />
          <span className="ml-2">Complete</span>
        </Button>
      </div>
    </div>
  );
}
