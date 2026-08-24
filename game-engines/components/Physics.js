import React from 'react';
import { View } from 'react-native';

// Standard Round Mallet / Puck Graphic
export const CircleRenderer = ({ body, color }) => {
  const { position, circleRadius } = body;
  const size = circleRadius * 2;
  
  return (
    <View
      style={{
        position: 'absolute',
        left: position.x - circleRadius,
        top: position.y - circleRadius,
        width: size,
        height: size,
        borderRadius: circleRadius,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: '#FFF',
      }}
    />
  );
};

// Rigid Boundary Walls
export const WallRenderer = ({ body, color }) => {
  const { position, bounds } = body;
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  return (
    <View
      style={{
        position: 'absolute',
        left: position.x - width / 2,
        top: position.y - height / 2,
        width: width,
        height: height,
        backgroundColor: color || '#266B73',
      }}
    />
  );
};