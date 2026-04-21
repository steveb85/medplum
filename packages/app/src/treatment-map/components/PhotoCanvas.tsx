// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Paper } from '@mantine/core';
import type { JSX } from 'react';
import { useRef, useEffect, useCallback } from 'react';
import type { PhotoCanvasProps, InjectionMarker } from '../types/injection';
import { PRODUCT_COLORS, getColorByUnits } from '../types/injection';

export function PhotoCanvas({
  photoUrl,
  markers,
  selectedMarker,
  onCanvasClick,
  onMarkerClick,
  readOnly = false,
  markerColorMode = 'product',
}: PhotoCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Draw a single marker
  const drawMarker = useCallback((
    ctx: CanvasRenderingContext2D,
    marker: InjectionMarker,
    canvasWidth: number,
    canvasHeight: number,
    isSelected: boolean
  ): void => {
    const x = marker.position.x * canvasWidth;
    const y = marker.position.y * canvasHeight;

    // Get color based on mode
    const color = markerColorMode === 'product'
      ? PRODUCT_COLORS[marker.productBrand] || '#6b7280'
      : getColorByUnits(marker.units);

    // Draw outer ring (white border)
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#000' : color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    // Draw inner circle
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw units text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(marker.units.toString(), x, y + 1);

    // Draw zone name label (only if selected)
    if (isSelected) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const textWidth = ctx.measureText(marker.zoneName).width + 8;
      ctx.fillRect(x - textWidth / 2, y - 35, textWidth, 18);

      ctx.fillStyle = 'white';
      ctx.font = '11px sans-serif';
      ctx.fillText(marker.zoneName, x, y - 26);
    }
  }, [markerColorMode]);

  // Draw zone overlays (optional - for reference)
  // const _drawZones = useCallback((
  //   ctx: CanvasRenderingContext2D,
  //   _zonesList: ZoneDefinition[],
  //   canvasWidth: number,
  //   canvasHeight: number
  // ): void => {
  //   _zonesList.forEach((zone) => {
  //     const x = zone.bounds.x * canvasWidth;
  //     const y = zone.bounds.y * canvasHeight;
  //     const radius = zone.bounds.radius * Math.min(canvasWidth, canvasHeight);

  //     ctx.beginPath();
  //     ctx.arc(x, y, radius, 0, 2 * Math.PI);
  //     ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
  //     ctx.lineWidth = 1;
  //     ctx.stroke();
  //   });
  // }, []);

  // Load and draw image
  const drawCanvas = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const image = imageRef.current;
    if (!image?.complete) {
      return;
    }

    // Set canvas size to match image
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw zone overlays (optional - for debugging/help)
    // _drawZones(ctx, zones, canvas.width, canvas.height);

    // Draw markers
    markers.forEach((marker) => {
      drawMarker(ctx, marker, canvas.width, canvas.height, marker === selectedMarker);
    });
  }, [markers, selectedMarker, drawMarker]);

  // Handle click on canvas
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      if (readOnly) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = ((e.clientX - rect.left) * scaleX) / canvas.width;
      const y = ((e.clientY - rect.top) * scaleY) / canvas.height;

      // Check if clicked on existing marker
      const clickedMarker = markers.find((marker) => {
        const mx = marker.position.x;
        const my = marker.position.y;
        const distance = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
        return distance < 0.03; // 3% of canvas size
      });

      if (clickedMarker) {
        onMarkerClick(clickedMarker);
      } else {
        onCanvasClick(x, y);
      }
    },
    [markers, onCanvasClick, onMarkerClick, readOnly]
  );

  // Load image
  useEffect(() => {
    if (!photoUrl) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = photoUrl;
  }, [photoUrl, drawCanvas]);

  // Redraw when markers or selection changes
  useEffect(() => {
    drawCanvas();
  }, [markers, selectedMarker, drawCanvas]);

  if (!photoUrl) {
    return (
      <Paper
        withBorder
        p="xl"
        style={{
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
        }}
      >
        <Box c="dimmed" ta="center">
          No photo uploaded yet.
          <br />
          Upload a patient photo to begin marking injection points.
        </Box>
      </Paper>
    );
  }

  return (
    <Paper withBorder style={{ overflow: 'hidden', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', lineHeight: 0 }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{
            width: '100%',
            height: 'auto',
            cursor: readOnly ? 'default' : 'crosshair',
            display: 'block',
          }}
        />
      </div>
    </Paper>
  );
}
