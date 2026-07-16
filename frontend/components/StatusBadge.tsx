const STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  matched: "bg-blue-100 text-blue-800",
  in_progress: "bg-violet-100 text-violet-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
  planned: "bg-amber-100 text-amber-800",
  available: "bg-green-100 text-green-800",
  on_trip: "bg-blue-100 text-blue-800",
  maintenance: "bg-red-100 text-red-800",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status.replace("_", " ")}
    </span>
  );
}
