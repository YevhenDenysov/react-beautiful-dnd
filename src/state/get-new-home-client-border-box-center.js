// @flow
import { type Position, type Rect } from 'css-box-model';
import type {
  Axis,
  DraggableDimension,
  DraggableDimensionMap,
  DragImpact,
  DroppableDimension,
  GroupingImpact,
  DraggableId,
} from '../types';
import moveToEdge from './move-to-edge';
import getDraggablesInsideDroppable from './get-draggables-inside-droppable';
import { add } from './position';

type NewHomeArgs = {|
  impact: DragImpact,
  draggable: DraggableDimension,
  // all draggables in the system
  draggables: DraggableDimensionMap,
  destination: ?DroppableDimension,
|};

// Returns the client offset required to move an item from its
// original client position to its final resting position
export default ({
  impact,
  draggable,
  draggables,
  destination,
}: NewHomeArgs): Position => {
  const originalCenter: Position = draggable.client.borderBox.center;

  // If grouping return the center position of the group target
  const group: ?GroupingImpact = impact.group;
  if (group) {
    const groupingWith: DraggableId = group.groupingWith.draggableId;
    const isDisplaced: boolean = Boolean(impact.movement.map[groupingWith]);
    console.log('is displaced?', isDisplaced);
    const center: Position = draggables[groupingWith].client.borderBox.center;

    return isDisplaced
      ? add(center, impact.movement.displacedBy.point)
      : center;
  }

  // not dropping anywhere
  if (destination == null) {
    return originalCenter;
  }

  const { displaced, isInFrontOfStart } = impact.movement;
  const axis: Axis = destination.axis;

  const isWithinHomeDroppable: boolean =
    destination.descriptor.id === draggable.descriptor.droppableId;

  // dropping back into home index
  if (isWithinHomeDroppable && !displaced.length) {
    return originalCenter;
  }

  // All the draggables in the destination (even the ones that haven't moved)
  const draggablesInDestination: DraggableDimension[] = getDraggablesInsideDroppable(
    destination,
    draggables,
  );

  // Find the dimension we need to compare the dragged item with
  const movingRelativeTo: Rect = (() => {
    if (isWithinHomeDroppable) {
      return draggables[displaced[0].draggableId].client.borderBox;
    }

    // In a foreign list

    if (displaced.length) {
      return draggables[displaced[0].draggableId].client.borderBox;
    }

    // If we're dragging to the last place in a new droppable
    // which has items in it (but which haven't moved)
    if (draggablesInDestination.length) {
      return draggablesInDestination[draggablesInDestination.length - 1].client
        .marginBox;
    }

    // Otherwise, return the dimension of the empty foreign droppable
    return destination.client.contentBox;
  })();

  const { sourceEdge, destinationEdge } = (() => {
    if (isWithinHomeDroppable) {
      if (isInFrontOfStart) {
        // move below the target
        return { sourceEdge: 'end', destinationEdge: 'end' };
      }

      // move above the target
      return { sourceEdge: 'start', destinationEdge: 'start' };
    }

    // not within our home droppable

    // If we're moving in after the last draggable
    // we want to move the draggable below the last item
    if (!displaced.length && draggablesInDestination.length) {
      return { sourceEdge: 'start', destinationEdge: 'end' };
    }

    // move above the target
    return { sourceEdge: 'start', destinationEdge: 'start' };
  })();

  const source: Rect = draggable.client.borderBox;

  // This is the draggable's new home
  const targetCenter: Position = moveToEdge({
    source,
    sourceEdge,
    destination: movingRelativeTo,
    destinationEdge,
    destinationAxis: axis,
  });

  return targetCenter;
};
