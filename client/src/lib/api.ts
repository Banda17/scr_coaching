export async function fetchSchedules() {
  const response = await fetch('/api/schedules');
  if (!response.ok) throw new Error('Failed to fetch schedules');
  return response.json();
}

export async function fetchTrains() {
  const response = await fetch('/api/trains');
  if (!response.ok) throw new Error('Failed to fetch trains');
  return response.json();
}

export async function fetchLocations() {
  const response = await fetch('/api/locations');
  if (!response.ok) throw new Error('Failed to fetch locations');
  return response.json();
}
