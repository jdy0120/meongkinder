import React from "react";
import { SVGProps } from "react";

interface SVGIconProps extends SVGProps<SVGSVGElement> {
  Icon: React.FC<SVGProps<SVGSVGElement>>;
  color?: string;
  isCursorPointer?: boolean;
  onClick?: (
    e: React.MouseEvent<SVGElement | HTMLDivElement>,
  ) => void;
  width?: string | number;
  height?: string | number;
}

const SVGIcon = ({
  Icon,
  color,
  isCursorPointer = false,
  onClick,
  width,
  height,
  className,
  ...props
}: SVGIconProps) => {
  const containerStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: isCursorPointer ? "pointer" : "default",
  };

  const iconStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    fill: color || "currentColor",
    transition: "all 0.2s ease-in-out",
    ...props.style,
  };

  return (
    <div
      onClick={onClick}
      className={`svg-icon-container ${className || ""}`}
      style={containerStyle}
    >
      <Icon {...props} style={iconStyle} />
      <style jsx>{`
        .svg-icon-container:hover path {
          fill: ${isCursorPointer ? "#000" : color || "currentColor"};
        }
      `}</style>
    </div>
  );
};

export default SVGIcon;
