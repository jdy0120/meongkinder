import React from "react";
import { motion, Variants, TargetAndTransition } from "framer-motion";

interface PageMotionProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  onHoverStart?: TargetAndTransition;
  onHoverEnd?: TargetAndTransition;
  style?: React.CSSProperties;
}

const PageMotion = ({
  children,
  direction = "up",
  onHoverStart,
  onHoverEnd,
  style,
}: PageMotionProps) => {
  const animationVariants: Variants = {
    hidden: {
      ...(direction === "up" && { y: "10%" }),
      ...(direction === "down" && { y: "-10%" }),
      ...(direction === "left" && { x: "10%" }),
      ...(direction === "right" && { x: "-10%" }),
      opacity: 0.1,
    },
    visible: {
      y: 0,
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.3,
      },
    },
  };

  return (
    <motion.div
      key='page'
      initial='hidden'
      animate='visible'
      whileHover={onHoverStart}
      variants={animationVariants}
      style={style}
    >
      {children}
    </motion.div>
  );
};

export default PageMotion;
