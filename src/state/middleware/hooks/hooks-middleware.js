// @flow
import getPublisher from './publisher';
import type {
  State,
  DropResult,
  Hooks,
  Critical,
  Announce,
} from '../../../types';
import type {
  Action,
  Middleware,
  MiddlewareStore,
  Dispatch,
} from '../../store-types';

export default (getHooks: () => Hooks, announce: Announce): Middleware => {
  const publisher = getPublisher((getHooks: () => Hooks), (announce: Announce));

  return (store: MiddlewareStore) => (next: Dispatch) => (
    action: Action,
  ): any => {
    if (action.type === 'INITIAL_PUBLISH') {
      const critical: Critical = action.payload.critical;
      console.log('BEFORE');
      publisher.beforeStart(critical, action.payload.movementMode);
      console.log('NEXT');
      next(action);
      console.log('START');
      publisher.start(critical, action.payload.movementMode);
      return;
    }

    // All other hooks can fire after we have updated our connected components
    console.log('NEXT');
    next(action);

    // Drag end
    if (action.type === 'DROP_COMPLETE') {
      const result: DropResult = action.payload;
      console.log('DROP');
      publisher.drop(result);
      return;
    }

    // Drag state resetting - need to check if
    // we should fire a onDragEnd hook
    if (action.type === 'CLEAN') {
      publisher.abort();
      return;
    }

    // ## Perform drag updates
    // impact of action has already been reduced

    const state: State = store.getState();
    if (state.phase === 'DRAGGING') {
      console.log('MOVE?');
      publisher.move(state.critical, state.impact);
    }
  };
};
