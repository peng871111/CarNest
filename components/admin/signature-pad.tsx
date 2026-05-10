"use client";

import type { PointerEvent } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  toDataUrl: () => string;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  initialDataUrl?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad({ initialDataUrl }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#111111";

    if (initialDataUrl) {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, rect.width, rect.height);
        context.drawImage(image, 0, 0, rect.width, rect.height);
        hasStrokeRef.current = true;
      };
      image.src = initialDataUrl;
    } else {
      context.clearRect(0, 0, rect.width, rect.height);
    }

    setMounted(true);
  }, [initialDataUrl]);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasStrokeRef.current = false;
    },
    toDataUrl() {
      return canvasRef.current?.toDataURL("image/png") ?? "";
    },
    isEmpty() {
      return !hasStrokeRef.current;
    }
  }));

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = getPoint(event);
    drawingRef.current = true;
    hasStrokeRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none bg-[#fcfbf8]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <p className="text-xs text-ink/55">
        {mounted ? "Use your finger or Apple Pencil to sign." : "Preparing signature pad..."}
      </p>
    </div>
  );
});
