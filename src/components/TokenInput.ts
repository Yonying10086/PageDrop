import { el } from '../utils/dom';

export interface TokenInputHandle {
  node: HTMLElement;
  input: HTMLInputElement;
  getValue(): string;
  setDisabled(v: boolean): void;
}

/** 带显示/隐藏切换的密钥输入框 */
export function createTokenInput(placeholder: string): TokenInputHandle {
  const input = el('input', {
    type: 'password',
    placeholder,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'GitHub Personal Access Token',
  });

  const toggle = el(
    'button',
    { class: 'btn ghost small', type: 'button', 'aria-label': '显示或隐藏密钥' },
    '显示',
  );

  toggle.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? '显示' : '隐藏';
  });

  const node = el('div', { class: 'input-row' }, input, toggle);

  return {
    node,
    input,
    getValue: () => input.value.trim(),
    setDisabled(v: boolean) {
      input.disabled = v;
      toggle.disabled = v;
    },
  };
}
