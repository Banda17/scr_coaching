import type { Train } from "@db/schema";
export async function fetchSchedules() {
  const response = await fetch('/api/schedules');
  if (!response.ok) throw new Error('Failed to fetch schedules');
  return response.json();
}

export async function fetchTrains() {
  console.log('[Client] Fetching trains...');
  const response = await fetch('/api/trains');
  if (!response.ok) {
    console.error('[Client] Failed to fetch trains:', response.status);
    throw new Error('Failed to fetch trains');
  }
  
  try {
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) {
      console.error('[Client] Invalid trains data format:', result);
      throw new Error('Invalid trains data format');
    }
    
    // Validate the data structure
    const invalidTrain = result.data.find((t: any) => 
      !t || typeof t.id !== 'number' || typeof t.trainNumber !== 'string'
    );
    
    if (invalidTrain) {
      console.error('[Client] Invalid train data structure:', invalidTrain);
      throw new Error('Invalid train data structure');
    }
    
    console.log('[Client] Fetched trains successfully:', {
      count: result.data.length,
      trainNumbers: result.data.map((t: Train) => t.trainNumber)
    });
    
    return result.data;
  } catch (error) {
    console.error('[Client] Error parsing trains response:', error);
    throw new Error('Failed to parse trains response');
  }
}

export async function fetchLocations() {
  const response = await fetch('/api/locations');
  if (!response.ok) throw new Error('Failed to fetch locations');
  return response.json();
}
