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

// https://www.npmjs.com/package/oracledb

const sql = require('mockingbird-sql');

// Oracle uses a strange format for SQL parameters. Multiple keys can be
// specified in the object; val is the important one. Object parameters will be
// passed on.
//
// TODO: Is this a good idea?
function argsToParameters(args) {
  let parameters = {};
  for (let key of Object.keys(args)) {
    if (typeof args[key] !== 'object') {
      parameters[key] = { val: args[key] };
    } else {
      parameters[key] = args[key];
    }
  }
  return parameters;
}

// Convert Oracle results/metadata arrays to simple objects. Yes, I know there's
// an option to do this. I want the names in lowercase anyway.
function resultsToObjects(metadata, rows) {
  let results = [];
  if (rows) {
    for (let row of rows) {
      let object = {};
      for (let i = 0; i < row.length; ++i) {
        object[metadata[i].name.toLowerCase()] = row[i];
      }
      results.push(object);
    }
  }
  return results;
}

function closeHandler(error) {
  if (error) {
    console.error('error closing Oracle connection: ', error);
  }
}

// Execute a single SQL statement using the pool or a specified connection.
//
// Assumption: if a connection is provided, it's in a transaction and should not
// auto-commit.
function executeQuery(sql, args, callback, connection = null) {
  console.log(sql + ' : ' + JSON.stringify(args, null, '  '));
  if (connection) {
    connection.execute(sql, argsToParameters(args), {
      autoCommit: false,
    }, function (error, results) {
      if (error) { return callback(error, null) }
      return callback(null, resultsToObjects(results.metaData, results.rows));
    });
  } else {
    this.getPool().getConnection(function (error, connection) {
      connection.execute(sql, argsToParameters(args), {
        autoCommit: true,
      }, function (error, results) {
        connection.close(closeHandler);
        if (error) { return callback(error, null) }
        return callback(null, resultsToObjects(results.metaData, results.rows));
      });
    });
  }
}

// --------------------------

// TODO: executeInsert - return id of inserted row. See db-plugin-mysql.

// --------------------------

module.exports = function (pool) {

  pool.mockingbirdToSql = function (stmt) { return sql.oracle.Oracle.toSql(stmt) };

  pool.executeQuery = executeQuery;
  pool.executeInsert = executeQuery;

  pool.getConnectionP = () => { return pool.getPool().getConnection() };
  pool.beginTransactionP = (connection) => { return new Promise(resolve => resolve(connection)) };
  pool.commitP = (connection) => { return connection.commit() };
  pool.rollbackP = (connection) => { return connection.rollback() };
  pool.releaseP = (connection) => { return connection.close() };

  return pool;
};
