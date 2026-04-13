export const passwordRequirements = [
  {
    key: 'length',
    label: '8 caracteres ou mais',
    test: (value) => String(value || '').length >= 8,
    message: 'A senha precisa ter pelo menos 8 caracteres.',
  },
  {
    key: 'lowercase',
    label: 'Uma letra minuscula',
    test: (value) => /[a-z]/.test(String(value || '')),
    message: 'A senha precisa ter pelo menos uma letra minuscula.',
  },
  {
    key: 'uppercase',
    label: 'Uma letra maiuscula',
    test: (value) => /[A-Z]/.test(String(value || '')),
    message: 'A senha precisa ter pelo menos uma letra maiuscula.',
  },
  {
    key: 'number',
    label: 'Um numero',
    test: (value) => /\d/.test(String(value || '')),
    message: 'A senha precisa ter pelo menos um numero.',
  },
  {
    key: 'symbol',
    label: 'Um simbolo',
    test: (value) => /[^A-Za-z0-9]/.test(String(value || '')),
    message: 'A senha precisa ter pelo menos um simbolo.',
  },
];

export function getPasswordValidationMessage(value, emptyMessage = 'Informe a senha.') {
  if (!value) return emptyMessage;

  const requirement = passwordRequirements.find((item) => !item.test(value));
  return requirement?.message || '';
}
