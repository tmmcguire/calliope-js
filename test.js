'use strict';

const assert = require('assert');

const sqlite3 = require('sqlite3');

const calliope = require('./lib.js');

let db = new sqlite3.Database('./test-db/test-db.sqlite3', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the test-db database.');
});

const testDb = calliope.Sqlite3Adaptor({
  getPool: () => db,
  options: {
    log_sql: false,
    log_parameters: true,
  }
});

const queries = [
  {
    name: 'getTbl1',
    sql: 'SELECT * FROM tbl1',
  },
  {
    name: 'getTbl1ByTwo',
    sql: 'SELECT * FROM tbl1 WHERE two = ?',
  }
];

const Db = new calliope.Db(queries, testDb);

async function simpleTest(db) {
  try {
    assert.deepStrictEqual(await db.getTbl1(), [
      { one: 'hello', two: 10 },
      { one: 'goodbye', two: 20 } ]
    );
    assert.deepStrictEqual(await db.getTbl1ByTwo(10), [
      { one: 'hello', two: 10 },
    ]);
    assert.deepStrictEqual(await db.getTbl1ByTwo(0), [
    ]);
  } catch (err) {
    console.error(err);
  }
}
simpleTest(Db);

// close the database connection
db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Close the database connection.');
});
