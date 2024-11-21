import { useQuery } from "@tanstack/react-query";
import { fetchTrains, fetchSchedules } from "../lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import type { Train, Schedule } from "@db/schema";
import { cn } from "@/lib/utils";

type SortField = 'trainNumber' | 'type' | 'description' | 'scheduleCount';
type SortOrder = 'asc' | 'desc';

export default function TrainsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all"); // Default to 'all'
  const [sortConfig, setSortConfig] = useState<{
    field: SortField;
    order: SortOrder;
  }>({
    field: 'trainNumber',
    order: 'asc'
  });

  const { data: trains, isLoading: isLoadingTrains } = useQuery<Train[]>({
    queryKey: ['trains'],
    queryFn: fetchTrains
  });

  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: fetchSchedules
  });

  const trainData = useMemo(() => {
    if (!trains || !schedules) return [];

    return trains.map(train => ({
      ...train,
      scheduleCount: schedules.filter(s => s.trainId === train.id).length,
      currentStatus: schedules.find(s => 
        s.trainId === train.id && 
        (s.status === 'running' || s.status === 'delayed')
      )?.status || 'idle'
    }));
  }, [trains, schedules]);

  const filteredAndSortedTrains = useMemo(() => {
    return trainData
      .filter(train => 
        train.trainNumber.toLowerCase().includes(search.toLowerCase()) ||
        train.description?.toLowerCase().includes(search.toLowerCase())
      )
      .filter(train => typeFilter === 'all' || train.type === typeFilter) // Update to check for 'all'
      .sort((a, b) => {
        const order = sortConfig.order === 'asc' ? 1 : -1;
        if (sortConfig.field === 'scheduleCount') {
          return (a.scheduleCount - b.scheduleCount) * order;
        }
        return String(a[sortConfig.field]).localeCompare(String(b[sortConfig.field])) * order;
      });
  }, [trainData, search, typeFilter, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig(current => ({
      field,
      order: current.field === field && current.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'delayed':
        return 'bg-amber-500';
      default:
        return 'bg-slate-500';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'express':
        return 'bg-blue-500';
      case 'local':
        return 'bg-green-500';
      case 'freight':
        return 'bg-amber-500';
      case 'special':
        return 'bg-purple-500';
      default:
        return 'bg-slate-500';
    }
  };

  if (isLoadingTrains || isLoadingSchedules) {
    return <div>Loading...</div>;
  }

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
          <h1 className="text-3xl font-bold">Trains Management</h1>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search trains..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={typeFilter}
          onValueChange={setTypeFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem> {/* Use 'all' here */}
            <SelectItem value="express">Express</SelectItem>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="freight">Freight</SelectItem>
            <SelectItem value="special">Special</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('trainNumber')} className="cursor-pointer">
                <div className="flex items-center gap-2">
                  Train Number
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort('type')} className="cursor-pointer">
                <div className="flex items-center gap-2">
                  Type
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort('description')} className="cursor-pointer">
                <div className="flex items-center gap-2">
                  Description
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Current Status</TableHead>
              <TableHead onClick={() => handleSort('scheduleCount')} className="cursor-pointer">
                <div className="flex items-center gap-2">
                  Schedule Count
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTrains.map((train) => (
              <TableRow key={train.id}>
                <TableCell>{train.trainNumber}</TableCell>
                <TableCell>
                  <Badge className={cn("text-white", getTypeColor(train.type))}>
                    {train.type}
                  </Badge>
                </TableCell>
                <TableCell>{train.description}</TableCell>
                <TableCell>
                  <Badge className={cn("text-white", getStatusColor(train.currentStatus))}>
                    {train.currentStatus}
                  </Badge>
                </TableCell>
                <TableCell>{train.scheduleCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}