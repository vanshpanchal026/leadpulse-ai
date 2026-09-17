import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';

interface EChartsContainerProps {
  option: echarts.EChartsOption;
  height?: string | number;
  className?: string;
  loading?: boolean;
}

export function EChartsContainer({
  option,
  height = '320px',
  className = '',
  loading = false,
}: EChartsContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize chart if not already created
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(containerRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    const chart = chartInstanceRef.current;

    if (loading) {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      chart.showLoading({
        text: 'Loading telemetry...',
        color: '#3b82f6',
        textColor: isDark ? '#94a3b8' : '#475569',
        maskColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.75)',
      });
    } else {
      chart.hideLoading();
      chart.setOption(option, true);
    }

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(containerRef.current);

    const handleWindowResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [option, loading]);

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className={`relative rounded-md overflow-hidden ${className}`}
    />
  );
}
