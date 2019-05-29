// @flow
import invariant from 'tiny-invariant';
import React from 'react';
import { render, fireEvent, createEvent } from 'react-testing-library';
import type {
  TryGetActionLock,
  Sensor,
  PreDragActions,
  DragActions,
} from '../../../../../src/types';
import App from '../app';

it('should block a single click if requested', () => {
  let tryGetLock: TryGetActionLock;

  const a: Sensor = (tryStart: TryGetActionLock) => {
    tryGetLock = tryStart;
  };

  const { getByText } = render(
    <React.Fragment>
      <App sensors={[a]} />
    </React.Fragment>,
  );
  const handle: HTMLElement = getByText('item: 0');
  invariant(tryGetLock);

  // trigger a drop
  const preDrag: ?PreDragActions = tryGetLock(handle);
  invariant(preDrag);
  const drag: DragActions = preDrag.lift({ mode: 'SNAP' });
  drag.drop({ shouldBlockNextClick: true });

  // fire click
  const first: MouseEvent = createEvent.click(handle);
  const second: MouseEvent = createEvent.click(handle);
  fireEvent(handle, first);
  fireEvent(handle, second);

  // only first click is prevented
  expect(first.defaultPrevented).toBe(true);
  expect(second.defaultPrevented).toBe(false);
});

it('should not block any clicks if not requested', () => {
  let tryGetLock: TryGetActionLock;

  const a: Sensor = (tryStart: TryGetActionLock) => {
    tryGetLock = tryStart;
  };

  const { getByText } = render(
    <React.Fragment>
      <App sensors={[a]} />
    </React.Fragment>,
  );
  const handle: HTMLElement = getByText('item: 0');
  invariant(tryGetLock);

  // trigger a drop
  const preDrag: ?PreDragActions = tryGetLock(handle);
  invariant(preDrag);
  const drag: DragActions = preDrag.lift({ mode: 'SNAP' });
  drag.drop({ shouldBlockNextClick: false });

  // fire click
  const first: MouseEvent = createEvent.click(handle);
  fireEvent(handle, first);

  // click not prevented
  expect(first.defaultPrevented).toBe(false);
});
