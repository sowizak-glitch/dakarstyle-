// SAMABUSINESS Global Core — minimal additive stylesheet
//
// Only logical properties (mirror automatically under [dir="rtl"]) and
// styling for the handful of new elements Global Core introduces. Never
// touches an existing selector, so it cannot regress current layout.

export const GLOBAL_CORE_CSS = `
html.sama-rtl{direction:rtl}
.sama-global-search{width:100%;margin-block-end:6px;padding:10px 12px;border:1px solid var(--line,#dce5df);border-radius:12px;font:inherit}
.sama-global-listbox{width:100%;border:1px solid var(--line,#dce5df);border-radius:12px;font:inherit;padding:4px}
.sama-global-select{width:100%;padding:10px 12px;border:1px solid var(--line,#dce5df);border-radius:12px;font:inherit;background:#fff}
.sama-global-currency{width:100%;padding:10px 12px;border:1px solid var(--line,#dce5df);border-radius:12px;font:inherit;text-transform:uppercase}
html.sama-rtl .modal-head .close{margin-inline-start:auto;margin-inline-end:0}
html.sama-rtl .field label{text-align:start}
`;

export function injectStyles(doc) {
  const document_ = doc || document;
  if (document_.getElementById('sama-global-core-styles')) return;
  const style = document_.createElement('style');
  style.id = 'sama-global-core-styles';
  style.textContent = GLOBAL_CORE_CSS;
  document_.head.appendChild(style);
}
