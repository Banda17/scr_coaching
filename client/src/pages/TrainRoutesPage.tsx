import { useQuery } from "@tanstack/react-query";
import { fetchSchedules } from "../lib/api";
import TrainRoutes from "../components/TrainRoutes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Route } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function TrainRoutesPage() {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules
  });

  if (isLoading) {
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Route className="h-8 w-8" />
            Train Routes
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Route Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <TrainRoutes schedules={schedules || []} />
        </CardContent>
      </Card>
    </div>
  );
}
