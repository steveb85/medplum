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
{/* Face outline - anatomical profile view (right-facing) */}
<path
d="M 140 60
C 110 60, 90 75, 85 100
C 82 115, 85 125, 95 135
C 105 145, 140 150, 180 155
C 220 160, 260 170, 280 190
C 295 205, 300 220, 295 235
C 290 250, 280 255, 270 258
C 265 260, 260 265, 265 275
C 270 285, 275 290, 270 300
C 265 315, 250 330, 230 345
C 210 360, 195 380, 185 420
L 180 460
L 280 460
L 285 420
C 290 380, 295 340, 300 300
C 305 250, 300 200, 290 160
C 280 120, 260 90, 230 75
C 200 60, 170 60, 140 60
Z"
fill="#f8f9fa"
stroke="#dee2e6"
strokeWidth="2"
/>

{/* Hair - profile (top/back of head) */}
<path
d="M 150 60
C 120 60, 100 80, 95 120
C 92 140, 100 150, 110 160
L 115 165
C 110 120, 140 50, 200 50
C 250 50, 280 80, 290 120
C 300 160, 310 200, 315 250
C 320 300, 310 350, 305 380
L 310 400
L 280 400
L 285 380
C 290 350, 280 200, 250 90
C 240 70, 220 60, 200 60
C 180 60, 160 60, 150 60
Z"
fill="#e9ecef"
stroke="#dee2e6"
strokeWidth="1"
/>

{/* Forehead area - subtle indication */}
<ellipse cx="140" cy="110" rx="40" ry="30" fill="#f1f3f4" opacity="0.3" />

{/* Eyebrow */}
<path
d="M 120 130 Q 145 125, 170 130"
stroke="#adb5bd"
strokeWidth="3"
fill="none"
/>

{/* Eye - profile view (almond shape) */}
<ellipse cx="150" cy="150" rx="18" ry="10" fill="#fff" stroke="#dee2e6" strokeWidth="1" />
<circle cx="152" cy="150" r="6" fill="#e9ecef" />

{/* Nose - profile with bridge and tip */}
<path
d="M 168 150
L 260 180
L 265 185
L 260 200
L 250 205"
stroke="#dee2e6"
strokeWidth="2"
fill="none"
/>

{/* Lips - profile (protruding) */}
<path
d="M 250 240
Q 275 240, 280 245
Q 275 255, 250 255
Q 265 248, 250 240"
fill="#f8d7da"
stroke="#dee2e6"
strokeWidth="1"
/>

{/* Chin - profile curve */}
<path
d="M 255 260
Q 260 300, 240 340
Q 230 360, 220 380"
stroke="#dee2e6"
strokeWidth="1"
fill="none"
/>

{/* Jawline - profile */}
<path
d="M 250 280
Q 280 320, 285 380
Q 290 420, 280 460"
stroke="#dee2e6"
strokeWidth="1"
fill="none"
strokeDasharray="4 2"
/>

{/* Neck - profile (back of neck) */}
<path
d="M 220 380
L 180 460
L 280 460
L 285 420"
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

{/* Hair - profile following head contour */}
<path
d="M 140 60
C 110 60, 90 75, 85 100
C 82 110, 85 120, 90 130
C 95 140, 100 135, 110 130
C 120 125, 130 110, 140 100
C 160 85, 180 80, 200 75
C 240 70, 270 80, 285 110
C 295 130, 300 160, 302 190
C 305 240, 302 290, 295 340
C 290 380, 285 420, 280 460
L 310 460
L 315 420
C 320 370, 325 320, 320 270
C 315 200, 305 140, 290 100
C 275 70, 250 55, 220 50
C 190 45, 160 50, 140 60
Z"
fill="#e9ecef"
stroke="#dee2e6"
strokeWidth="1"
/>

{/* Forehead area - subtle indication */}
<ellipse cx="130" cy="100" rx="35" ry="25" fill="#f1f3f4" opacity="0.3" />

{/* Eyebrow - subtle arch */}
<path
d="M 115 128 Q 140 122, 165 128"
stroke="#adb5bd"
strokeWidth="2"
fill="none"
/>

{/* Eye - profile (almond shape with slight protrusion) */}
<ellipse cx="140" cy="145" rx="15" ry="8" fill="#fff" stroke="#dee2e6" strokeWidth="1" />
<circle cx="142" cy="145" r="5" fill="#e9ecef" />

{/* Nose bridge - smooth curve from forehead to tip */}
<path
d="M 165 140
C 170 145, 200 155, 220 160
C 240 165, 260 175, 275 190
C 280 195, 282 200, 280 205
C 278 210, 275 215, 270 218"
stroke="#dee2e6"
strokeWidth="1.5"
fill="none"
/>

{/* Nose tip and nostril indication */}
<path
d="M 270 218
C 275 220, 278 222, 280 225
C 282 230, 280 235, 275 240"
stroke="#dee2e6"
strokeWidth="1.5"
fill="none"
/>

{/* Philtrum (subtle groove under nose) */}
<path
d="M 275 240
C 273 245, 272 248, 270 252"
stroke="#e9ecef"
strokeWidth="1"
fill="none"
/>

{/* Lips - natural profile curve */}
<path
d="M 270 252
C 272 255, 275 256, 278 257
C 282 258, 284 260, 285 262
C 286 265, 285 268, 282 270
C 278 272, 275 273, 270 274"
fill="#f8d7da"
stroke="#dee2e6"
strokeWidth="1"
/>

{/* Chin - smooth transition from lips */}
<path
d="M 270 274
C 268 278, 266 282, 264 288
C 262 295, 260 305, 258 315"
stroke="#dee2e6"
strokeWidth="1"
fill="none"
/>

{/* Jawline - graceful curve to neck */}
<path
d="M 258 315
C 256 325, 253 335, 248 345
C 243 355, 238 365, 232 375"
stroke="#dee2e6"
strokeWidth="1"
fill="none"
strokeDasharray="4 2"
/>

{/* Neck - natural curve from jaw */}
<path
d="M 232 375
C 228 385, 224 400, 220 420
C 216 440, 214 450, 212 460"
stroke="#dee2e6"
strokeWidth="1"
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
