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

{/* Forehead area */}
<ellipse cx="130" cy="100" rx="35" ry="25" fill="transparent" />

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

{/* Muscle guidelines - subtle anatomical lines */}
<path
d="M 115 128 Q 130 160, 150 200"
stroke="#e9ecef"
strokeWidth="1"
fill="none"
/>
<path
d="M 260 175 Q 270 220, 265 275"
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
