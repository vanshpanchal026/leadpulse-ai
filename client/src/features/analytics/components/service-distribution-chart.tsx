import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import { EChartsContainer } from './echarts-container';
import { NormalizedLead } from '@/features/leads/types';
import { computeServiceDistribution } from '../export-utils';

interface ServiceDistributionChartProps {
  leads: NormalizedLead[];
  height?: string | number;
}

const PALETTE = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#64748b'];

export function ServiceDistributionChart({ leads, height = 280 }: ServiceDistributionChartProps) {
  const items = useMemo(() => computeServiceDistribution(leads), [leads]);

  const option = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <span style="font-weight:bold;color:#2563eb">{c}</span> leads ({d}%)',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#0f172a', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px;',
      },
      legend: {
        bottom: '0%',
        left: 'center',
        textStyle: { color: '#334155', fontSize: 11, fontWeight: 500 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          name: 'Recommended Service',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#ffffff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold',
              color: '#0f172a',
            },
          },
          labelLine: {
            show: false,
          },
          data: items.map((item, idx) => ({
            name: item.service,
            value: item.count,
            itemStyle: { color: PALETTE[idx % PALETTE.length] },
          })),
        },
      ],
    };
  }, [items]);

  return <EChartsContainer option={option} height={height} />;
}
