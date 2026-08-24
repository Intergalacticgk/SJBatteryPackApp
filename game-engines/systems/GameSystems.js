import Matter from 'matter-js';

export const GameSystems = (entities, { touches, screen }) => {
  let engine = entities.physics.engine;
  let puck = entities.puck.body;
  let player = entities.player.body;
  let ai = entities.ai.body;

  const tableWidth = screen.width - 20;
  const tableHeight = screen.height - 180; 

  // 1. Smooth User Touch Input
  let touchEvent = touches.find(t => t.type === 'move' || t.type === 'start');
  if (touchEvent) {
    let inputX = touchEvent.delta ? player.position.x + touchEvent.delta.pageX : touchEvent.event.pageX - 10;
    let inputY = touchEvent.delta ? player.position.y + touchEvent.delta.pageY : touchEvent.event.pageY - 90;

    let constrainedX = Math.max(25, Math.min(inputX, tableWidth - 25));
    let constrainedY = Math.max(tableHeight / 2 + 20, Math.min(inputY, tableHeight - 25));

    Matter.Body.setPosition(player, { x: constrainedX, y: constrainedY });
  }

  // 2. 📉 ULTRA-CASUAL OPPONENT AI LOOP (Sluggish Reaction Speed)
  const aiBaseY = 60; // Defense baseline depth
  
  if (puck.position.y < tableHeight / 2) {
    // Puck is on the computer's half! Calculate target vectors
    let diffX = puck.position.x - ai.position.x;
    let diffY = puck.position.y - ai.position.y;
    
    // 🐌 Heavily reduced tracking values make the AI lag far behind fast puck movements
    let speedX = diffX * 0.022; // Slashed down significantly from 0.06
    let speedY = diffY > 0 ? diffY * 0.015 : (aiBaseY - ai.position.y) * 0.02; 

    Matter.Body.setVelocity(ai, { x: speedX, y: speedY });
  } else {
    // Puck is on your side. Computer slowly drifts back to net center
    let returnX = (tableWidth / 2) - ai.position.x;
    let returnY = aiBaseY - ai.position.y;
    
    Matter.Body.setVelocity(ai, { x: returnX * 0.01, y: returnY * 0.01 });
  }

  Matter.Engine.update(engine, 1000 / 60);

  return entities;
};