import { useQuery } from "@tanstack/react-query";
import { fetchTrains, fetchLocations, fetchSchedules } from "../lib/api";
import ScheduleForm from "../components/ScheduleForm";
import ScheduleStats from "../components/ScheduleStats";
import { Card } from "@/components/ui/card";
import ExportButton from "../components/ExportButton";
import { ArrowLeft } from "lucide-react";
import ImportSchedules from "../components/ImportSchedules";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Schedules() {
  const { data: trains } = useQuery({
    queryKey: ['trains'],
    queryFn: fetchTrains
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations
  });

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
          <h1 className="text-3xl font-bold">Schedule Management</h1>
        </div>
        <div className="flex items-center gap-4">
          <ImportSchedules />
          <ExportButton />
        </div>
      </div>

      <Card>
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="create">Create Schedule</TabsTrigger>
            <TabsTrigger value="statistics">Schedule Statistics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create" className="mt-4">
            <ScheduleForm
              trains={trains || []}
              locations={locations || []}
            />
          </TabsContent>
          
          <TabsContent value="statistics" className="mt-4">
            <ScheduleStats schedules={schedules || []} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
