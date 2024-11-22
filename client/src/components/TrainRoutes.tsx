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

interface Location {
  id: number;
  name: string;
  code: string;
}

interface ExtendedSchedule extends Schedule {
  departureLocation?: Location;
  arrivalLocation?: Location;
}

interface TrainRouteProps {
  schedules: ExtendedSchedule[];
}

export default function TrainRoutes({ schedules }: TrainRouteProps) {
  const formatDuration = (startDate: Date, endDate: Date) => {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };
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
          <TableHead>Train Number</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Departure</TableHead>
          <TableHead>Arrival</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Running Days</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Effective Period</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => (
          <TableRow key={schedule.id}>
            <TableCell>{schedule.train?.trainNumber || schedule.trainId}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {schedule.train?.type?.toUpperCase() || 'Unknown'}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{schedule.departureLocation?.name || schedule.departureLocationId}</span>
                <span className="text-xs text-muted-foreground">{schedule.departureLocation?.code}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{schedule.arrivalLocation?.name || schedule.arrivalLocationId}</span>
                <span className="text-xs text-muted-foreground">{schedule.arrivalLocation?.code}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{format(new Date(schedule.scheduledDeparture), 'HH:mm')}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(schedule.scheduledDeparture), 'dd MMM yyyy')}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{format(new Date(schedule.scheduledArrival), 'HH:mm')}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(schedule.scheduledArrival), 'dd MMM yyyy')}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {formatDuration(new Date(schedule.scheduledDeparture), new Date(schedule.scheduledArrival))}
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
