// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@mantine/core';
import type { JSX } from 'react';

interface FaceTemplateProps {
  view: 'front' | 'profile';
  width?: number;
  height?: number;
  className?: string;
}

export function FaceTemplate({
  view,
  width = 400,
  height = 500,
  className,
}: FaceTemplateProps): JSX.Element {
  if (view === 'profile') {
    return (
      <Box className={className} style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          width={width}
          height={height}
          viewBox="0 0 400 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ maxWidth: '100%', height: 'auto' }}
        >
{/* Face outline - proper profile view (right-facing silhouette) */}
<path
d="M 150 60
C 120 60, 100 80, 95 120
C 90 150, 100 160, 110 170
L 115 175
C 140 165, 220 160, 260 175
C 285 185, 295 200, 290 215
C 285 230, 270 235, 260 240
L 255 245
C 260 255, 265 265, 260 280
C 255 300, 240 320, 220 340
C 200 360, 190 380, 185 420
L 180 460
L 280 460
L 285 420
C 290 380, 300 340, 305 300
C 310 250, 300 200, 290 170
C 280 140, 270 110, 250 90
C 230 70, 200 60, 150 60
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

{/* Forehead area */}
<ellipse cx="140" cy="110" rx="40" ry="30" fill="transparent" />

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

{/* Muscle guidelines - subtle */}
<path
d="M 120 130 Q 140 180, 160 230"
stroke="#e9ecef"
strokeWidth="1"
fill="none"
/>
<path
d="M 240 200 Q 250 260, 260 320"
stroke="#e9ecef"
strokeWidth="1"
fill="none"
/>

          {/* Grid for reference - very subtle */}
          <g opacity="0.1">
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
        </svg>
      </Box>
    );
  }

  // Front view
  return (
    <Box className={className} style={{ display: 'flex', justifyContent: 'center' }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 400 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
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

        {/* Forehead */}
        <path
          d="M130 100 Q 200 80, 270 100 Q 265 130, 200 130 Q 135 130, 130 100"
          fill="transparent"
        />

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

        {/* Glabella area (11s) */}
        <path
          d="M185 145 Q 200 155, 215 145 Q 215 165, 200 170 Q 185 165, 185 145"
          fill="transparent"
        />

        {/* Crow's feet areas */}
        <path
          d="M118 160 Q 140 150, 138 160 Q 140 175, 118 165"
          fill="transparent"
        />
        <path
          d="M282 160 Q 260 150, 262 160 Q 260 175, 282 165"
          fill="transparent"
        />

        {/* Cheeks */}
        <ellipse cx="130" cy="250" rx="35" ry="45" fill="transparent" />
        <ellipse cx="270" cy="250" rx="35" ry="45" fill="transparent" />

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

        {/* Lip flip area */}
        <ellipse cx="200" cy="275" rx="25" ry="8" fill="transparent" />

        {/* Chin */}
        <ellipse cx="200" cy="350" rx="35" ry="25" fill="transparent" />

        {/* Jawline/Masseter area */}
        <ellipse cx="130" cy="330" rx="25" ry="30" fill="transparent" />
        <ellipse cx="270" cy="330" rx="25" ry="30" fill="transparent" />

        {/* Temples */}
        <ellipse cx="110" cy="130" rx="25" ry="30" fill="transparent" />
        <ellipse cx="290" cy="130" rx="25" ry="30" fill="transparent" />

        {/* Bunny lines area */}
        <ellipse cx="185" cy="220" rx="10" ry="12" fill="transparent" />
        <ellipse cx="215" cy="220" rx="10" ry="12" fill="transparent" />

        {/* DAO (marionette) area */}
        <ellipse cx="165" cy="320" rx="15" ry="12" fill="transparent" />
        <ellipse cx="235" cy="320" rx="15" ry="12" fill="transparent" />

        {/* Mentalis (chin dimple) */}
        <ellipse cx="200" cy="370" rx="15" ry="8" fill="transparent" />

        {/* Neck bands area */}
        <rect x="160" y="390" width="80" height="30" rx="5" fill="transparent" />

        {/* Platysma bands indication */}
        <path
          d="M175 400 L 175 420"
          stroke="#e9ecef"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M200 400 L 200 420"
          stroke="#e9ecef"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M225 400 L 225 420"
          stroke="#e9ecef"
          strokeWidth="1"
          fill="none"
        />

        {/* Grid for reference - very subtle */}
        <g opacity="0.1">
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
      </svg>
    </Box>
  );
}
