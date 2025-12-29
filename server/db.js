const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  ssl: false
});

db.connect((err) => {
  if (err) {
    console.error("DB connection failed:", err);
    console.error("Connection config:", {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.MYSQLDATABASE,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      hasPassword: !!process.env.DB_PASSWORD
    });
  } else {
    console.log("Connected to MySQL database");
  }
});

module.exports = db;