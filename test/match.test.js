const test = require('node:test');
const assert = require('node:assert');
const { check } = require('../server/match');

const ok = (g, id) => assert.ok(check(g, id).correct, `"${g}" should match ${id}`);
const no = (g, id) => assert.ok(!check(g, id).correct, `"${g}" should NOT match ${id}`);

test('exact, partial and nickname answers', () => {
  ok('George Washington', 'washington');
  ok('washington', 'washington');
  ok('Lincoln', 'lincoln');
  ok('abe lincoln', 'lincoln');
  ok('JFK', 'kennedy');
  ok('FDR', 'f-roosevelt');
  ok('Teddy Roosevelt', 't-roosevelt');
  ok('James Polk', 'polk');
  ok('James K. Polk', 'polk');
  ok('Van Buren', 'van-buren');
  ok('Ulysses Grant', 'grant');
  ok('John Quincy Adams', 'jq-adams');
  ok('George W. Bush', 'w-bush');
  ok('George HW Bush', 'hw-bush');
  ok('Dubya', 'w-bush');
  ok('LBJ', 'lb-johnson');
  ok('Ike', 'eisenhower');
  ok('President Obama', 'obama');
});

test('typos are forgiven', () => {
  ok('Eisenhauer', 'eisenhower');
  ok('Jeferson', 'jefferson');
  ok('Obamma', 'obama');
  ok('Mckinly', 'mckinley');
  ok('Theodore Rosevelt', 't-roosevelt');
});

test('ambiguous or wrong answers are rejected', () => {
  no('Adams', 'j-adams');
  no('John Adams', 'jq-adams');
  no('John Quincy Adams', 'j-adams');
  no('Bush', 'w-bush');
  no('Roosevelt', 'f-roosevelt');
  no('Johnson', 'a-johnson');
  no('Andrew Johnson', 'lb-johnson');
  no('George W Bush', 'hw-bush');
  no('Benjamin Harrison', 'wh-harrison');
  no('Obama', 'biden');
  no('', 'obama');
  assert.ok(check('Bush', 'w-bush').almost);
  assert.strictEqual(check('Lincoln', 'washington').matchedId, 'lincoln');
});
