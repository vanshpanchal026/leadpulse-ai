import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import { EChartsContainer } from './echarts-container';
import { NormalizedLead } from '@/features/leads/types';
import { computeGeographicDistribution } from '../export-utils';

interface GeographicDistributionChartProps {
  leads: NormalizedLead[];
  height?: string | number;
}

/**
 * Geographic distribution chart mapping Delhi NCR territories (Delhi, Gurgaon, Noida, South Delhi, West Delhi).
 */
export function GeographicDistributionChart({ leads, height = 280 }: GeographicDistributionChartProps) {
  const geoItems = useMemo(() => computeGeographicDistribution(leads), [leads]);

  const option = useMemo<echarts.EChartsOption>(() => {
    const locations = geoItems.map((g) => g.location);
    const counts = geoItems.map((g) => g.count);
    const scores = geoItems.map((g) => g.averageScore);

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
      legend: {
        top: '0%',
        right: '4%',
        textStyle: { color: '#334155', fontSize: 11, fontWeight: 500 },
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: {
        top: '16%',
        left: '3%',
        right: '4%',
        bottom: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: locations,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#334155', fontSize: 11, fontWeight: 500 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Leads',
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
          axisLabel: { color: '#64748b', fontSize: 10 },
          nameTextStyle: { color: '#475569', fontSize: 10, fontWeight: 500 },
        },
        {
          type: 'value',
          name: 'Avg Score',
          max: 100,
          axisLine: { show: false },
          splitLine: { show: false },
          axisLabel: { color: '#64748b', fontSize: 10 },
          nameTextStyle: { color: '#475569', fontSize: 10, fontWeight: 500 },
        },
      ],
      series: [
        {
          name: 'Total Leads',
          type: 'bar',
          data: counts,
          itemStyle: { color: '#2563eb', borderRadius: [6, 6, 0, 0] },
          barWidth: '24%',
        },
        {
          name: 'Avg Opportunity Score',
          type: 'line',
          yAxisIndex: 1,
          data: scores,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 3, color: '#10b981' },
          symbol: 'circle',
          symbolSize: 6,
        },
      ],
    };
  }, [geoItems]);

  return <EChartsContainer option={option} height={height} />;
}
