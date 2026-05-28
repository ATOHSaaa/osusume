const COPY_LABEL = 'リンクをコピー';
const COPIED_LABEL = 'コピーしました';
const FAIL_LABEL = 'コピーに失敗';

function copyWithFallback(url: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(url);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function setCopyButtonState(button: HTMLButtonElement, state: 'default' | 'copied' | 'failed'): void {
  if (state === 'copied') {
    button.setAttribute('aria-label', COPIED_LABEL);
    button.setAttribute('title', COPIED_LABEL);
    return;
  }

  if (state === 'failed') {
    button.setAttribute('aria-label', FAIL_LABEL);
    button.setAttribute('title', FAIL_LABEL);
    return;
  }

  button.setAttribute('aria-label', COPY_LABEL);
  button.setAttribute('title', COPY_LABEL);
}

export function bindArticleShareCopyButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('[data-copy-url]').forEach((button) => {
    if (button.dataset.shareBound === 'true') return;
    button.dataset.shareBound = 'true';

    button.addEventListener('click', async () => {
      const url = button.dataset.copyUrl;
      if (!url) return;

      try {
        await copyWithFallback(url);
        setCopyButtonState(button, 'copied');
        button.disabled = true;
        window.setTimeout(() => {
          setCopyButtonState(button, 'default');
          button.disabled = false;
        }, 2000);
      } catch {
        setCopyButtonState(button, 'failed');
        window.setTimeout(() => {
          setCopyButtonState(button, 'default');
        }, 2000);
      }
    });
  });
}
