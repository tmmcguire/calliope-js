// Calliope-js: Simple, generic database interface
//
//  Copyright (C) 2019 Tommy M. McGuire
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
//  General Public License for more details.
//
//  You should have received a copy of the GNU General
//  Public License along with this program. If not, see
//  <https://www.gnu.org/licenses/>.

'use strict';

const sql = function () {
  try {
    return require('mockingbird-sql');
  } catch (err) {
    return null;
  }
}();

module.exports = function (database) {

  switch (typeof database.options) {
    case 'undefined': database.options = { }; break;
    case 'object':    break;
    default:          throw 'OPTIONS must be an object';
  }

  // Convert Mockingbird-sql query to legal SQLite3 statement and arguments.
  database.mockingbirdToSql = function (stmt) {
    if (sql) {
      return sql.sqlite3.Sqlite3.toSql(stmt);
    } else {
      throw 'mockingbird-sql not available';
    }
  };

  // Execute a SQL statement using either the pool or a specified connection.
  database.executeQuery = function (sql, args, callback, connection = null) {
    if (database.options.log_sql && database.options.log_parameters) {
      console.log(`${sql} : ${JSON.stringify(args, null, '  ')}`);
    } else if (database.options.log_sql) {
      console.log(`${sql}`);
    }
    if (connection) {
      return connection.all(sql, args, callback);
    } else {
      // THIS note: executeQuery must be called on an object (the 'pool' in
      // module.exports).
      return this.getPool().all(sql, args, callback);
    }
  };

  // Specialized version of executeQuery to return the id of the new row.
  database.executeInsert = function (sql, args, callback, connection = null) {
    if (database.options.log_sql && database.options.log_parameters) {
      console.log(`${sql} : ${JSON.stringify(args, null, '  ')}`);
    } else if (database.options.log_sql) {
      console.log(`${sql}`);
    }
    this.run(sql, args, function (error, results) {
      if (!error) { results = this.lastID }
      callback(error, results);
    }, connection);
  };

  // Get a connection from the pool: promise-based.
  database.getConnectionP = async function () {
    return database.getPool();
  };

  // Begin a transaction on a connection: promise-based.
  database.beginTransactionP = async function (connection) {
    connection.run('BEGIN EXCLUSIVE TRANSACTION',
      (error) => { throw error }
    );
    return connection;
  };

  // Commit a transaction on a connection: promise-based.
  database.commitP = async function (connection) {
    connection.run('COMMIT TRANSACTION',
      (error) => { throw error }
    );
    return connection;
  };

  // Roll-back a transaction on a connection: promise-based.
  database.rollbackP = async function (connection) {
    connection.run('ROLLBACK TRANSACTION',
      (error) => { throw error }
    );
    return connection;
  };

  // Release a connection: promise-based.
  database.releaseP = function (_connection) { };

  return database;
};
