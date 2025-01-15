// src/components/MultiCrop.tsx
import React, { useState, useRef, useEffect } from 'react';
import interact from 'interactjs';
import { DeleteIcon, NumberIcon } from './Icons'; // Import the icons
import { debounce } from 'lodash'; // You'll need to install lodash if not already present

export interface Coordinate {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

export type CrossOrigin = "" | "anonymous" | "use-credentials";

export interface MultiCropsProps {
  imageUrl: string;
  setCroppedImages: React.Dispatch<React.SetStateAction<string[]>>
  crossOrigin: CrossOrigin
  cropStyle?: React.CSSProperties;
  activeCropStyle?: React.CSSProperties;
  numberIconStyle?: React.CSSProperties;
  deleteIconStyle?: React.CSSProperties;
  deleteIconContainerStyle?: React.CSSProperties;
}

const defaultCropStyles: React.CSSProperties = {
  border: '2px solid #4CAF50',
  background: 'rgba(76, 175, 80, 0.2)',
  borderRadius: '2px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
}

const activeCropStyles: React.CSSProperties = {
  border: '2px solid #2196F3', // Blue border
  background: 'rgba(33, 150, 243, 0.3)', // Blue background with higher opacity
  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.4)', // Enhanced blue shadow
}

const MultiCrops: React.FC<MultiCropsProps> = ({
  imageUrl, setCroppedImages, crossOrigin,
  cropStyle, activeCropStyle, numberIconStyle, deleteIconStyle, deleteIconContainerStyle
}) => {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [activeCropId, setActiveCropId] = useState<string | null>(null);

  // Update the debounced function to use current coordinates
  const debouncedSaveCroppedImages = useRef(
    debounce((currentCoordinates: Coordinate[]) => {
      const imgElement = imageRef.current;
      if (!imgElement) return;

      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;
      const displayedWidth = imgElement.width;
      const displayedHeight = imgElement.height;

      const scaleX = naturalWidth / displayedWidth;
      const scaleY = naturalHeight / displayedHeight;

      const newCroppedImages = currentCoordinates
        .filter(coord => coord.width >= 10 && coord.height >= 10)
        .map((coord) => {
          const canvas = document.createElement('canvas');
          canvas.width = coord.width;
          canvas.height = coord.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              imgElement,
              coord.x * scaleX,
              coord.y * scaleY,
              coord.width * scaleX,
              coord.height * scaleY,
              0,
              0,
              coord.width,
              coord.height
            );
          }
          return canvas.toDataURL('image/png');
        });

      setCroppedImages(newCroppedImages);
    }, 300)
  ).current;

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setActiveCropId(null);
      if (e.target !== containerRef.current) return; // Ensure the event is on the container, not a crop
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setStartPoint({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        setIsDrawing(true);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const newCrop: Coordinate = {
        x: Math.min(startPoint.x, currentX),
        y: Math.min(startPoint.y, currentY),
        width: Math.abs(currentX - startPoint.x),
        height: Math.abs(currentY - startPoint.y),
        id: 'temp', // Temporary ID for drawing
      };

      setCoordinates((prev) => [...prev.filter((c) => c.id !== 'temp'), newCrop]);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && startPoint) {
      setCoordinates((prev) => {
        const newCoordinates = prev.map((c) =>
          c.id === 'temp' && c.width >= 10 && c.height >= 10
            ? { ...c, id: Math.random().toString(36).substr(2, 9) }
            : c
        ).filter(c => c.id !== 'temp' || (c.width >= 10 && c.height >= 10));
        debouncedSaveCroppedImages(newCoordinates);
        return newCoordinates;
      });
      setIsDrawing(false);
      setStartPoint(null);
    }
  };

  const deleteCrop = (id: string) => {
    setCoordinates((prev) => prev.filter((coord) => coord.id !== id));
    setCroppedImages((prev) => prev.filter((_, index) => coordinates[index].id !== id));
  };

  const bringToFront = (id: string) => {
    const cropElement = document.getElementById(id);
    if (cropElement) {
      cropElement.style.zIndex = '1000'; // Temporarily bring to front
    }
  };

  const handleCropMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveCropId(id);
    bringToFront(id);
  };

  useEffect(() => {
    coordinates.forEach((coordinate) => {
      const cropElement = document.getElementById(coordinate.id);
      if (cropElement) {
        if (coordinate.id === activeCropId || coordinate.id === 'temp') {
          interact(cropElement)
            .draggable({
              onstart: () => {
                bringToFront(coordinate.id);
              },
              onmove: (event) => {
                const { dx, dy } = event;
                const imgRect = imageRef.current?.getBoundingClientRect();
                if (imgRect) {
                  const newX = Math.max(0, Math.min(coordinate.x + dx, imgRect.width - coordinate.width));
                  const newY = Math.max(0, Math.min(coordinate.y + dy, imgRect.height - coordinate.height));
                  updateCoordinate(coordinate.id, {
                    x: newX,
                    y: newY,
                  });
                }
              },
              onend: () => {
                const cropElement = document.getElementById(coordinate.id);
                if (cropElement) {
                  cropElement.style.zIndex = '';
                }
                debouncedSaveCroppedImages(coordinates);
              },
            })
            .resizable({
              edges: { left: true, right: true, bottom: true, top: true },
              onmove: (event) => {
                const { width, height } = event.rect;
                const { left, top } = event.deltaRect;
                const imgRect = imageRef.current?.getBoundingClientRect();
                if (imgRect) {
                  const newWidth = Math.min(width, imgRect.width - coordinate.x);
                  const newHeight = Math.min(height, imgRect.height - coordinate.y);

                  if (newWidth >= 10 && newHeight >= 10) {
                    updateCoordinate(coordinate.id, {
                      x: coordinate.x + left,
                      y: coordinate.y + top,
                      width: newWidth,
                      height: newHeight,
                    });
                  }
                }
              },
              onend: () => {
                debouncedSaveCroppedImages(coordinates);
              },
            });
        } else {
          interact(cropElement).unset();
        }
      }
    });
  }, [coordinates, activeCropId]);

  const updateCoordinate = (id: string, newCoordinate: Partial<Coordinate>) => {
    setCoordinates((prev) =>
      prev.map((coord) => (coord.id === id ? { ...coord, ...newCoordinate } : coord))
    );
  };

  // Clean up the debounced function when component unmounts
  useEffect(() => {
    return () => {
      debouncedSaveCroppedImages.cancel();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ position: 'relative', width: 'fit-content', height: 'fit-content', border: '1px solid black', overflow: 'hidden', userSelect: 'none' }}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Background"
        style={{ display: 'block', maxWidth: '100%', height: 'auto', pointerEvents: 'none', userSelect: 'none' }}
        crossOrigin={imageUrl.startsWith('http') ? crossOrigin : undefined}
      />
      {coordinates.map((coordinate, index) => (
        <div
          key={coordinate.id}
          id={coordinate.id}
          onMouseDown={(e) => handleCropMouseDown(e, coordinate.id)}
          style={{
            ...(coordinate.id === activeCropId ? {...activeCropStyles, ...activeCropStyle} : defaultCropStyles),
            ...cropStyle,
            position: 'absolute',
            top: coordinate.y,
            left: coordinate.x,
            width: coordinate.width,
            height: coordinate.height,
            zIndex: coordinate.id === activeCropId ? 1000 : 1,
            cursor: coordinate.id === activeCropId ? 'move' : 'pointer',
            userSelect: 'none',
          }}
        >
          <DeleteIcon onClick={() => deleteCrop(coordinate.id)} deleteIconStyle={deleteIconStyle} deleteIconContainerStyle={deleteIconContainerStyle} />
          <NumberIcon number={index + 1} numberIconStyle={numberIconStyle} />
        </div>
      ))}
    </div>
  );
};

export default MultiCrops as React.ForwardRefExoticComponent<
  MultiCropsProps & React.RefAttributes<HTMLDivElement>
>; 