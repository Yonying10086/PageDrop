import { el } from '../utils/dom';

export interface StepItem {
  label: string;
  state: 'idle' | 'active' | 'done' | 'error';
  note?: string;
}

export interface StepsHandle {
  node: HTMLElement;
  set(step: number, state: 'active' | 'done' | 'error', note?: string): void;
}

export function createProgressSteps(labels: readonly string[]): StepsHandle {
  const items: StepItem[] = labels.map((label) => ({ label, state: 'idle' }));
  const node = el('div', { class: 'steps', role: 'status', 'aria-live': 'polite' });

  const render = (): void => {
    node.replaceChildren(
      ...items.map((it) =>
        el(
          'div',
          { class: `step ${it.state === 'idle' ? '' : it.state}` },
          el('span', { class: 'dot' }),
          el('span', {}, it.label),
          it.note ? el('span', { class: 'faint' }, `· ${it.note}`) : null,
        ),
      ),
    );
  };

  render();

  return {
    node,
    set(step, state, note) {
      const item = items[step];
      if (!item) return;
      item.state = state;
      item.note = note;
      render();
    },
  };
}
