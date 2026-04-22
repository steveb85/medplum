// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Paper, Text } from '@mantine/core';
import type { JSX } from 'react';
import { useRef, useCallback, useState, useEffect } from 'react';
import type { InjectionMarker } from '../types/injection';
import { PRODUCT_COLORS, getColorByUnits } from '../types/injection';
import type { BackgroundConfig } from './BackgroundSelector';

// SVG asset paths
const SVG_ASSETS: Record<string, string> = {
  'female-front': '/src/treatment-map/assets/face/female_front.svg',
  'female-left': '/src/treatment-map/assets/face/female_left.svg',
  'male-front': '/src/treatment-map/assets/face/male_front.svg',
  'male-left': '/src/treatment-map/assets/face/male_left.svg',
  'unknown-front': '/src/treatment-map/assets/face/neutral_front.svg',
  'unknown-left': '/src/treatment-map/assets/face/neutral_left.svg',
};

interface ImageCanvasProps {
  background: BackgroundConfig;
  photoUrl?: string;
  markers: InjectionMarker[];
  selectedMarker?: InjectionMarker | null;
  onCanvasClick: (x: number, y: number) => void;
  onMarkerClick: (marker: InjectionMarker) => void;
  readOnly?: boolean;
  markerColorMode?: 'product' | 'units';
}

export function ImageCanvas({
  background,
  photoUrl,
  markers,
  selectedMarker,
  onCanvasClick,
  onMarkerClick,
  readOnly = false,
  markerColorMode = 'product',
}: ImageCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 400, height: 500 });
  const [isRightView, setIsRightView] = useState(false);

  // Get the appropriate image source
  const imageSrc = getImageSource(background, photoUrl);

  useEffect(() => {
    setIsRightView(background.type === 'template' && background.templateView === 'right');
  }, [background]);

  // Load image to get dimensions
  useEffect(() => {
    if (!imageSrc || background.type !== 'photo') {
      // For SVGs, use fixed aspect ratio
      if (background.type === 'template') {
        const view = background.templateView;
        if (view === 'front') {
          setImageDimensions({ width: 818, height: 598 });
        } else {
          setImageDimensions({ width: 598, height: 818 });
        }
        setImageLoaded(true);
      }
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc, background]);

  // Handle click on canvas
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (readOnly || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = imageDimensions.width / rect.width;
      const scaleY = imageDimensions.height / rect.height;

      // Calculate position relative to image
      let x = ((e.clientX - rect.left) * scaleX) / imageDimensions.width;
      let y = ((e.clientY - rect.top) * scaleY) / imageDimensions.height;

      // Clamp to 0-1
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));

      // If right view (flipped), adjust x coordinate
      if (isRightView) {
        x = 1 - x;
      }

      // Check if clicked on existing marker
      const clickedMarker = markers.find((marker) => {
        let mx = marker.position.x;
        const my = marker.position.y;
        // For right view, marker positions are stored as left view
        if (isRightView) {
          mx = 1 - mx;
        }
        const distance = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
        return distance < 0.03; // 3% threshold
      });

      if (clickedMarker) {
        onMarkerClick(clickedMarker);
      } else {
        // Convert back to normalized left-view coordinates for storage
        const normalizedX = isRightView ? 1 - x : x;
        onCanvasClick(normalizedX, y);
      }
    },
    [markers, onCanvasClick, onMarkerClick, readOnly, imageDimensions, isRightView]
  );

  // Get marker color
  const getMarkerColor = useCallback(
    (marker: InjectionMarker): string => {
      if (markerColorMode === 'product') {
        return PRODUCT_COLORS[marker.productBrand] || '#6b7280';
      }
      return getColorByUnits(marker.units);
    },
    [markerColorMode]
  );

  if (!imageLoaded) {
    return (
      <Paper
        withBorder
        style={{
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
        }}
      >
        <Text c="dimmed">Loading...</Text>
      </Paper>
    );
  }

  const aspectRatio = imageDimensions.height / imageDimensions.width;

  return (
    <Paper withBorder style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          width: '100%',
          position: 'relative',
          cursor: readOnly ? 'default' : 'crosshair',
          lineHeight: 0,
        }}
      >
        {/* Image container with fixed aspect ratio */}
        <div
          style={{
            width: '100%',
            paddingBottom: `${aspectRatio * 100}%`,
            position: 'relative',
          }}
        >
          {/* Background image */}
          {background.type === 'template' ? (
            <img
              src={imageSrc}
              alt={`${background.templateGender} ${background.templateView} view`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: isRightView ? 'scaleX(-1)' : 'none',
                backgroundColor: '#f8f9fa',
              }}
            />
          ) : (
            <img
              src={imageSrc}
              alt="Patient photo"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#f8f9fa',
              }}
            />
          )}

          {/* Markers overlay */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
          >
            {markers.map((marker) => {
              let x = marker.position.x;
              const y = marker.position.y;
              
              // Flip for right view
              if (isRightView) {
                x = 1 - x;
              }

              const isSelected = selectedMarker?.id === marker.id;
              const color = getMarkerColor(marker);

              return (
                <g
                  key={marker.id}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkerClick(marker);
                  }}
                >
                  {/* Outer ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 0.04 : 0.035}
                    fill="white"
                    stroke={isSelected ? '#000' : color}
                    strokeWidth={isSelected ? 0.008 : 0.005}
                  />
                  
                  {/* Inner circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={0.025}
                    fill={color}
                  />

                  {/* Units text */}
                  <text
                    x={x}
                    y={y}
                    dy="0.01"
                    textAnchor="middle"
                    fill="white"
                    fontSize="0.035"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {marker.units}
                  </text>

                  {/* Label on hover/selected */}
                  {isSelected && (
                    <g>
                      <rect
                        x={x - 0.15}
                        y={y - 0.12}
                        width={0.3}
                        height={0.06}
                        rx={0.01}
                        fill="rgba(0, 0, 0, 0.8)"
                      />
                      <text
                        x={x}
                        y={y - 0.09}
                        textAnchor="middle"
                        fill="white"
                        fontSize="0.03"
                      >
                        {marker.zoneName}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </Paper>
  );
}

function getImageSource(background: BackgroundConfig, photoUrl?: string): string | undefined {
  if (background.type === 'photo' && photoUrl) {
    return photoUrl;
  }

  if (background.type === 'template') {
    const gender = background.templateGender || 'unknown';
    const view = background.templateView === 'right' ? 'left' : background.templateView;
    const key = `${gender}-${view}`;
    return SVG_ASSETS[key];
  }

  return undefined;
}


