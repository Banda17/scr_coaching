import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Schedule } from "@db/schema";

interface TrainRouteProps {
  schedules: Schedule[];
}

export default function TrainRoutes({ schedules }: TrainRouteProps) {
  const getStatusColor = (status: string, isCancelled: boolean) => {
    if (isCancelled) return 'bg-red-500';
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'delayed':
        return 'bg-amber-500';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Train</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Departure</TableHead>
          <TableHead>Arrival</TableHead>
          <TableHead>Running Days</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Effective Period</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => (
          <TableRow key={schedule.id}>
            <TableCell>{schedule.trainId}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {schedule.train?.type?.toUpperCase() || 'Unknown'}
              </Badge>
            </TableCell>
            <TableCell>{schedule.departureLocationId}</TableCell>
            <TableCell>{schedule.arrivalLocationId}</TableCell>
            <TableCell>
              {format(new Date(schedule.scheduledDeparture), 'HH:mm')}
            </TableCell>
            <TableCell>
              {format(new Date(schedule.scheduledArrival), 'HH:mm')}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {schedule.runningDays.map((runs, index) => (
                  <Badge 
                    key={index}
                    variant={runs ? "default" : "outline"}
                    className="w-6 h-6 flex items-center justify-center"
                  >
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <Badge className={getStatusColor(schedule.status, schedule.isCancelled)}>
                {schedule.isCancelled ? 'Cancelled' : schedule.status}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {format(new Date(schedule.effectiveStartDate), 'dd/MM/yyyy')}
              {schedule.effectiveEndDate && (
                <> - {format(new Date(schedule.effectiveEndDate), 'dd/MM/yyyy')}</>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
