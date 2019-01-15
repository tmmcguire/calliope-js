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

const MySQLAdaptor = require('./db-plugin-mysql');

class Db {

  // Return a db query function based on a query object with type 'INSERT'.
  //
  // The values object's keys should be column names; the values should be
  // values.
  //
  // When inserting a row into a table with an autoincrement primary key, the
  // inserted id is returned from the results.
  _insertSql(query) {
    let adaptor = this._adaptor;
    if (query.columns === undefined) { throw 'INSERT descriptor missing columns' }
    if (query.table === undefined) { throw 'INSERT descriptor missing table name' }
    return function (values, cc = null) {
      // Filter out unknown keys
      if (!Object.keys(values).every((k) => query.columns[k])) {
        throw {
          error: 'unrecognized keys on insert: ' + Object.keys(values).filter((k) => !query.columns[k])
        };
      }
      let keys = Object.keys(values);
      // allow column value translations
      let valueParams = keys.map(key => typeof query.columns[key] === 'string' ? query.columns[key] : '?').join(', ');
      // convert values to array of values in keys' order
      values = keys.map(key => values[key]);
      let sql = `INSERT INTO ${query.table} (${keys.join(',')}) VALUES (${valueParams})`;
      if (typeof cc === 'function') {
        // callback
        return adaptor.executeInsert(sql, values, cc, null);
      } else {
        // promise
        return new Promise((resolve, reject) => {
          let cb = (error, results) => (error) ? reject(error) : resolve(results);
          return adaptor.executeInsert(sql, values, cb, cc);
        });
      }
    };
  }

  // Return a db query function based on a query object with type 'UPDATE'.
  //
  // The values object's keys should be column names; the values should be
  // values. A specified idColumn is used to identiy the row to update.
  _updateSql(query) {
    if (query.columns === undefined) { throw 'UPDATE descriptor missing columns' }
    if (query.table === undefined) { throw 'UPDATE descriptor missing table name' }
    if (query.idColumn === undefined) { throw 'UPDATE descriptor missing idColumn' }
    let adaptor = this._adaptor;
    return function (values, cc = null) {
      let exprs = [];
      let vals = [];
      for (let k of Object.keys(values)) {
        if (!query.columns[k] && k !== query.idColumn) {
          throw { error: 'unrecognized column names on insert: ' + k };
        } else if (k === query.idColumn) {
          // do not include id column in update
          continue;
        }
        let expr = (typeof query.columns[k] === 'string') ? query.columns[k] : '?';
        exprs.push(`${k} = ${expr}`);
        vals.push(values[k]);
      }
      vals.push(values[query.idColumn]);
      let sql = `UPDATE ${query.table} SET ${exprs.join(', ')} WHERE ${query.idColumn} = ?`;
      if (typeof cc === 'function') {
        // callback
        return adaptor.executeQuery(sql, vals, cc, null);
      } else {
        // promise
        return new Promise((resolve, reject) => {
          let cb = (error, results) => (error) ? reject(error) : resolve(results);
          return adaptor.executeQuery(sql, vals, cb, cc);
        });
      }
    };
  }

  // Return a db query function based on a simple query object.
  //
  // The simple query object should not have a 'sql' key and returns all rows
  // from the table 'name'.
  //
  // The values parameter is a (empty, in this case) object or array containing
  // the arguments to the query.
  //
  // The cc parameter is either a callback (for callback-style programming), a
  // DB connection for a transaction, or null. The latter two cases return a
  // promise for promise- or async/await-style programming.
  _simpleSql(query) {
    let adaptor = this._adaptor;
    return function (values, cc = null) {
      let sql = `SELECT * FROM ${query.name}`;
      if (typeof cc === 'function') {
        // callback
        return adaptor.executeQuery(sql, values, cc, null);
      } else {
        // promise
        return new Promise((resolve, reject) => {
          let cb = (error, results) => (error) ? reject(error) : resolve(results);
          return adaptor.executeQuery(sql, values, cb, cc);
        });
      }
    };
  }

  // Return a db query function based on a given SQL string.
  //
  // The SQL string should be under a 'sql' key. It can be a SELECT, INSERT,
  // UPDATE, or DELETE.
  //
  // The values parameter is a object or array containing the arguments to the
  // query.
  //
  // The cc parameter is either a callback (for callback-style programming), a
  // DB connection for a transaction, or null. The latter two cases return a
  // promise for promise- or async/await-style programming.
  _givenSql(query) {
    let adaptor = this._adaptor;
    return function (values, cc = null) {
      let sql = query.sql;
      if (typeof query.sql === 'function') {
        // handle Mockingbird-sql queries
        let q = adaptor.mockingbirdToSql(query.sql(values));
        sql = q.sql;
        values = q.values;
      }
      if (typeof cc === 'function') {
        // callback
        return adaptor.executeQuery(sql, values, cc, null);
      } else {
        // promise
        return new Promise((resolve, reject) => {
          let cb = (error, results) => (error) ? reject(error) : resolve(results);
          return adaptor.executeQuery(sql, values, cb, cc);
        });
      }
    };
  }

  // Create the functions for each query.
  //
  // query objects:
  // - name: the method name for this query.
  // - type: INSERT, UPDATE, or SELECT (default).
  // - sql: SQL statement.
  constructor(queries, dbAdaptor) {
    this._adaptor = dbAdaptor;
    if (queries) {
      for (let query of queries) {
        query.type = query.type || 'SELECT';
        // generate the base function
        switch (query.type.toUpperCase()) {
          case 'INSERT':
            this[query.name] = this._insertSql(query);
            break;
          case 'UPDATE':
            this[query.name] = this._updateSql(query);
            break;
          default:
            if (query.sql) {
              this[query.name] = this._givenSql(query);
            } else {
              this[query.name] = this._simpleSql(query);
            }
            break;
        }
      }
    }
  }

  // ==================================

  // Begin a transaction, returing the connection for further statements.
  async beginTransaction() {
    let db = this._adaptor;
    let connection = null;
    try {
      connection = await db.getConnectionP();
      await db.beginTransactionP(connection);
      return connection;
    } catch (error) {
      if (connection) { await db.releaseP(connection) }
      throw error;
    }
  }

  // Commit a transaction and release the connection. The connection will be
  // rolled back, in case of an error.
  async commit(connection) {
    let db = this._adaptor;
    try {
      await db.commitP(connection);
    } catch (error) {
      await db.rollbackP(connection);
      throw error;
    } finally {
      await db.releaseP(connection);
    }
  }

  // Roll back a transaction and release the connection.
  async rollback(connection) {
    let db = this._adaptor;
    try {
      await db.rollbackP(connection);
    } catch (error) {
      console.error('error rolling back transaction: ' + JSON.stringify(error, null, '  '));
    } finally {
      await db.releaseP(connection);
    }
  }

  // ==================================

  // Return the underlying connection pool.
  getPool() {
    return this._adaptor.getPool();
  }

}

module.exports = {
  Db: Db,
  MySQLAdaptor: MySQLAdaptor,
};
