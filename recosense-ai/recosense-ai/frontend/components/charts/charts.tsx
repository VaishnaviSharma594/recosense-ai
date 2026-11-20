"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const PALETTE = { primary: "#2563EB", secondary: "#7C3AED", success: "#10B981", warning: "#F59E0B", danger: "#EF4444", slate: "#94A3B8", cyan: "#0891B2" };
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--foreground)" };
const axis = { tick: { fontSize: 11, fill: "var(--muted)" }, tickLine: false, axisLine: false } as const;

type Datum = Record<string, string | number>;
export interface SeriesDef { key: string; label: string; color: string }

export function DonutChart({ data, height = 220, centerLabel }: { data: { name: string; value: number; color: string }[]; height?: number; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(1)}%`} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="font-display text-2xl font-bold">{centerLabel}</p><p className="text-xs text-muted">{total ? "positive" : ""}</p></div>
        </div>
      )}
    </div>
  );
}

export function SimpleBarChart({ data, x, series, height = 260, stacked, horizontal, ratio }: {
  data: Datum[]; x: string; series: SeriesDef[]; height?: number; stacked?: boolean; horizontal?: boolean;
  /** values are 0–1 ratios: fixes the axis to 0–100% */
  ratio?: boolean;
}) {
  const fmt = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 10 : -16, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!horizontal ? false : true} horizontal={!horizontal} />
        {horizontal ? (<><XAxis type="number" {...axis} /><YAxis type="category" dataKey={x} {...axis} width={120} /></>)
          : (<><XAxis dataKey={x} {...axis} />{ratio ? <YAxis {...axis} domain={[0, 1]} tickFormatter={fmt} /> : <YAxis {...axis} allowDecimals={false} />}</>)}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={ratio ? (v) => fmt(Number(v)) : undefined} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? "a" : undefined}
            radius={stacked && i < series.length - 1 ? 0 : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={44} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({ data, x, series, height = 260, yDomain }: { data: Datum[]; x: string; series: SeriesDef[]; height?: number; yDomain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={24} />
        <YAxis {...axis} domain={yDomain} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />}
        {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
