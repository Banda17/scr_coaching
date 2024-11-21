import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X } from "lucide-react";
import type { Schedule } from "@db/schema";

// Ensure Schedule interface has necessary properties
interface ScheduleStatsProps {
  schedules: Schedule[];
}

export default function ScheduleStats({ schedules }: ScheduleStatsProps) {
  // Group schedules by train
  const trainStats = schedules.reduce((acc, schedule) => {
    const trainId = schedule.trainId;
    if (trainId == null) return acc;  // Adjust to check nullish values

    if (!acc[trainId]) {
      acc[trainId] = {
        trainId,
        totalTrips: 0,
        runningDays: schedule.runningDays || [true, true, true, true, true, true, true],
        dailyFrequency: 0,
        weeklyFrequency: 0
      };
    }

    acc[trainId].totalTrips++;
    acc[trainId].dailyFrequency = acc[trainId].totalTrips / 30; // Approximate daily average
    acc[trainId].weeklyFrequency = acc[trainId].totalTrips / 4; // Approximate weekly average

    return acc;
  }, {} as Record<number | string, {  // Adjust index key type for safety
    trainId: number | string;
    totalTrips: number;
    runningDays: boolean[];
    dailyFrequency: number;
    weeklyFrequency: number;
  }>);

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Train ID</TableHead>
          <TableHead>Total Trips</TableHead>
          <TableHead>Running Days</TableHead>
          <TableHead>Daily Avg</TableHead>
          <TableHead>Weekly Avg</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.values(trainStats).map((stat) => (
          <TableRow key={stat.trainId}>
            <TableCell>{stat.trainId}</TableCell>
            <TableCell>{stat.totalTrips}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                {DAYS.map((day, index) => (
                  <span key={day} className="flex flex-col items-center text-xs">
                    <span>{day}</span>
                    {stat.runningDays[index] ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </span>
                ))}
              </div>
            </TableCell>
            <TableCell>{stat.dailyFrequency.toFixed(1)}</TableCell>
            <TableCell>{stat.weeklyFrequency.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}