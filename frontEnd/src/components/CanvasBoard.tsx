'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface Point {
    x: number;
    y: number;
}

interface DrawLine {
    start: Point;
    end: Point;
    color: string;
    width: number;
}

interface CanvasBoardProps {
    isDrawer: boolean;
    color: string;
    width: number;
}

export default function CanvasBoard({ isDrawer, color, width }: CanvasBoardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { socket } = useGameStore();
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPoint = useRef<Point | null>(null);

    // Setup Canvas & Socket Listeners
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !socket) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set dimensions (could be dynamic or fixed)
        // For simplicity, we'll rely on CSS for size but set internal resolution
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        };
        resize();
        window.addEventListener('resize', resize);

        // Socket: Receive Draw
        const onDraw = (line: DrawLine) => {
            drawLine(ctx, line);
        };

        const onClear = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        };

        socket.on('draw', onDraw);
        socket.on('clear-canvas', onClear);

        return () => {
            window.removeEventListener('resize', resize);
            socket.off('draw', onDraw);
            socket.off('clear-canvas', onClear);
        };
    }, [socket]);

    const drawLine = (ctx: CanvasRenderingContext2D, line: DrawLine) => {
        ctx.beginPath();
        ctx.lineWidth = line.width;
        ctx.strokeStyle = line.color;
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
        ctx.stroke();
    };

    const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawer) return;
        setIsDrawing(true);
        const point = getPoint(e);
        if (point) lastPoint.current = point;
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !isDrawer || !lastPoint.current || !socket) return;

        const point = getPoint(e);
        if (!point) return;

        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            const line: DrawLine = {
                start: lastPoint.current,
                end: point,
                color,
                width
            };

            // Draw locally
            drawLine(ctx, line);

            // Emit
            socket.emit('draw', line);

            lastPoint.current = point;
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPoint.current = null;
    };

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
        />
    );
}
