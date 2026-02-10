import { useState, useRef, useEffect } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { X, RotateCcw, RotateCw } from "lucide-react";
import "./ColorPicker.css";

type ColorMode = "solid" | "gradient";

interface ColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  initialColor?: string;
  onColorChange?: (color: string) => void;
  anchorElement?: HTMLElement | null;
}

export function ColorPicker({ isOpen, onClose, initialColor = "#000000", onColorChange, anchorElement }: ColorPickerProps) {
  const [colorMode, setColorMode] = useState<ColorMode>("solid");
  const [color, setColor] = useState(initialColor);
  const [rgb, setRgb] = useState({ r: 0, g: 0, b: 0 });
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [gradientStops, setGradientStops] = useState([
    { color: "#316F6B", position: 0 },
    { color: "#9400D3", position: 100 },
  ]);
  const [gradientAngle, setGradientAngle] = useState(285);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setColor(initialColor);
    const rgb = hexToRgb(initialColor);
    if (rgb) {
      setRgb(rgb);
    }
  }, [initialColor]);

  useEffect(() => {
    if (colorMode === "gradient" && gradientStops[activeStopIndex]) {
      setColor(gradientStops[activeStopIndex].color);
      const rgb = hexToRgb(gradientStops[activeStopIndex].color);
      if (rgb) {
        setRgb(rgb);
      }
    }
  }, [colorMode, activeStopIndex]);

  useEffect(() => {
    if (isOpen && anchorElement && pickerRef.current) {
      const updatePosition = () => {
        const anchorRect = anchorElement.getBoundingClientRect();
        const parentElement = pickerRef.current?.parentElement;
        
        if (parentElement) {
          const parentRect = parentElement.getBoundingClientRect();
          
          setPosition({
            top: anchorRect.bottom - parentRect.top + 8,
            left: anchorRect.left - parentRect.left,
          });
        }
      };
      
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, anchorElement]);

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          pickerRef.current &&
          !pickerRef.current.contains(event.target as Node) &&
          anchorElement &&
          !anchorElement.contains(event.target as Node)
        ) {
          onClose();
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose, anchorElement]);

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    const rgb = hexToRgb(newColor);
    if (rgb) {
      setRgb(rgb);
    }
    
    if (colorMode === "gradient" && gradientStops[activeStopIndex]) {
      const newStops = [...gradientStops];
      newStops[activeStopIndex].color = newColor;
      setGradientStops(newStops);
    }
    
    onColorChange?.(newColor);
  };
  
  const handleAngleChange = (delta: number) => {
    const newAngle = (gradientAngle + delta + 360) % 360;
    setGradientAngle(newAngle);
  };
  
  const handleAngleInputChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(360, numValue));
    setGradientAngle(clampedValue);
  };

  const handleRgbChange = (component: "r" | "g" | "b", value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(255, numValue));
    const newRgb = { ...rgb, [component]: clampedValue };
    setRgb(newRgb);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setColor(hex);
    onColorChange?.(hex);
  };

  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  };

  if (!isOpen) return null;

  return (
    <>
      {anchorElement ? (
        <div
          className="color-picker-popover"
          ref={pickerRef}
          style={{
            position: "absolute",
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className="color-picker-container">
        <div className="color-picker-header">
          <div className="color-picker-tabs">
            <button
              className={`color-picker-tab ${colorMode === "solid" ? "color-picker-tab--active" : ""}`}
              onClick={() => setColorMode("solid")}
            >
              实心
            </button>
            <button
              className={`color-picker-tab ${colorMode === "gradient" ? "color-picker-tab--active" : ""}`}
              onClick={() => setColorMode("gradient")}
            >
              渐变
            </button>
          </div>
          <button className="color-picker-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {colorMode === "solid" && (
          <div className="color-picker-content">
            <div className="color-picker-main">
              <HexColorPicker color={color} onChange={handleColorChange} />
            </div>
            <div className="color-picker-inputs">
              <div className="color-picker-input-group">
                <span className="color-picker-input-label">#</span>
                <HexColorInput
                  color={color}
                  onChange={handleColorChange}
                  className="color-picker-hex-input"
                  prefixed
                />
              </div>
              <div className="color-picker-rgb-inputs">
                <div className="color-picker-input-group">
                  <span className="color-picker-input-label">R</span>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.r}
                    onChange={(e) => handleRgbChange("r", e.target.value)}
                    className="color-picker-number-input"
                  />
                </div>
                <div className="color-picker-input-group">
                  <span className="color-picker-input-label">G</span>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.g}
                    onChange={(e) => handleRgbChange("g", e.target.value)}
                    className="color-picker-number-input"
                  />
                </div>
                <div className="color-picker-input-group">
                  <span className="color-picker-input-label">B</span>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.b}
                    onChange={(e) => handleRgbChange("b", e.target.value)}
                    className="color-picker-number-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {colorMode === "gradient" && (
          <div className="color-picker-content">
            <div className="color-picker-gradient-bar-container">
              <div
                className="color-picker-gradient-bar"
                style={{
                  background: `linear-gradient(90deg, ${gradientStops[0].color} ${gradientStops[0].position}%, ${gradientStops[1].color} ${gradientStops[1].position}%)`,
                }}
              >
                {gradientStops.map((stop, index) => (
                  <div
                    key={index}
                    className={`color-picker-gradient-stop ${
                      activeStopIndex === index ? "color-picker-gradient-stop--active" : ""
                    }`}
                    style={{
                      left: `${stop.position}%`,
                      backgroundColor: stop.color,
                    }}
                    onClick={() => {
                      setActiveStopIndex(index);
                      setColor(stop.color);
                      const rgb = hexToRgb(stop.color);
                      if (rgb) {
                        setRgb(rgb);
                      }
                    }}
                  />
                ))}
              </div>
              <div className="color-picker-angle-control">
                <button
                  className="color-picker-angle-button"
                  onClick={() => handleAngleChange(-15)}
                >
                  <RotateCcw size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={gradientAngle}
                  onChange={(e) => handleAngleInputChange(e.target.value)}
                  className="color-picker-angle-input"
                />
                <span className="color-picker-angle-unit">°</span>
                <button
                  className="color-picker-angle-button"
                  onClick={() => handleAngleChange(15)}
                >
                  <RotateCw size={14} />
                </button>
              </div>
            </div>
            <div className="color-picker-main">
              <HexColorPicker color={color} onChange={handleColorChange} />
            </div>
            <div className="color-picker-inputs">
              <div className="color-picker-input-group">
                <span className="color-picker-input-label">#</span>
                <HexColorInput
                  color={color}
                  onChange={handleColorChange}
                  className="color-picker-hex-input"
                  prefixed
                />
              </div>
              <div className="color-picker-rgb-inputs">
                <div className="color-picker-input-group">
                  <span className="color-picker-input-label">R</span>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.r}
                    onChange={(e) => handleRgbChange("r", e.target.value)}
                    className="color-picker-number-input"
                  />
                </div>
                <div className="color-picker-input-group">
                  <span className="color-picker-input-label">G</span>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.g}
                    onChange={(e) => handleRgbChange("g", e.target.value)}
                    className="color-picker-number-input"
                  />
                </div>
                <div className="color-picker-input-group">
                  <span className="color-picker-input-label">B</span>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.b}
                    onChange={(e) => handleRgbChange("b", e.target.value)}
                    className="color-picker-number-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      ) : (
        <div className="color-picker-overlay">
          <div className="color-picker-container" ref={pickerRef}>
            <div className="color-picker-header">
              <div className="color-picker-tabs">
                <button
                  className={`color-picker-tab ${colorMode === "solid" ? "color-picker-tab--active" : ""}`}
                  onClick={() => setColorMode("solid")}
                >
                  实心
                </button>
                <button
                  className={`color-picker-tab ${colorMode === "gradient" ? "color-picker-tab--active" : ""}`}
                  onClick={() => setColorMode("gradient")}
                >
                  渐变
                </button>
              </div>
              <button className="color-picker-close" onClick={onClose}>
                <X size={16} />
              </button>
            </div>

            {colorMode === "solid" && (
              <div className="color-picker-content">
                <div className="color-picker-main">
                  <HexColorPicker color={color} onChange={handleColorChange} />
                </div>
                <div className="color-picker-inputs">
                  <div className="color-picker-input-group">
                    <span className="color-picker-input-label">#</span>
                    <HexColorInput
                      color={color}
                      onChange={handleColorChange}
                      className="color-picker-hex-input"
                      prefixed
                    />
                  </div>
                  <div className="color-picker-rgb-inputs">
                    <div className="color-picker-input-group">
                      <span className="color-picker-input-label">R</span>
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={rgb.r}
                        onChange={(e) => handleRgbChange("r", e.target.value)}
                        className="color-picker-number-input"
                      />
                    </div>
                    <div className="color-picker-input-group">
                      <span className="color-picker-input-label">G</span>
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={rgb.g}
                        onChange={(e) => handleRgbChange("g", e.target.value)}
                        className="color-picker-number-input"
                      />
                    </div>
                    <div className="color-picker-input-group">
                      <span className="color-picker-input-label">B</span>
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={rgb.b}
                        onChange={(e) => handleRgbChange("b", e.target.value)}
                        className="color-picker-number-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {colorMode === "gradient" && (
              <div className="color-picker-content">
                <div className="color-picker-gradient-bar-container">
                  <div
                    className="color-picker-gradient-bar"
                    style={{
                      background: `linear-gradient(90deg, ${gradientStops[0].color} ${gradientStops[0].position}%, ${gradientStops[1].color} ${gradientStops[1].position}%)`,
                    }}
                  >
                    {gradientStops.map((stop, index) => (
                      <div
                        key={index}
                        className={`color-picker-gradient-stop ${
                          activeStopIndex === index ? "color-picker-gradient-stop--active" : ""
                        }`}
                        style={{
                          left: `${stop.position}%`,
                          backgroundColor: stop.color,
                        }}
                        onClick={() => {
                          setActiveStopIndex(index);
                          setColor(stop.color);
                          const rgb = hexToRgb(stop.color);
                          if (rgb) {
                            setRgb(rgb);
                          }
                        }}
                      />
                    ))}
                  </div>
                  <div className="color-picker-angle-control">
                    <button
                      className="color-picker-angle-button"
                      onClick={() => handleAngleChange(-15)}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={gradientAngle}
                      onChange={(e) => handleAngleInputChange(e.target.value)}
                      className="color-picker-angle-input"
                    />
                    <span className="color-picker-angle-unit">°</span>
                    <button
                      className="color-picker-angle-button"
                      onClick={() => handleAngleChange(15)}
                    >
                      <RotateCw size={14} />
                    </button>
                  </div>
                </div>
                <div className="color-picker-main">
                  <HexColorPicker color={color} onChange={handleColorChange} />
                </div>
                <div className="color-picker-inputs">
                  <div className="color-picker-input-group">
                    <span className="color-picker-input-label">#</span>
                    <HexColorInput
                      color={color}
                      onChange={handleColorChange}
                      className="color-picker-hex-input"
                      prefixed
                    />
                  </div>
                  <div className="color-picker-rgb-inputs">
                    <div className="color-picker-input-group">
                      <span className="color-picker-input-label">R</span>
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={rgb.r}
                        onChange={(e) => handleRgbChange("r", e.target.value)}
                        className="color-picker-number-input"
                      />
                    </div>
                    <div className="color-picker-input-group">
                      <span className="color-picker-input-label">G</span>
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={rgb.g}
                        onChange={(e) => handleRgbChange("g", e.target.value)}
                        className="color-picker-number-input"
                      />
                    </div>
                    <div className="color-picker-input-group">
                      <span className="color-picker-input-label">B</span>
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={rgb.b}
                        onChange={(e) => handleRgbChange("b", e.target.value)}
                        className="color-picker-number-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
