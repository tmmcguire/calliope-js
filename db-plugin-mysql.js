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

const sql = require('mockingbird-sql');

module.exports = function (pool) {

  // Convert Mockingbird-sql query to legal MySQL statement and arguments.
  pool.mockingbirdToSql = function (stmt) {
    return sql.mysql.MySql.mockingbirdToSql(stmt);
  };

  // Execute a SQL statement using either the pool or a specified connection.
  pool.executeQuery = function (sql, args, callback, connection = null) {
    if (connection) {
      return connection.query(sql, args, callback);
    } else {
      // THIS note: executeQuery must be called on an object (the 'pool' in
      // module.exports).
      return this.getPool().query(sql, args, callback);
    }
  };

  // Specialized version of executeQuery to return the id of the new row.
  pool.executeInsert = function (sql, args, callback, connection = null) {
    this.executeQuery(sql, args, function (error, results) {
      if (!error) { results = results.insertId }
      callback(error, results);
    }, connection);
  };

  // Get a connection from the pool: promise-based.
  pool.getConnectionP = function () {
    return new Promise((resolve) => {
      pool.getPool().getConnection((err, connection) => {
        if (err) { throw err }
        return resolve(connection);
      });
    });
  };

  // Begin a transaction on a connection: promise-based.
  pool.beginTransactionP = function (connection) {
    return new Promise((resolve) => {
      connection.beginTransaction((err) => {
        if (err) { throw err }
        return resolve(connection);
      });
    });
  };

  // Commit a transaction on a connection: promise-based.
  pool.commitP = function (connection) {
    return new Promise((resolve) => {
      connection.commit((err) => {
        if (err) { throw err }
        return resolve();
      });
    });
  };

  // Roll-back a transaction on a connection: promise-based.
  pool.rollbackP = function (connection) {
    return new Promise((resolve) => {
      connection.rollback(function () { resolve() });
    });
  };

  // Release a connection: promise-based.
  pool.releaseP = function (connection) {
    return new Promise((resolve) => {
      if (connection) { connection.release() }
      resolve();
    });
  };

  return pool;
};
