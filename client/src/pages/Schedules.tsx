import { useQuery } from "@tanstack/react-query";
import { fetchTrains, fetchLocations, fetchSchedules } from "../lib/api";
import type { Train, Location, Schedule } from "@db/schema";
import ScheduleForm from "../components/ScheduleForm";
import { Card } from "@/components/ui/card";
import ExportButton from "../components/ExportButton";
import { ArrowLeft } from "lucide-react";
import ImportSchedules from "../components/ImportSchedules";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function Schedules() {
  // Fetch all required data upfront
  const { 
    data: trains = [] as Train[], 
    isLoading: isLoadingTrains, 
    error: trainsError 
  } = useQuery<Train[]>({
    queryKey: ['trains'],
    queryFn: fetchTrains,
    retry: 3,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Handle side effects using useEffect instead
  useEffect(() => {
    if (trainsError) {
      console.error('[Schedules] Failed to fetch trains:', trainsError);
    }
  }, [trainsError]);

  useEffect(() => {
    if (trains) {
      console.log('[Schedules] Successfully fetched trains:', {
        count: trains.length || 0,
        sample: trains[0] || null
      });
    }
  }, [trains]);

  const { 
    data: locations = [] as Location[], 
    isLoading: isLoadingLocations, 
    error: locationsError 
  } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: fetchLocations
  });

  const { 
    data: schedules = [] as Schedule[], 
    isLoading: isLoadingSchedules, 
    error: schedulesError 
  } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: fetchSchedules
  });

  // Debug logging effect
  useEffect(() => {
    console.log('Schedules Page - Data state:', {
      trains: {
        data: trains || [],
        isArray: Array.isArray(trains),
        length: trains?.length || 0,
        sampleTrain: trains?.[0] || null,
        loading: isLoadingTrains,
        error: trainsError instanceof Error ? trainsError.message : String(trainsError)
      },
      locations: {
        length: locations?.length || 0,
        loading: isLoadingLocations,
        error: locationsError instanceof Error ? locationsError.message : String(locationsError)
      },
      schedules: {
        length: schedules?.length || 0,
        loading: isLoadingSchedules,
        error: schedulesError instanceof Error ? schedulesError.message : String(schedulesError)
      }
    });
  }, [trains, locations, schedules, isLoadingTrains, isLoadingLocations, isLoadingSchedules, trainsError, locationsError, schedulesError]);

  // Handle loading and error states
  if (isLoadingTrains || isLoadingLocations || isLoadingSchedules) {
    return <div className="container mx-auto p-4">Loading data...</div>;
  }

  if (trainsError || locationsError || schedulesError) {
    return (
      <div className="container mx-auto p-4 text-red-500">
        {trainsError && <div>Error loading trains: {trainsError instanceof Error ? trainsError.message : String(trainsError)}</div>}
        {locationsError && <div>Error loading locations: {locationsError instanceof Error ? locationsError.message : String(locationsError)}</div>}
        {schedulesError && <div>Error loading schedules: {schedulesError instanceof Error ? schedulesError.message : String(schedulesError)}</div>}
      </div>
    );
  }

  if (!trains || trains.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <div className="mt-4">No trains available. Please add trains first.</div>
      </div>
    );
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
          <h1 className="text-3xl font-bold">Schedule Management</h1>
        </div>
        <div className="flex items-center gap-4">
          <ImportSchedules />
          <ExportButton />
        </div>
      </div>

      <Card className="p-6">
        <ScheduleForm
          trains={trains}
          locations={locations}
        />
      </Card>
    </div>
  );
}
