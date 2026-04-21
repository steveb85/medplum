// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Paper } from '@mantine/core';
import type { JSX } from 'react';
import { useRef, useCallback, useState } from 'react';
import type { InjectionMarker, ZoneDefinition } from '../types/injection';
import { PRODUCT_COLORS, getColorByUnits } from '../types/injection';
import { FaceTemplate } from './FaceTemplate';

interface SvgCanvasProps {
  view: 'front' | 'profile' | 'left' | 'right' | 'back';
  markers: InjectionMarker[];
  zones: ZoneDefinition[];
  selectedMarker?: InjectionMarker | null;
  onCanvasClick: (x: number, y: number) => void;
  onMarkerClick: (marker: InjectionMarker) => void;
  readOnly?: boolean;
  markerColorMode?: 'product' | 'units';
}

export function SvgCanvas({
  view,
  markers,
  zones,
  selectedMarker,
  onCanvasClick,
  onMarkerClick,
  readOnly = false,
  markerColorMode = 'product',
}: SvgCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  // Convert normalized coordinates (0-1) to SVG coordinates
  const toSvgX = useCallback((normalizedX: number, svgWidth: number): number => {
    // SVG viewBox is 400 wide, with 40px margin on each side
    // So actual face area is 40 to 360 (320px wide)
    return 40 + normalizedX * 320;
  }, []);

  const toSvgY = useCallback((normalizedY: number, svgHeight: number): number => {
    // SVG viewBox is 500 tall, with 40px margin on top and 60px on bottom
    // So actual face area is 40 to 460 (420px tall)
    return 40 + normalizedY * 420;
  }, []);

  // Handle click on the SVG
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): void => {
      if (readOnly) {return;}

      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;

      // Transform to SVG coordinates
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      // Convert to normalized coordinates (0-1)
      // SVG viewBox is 400x500
      const normalizedX = (svgP.x - 40) / 320;
      const normalizedY = (svgP.y - 40) / 420;

      // Clamp to valid range
      const clampedX = Math.max(0, Math.min(1, normalizedX));
      const clampedY = Math.max(0, Math.min(1, normalizedY));

      onCanvasClick(clampedX, clampedY);
    },
    [onCanvasClick, readOnly]
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

  return (
    <Paper withBorder style={{ overflow: 'hidden', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        {/* SVG Container with markers overlay */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 500"
          style={{
            display: 'block',
            cursor: readOnly ? 'default' : 'crosshair',
            maxHeight: 600,
          }}
          onClick={handleSvgClick}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background face template */}
          <FaceTemplateSvg view={view} />

          {/* Injection markers */}
          {markers.map((marker) => {
            const x = toSvgX(marker.position.x, 400);
            const y = toSvgY(marker.position.y, 500);
            const isSelected = selectedMarker?.id === marker.id;
            const isHovered = hoveredMarker === marker.id;
            const color = getMarkerColor(marker);

            return (
              <g
                key={marker.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkerClick(marker);
                }}
                onMouseEnter={() => setHoveredMarker(marker.id)}
                onMouseLeave={() => setHoveredMarker(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer ring */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 16 : 14}
                  fill="white"
                  stroke={isSelected ? '#000' : color}
                  strokeWidth={isSelected ? 3 : 2}
                />

                {/* Inner circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill={color}
                  opacity={isHovered ? 0.9 : 1}
                />

                {/* Units text */}
                <text
                  x={x}
                  y={y}
                  dy="0.35em"
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {marker.units}
                </text>

                {/* Label on hover or selected */}
                {(isHovered || isSelected) && (
                  <g>
                    <rect
                      x={x - 60}
                      y={y - 45}
                      width={120}
                      height={22}
                      rx={4}
                      fill="rgba(0, 0, 0, 0.8)"
                    />
                    <text
                      x={x}
                      y={y - 34}
                      textAnchor="middle"
                      fill="white"
                      fontSize="11"
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
    </Paper>
  );
}

// Internal SVG template component
function FaceTemplateSvg({ view }: { view: 'front' | 'profile' | 'left' | 'right'| 'back'}): JSX.Element {
  if (view === 'profile') {
    return (
      <g>
        {/* Face outline - profile */}
        <path
          d="M120 60
             C 80 60, 60 100, 60 140
             C 60 180, 70 200, 75 220
             C 80 240, 85 260, 85 280
             C 85 320, 90 360, 110 400
             C 130 440, 160 460, 200 460
             C 240 460, 270 440, 290 400
             C 310 360, 315 320, 315 280
             C 315 260, 320 240, 325 220
             C 330 200, 340 180, 340 140
             C 340 100, 320 60, 280 60
             Z"
          fill="#f8f9fa"
          stroke="#dee2e6"
          strokeWidth="2"
        />

        {/* Hair */}
        <path
          d="M60 140
             C 60 80, 100 40, 200 40
             C 300 40, 340 80, 340 140
             C 340 120, 320 60, 200 60
             C 80 60, 60 120, 60 140"
          fill="#e9ecef"
          stroke="#dee2e6"
          strokeWidth="1"
        />

        {/* Forehead area - subtle indication */}
        <ellipse cx="200" cy="110" rx="50" ry="35" fill="#f1f3f4" opacity="0.3" />

        {/* Eyebrow */}
        <path
          d="M140 125 Q 180 115, 220 125"
          stroke="#adb5bd"
          strokeWidth="3"
          fill="none"
        />

        {/* Eye */}
        <ellipse cx="195" cy="145" rx="25" ry="12" fill="#fff" stroke="#dee2e6" strokeWidth="1" />
        <circle cx="195" cy="145" r="8" fill="#e9ecef" />

        {/* Nose */}
        <path
          d="M220 145
             L 240 200
             L 230 220
             L 225 225"
          stroke="#dee2e6"
          strokeWidth="2"
          fill="none"
        />

        {/* Lips - profile */}
        <path
          d="M225 240
             Q 240 240, 245 245
             Q 240 255, 225 255
             Q 235 248, 225 240"
          fill="#f8d7da"
          stroke="#dee2e6"
          strokeWidth="1"
        />

        {/* Chin */}
        <path
          d="M225 255
             Q 230 280, 220 300
             Q 210 320, 200 330"
          stroke="#dee2e6"
          strokeWidth="1"
          fill="none"
        />

        {/* Jawline */}
        <path
          d="M220 300
             Q 260 350, 280 400"
          stroke="#dee2e6"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 2"
        />

        {/* Neck */}
        <path
          d="M200 330
             L 180 420
             L 240 420
             L 260 380"
          fill="#f8f9fa"
          stroke="#dee2e6"
          strokeWidth="1"
        />

        {/* Temple area indication */}
        <ellipse cx="200" cy="130" rx="30" ry="40" fill="#e3f2fd" opacity="0.2" />

        {/* Cheek area indication */}
        <ellipse cx="260" cy="220" rx="25" ry="35" fill="#e3f2fd" opacity="0.2" />

        {/* Subtle grid for reference */}
        <g opacity="0.05">
          {[...Array(10)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={40 + i * 32}
              y1={40}
              x2={40 + i * 32}
              y2={460}
              stroke="#adb5bd"
              strokeWidth="0.5"
            />
          ))}
          {[...Array(12)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1={40}
              y1={40 + i * 35}
              x2={360}
              y2={40 + i * 35}
              stroke="#adb5bd"
              strokeWidth="0.5"
            />
          ))}
        </g>
      </g>
    );
  }

  // Front view
  return (
    <g>
      {/* Face outline */}
      <path
        d="M200 40
           C 120 40, 60 100, 60 180
           C 60 260, 80 320, 100 360
           C 120 400, 150 430, 200 440
           C 250 430, 280 400, 300 360
           C 320 320, 340 260, 340 180
           C 340 100, 280 40, 200 40
           Z"
        fill="#f8f9fa"
        stroke="#dee2e6"
        strokeWidth="2"
      />

      {/* Hair */}
      <path
        d="M60 180
           C 60 100, 100 30, 200 30
           C 300 30, 340 100, 340 180
           C 340 150, 320 60, 200 60
           C 80 60, 60 150, 60 180
           Z"
        fill="#e9ecef"
        stroke="#dee2e6"
        strokeWidth="1"
      />

      {/* Forehead area - subtle indication */}
      <ellipse cx="200" cy="100" rx="70" ry="30" fill="#e3f2fd" opacity="0.2" />

      {/* Eyebrows */}
      <path
        d="M140 145 Q 160 135, 180 145"
        stroke="#adb5bd"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M220 145 Q 240 135, 260 145"
        stroke="#adb5bd"
        strokeWidth="3"
        fill="none"
      />

      {/* Eyes */}
      <ellipse cx="160" cy="160" rx="22" ry="10" fill="#fff" stroke="#dee2e6" strokeWidth="1" />
      <circle cx="160" cy="160" r="6" fill="#e9ecef" />
      <ellipse cx="240" cy="160" rx="22" ry="10" fill="#fff" stroke="#dee2e6" strokeWidth="1" />
      <circle cx="240" cy="160" r="6" fill="#e9ecef" />

      {/* Nose */}
      <path
        d="M200 165
           L 195 210
           L 180 230
           L 200 235
           L 220 230
           L 205 210
           Z"
        fill="#fff"
        stroke="#dee2e6"
        strokeWidth="1"
      />

      {/* Glabella area (11s) - subtle indication */}
      <ellipse cx="200" cy="155" rx="20" ry="15" fill="#fff3e0" opacity="0.3" />

      {/* Crow's feet areas - subtle indication */}
      <ellipse cx="115" cy="162" rx="18" ry="12" fill="#fff3e0" opacity="0.3" />
      <ellipse cx="285" cy="162" rx="18" ry="12" fill="#fff3e0" opacity="0.3" />

      {/* Cheeks - subtle indication */}
      <ellipse cx="130" cy="250" rx="35" ry="45" fill="#fce4ec" opacity="0.2" />
      <ellipse cx="270" cy="250" rx="35" ry="45" fill="#fce4ec" opacity="0.2" />

      {/* Nasolabial folds */}
      <path
        d="M180 230 Q 170 260, 160 290"
        stroke="#e9ecef"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M220 230 Q 230 260, 240 290"
        stroke="#e9ecef"
        strokeWidth="1"
        fill="none"
      />

      {/* Lips */}
      <ellipse cx="200" cy="290" rx="30" ry="12" fill="#f8d7da" stroke="#dee2e6" strokeWidth="1" />
      <path
        d="M170 290 Q 200 295, 230 290"
        stroke="#dee2e6"
        strokeWidth="1"
        fill="none"
      />

      {/* Lip flip area - subtle indication */}
      <ellipse cx="200" cy="275" rx="25" ry="8" fill="#fff3e0" opacity="0.3" />

      {/* Chin - subtle indication */}
      <ellipse cx="200" cy="350" rx="35" ry="25" fill="#fce4ec" opacity="0.2" />

      {/* Jawline/Masseter area - subtle indication */}
      <ellipse cx="130" cy="330" rx="25" ry="30" fill="#e8f5e9" opacity="0.2" />
      <ellipse cx="270" cy="330" rx="25" ry="30" fill="#e8f5e9" opacity="0.2" />

      {/* Temples - subtle indication */}
      <ellipse cx="110" cy="130" rx="25" ry="30" fill="#e3f2fd" opacity="0.2" />
      <ellipse cx="290" cy="130" rx="25" ry="30" fill="#e3f2fd" opacity="0.2" />

      {/* Bunny lines area - subtle indication */}
      <ellipse cx="185" cy="220" rx="10" ry="12" fill="#fff3e0" opacity="0.3" />
      <ellipse cx="215" cy="220" rx="10" ry="12" fill="#fff3e0" opacity="0.3" />

      {/* DAO (marionette) area - subtle indication */}
      <ellipse cx="165" cy="320" rx="15" ry="12" fill="#fce4ec" opacity="0.2" />
      <ellipse cx="235" cy="320" rx="15" ry="12" fill="#fce4ec" opacity="0.2" />

      {/* Mentalis (chin dimple) - subtle indication */}
      <ellipse cx="200" cy="370" rx="15" ry="8" fill="#fff3e0" opacity="0.3" />

      {/* Neck bands area - subtle indication */}
      <rect x="160" y="395" width="80" height="25" rx="5" fill="#e3f2fd" opacity="0.2" />

      {/* Platysma bands indication */}
      <path
        d="M175 400 L 175 415"
        stroke="#dee2e6"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M200 400 L 200 415"
        stroke="#dee2e6"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M225 400 L 225 415"
        stroke="#dee2e6"
        strokeWidth="1"
        fill="none"
      />

      {/* Center line */}
      <line
        x1="200"
        y1="60"
        x2="200"
        y2="440"
        stroke="#e9ecef"
        strokeWidth="1"
        strokeDasharray="5 5"
      />

      {/* Subtle grid for reference */}
      <g opacity="0.05">
        {[...Array(10)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={40 + i * 32}
            y1={40}
            x2={40 + i * 32}
            y2={460}
            stroke="#adb5bd"
            strokeWidth="0.5"
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1={40}
            y1={40 + i * 35}
            x2={360}
            y2={40 + i * 35}
            stroke="#adb5bd"
            strokeWidth="0.5"
          />
        ))}
      </g>
    </g>
  );
}
