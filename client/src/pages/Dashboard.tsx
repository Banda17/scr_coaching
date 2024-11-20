import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { fetchSchedules } from "../lib/api";
import type { Schedule } from "@db/schema";
import TimelineView from "../components/TimelineView";
import TrainList from "../components/TrainList";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, BarChart as ChartBar } from "lucide-react";
import TrainControls from "../components/TrainControls";

export default function Dashboard() {
  const { data: schedules, isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: () => fetchSchedules()
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Railway Operations Dashboard</h1>
        <div className="flex items-center gap-4">
          <TrainControls />
          <Link href="/analytics">
            <Button variant="outline">
              <ChartBar className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link href="/schedules">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Schedule
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Trains</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">
              {schedules?.filter(s => s.status === 'running').length || 0}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">
              {schedules?.length || 0}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delayed Trains</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-red-500">
              {schedules?.filter(s => s.status === 'delayed').length || 0}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2" />
              Timeline View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimelineView schedules={schedules || []} />
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Today's Train List</CardTitle>
          </CardHeader>
          <CardContent>
            <TrainList schedules={schedules || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
