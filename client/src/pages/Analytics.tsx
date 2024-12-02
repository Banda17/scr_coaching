import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface RoutePerformance {
  departureId: number;
  departureName: string;
  totalTrips: number;
  completedTrips: number;
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
    completed: number;
  };
  trainUtilization: TrainUtilization[];
  routePerformance: RoutePerformance[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']; // Blue for Scheduled, Green for Completed, Amber for Delayed, Red for Cancelled

async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch('/api/analytics/schedule-metrics');
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
}

export default function Analytics() {
  const { data: analytics, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    refetchInterval: 5000, // Refetch every 5 seconds for more real-time updates
    staleTime: 1000 * 60 * 5 // Consider data stale after 5 minutes
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
            <CardTitle>Completed Journeys</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-green-500">
              {analytics?.overview.completed || 0}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
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
                  <Legend />
                  <Bar dataKey="schedules" fill="#22c55e" name="Total Schedules" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { 
                        name: 'Scheduled', 
                        value: (analytics?.overview?.total ?? 0) - 
                               (analytics?.overview?.delayed ?? 0) - 
                               (analytics?.overview?.cancelled ?? 0) - 
                               (analytics?.overview?.completed ?? 0)
                      },
                      { name: 'Completed', value: analytics?.overview?.completed ?? 0 },
                      { name: 'Delayed', value: analytics?.overview?.delayed ?? 0 },
                      { name: 'Cancelled', value: analytics?.overview?.cancelled ?? 0 }
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route Performance Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={analytics?.routePerformance.map(route => ({
                    name: route.departureName,
                    totalTrips: route.totalTrips,
                    delayedTrips: route.delayedTrips,
                    avgDelay: route.avgDelayMinutes || 0
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="#22c55e" />
                  <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalTrips" fill="#22c55e" name="Total Trips" />
                  <Bar yAxisId="right" dataKey="delayedTrips" fill="#f59e0b" name="Delayed Trips" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peak Hour Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics?.routePerformance.map(route => ({
                    name: route.departureName,
                    peakTrips: route.peakHourTrips,
                    totalTrips: route.totalTrips,
                    peakPercentage: ((route.peakHourTrips / route.totalTrips) * 100).toFixed(1)
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="peakTrips" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Peak Hour Trips" />
                  <Area type="monotone" dataKey="totalTrips" stackId="1" stroke="#22c55e" fill="#22c55e" name="Total Trips" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <th className="text-left p-2">Completed</th>
                  <th className="text-left p-2">Delayed Trips</th>
                  <th className="text-left p-2">Completion Rate</th>
                  <th className="text-left p-2">Avg Delay</th>
                  <th className="text-left p-2">Peak Hour Trips</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.routePerformance.map((route: any) => (
                  <tr key={`${route.departureId}-${route.arrivalId}`}>
                    <td className="p-2">{route.departureName}</td>
                    <td className="p-2">{route.totalTrips}</td>
                    <td className="p-2">{route.completedTrips}</td>
                    <td className="p-2">{route.delayedTrips}</td>
                    <td className="p-2">
                      {route.totalTrips > 0 
                        ? ((route.completedTrips / route.totalTrips) * 100).toFixed(1)
                        : '0'}%
                    </td>
                    <td className="p-2">
                      {typeof route.avgDelayMinutes === 'number' 
                        ? `${route.avgDelayMinutes.toFixed(1)} mins`
                        : '0 mins'}
                    </td>
                    <td className="p-2">
                      {route.peakHourTrips} ({route.totalTrips > 0 
                        ? ((route.peakHourTrips / route.totalTrips) * 100).toFixed(1)
                        : '0'}%)
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
