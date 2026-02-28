export default function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-primary-600" />
    </div>
  );
}
