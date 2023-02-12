import * as lmdb from 'lmdb';
const db = lmdb.open({ path: 'matcher/db' });

export default db;