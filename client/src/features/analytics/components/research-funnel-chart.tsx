import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import { EChartsContainer } from './echarts-container';
import { NormalizedLead } from '@/features/leads/types';
import { ResearchRunRecord } from '@/features/research/types';
import { computeFunnelMetrics } from '../export-utils';

interface ResearchFunnelChartProps {
  leads: NormalizedLead[];
  runs?: ResearchRunRecord[];
  height?: string | number;
}

const FUNNEL_COLORS = ['#38bdf8', '#2563eb', '#6366f1', '#8b5cf6', '#10b981', '#059669'];

export function ResearchFunnelChart({ leads, runs = [], height = 280 }: ResearchFunnelChartProps) {
  const stages = useMemo(() => computeFunnelMetrics(leads, runs), [leads, runs]);

  const option = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <span style="font-weight:bold;color:#2563eb">{c}</span> leads',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#0f172a', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px;',
      },
      series: [
        {
          name: 'Research Pipeline Yield',
          type: 'funnel',
          left: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          min: 0,
          max: stages[0]?.count || 100,
          minSize: '15%',
          maxSize: '100%',
          sort: 'descending',
          gap: 3,
          label: {
            show: true,
            position: 'inside',
            formatter: '{b} ({c})',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
          },
          labelLine: {
            length: 10,
            lineStyle: { width: 1, type: 'solid' },
          },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
          },
          emphasis: {
            label: {
              fontSize: 13,
              fontWeight: 'bold',
            },
          },
          data: stages.map((s, idx) => ({
            name: s.stage,
            value: s.count,
            itemStyle: { color: FUNNEL_COLORS[idx % FUNNEL_COLORS.length] },
          })),
        },
      ],
    };
  }, [stages]);

  return <EChartsContainer option={option} height={height} />;
}
