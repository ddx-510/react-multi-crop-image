// src/components/MultiCrop.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import interact from 'interactjs';
import { DeleteIcon, NumberIcon } from './Icons'; // Import the icons
import { debounce, throttle } from 'lodash'; // You'll need to install lodash if not already present

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
  setCroppedImages: React.Dispatch<React.SetStateAction<string[]>>;
  crossOrigin: CrossOrigin;
  coordinates?: Coordinate[];
  onCoordinatesChange?: (coordinates: Coordinate[]) => void;
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
  imageUrl, 
  setCroppedImages, 
  crossOrigin,
  coordinates: externalCoordinates,
  onCoordinatesChange,
  cropStyle, 
  activeCropStyle, 
  numberIconStyle, 
  deleteIconStyle, 
  deleteIconContainerStyle
}) => {
  const [internalCoordinates, setInternalCoordinates] = useState<Coordinate[]>([]);
  
  // Use external coordinates if provided, otherwise use internal state
  const coordinates = externalCoordinates ?? internalCoordinates;
  const setCoordinates = (newCoords: Coordinate[] | ((prev: Coordinate[]) => Coordinate[])) => {
    if (externalCoordinates) {
      // If external coordinates are provided, only call onCoordinatesChange
      const nextCoords = typeof newCoords === 'function' ? newCoords(coordinates) : newCoords;
      onCoordinatesChange?.(nextCoords);
    } else {
      // Otherwise update internal state
      setInternalCoordinates(newCoords);
    }
  };

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [activeCropId, setActiveCropId] = useState<string | null>(null);

  // Add new state and refs for scrolling
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);
  const scrollSpeed = 15; // pixels per scroll
  const scrollThreshold = 50; // pixels from edge to trigger scroll

  // Update the debounced function to use current coordinates
  const debouncedSaveCroppedImages = useRef(
    debounce((currentCoordinates: Coordinate[]) => {
      const imgElement = new Image();
      imgElement.crossOrigin = crossOrigin;
      imgElement.src = imageUrl;

      imgElement.onload = () => {
        const naturalWidth = imgElement.naturalWidth;
        const naturalHeight = imgElement.naturalHeight;
        const displayedWidth = imageRef.current?.width || naturalWidth;
        const displayedHeight = imageRef.current?.height || naturalHeight;

        const scaleX = naturalWidth / displayedWidth;
        const scaleY = naturalHeight / displayedHeight;

        const newCroppedImages = currentCoordinates
          .filter(coord => coord.width >= 10 && coord.height >= 10)
          .map((coord) => {
            // Calculate original dimensions at full scale
            const originalWidth = Math.round(coord.width * scaleX);
            const originalHeight = Math.round(coord.height * scaleY);

            const canvas = document.createElement('canvas');
            canvas.width = originalWidth;
            canvas.height = originalHeight;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              ctx.drawImage(
                imgElement,
                Math.round(coord.x * scaleX),
                Math.round(coord.y * scaleY),
                originalWidth,
                originalHeight,
                0,
                0,
                originalWidth,
                originalHeight
              );
            }
            return canvas.toDataURL('image/jpeg', 0.95);
          });

        setCroppedImages(newCroppedImages);
      };
    }, 500)
  ).current;

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setActiveCropId(null);
      if (e.target !== containerRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setStartPoint({
          x: e.clientX - rect.left + containerRef.current.scrollLeft,
          y: e.clientY - rect.top + containerRef.current.scrollTop,
        });
        setIsDrawing(true);
      }
    }
  };

  const handleScroll = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }

    const scrollFrame = () => {
      if (!containerRef.current) return;
      const currentRect = container.getBoundingClientRect();
      
      // Calculate distances from edges relative to current mouse position
      const distanceFromRight = currentRect.right - clientX;
      const distanceFromBottom = currentRect.bottom - clientY;
      const distanceFromLeft = clientX - currentRect.left;
      const distanceFromTop = clientY - currentRect.top;
      
      let shouldContinue = false;

      if (distanceFromRight < scrollThreshold && container.scrollLeft < container.scrollWidth - container.clientWidth) {
        container.scrollLeft += scrollSpeed;
        shouldContinue = true;
      } else if (distanceFromLeft < scrollThreshold && container.scrollLeft > 0) {
        container.scrollLeft -= scrollSpeed;
        shouldContinue = true;
      }
      
      if (distanceFromBottom < scrollThreshold && container.scrollTop < container.scrollHeight - container.clientHeight) {
        container.scrollTop += scrollSpeed;
        shouldContinue = true;
      } else if (distanceFromTop < scrollThreshold && container.scrollTop > 0) {
        container.scrollTop -= scrollSpeed;
        shouldContinue = true;
      }

      if (shouldContinue) {
        scrollInterval.current = setTimeout(scrollFrame, 16); // ~60fps
      }
    };

    scrollFrame();
  };

  // Memoize style combinations
  const combinedDefaultStyles = useMemo(() => ({
    ...defaultCropStyles,
    ...cropStyle
  }), [cropStyle]);

  const combinedActiveStyles = useMemo(() => ({
    ...activeCropStyles,
    ...activeCropStyle,
    ...cropStyle
  }), [activeCropStyle, cropStyle]);

  // Update handleMouseMove to be more performant
  const handleMouseMove = useCallback(
    throttle((e: React.MouseEvent) => {
      if (!isDrawing || !startPoint) return;
      requestAnimationFrame(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          handleScroll(e.clientX, e.clientY);

          const currentX = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
          const currentY = e.clientY - rect.top + (containerRef.current?.scrollTop ?? 0);

          const newCrop: Coordinate = {
            x: Math.min(startPoint.x, currentX),
            y: Math.min(startPoint.y, currentY),
            width: Math.abs(currentX - startPoint.x),
            height: Math.abs(currentY - startPoint.y),
            id: 'temp',
          };

          setCoordinates((prev) => [...prev.filter((c) => c.id !== 'temp'), newCrop]);
        }
      });
    }, 32), // Reduced to ~30fps for better performance
    [isDrawing, startPoint, setCoordinates]
  );

  const handleMouseUp = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }

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
                // Handle scrolling during resize
                handleScroll(event.clientX, event.clientY);

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
                if (scrollInterval.current) {
                  clearInterval(scrollInterval.current);
                  scrollInterval.current = null;
                }
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

  // Add effect to handle coordinates changes
  useEffect(() => {
    onCoordinatesChange?.(coordinates);
  }, [coordinates, onCoordinatesChange]);

  // Add cleanup for scroll interval
  useEffect(() => {
    return () => {
      if (scrollInterval.current) {
        clearInterval(scrollInterval.current);
      }
    };
  }, []);

  // Memoize the crop components to prevent unnecessary re-renders
  const cropElements = useMemo(() => 
    coordinates.map((coordinate, index) => (
      <div
        key={coordinate.id}
        id={coordinate.id}
        onMouseDown={(e) => handleCropMouseDown(e, coordinate.id)}
        style={{
          ...(coordinate.id === activeCropId ? combinedActiveStyles : combinedDefaultStyles),
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
        <DeleteIcon 
          onClick={() => deleteCrop(coordinate.id)} 
          deleteIconStyle={deleteIconStyle} 
          deleteIconContainerStyle={deleteIconContainerStyle} 
        />
        <NumberIcon number={index + 1} numberIconStyle={numberIconStyle} />
      </div>
    )),
    [coordinates, activeCropId, combinedActiveStyles, combinedDefaultStyles, deleteIconStyle, deleteIconContainerStyle, numberIconStyle]
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'relative',
        width: 'fit-content',
        maxHeight: '90vh',
        border: '1px solid black',
        overflow: 'auto',
        userSelect: 'none',
        cursor: 'crosshair'
      }}
    >
      <img
        ref={imageRef}
        src={imageUrl} // Use original image for display
        alt="Background"
        style={{ display: 'block', maxWidth: '100%', height: 'auto', pointerEvents: 'none', userSelect: 'none' }}
        crossOrigin={crossOrigin}
      />
      {cropElements}
    </div>
  );
};

export default MultiCrops as React.ForwardRefExoticComponent<
  MultiCropsProps & React.RefAttributes<HTMLDivElement>
>; 