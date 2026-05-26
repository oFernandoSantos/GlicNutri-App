const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateGlucoseValue,
  validateInsulinDose,
  validateMedicationEntry,
  validateMealFoods,
} = require('../validacoesPaciente');

test('validateGlucoseValue aceita faixa clinica', () => {
  assert.equal(validateGlucoseValue(110).ok, true);
  assert.equal(validateGlucoseValue('95').ok, true);
});

test('validateGlucoseValue rejeita vazio e extremos', () => {
  assert.equal(validateGlucoseValue('').ok, false);
  assert.equal(validateGlucoseValue(10).ok, false);
  assert.equal(validateGlucoseValue(900).ok, false);
});

test('validateInsulinDose rejeita dose perigosa', () => {
  assert.equal(validateInsulinDose(0).ok, false);
  assert.equal(validateInsulinDose(120).ok, false);
  assert.equal(validateInsulinDose(12).ok, true);
});

test('validateMedicationEntry exige nome', () => {
  assert.equal(validateMedicationEntry({ medicineName: '' }).ok, false);
  assert.equal(validateMedicationEntry({ medicineName: 'Metformina', medicineQuantity: '500mg' }).ok, true);
});

test('validateMealFoods exige alimento nomeado', () => {
  assert.equal(validateMealFoods([]).ok, false);
  assert.equal(validateMealFoods([{ nome: 'Arroz' }]).ok, true);
});
