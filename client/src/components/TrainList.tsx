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
import { useSocket } from "../hooks/useSocket";


interface Train {
  id: number;
  trainNumber: string;
  type: string;
  description?: string;
}

interface Schedule {
  id: number;
  trainId: number | null;
  train?: Train;
  departureLocationId: number | null;
  arrivalLocationId: number | null;
  status: string;
  scheduledDeparture: Date | string;
  scheduledArrival: Date | string;
  actualDeparture: Date | string | null;
  actualArrival: Date | string | null;
  isCancelled: boolean;
}

export default function TrainList({ schedules }: { schedules: Schedule[] }) {
  const { updateSchedule } = useSocket();
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'delayed':
        return 'bg-amber-500';
      case 'cancelled':
        return 'bg-red-500';
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
          <TableHead>Status</TableHead>
          <TableHead>Scheduled Departure</TableHead>
          <TableHead>Scheduled Arrival</TableHead>
          <TableHead>Actual Departure</TableHead>
          <TableHead>Actual Arrival</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => (
          <TableRow key={schedule.id}>
            <TableCell>{schedule.train?.trainNumber || schedule.trainId}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {schedule.train?.type || 'Unknown'}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={getStatusColor(schedule.status)}>
                {schedule.isCancelled ? 'Cancelled' : schedule.status}
              </Badge>
            </TableCell>
            <TableCell>
              {format(new Date(schedule.scheduledDeparture), 'HH:mm')}
            </TableCell>
            <TableCell>
              {format(new Date(schedule.scheduledArrival), 'HH:mm')}
            </TableCell>
            <TableCell>
              {schedule.actualDeparture
                ? format(new Date(schedule.actualDeparture), 'HH:mm')
                : '-'}
            </TableCell>
            <TableCell>
              {schedule.actualArrival
                ? format(new Date(schedule.actualArrival), 'HH:mm')
                : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
