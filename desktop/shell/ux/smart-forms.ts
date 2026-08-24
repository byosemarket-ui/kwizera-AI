import type { FormFieldState } from "./types";

export function createField(name: string, value = "", required = false): FormFieldState {
  return { name, value, required, error: null, touched: false, suggestions: [] };
}

export function validateField(field: FormFieldState, rules?: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  suggestFrom?: string[];
}): FormFieldState {
  const value = field.value.trim();
  let error: string | null = null;
  if (field.required && !value) error = "Required";
  else if (rules?.minLength != null && value.length < rules.minLength) error = `At least ${rules.minLength} characters`;
  else if (rules?.maxLength != null && value.length > rules.maxLength) error = `At most ${rules.maxLength} characters`;
  else if (rules?.pattern && value && !rules.pattern.test(value)) error = "Invalid format";

  const suggestions = !value || !rules?.suggestFrom
    ? []
    : rules.suggestFrom
      .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
      .slice(0, 6);

  return { ...field, error, suggestions, touched: true };
}

export function validateForm(fields: FormFieldState[]): { valid: boolean; fields: FormFieldState[] } {
  const next = fields.map((f) => validateField(f));
  return { valid: next.every((f) => !f.error), fields: next };
}

export function autofillSuggestion(field: FormFieldState, suggestion: string): FormFieldState {
  return validateField({ ...field, value: suggestion, touched: true });
}
