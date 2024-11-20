import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { exportToCSV } from "../lib/utils/export";
import { fetchSchedules } from "../lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ExportButton() {
  const { toast } = useToast();
  const { data: schedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules
  });

  const handleExport = () => {
    if (!schedules) return;
    
    try {
      exportToCSV(schedules, 'railway_schedules.csv');
      toast({
        title: "Export successful",
        description: "Schedule data has been exported to CSV"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export schedule data",
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
