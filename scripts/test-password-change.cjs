/* global __dirname */
// Run with: node scripts/test-password-change.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../utils/passwordChange.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { canChangePasswordForAccount, validatePasswordChange, validateNewPassword, passwordChecks } = loaded.exports;
const values = { current_password: 'Original-password1!', password: 'Updated-password2!', password_confirmation: 'Updated-password2!' };

test('Google registration or Google login hides password changes independently', () => {
  assert.equal(canChangePasswordForAccount({ registered_with_google: true, authentication_method: 'password', can_change_password: true }), false);
  assert.equal(canChangePasswordForAccount({ registered_with_google: false, authentication_method: 'google', can_change_password: true }), false);
  assert.equal(canChangePasswordForAccount({ can_change_password: true }, { authentication_method: 'google' }), false);
  assert.equal(canChangePasswordForAccount({ can_change_password: true }, { registered_with_google: true }), false);
});

test('manual accounts remain eligible without inferring registration from a Gmail address', () => {
  assert.equal(canChangePasswordForAccount({ email: 'manual@gmail.com', registered_with_google: false, authentication_method: 'password' }), true);
  assert.equal(canChangePasswordForAccount({ can_change_password: true }), true);
  assert.equal(canChangePasswordForAccount({ can_change_password: false, authentication_method: 'password' }), false);
  assert.equal(canChangePasswordForAccount(null), false);
});

test('valid credentials pass and spaces and punctuation remain exact', () => {
  assert.deepEqual(validatePasswordChange(values), {});
  const exact = { current_password: ' Original-password1! ', password: ' <Updated-password2!> ', password_confirmation: ' <Updated-password2!> ' };
  assert.deepEqual(validatePasswordChange(exact), {});
  assert.equal(exact.password, ' <Updated-password2!> ');
});

test('forgot-password validation requires confirmation without an existing password', () => {
  assert.deepEqual(validateNewPassword(' <Updated-password2!> ', ' <Updated-password2!> '), {});
  assert.ok(validateNewPassword('Updated-password2!', '').password_confirmation);
  assert.ok(validateNewPassword('Updated-password2!', 'Different1!').password_confirmation);
  assert.ok(validateNewPassword('lowercase2!', 'lowercase2!').password);
  assert.ok(validateNewPassword('é'.repeat(34) + 'Ab1!xx', 'é'.repeat(34) + 'Ab1!xx').password);
});

test('live checks enforce the mobile registration password requirements', () => {
  assert.ok(passwordChecks(values.password).every(check => check.valid));
  for (const password of ['Short1!', 'lowercase1!', 'Uppercase!', 'Uppercase12']) {
    assert.ok(validatePasswordChange({ ...values, password, password_confirmation: password }).password);
  }
});

test('missing current password, reuse and confirmation mismatch are rejected', () => {
  assert.ok(validatePasswordChange({ ...values, current_password: '   ' }).current_password);
  assert.ok(validatePasswordChange({ ...values, password: values.current_password, password_confirmation: values.current_password }).password);
  assert.ok(validatePasswordChange({ ...values, password_confirmation: 'Different-password3!' }).password_confirmation);
});

test('overlong UTF-8 passwords and control characters are blocked before submission', () => {
  for (const password of ['A'.repeat(70) + '1!x', 'é'.repeat(30) + 'Uppercase1!extra', 'Updated-password2!\x00']) {
    assert.ok(validatePasswordChange({ ...values, password, password_confirmation: password }).password);
  }
  assert.ok(validatePasswordChange({ ...values, current_password: 'Original-password1!\n' }).current_password);
  assert.equal(validatePasswordChange({ ...values, password: 'A'.repeat(70) + '1!', password_confirmation: 'A'.repeat(70) + '1!' }).password, undefined);
});
