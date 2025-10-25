import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './sparkline.css';

/**
 * Sparkline chart component - SVG-based line chart for price trends
 * Two variants: 'mini' for compact spaces, 'hero' for detailed view
 */
export function Sparkline({
  data = [],
  variant = 'mini',
  width,
  height,
  color,
  change,
  trend = 'neutral',
  price,
  priceLabel,
  footer,
  className,
  animate = true,
  showGradient = true,
}) {
  // Auto size based on variant
  const finalWidth = width || (variant === 'hero' ? 200 : 60);
  const finalHeight = height || (variant === 'hero' ? 60 : 20);
  
  // Generate SVG path from data points
  const { path, gradientId } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', gradientId: '' };
    }

    const gId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;
    
    // Normalize data to fit in viewBox
    const padding = 2;
    const chartWidth = finalWidth - padding * 2;
    const chartHeight = finalHeight - padding * 2;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    // Create smooth bezier curve path
    const points = data.map((value, index) => ({
      x: padding + (index / (data.length - 1)) * chartWidth,
      y: padding + chartHeight - ((value - min) / range) * chartHeight,
    }));
    
    // Build SVG path with smooth curves
    let pathD = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // Calculate control points for smooth bezier curve
      const controlX = prev.x + (curr.x - prev.x) / 2;
      const controlY = prev.y;
      const controlX2 = curr.x - (curr.x - prev.x) / 2;
      const controlY2 = curr.y;
      
      if (i === 1) {
        // First curve: quadratic
        pathD += ` Q ${controlX} ${controlY}, ${curr.x} ${curr.y}`;
      } else {
        // Subsequent curves: cubic bezier
        pathD += ` C ${controlX} ${controlY}, ${controlX2} ${controlY2}, ${curr.x} ${curr.y}`;
      }
    }
    
    // Close path for gradient fill
    const fillPath = variant === 'hero' && showGradient
      ? `${pathD} L ${points[points.length - 1].x} ${finalHeight} L ${points[0].x} ${finalHeight} Z`
      : '';
    
    return { path: pathD, fillPath, gradientId: gId };
  }, [data, finalWidth, finalHeight, variant, showGradient]);

  // Determine color based on trend
  const strokeColor = color || (
    trend === 'positive' ? 'var(--success-color)' :
    trend === 'negative' ? 'var(--danger-color)' :
    'var(--text-secondary)'
  );

  const classes = [
    'sparkline',
    `sparkline--${variant}`,
    animate && 'sparkline--animate',
    className,
  ].filter(Boolean).join(' ');

  if (variant === 'mini') {
    return (
      <div className={classes}>
        <svg
          width={finalWidth}
          height={finalHeight}
          viewBox={`0 0 ${finalWidth} ${finalHeight}`}
          preserveAspectRatio="none"
          className="sparkline-svg"
        >
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="sparkline-path"
          />
        </svg>
      </div>
    );
  }

  // Hero variant - detailed view with price and change
  return (
    <div className={classes}>
      {/* SVG Chart */}
      <svg
        width={finalWidth}
        height={finalHeight}
        viewBox={`0 0 ${finalWidth} ${finalHeight}`}
        preserveAspectRatio="none"
        className="sparkline-svg sparkline-svg--hero"
      >
        {/* No gradient fill - cleaner look */}
        
        {/* Line stroke */}
        <path
          d={path.path || path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="sparkline-path sparkline-path--hero"
        />
      </svg>

      {/* Price and change below chart */}
      {price && (
        <div className="sparkline-caption">
          <div className="sparkline-price-row">
            <div className="sparkline-price">{price}</div>
            {change && (
              <div className={`sparkline-change sparkline-change--${trend}`}>
                {change}
              </div>
            )}
          </div>
          {/* Optional footer (e.g., CA info, source) */}
          {footer && <div className="sparkline-footer">{footer}</div>}
        </div>
      )}
    </div>
  );
}

Sparkline.propTypes = {
  data: PropTypes.arrayOf(PropTypes.number),
  variant: PropTypes.oneOf(['mini', 'hero']),
  width: PropTypes.number,
  height: PropTypes.number,
  color: PropTypes.string,
  change: PropTypes.string,
  trend: PropTypes.oneOf(['positive', 'negative', 'neutral']),
  price: PropTypes.string,
  priceLabel: PropTypes.string,
  footer: PropTypes.node,
  className: PropTypes.string,
  animate: PropTypes.bool,
  showGradient: PropTypes.bool,
};

