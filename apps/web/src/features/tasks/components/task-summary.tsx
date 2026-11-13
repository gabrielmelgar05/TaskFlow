import { Icon, type IconName } from "@/components/ui/icon";
import type { TaskSummary as Summary } from "../types";
const indicators: {
  key: keyof Summary;
  label: string;
  icon: IconName;
  color: string;
}[] = [
  {
    key: "total",
    label: "Total de tarefas",
    icon: "layers",
    color: "metric-blue",
  },
  {
    key: "inProgress",
    label: "Em andamento",
    icon: "refresh",
    color: "metric-yellow",
  },
  {
    key: "completed",
    label: "Concluídas",
    icon: "target",
    color: "metric-green",
  },
  { key: "overdue", label: "Atrasadas", icon: "alert", color: "metric-pink" },
];
export function TaskSummary({ metrics }: { metrics: Summary }) {
  return (
    <section
      className="dashboard-metrics"
      aria-label="Resumo de tarefas do workspace"
    >
      <dl>
        {indicators.map((item) => (
          <div className={`dashboard-metric ${item.color}`} key={item.key}>
            <dt>
              <span>{item.label}</span>
              <Icon name={item.icon} width="18" height="18" />
            </dt>
            <dd>{metrics[item.key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
