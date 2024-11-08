async function updateEffectStack(actor, inputId, stackCount) {
  const effectData = EFFECTS[inputId];
  if (!effectData) return;

  const maxStacks = effectData.maxStacks;
  const effectStacks = await actor.getFlag("emberwind", "effectStacks") || {};

  // Ensure the stack is within bounds
  const newStack = Math.max(0, Math.min(stackCount, maxStacks));

  effectStacks[inputId] = newStack;  // Update the stack count for the specific effect

  // Update the actor flag with the new effectStacks object
  await actor.setFlag("emberwind", "effectStacks", effectStacks);

  // Log the updated effect stacks
  console.log("Effect Stacks after update:", effectStacks);
}