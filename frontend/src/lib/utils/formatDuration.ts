export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0 && minutes === 0) return "0分";
  if (hours === 0) return `${minutes}分`;
  return `${hours}時間${minutes}分`;
}
