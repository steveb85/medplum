// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * SignatureCanvas Component
 * HTML5 Canvas-based digital signature capture
 */

import { Button, Group, Stack, Text } from '@mantine/core';
import type { JSX, MouseEvent, TouchEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SignatureCanvasProps {
  value: string;
  onChange: (signatureData: string) => void;
  label?: string;
  description?: string;
  required?: boolean;
  error?: string;
}

export function SignatureCanvas({
  value,
  onChange,
  label = 'Digital Signature',
  description = 'Please sign your full name',
  required = false,
  error,
}: SignatureCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Set drawing style
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';

    // Load existing signature if provided
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get mouse/touch position relative to canvas
  // Note: We don't multiply by dpr here because the context is already scaled
  const getPosition = useCallback(
    (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();

      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  // Start drawing
  const startDrawing = useCallback(
    (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const { x, y } = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    },
    [getPosition]
  );

  // Draw
  const draw = useCallback(
    (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const { x, y } = getPosition(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getPosition]
  );

  // Stop drawing
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.closePath();
    setIsDrawing(false);
    setHasDrawn(true);

    // Save signature as base64
    const signatureData = canvas.toDataURL('image/png');
    onChange(signatureData);
  }, [isDrawing, onChange]);

  // Clear signature
  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange('');
  }, [onChange]);

  return (
    <Stack gap="xs">
      {label && (
        <Text size="sm" fw={500}>
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </Text>
      )}
      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}

      <div
        style={{
          border: error ? '2px solid #fa5252' : '1px solid #ced4da',
          borderRadius: '4px',
          backgroundColor: '#ffffff',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '120px',
            cursor: 'crosshair',
            display: 'block',
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <Group justify="space-between">
        <Button variant="light" size="xs" onClick={clearSignature}>
          Clear Signature
        </Button>
        {hasDrawn && (
          <Text size="xs" c="green">
            ✓ Signed
          </Text>
        )}
      </Group>

      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}
