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

  _insertSql(_query) {

  }

  _updateSql(_query) {

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
        // let fcn = null;
        // generate the base function
        switch (query.type.toUpperCase()) {
          // case 'INSERT':
          //   fcn = this._insertSql(query);
          //   break;
          // case 'UPDATE':
          //   fcn = this._updateSql(query);
          //   break;
          default:
            if (query.sql) {
              this[query.name] = this._givenSql(query);
              // fcn = this._givenSql(query);
            } else {
              this[query.name] = this._simpleSql(query);
              // fcn = this._simpleSql(query);
            }
            break;
        }
        // // associate name to promise or base fcn
        // if (query.promise) {
        //   this[query.name] = this._asPromise(fcn);
        // } else {
        //   this[query.name] = fcn;
        // }
      }
    }
  }

  getPool() {
    return this._adaptor.getPool();
  }

}

module.exports = {
  Db: Db,
  MySQLAdaptor: MySQLAdaptor,
};
