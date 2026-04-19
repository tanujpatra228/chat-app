const { Pool } = require("pg");

class DatabaseSingleton {
  constructor() {
    if (DatabaseSingleton.instance) {
      return DatabaseSingleton.instance;
    }

    const sslConfig = process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : false;

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
    });

    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client:", err);
      process.exit(1);
    });

    DatabaseSingleton.instance = this;
  }

  getInstance() {
    return this.pool;
  }

  getPool() {
    return this.pool;
  }

  async closePool() {
    if (this.pool) {
      await this.pool.end();
      DatabaseSingleton.instance = null;
    }
  }
}

const singleton = new DatabaseSingleton();

module.exports = {
  pool: singleton.getInstance(),
  singleton: singleton,
};
