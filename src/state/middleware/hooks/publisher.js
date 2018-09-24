// @flow
import invariant from 'tiny-invariant';
import messagePreset from '../util/message-preset';
import * as timings from '../../../debug/timings';
import getExpiringAnnounce from './expiring-announce';
import getFrameMarshal, { type FrameMarshal } from './frame-marshal';
import type {
  DropResult,
  Hooks,
  HookProvided,
  Critical,
  DragImpact,
  DraggableLocation,
  Combine,
  DragStart,
  Announce,
  DragUpdate,
  OnBeforeDragStartHook,
  OnDragStartHook,
  OnDragUpdateHook,
  OnDragEndHook,
} from '../../../types';
import { isCombineEqual, isCriticalEqual, areLocationsEqual } from './is-equal';

const withTimings = (key: string, fn: Function) => {
  timings.start(key);
  fn();
  timings.finish(key);
};

const getDragStart = (critical: Critical): DragStart => ({
  draggableId: critical.draggable.id,
  type: critical.droppable.type,
  source: {
    droppableId: critical.droppable.id,
    index: critical.draggable.index,
  },
});

type AnyPrimaryHookFn = OnDragStartHook | OnDragUpdateHook | OnDragEndHook;
type AnyHookData = DragStart | DragUpdate | DropResult;

const execute = (
  hook: ?AnyPrimaryHookFn,
  data: AnyHookData,
  announce: Announce,
  getDefaultMessage: (data: any) => string,
) => {
  if (!hook) {
    announce(getDefaultMessage(data));
    return;
  }

  const willExpire: Announce = getExpiringAnnounce(announce);
  const provided: HookProvided = {
    announce: willExpire,
  };

  // Casting because we are not validating which data type is going into which hook
  hook((data: any), provided);

  if (!willExpire.wasCalled()) {
    announce(getDefaultMessage(data));
  }
};

type WhileDragging = {|
  lastCritical: Critical,
  lastCombine: ?Combine,
  lastLocation: ?DraggableLocation,
|};

export default (getHooks: () => Hooks, announce: Announce) => {
  let dragging: ?WhileDragging = null;
  const frameMarshal: FrameMarshal = getFrameMarshal();

  const beforeStart = (critical: Critical) => {
    invariant(
      !dragging,
      'Cannot fire onBeforeDragStart as a drag start has already been published',
    );
    withTimings('onBeforeDragStart', () => {
      // No use of screen reader for this hook
      const fn: ?OnBeforeDragStartHook = getHooks().onBeforeDragStart;
      if (fn) {
        fn(getDragStart(critical));
      }
    });
  };

  const start = (critical: Critical) => {
    invariant(
      !dragging,
      'Cannot fire onBeforeDragStart as a drag start has already been published',
    );
    const data: DragStart = getDragStart(critical);
    dragging = {
      lastCritical: critical,
      lastLocation: data.source,
      lastCombine: null,
    };

    // we will flush this frame if we receive any hook updates
    frameMarshal.add(() => {
      withTimings('onDragStart', () =>
        execute(
          getHooks().onDragStart,
          data,
          announce,
          messagePreset.onDragStart,
        ),
      );
    });
  };

  // Passing in the critical location again as it can change during a drag
  const move = (critical: Critical, impact: DragImpact) => {
    frameMarshal.flush();
    const location: ?DraggableLocation = impact.destination;
    const combine: ?Combine = impact.merge ? impact.merge.combine : null;
    invariant(
      dragging,
      'Cannot fire onDragMove when onDragStart has not been called',
    );

    // Has the critical changed? Will result in a source change
    const hasCriticalChanged: boolean = !isCriticalEqual(
      critical,
      dragging.lastCritical,
    );
    if (hasCriticalChanged) {
      dragging.lastCritical = critical;
    }

    // Has the location changed? Will result in a destination change
    const hasLocationChanged: boolean = !areLocationsEqual(
      dragging.lastLocation,
      location,
    );
    if (hasLocationChanged) {
      dragging.lastLocation = location;
    }
    const hasGroupingChanged: boolean = !isCombineEqual(
      dragging.lastCombine,
      combine,
    );
    if (hasGroupingChanged) {
      dragging.lastCombine = combine;
    }

    // Nothing has changed - no update needed
    if (!hasCriticalChanged && !hasLocationChanged && !hasGroupingChanged) {
      return;
    }

    const data: DragUpdate = {
      ...getDragStart(critical),
      combine,
      destination: location,
    };

    frameMarshal.add(() => {
      withTimings('onDragUpdate', () =>
        execute(
          getHooks().onDragUpdate,
          data,
          announce,
          messagePreset.onDragUpdate,
        ),
      );
    });
  };

  const drop = (result: DropResult) => {
    invariant(
      dragging,
      'Cannot fire onDragEnd when there is no matching onDragStart',
    );
    dragging = null;

    frameMarshal.flush();
    // not adding to frame marshal
    withTimings('onDragEnd', () =>
      execute(getHooks().onDragEnd, result, announce, messagePreset.onDragEnd),
    );
  };

  // A non user initiated cancel
  const abort = () => {
    // aborting can happen defensively
    if (!dragging) {
      return;
    }

    const result: DropResult = {
      ...getDragStart(dragging.lastCritical),
      combine: null,
      destination: null,
      reason: 'CANCEL',
    };
    drop(result);
  };

  return {
    beforeStart,
    start,
    move,
    drop,
    abort,
  };
};