# calliope-js

Simple, generic database interface

## Features

- Callback and promise/async/await support
- Transaction support
- Simple, function interface
- MySQL support
- Partial Oracle support
- More databases coming soon!

## Configuration

The first step is to configure an object providing access to a connection pool
to the database. This object needs to have a single method, `getPool`, which
returns the connection pool.

I use a separate module for each database the application requires, containing
the connection pool as effectively static so that there is one connection pool
for the database in the application.

This object is then wrapped by the appropriate Calliope adaptor, which supplies
the DB-specific methods needed by Calliope.

Here's an example for MySQL, using the MySQLAdaptor:

```javascript
const mysql = require('mysql2');
const calliope = require('calliope');

const config = require('./configuration');

const pool = mysql.createPool({
  'connectionLimit': 10,
  'host': config.database.host,
  'port': Number.parseInt(config.database.port),
  'user': config.database.user,
  'namedPlaceholders': true,
  'password': config.database.password,
  'database': config.database.database,
});

module.exports = calliope.MySQLAdaptor({
  getPool: () => pool,
});
```

And here is an Oracle example:

```javascript
const oracle = require('oracledb');
const calliope = require('calliope');

const config = require('./configuration');

var pool = null;

oracle.createPool({
  user: config.database.oracle.user,
  password: config.database.oracle.password,
  connectString: config.database.oracle.host +
    ':' + config.database.oracle.port +
    '/' + config.database.oracle.service,
  poolMax: 10,
}, function (error, connection) {
  if (error) {
    console.error(error);
  } else {
    pool = connection;
  }
});

module.exports = calliope.OracleAdaptor({
  getPool: function () {
    if (pool) {
      return pool;
    } else {
      throw 'Oracle: pool not available';
    }
  },
});
```

Note that Oracle's `createPool` function is asynchronous and the resulting
connection will not be available immediately. (Hence the callback assigning to
the `pool` variable.)

**Note** Oracle support is not entirely complete as of this version. That should
be remedied soon.

## Usage

Calliope's base use-case is for static SQL statements (but see Mockingbird-SQL
support). Fundamentally, you feed the constructor an array of SQL statements and
related information along with the database connection pool object described
above, and the resulting object has one methed per SQL statement.

### An array of queries

This is a sample list of queries:

```javascript
const queries = [
  {
    name: 'get_location_by_event',
    sql:  'SELECT location_id FROM event WHERE event_id = :event_id',
  },
  {
    name: 'get_event_notifier',
    sql: `
    SELECT person.person_id
    FROM
      person
      JOIN event on (person.person_id = event.fk_person_id)
    WHERE
      person.assoc-type_id = 6
      AND event.fk_person_id = :event_id
    LIMIT 1`,
  },
];
```

To use these queries with the MySQL connection pool above, create a Calliope
connection object:

```javascript
const calliope = require('calliope');
const mysqlDb = require('../utility/mysql-db');

const Db = new calliope.Db(queries, mysqlDb);
```

Then, the SQL queries can be made by executing functions:

```javascript
Db.get_location_by_event({ event_id: event_id }, function (error, result) {
  // check error and do something useful with result
});
```

Or, it can be called with async/await:

```javascript
let results = await Db.get_location_by_event({event_id: event_id});
```

Transactions start by getting a connection using `beginTransaction`, and should
be committed with `commit` or rolled-back with `rollback`:

```javascript
try {
  let connection = await Db.beginTransaction();
  try {
    let locationResults =
      await Db.get_location_by_event({event_id: event_id}, connection);
    let notifierResults =
      await Db.get_event_notifier({event_id: event_id}, connection);
    // ...
    await Db.commit(connection);
  } catch (error) {
    await Db.rollback(connection);
    throw error; // pass error along after rollback
  }
} catch (error) {
  // do something with error
}
```

Note that the transaction support requires the use of async/await (or Promise).
(The connection and the callback are passed as the second argument for
usability.)

Finally, as an escape mechanism, the connection pool itself can be accessed:

```javascript
let pool = Db.getPool();
```

## Details

### Query objects

The objects in the array of queries can have the following keys:

- **name:** This key is required and supplies the name of the generated method
  on the Calliope object. This must be a string.
- **sql:** This key provides the SQL query to execute. This can be either a
  string, giveng the SQL, or a function, returning a
  [mockingbird-sql](https://github.com/tmmcguire/mockingbird-sql) generated-SQL
  structure. See below.
- **type:** This key describes the type of the query: SELECT, INSERT, or UPDATE.
  The default is "SELECT". See below.
- **table:** See INSERT and UPDATE below.
- **columns:** See INSERT and UPDATE below.
- **idColumn:** See UPDATE below.

### Generated functions

The generated methods look like `function (values, cc = null)`.

`values` are the arguments to the query. These are generally passed to the
database driver. For the MySQL (i.e. with `namedPlaceholders: true`) and Oracle
configurations described above, `values` can be an object with keys matching
':parameters' in the query.

If the `sql` key in the query object is a function returning a mockingbird-sql
structure, the values are passed to the mockingbird-sql function, which converts
the structure into a SQL string an the actual arguments.

`cc` is either

- null, in which case the query is made normally but the method returns a Promise,
- a callback function with error and results parameters, in which case the query
  is made and the output passed to the callback, or
- a connection, in which case the connection is used to perform the query and a
  Promise is returned.

### Query types

**SELECT** is the default and operates as described above. Note that the actual
SQL can be any of SELECT, INSERT, UPDATE, DELETE, etc.

**INSERT** is intended to provide an easy, general way to insert a row into the
table. In this case, the SQL is generated, and the query object needs two
additional keys:

- **table:** the name of the table to insert into, and
- **columns:** an object mapping column names in the table to one of:
  - a string, which will be used as the parameter in the SQL query, or
  - `true`, in which case the SQL parameter will be '?'.

The `values` parameter to the generated method will provide the data to be
inserted.

An example:

```javascript
  {
    name:    'insert_event',
    type:    'INSERT',
    table:   'event',
    columns: {
      'create_time': 'FROM_UNIXTIME(?)',
      'created_by': true,
      'event_details': true,
    },
  },
```

Assume `values` is

```javascript
{
  create_time: Math.floor(Date.now() / 1000),
  created_by: 'ted',
  event_details: 'Something happened',
}
```

In this case the SQL will be something like:

```sql
INSERT INTO event (
  create_time,
  created_by,
  event_details
) VALUES (
  FROM_UNIXTIME(?),
  ?,
  ?
)
```

**UPDATE** is intended to provide an easy, general way to update a row in the
table. It is very similar to INSERT, but the query object requires an additional
key: `idColumn`. This key supplies the column name used to identify the row to
be updated.

Another example:

```javascript
  {
    name:    'update_EVENT',
    type:    'UPDATE',
    table:   'event',
    columns: {
      'create_time': 'FROM_UNIXTIME(?)',
      'created_by': true,
      'event_details': true,
    },
    idColumn: 'event_id',
  },
```

Assuming the values are:

```javascript
{
  event_details: 'Something happened, again',
  create_time: Math.floor(Date.now() / 1000),
  event_id: 12,
}
```

The generated SQL will be:

```sql
UPDATE event SET
  event_details = ?,
  create_time = FROM_UNIXTIME(?),
WHERE
  event_id = ?
```

## TODO

- Support inserts for Oracle
