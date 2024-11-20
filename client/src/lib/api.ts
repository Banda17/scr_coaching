export async function fetchSchedules(params?: { startDate?: string; endDate?: string }) {
  const queryParams = new URLSearchParams(params);
  const response = await fetch(`/api/schedules?${queryParams}`);
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
