"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";

export type ConsumptionChartPoint = {
  monthKey: string;
  monthLabel: string;
  storageEur: number;
  cardFeeEur: number;
  totalEur: number;
  storageGb: number;
};

type ConsumptionChartProps = {
  data: ConsumptionChartPoint[];
};

function formatEurShort(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function ChartTooltip({
  active,
  payload,
  labels,
}: {
  active?: boolean;
  payload?: Array<{ payload: ConsumptionChartPoint }>;
  labels: {
    storage: string;
    cardFee: string;
    total: string;
    peakStorage: string;
  };
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-zinc-900">{point.monthLabel}</p>
      <p className="text-zinc-600">
        {labels.peakStorage}: {point.storageGb.toFixed(2)} Go
      </p>
      <p className="text-zinc-600">
        {labels.storage}: {formatEurShort(point.storageEur)}
      </p>
      <p className="text-zinc-600">
        {labels.cardFee}: {formatEurShort(point.cardFeeEur)}
      </p>
      <p className="font-medium text-zinc-900">
        {labels.total}: {formatEurShort(point.totalEur)}
      </p>
    </div>
  );
}

export function ConsumptionChart({ data }: ConsumptionChartProps) {
  const t = useTranslations("usage");

  if (data.length === 0) {
    return null;
  }

  const labels = {
    storage: t("colConsumption"),
    cardFee: t("colCardFee"),
    total: t("colTotal"),
    peakStorage: t("colStoragePeak"),
  };

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={t("chartAriaLabel")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis
            dataKey="monthLabel"
            tick={{ fill: "#71717a", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value} €`}
            width={56}
          />
          <Tooltip
            content={<ChartTooltip labels={labels} />}
            cursor={{ fill: "rgba(24, 24, 27, 0.04)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#71717a" }}
            formatter={(value) =>
              value === "storageEur" ? labels.storage : labels.cardFee
            }
          />
          <Bar
            dataKey="storageEur"
            name="storageEur"
            stackId="invoice"
            fill="#18181b"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="cardFeeEur"
            name="cardFeeEur"
            stackId="invoice"
            fill="#a1a1aa"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
