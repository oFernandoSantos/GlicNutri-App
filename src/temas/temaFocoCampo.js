export const inputWebFocusReset = {
  boxShadow: 'none',
  outlineColor: 'transparent',
  outlineStyle: 'none',
  outlineOffset: 0,
  outlineWidth: 0,
};

export const authFieldBase = {
  borderWidth: 1,
  borderColor: '#EEF2F7',
  borderRadius: 15,
  backgroundColor: '#ffffff',
  minHeight: 52,
  paddingHorizontal: 14,
  paddingVertical: 14,
  ...inputWebFocusReset,
};

export const authFieldWrapperBase = {
  borderWidth: 1,
  borderColor: '#EEF2F7',
  borderRadius: 15,
  backgroundColor: '#ffffff',
  minHeight: 52,
};

export const authPasswordInputBase = {
  color: '#333',
  paddingHorizontal: 14,
  paddingRight: 48,
  paddingVertical: 14,
};

export const inputFocusBorder = {
  ...inputWebFocusReset,
  borderColor: '#EEF2F7',
  boxShadow: 'none',
};
