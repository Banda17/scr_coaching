import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface RoutePerformance {
  departureId: number;
  departureName: string;
  arrivalId: number;
  totalTrips: number;
  delayedTrips: number;
  avgDelayMinutes: number | null;
  peakHourTrips: number;
}

interface TrainUtilization {
  trainId: number;
  trainNumber: string;
  scheduleCount: number;
}

interface AnalyticsData {
  overview: {
    total: number;
    delayed: number;
    cancelled: number;
  };
  trainUtilization: TrainUtilization[];
  routePerformance: RoutePerformance[];
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch('/api/analytics/schedule-metrics');
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
}

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics
  });

  if (isLoading) {
    return <div>Loading analytics...</div>;
  }

  const utilizationData = analytics?.trainUtilization.map((item: any) => ({
    name: item.trainNumber,
    schedules: item.scheduleCount
  }));

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Railway Analytics</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">
              {analytics?.overview.total || 0}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delayed Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-amber-500">
              {analytics?.overview.delayed || 0}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancelled Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-red-500">
              {analytics?.overview.cancelled || 0}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Train Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="schedules" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Departure Station</th>
                  <th className="text-left p-2">Total Trips</th>
                  <th className="text-left p-2">Delayed Trips</th>
                  <th className="text-left p-2">Delay Rate</th>
                  <th className="text-left p-2">Avg Delay</th>
                  <th className="text-left p-2">Peak Hour Trips</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.routePerformance.map((route: any) => (
                  <tr key={`${route.departureId}-${route.arrivalId}`}>
                    <td className="p-2">{route.departureName}</td>
                    <td className="p-2">{route.totalTrips}</td>
                    <td className="p-2">{route.delayedTrips}</td>
                    <td className="p-2">
                      {((route.delayedTrips / route.totalTrips) * 100).toFixed(1)}%
                    </td>
                    <td className="p-2">
                      {route.avgDelayMinutes?.toFixed(1) || 0} mins
                    </td>
                    <td className="p-2">
                      {route.peakHourTrips} ({((route.peakHourTrips / route.totalTrips) * 100).toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
