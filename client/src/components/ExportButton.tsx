import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { Schedule } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

export default function ExportButton() {
  const { toast } = useToast();
  const { data: schedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const response = await fetch('/api/schedules/export');
      if (!response.ok) {
        throw new Error('Failed to export schedules');
      }
      const result = await response.json();
      return result.data as Schedule[];
    }
  });

  const handleExport = () => {
    if (!schedules) return;
    
    try {
      // Transform the data to match the import schema
      const exportData = schedules.map(schedule => ({
        trainId: schedule.trainId,
        departureLocationId: schedule.departureLocationId,
        arrivalLocationId: schedule.arrivalLocationId,
        scheduledDeparture: schedule.scheduledDeparture.toISOString(),
        scheduledArrival: schedule.scheduledArrival.toISOString(),
        status: schedule.status,
        isCancelled: schedule.isCancelled,
        runningDays: schedule.runningDays,
        effectiveStartDate: schedule.effectiveStartDate.toISOString(),
        effectiveEndDate: schedule.effectiveEndDate ? schedule.effectiveEndDate.toISOString() : null
      }));
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'railway_schedules.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Schedule data has been exported to JSON"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export schedule data",
        variant: "destructive"
      });
    }
  };

  return (
    <Button onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Export Schedules
    </Button>
  );
}
