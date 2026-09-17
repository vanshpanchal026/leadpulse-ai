import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import { EChartsContainer } from './echarts-container';
import { NormalizedLead } from '@/features/leads/types';
import { computeScoreDistribution } from '../export-utils';

interface ScoreDistributionChartProps {
  leads: NormalizedLead[];
  height?: string | number;
}

export function ScoreDistributionChart({ leads, height = 280 }: ScoreDistributionChartProps) {
  const tiers = useMemo(() => computeScoreDistribution(leads), [leads]);

  const option = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#0f172a', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px;',
      },
      grid: {
        top: '14%',
        left: '3%',
        right: '4%',
        bottom: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: ['Immediate (≥80)', 'High Potential (60–79)', 'Medium (40–59)', 'Low (<40)'],
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#334155', fontSize: 11, fontWeight: 500 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          name: 'Leads Count',
          type: 'bar',
          barWidth: '40%',
          data: [
            {
              value: tiers.immediate,
              itemStyle: { color: '#10b981', borderRadius: [6, 6, 0, 0] },
            },
            {
              value: tiers.high,
              itemStyle: { color: '#2563eb', borderRadius: [6, 6, 0, 0] },
            },
            {
              value: tiers.medium,
              itemStyle: { color: '#f59e0b', borderRadius: [6, 6, 0, 0] },
            },
            {
              value: tiers.low,
              itemStyle: { color: '#64748b', borderRadius: [6, 6, 0, 0] },
            },
          ],
          label: {
            show: true,
            position: 'top',
            color: '#0f172a',
            fontSize: 12,
            fontWeight: 600,
          },
        },
      ],
    };
  }, [tiers]);

  return <EChartsContainer option={option} height={height} />;
}
