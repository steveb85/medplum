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

          {/* Forehead area */}
          <ellipse cx="200" cy="110" rx="50" ry="35" fill="transparent" />

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

          {/* Muscle guidelines - subtle */}
          <path
            d="M140 125 Q 150 180, 160 220"
            stroke="#e9ecef"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M280 200 Q 270 250, 260 300"
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
