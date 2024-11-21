import { useQuery } from "@tanstack/react-query";
import { fetchSchedules } from "../lib/api";
import ScheduleStats from "../components/ScheduleStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ExportButton from "../components/ExportButton";
import { ArrowLeft, BarChart } from "lucide-react";
import ImportSchedules from "../components/ImportSchedules";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function ScheduleStatsPage() {
  const { data: schedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules
  });

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart className="h-8 w-8" />
            Schedule Statistics
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ImportSchedules />
          <ExportButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStats schedules={schedules || []} />
        </CardContent>
      </Card>
    </div>
  );
}
