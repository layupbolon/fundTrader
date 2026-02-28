export default function ErrorMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="bg-danger-50 text-danger-700 rounded-lg p-4 max-w-md text-center">
        <p className="text-sm">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
