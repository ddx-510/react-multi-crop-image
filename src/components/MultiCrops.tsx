// src/components/MultiCrop.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
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

  // Add new state for transform scale
  const [scale, setScale] = useState({ x: 1, y: 1 });

  // Add new state and refs for auto-scrolling
  const scrollInterval = useRef<number | null>(null);
  const scrollSpeed = 10; // pixels per frame
  const scrollThreshold = 50; // pixels from edge to trigger scroll

  // Add new state for viewport tracking
  const [viewport, setViewport] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  // Update the useEffect that calculates cropped images to include scale calculation
  useEffect(() => {
    const imgElement = imageRef.current;
    if (imgElement) {
      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;
      const displayedWidth = imgElement.width;
      const displayedHeight = imgElement.height;

      setScale({
        x: naturalWidth / displayedWidth,
        y: naturalHeight / displayedHeight
      });
    }
  }, [imageUrl]);

  // Update the debounced function to use scale from state instead of recalculating
  const debouncedSaveCroppedImages = useRef(
    debounce((currentCoordinates: Coordinate[]) => {
      const imgElement = imageRef.current;
      if (!imgElement) return;

      const newCroppedImages = currentCoordinates
        .filter(coord => coord.width >= 10 && coord.height >= 10)
        .map((coord) => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(coord.width * scale.x);
          canvas.height = Math.round(coord.height * scale.y);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              imgElement,
              Math.round(coord.x * scale.x),
              Math.round(coord.y * scale.y),
              Math.round(coord.width * scale.x),
              Math.round(coord.height * scale.y),
              0,
              0,
              Math.round(coord.width * scale.x),
              Math.round(coord.height * scale.y)
            );
          }
          return canvas.toDataURL('image/png');
        });

      setCroppedImages(newCroppedImages);
    }, 500) // Increased debounce timeout
  ).current;

  // Add cleanup function for scroll interval
  const clearScrollInterval = () => {
    if (scrollInterval.current) {
      window.clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return;

    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return;

    const currentX = e.clientX - rect.left + container.scrollLeft;
    const currentY = e.clientY - rect.top + container.scrollTop;

    // Check if mouse is near bottom or top edge
    const mouseY = e.clientY - rect.top;
    
    // Clear existing interval
    clearScrollInterval();

    // Start auto-scroll if near edges
    if (mouseY > rect.height - scrollThreshold) {
      // Near bottom - scroll down
      scrollInterval.current = window.setInterval(() => {
        container.scrollTop += scrollSpeed;
        // Update crop coordinates after scroll
        updateDrawingCoordinates(currentX, currentY + scrollSpeed);
      }, 16); // ~60fps
    } else if (mouseY < scrollThreshold) {
      // Near top - scroll up
      scrollInterval.current = window.setInterval(() => {
        container.scrollTop -= scrollSpeed;
        // Update crop coordinates after scroll
        updateDrawingCoordinates(currentX, currentY - scrollSpeed);
      }, 16);
    }

    updateDrawingCoordinates(currentX, currentY);
  };

  // Helper function to update coordinates while drawing
  const updateDrawingCoordinates = (currentX: number, currentY: number) => {
    if (!startPoint) return;
    const newCrop: Coordinate = {
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y),
      id: 'temp',
    };

    setCoordinates((prev) => [...prev.filter((c) => c.id !== 'temp'), newCrop]);
  };

  // Update handleMouseUp to clear scroll interval
  const handleMouseUp = () => {
    clearScrollInterval();
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

  // Update the useEffect for interact.js to use requestAnimationFrame
  useEffect(() => {
    coordinates.forEach((coordinate) => {
      const cropElement = document.getElementById(coordinate.id);
      if (cropElement) {
        if (coordinate.id === activeCropId || coordinate.id === 'temp') {
          interact(cropElement)
            .draggable({
              onstart: () => bringToFront(coordinate.id),
              onmove: (event) => {
                requestAnimationFrame(() => {
                  const { dx, dy } = event;
                  const imgRect = imageRef.current?.getBoundingClientRect();
                  if (imgRect) {
                    const newX = Math.max(0, Math.min(coordinate.x + dx, imgRect.width - coordinate.width));
                    const newY = Math.max(0, Math.min(coordinate.y + dy, imgRect.height - coordinate.height));
                    updateCoordinate(coordinate.id, { x: newX, y: newY });
                  }
                });
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
                const container = containerRef.current;
                
                if (!imgRect || !container) return;

                // Get mouse position relative to container
                const mouseY = event.clientY - container.getBoundingClientRect().top;
                const scrollThreshold = 50;
                const scrollSpeed = 5; // Reduced for smoother scrolling

                // Use requestAnimationFrame for smooth scrolling
                requestAnimationFrame(() => {
                  if (mouseY > container.clientHeight - scrollThreshold) {
                    const scrollDelta = scrollSpeed * ((mouseY - (container.clientHeight - scrollThreshold)) / scrollThreshold);
                    container.scrollTop += scrollDelta;
                  } else if (mouseY < scrollThreshold) {
                    const scrollDelta = scrollSpeed * ((scrollThreshold - mouseY) / scrollThreshold);
                    container.scrollTop -= scrollDelta;
                  }

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
                });
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
      clearScrollInterval();
    };
  }, []);

  // Add effect to handle coordinates changes
  useEffect(() => {
    onCoordinatesChange?.(coordinates);
  }, [coordinates, onCoordinatesChange]);

  // Update viewport on scroll
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      setViewport({
        top: container.scrollTop,
        bottom: container.scrollTop + container.clientHeight,
        left: container.scrollLeft,
        right: container.scrollLeft + container.clientWidth
      });
    }
  }, []);

  // Add scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial viewport calculation
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Filter coordinates to only render visible crops
  const visibleCoordinates = coordinates.filter(coord => {
    return coord.y < viewport.bottom && 
           (coord.y + coord.height) > viewport.top &&
           coord.x < viewport.right &&
           (coord.x + coord.width) > viewport.left;
  });

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
        cursor: 'crosshair',
        willChange: 'transform' // Optimize for animations
      }}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Background"
        style={{ 
          display: 'block', 
          maxWidth: '100%', 
          height: 'auto', 
          pointerEvents: 'none', 
          userSelect: 'none',
          willChange: 'transform' // Optimize for animations
        }}
        crossOrigin={imageUrl.startsWith('http') ? crossOrigin : undefined}
        loading="lazy" // Add lazy loading
      />
      {visibleCoordinates.map((coordinate, index) => (
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