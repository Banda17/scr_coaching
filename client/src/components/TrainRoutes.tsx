import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import type { Schedule } from "@db/schema";
import { useState, useMemo } from "react";

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

interface ScheduleExportData {
  'Train Number': string | number;
  'Train Type': string;
  'From': string;
  'From Code': string;
  'To': string;
  'To Code': string;
  'Departure': string;
  'Arrival': string;
  'Duration': string;
  'Status': string;
  'Running Days': string;
  'Effective Period': string;
}

export default function TrainRoutes({ schedules }: TrainRouteProps) {
  const [selectedType, setSelectedType] = useState<string>("all");
  
  const formatDuration = (startDate: Date, endDate: Date): string => {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string, isCancelled: boolean): string => {
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

  const filteredSchedules = useMemo(() => {
    return selectedType === "all" 
      ? schedules 
      : schedules.filter(schedule => schedule.train?.type === selectedType);
  }, [schedules, selectedType]);

  const trainTypes = useMemo(() => {
    const types = new Set(
      schedules
        .map(schedule => schedule.train?.type)
        .filter((type): type is string => type !== undefined && type !== null)
    );
    return Array.from(types);
  }, [schedules]);

  const handleDownload = () => {
    const data: ScheduleExportData[] = filteredSchedules.map(schedule => ({
      'Train Number': schedule.train?.trainNumber ?? schedule.trainId ?? 'N/A',
      'Train Type': schedule.train?.type?.toUpperCase() ?? 'Unknown',
      'From': schedule.departureLocation?.name ?? 'N/A',
      'From Code': schedule.departureLocation?.code ?? 'N/A',
      'To': schedule.arrivalLocation?.name ?? 'N/A',
      'To Code': schedule.arrivalLocation?.code ?? 'N/A',
      'Departure': format(new Date(schedule.scheduledDeparture), 'dd/MM/yyyy HH:mm'),
      'Arrival': format(new Date(schedule.scheduledArrival), 'dd/MM/yyyy HH:mm'),
      'Duration': formatDuration(new Date(schedule.scheduledDeparture), new Date(schedule.scheduledArrival)),
      'Status': schedule.isCancelled ? 'Cancelled' : schedule.status,
      'Running Days': schedule.runningDays
        .map((runs, index) => runs ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index] : '')
        .filter(Boolean)
        .join(', '),
      'Effective Period': `${format(new Date(schedule.effectiveStartDate), 'dd/MM/yyyy')}${
        schedule.effectiveEndDate ? ` - ${format(new Date(schedule.effectiveEndDate), 'dd/MM/yyyy')}` : ''
      }`
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Train Schedules');
    
    // Auto-size columns with type-safe access
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(
        key.length,
        ...data.map(row => String(row[key as keyof ScheduleExportData] ?? '').length)
      )
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'train-schedules.xlsx');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {trainTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleDownload} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download Schedules
        </Button>
      </div>

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
          {filteredSchedules.map((schedule) => (
            <TableRow key={schedule.id}>
              <TableCell>{schedule.train?.trainNumber ?? schedule.trainId}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {schedule.train?.type?.toUpperCase() ?? 'Unknown'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{schedule.departureLocation?.name ?? schedule.departureLocationId}</span>
                  <span className="text-xs text-muted-foreground">{schedule.departureLocation?.code}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{schedule.arrivalLocation?.name ?? schedule.arrivalLocationId}</span>
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
    </div>
  );
}
