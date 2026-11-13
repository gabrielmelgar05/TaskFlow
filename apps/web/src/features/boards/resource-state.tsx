import { Button } from "@/components/ui/button";
export function ResourceLoading({
  label = "Carregando seus projetos…",
}: {
  label?: string;
}) {
  return (
    <div className="resource-loading" role="status">
      <span className="loading-ring" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
export function ResourceError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="resource-error">
      <p role="alert">{message}</p>
      <Button variant="secondary" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
