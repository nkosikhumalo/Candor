const db = require("../database/db");

async function createUser(user) {
  const {
    first_name,
    last_name,
    email,
    username,
    password,
    role,
    phone,
    date_of_birth,
    id_number,
    passport_number,
    country_of_issue,
  } = user;

  return db.createUser({
    first_name,
    last_name,
    email,
    username,
    password,
    role,
    phone,
    date_of_birth,
    id_number,
    passport_number,
    country_of_issue,
  });
}

async function createUserWithVerifiedEmailOtp(user) {
  return db.createUserWithVerifiedEmailOtp(user);
}

async function findUserByEmail(email) {
  return db.findUserByEmail(email);
}

async function findUserById(id) {
  return db.findUserById(id);
}

async function findUserByUsername(username) {
  return db.findUserByUsername(username);
}

module.exports = {
  createUser,
  createUserWithVerifiedEmailOtp,
  findUserByEmail,
  findUserById,
  findUserByUsername,
};
